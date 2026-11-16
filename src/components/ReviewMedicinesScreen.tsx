import React, { useState, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  AlertTriangle,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  FileText,
  Check,
  RefreshCw,
  ShieldAlert,
  Info,
  Calendar,
  Sunrise,
  Sun,
  Moon,
  BedDouble,
  Utensils,
  Coffee,
  Clock,
  Sparkles,
  Keyboard,
  MapPin,
} from 'lucide-react';
import {
  ParsedMedicineItem,
  normalizeTimingValue,
  PrescriptionFollowUp,
  suggestFoodTimingWithGemini,
} from '../services/geminiClient';
import {
  lookupDrugTimingReference,
  referenceFoodTimingToUiValue,
  detectTimingConflict,
  TimingConflictType,
} from '../data/drugTimingReference';
import {
  STEPPER_VALUES,
  normalizeHandwritingFrequency,
  scheduleToCode,
  FrequencySpecialCode,
} from '../utils/frequencyHelper';
import {
  REVIEW_CARD_LABELS,
  toSupportedLang,
  buildMedicineSentenceFromTemplate,
} from '../translations/glossary';
import { LanguageConfig, SUPPORTED_LANGUAGES } from '../data/translations';
import {
  MedicineFormId,
  TOPICAL_APPLICATION_AREAS,
  DROPS_APPLICATION_SITES,
  getMedicineFormDef,
  isDropsForm,
  isOralForm,
  isTopicalForm,
  normalizeFormId,
} from '../config/medicineForms';
import { inferFormFromPrescription } from '../services/formInference';
import { MedicineFormSelect } from './MedicineFormSelect';

export interface EditableMedicine extends ParsedMedicineItem {
  id: string;
  name: string;
  form: MedicineFormId | null;
  applicationArea?: string | null;
  formCorrected?: boolean;
  isAmbiguousForm?: boolean;
  userEditedForm: boolean;
  doseSchedule: {
    morning: number;
    afternoon: number;
    night: number;
    bedtime: number;
  };
  specialFreqCode: FrequencySpecialCode;
  everyHours: number | null;
  timingSuggested: boolean;
  timingSuggestionSource?: 'reference' | 'ai';
  userEditedTiming: boolean;
  scheduleSuggested: boolean;
  timingConflict: TimingConflictType;
  isFlagged: boolean;
  isCheckedByUser: boolean;
}

interface ReviewMedicinesScreenProps {
  imageBase64: string;
  isPrescription?: boolean;
  imageQuality?: string;
  warnings?: string[];
  doctorName?: string | null;
  clinic?: string | null;
  doctorRegistrationNumber?: string | null;
  patientName?: string | null;
  patientAge?: string | null;
  patientSex?: string | null;
  prescriptionDate?: string | null;
  followUp?: PrescriptionFollowUp | null;
  notes?: string | null;
  medicines: ParsedMedicineItem[];
  readingFailed?: boolean;
  errorMessage?: string;
  language?: LanguageConfig;
  onRetryReading: () => void;
  onConfirm: (confirmedMedicines: EditableMedicine[], doctorName: string, clinic: string) => void;
  onCancel: () => void;
}

const SAFETY_CRITICAL_FLAGS = new Set([
  'name_uncertain',
  'strength_uncertain',
  'look_alike_risk',
  'possible_overwriting',
  'handwriting_unclear',
  'partly_cut_off',
  'abbreviation_unknown',
]);

function stepValue(current: number, direction: 1 | -1): number {
  const idx = STEPPER_VALUES.findIndex((v) => v === current);
  if (idx !== -1) {
    const nextIdx = Math.max(0, Math.min(STEPPER_VALUES.length - 1, idx + direction));
    return STEPPER_VALUES[nextIdx];
  }
  if (direction === 1) {
    const higher = STEPPER_VALUES.find((v) => v > current);
    return higher ?? STEPPER_VALUES[STEPPER_VALUES.length - 1];
  }
  const reversed = [...STEPPER_VALUES].reverse();
  const lower = reversed.find((v) => v < current);
  return lower ?? 0;
}

