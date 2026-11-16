import React, { useState } from 'react';
import {
  Volume2,
  AlertTriangle,
  Clock,
  Utensils,
  Sun,
  Moon,
  Sunrise,
  Calendar,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Pencil,
  Coffee,
  RefreshCw,
} from 'lucide-react';
import { StoredMedicine } from '../services/db';
import { MedicineTranslationResult } from '../services/translationService';
import { SUPPORTED_LANGUAGES, LanguageConfig, translateMedicalTerm } from '../data/translations';
import {
  PRESCRIPTION_UI_LABELS,
  REVIEW_CARD_LABELS,
  toSupportedLang,
} from '../translations/glossary';
import {
  normalizeHandwritingFrequency,
  buildEnglishFrequencySentence,
} from '../utils/frequencyHelper';
import {
  isFoodTimingApplicable,
  isTopicalForm,
  resolveApplicationAreaLabel,
} from '../config/medicineForms';
import { shouldPromptTopicalCheckForSavedMedicine } from '../services/formInference';

interface MedicineTranslationCardProps {
  medicine: StoredMedicine;
  translation?: MedicineTranslationResult;
  targetLanguage: LanguageConfig;
  isLargeText: boolean;
  isPendingTranslation?: boolean;
  hasVoiceForLanguage?: boolean;
  onSpeak: (text: string, langCode: string, itemId: string) => void;
  speakingItemId?: string | null;
  onSelectLanguage?: (lang: LanguageConfig) => void;
  onEditMedicine?: (medicine: StoredMedicine) => void;
  onRetryTranslation?: () => void;
}

