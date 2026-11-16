import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Share2,
  RefreshCw,
  Type,
  Info,
  WifiOff,
  AlertCircle,
  FileDown,
  FileText,
  CalendarClock,
  AlertTriangle,
} from 'lucide-react';
import { StoredPrescription, StoredMedicine, PatientProfile } from '../services/db';
import {
  translationService,
  MedicineTranslationResult,
  PrescriptionTextTranslation,
} from '../services/translationService';
import { SUPPORTED_LANGUAGES, LanguageConfig } from '../data/translations';
import {
  PRESCRIPTION_UI_LABELS,
  PROGRESS_UI_STRINGS,
  toSupportedLang,
} from '../translations/glossary';
import { generateTranslatedPrescriptionPdf } from '../services/pdfExport';
import { MedicineTranslationCard } from './MedicineTranslationCard';
import { ManualMedicineModal } from './ManualMedicineModal';
import { HonestProgressScreen, HonestProgressStatus } from './HonestProgressScreen';

interface PrescriptionTranslationViewProps {
  prescription: StoredPrescription;
  medicines: StoredMedicine[];
  patientProfile?: PatientProfile;
  initialLanguageCode?: string;
  onBack: () => void;
  onUpdateLanguagePreference?: (langCode: string) => void;
  onEditMedicine?: (updatedMed: StoredMedicine) => Promise<void>;
}

const VOICE_LOCALE_PREFIX: Record<string, string[]> = {
  en: ['en'],
  hi: ['hi'],
  ur: ['ur'],
  te: ['te'],
  bn: ['bn'],
  mr: ['mr'],
  ta: ['ta'],
};

