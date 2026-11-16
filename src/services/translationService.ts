// Prescription Translation Manager
// Coordinates Layer 1 deterministic offline glossary with Layer 2 Gemini API transliteration & free-text translation.
// Enforces IndexedDB caching per (item, language, medicineHash) and bidirectional number safety validation.

import { StoredMedicine, StoredPrescription, dbService, CachedTranslation } from './db';
import {
  buildOfflineSentence,
  getOfflineTransliteratedName,
  validateNumberPreservation,
} from './sentenceBuilder';
import { SUPPORTED_LANGUAGES } from '../data/translations';
import { formatReviewAfterNDays, toSupportedLang } from '../translations/glossary';

export interface MedicineTranslationResult {
  medicineId: string;
  targetLang: string;
  originalName: string;
  transliteratedName: string;
  offlineSentence: string;
  aiInstruction?: string;
  isAiTranslated: boolean;
  isCachedHit: boolean;
  isOfflineOnly: boolean;
  isOfflinePending: boolean;
  onlineError?: string;
  hasNumberWarning: boolean;
  missingNumbers: string[];
  extraNumbers: string[];
}

export interface PrescriptionTextTranslation {
  notesText?: string;
  notesSource?: string;
  notesPendingOffline?: boolean;
  notesNumberWarning?: boolean;
  followUpText?: string;
  followUpSource?: string;
  followUpPendingOffline?: boolean;
  followUpNumberWarning?: boolean;
}

export interface FullPrescriptionTranslationState {
  medicines: Record<string, MedicineTranslationResult>;
  prescriptionTexts: PrescriptionTextTranslation;
  pendingItemIds: string[];
  onlineError?: string;
}

interface ApiTranslationItem {
  id: string;
  translatedText?: string;
  transliteratedName?: string;
}

class TranslationService {
  /**
   * Generates a stable hash of the medicine properties to detect edits and invalidate cache.
   */
  computeMedicineHash(medicine: StoredMedicine): string {
    const raw = `${medicine.name}|${medicine.strength || ''}|${medicine.form || ''}|${medicine.applicationArea || ''}|${medicine.dose || ''}|${medicine.frequency || ''}|${medicine.timing || ''}|${medicine.durationDays || ''}|${medicine.durationText || ''}|${medicine.instructions || ''}`;
    return this.hashString(raw);
  }

  private hashString(raw: string): string {
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString();
  }

  /**
   * Synchronously-friendly instant Layer 1 translation for Home & Reminder previews.
   */
  getInstantMedicineSentence(medicine: StoredMedicine, langCode: string): string {
    return buildOfflineSentence(medicine, langCode);
  }

