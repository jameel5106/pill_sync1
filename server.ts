import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';
import { GoogleGenAI, Type } from '@google/genai';
import { ALL_MEDICINE_FORM_IDS } from './src/config/medicineForms';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// High payload limit for high-resolution medical prescription photos
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Allow Capacitor Android/iOS WebView origins to reach /api/* when packaged as an APK
app.use('/api', (req: Request, res: Response, next) => {
  const origin = req.headers.origin;
  if (
    origin === 'https://localhost' ||
    origin === 'http://localhost' ||
    origin === 'capacitor://localhost' ||
    origin?.startsWith('http://localhost:') ||
    origin?.startsWith('http://127.0.0.1:')
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

function createGeminiClient(apiKey: string) {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Track per-model 429 RESOURCE_EXHAUSTED cooldowns so exhausted free-tier models
// are skipped automatically without failing or logging noise on every request.
const modelCooldownUntil: Record<string, number> = {};

function isQuotaExceededError(err: any): boolean {
  const status = err?.status || err?.code;
  const msg = String(err?.message || err || '');
  return (
    status === 429 ||
    msg.includes('"code":429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    /quota exceeded|rate[- ]?limit/i.test(msg)
  );
}

function recordModelCooldown(modelName: string, err: any): void {
  if (!isQuotaExceededError(err)) return;
  const msg = String(err?.message || err || '');
  const retryMatch = msg.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
  const retrySec = retryMatch ? parseInt(retryMatch[1], 10) : 300;
  // Cap cooldown between 60s and 1 hour (server restarts also clear in-memory map)
  const clampedMs = Math.min(Math.max(retrySec * 1000, 60_000), 3_600_000);
  modelCooldownUntil[modelName] = Date.now() + clampedMs;
}

function getOrderedCandidateModels(preferredModels: string[]): string[] {
  const now = Date.now();
  const ready = preferredModels.filter((m) => (modelCooldownUntil[m] || 0) <= now);
  if (ready.length > 0) return ready;
  // All cooled down: try the one whose cooldown expires earliest
  return [...preferredModels].sort(
    (a, b) => (modelCooldownUntil[a] || 0) - (modelCooldownUntil[b] || 0)
  );
}

const PRESCRIPTION_OCR_SYSTEM_INSTRUCTION = `You are the OCR and data-structuring engine for PillSync, a prescription assistant used mainly in India. You read photographs of handwritten or printed medical prescriptions and return structured data. You do not give medical advice, diagnose, or suggest changes. Your output is reviewed by the patient before anything is scheduled, so accuracy and honesty about uncertainty matter more than completeness.

OUTPUT FORMAT
- Return ONLY one valid JSON object matching the provided schema. No greeting, no explanation, no markdown fences, no text before or after.
- Use null for any value that is not written or cannot be read. Never use empty strings, "N/A", "unknown", or guesses.

STEP 0: CHECK THE IMAGE
- If the image is not a medical prescription, set isPrescription=false, medicines=[], and explain in warnings. Do not invent content.
- Set imageQuality to "good", "fair", or "poor". If poor, still extract what is readable and add a warning.
- Ignore stamps, letterheads, and printed advertisements except doctor, clinic, and registration details. Ignore struck-through medicines, and add a warning such as "One struck-through line was ignored".

STEP 1: FIND EVERY MEDICINE
- Each medicine line is a separate object in the medicines array, in the order written. Never merge two medicines. Never split one medicine into two unless the prescription writes two different schedules for it.
- Lines usually begin with Tab, Cap, Syp, Inj, Lot, Crm, Oint, Drops, Gel, Susp, Shmp, Spray, Sol, Inh, Sup, Patch, or a number. Dosing lines under a medicine belong to that medicine.
- Do not treat advice (drink water, rest, diet) or investigations (CBC, X-ray) as medicines. Put non-medicine advice in notes.

STEP 2: READ EACH FIELD
- rawText: copy the line exactly as read, with [unclear] for unreadable words.
- name: the medicine name as best read. See the spelling rule below.
- genericName: only if printed or you are certain. Otherwise null.
- strength: value and unit exactly as written (e.g. "500 mg", "5 ml", "625", "1%"). Never change or infer a number.
- form: Identify the form from the abbreviation or word written before the name or after the strength: Tab = tablet; Cap = capsule; Syp = syrup; Susp = suspension; Powder or Sachet = powder_sachet; Lozenge = lozenge; Inj = injection; Lot or Lotion = lotion; Crm or Cream = cream; Oint = ointment; Gel = gel; Shampoo or Shmp = shampoo; Spray = spray; Sol or Soln = solution; Eye drops = eye_drops; Ear drops = ear_drops; Nasal drops = nasal_drops (Drops or gtt: set eye_drops, ear_drops, or nasal_drops ONLY if eye, ear, or nose is written; otherwise null); Inh or Rotacap = inhaler; Sup = suppository; Patch = patch. Also use the instruction wording: 'apply', 'massage', 'rub', 'on the affected area', 'external use only', 'LA' (local application) mean a topical form. 'Put 2 drops' means drops. If the form is not written and cannot be inferred from these clues, set form to null. NEVER default to tablet.
- route: plain English (see abbreviations). If not written, null. Do not assume "By mouth" for a tablet unless "PO" or similar is written.
- dose: amount per intake (e.g. "1 tablet", "5 ml", "2 drops", "thin layer"). Null if not written.
- frequencyCode: the pattern as written (e.g. "1-0-1", "BD"). Null if not written.
- frequencyPlain: its plain-English meaning (e.g. "twice a day"). Null if not written.
- doseSchedule: for 3-number patterns (morning-afternoon-night), such as 1-0-1 or 1-1-1, fill morning, afternoon, and night with the numbers. A 4-number pattern adds bedtime. Otherwise null.
- timesPerDay: a number if clear (BD = 2, TDS = 3, QID = 4), else null.
- timing: one of before_food, after_food, with_food, empty_stomach, bedtime, anytime, or null. AC = before_food, PC = after_food. For topical, drops, inhalers, and injections, timing is almost always null unless specifically written.
- asNeeded: true if SOS, PRN, "if required", or "when needed". Otherwise false.
- durationDays: a number only if written. Convert only written units: "x 5 days" = 5, "for 1 week" = 7, "x 2 weeks" = 14, "1 month" = 30, "3/7" = 3, "1/52" = 7. If no duration is written, null. "Continue" or "ongoing" = null with durationText set to that word.
- durationText: exact duration text if written (e.g. "Continue", "ongoing", "x 5 days"), else null.
- instructions: the patient-friendly version in simple English, built only from what is written. Example: "Take 1 tablet twice a day after food for 5 days." or "Apply a thin layer on the affected area twice a day for 5 days." If a part is missing, leave that part out. Never add advice.

ABBREVIATIONS (translate to plain English)
OD / QD = once a day; BD / BID = twice a day; TDS / TID = three times a day; QID = four times a day; HS = at bedtime; SOS / PRN = only if needed; stat = immediately, one time; AC = before food; PC = after food; PO = by mouth; SL = under the tongue; IM = into the muscle; IV = into a vein; Top / LA = apply on the skin / local application; q4h / q6h / q8h / q12h = every 4 / 6 / 8 / 12 hours; mane = in the morning; nocte = at night; Tab = tablet; Cap = capsule; Syp = syrup; Susp = suspension; Inj = injection; Lot = lotion; Crm = cream; Oint = ointment; Shmp = shampoo; Sol / Soln = solution; Inh / Rotacap = inhaler; Sup = suppository; gtt = drops.
If an abbreviation is not on this list and you are not sure, copy it into rawText and set the related field to null with the flag "abbreviation_unknown".

SPELLING RULE (safety critical)
- Doctor handwriting is often ambiguous. Correct a name to a real drug name (Indian or international brand or generic) ONLY when you are at least 85% confident of exactly one match. Then set nameCorrected=true and put what you read in nameAsRead. Otherwise set nameCorrected=false and nameAsRead=null.
- If two or more real drug names are plausible, do NOT choose. Set illegible=true, confidence at 0.4 or lower, name to your best reading or null, and add the flag "name_uncertain".
- Never change strength, dose, frequency, or duration to make a name or line "make sense".
- If the name is on a look-alike or sound-alike list (for example metformin/methotrexate, clonazepam/clonidine, glipizide/glyburide, hydroxyzine/hydralazine, Zyrtec/Zantac, cetirizine/sertraline), add the flag "look_alike_risk" and lower confidence by at least 0.15 unless the strength and context make it unambiguous.

CONFIDENCE
- confidence is a number from 0 to 1 for the whole line. 0.9 and above = clearly legible. 0.6 to 0.89 = mostly legible with some doubt. Below 0.6 = hard to read, and illegible should be true if the name, dose, or frequency cannot be read at all.
- Never inflate confidence. When uncertain, go lower.

FLAGS (use these exact strings, include all that apply)
name_uncertain, strength_uncertain, dose_missing, frequency_missing, duration_missing, timing_missing, abbreviation_unknown, look_alike_risk, possible_overwriting, handwriting_unclear, partly_cut_off

PRESCRIPTION-LEVEL FIELDS
doctorName, clinic, doctorRegistrationNumber, patientName, patientAge, patientSex, and date (YYYY-MM-DD; if the year is missing, null). Put review or follow-up instructions (for example "Review after 5 days") in followUp.text, and the number of days in followUp.days only if written. Put other written advice in notes. Anything not written is null.

NEVER
- Never guess a missing dose, frequency, duration, or timing.
- Never add medicines that are not on the page.
- Never give warnings about the drug, interactions, or dosage safety.
- Never include text outside the JSON.`;

// Health / Status endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// REAL HANDWRITING READING WITH GEMINI
app.post('/api/parse-prescription', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({
        error: 'Missing imageBase64 in request body.',
      });
    }

    // Strip data URL prefix if present
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is not configured in the server environment.',
        fallbackToManual: true,
      });
    }

    const ai = createGeminiClient(apiKey);
    const parseModels = getOrderedCandidateModels(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);
    let responseText: string | null = null;
    let lastParseError: any = null;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        isPrescription: {
          type: Type.BOOLEAN,
          description: 'True if the image is a medical prescription, false otherwise',
        },
        imageQuality: {
          type: Type.STRING,
          description: 'Image legibility quality: good, fair, or poor',
        },
        warnings: {
          type: Type.ARRAY,
          description: 'Warnings about non-prescription image, poor quality, or ignored struck-through lines',
          items: { type: Type.STRING },
        },
        doctorName: { type: Type.STRING, nullable: true, description: 'Prescribing doctor name or null' },
        clinic: { type: Type.STRING, nullable: true, description: 'Clinic or hospital name or null' },
        doctorRegistrationNumber: {
          type: Type.STRING,
          nullable: true,
          description: 'Medical registration number or null',
        },
        patientName: { type: Type.STRING, nullable: true, description: 'Patient name as written or null' },
        patientAge: { type: Type.STRING, nullable: true, description: 'Patient age as written or null' },
        patientSex: { type: Type.STRING, nullable: true, description: 'Patient sex as written or null' },
        date: {
          type: Type.STRING,
          nullable: true,
          description: 'Prescription date formatted YYYY-MM-DD, or null if missing/year missing',
        },
        followUp: {
          type: Type.OBJECT,
          nullable: true,
          properties: {
            text: { type: Type.STRING, nullable: true, description: 'Follow-up instruction text or null' },
            days: { type: Type.INTEGER, nullable: true, description: 'Follow-up days as integer or null' },
          },
        },
        notes: {
          type: Type.STRING,
          nullable: true,
          description: 'Non-medicine written advice or investigations (e.g. CBC, rest, drink water), or null',
        },
        medicines: {
          type: Type.ARRAY,
          description: 'List of transcribed medicines in exact order written',
          items: {
            type: Type.OBJECT,
            properties: {
              rawText: {
                type: Type.STRING,
                description: 'Exact line copied as read, using [unclear] for unreadable words',
              },
              name: { type: Type.STRING, nullable: true, description: 'Best read medicine name or null' },
              nameAsRead: {
                type: Type.STRING,
                nullable: true,
                description: 'Original raw reading if nameCorrected is true, else null',
              },
              nameCorrected: {
                type: Type.BOOLEAN,
                description: 'True only if corrected to a single >=85% confident real drug name',
              },
              genericName: {
                type: Type.STRING,
                nullable: true,
                description: 'Generic name only if printed or certain, else null',
              },
              strength: {
                type: Type.STRING,
                nullable: true,
                description: 'Value and unit exactly as written (e.g. 500 mg, 625) or null',
              },
              form: {
                type: Type.STRING,
                nullable: true,
                enum: ALL_MEDICINE_FORM_IDS,
                description:
                  'Exact medicine form id from allowed list, or null if not written and cannot be inferred. Never default to tablet.',
              },
              route: {
                type: Type.STRING,
                nullable: true,
                description: 'Plain English route if written (e.g. by mouth, under the tongue), else null',
              },
              dose: {
                type: Type.STRING,
                nullable: true,
                description: 'Amount per intake (e.g. 1 tablet, 5 ml) or null',
              },
              frequencyCode: {
                type: Type.STRING,
                nullable: true,
                description: 'Written frequency pattern (e.g. 1-0-1, BD, SOS) or null',
              },
              frequencyPlain: {
                type: Type.STRING,
                nullable: true,
                description: 'Plain English meaning of frequency or null',
              },
              doseSchedule: {
                type: Type.OBJECT,
                nullable: true,
                properties: {
                  morning: { type: Type.NUMBER, nullable: true },
                  afternoon: { type: Type.NUMBER, nullable: true },
                  night: { type: Type.NUMBER, nullable: true },
                  bedtime: { type: Type.NUMBER, nullable: true },
                },
              },
              timesPerDay: { type: Type.NUMBER, nullable: true, description: 'Numeric times per day or null' },
              timing: {
                type: Type.STRING,
                nullable: true,
                description:
                  'before_food, after_food, with_food, empty_stomach, bedtime, anytime, or null',
              },
              asNeeded: { type: Type.BOOLEAN, description: 'True if SOS, PRN, or if required' },
              durationDays: {
                type: Type.INTEGER,
                nullable: true,
                description: 'Duration in days as integer if written, else null',
              },
              durationText: {
                type: Type.STRING,
                nullable: true,
                description: 'Exact duration text e.g. Continue or x 5 days, else null',
              },
              instructions: {
                type: Type.STRING,
                nullable: true,
                description: 'Simple patient-friendly English sentence built only from what is written, or null',
              },
              confidence: { type: Type.NUMBER, description: 'Line confidence between 0.0 and 1.0' },
              illegible: {
                type: Type.BOOLEAN,
                description: 'True if name, dose, or frequency cannot be reliably read',
              },
              flags: {
                type: Type.ARRAY,
                description:
                  'Exact applicable flags: name_uncertain, strength_uncertain, dose_missing, frequency_missing, duration_missing, timing_missing, abbreviation_unknown, look_alike_risk, possible_overwriting, handwriting_unclear, partly_cut_off',
                items: { type: Type.STRING },
              },
            },
            required: ['rawText', 'nameCorrected', 'asNeeded', 'confidence', 'illegible', 'flags'],
          },
        },
      },
      required: ['isPrescription', 'imageQuality', 'warnings', 'medicines'],
    };

    for (const modelName of parseModels) {
      try {
        const config: any = {
          systemInstruction: PRESCRIPTION_OCR_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema,
        };
        if (!modelName.startsWith('gemini-4')) {
          config.temperature = 0;
        }

        const response = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              {
                text: 'Transcribe and structure this prescription image following all rules and returning ONLY the JSON object matching the schema.',
              },
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
            ],
          },
          config,
        });

        if (response.text) {
          responseText = response.text;
          break;
        }
      } catch (err: any) {
        lastParseError = err;
        recordModelCooldown(modelName, err);
        if (!isQuotaExceededError(err)) {
          console.info(`OCR fallback: ${modelName} unavailable, trying next model.`);
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    if (!responseText) {
      const quotaHit = isQuotaExceededError(lastParseError);
      return res.status(quotaHit ? 429 : 502).json({
        error: quotaHit
          ? 'The AI service is temporarily busy (quota limit reached). Please try again shortly or enter medicines manually.'
          : lastParseError?.message || 'Empty response received from Gemini.',
        fallbackToManual: true,
      });
    }

    try {
      const parsedData = JSON.parse(responseText);
      return res.json({
        success: true,
        data: parsedData,
      });
    } catch {
      return res.status(502).json({
        error: 'Failed to parse Gemini response as JSON.',
        rawText: responseText,
        fallbackToManual: true,
      });
    }
  } catch (error: any) {
    console.error('Error in /api/parse-prescription:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to process prescription image with Gemini.',
      fallbackToManual: true,
    });
  }
});

// REAL PATIENT INSTRUCTION TRANSLATION & TRANSLITERATION WITH GEMINI
app.post('/api/translate', async (req: Request, res: Response) => {
  try {
    const { items, targetLanguage } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0 || !targetLanguage) {
      return res.status(400).json({
        error: 'Missing items or targetLanguage in request body.',
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is not configured in the server environment.',
        offlineOnly: true,
      });
    }

    const ai = createGeminiClient(apiKey);

    const systemInstruction = `Translate patient medication instructions into simple everyday ${targetLanguage}, at about a 6th-grade reading level. Keep every number, dose, strength, and medicine name exactly unchanged. Transliterate medicine names into the target script without translating them. Do not add, remove, or soften any instruction. Do not give medical advice. Return only JSON.`;

    const candidateModels = getOrderedCandidateModels(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);
    let responseText: string | null = null;
    let lastError: any = null;

    const translateSchema = {
      type: Type.ARRAY,
      description: 'Array of translated instructions and transliterated medicine names',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'Exact matching item id from input' },
          translatedText: {
            type: Type.STRING,
            description: `Simple everyday ${targetLanguage} translation preserving all numbers and instructions`,
          },
          transliteratedName: {
            type: Type.STRING,
            description: `Medicine name transliterated into ${targetLanguage} script without translating brand words, or empty string for note-only items`,
          },
        },
        required: ['id', 'translatedText', 'transliteratedName'],
      },
    };

    for (const modelName of candidateModels) {
      try {
        const config: any = {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: translateSchema,
        };
        if (!modelName.startsWith('gemini-4')) {
          config.temperature = 0;
        }

        const response = await ai.models.generateContent({
          model: modelName,
          contents: `Target language: ${targetLanguage}\nItems:\n${JSON.stringify(items, null, 2)}`,
          config,
        });
        if (response.text) {
          responseText = response.text;
          break;
        }
      } catch (err: any) {
        lastError = err;
        recordModelCooldown(modelName, err);
        if (!isQuotaExceededError(err)) {
          console.info(`Translation fallback: ${modelName} unavailable, trying next model.`);
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    if (!responseText) {
      const quotaHit = isQuotaExceededError(lastError);
      return res.status(quotaHit ? 429 : 502).json({
        error: quotaHit
          ? 'AI translation limit reached for now. Showing built-in offline translation.'
          : lastError?.message || 'Empty or unavailable response from Gemini models.',
        fallbackToOffline: true,
      });
    }

    try {
      const parsedData = JSON.parse(responseText);
      const translationsArray = Array.isArray(parsedData)
        ? parsedData
        : Array.isArray(parsedData?.translations)
        ? parsedData.translations
        : [];
      return res.json({
        success: true,
        data: translationsArray,
      });
    } catch {
      return res.status(502).json({
        error: 'Failed to parse Gemini response as JSON.',
        rawText: responseText,
      });
    }
  } catch (error: any) {
    console.error('Error in /api/translate:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to translate instructions with Gemini.',
    });
  }
});

// STRICT FOOD TIMING LOOKUP FALLBACK FOR MEDICINES NOT IN LOCAL REFERENCE
app.post('/api/suggest-food-timing', async (req: Request, res: Response) => {
  try {
    const { medicineName, genericName } = req.body;
    const cleanName = typeof medicineName === 'string' ? medicineName.trim() : '';
    const cleanGeneric = typeof genericName === 'string' ? genericName.trim() : '';

    if (!cleanName) {
      return res.status(400).json({ error: 'Missing medicineName' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({ success: true, foodTiming: null });
    }

    const ai = createGeminiClient(apiKey);
    const schema = {
      type: Type.OBJECT,
      properties: {
        foodTiming: {
          type: Type.STRING,
          nullable: true,
          description:
            'One of: before_food, after_food, with_food, empty_stomach, bedtime, anytime, or null if unsure',
        },
      },
      required: ['foodTiming'],
    };

    const candidates = getOrderedCandidateModels(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);
    let foodTiming: string | null = null;

    for (const modelName of candidates) {
      try {
        const config: any = {
          systemInstruction:
            'Return only the commonly labeled food timing for this medicine in JSON, or null if unsure.',
          responseMimeType: 'application/json',
          responseSchema: schema,
        };
        if (!modelName.startsWith('gemini-4')) {
          config.temperature = 0;
        }

        const prompt = cleanGeneric
          ? `Medicine: ${cleanName} (Generic: ${cleanGeneric})`
          : `Medicine: ${cleanName}`;

        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config,
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          const rawVal = typeof parsed?.foodTiming === 'string' ? parsed.foodTiming.trim().toLowerCase() : null;
          if (
            rawVal &&
            ['before_food', 'after_food', 'with_food', 'empty_stomach', 'bedtime', 'anytime'].includes(
              rawVal
            )
          ) {
            foodTiming = rawVal;
          }
          break;
        }
      } catch (err: any) {
        recordModelCooldown(modelName, err);
      }
    }

    return res.json({ success: true, foodTiming });
  } catch (error: any) {
    console.warn('Error in /api/suggest-food-timing:', error?.message || error);
    return res.json({ success: true, foodTiming: null });
  }
});

// GITHUB REPOSITORY EXPORT (CLEAN ZIP & MANIFEST WITHOUT SECRETS OR BUILD ARTIFACTS)
type ExportTarget = 'full' | 'web' | 'flutter';

const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.dart_tool',
  '.gradle',
  '.idea',
  '.vscode',
  '.aistudio',
]);

function shouldExcludeEntry(relPath: string, name: string, isDir: boolean): boolean {
  if (isDir) {
    if (EXCLUDED_DIRS.has(name)) return true;
    if (relPath === 'android/app/src/main/assets/public') return true;
    return false;
  }
  if (name === '.DS_Store' || name === 'Thumbs.db' || name.endsWith('.log') || name.endsWith('.tsbuildinfo')) {
    return true;
  }
  if (name === 'server.js') {
    return true;
  }
  // Never leak .env files containing secrets; keep .env.example
  if (name.startsWith('.env') && name !== '.env.example') {
    return true;
  }
  if (relPath.startsWith('flutter_project/.flutter-plugins')) {
    return true;
  }
  return false;
}

async function collectProjectFiles(
  rootDir: string,
  target: ExportTarget
): Promise<{ relPath: string; absPath: string; size: number }[]> {
  const results: { relPath: string; absPath: string; size: number }[] = [];

  async function walk(currentDir: string, relBase: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
      const absPath = path.join(currentDir, entry.name);

      if (shouldExcludeEntry(relPath, entry.name, entry.isDirectory())) {
        continue;
      }

      if (target === 'web' && relPath === 'flutter_project') {
        continue;
      }
      if (target === 'flutter' && !relBase && entry.name !== 'flutter_project') {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(absPath, relPath);
      } else if (entry.isFile()) {
        const stat = await fs.stat(absPath);
        const zipPath =
          target === 'flutter' && relPath.startsWith('flutter_project/')
            ? relPath.slice('flutter_project/'.length)
            : relPath;
        results.push({ relPath: zipPath, absPath, size: stat.size });
      }
    }
  }

  await walk(rootDir, '');
  results.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return results;
}

function parseExportTarget(raw: unknown): ExportTarget {
  if (raw === 'web' || raw === 'flutter') return raw;
  return 'full';
}

app.get('/api/export-github-manifest', async (req: Request, res: Response) => {
  try {
    const target = parseExportTarget(req.query.target);
    const files = await collectProjectFiles(__dirname, target);
    const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
    const topLevelSet = new Set(files.map((f) => f.relPath.split('/')[0]));

    return res.json({
      success: true,
      target,
      fileCount: files.length,
      totalBytes,
      topLevelEntries: Array.from(topLevelSet),
      sampleFiles: files.slice(0, 12).map((f) => f.relPath),
    });
  } catch (err: any) {
    console.error('Error in /api/export-github-manifest:', err);
    return res.status(500).json({ error: err?.message || 'Failed to inspect project files.' });
  }
});

app.get('/api/export-github-zip', async (req: Request, res: Response) => {
  try {
    const target = parseExportTarget(req.query.target);
    const files = await collectProjectFiles(__dirname, target);

    const zip = new JSZip();
    for (const file of files) {
      const content = await fs.readFile(file.absPath);
      zip.file(file.relPath, content);
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const filenameMap: Record<ExportTarget, string> = {
      full: 'pillsync-github-repo.zip',
      web: 'pillsync-web-app.zip',
      flutter: 'pillsync-flutter-app.zip',
    };

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameMap[target]}"`);
    res.setHeader('Content-Length', String(zipBuffer.length));
    return res.send(zipBuffer);
  } catch (err: any) {
    console.error('Error in /api/export-github-zip:', err);
    return res.status(500).json({ error: err?.message || 'Failed to generate GitHub ZIP.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PillSync Express + Vite server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