export const PrescriptionTranslationView: React.FC<PrescriptionTranslationViewProps> = ({
  prescription,
  medicines,
  patientProfile,
  initialLanguageCode = 'en',
  onBack,
  onUpdateLanguagePreference,
  onEditMedicine,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageConfig>(() => {
    const resolvedCode = prescription.preferredLanguage || initialLanguageCode || 'en';
    return (
      SUPPORTED_LANGUAGES.find((l) => l.code === resolvedCode) || SUPPORTED_LANGUAGES[0]
    );
  });

  const [translations, setTranslations] = useState<Record<string, MedicineTranslationResult>>({});
  const [rxTexts, setRxTexts] = useState<PrescriptionTextTranslation>({});
  const [pendingItemIds, setPendingItemIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingMedicine, setEditingMedicine] = useState<StoredMedicine | null>(null);

  const [isLargeText, setIsLargeText] = useState(false);
  const [speakingItemId, setSpeakingItemId] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Honest Progress State for Translation step
  const [transProgress, setTransProgress] = useState(0);
  const [transStepIndex, setTransStepIndex] = useState(0);
  const [transStatus, setTransStatus] = useState<HonestProgressStatus>('running');
  const transAbortRef = useRef<AbortController | null>(null);
  const transTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeLangRef = useRef(selectedLanguage);
  activeLangRef.current = selectedLanguage;

  // Detect installed SpeechSynthesis voices so Listen button is hidden when language voice is absent
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const loadVoices = () => {
      try {
        const list = window.speechSynthesis.getVoices();
        if (list && list.length > 0) {
          setAvailableVoices(list);
        }
      } catch {
        // ignore
      }
    };

    loadVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', loadVoices);
    };
  }, []);

  const hasVoiceForLanguage = useCallback(
    (code: string): boolean => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
      const prefixes = VOICE_LOCALE_PREFIX[code] || [code];
      return availableVoices.some((v) =>
        prefixes.some((p) => v.lang.toLowerCase().startsWith(p))
      );
    },
    [availableVoices]
  );

  const clearTransTimer = () => {
    if (transTimerRef.current) {
      clearInterval(transTimerRef.current);
      transTimerRef.current = null;
    }
  };

  const loadTranslations = useCallback(
    async (lang: LanguageConfig) => {
      if (transAbortRef.current) {
        transAbortRef.current.abort();
      }
      clearTransTimer();

      const abortController = new AbortController();
      transAbortRef.current = abortController;
      setLoadError(null);
      setTransStatus('running');
      setTransProgress(10);
      setTransStepIndex(0);

      try {
        const finalState = await translationService.translateFullPrescription(
          prescription,
          medicines,
          lang.code,
          (cachedInitial) => {
            if (activeLangRef.current.code !== lang.code || abortController.signal.aborted) return;
            setTranslations(cachedInitial.medicines);
            setRxTexts(cachedInitial.prescriptionTexts);
            setPendingItemIds(cachedInitial.pendingItemIds);
            const willCallNetwork = cachedInitial.pendingItemIds.length > 0 && navigator.onLine;
            setIsLoading(willCallNetwork);
            if (willCallNetwork) {
              setTransProgress(25);
              setTransStepIndex(1);
            }
          },
          {
            signal: abortController.signal,
            onPhase: (phase) => {
              if (activeLangRef.current.code !== lang.code || abortController.signal.aborted) return;
              if (phase === 'preparing') {
                setTransStepIndex(0);
                setTransProgress((p) => Math.max(p, 15));
              } else if (phase === 'translating') {
                setTransStepIndex(1);
                setTransProgress((p) => Math.max(p, 30));
                const waitStart = Date.now();
                clearTransTimer();
                transTimerRef.current = setInterval(() => {
                  const elapsedSec = (Date.now() - waitStart) / 1000;
                  const curve = Math.min(89.9, 90 - 60 * Math.exp(-elapsedSec / 8));
                  setTransProgress((prev) => Math.max(prev, curve));
                }, 150);
              } else if (phase === 'checking_numbers') {
                clearTransTimer();
                setTransStepIndex(2);
                setTransProgress((p) => Math.max(p, 95));
              } else if (phase === 'complete') {
                clearTransTimer();
                setTransStepIndex(2);
                setTransProgress(100);
                setTransStatus('complete');
              }
            },
          }
        );

        clearTransTimer();
        if (activeLangRef.current.code !== lang.code || abortController.signal.aborted) return;
        setTranslations(finalState.medicines);
        setRxTexts(finalState.prescriptionTexts);
        setPendingItemIds(finalState.pendingItemIds);
        if (finalState.onlineError) {
          setLoadError(finalState.onlineError);
        }
      } catch (err: any) {
        clearTransTimer();
        if (err?.name === 'AbortError' || abortController.signal.aborted) {
          setIsLoading(false);
          setPendingItemIds([]);
          return;
        }
        if (activeLangRef.current.code !== lang.code) return;
        setLoadError(err?.message || 'Unable to translate free-text instructions right now.');
      } finally {
        clearTransTimer();
        if (activeLangRef.current.code === lang.code) {
          setIsLoading(false);
          setPendingItemIds([]);
        }
      }
    },
    [prescription, medicines]
  );

  useEffect(() => {
    loadTranslations(selectedLanguage);
  }, [selectedLanguage, loadTranslations]);

  // Finish pending offline translations automatically when internet returns
  useEffect(() => {
    const handleOnline = () => {
      loadTranslations(activeLangRef.current);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [loadTranslations]);

  // Cleanup active speech and in-flight translation requests on unmount
  useEffect(() => {
    return () => {
      if (transAbortRef.current) {
        transAbortRef.current.abort();
      }
      clearTransTimer();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const langCode = toSupportedLang(selectedLanguage.code);
  const ui = PRESCRIPTION_UI_LABELS[langCode];
  const isUrdu = langCode === 'ur';
  const progressStrings = PROGRESS_UI_STRINGS[langCode];

  const handleCancelTranslation = () => {
    if (transAbortRef.current) {
      transAbortRef.current.abort();
    }
    clearTransTimer();
    setIsLoading(false);
    setPendingItemIds([]);
  };

  const handleSelectLanguage = (lang: LanguageConfig) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingItemId(null);
    }
    setSelectedLanguage(lang);
    if (onUpdateLanguagePreference) {
      onUpdateLanguagePreference(lang.code);
    }
  };

  const handleSpeak = (text: string, code: string, itemId: string) => {
    if (!('speechSynthesis' in window)) return;

    if (speakingItemId === itemId) {
      window.speechSynthesis.cancel();
      setSpeakingItemId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const langMap: Record<string, string> = {
      en: 'en-IN',
      hi: 'hi-IN',
      ur: 'ur-PK',
      te: 'te-IN',
      bn: 'bn-IN',
      mr: 'mr-IN',
      ta: 'ta-IN',
    };
    const matchingVoice = availableVoices.find((v) =>
      v.lang.toLowerCase().startsWith(code.toLowerCase())
    );
    if (matchingVoice) {
      utterance.voice = matchingVoice;
      utterance.lang = matchingVoice.lang;
    } else {
      utterance.lang = langMap[code] || 'en-IN';
    }
    utterance.rate = 0.9;

    utterance.onend = () => setSpeakingItemId(null);
    utterance.onerror = () => setSpeakingItemId(null);

    setSpeakingItemId(itemId);
    window.speechSynthesis.speak(utterance);
  };

  const handleShareText = async () => {
    setShowShareMenu(false);
    const summaryLines = medicines.map((m) => {
      const tr = translations[m.id];
      const orig = m.strength && !m.name.includes(m.strength) ? `${m.name} ${m.strength}` : m.name;
      const namePart =
        langCode !== 'en' && tr?.transliteratedName && tr.transliteratedName !== m.name
          ? `${orig} / ${tr.transliteratedName}`
          : orig;
      const sentence = tr?.offlineSentence || '';
      return `• ${namePart}: ${sentence}`;
    });

    const parts = [
      `PillSync — ${ui.headerTitle} (${selectedLanguage.nativeName})`,
      `${ui.visitDate}: ${prescription.prescriptionDate}`,
      prescription.doctorName ? `${ui.doctorLabel}: ${prescription.doctorName}` : '',
      prescription.clinic ? `${ui.clinicLabel}: ${prescription.clinic}` : '',
      rxTexts.followUpText ? `${ui.followUpLabel}: ${rxTexts.followUpText}` : '',
      rxTexts.notesText ? `${ui.notesLabel}: ${rxTexts.notesText}` : '',
      '',
      `${ui.medicationsSectionTitle}:`,
      ...summaryLines,
      '',
      ui.disclaimer,
    ].filter((line, idx, arr) => line !== '' || (idx > 0 && arr[idx - 1] !== ''));

    const shareContent = parts.join('\n');

    if (navigator.share) {
      try {
        await navigator.share({
          title: `PillSync - ${selectedLanguage.englishName}`,
          text: shareContent,
        });
        return;
      } catch {
        // Fallback to clipboard below
      }
    }
    await navigator.clipboard.writeText(shareContent);
  };

  const handleSharePdf = async () => {
    setShowShareMenu(false);
    setIsExportingPdf(true);
    try {
      const pdfBlob = await generateTranslatedPrescriptionPdf({
        prescription,
        medicines,
        patientProfile,
        language: selectedLanguage,
        translations,
        rxTexts,
      });

      const fileName = `PillSync_Prescription_${selectedLanguage.code}_${prescription.prescriptionDate}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `PillSync - ${selectedLanguage.nativeName}`,
            text: ui.disclaimer,
            files: [file],
          });
          return;
        } catch {
          // User cancelled or file share unsupported — trigger download below
        }
      }

      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const isOfflineNow = typeof navigator !== 'undefined' ? !navigator.onLine : false;
  const hasOfflinePendingItems =
    langCode !== 'en' &&
    isOfflineNow &&
    (Object.values(translations).some((r) => r.isOfflinePending) ||
      !!rxTexts.notesPendingOffline ||
      !!rxTexts.followUpPendingOffline);

  const voiceAvailable = hasVoiceForLanguage(langCode);

  return (
    <div
      dir={isUrdu ? 'rtl' : 'ltr'}
      className="flex-1 flex flex-col bg-[#F9FAFB] overflow-y-auto min-h-full"
      style={{ fontFamily: selectedLanguage.fontFamily }}
    >
      {/* Top Header */}
      <div className="p-4 bg-white border-b border-slate-200 sticky top-0 z-20 shrink-0 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors shrink-0"
            title="Back"
          >
            <ArrowLeft className={`w-4 h-4 ${isUrdu ? 'rotate-180' : ''}`} />
          </button>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 leading-tight truncate">
              {ui.headerTitle}
            </h2>
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-sans">
              <span>{prescription.prescriptionDate}</span>
              {prescription.doctorName && (
                <>
                  <span>•</span>
                  <span className="font-medium text-slate-700 truncate">
                    {prescription.doctorName}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls: Large Text Toggle (A+) & Share (Text + PDF) */}
        <div className="flex items-center gap-1.5 relative shrink-0 font-sans">
          <button
            onClick={() => setIsLargeText(!isLargeText)}
            className={`p-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1 ${
              isLargeText
                ? 'bg-[#1E88E5] text-white border-[#1E88E5] shadow-xs'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
            title="A+"
          >
            <Type className="w-3.5 h-3.5" />
            <span className="text-[10px]">A+</span>
          </button>

          <button
            onClick={() => setShowShareMenu(!showShareMenu)}
            disabled={isExportingPdf}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors flex items-center gap-1"
            title={ui.shareText}
          >
            {isExportingPdf ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#1E88E5]" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
          </button>

          {showShareMenu && (
            <div
              className={`absolute top-11 ${
                isUrdu ? 'left-0' : 'right-0'
              } w-48 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-30`}
              style={{ fontFamily: selectedLanguage.fontFamily }}
            >
              <button
                onClick={handleShareText}
                className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl flex items-center gap-2"
              >
                <FileText className="w-4 h-4 text-[#1E88E5] shrink-0" />
                <span>{ui.shareText}</span>
              </button>
              <button
                onClick={handleSharePdf}
                className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl flex items-center gap-2"
              >
                <FileDown className="w-4 h-4 text-[#2E9E6B] shrink-0" />
                <span>{ui.sharePdf}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 7-LANGUAGE SELECTOR CHIPS */}
      <div className="p-3 bg-white border-b border-slate-200 shrink-0">
        <div className="text-[11px] font-bold text-slate-600 mb-2 flex items-center justify-between">
          <span>{ui.viewInLabel}</span>
          {isLoading && (
            <span className="text-[#1E88E5] font-semibold flex items-center gap-1 text-[10px]">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>{ui.translating}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = selectedLanguage.code === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => handleSelectLanguage(lang)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
                  isSelected
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
      </div>

      {/* Main Body */}
      <div className="p-4 space-y-4 flex-1">
        {/* Reusable Honest Progress Card for uncached translations */}
        {isLoading && pendingItemIds.length > 0 && langCode !== 'en' && (
          <HonestProgressScreen
            compact
            title={progressStrings.translatingTitle(selectedLanguage.nativeName)}
            subtitle={progressStrings.translationSteps[transStepIndex]}
            progress={transProgress}
            steps={progressStrings.translationSteps}
            currentStepIndex={transStepIndex}
            status={transStatus}
            language={selectedLanguage}
            isLargeText={isLargeText}
            cancelLabel={progressStrings.cancel}
            onCancel={handleCancelTranslation}
          />
        )}

        {/* Offline Glossary Banner when uncached free text waits for internet */}
        {hasOfflinePendingItems && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{ui.offlineBanner}</span>
          </div>
        )}

        {/* Clear Error with Retry if Online Translation Failed */}
        {loadError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">{ui.onlineErrorTitle}</span>
                <span className="font-sans">{loadError}</span>
              </div>
            </div>
            <button
              onClick={() => loadTranslations(selectedLanguage)}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs shrink-0 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{ui.retry}</span>
            </button>
          </div>
        )}

        {/* Localized Prescription Metadata Overview */}
        <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs text-xs space-y-1.5 text-slate-700">
          <div className="flex justify-between items-center font-bold text-slate-900 pb-1 border-b border-slate-100">
            <span>{ui.summaryTitle}</span>
            <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              {ui.medicinesCount(medicines.length)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
            <div>
              <span className="text-slate-400 block">{ui.patientProfile}</span>
              <span className="font-bold text-slate-800">
                {patientProfile?.name || prescription.patientName || 'Me'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">{ui.visitDate}</span>
              <span className="font-bold text-slate-800 font-sans" dir="ltr">
                {prescription.prescriptionDate}
              </span>
            </div>
            {prescription.doctorName && (
              <div>
                <span className="text-slate-400 block">{ui.doctorLabel}</span>
                <span className="font-bold text-slate-800">{prescription.doctorName}</span>
              </div>
            )}
            {prescription.clinic && (
              <div>
                <span className="text-slate-400 block">{ui.clinicLabel}</span>
                <span className="font-bold text-slate-800">{prescription.clinic}</span>
              </div>
            )}
          </div>
        </div>

        {/* Translated Doctor's Notes & Follow-Up Advice */}
        {(rxTexts.followUpText || rxTexts.notesText) && (
          <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2.5">
            {rxTexts.followUpText && (
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-emerald-700 flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5" />
                  <span>{ui.followUpLabel}</span>
                </div>
                <div
                  className={`font-bold text-slate-900 ${
                    isLargeText ? 'text-base' : 'text-xs'
                  }`}
                >
                  {rxTexts.followUpText}
                </div>
                {rxTexts.followUpNumberWarning && prescription.followUpText && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                    <span className="font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      {ui.checkTranslationWarning}
                    </span>
                    <span dir="ltr" className="font-sans block mt-0.5">
                      {prescription.followUpText}
                    </span>
                  </div>
                )}
              </div>
            )}

            {rxTexts.notesText && (
              <div className="space-y-1 pt-1 border-t border-slate-100 first:border-t-0 first:pt-0">
                <div className="text-[11px] font-bold text-slate-500">{ui.notesLabel}</div>
                <div
                  className={`text-slate-800 font-medium leading-relaxed ${
                    isLargeText ? 'text-sm' : 'text-xs'
                  }`}
                >
                  {rxTexts.notesText}
                </div>
                {rxTexts.notesPendingOffline && isOfflineNow && langCode !== 'en' && (
                  <div className="text-[10px] text-amber-700">{ui.offlineNotePending}</div>
                )}
                {rxTexts.notesNumberWarning && (
                  <div className="text-[10px] text-amber-800 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    <span>{ui.checkTranslationWarning}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Medicines List Rendered with MedicineTranslationCard */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800">{ui.medicationsSectionTitle}</h3>
          </div>

          {medicines.map((med) => (
            <MedicineTranslationCard
              key={med.id}
              medicine={med}
              translation={translations[med.id]}
              targetLanguage={selectedLanguage}
              isLargeText={isLargeText}
              isPendingTranslation={pendingItemIds.includes(med.id)}
              hasVoiceForLanguage={voiceAvailable}
              onSpeak={handleSpeak}
              speakingItemId={speakingItemId}
              onEditMedicine={onEditMedicine ? (m) => setEditingMedicine(m) : undefined}
              onRetryTranslation={() => loadTranslations(selectedLanguage)}
            />
          ))}
        </div>
      </div>

      {/* Edit Medicine Modal (triggers cache invalidation in IndexedDB) */}
      <ManualMedicineModal
        isOpen={!!editingMedicine}
        userId={prescription.userId}
        profileId={prescription.profileId}
        prescriptionId={prescription.id}
        initialMedicine={editingMedicine}
        langCode={selectedLanguage.code}
        onClose={() => setEditingMedicine(null)}
        onMedicineAdded={async (updatedMed) => {
          if (onEditMedicine) {
            await onEditMedicine(updatedMed);
          }
          setEditingMedicine(null);
        }}
      />

      {/* Localized Statutory Medical Footer */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0">
        <div className="p-2.5 bg-blue-50/70 border border-blue-200/60 rounded-xl flex items-start gap-2 text-[11px] text-slate-700">
          <Info className="w-3.5 h-3.5 text-[#1E88E5] shrink-0 mt-0.5" />
          <span>{ui.disclaimer}</span>
        </div>
      </div>
    </div>
  );
};