function initializeEditableMedicine(m: ParsedMedicineItem, idx: number): EditableMedicine {
  const flags = Array.isArray(m.flags) ? [...m.flags] : [];
  const hasCriticalFlag = flags.some((f) => SAFETY_CRITICAL_FLAGS.has(f));
  const isFlagged = m.confidence < 0.75 || m.illegible || !m.name || hasCriticalFlag;

  const inferred = inferFormFromPrescription({
    name: m.name,
    genericName: m.genericName,
    rawText: m.rawText,
    instructions: m.instructions,
    dose: m.dose,
    route: m.route,
    modelForm: m.form,
  });
  if (inferred.markerFlag && !flags.includes(inferred.markerFlag)) {
    flags.push(inferred.markerFlag);
  }

  const resolvedForm = inferred.form;
  const oral = isOralForm(resolvedForm);

  const rawFreqInput = m.frequencyCode || m.frequency || '';
  const normFreq = normalizeHandwritingFrequency(rawFreqInput, m.doseSchedule, !!m.asNeeded);

  let schedule = { ...normFreq.schedule };
  let canonicalFreq = normFreq.canonicalCode;
  let scheduleSuggested = false;

  const explicitTiming = oral ? normalizeTimingValue(m.timing) : 'unspecified';
  // Never apply drug food-timing reference to non-oral forms
  const refEntry = oral ? lookupDrugTimingReference(m.name, m.genericName) : null;

  let resolvedTiming = explicitTiming;
  let timingSuggested = false;
  let timingSuggestionSource: 'reference' | 'ai' | undefined;

  // Priority (b): Prescription omitted timing on oral medicine -> lookup in bundled reference
  if (oral && explicitTiming === 'unspecified' && refEntry) {
    const refTiming = referenceFoodTimingToUiValue(refEntry.foodTiming);
    if (refTiming !== 'unspecified') {
      resolvedTiming = refTiming;
      timingSuggested = true;
      timingSuggestionSource = 'reference';
    }
  }

  // If oral medicine's usual time is bedtime or night and frequency is "once a day" with no time
  if (
    oral &&
    refEntry &&
    normFreq.isOnceDailyUnspecifiedTime &&
    (refEntry.usualTimeOfDay === 'bedtime' || refEntry.usualTimeOfDay === 'night')
  ) {
    if (refEntry.usualTimeOfDay === 'bedtime') {
      schedule = { morning: 0, afternoon: 0, night: 0, bedtime: 1 };
      canonicalFreq = '0-0-0-1';
    } else {
      schedule = { morning: 0, afternoon: 0, night: 1, bedtime: 0 };
      canonicalFreq = '0-0-1';
    }
    scheduleSuggested = true;
  }

  const timingConflict = oral ? detectTimingConflict(refEntry, schedule, explicitTiming) : null;

  return {
    ...m,
    id: `med_${Date.now()}_${idx}`,
    name: m.name || '',
    form: resolvedForm,
    applicationArea: inferred.inferredArea || m.applicationArea || null,
    formCorrected: inferred.formCorrected || m.formCorrected || false,
    isAmbiguousForm: inferred.isAmbiguousForm || m.isAmbiguousForm || false,
    userEditedForm: false,
    frequency: canonicalFreq,
    frequencyCode: canonicalFreq || null,
    doseSchedule: schedule,
    specialFreqCode: normFreq.specialCode,
    everyHours: normFreq.everyHours,
    timing: resolvedTiming,
    timingSuggested,
    timingSuggestionSource,
    userEditedTiming: false,
    scheduleSuggested,
    timingConflict,
    flags,
    isFlagged,
    isCheckedByUser: !isFlagged,
  };
}

