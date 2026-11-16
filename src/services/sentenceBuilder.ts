// PillSync Offline Translation & Sentence Builder Engine
// Delegates to the Layer 1 human-reviewed deterministic glossary in src/translations/glossary.ts
// and performs deterministic bidirectional number validation for AI translations.

import { StoredMedicine } from './db';
import {
  GLOSSARY_TERMS,
  buildMedicineSentenceFromTemplate,
  getOfflineTransliteratedName,
} from '../translations/glossary';

export { GLOSSARY_TERMS as SENTENCE_GLOSSARY, getOfflineTransliteratedName };

/**
 * Builds a natural, grammatically correct instruction sentence in any of the 7 languages
 * completely offline using Layer 1 templates & Latin digits (0-9).
 */
export function buildOfflineSentence(medicine: Partial<StoredMedicine>, langCode: string): string {
  return buildMedicineSentenceFromTemplate(medicine, langCode);
}

/**
 * Normalizes localized numerals (Arabic-Indic, Devanagari, Bengali, Telugu, Tamil) back to Latin digits
 * just in case a translation uses native numerals, so comparison can verify whether numbers match,
 * while also detecting missing numbers or hallucinated extra numbers.
 */
function normalizeDigitsToLatin(text: string): string {
  const digitMaps: Record<string, string> = {
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
    '౦': '0', '౧': '1', '౨': '2', '౩': '3', '౪': '4', '౫': '5', '౬': '6', '౭': '7', '౮': '8', '౯': '9',
    '௦': '0', '௧': '1', '௨': '2', '௩': '3', '௪': '4', '௫': '5', '௬': '6', '௭': '7', '௮': '8', '௯': '9',
  };
  return text.replace(/[०-९۰-۹٠-٩০-৯౦-౯௦-௯]/g, (ch) => digitMaps[ch] || ch);
}

function extractNumbers(text: string): string[] {
  const normalized = normalizeDigitsToLatin(text);
  return normalized.match(/\d+(?:\.\d+)?/g) || [];
}

/**
 * Deterministic bidirectional number validation:
 * 1. Every number in sourceText MUST appear in translatedText.
 * 2. translatedText MUST NOT contain extra numbers absent from sourceText.
 */
export function validateNumberPreservation(
  sourceText: string,
  translatedText: string
): {
  isValid: boolean;
  missingNumbers: string[];
  extraNumbers: string[];
} {
  if (!sourceText || !translatedText) {
    return { isValid: true, missingNumbers: [], extraNumbers: [] };
  }

  const sourceNumbers = extractNumbers(sourceText);
  const translatedNumbers = extractNumbers(translatedText);

  const sourceSet = new Set(sourceNumbers);
  const translatedSet = new Set(translatedNumbers);

  const missingNumbers = Array.from(sourceSet).filter((n) => !translatedSet.has(n));
  const extraNumbers = Array.from(translatedSet).filter((n) => !sourceSet.has(n));

  return {
    isValid: missingNumbers.length === 0 && extraNumbers.length === 0,
    missingNumbers,
    extraNumbers,
  };
}
