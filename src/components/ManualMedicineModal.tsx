import React, { useState, useEffect } from 'react';
import { Pill, X, Plus, Save, AlertCircle } from 'lucide-react';
import { StoredMedicine } from '../services/db';
import { MedicineFormSelect } from './MedicineFormSelect';
import {
  normalizeFormId,
  isOralForm,
  isTopicalForm,
  isDropsForm,
  getMedicineFormDef,
  TOPICAL_APPLICATION_AREAS,
  DROPS_APPLICATION_SITES,
  MedicineFormId,
} from '../config/medicineForms';
import { normalizeHandwritingFrequency } from '../utils/frequencyHelper';
import { REVIEW_CARD_LABELS, toSupportedLang } from '../translations/glossary';

interface ManualMedicineModalProps {
  isOpen: boolean;
  userId: string;
  profileId: string;
  prescriptionId?: string;
  initialMedicine?: StoredMedicine | null;
  onClose: () => void;
  onMedicineAdded: (med: StoredMedicine) => void;
  langCode?: string;
}

export const ManualMedicineModal: React.FC<ManualMedicineModalProps> = ({
  isOpen,
  userId,
  profileId,
  prescriptionId,
  initialMedicine = null,
  onClose,
  onMedicineAdded,
  langCode = 'en',
}) => {
  const isEditing = !!initialMedicine;
  const lang = toSupportedLang(langCode);
  const reviewUi = REVIEW_CARD_LABELS[lang];

  const [name, setName] = useState('');
  const [strength, setStrength] = useState('');
  const [form, setForm] = useState<string>('');
  const [applicationArea, setApplicationArea] = useState<string>('');
  const [dose, setDose] = useState('');
  const [frequency, setFrequency] = useState('1-0-1');
  const [timing, setTiming] = useState('after food');
  const [durationDays, setDurationDays] = useState<number>(5);
  const [startTime, setStartTime] = useState('08:30');
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialMedicine) {
        const initFormId = normalizeFormId(initialMedicine.form) || '';
        setName(initialMedicine.name || '');
        setStrength(initialMedicine.strength || '');
        setForm(initFormId);
        setApplicationArea(initialMedicine.applicationArea || '');
        setDose(initialMedicine.dose || '');
        setFrequency(initialMedicine.frequency || '1-0-1');
        setTiming(
          isOralForm(initFormId)
            ? initialMedicine.timing || 'after food'
            : 'unspecified'
        );
        setDurationDays(initialMedicine.durationDays || 5);
        setInstructions(initialMedicine.instructions || '');
      } else {
        setName('');
        setStrength('');
        setForm('');
        setApplicationArea('');
        setDose('');
        setFrequency('1-0-1');
        setTiming('after food');
        setDurationDays(5);
        setStartTime('08:30');
        setInstructions('');
      }
      setError('');
      setFormError(false);
    }
  }, [isOpen, initialMedicine]);

  if (!isOpen) return null;

  const normalizedFormId = normalizeFormId(form);
  const formDef = getMedicineFormDef(normalizedFormId);
  const showOralFoodTiming = isOralForm(normalizedFormId);
  const showTopicalArea = isTopicalForm(normalizedFormId);
  const showDropsSite = isDropsForm(normalizedFormId || form);

  const handleFormChange = (nextForm: MedicineFormId) => {
    setForm(nextForm);
    setFormError(false);
    if (error) setError('');

    if (isTopicalForm(nextForm) && !applicationArea) {
      setApplicationArea('affected_area');
    } else if (nextForm === 'eye_drops') {
      setApplicationArea('eye');
    } else if (nextForm === 'ear_drops') {
      setApplicationArea('ear');
    } else if (nextForm === 'nasal_drops') {
      setApplicationArea('nose');
    } else if (!isTopicalForm(nextForm) && !isDropsForm(nextForm)) {
      setApplicationArea('');
    }

    if (!isOralForm(nextForm)) {
      setTiming('unspecified');
    } else if (!timing || timing === 'unspecified') {
      setTiming('after food');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter medicine name.');
      return;
    }

    if (!normalizedFormId) {
      setFormError(true);
      setError(reviewUi.pleaseSelectForm);
      return;
    }

    const normFreq = normalizeHandwritingFrequency(
      frequency,
      null,
      /sos|prn/i.test(frequency)
    );
    const effectiveArea = isTopicalForm(normalizedFormId)
      ? applicationArea || (normalizedFormId === 'shampoo' ? 'scalp' : 'affected_area')
      : isDropsForm(normalizedFormId)
      ? normalizedFormId === 'eye_drops'
        ? 'eye'
        : normalizedFormId === 'ear_drops'
        ? 'ear'
        : 'nose'
      : undefined;

    const effectiveTiming = isOralForm(normalizedFormId)
      ? timing || 'unspecified'
      : 'unspecified';

    const savedMed: StoredMedicine = initialMedicine
      ? {
          ...initialMedicine,
          name: name.trim(),
          strength: strength.trim() || undefined,
          form: normalizedFormId,
          applicationArea: effectiveArea,
          dose: dose.trim() || undefined,
          frequency: normFreq.canonicalCode || frequency,
          doseSchedule: normFreq.isValid ? normFreq.schedule : initialMedicine.doseSchedule,
          asNeeded: normFreq.specialCode === 'sos' || /sos|prn/i.test(frequency),
          timing: effectiveTiming,
          timingSuggested: isOralForm(normalizedFormId) ? initialMedicine.timingSuggested : false,
          durationDays: durationDays > 0 ? durationDays : undefined,
          instructions: instructions.trim() || undefined,
        }
      : {
          id: `med_manual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          prescriptionId: prescriptionId || `rx_manual_${Date.now()}`,
          userId,
          profileId,
          name: name.trim(),
          strength: strength.trim() || undefined,
          form: normalizedFormId,
          applicationArea: effectiveArea,
          dose: dose.trim() || undefined,
          frequency: normFreq.canonicalCode || frequency,
          doseSchedule: normFreq.isValid ? normFreq.schedule : undefined,
          asNeeded: normFreq.specialCode === 'sos' || /sos|prn/i.test(frequency),
          timing: effectiveTiming,
          durationDays: durationDays > 0 ? durationDays : undefined,
          instructions: instructions.trim() || undefined,
          confidence: 1.0,
          illegible: false,
          confirmed: true,
          createdAt: new Date().toISOString(),
        };

    onMedicineAdded(savedMed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl text-slate-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-[#2E9E6B] flex items-center justify-center">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isEditing ? 'Edit Medicine Details' : 'Add Medicine (Offline Ready)'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isEditing
                  ? 'Updating refreshes cached translations automatically'
                  : 'Manual entry without internet requirement'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Medicine Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Paracetamol or Calamine"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-[#1E88E5] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Strength
              </label>
              <input
                type="text"
                placeholder="e.g. 500 mg, 1%"
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-[#1E88E5] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {reviewUi.formLabel} *
              </label>
              <MedicineFormSelect
                value={normalizedFormId}
                onChange={handleFormChange}
                langCode={lang}
                hasError={formError || !normalizedFormId}
              />
            </div>
          </div>

          {!normalizedFormId && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700 font-semibold">
              {reviewUi.pleaseSelectForm}
            </div>
          )}

          {/* Topical "Where to apply" pills */}
          {showTopicalArea && normalizedFormId !== 'patch' && (
            <div className="p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1.5">
              <label className="block text-[11px] font-bold text-emerald-900">
                {reviewUi.whereToApply}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TOPICAL_APPLICATION_AREAS.map((area) => {
                  const active = (applicationArea || 'affected_area') === area.id;
                  return (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => setApplicationArea(area.id)}
                      className={`px-2.5 min-h-[36px] rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                        active
                          ? 'bg-[#2E9E6B] text-white border-[#2E9E6B] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      {area.label[lang]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Drops site selector (Eye / Ear / Nose) */}
          {showDropsSite && (
            <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-1.5">
              <label className="block text-[11px] font-bold text-blue-900">
                {reviewUi.dropsWhereLabel}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {DROPS_APPLICATION_SITES.map((site) => {
                  const active = normalizedFormId === site.formId;
                  return (
                    <button
                      key={site.formId}
                      type="button"
                      onClick={() => handleFormChange(site.formId)}
                      className={`px-3 min-h-[36px] rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                        active
                          ? 'bg-[#1E88E5] text-white border-[#1E88E5] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      {site.label[lang]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Dose Amount
              </label>
              <input
                type="text"
                placeholder={
                  isTopicalForm(normalizedFormId) && normalizedFormId !== 'patch'
                    ? reviewUi.applyThinLayerPlaceholder
                    : formDef?.dosePlaceholder || 'e.g. 1 tablet or 5 ml'
                }
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-[#1E88E5] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-[#1E88E5] focus:outline-none"
              >
                <option value="1-0-1">Twice daily (Morning &amp; Night)</option>
                <option value="1-0-0">Once daily (Morning)</option>
                <option value="0-0-1">Once daily (Night)</option>
                <option value="1-1-1">Three times daily</option>
                <option value="SOS">Only when needed (SOS)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Timing
              </label>
              {showOralFoodTiming ? (
                <select
                  value={timing}
                  onChange={(e) => setTiming(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-[#1E88E5] focus:outline-none"
                >
                  <option value="after food">{reviewUi.afterFood}</option>
                  <option value="before food">{reviewUi.beforeFood}</option>
                  <option value="with food">{reviewUi.withFood}</option>
                  <option value="empty stomach">{reviewUi.emptyStomach}</option>
                  <option value="bedtime">{reviewUi.bedtimeOpt}</option>
                  <option value="unspecified">{reviewUi.anytime}</option>
                </select>
              ) : (
                <div className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-500 flex items-center text-[11px]">
                  {reviewUi.notRelatedToFood}
                </div>
              )}
            </div>

            {!isEditing ? (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  First Reminder Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-[#1E88E5] focus:outline-none"
                />
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Course Duration (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={durationDays}
                  onChange={(e) => setDurationDays(parseInt(e.target.value, 10) || 1)}
                  className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-[#1E88E5] focus:outline-none"
                />
              </div>
            )}
          </div>

          {!isEditing && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Course Duration (Days)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={durationDays}
                onChange={(e) => setDurationDays(parseInt(e.target.value, 10) || 1)}
                className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-[#1E88E5] focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Special Notes / Doctor Instructions
            </label>
            <input
              type="text"
              placeholder={
                isTopicalForm(normalizedFormId)
                  ? 'e.g. Apply a thin layer on affected area twice daily for 5 days'
                  : 'e.g. Take 1 tablet twice daily for 5 days with water'
              }
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-[#1E88E5] focus:outline-none"
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 h-11 bg-[#2E9E6B] hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              {isEditing ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{isEditing ? 'Save Changes' : 'Confirm & Save'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