export const ReviewMedicinesScreen: React.FC<ReviewMedicinesScreenProps> = ({
  imageBase64,
  isPrescription = true,
  imageQuality = 'good',
  warnings = [],
  doctorName: initialDoctor = '',
  clinic: initialClinic = '',
  doctorRegistrationNumber,
  patientName,
  patientAge,
  patientSex,
  prescriptionDate: initialDate = '',
  followUp,
  notes: initialNotes = '',
  medicines: initialMedicines,
  readingFailed = false,
  errorMessage = '',
  language = SUPPORTED_LANGUAGES[0],
  onRetryReading,
  onConfirm,
  onCancel,
}) => {
  const langCode = toSupportedLang(language.code);
  const labels = REVIEW_CARD_LABELS[langCode];
  const isUrdu = langCode === 'ur';

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const [doctorName, setDoctorName] = useState(initialDoctor || '');
  const [clinic, setClinic] = useState(initialClinic || '');

  // Initialize medicines strictly preserving uncertainties while applying frequency normalization & reference timings
  const [meds, setMeds] = useState<EditableMedicine[]>(() =>
    initialMedicines.map((m, idx) => initializeEditableMedicine(m, idx))
  );

  // Per-card UI state for "Type a custom pattern"
  const [openCustomId, setOpenCustomId] = useState<string | null>(null);
  const [customDrafts, setCustomDrafts] = useState<Record<string, string>>({});
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});

  // Manual medicine form (starts empty — never defaults to Tablet)
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedStrength, setNewMedStrength] = useState('');
  const [newMedForm, setNewMedForm] = useState<MedicineFormId | ''>('');
  const [newMedArea, setNewMedArea] = useState<string>('affected_area');
  const [newMedDose, setNewMedDose] = useState('');
  const [newMedFreq, setNewMedFreq] = useState('1-0-1');
  const [newMedTiming, setNewMedTiming] = useState('unspecified');
  const [newMedDays, setNewMedDays] = useState(5);

  // Priority (c) Gemini Fallback: For unknown ORAL medicines not in reference, with confidence >= 0.85
  useEffect(() => {
    const abortController = new AbortController();

    meds.forEach((med) => {
      if (!isOralForm(med.form)) return;
      const hasWrittenTiming = med.timing !== 'unspecified' || med.userEditedTiming;
      const inReference = !!lookupDrugTimingReference(med.name, med.genericName);
      const flags = med.flags || [];
      const highConfClean =
        med.confidence >= 0.85 &&
        !med.illegible &&
        !flags.includes('name_uncertain') &&
        !flags.includes('look_alike_risk') &&
        med.name.trim().length >= 3;

      if (!hasWrittenTiming && !inReference && !med.timingSuggested && highConfClean) {
        suggestFoodTimingWithGemini(med.name, med.genericName, abortController.signal).then(
          (suggested) => {
            if (!suggested || suggested === 'unspecified' || abortController.signal.aborted) return;
            setMeds((prev) =>
              prev.map((item) => {
                if (item.id !== med.id) return item;
                if (!isOralForm(item.form) || item.userEditedTiming || item.timing !== 'unspecified') {
                  return item;
                }
                return {
                  ...item,
                  timing: suggested,
                  timingSuggested: true,
                  timingSuggestionSource: 'ai',
                };
              })
            );
          }
        );
      }
    });

    return () => abortController.abort();
    // Run once on initial extracted items mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleZoomIn = () => setZoom((z) => Math.min(3, z + 0.25));
  const handleZoomOut = () => setZoom((z) => Math.max(0.75, z - 0.25));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const updateMedicine = (id: string, updates: Partial<EditableMedicine>) => {
    setMeds((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  };

  const deleteMedicine = (id: string) => {
    setMeds((prev) => prev.filter((m) => m.id !== id));
  };

  const handleSlotChange = (
    med: EditableMedicine,
    slot: 'morning' | 'afternoon' | 'night' | 'bedtime',
    nextVal: number
  ) => {
    const nextSchedule = {
      ...med.doseSchedule,
      [slot]: nextVal,
    };
    const nextCode = scheduleToCode(nextSchedule);
    const refEntry = lookupDrugTimingReference(med.name, med.genericName);
    const nextConflict = detectTimingConflict(
      refEntry,
      nextSchedule,
      normalizeTimingValue(med.timing)
    );

    updateMedicine(med.id, {
      doseSchedule: nextSchedule,
      specialFreqCode: null,
      everyHours: null,
      asNeeded: false,
      frequency: nextCode,
      frequencyCode: nextCode,
      scheduleSuggested: false,
      timingConflict: nextConflict,
    });
  };

  const handleApplyCustomPattern = (med: EditableMedicine) => {
    const rawPattern = (customDrafts[med.id] || '').trim();
    const parsed = normalizeHandwritingFrequency(rawPattern, null, false);
    if (!rawPattern || !parsed.isValid) {
      setCustomErrors((prev) => ({
        ...prev,
        [med.id]: labels.customPatternError,
      }));
      return;
    }

    const refEntry = lookupDrugTimingReference(med.name, med.genericName);
    const nextConflict = detectTimingConflict(
      refEntry,
      parsed.schedule,
      normalizeTimingValue(med.timing)
    );

    setCustomErrors((prev) => {
      const next = { ...prev };
      delete next[med.id];
      return next;
    });

    updateMedicine(med.id, {
      doseSchedule: parsed.schedule,
      specialFreqCode: parsed.specialCode,
      everyHours: parsed.everyHours,
      asNeeded: parsed.specialCode === 'sos',
      frequency: parsed.canonicalCode,
      frequencyCode: parsed.canonicalCode,
      scheduleSuggested: false,
      timingConflict: nextConflict,
    });
    setOpenCustomId(null);
  };

  const handleSelectFoodTiming = (med: EditableMedicine, timingValue: string) => {
    const refEntry = lookupDrugTimingReference(med.name, med.genericName);
    const nextConflict = detectTimingConflict(refEntry, med.doseSchedule, timingValue);

    // One tap changes/confirms timing and clears the pending review tag immediately
    updateMedicine(med.id, {
      timing: timingValue,
      timingSuggested: false,
      timingSuggestionSource: undefined,
      userEditedTiming: true,
      timingConflict: nextConflict,
    });
  };

  const handleSelectForm = (med: EditableMedicine, nextFormId: MedicineFormId) => {
    const oral = isOralForm(nextFormId);
    const topical = isTopicalForm(nextFormId);

    let nextTiming = oral ? med.timing || 'unspecified' : 'unspecified';
    let nextTimingSuggested = oral ? med.timingSuggested : false;
    let nextTimingSource = oral ? med.timingSuggestionSource : undefined;
    let nextConflict: TimingConflictType = null;

    if (oral) {
      const refEntry = lookupDrugTimingReference(med.name, med.genericName);
      if (nextTiming === 'unspecified' && refEntry && !med.userEditedTiming) {
        const refVal = referenceFoodTimingToUiValue(refEntry.foodTiming);
        if (refVal !== 'unspecified') {
          nextTiming = refVal;
          nextTimingSuggested = true;
          nextTimingSource = 'reference';
        }
      }
      nextConflict = detectTimingConflict(refEntry, med.doseSchedule, normalizeTimingValue(nextTiming));
    }

    const nextArea = topical
      ? med.applicationArea || 'affected_area'
      : nextFormId === 'eye_drops'
      ? 'eye'
      : nextFormId === 'ear_drops'
      ? 'ear'
      : nextFormId === 'nasal_drops'
      ? 'nose'
      : null;

    updateMedicine(med.id, {
      form: nextFormId,
      userEditedForm: true,
      isAmbiguousForm: false,
      applicationArea: nextArea,
      timing: nextTiming,
      timingSuggested: nextTimingSuggested,
      timingSuggestionSource: nextTimingSource,
      timingConflict: nextConflict,
    });
  };

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedName.trim() || !newMedForm) return;

    const oral = isOralForm(newMedForm);
    const topical = isTopicalForm(newMedForm);
    const norm = normalizeHandwritingFrequency(newMedFreq.trim(), null, false);
    const newMed: EditableMedicine = {
      id: `manual_${Date.now()}`,
      rawText: '',
      name: newMedName.trim(),
      nameAsRead: null,
      nameCorrected: false,
      genericName: null,
      strength: newMedStrength.trim() || null,
      form: newMedForm,
      applicationArea: topical
        ? newMedArea || 'affected_area'
        : newMedForm === 'eye_drops'
        ? 'eye'
        : newMedForm === 'ear_drops'
        ? 'ear'
        : newMedForm === 'nasal_drops'
        ? 'nose'
        : null,
      userEditedForm: true,
      route: null,
      dose: newMedDose.trim() || null,
      frequencyCode: norm.canonicalCode || newMedFreq.trim() || null,
      frequency: norm.canonicalCode || newMedFreq.trim() || null,
      frequencyPlain: null,
      doseSchedule: norm.schedule,
      specialFreqCode: norm.specialCode,
      everyHours: norm.everyHours,
      timesPerDay: null,
      timing: oral ? newMedTiming : 'unspecified',
      timingSuggested: false,
      userEditedTiming: true,
      scheduleSuggested: false,
      timingConflict: null,
      asNeeded: norm.specialCode === 'sos',
      durationDays: Number(newMedDays) || null,
      durationText: newMedDays ? `${newMedDays} days` : null,
      instructions: null,
      confidence: 1.0,
      illegible: false,
      flags: [],
      isFlagged: false,
      isCheckedByUser: true,
    };

    setMeds((prev) => [...prev, newMed]);
    setNewMedName('');
    setNewMedStrength('');
    setNewMedForm('');
    setNewMedDose('');
    setNewMedTiming('unspecified');
    setShowAddModal(false);
  };

  const unverifiedCount = meds.filter((m) => m.isFlagged && !m.isCheckedByUser).length;
  const hasEmptyName = meds.some((m) => !m.name.trim());
  const hasMissingForm = meds.some((m) => !normalizeFormId(m.form));
  const canConfirm = meds.length > 0 && unverifiedCount === 0 && !hasEmptyName && !hasMissingForm;

  // Non-prescription or Reading Failure State
  if (readingFailed || (!isPrescription && meds.length === 0)) {
    return (
      <div className="flex-1 flex flex-col p-4 bg-[#F9FAFB] items-center justify-center text-center">
        <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-3">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-slate-900">
          {!isPrescription ? 'Not a Medical Prescription' : 'Could Not Read Prescription'}
        </h3>
        <p className="text-xs text-slate-600 max-w-xs mt-1.5 leading-relaxed">
          {!isPrescription && warnings.length > 0
            ? warnings.join(' ')
            : errorMessage ||
              'The image could not be deciphered. It might be too blurry, dark, or not a handwritten prescription.'}
        </p>

        <div className="mt-5 w-full max-w-xs space-y-2.5">
          <button
            onClick={onRetryReading}
            className="w-full h-11 bg-[#1E88E5] hover:bg-blue-600 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Reading with Gemini</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="w-full h-11 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl text-xs flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4 text-[#2E9E6B]" />
            <span>Enter Medicines Manually</span>
          </button>

          <button
            onClick={onCancel}
            className="text-xs text-slate-500 hover:text-slate-700 block w-full py-2"
          >
            Cancel & Retake Photo
          </button>
        </div>

        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl text-left text-slate-800">
              <h4 className="text-sm font-bold text-slate-900 mb-2">Add Medicine Manually</h4>
              <form onSubmit={handleAddManual} className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="Medicine Name (e.g. Paracetamol)"
                  value={newMedName}
                  onChange={(e) => setNewMedName(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-300 rounded-xl text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Strength (e.g. 500 mg)"
                    value={newMedStrength}
                    onChange={(e) => setNewMedStrength(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Frequency (e.g. 1-0-1)"
                    value={newMedFreq}
                    onChange={(e) => setNewMedFreq(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 h-9 bg-slate-100 rounded-xl text-xs text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-9 bg-[#2E9E6B] text-white rounded-xl text-xs font-bold"
                  >
                    Add
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  const foodOptions: {
    value: string;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { value: 'before food', label: labels.beforeFood, icon: <Sunrise className="w-4 h-4 shrink-0" /> },
    { value: 'after food', label: labels.afterFood, icon: <Utensils className="w-4 h-4 shrink-0" /> },
    { value: 'with food', label: labels.withFood, icon: <Coffee className="w-4 h-4 shrink-0" /> },
    { value: 'empty stomach', label: labels.emptyStomach, icon: <Clock className="w-4 h-4 shrink-0" /> },
    { value: 'bedtime', label: labels.bedtimeOpt, icon: <BedDouble className="w-4 h-4 shrink-0" /> },
    { value: 'unspecified', label: labels.anytime, icon: <Sun className="w-4 h-4 shrink-0" /> },
  ];

  return (
    <div
      dir={isUrdu ? 'rtl' : 'ltr'}
      style={{ fontFamily: language.fontFamily }}
      className="flex-1 flex flex-col bg-[#F9FAFB] overflow-hidden"
    >
      {/* Top Header */}
      <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-[#2E9E6B] shrink-0" />
            <span className="truncate">{labels.reviewTitle}</span>
          </h3>
          <p className="text-[10px] text-slate-500 truncate">{labels.reviewSubtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
              imageQuality === 'good'
                ? 'bg-emerald-100 text-emerald-800'
                : imageQuality === 'fair'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {imageQuality}
          </span>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-slate-500 hover:text-slate-700 font-medium"
          >
            {labels.cancel}
          </button>
        </div>
      </div>

      {/* PINNED ORIGINAL PRESCRIPTION IMAGE VIEWER ("View original") */}
      <div className="bg-slate-900 p-2.5 border-b border-slate-800 shrink-0" dir="ltr">
        <div className="flex items-center justify-between text-white text-[11px] mb-1.5 px-1">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span>{labels.viewOriginalPhoto}</span>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRotate}
              className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
              title="Rotate 90 degrees"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setRotation(0);
              }}
              className="text-[10px] text-blue-400 hover:underline px-1"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="w-full h-32 bg-black/70 rounded-2xl overflow-hidden relative flex items-center justify-center border border-slate-800">
          <img
            src={imageBase64}
            alt="Original Prescription"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transition: 'transform 0.2s ease-out',
            }}
            className="max-h-full max-w-full object-contain cursor-grab active:cursor-grabbing select-none"
          />
          <div className="absolute bottom-1 left-2 bg-black/60 px-2 py-0.5 rounded text-[9px] text-slate-300 pointer-events-none">
            {labels.zoomHint}
          </div>
        </div>
      </div>

      {/* SCROLLABLE REVIEW CARDS */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* OCR Warnings Banner (e.g., struck-through line ignored, poor image quality) */}
        {warnings.length > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Prescription Notices</span>
            </div>
            <ul className="list-disc pl-5 text-[11px] space-y-0.5">
              {warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Doctor, Clinic & Patient Metadata */}
        <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                Doctor Name
              </label>
              <input
                type="text"
                placeholder={labels.notWritten}
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                className="w-full h-8 px-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                Clinic / Hospital
              </label>
              <input
                type="text"
                placeholder={labels.notWritten}
                value={clinic}
                onChange={(e) => setClinic(e.target.value)}
                className="w-full h-8 px-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          {(doctorRegistrationNumber || patientName || patientAge || patientSex || initialDate) && (
            <div className="pt-1.5 border-t border-slate-100 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-600">
              {doctorRegistrationNumber && (
                <span>
                  Reg No: <strong>{doctorRegistrationNumber}</strong>
                </span>
              )}
              {patientName && (
                <span>
                  Patient: <strong>{patientName}</strong>
                </span>
              )}
              {patientAge && (
                <span>
                  Age: <strong>{patientAge}</strong>
                </span>
              )}
              {patientSex && (
                <span>
                  Sex: <strong>{patientSex}</strong>
                </span>
              )}
              {initialDate && (
                <span>
                  Date: <strong>{initialDate}</strong>
                </span>
              )}
            </div>
          )}

          {(followUp?.text || initialNotes) && (
            <div className="pt-1.5 border-t border-slate-100 space-y-1 text-[11px]">
              {followUp?.text && (
                <div className="flex items-center gap-1.5 text-blue-700 font-semibold">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Follow-up: {followUp.text}
                    {followUp.days ? ` (${followUp.days} days)` : ''}
                  </span>
                </div>
              )}
              {initialNotes && (
                <div className="flex items-start gap-1.5 text-slate-600">
                  <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>Notes: {initialNotes}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Medicines Section Header */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-bold text-slate-800">
            {labels.medicinesExtracted(meds.length)}
          </span>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="text-[11px] text-[#1E88E5] font-semibold flex items-center gap-1 hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{labels.addMedicine}</span>
          </button>
        </div>

        {meds.length === 0 ? (
          <div className="p-6 bg-white rounded-2xl border border-dashed border-slate-300 text-center text-slate-500">
            <p className="text-xs font-semibold">No medicines transcribed yet.</p>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="mt-2 text-xs text-[#1E88E5] font-bold underline"
            >
              {labels.addMedicine}
            </button>
          </div>
        ) : (
          meds.map((med) => {
            const pct = Math.round(med.confidence * 100);
            const isHigh = med.confidence >= 0.9;
            const isMedium = med.confidence >= 0.6 && med.confidence < 0.9;
            const isLow = med.confidence < 0.6 || med.illegible;
            const flags = med.flags || [];

            const formId = normalizeFormId(med.form);
            const formDef = formId ? getMedicineFormDef(formId) : null;
            const formMissing = !formId;
            const isOral = isOralForm(formId);
            const isTopical = isTopicalForm(formId);
            const isDrops = isDropsForm(formId);

            // Individual field red outline indicators for empty / uncertain fields
            const nameUncertain =
              !med.name.trim() ||
              flags.includes('name_uncertain') ||
              flags.includes('look_alike_risk') ||
              med.illegible;
            const strengthUncertain =
              !med.strength?.trim() || flags.includes('strength_uncertain');
            const doseUncertain =
              !isTopical && (!med.dose?.trim() || flags.includes('dose_missing'));
            const durationUncertain =
              (!med.durationDays && !med.durationText) || flags.includes('duration_missing');

            const hasActiveFreq =
              med.doseSchedule.morning > 0 ||
              med.doseSchedule.afternoon > 0 ||
              med.doseSchedule.night > 0 ||
              med.doseSchedule.bedtime > 0 ||
              !!med.specialFreqCode ||
              !!med.everyHours;
            const freqUncertain = !hasActiveFreq || flags.includes('frequency_missing');

            const currentTiming = isOral ? normalizeTimingValue(med.timing) : 'unspecified';
            const timingUncertain =
              isOral && currentTiming === 'unspecified' && flags.includes('timing_missing');

            // Form-aware plain-language sentence shared across Review, Today, Reminders, and Translations
            const plainFreqSentence = buildMedicineSentenceFromTemplate(
              {
                form: formId || undefined,
                applicationArea: med.applicationArea || undefined,
                dose: med.dose || undefined,
                frequency: med.frequency || '',
                doseSchedule: med.doseSchedule,
                asNeeded: med.specialFreqCode === 'sos' || med.asNeeded,
                timing: isOral ? med.timing || 'unspecified' : 'unspecified',
                durationDays: med.durationDays ?? undefined,
                durationText: med.durationText || undefined,
              },
              langCode
            );

            const dosePlaceholder =
              isTopical && formId !== 'patch'
                ? labels.applyThinLayerPlaceholder
                : formDef?.dosePlaceholder || labels.notWritten;

            const chipConfigs: {
              key: 'morning' | 'afternoon' | 'night' | 'bedtime';
              label: string;
              icon: React.ReactNode;
              qty: number;
            }[] = [
              {
                key: 'morning',
                label: labels.morning,
                icon: <Sunrise className="w-3.5 h-3.5 text-amber-500" />,
                qty: med.doseSchedule.morning,
              },
              {
                key: 'afternoon',
                label: labels.afternoon,
                icon: <Sun className="w-3.5 h-3.5 text-orange-500" />,
                qty: med.doseSchedule.afternoon,
              },
              {
                key: 'night',
                label: labels.night,
                icon: <Moon className="w-3.5 h-3.5 text-indigo-600" />,
                qty: med.doseSchedule.night,
              },
              {
                key: 'bedtime',
                label: labels.bedtime,
                icon: <BedDouble className="w-3.5 h-3.5 text-blue-600" />,
                qty: med.doseSchedule.bedtime,
              },
            ];

            return (
              <div
                key={med.id}
                className={`p-4 bg-white rounded-3xl shadow-xs space-y-3.5 ${
                  formMissing
                    ? 'border-2 border-red-400'
                    : 'border border-slate-200'
                }`}
              >
                {/* 1. MEDICINE NAME & CONFIDENCE BADGE */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      placeholder="Enter medicine name *"
                      value={med.name}
                      onChange={(e) => {
                        const nextName = e.target.value;
                        const refEntry = isOral
                          ? lookupDrugTimingReference(nextName, med.genericName)
                          : null;
                        const nextConflict = isOral
                          ? detectTimingConflict(refEntry, med.doseSchedule, currentTiming)
                          : null;
                        updateMedicine(med.id, {
                          name: nextName,
                          timingConflict: nextConflict,
                        });
                      }}
                      className={`flex-1 min-w-0 h-10 px-3 rounded-xl text-sm font-bold text-slate-900 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#1E88E5] ${
                        nameUncertain
                          ? 'border-2 border-red-400'
                          : 'border border-slate-200'
                      }`}
                    />

                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
                        isHigh
                          ? 'bg-emerald-100 text-emerald-800'
                          : isMedium
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {isLow ? labels.lowConfidence(pct) : labels.confidencePct(pct)}
                    </span>
                  </div>

                  {med.genericName && (
                    <div className="text-[11px] text-slate-500 px-1">
                      Generic: <strong className="text-slate-700">{med.genericName}</strong>
                    </div>
                  )}
                </div>

                {/* 1b. FORM DROPDOWN (GROUPED BY CATEGORY, NO TABLET DEFAULT) */}
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                    {labels.formLabel} *
                  </label>
                  <MedicineFormSelect
                    value={formId}
                    onChange={(nextFormId) => handleSelectForm(med, nextFormId)}
                    langCode={langCode}
                    hasError={formMissing}
                    helperText={
                      formMissing && med.isAmbiguousForm ? labels.pleaseSelectForm : undefined
                    }
                  />
                </div>

                {/* Optional "Where to apply" for topical forms */}
                {isTopical && (
                  <div className="p-2.5 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-700 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#1E88E5]" />
                      <span>{labels.whereToApply}</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {TOPICAL_APPLICATION_AREAS.map((area) => {
                        const isSelected = (med.applicationArea || 'affected_area') === area.id;
                        return (
                          <button
                            key={area.id}
                            type="button"
                            onClick={() =>
                              updateMedicine(med.id, { applicationArea: area.id })
                            }
                            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#1E88E5] text-white border-[#1E88E5] shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-[#1E88E5]'
                            }`}
                          >
                            {area.label[langCode]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Eye / Ear / Nose selector for Drops */}
                {isDrops && (
                  <div className="p-2.5 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-700 block">
                      {labels.dropsWhereLabel}
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {DROPS_APPLICATION_SITES.map((site) => {
                        const isSelected = formId === site.formId;
                        return (
                          <button
                            key={site.formId}
                            type="button"
                            onClick={() => handleSelectForm(med, site.formId)}
                            className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#1E88E5] text-white border-[#1E88E5] shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-[#1E88E5]'
                            }`}
                          >
                            {site.label[langCode]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. STRENGTH, DOSE, DURATION */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                      {labels.strength}
                    </label>
                    <input
                      type="text"
                      placeholder={labels.notWritten}
                      value={med.strength || ''}
                      onChange={(e) => updateMedicine(med.id, { strength: e.target.value || null })}
                      className={`w-full h-9 px-2.5 bg-slate-50 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1E88E5] ${
                        strengthUncertain
                          ? 'border-2 border-red-400'
                          : 'border border-slate-200'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                      {labels.dose}
                    </label>
                    <input
                      type="text"
                      placeholder={dosePlaceholder}
                      value={med.dose || ''}
                      onChange={(e) => updateMedicine(med.id, { dose: e.target.value || null })}
                      className={`w-full h-9 px-2.5 bg-slate-50 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1E88E5] ${
                        doseUncertain
                          ? 'border-2 border-red-400'
                          : 'border border-slate-200'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                      {labels.durationDays}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      placeholder={med.durationText || labels.daysPlaceholder}
                      value={med.durationDays ?? ''}
                      onChange={(e) =>
                        updateMedicine(med.id, {
                          durationDays: e.target.value ? parseInt(e.target.value, 10) : null,
                        })
                      }
                      className={`w-full h-9 px-2.5 bg-slate-50 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1E88E5] ${
                        durationUncertain
                          ? 'border-2 border-red-400'
                          : 'border border-slate-200'
                      }`}
                    />
                  </div>
                </div>

                {/* 3. FREQUENCY: 4 CHIPS WITH STEPPERS (0, 0.5, 1, 1.5, 2, 3) + PLAIN SENTENCE */}
                <div
                  className={`p-3 rounded-2xl bg-slate-50/70 space-y-2.5 ${
                    freqUncertain ? 'border-2 border-red-400' : 'border border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-700">
                      {labels.frequencyLabel}
                    </span>
                    {med.scheduleSuggested && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[#1E88E5] border border-blue-200">
                        {labels.suggestedBadge}
                      </span>
                    )}
                  </div>

                  {/* 4 Chips: Morning, Afternoon, Night, Bedtime with 0, 0.5, 1, 1.5, 2, 3 Stepper */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {chipConfigs.map((chip) => {
                      const isActive = chip.qty > 0;
                      return (
                        <div
                          key={chip.key}
                          className={`rounded-2xl p-2 border transition-all flex flex-col justify-between gap-1.5 ${
                            isActive
                              ? 'bg-blue-50 border-[#1E88E5] shadow-xs'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              handleSlotChange(med, chip.key, isActive ? 0 : 1)
                            }
                            className="flex items-center justify-center gap-1.5 w-full text-center cursor-pointer"
                          >
                            {chip.icon}
                            <span
                              className={`text-xs font-bold ${
                                isActive ? 'text-[#1E88E5]' : 'text-slate-700'
                              }`}
                            >
                              {chip.label}
                            </span>
                          </button>

                          {/* Quantity Stepper: 0, 0.5, 1, 1.5, 2, 3 */}
                          <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200/90 px-1 py-0.5">
                            <button
                              type="button"
                              aria-label={`Decrease ${chip.label}`}
                              disabled={chip.qty <= 0}
                              onClick={() =>
                                handleSlotChange(med, chip.key, stepValue(chip.qty, -1))
                              }
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span
                              dir="ltr"
                              className={`text-xs font-extrabold tabular-nums ${
                                isActive ? 'text-[#1E88E5]' : 'text-slate-400'
                              }`}
                            >
                              {chip.qty}
                            </span>
                            <button
                              type="button"
                              aria-label={`Increase ${chip.label}`}
                              disabled={chip.qty >= 3}
                              onClick={() =>
                                handleSlotChange(med, chip.key, stepValue(chip.qty, 1))
                              }
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Readable Plain-Language Sentence directly under the chips */}
                  <div className="px-3 py-2 bg-white rounded-xl border border-slate-200/80 text-xs font-bold text-slate-900">
                    {plainFreqSentence}
                  </div>

                  {/* Small "Type a custom pattern" option */}
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        if (openCustomId === med.id) {
                          setOpenCustomId(null);
                        } else {
                          setOpenCustomId(med.id);
                          setCustomDrafts((prev) => ({
                            ...prev,
                            [med.id]: prev[med.id] ?? '',
                          }));
                        }
                      }}
                      className="text-[11px] font-semibold text-[#1E88E5] hover:underline inline-flex items-center gap-1"
                    >
                      <Keyboard className="w-3.5 h-3.5" />
                      <span>{labels.typeCustomPattern}</span>
                    </button>

                    {openCustomId === med.id && (
                      <div className="mt-2 space-y-1.5">
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            dir="ltr"
                            placeholder={labels.customPatternPlaceholder}
                            value={customDrafts[med.id] ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomDrafts((prev) => ({ ...prev, [med.id]: val }));
                              if (customErrors[med.id]) {
                                setCustomErrors((prev) => {
                                  const next = { ...prev };
                                  delete next[med.id];
                                  return next;
                                });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleApplyCustomPattern(med);
                              }
                            }}
                            className="flex-1 h-9 px-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#1E88E5] focus:outline-none font-sans"
                          />
                          <button
                            type="button"
                            onClick={() => handleApplyCustomPattern(med)}
                            className="px-3 h-9 bg-[#1E88E5] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shrink-0"
                          >
                            {labels.applyPattern}
                          </button>
                        </div>
                        {customErrors[med.id] && (
                          <div className="text-[11px] text-red-600 font-semibold">
                            {customErrors[med.id]}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. FOOD TIMING OPTIONS (ONLY FOR ORAL FORMS) */}
                {isOral ? (
                  <div
                    className={`p-3 rounded-2xl bg-slate-50/70 space-y-2 ${
                      timingUncertain ? 'border-2 border-red-400' : 'border border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-700">
                        {labels.foodTimingLabel}
                      </span>

                      {med.timingSuggested && (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                            med.timingSuggestionSource === 'ai'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-blue-50 text-[#1E88E5] border border-blue-200'
                          }`}
                        >
                          {med.timingSuggestionSource === 'ai' && (
                            <Sparkles className="w-3 h-3 shrink-0" />
                          )}
                          <span>
                            {med.timingSuggestionSource === 'ai'
                              ? labels.aiSuggestedTag
                              : labels.suggestedTag}
                          </span>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {foodOptions.map((opt) => {
                        const isSelected = currentTiming === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleSelectFoodTiming(med, opt.value)}
                            className={`min-h-[44px] px-2.5 py-2 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all text-left cursor-pointer ${
                              isSelected
                                ? 'bg-[#2E9E6B] text-white border-[#2E9E6B] shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span className={isSelected ? 'text-white' : 'text-[#1E88E5]'}>
                              {opt.icon}
                            </span>
                            <span className="leading-tight">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Quiet reference conflict note (never overrides written prescription) */}
                    {med.timingConflict && (
                      <div className="text-[11px] text-amber-800 bg-amber-50/80 border border-amber-200/80 rounded-xl px-2.5 py-1.5 flex items-start gap-1.5">
                        <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          {med.timingConflict === 'usually_night'
                            ? labels.usuallyNightConflict
                            : labels.usuallyMorningConflict}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="px-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-600">
                    <span className="font-bold">{labels.foodTimingLabel}</span>
                    <span className="font-semibold text-slate-500">{labels.notRelatedToFood}</span>
                  </div>
                )}

                {/* 5. VERIFICATION CHECKBOX (IF FLAGGED INTERNALLY) + DELETE BUTTON AT END */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  {med.isFlagged ? (
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer flex-1 min-h-[36px]">
                      <input
                        type="checkbox"
                        checked={med.isCheckedByUser}
                        onChange={() =>
                          updateMedicine(med.id, { isCheckedByUser: !med.isCheckedByUser })
                        }
                        className="w-4 h-4 text-[#2E9E6B] rounded border-slate-300 focus:ring-[#2E9E6B]"
                      />
                      <span
                        className={
                          med.isCheckedByUser
                            ? 'font-bold text-[#2E9E6B]'
                            : 'font-semibold text-slate-700'
                        }
                      >
                        {med.isCheckedByUser ? labels.verifiedAgainstRx : labels.checkAgainstRx}
                      </span>
                    </label>
                  ) : (
                    <div />
                  )}

                  <button
                    type="button"
                    onClick={() => deleteMedicine(med.id)}
                    className="min-h-[36px] px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center gap-1 transition-colors shrink-0"
                    title={labels.removeMedicine}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{labels.removeMedicine}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Confirmation Bar */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0 space-y-2">
        {!canConfirm && meds.length > 0 && (
          <div className="text-[11px] text-amber-700 font-semibold text-center flex items-center justify-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              {hasEmptyName
                ? labels.fillAllNames
                : hasMissingForm
                ? labels.selectFormsMissing
                : labels.flaggedRemaining(unverifiedCount)}
            </span>
          </div>
        )}

        <button
          type="button"
          disabled={!canConfirm}
          onClick={() => onConfirm(meds, doctorName, clinic)}
          className={`w-full h-11 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 ${
            canConfirm
              ? 'bg-[#2E9E6B] hover:bg-emerald-700 text-white shadow-emerald-600/25 active:scale-[0.98]'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Check className="w-4 h-4" />
          <span>{labels.confirmAllBtn}</span>
        </button>

        <p className="text-[10px] text-slate-400 text-center leading-tight">
          {labels.footerDisclaimer}
        </p>
      </div>

      {/* Manual Add Medicine Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl text-left text-slate-800 max-h-[88vh] overflow-y-auto">
            <h4 className="text-sm font-bold text-slate-900 mb-2">{labels.addMedicine}</h4>
            <form onSubmit={handleAddManual} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                  Medicine Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paracetamol or Calamine"
                  value={newMedName}
                  onChange={(e) => setNewMedName(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                  {labels.formLabel} *
                </label>
                <MedicineFormSelect
                  value={newMedForm}
                  onChange={(nextForm) => {
                    setNewMedForm(nextForm);
                    if (!isOralForm(nextForm)) {
                      setNewMedTiming('unspecified');
                    }
                  }}
                  langCode={langCode}
                  hasError={!newMedForm}
                  compact
                />
              </div>

              {isTopicalForm(newMedForm) && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {labels.whereToApply}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {TOPICAL_APPLICATION_AREAS.map((area) => (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => setNewMedArea(area.id)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${
                          newMedArea === area.id
                            ? 'bg-[#1E88E5] text-white border-[#1E88E5]'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        {area.label[langCode]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                    {labels.strength}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 650 mg"
                    value={newMedStrength}
                    onChange={(e) => setNewMedStrength(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                    {labels.dose}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      isTopicalForm(newMedForm) && newMedForm !== 'patch'
                        ? labels.applyThinLayerPlaceholder
                        : getMedicineFormDef(newMedForm)?.dosePlaceholder || labels.notWritten
                    }
                    value={newMedDose}
                    onChange={(e) => setNewMedDose(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                    {labels.frequencyLabel}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1-0-1 or BD"
                    value={newMedFreq}
                    onChange={(e) => setNewMedFreq(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                    {labels.durationDays}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newMedDays}
                    onChange={(e) => setNewMedDays(parseInt(e.target.value, 10) || 1)}
                    className="w-full h-9 px-3 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                  {labels.foodTimingLabel}
                </label>
                {isOralForm(newMedForm) ? (
                  <select
                    value={newMedTiming}
                    onChange={(e) => setNewMedTiming(e.target.value)}
                    className="w-full h-9 px-2 border border-slate-300 rounded-xl text-xs"
                  >
                    <option value="after food">{labels.afterFood}</option>
                    <option value="before food">{labels.beforeFood}</option>
                    <option value="empty stomach">{labels.emptyStomach}</option>
                    <option value="with food">{labels.withFood}</option>
                    <option value="bedtime">{labels.bedtimeOpt}</option>
                    <option value="unspecified">{labels.anytime}</option>
                  </select>
                ) : (
                  <div className="h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center text-xs text-slate-500 font-semibold">
                    {labels.notRelatedToFood}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 h-9 bg-slate-100 rounded-xl text-xs text-slate-700 font-semibold"
                >
                  {labels.cancel}
                </button>
                <button
                  type="submit"
                  disabled={!newMedName.trim() || !newMedForm}
                  className={`flex-1 h-9 rounded-xl text-xs font-bold ${
                    newMedName.trim() && newMedForm
                      ? 'bg-[#2E9E6B] text-white'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Add Medicine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