  /**
   * Loads cached translations from IndexedDB first and then translates uncached items via /api/translate.
   * Calls `onCacheReady` immediately with cached + offline glossary results so cached items never spin.
   */
  async translateFullPrescription(
    prescription: StoredPrescription,
    medicines: StoredMedicine[],
    targetLangCode: string,
    onCacheReady?: (initialState: FullPrescriptionTranslationState) => void,
    options?: {
      signal?: AbortSignal;
      onPhase?: (phase: 'preparing' | 'translating' | 'checking_numbers' | 'complete') => void;
    }
  ): Promise<FullPrescriptionTranslationState> {
    options?.onPhase?.('preparing');
    const langCode = toSupportedLang(targetLangCode);
    const targetLang =
      SUPPORTED_LANGUAGES.find((l) => l.code === langCode) || SUPPORTED_LANGUAGES[0];
    const isEnglish = langCode === 'en';

    const results: Record<string, MedicineTranslationResult> = {};
    const pendingItemIds: string[] = [];
    const apiPayload: Array<{ id: string; name?: string; text: string }> = [];

    // 1. Resolve medicines from Layer 1 + IndexedDB cache
    for (const medicine of medicines) {
      const offlineSentence = buildOfflineSentence(medicine, langCode);
      const offlineTranslit = getOfflineTransliteratedName(medicine.name, langCode);

      if (isEnglish) {
        results[medicine.id] = {
          medicineId: medicine.id,
          targetLang: 'en',
          originalName: medicine.name,
          transliteratedName: medicine.name,
          offlineSentence,
          aiInstruction: medicine.instructions || undefined,
          isAiTranslated: true,
          isCachedHit: true,
          isOfflineOnly: false,
          isOfflinePending: false,
          hasNumberWarning: false,
          missingNumbers: [],
          extraNumbers: [],
        };
        continue;
      }

      const medHash = this.computeMedicineHash(medicine);
      let cacheHit: CachedTranslation | null = null;
      try {
        const cached = await dbService.getCachedTranslation(medicine.id, langCode);
        if (cached && cached.medicineHash === medHash) {
          cacheHit = cached;
        }
      } catch (e) {
        console.warn('Cache lookup failed:', e);
      }

      if (cacheHit) {
        results[medicine.id] = {
          medicineId: medicine.id,
          targetLang: langCode,
          originalName: medicine.name,
          transliteratedName: cacheHit.transliteratedName || offlineTranslit,
          offlineSentence,
          aiInstruction: cacheHit.hasNumberWarning
            ? undefined
            : cacheHit.translatedInstructions || undefined,
          isAiTranslated: true,
          isCachedHit: true,
          isOfflineOnly: false,
          isOfflinePending: false,
          hasNumberWarning: !!cacheHit.hasNumberWarning,
          missingNumbers: cacheHit.missingNumbers || [],
          extraNumbers: [],
        };
        continue;
      }

      const hasFreeText = !!(medicine.instructions && medicine.instructions.trim().length > 0);
      results[medicine.id] = {
        medicineId: medicine.id,
        targetLang: langCode,
        originalName: medicine.name,
        transliteratedName: offlineTranslit,
        offlineSentence,
        isAiTranslated: false,
        isCachedHit: false,
        isOfflineOnly: true,
        isOfflinePending: hasFreeText,
        hasNumberWarning: false,
        missingNumbers: [],
        extraNumbers: [],
      };
      pendingItemIds.push(medicine.id);
      apiPayload.push({
        id: medicine.id,
        name: medicine.name,
        text: medicine.instructions || '',
      });
    }

    // 2. Resolve Prescription-level notes & followUp
    const rxTexts: PrescriptionTextTranslation = {
      notesSource: prescription.notes || undefined,
      followUpSource: prescription.followUpText || undefined,
    };

    if (isEnglish) {
      rxTexts.notesText = prescription.notes || undefined;
      rxTexts.followUpText =
        prescription.followUpText ||
        (prescription.followUpDays ? formatReviewAfterNDays(prescription.followUpDays, 'en') : undefined);
    } else {
      // Notes
      if (prescription.notes && prescription.notes.trim()) {
        const notesId = `rx_notes_${prescription.id}`;
        const notesHash = this.hashString(prescription.notes);
        const cachedNotes = await dbService.getCachedTranslation(notesId, langCode).catch(() => null);
        if (cachedNotes && cachedNotes.medicineHash === notesHash) {
          rxTexts.notesText = cachedNotes.hasNumberWarning
            ? prescription.notes
            : cachedNotes.translatedInstructions;
          rxTexts.notesNumberWarning = !!cachedNotes.hasNumberWarning;
        } else {
          rxTexts.notesText = prescription.notes;
          rxTexts.notesPendingOffline = true;
          pendingItemIds.push(notesId);
          apiPayload.push({ id: notesId, text: prescription.notes });
        }
      }

      // Follow-up: deterministic offline when followUpDays exists, plus online AI for free-text followUpText
      if (prescription.followUpDays && prescription.followUpDays > 0) {
        rxTexts.followUpText = formatReviewAfterNDays(prescription.followUpDays, langCode);
      }
      if (prescription.followUpText && prescription.followUpText.trim()) {
        const fuId = `rx_followup_${prescription.id}`;
        const fuHash = this.hashString(prescription.followUpText);
        const cachedFu = await dbService.getCachedTranslation(fuId, langCode).catch(() => null);
        if (cachedFu && cachedFu.medicineHash === fuHash) {
          if (!cachedFu.hasNumberWarning && cachedFu.translatedInstructions) {
            rxTexts.followUpText = cachedFu.translatedInstructions;
          }
          rxTexts.followUpNumberWarning = !!cachedFu.hasNumberWarning;
        } else {
          if (!rxTexts.followUpText) {
            rxTexts.followUpText = prescription.followUpText;
          }
          rxTexts.followUpPendingOffline = true;
          pendingItemIds.push(fuId);
          apiPayload.push({ id: fuId, text: prescription.followUpText });
        }
      }
    }

    const initialState: FullPrescriptionTranslationState = {
      medicines: { ...results },
      prescriptionTexts: { ...rxTexts },
      pendingItemIds: [...pendingItemIds],
    };

    if (onCacheReady) {
      onCacheReady(initialState);
    }

    if (apiPayload.length === 0) {
      return initialState;
    }

    // 3. Offline check: do not hit network when offline; return Layer 1 + cached items cleanly
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return initialState;
    }