export const MedicineTranslationCard: React.FC<MedicineTranslationCardProps> = ({
  medicine,
  translation,
  targetLanguage,
  isLargeText,
  isPendingTranslation = false,
  hasVoiceForLanguage = false,
  onSpeak,
  speakingItemId,
  onSelectLanguage,
  onEditMedicine,
  onRetryTranslation,
}) => {
  const [showOriginalEnglish, setShowOriginalEnglish] = useState(false);

  const langCode = toSupportedLang(targetLanguage.code);
  const ui = PRESCRIPTION_UI_LABELS[langCode];
  const reviewUi = REVIEW_CARD_LABELS[langCode];
  const isUrdu = langCode === 'ur';
  const isSpeakingThis = speakingItemId === medicine.id;

  const normFreq = normalizeHandwritingFrequency(
    medicine.frequency,
    medicine.doseSchedule,
    !!medicine.asNeeded
  );
  const freq = (normFreq.canonicalCode || medicine.frequency || '').toLowerCase().trim();
  const timing = (medicine.timing || '').toLowerCase().trim();

  // Time-of-day indicators (Morning, Afternoon, Night)
  const hasMorning =
    normFreq.schedule.morning > 0 ||
    normFreq.specialCode === 'bd' ||
    normFreq.specialCode === 'tds' ||
    normFreq.specialCode === 'qid';
  const hasAfternoon =
    normFreq.schedule.afternoon > 0 ||
    normFreq.specialCode === 'tds' ||
    normFreq.specialCode === 'qid';
  const hasNight =
    normFreq.schedule.night > 0 ||
    normFreq.schedule.bedtime > 0 ||
    normFreq.specialCode === 'bd' ||
    normFreq.specialCode === 'tds' ||
    normFreq.specialCode === 'qid' ||
    normFreq.specialCode === 'hs' ||
    timing.includes('bed');

  const isEmptyStomach = timing.includes('empty');
  const showFoodBadge =
    Boolean(timing) &&
    timing !== 'unspecified' &&
    timing !== 'anytime' &&
    timing !== 'not_food_related' &&
    isFoodTimingApplicable(medicine.form);
  const localizedArea = isTopicalForm(medicine.form)
    ? resolveApplicationAreaLabel(medicine.applicationArea, langCode)
    : '';
  const showSavedFormPrompt = shouldPromptTopicalCheckForSavedMedicine(medicine);

  // Build "Original [Strength] / Transliterated [Strength]" header
  const strengthStr = (medicine.strength || '').trim();
  const baseOriginal =
    strengthStr && !medicine.name.toLowerCase().includes(strengthStr.toLowerCase())
      ? `${medicine.name} ${strengthStr}`
      : medicine.name;

  const rawTranslit = (translation?.transliteratedName || '').trim();
  const fullTranslit =
    rawTranslit && strengthStr && !rawTranslit.toLowerCase().includes(strengthStr.toLowerCase())
      ? `${rawTranslit} ${strengthStr}`
      : rawTranslit;

  const showDualHeading =
    langCode !== 'en' && fullTranslit && fullTranslit.toLowerCase() !== baseOriginal.toLowerCase();

  const speechText = translation
    ? `${rawTranslit || medicine.name}. ${translation.offlineSentence}. ${
        !translation.hasNumberWarning && translation.aiInstruction ? translation.aiInstruction : ''
      }`
    : `${medicine.name}. ${medicine.dose || ''} ${showFoodBadge ? medicine.timing || '' : ''}`;

  const isOfflineNow = typeof navigator !== 'undefined' ? !navigator.onLine : false;

  return (
    <div
      dir={isUrdu ? 'rtl' : 'ltr'}
      className="p-4 bg-white border border-slate-200 rounded-3xl shadow-xs transition-all space-y-3"
      style={{ fontFamily: targetLanguage.fontFamily }}
    >
      {/* Card Header: "Paracetamol 500 mg / पैरासिटामोल 500 mg" + Edit / Listen */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3
            className={`font-black text-slate-900 tracking-tight leading-snug break-words ${
              isLargeText ? 'text-lg sm:text-xl' : 'text-base'
            }`}
          >
            {showDualHeading ? (
              <>
                <span dir="ltr" className="inline-block font-sans">
                  {baseOriginal}
                </span>{' '}
                <span className="text-slate-400 font-normal">/</span>{' '}
                <span className="text-[#1E88E5]">{fullTranslit}</span>
              </>
            ) : (
              baseOriginal
            )}
          </h3>
        </div>

        {/* Action buttons: Edit & Listen (Listen hidden if no TTS voice is installed for this language) */}
        <div className="flex items-center gap-1.5 shrink-0 font-sans">
          {onEditMedicine && (
            <button
              onClick={() => onEditMedicine(medicine)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              title={ui.editLabel}
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}

          {hasVoiceForLanguage && (
            <button
              onClick={() => onSpeak(speechText, langCode, medicine.id)}
              className={`px-2.5 py-2 rounded-xl transition-all flex items-center gap-1 text-xs font-bold ${
                isSpeakingThis
                  ? 'bg-[#1E88E5] text-white shadow-sm animate-pulse'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
              title={ui.listen}
            >
              <Volume2 className="w-4 h-4" />
              <span className="text-[11px]" style={{ fontFamily: targetLanguage.fontFamily }}>
                {isSpeakingThis ? ui.stop : ui.listen}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Time-of-Day & Food Icons Bar */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-700">
        {(medicine.dose || medicine.form) && (
          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-bold flex items-center gap-1">
            {medicine.dose && <span dir="ltr">{medicine.dose}</span>}
            {medicine.form && (
              <>
                {medicine.dose && <span>•</span>}
                <span>{translateMedicalTerm(medicine.form, langCode)}</span>
              </>
            )}
          </span>
        )}

        {(freq || medicine.asNeeded) && (
          <span className="px-2.5 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-xl font-semibold flex items-center gap-1.5">
            {hasMorning && (
              <span title="Morning" className="inline-flex">
                <Sunrise className="w-3.5 h-3.5 text-amber-500" />
              </span>
            )}
            {hasAfternoon && (
              <span title="Afternoon" className="inline-flex">
                <Sun className="w-3.5 h-3.5 text-orange-500" />
              </span>
            )}
            {hasNight && (
              <span title="Night" className="inline-flex">
                <Moon className="w-3.5 h-3.5 text-indigo-600" />
              </span>
            )}
            {!hasMorning && !hasAfternoon && !hasNight && (
              <Clock className="w-3.5 h-3.5 text-purple-600" />
            )}
            <span>
              {langCode === 'en'
                ? buildEnglishFrequencySentence(normFreq, medicine.form, medicine.dose)
                : medicine.asNeeded && !freq
                ? translateMedicalTerm('sos', langCode)
                : translateMedicalTerm(freq, langCode)}
            </span>
          </span>
        )}

        {showFoodBadge && (
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-semibold flex items-center gap-1">
            {isEmptyStomach ? (
              <Coffee className="w-3.5 h-3.5 text-emerald-700" />
            ) : (
              <Utensils className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span>{translateMedicalTerm(timing, langCode)}</span>
            {medicine.timingSuggested && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 bg-white/80 text-[#1E88E5] rounded-md border border-blue-200/80">
                {reviewUi.suggestedBadge}
              </span>
            )}
          </span>
        )}

        {localizedArea && (
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-semibold flex items-center gap-1">
            <span>{localizedArea}</span>
          </span>
        )}

        {medicine.durationDays && (
          <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl font-semibold flex items-center gap-1">
            <Calendar className="w-3 h-3 text-amber-600" />
            <span dir="ltr">{medicine.durationDays}</span>
            <span>{translateMedicalTerm('days', langCode)}</span>
          </span>
        )}
      </div>

      {/* Gentle non-destructive prompt for legacy saved medicines misclassified as tablet */}
      {showSavedFormPrompt && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold leading-snug">{ui.savedWrongFormPrompt}</span>
          </div>
          {onEditMedicine && (
            <button
              onClick={() => onEditMedicine(medicine)}
              className="px-2.5 py-1.5 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl font-bold text-[11px] shrink-0"
            >
              {ui.editLabel}
            </button>
          )}
        </div>
      )}

      {/* Optional compact per-card 7-language chips when passed */}
      {onSelectLanguage && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-0.5">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isCardActive = langCode === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => onSelectLanguage(lang)}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all shrink-0 border cursor-pointer ${
                  isCardActive
                    ? 'bg-[#1E88E5] text-white border-[#1E88E5] shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
                style={{ fontFamily: lang.fontFamily }}
              >
                {lang.nativeName}
              </button>
            );
          })}
        </div>
      )}

      {/* Primary Localized Plain Sentence (Layer 1 instant SOV template with Latin digits 0-9) */}
      <div
        className={`p-3.5 bg-blue-50/60 border border-blue-100 rounded-2xl text-slate-900 leading-relaxed font-bold ${
          isLargeText ? 'text-base sm:text-lg' : 'text-sm'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex-1">
            {translation?.offlineSentence || ''}
          </span>
          {isPendingTranslation && langCode !== 'en' && (
            <span className="inline-flex items-center gap-1 text-[10px] text-[#1E88E5] font-semibold shrink-0 font-sans">
              <RefreshCw className="w-3 h-3 animate-spin" />
            </span>
          )}
        </div>
      </div>

      {/* Free-text doctor instructions & safety number validation */}
      {medicine.instructions && medicine.instructions.trim() && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#1E88E5]" />
            <span>{ui.doctorInstructionsLabel}</span>
          </div>

          {translation?.hasNumberWarning ? (
            /* Bidirectional number mismatch: do NOT display unsafe AI text; warn and show English beside glossary fallback */
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-950 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{ui.checkTranslationWarning}</span>
              </div>
              <div
                dir="ltr"
                className="p-2 bg-white rounded-xl border border-amber-200 text-xs font-sans text-slate-800"
              >
                <span className="text-[10px] font-bold text-slate-500 block uppercase mb-0.5">
                  English
                </span>
                {medicine.instructions}
              </div>
            </div>
          ) : (
            <div
              className={`p-3 bg-slate-50 rounded-2xl border border-slate-200 text-slate-800 leading-relaxed font-medium ${
                isLargeText ? 'text-sm' : 'text-xs'
              }`}
            >
              {translation?.aiInstruction ? (
                translation.aiInstruction
              ) : isPendingTranslation && !isOfflineNow ? (
                <span className="text-xs text-[#1E88E5] flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{ui.translating}</span>
                </span>
              ) : (
                <div className="space-y-1">
                  <div dir="ltr" className="font-sans text-slate-700">
                    {medicine.instructions}
                  </div>
                  {langCode !== 'en' && translation?.isOfflinePending && isOfflineNow && (
                    <div className="text-[11px] text-amber-700 flex items-center gap-1 pt-0.5">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>{ui.offlineNotePending}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Online Retry banner if AI call failed */}
      {translation?.onlineError && langCode !== 'en' && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700 flex items-center justify-between gap-2">
          <span className="leading-snug">{ui.onlineErrorTitle}</span>
          {onRetryTranslation && (
            <button
              onClick={onRetryTranslation}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[10px] shrink-0 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{ui.retry}</span>
            </button>
          )}
        </div>
      )}

      {/* Localized "Show original English" Toggle */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
        <button
          onClick={() => setShowOriginalEnglish(!showOriginalEnglish)}
          className="text-xs text-[#1E88E5] font-bold hover:underline flex items-center gap-1"
        >
          <span>{showOriginalEnglish ? ui.hideOriginalEnglish : ui.showOriginalEnglish}</span>
          {showOriginalEnglish ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Original English Collapsible Details */}
      {showOriginalEnglish && (
        <div
          dir="ltr"
          className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-1 font-sans"
        >
          <div className="font-bold text-slate-900">{ui.originalEnglishHeading}</div>
          <div>
            • Medicine: {baseOriginal} {medicine.form ? `(${medicine.form})` : ''}
          </div>
          <div>
            • Schedule: {medicine.dose || '—'} • {medicine.frequency || '—'} (
            {isFoodTimingApplicable(medicine.form)
              ? medicine.timing || 'unspecified'
              : 'not related to food'}
            )
          </div>
          {medicine.applicationArea && (
            <div>
              • Where to apply: {resolveApplicationAreaLabel(medicine.applicationArea, 'en')}
            </div>
          )}
          {medicine.durationDays && <div>• Duration: {medicine.durationDays} days</div>}
          {medicine.instructions && <div>• Instructions: "{medicine.instructions}"</div>}
        </div>
      )}
    </div>
  );
};
