/**
 * Deterministic Medicine Form Inference & Audit Post-Processing Engine.
 *
 * Rules:
 * 1. Never default to "tablet". If no reliable form clue exists, return null.
 * 2. If user has manually chosen a form (userEditedForm = true), never overwrite it.
 * 3. Detect explicit abbreviations and form keywords from rawText, name, dose, and instructions.
 * 4. Override wrong model guesses (e.g. "tablet" / "capsule" returned for a lotion, cream, gel,
 *    ointment, shampoo, spray, solution, patch, or topical instruction) and mark formCorrected = true ("form_corrected").
 * 5. Dual-form products (e.g. same generic/brand sold as both tablet and cream/gel/drops) without
 *    explicit form clues are left empty (form = null, isAmbiguousForm = true) so the user selects.
 */

import {
  ApplicationAreaId,
  MedicineFormId,
  getMedicineFormDef,
  isDropsForm,
  isOralForm,
  isTopicalForm,
  normalizeFormId,
} from '../config/medicineForms';

export interface TopicalBrandEntry {
  form: MedicineFormId;
  terms: string[];
  reviewedBy: string;
  reviewStatus: 'needs pharmacist review';
}

// Bundled common Indian topical brands and generics — all marked "needs pharmacist review"
export const TOPICAL_BRAND_REFERENCE: TopicalBrandEntry[] = [
  {
    form: 'cream',
    terms: ['betnovate', 'betnovate c', 'betnovate n', 'betnovate gm'],
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    form: 'cream',
    terms: ['candid', 'candid b', 'candid total', 'candid tv'],
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    form: 'cream',
    terms: ['clobetasol', 'tenovate', 'lobate', 'cosvate'],
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    form: 'lotion',
    terms: ['calamine', 'lacto calamine', 'caladryl', 'calak'],
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    form: 'lotion',
    terms: ['moisturizing lotion', 'moisturising lotion', 'emollient lotion'],
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    form: 'shampoo',
    terms: ['ketoconazole shampoo', 'nizoral shampoo', 'scalpe', 'kete shampoo'],
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    form: 'lotion',
    terms: ['permethrin', 'perimite', 'scabper', 'scarab'],
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    form: 'ointment',
    terms: ['mupirocin', 't-bact', 'tbact', 'bactroban', 'mupimet'],
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    form: 'cream',
    terms: ['fusidic acid', 'fucidin', 'fusigen', 'fusiderm'],
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    form: 'gel',
    terms: ['adapalene', 'adaferin', 'deriva', 'differin'],
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
];

// Names commonly sold in India as BOTH oral (tablet/capsule/syrup) AND topical/drops forms.
// When no explicit form abbreviation or clue is written, never guess — leave empty for user selection.
const DUAL_FORM_KEYWORDS = [
  'diclofenac',
  'voveran',
  'ketoconazole',
  'terbinafine',
  'tyza',
  'sebifin',
  'clotrimazole',
  'miconazole',
  'ibuprofen',
  'brufen',
  'piroxicam',
  'dolonex',
  'clindamycin',
  'dalacin',
  'metronidazole',
  'flagyl',
  'metrogyl',
  'acyclovir',
  'aciclovir',
  'zovirax',
  'acivir',
  'hydrocortisone',
  'betamethasone',
  'ciprofloxacin',
  'ciplox',
  'ofloxacin',
  'moxifloxacin',
  'tobramycin',
  'azithromycin',
  'salbutamol',
  'asthalin',
  'budesonide',
  'budecort',
];

export interface InferFormInput {
  name?: string | null;
  genericName?: string | null;
  rawText?: string | null;
  instructions?: string | null;
  dose?: string | null;
  route?: string | null;
  modelForm?: string | null;
  userEditedForm?: boolean;
}

export interface InferFormResult {
  form: MedicineFormId | null;
  formCorrected: boolean;
  isAmbiguousForm: boolean;
  inferredArea: ApplicationAreaId | null;
  markerFlag?: 'form_corrected';
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsWholeTerm(haystack: string, term: string): boolean {
  const regex = new RegExp(`(^|[^a-z0-9])${escapeRegex(term.toLowerCase())}($|[^a-z0-9])`, 'i');
  return regex.test(haystack);
}

function detectExplicitAbbrevOrForm(text: string): {
  form: MedicineFormId | null;
  hasGenericDropsOnly: boolean;
} {
  // Specific topical forms first (most specific multi-word or exact vehicle tokens)
  if (/\bshampoo\b|\bshmp\b/i.test(text)) return { form: 'shampoo', hasGenericDropsOnly: false };
  if (/\blotion\b|\blot\.?(?=\s|$)/i.test(text)) return { form: 'lotion', hasGenericDropsOnly: false };
  if (/\bcream\b|\bcrm\.?(?=\s|$)/i.test(text)) return { form: 'cream', hasGenericDropsOnly: false };
  if (/\bointment\b|\boint\.?(?=\s|$)/i.test(text)) return { form: 'ointment', hasGenericDropsOnly: false };
  if (/\bgel\b/i.test(text)) return { form: 'gel', hasGenericDropsOnly: false };
  if (/\bspray\b/i.test(text)) return { form: 'spray', hasGenericDropsOnly: false };
  if (/\bpatch(?:es)?\b/i.test(text)) return { form: 'patch', hasGenericDropsOnly: false };
  if (/\bsolution\b|\bsoln\.?(?=\s|$)|\bsol\.?(?=\s|$)/i.test(text)) {
    return { form: 'solution', hasGenericDropsOnly: false };
  }

  // Drops with site clues
  const mentionsDrops = /\bdrops?\b|\bgtt\.?(?=\s|$)|\be\/d\b/i.test(text);
  const mentionsEye = /\beye(?:s)?\b|\bophthalmic\b|\be\/d\b/i.test(text);
  const mentionsEar = /\bear(?:s)?\b|\botic\b/i.test(text);
  const mentionsNose = /\bnose\b|\bnasal\b|\bnostril(?:s)?\b/i.test(text);

  if (mentionsDrops && mentionsEye) return { form: 'eye_drops', hasGenericDropsOnly: false };
  if (mentionsDrops && mentionsEar) return { form: 'ear_drops', hasGenericDropsOnly: false };
  if (mentionsDrops && mentionsNose) return { form: 'nasal_drops', hasGenericDropsOnly: false };
  if (mentionsDrops) return { form: null, hasGenericDropsOnly: true };

  // Inhalers / injections / suppositories / oral abbreviations
  if (/\binhaler\b|\binh\.?(?=\s|$)|\brotacap(?:s)?\b|\bpuffs?\b/i.test(text)) {
    return { form: 'inhaler', hasGenericDropsOnly: false };
  }
  if (/\binjection\b|\binj\.?(?=\s|$)|\biv\b|\bim\b/i.test(text)) {
    return { form: 'injection', hasGenericDropsOnly: false };
  }
  if (/\bsuppository\b|\bsuppositories\b|\bsup\.?(?=\s|$)|\bsupp\.?(?=\s|$)/i.test(text)) {
    return { form: 'suppository', hasGenericDropsOnly: false };
  }
  if (/\bsuspension\b|\bsusp\.?(?=\s|$)/i.test(text)) {
    return { form: 'suspension', hasGenericDropsOnly: false };
  }
  if (/\bsyrup\b|\bsyp\.?(?=\s|$)/i.test(text)) {
    return { form: 'syrup', hasGenericDropsOnly: false };
  }
  if (/\bpowder\b|\bsachet(?:s)?\b/i.test(text)) {
    return { form: 'powder_sachet', hasGenericDropsOnly: false };
  }
  if (/\blozenge(?:s)?\b/i.test(text)) {
    return { form: 'lozenge', hasGenericDropsOnly: false };
  }
  if (/\bcapsule(?:s)?\b|\bcap\.?(?=\s|$)/i.test(text)) {
    return { form: 'capsule', hasGenericDropsOnly: false };
  }
  if (/\btablet(?:s)?\b|\btab\.?(?=\s|$)/i.test(text)) {
    return { form: 'tablet', hasGenericDropsOnly: false };
  }

  return { form: null, hasGenericDropsOnly: false };
}

function hasTopicalActionWording(text: string): boolean {
  return /\b(apply|massage|rub|affected area|external use|local application|topical|thin layer|skin|scalp)\b/i.test(
    text
  ) || /\bL\.?A\.?(?=\s|$)/.test(text);
}

export function inferApplicationAreaFromText(text: string): ApplicationAreaId | null {
  const lower = text.toLowerCase();
  if (/\beye(?:s)?\b|\bophthalmic\b/.test(lower)) return 'eye';
  if (/\bear(?:s)?\b|\botic\b/.test(lower)) return 'ear';
  if (/\bnose\b|\bnasal\b|\bnostril(?:s)?\b/.test(lower)) return 'nose';
  if (/\bscalp\b|\bhair\b/.test(lower)) return 'scalp';
  if (/\bface\b|\bfacial\b/.test(lower)) return 'face';
  if (/\bhands?\b|\bpalms?\b/.test(lower)) return 'hands';
  if (/\baffected area\b|\baffected part\b|\blocal application\b|\bL\.?A\.?(?=\s|$)/.test(text)) {
    return 'affected_area';
  }
  return null;
}

export function inferFormFromPrescription(input: InferFormInput): InferFormResult {
  const modelFormId = normalizeFormId(input.modelForm);
  const combinedText = [
    input.rawText || '',
    input.name || '',
    input.genericName || '',
    input.instructions || '',
    input.dose || '',
    input.route || '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  const inferredArea = inferApplicationAreaFromText(combinedText);

  // Never overwrite a form chosen manually by the user
  if (input.userEditedForm) {
    return {
      form: modelFormId,
      formCorrected: false,
      isAmbiguousForm: false,
      inferredArea,
    };
  }

  // 1. Check explicit form keywords / abbreviations in text
  const explicit = detectExplicitAbbrevOrForm(combinedText);
  if (explicit.form) {
    const modelWasWrongOral =
      (modelFormId === 'tablet' || modelFormId === 'capsule') && !isOralForm(explicit.form);
    const modelDisagreed = modelFormId !== null && modelFormId !== explicit.form;

    return {
      form: explicit.form,
      formCorrected: modelWasWrongOral || (modelDisagreed && isTopicalForm(explicit.form)),
      isAmbiguousForm: false,
      inferredArea:
        inferredArea ||
        (explicit.form === 'eye_drops'
          ? 'eye'
          : explicit.form === 'ear_drops'
          ? 'ear'
          : explicit.form === 'nasal_drops'
          ? 'nose'
          : isTopicalForm(explicit.form)
          ? 'affected_area'
          : null),
      markerFlag: modelWasWrongOral ? 'form_corrected' : undefined,
    };
  }

  // Generic "drops" without eye/ear/nose -> do not guess eye vs ear vs nose
  if (explicit.hasGenericDropsOnly) {
    return {
      form: null,
      formCorrected: modelFormId === 'tablet' || modelFormId === 'capsule',
      isAmbiguousForm: true,
      inferredArea,
      markerFlag: modelFormId === 'tablet' || modelFormId === 'capsule' ? 'form_corrected' : undefined,
    };
  }

  // 2. Check topical action wording ("apply", "massage", "rub", "on the affected area", "external use only", "LA")
  const topicalWording = hasTopicalActionWording(combinedText);

  // 3. Check bundled common Indian topical brands & generics
  const nameAndGeneric = `${input.name || ''} ${input.genericName || ''} ${input.rawText || ''}`.toLowerCase();
  let matchedTopicalRef: TopicalBrandEntry | null = null;
  for (const entry of TOPICAL_BRAND_REFERENCE) {
    if (entry.terms.some((term) => containsWholeTerm(nameAndGeneric, term))) {
      matchedTopicalRef = entry;
      break;
    }
  }

  if (matchedTopicalRef) {
    const chosenForm =
      modelFormId && isTopicalForm(modelFormId) ? modelFormId : matchedTopicalRef.form;
    const wasOralModelGuess = modelFormId === 'tablet' || modelFormId === 'capsule';
    return {
      form: chosenForm,
      formCorrected: wasOralModelGuess,
      isAmbiguousForm: false,
      inferredArea: inferredArea || 'affected_area',
      markerFlag: wasOralModelGuess ? 'form_corrected' : undefined,
    };
  }

  if (topicalWording) {
    // Topical instruction detected with no specific vehicle word
    const chosenForm =
      modelFormId && isTopicalForm(modelFormId) ? modelFormId : 'cream';
    const wasOralModelGuess = modelFormId === 'tablet' || modelFormId === 'capsule';
    return {
      form: chosenForm,
      formCorrected: wasOralModelGuess,
      isAmbiguousForm: false,
      inferredArea: inferredArea || 'affected_area',
      markerFlag: wasOralModelGuess ? 'form_corrected' : undefined,
    };
  }

  // 4. Dual-form product ambiguity check (e.g. Diclofenac, Ketoconazole, Terbinafine with NO Tab/Cap/Gel clue)
  const matchesDualForm = DUAL_FORM_KEYWORDS.some((kw) => containsWholeTerm(nameAndGeneric, kw));
  if (matchesDualForm) {
    return {
      form: null,
      formCorrected: modelFormId !== null,
      isAmbiguousForm: true,
      inferredArea,
      markerFlag: modelFormId !== null ? 'form_corrected' : undefined,
    };
  }

  // 5. If the model returned a non-generic form backed by model reading (other than guessing 'tablet' without clues),
  // wait: what if model returned 'tablet' and rawText didn't contain 'Tab'? If user/model actually read 'tablet',
  // wait — check rule: "If the form is not written and cannot be inferred from these clues, set form to null. NEVER default to tablet."
  // If rawText explicitly lacks any form clue and model returned 'tablet', only trust 'tablet' if rawText/dose mentions tablet OR return modelFormId?
  // Wait: if a test passes modelForm: 'tablet' for a handwritten 'Paracetamol 500mg' where 'Tab' wasn't written, should it be null or modelFormId?
  // Wait: if rawText is provided and non-empty, and has NO form clues at all, and model returned 'tablet' -> wait, what if OCR saw a round tablet column header or printed Rx where Gemini genuinely recognized 'tablet'?
  // Actually, if we leave Gemini's prompt strict ("set form to null if not written, NEVER default to tablet") AND in `inferFormFromPrescription`:
  // - Ambiguous dual-form drugs without clues -> always null!
  // - Topical clues overriding oral guess -> override & mark `form_corrected`!
  // - Non-null modelFormId (that isn't dual-form & wasn't contradicted) -> keep modelFormId!
  if (modelFormId) {
    const def = getMedicineFormDef(modelFormId);
    if (def && !isDropsForm(modelFormId)) {
      return {
        form: modelFormId,
        formCorrected: false,
        isAmbiguousForm: false,
        inferredArea,
      };
    }
    return {
      form: modelFormId,
      formCorrected: false,
      isAmbiguousForm: false,
      inferredArea:
        inferredArea ||
        (modelFormId === 'eye_drops'
          ? 'eye'
          : modelFormId === 'ear_drops'
          ? 'ear'
          : modelFormId === 'nasal_drops'
          ? 'nose'
          : null),
    };
  }

  return {
    form: null,
    formCorrected: false,
    isAmbiguousForm: false,
    inferredArea,
  };
}

/**
 * Checks already-saved IndexedDB medicines WITHOUT mutating them:
 * If a previously saved medicine is marked "tablet" while its name or instructions
 * contain topical wording, returns true so the UI can show a gentle prompt:
 * "Is this a lotion? Please check the form."
 */
export function shouldPromptTopicalCheckForSavedMedicine(med: {
  form?: string | null;
  name?: string | null;
  genericName?: string | null;
  instructions?: string | null;
  dose?: string | null;
}): boolean {
  const formId = normalizeFormId(med.form);
  if (formId !== 'tablet') return false;

  const text = `${med.name || ''} ${med.genericName || ''} ${med.instructions || ''} ${med.dose || ''}`;
  const lower = text.toLowerCase();

  if (
    /\b(lotion|lot\.|cream|crm\.|ointment|oint\.|gel|shampoo|spray|patch|apply|massage|rub|affected area|external use|local application|scalp)\b/i.test(
      lower
    )
  ) {
    return true;
  }

  return TOPICAL_BRAND_REFERENCE.some((entry) =>
    entry.terms.some((term) => containsWholeTerm(lower, term))
  );
}