    // 4. Online Layer 2 request (/api/translate)
    options?.onPhase?.('translating');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      const externalSignal = options?.signal;
      const onExternalAbort = () => controller.abort();
      if (externalSignal) {
        if (externalSignal.aborted) {
          controller.abort();
        } else {
          externalSignal.addEventListener('abort', onExternalAbort, { once: true });
        }
      }

      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          targetLanguage: targetLang.englishName,
          items: apiPayload.map((item) => ({
            id: item.id,
            name: item.name || '',
            instructions: item.text,
          })),
        }),
      });
      clearTimeout(timeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }

      if (!response.ok) {
        let errMessage = `Translation server returned ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson?.error) errMessage = errJson.error;
        } catch {
          // ignore
        }
        throw new Error(errMessage);
      }

      const resData = await response.json();
      options?.onPhase?.('checking_numbers');
      const apiTranslations: ApiTranslationItem[] = Array.isArray(resData?.data)
        ? resData.data
        : Array.isArray(resData?.data?.translations)
        ? resData.data.translations
        : [];

      // Process medicine items
      for (const medicine of medicines) {
        if (!pendingItemIds.includes(medicine.id)) continue;

        const match = apiTranslations.find((t) => t.id === medicine.id);
        if (!match) continue;

        const transliteratedName =
          match.transliteratedName?.trim() || getOfflineTransliteratedName(medicine.name, langCode);
        const translatedText = (match.translatedText || '').trim();

        let hasNumberWarning = false;
        let missingNumbers: string[] = [];
        let extraNumbers: string[] = [];

        if (medicine.instructions && medicine.instructions.trim() && translatedText) {
          const validation = validateNumberPreservation(medicine.instructions, translatedText);
          if (!validation.isValid) {
            hasNumberWarning = true;
            missingNumbers = validation.missingNumbers;
            extraNumbers = validation.extraNumbers;
          }
        }

        // On safety check failure, discard unsafe AI instruction text and fall back to glossary version
        const safeAiInstruction = hasNumberWarning ? undefined : translatedText || undefined;

        const cacheRecord: CachedTranslation = {
          id: `${medicine.id}_${langCode}`,
          medicineId: medicine.id,
          languageCode: langCode,
          medicineHash: this.computeMedicineHash(medicine),
          transliteratedName,
          translatedInstructions: safeAiInstruction || '',
          hasNumberWarning,
          missingNumbers: [...missingNumbers, ...extraNumbers],
          translatedAt: new Date().toISOString(),
        };

        await dbService.saveCachedTranslation(cacheRecord).catch(() => {});

        results[medicine.id] = {
          medicineId: medicine.id,
          targetLang: langCode,
          originalName: medicine.name,
          transliteratedName,
          offlineSentence: results[medicine.id].offlineSentence,
          aiInstruction: safeAiInstruction,
          isAiTranslated: true,
          isCachedHit: false,
          isOfflineOnly: false,
          isOfflinePending: false,
          hasNumberWarning,
          missingNumbers,
          extraNumbers,
        };
      }

      // Process prescription notes
      const notesId = `rx_notes_${prescription.id}`;
      if (prescription.notes && pendingItemIds.includes(notesId)) {
        const match = apiTranslations.find((t) => t.id === notesId);
        if (match?.translatedText) {
          const validation = validateNumberPreservation(prescription.notes, match.translatedText);
          const hasWarn = !validation.isValid;
          rxTexts.notesText = hasWarn ? prescription.notes : match.translatedText;
          rxTexts.notesNumberWarning = hasWarn;
          rxTexts.notesPendingOffline = false;

          await dbService
            .saveCachedTranslation({
              id: `${notesId}_${langCode}`,
              medicineId: notesId,
              languageCode: langCode,
              medicineHash: this.hashString(prescription.notes),
              transliteratedName: '',
              translatedInstructions: rxTexts.notesText || '',
              hasNumberWarning: hasWarn,
              missingNumbers: [...validation.missingNumbers, ...validation.extraNumbers],
              translatedAt: new Date().toISOString(),
            })
            .catch(() => {});
        }
      }

      // Process follow-up text
      const fuId = `rx_followup_${prescription.id}`;
      if (prescription.followUpText && pendingItemIds.includes(fuId)) {
        const match = apiTranslations.find((t) => t.id === fuId);
        if (match?.translatedText) {
          const validation = validateNumberPreservation(
            prescription.followUpText,
            match.translatedText
          );
          const hasWarn = !validation.isValid;
          if (!hasWarn) {
            rxTexts.followUpText = match.translatedText;
          }
          rxTexts.followUpNumberWarning = hasWarn;
          rxTexts.followUpPendingOffline = false;

          await dbService
            .saveCachedTranslation({
              id: `${fuId}_${langCode}`,
              medicineId: fuId,
              languageCode: langCode,
              medicineHash: this.hashString(prescription.followUpText),
              transliteratedName: '',
              translatedInstructions: hasWarn ? '' : match.translatedText,
              hasNumberWarning: hasWarn,
              missingNumbers: [...validation.missingNumbers, ...validation.extraNumbers],
              translatedAt: new Date().toISOString(),
            })
            .catch(() => {});
        }
      }

      options?.onPhase?.('complete');
      return {
        medicines: results,
        prescriptionTexts: rxTexts,
        pendingItemIds: [],
      };
    } catch (err: any) {
      if (err?.name === 'AbortError' && options?.signal?.aborted) {
        throw err;
      }
      const errorMsg =
        err?.name === 'AbortError'
          ? 'Translation request timed out. Showing offline glossary translation.'
          : err?.message || 'Unable to reach translation service. Showing offline glossary translation.';
      console.warn('[Translation Service] Online translation error:', errorMsg);

      for (const medicine of medicines) {
        if (pendingItemIds.includes(medicine.id)) {
          results[medicine.id] = {
            ...results[medicine.id],
            isOfflineOnly: true,
            onlineError: errorMsg,
          };
        }
      }

      return {
        medicines: results,
        prescriptionTexts: rxTexts,
        pendingItemIds: [],
        onlineError: errorMsg,
      };
    }
  }

  /**
   * Convenience method for translating a list of medicines.
   */
  async translatePrescriptionMedicines(
    medicines: StoredMedicine[],
    targetLangCode: string
  ): Promise<Record<string, MedicineTranslationResult>> {
    const dummyRx: StoredPrescription = {
      id: medicines[0]?.prescriptionId || 'rx_temp',
      userId: medicines[0]?.userId || '',
      profileId: medicines[0]?.profileId || '',
      prescriptionDate: '',
      imageBase64: '',
      fileSizeBytes: 0,
      status: 'confirmed',
      createdAt: '',
    };
    const res = await this.translateFullPrescription(dummyRx, medicines, targetLangCode);
    return res.medicines;
  }
}

export const translationService = new TranslationService();
