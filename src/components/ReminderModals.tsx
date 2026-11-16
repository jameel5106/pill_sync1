import React, { useState, useEffect } from 'react';
import {
  AlarmClock,
  Bell,
  BellOff,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Info,
  PauseCircle,
  Plus,
  RefreshCw,
  Shield,
  SkipForward,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { MealTimesConfig, StoredMedicine, StoredReminder } from '../services/db';
import {
  DEFAULT_MEAL_TIMES,
  addLocalDays,
  getDefaultFirstDoseSelection,
  getLocalDateStr,
  validateCustomReminderForm,
} from '../services/reminderScheduler';

// ---------------------------------------------------------------------------
// 1. FIRST-DOSE & MISSING-DURATION PROMPT ON PRESCRIPTION CONFIRMATION
// ---------------------------------------------------------------------------

export interface ConfirmScheduleDecision {
  startDate: string;
  firstDoseTime: string;
  ongoingByMedicineTempId: Record<string, boolean>;
  durationOverrideByMedicineTempId: Record<string, number | undefined>;
  importantByMedicineTempId: Record<string, boolean>;
}

interface ConfirmScheduleModalProps {
  isOpen: boolean;
  pendingMeds: any[];
  mealTimes: MealTimesConfig;
  onCancel: () => void;
  onConfirmSchedule: (decision: ConfirmScheduleDecision) => void;
}

export const ConfirmScheduleModal: React.FC<ConfirmScheduleModalProps> = ({
  isOpen,
  pendingMeds,
  mealTimes,
  onCancel,
  onConfirmSchedule,
}) => {
  const defaultFirst = getDefaultFirstDoseSelection(mealTimes || DEFAULT_MEAL_TIMES);
  const todayStr = getLocalDateStr();
  const tomorrowStr = addLocalDays(todayStr, 1);

  const [startDate, setStartDate] = useState(defaultFirst.startDate);
  const [firstDoseTime, setFirstDoseTime] = useState(defaultFirst.firstDoseTime);
  const [presetMode, setPresetMode] = useState<'next' | 'tomorrow' | 'custom'>('next');
  const [ongoingMap, setOngoingMap] = useState<Record<string, boolean>>({});
  const [durationMap, setDurationMap] = useState<Record<string, number | undefined>>({});
  const [importantMap, setImportantMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      const fresh = getDefaultFirstDoseSelection(mealTimes || DEFAULT_MEAL_TIMES);
      setStartDate(fresh.startDate);
      setFirstDoseTime(fresh.firstDoseTime);
      setPresetMode('next');
      const initOngoing: Record<string, boolean> = {};
      const initDur: Record<string, number | undefined> = {};
      pendingMeds.forEach((m, idx) => {
        const key = m.tempId || String(idx);
        if (!m.durationDays) {
          initOngoing[key] = true;
        } else {
          initDur[key] = m.durationDays;
        }
      });
      setOngoingMap(initOngoing);
      setDurationMap(initDur);
      setImportantMap({});
    }
  }, [isOpen, pendingMeds, mealTimes]);

  if (!isOpen) return null;

  const missingDurationMeds = pendingMeds
    .map((m, idx) => ({ med: m, key: m.tempId || String(idx) }))
    .filter(({ med }) => !med.durationDays && !med.asNeeded);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl text-slate-800 max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-100 text-[#1E88E5] flex items-center justify-center">
              <AlarmClock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Set Automatic Reminders</h3>
              <p className="text-[11px] text-slate-500">
                Built from your prescription doses &amp; meal times
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close reminder confirmation"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* First dose prompt */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-900">
            When will you take the first dose?
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            <button
              type="button"
              onClick={() => {
                const d = getDefaultFirstDoseSelection(mealTimes || DEFAULT_MEAL_TIMES);
                setStartDate(d.startDate);
                setFirstDoseTime(d.firstDoseTime);
                setPresetMode('next');
              }}
              className={`p-3 rounded-2xl border text-left text-xs flex items-center justify-between transition-all ${
                presetMode === 'next'
                  ? 'bg-blue-50 border-[#1E88E5] text-[#1E88E5] font-bold'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <span>Next upcoming slot ({defaultFirst.slotLabel})</span>
              <span className="font-mono text-[11px]">
                {defaultFirst.startDate === todayStr ? 'Today' : defaultFirst.startDate} • {defaultFirst.firstDoseTime}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStartDate(tomorrowStr);
                setFirstDoseTime(mealTimes?.breakfast || '08:00');
                setPresetMode('tomorrow');
              }}
              className={`p-3 rounded-2xl border text-left text-xs flex items-center justify-between transition-all ${
                presetMode === 'tomorrow'
                  ? 'bg-blue-50 border-[#1E88E5] text-[#1E88E5] font-bold'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <span>Tomorrow morning</span>
              <span className="font-mono text-[11px]">
                {tomorrowStr} • {mealTimes?.breakfast || '08:00'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPresetMode('custom')}
              className={`p-3 rounded-2xl border text-left text-xs flex items-center justify-between transition-all ${
                presetMode === 'custom'
                  ? 'bg-blue-50 border-[#1E88E5] text-[#1E88E5] font-bold'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <span>Choose another date &amp; first-dose time</span>
              <Calendar className="w-4 h-4" />
            </button>
          </div>

          {presetMode === 'custom' && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-10 px-2.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                  First Dose Time
                </label>
                <input
                  type="time"
                  value={firstDoseTime}
                  onChange={(e) => setFirstDoseTime(e.target.value)}
                  className="w-full h-10 px-2.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Medicines with empty duration -> ask days OR "Until my doctor says" */}
        {missingDurationMeds.length > 0 && (
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2.5">
            <div className="text-xs font-bold text-amber-900">
              How many days should these reminders run?
            </div>
            {missingDurationMeds.map(({ med, key }) => {
              const isOngoing = !!ongoingMap[key];
              return (
                <div
                  key={key}
                  className="p-2.5 bg-white rounded-xl border border-amber-200/80 space-y-2"
                >
                  <div className="text-xs font-bold text-slate-900">{med.name}</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      disabled={isOngoing}
                      placeholder="Days (e.g. 5)"
                      value={isOngoing ? '' : durationMap[key] || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setOngoingMap((prev) => ({ ...prev, [key]: false }));
                        setDurationMap((prev) => ({
                          ...prev,
                          [key]: Number.isFinite(val) && val > 0 ? val : undefined,
                        }));
                      }}
                      className="w-28 h-9 px-2.5 border border-slate-300 rounded-lg text-xs disabled:bg-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setOngoingMap((prev) => ({ ...prev, [key]: !prev[key] }))
                      }
                      className={`flex-1 h-9 px-2.5 rounded-lg text-[11px] font-bold border transition-all ${
                        isOngoing
                          ? 'bg-[#1E88E5] text-white border-[#1E88E5]'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      Until my doctor says
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quiet hours override opt-in for critical medicines */}
        {pendingMeds.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-600">
              Mark critical medicines as Important (always alert during quiet hours):
            </div>
            <div className="flex flex-wrap gap-1.5">
              {pendingMeds.map((m, idx) => {
                const key = m.tempId || String(idx);
                const active = !!importantMap[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setImportantMap((prev) => ({ ...prev, [key]: !prev[key] }))
                    }
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border flex items-center gap-1 transition-all ${
                      active
                        ? 'bg-amber-100 text-amber-900 border-amber-400'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    <Star className={`w-3 h-3 ${active ? 'fill-amber-500 text-amber-600' : ''}`} />
                    <span>{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirmSchedule({
                startDate,
                firstDoseTime,
                ongoingByMedicineTempId: ongoingMap,
                durationOverrideByMedicineTempId: durationMap,
                importantByMedicineTempId: importantMap,
              })
            }
            className="flex-[1.5] h-11 bg-[#2E9E6B] hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Confirm &amp; Create Reminders</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 2. "REMINDERS CREATED" SUMMARY SHEET
// ---------------------------------------------------------------------------

interface RemindersCreatedSummaryProps {
  isOpen: boolean;
  summaryText: string;
  asNeededCount: number;
  onReviewReminders: () => void;
  onContinueToPrescription: () => void;
}

export const RemindersCreatedSummaryModal: React.FC<RemindersCreatedSummaryProps> = ({
  isOpen,
  summaryText,
  asNeededCount,
  onReviewReminders,
  onContinueToPrescription,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl text-slate-800 space-y-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-[#2E9E6B] flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900">Reminders Created</h3>
          <p className="text-xs font-semibold text-slate-700 leading-relaxed">{summaryText}</p>
          {asNeededCount > 0 && (
            <p className="text-[11px] text-slate-500">
              {asNeededCount} as-needed (SOS) medicine{asNeededCount === 1 ? '' : 's'} placed under
              &ldquo;When needed&rdquo; with no fixed alarm.
            </p>
          )}
        </div>

        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={onReviewReminders}
            className="w-full h-11 bg-[#1E88E5] hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm"
          >
            Review reminders
          </button>
          <button
            type="button"
            onClick={onContinueToPrescription}
            className="w-full h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
          >
            View translated prescription
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 3. FRIENDLY PERMISSION EXPLANATION & DENIED SETTINGS HELP MODAL
// ---------------------------------------------------------------------------

interface FriendlyPermissionModalProps {
  isOpen: boolean;
  permissionState: string;
  onClose: () => void;
  onAllowClick: () => void;
}

export const FriendlyPermissionModal: React.FC<FriendlyPermissionModalProps> = ({
  isOpen,
  permissionState,
  onClose,
  onAllowClick,
}) => {
  if (!isOpen) return null;
  const isDenied = permissionState === 'denied';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl text-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                isDenied ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-[#1E88E5]'
              }`}
            >
              {isDenied ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {isDenied ? 'Turn On Notifications in Browser' : 'Never Miss a Dose'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close permission dialog"
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isDenied ? (
          <div className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
            <p className="font-semibold text-slate-800">
              Notifications are currently blocked by your browser. Here is how to enable them:
            </p>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-[11px]">
              <div>
                <strong>Chrome (Android / Desktop):</strong> Tap the lock or tune icon next to the
                address bar &rarr; <strong>Permissions</strong> &rarr; set{' '}
                <strong>Notifications</strong> to <strong>Allow</strong>, then reload.
              </div>
              <div>
                <strong>iPhone Safari:</strong> First tap <strong>Share &rarr; Add to Home Screen</strong>,
                then open the installed PillSync app and allow notifications.
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 bg-[#1E88E5] text-white font-bold rounded-xl text-xs"
            >
              Got it
            </button>
          </div>
        ) : (
          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <p>
              PillSync sends gentle local alerts directly from this device when it&rsquo;s time for your
              medicine &mdash; even when you are offline.
            </p>
            <ul className="space-y-1.5 text-[11px] bg-blue-50/70 p-3 rounded-2xl border border-blue-100 text-slate-700">
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#2E9E6B] shrink-0" />
                <span>Action buttons right on notifications: Taken, Snooze, Skip</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#1E88E5] shrink-0" />
                <span>Your schedule stays private on your device</span>
              </li>
            </ul>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-11 bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={onAllowClick}
                className="flex-[1.5] h-11 bg-[#2E9E6B] hover:bg-emerald-700 text-white font-bold rounded-xl text-xs"
              >
                Allow Notifications
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 4. SET / EDIT CUSTOM REMINDER MODAL ("Only this dose" vs "All future doses")
// ---------------------------------------------------------------------------

export interface ReminderFormSavePayload {
  mode: 'create' | 'edit_one' | 'edit_all';
  targetDate: string;
  medicineId: string;
  medicineName: string;
  medicineForm?: string;
  doseTime: string;
  customDays: 'everyday' | 'weekdays' | 'daterange';
  weekdays: number[];
  startDate: string;
  courseEndDate?: string;
  ongoing: boolean;
  remindBeforeMinutes: number;
  label: string;
  soundEnabled: boolean;
  isImportant: boolean;
  isActive: boolean;
}

interface ReminderFormModalProps {
  isOpen: boolean;
  editingReminder: StoredReminder | null;
  targetDate: string;
  confirmedMeds: StoredMedicine[];
  existingReminders: StoredReminder[];
  onClose: () => void;
  onSave: (payload: ReminderFormSavePayload) => void;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const ReminderFormModal: React.FC<ReminderFormModalProps> = ({
  isOpen,
  editingReminder,
  targetDate,
  confirmedMeds,
  existingReminders,
  onClose,
  onSave,
}) => {
  const isEditing = !!editingReminder;
  const [selectedMedKey, setSelectedMedKey] = useState<string>('custom_text');
  const [freeTextName, setFreeTextName] = useState('');
  const [doseTime, setDoseTime] = useState('08:30');
  const [customDays, setCustomDays] = useState<'everyday' | 'weekdays' | 'daterange'>('everyday');
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [startDate, setStartDate] = useState(targetDate);
  const [courseEndDate, setCourseEndDate] = useState('');
  const [remindBeforeMinutes, setRemindBeforeMinutes] = useState<number>(0);
  const [label, setLabel] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isImportant, setIsImportant] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [editScope, setEditScope] = useState<'edit_one' | 'edit_all'>('edit_all');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (editingReminder) {
      const matchedMed = confirmedMeds.find((m) => m.id === editingReminder.medicineId);
      setSelectedMedKey(matchedMed ? matchedMed.id : 'custom_text');
      setFreeTextName(matchedMed ? matchedMed.name : editingReminder.medicineName);
      setDoseTime(editingReminder.doseTime || '08:30');
      setCustomDays(editingReminder.customDays || 'everyday');
      setWeekdays(
        editingReminder.weekdays && editingReminder.weekdays.length > 0
          ? editingReminder.weekdays
          : [0, 1, 2, 3, 4, 5, 6]
      );
      setStartDate(editingReminder.startDate || targetDate);
      setCourseEndDate(editingReminder.courseEndDate || '');
      setRemindBeforeMinutes(editingReminder.remindBeforeMinutes || 0);
      setLabel(editingReminder.label || '');
      setSoundEnabled(editingReminder.soundEnabled !== false);
      setIsImportant(!!editingReminder.isImportant);
      setIsActive(editingReminder.isActive !== false);
      setEditScope('edit_all');
    } else {
      const firstMed = confirmedMeds[0];
      setSelectedMedKey(firstMed ? firstMed.id : 'custom_text');
      setFreeTextName(firstMed ? firstMed.name : '');
      setDoseTime('08:30');
      setCustomDays('everyday');
      setWeekdays([0, 1, 2, 3, 4, 5, 6]);
      setStartDate(targetDate);
      setCourseEndDate('');
      setRemindBeforeMinutes(0);
      setLabel('');
      setSoundEnabled(true);
      setIsImportant(false);
      setIsActive(true);
    }
  }, [isOpen, editingReminder, targetDate, confirmedMeds]);

  if (!isOpen) return null;

  const selectedMed = confirmedMeds.find((m) => m.id === selectedMedKey);
  const effectiveMedId =
    selectedMedKey === 'custom_text'
      ? editingReminder?.medicineId || `custom_${freeTextName.trim().toLowerCase().replace(/\s+/g, '_')}`
      : selectedMedKey;
  const effectiveMedName =
    selectedMedKey === 'custom_text' ? freeTextName.trim() : selectedMed?.name || '';

  const toggleWeekday = (dow: number) => {
    setWeekdays((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow].sort()
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErr = validateCustomReminderForm({
      medicineId: effectiveMedId,
      medicineName: effectiveMedName,
      doseTime,
      customDays,
      weekdays,
      startDate,
      courseEndDate: courseEndDate || undefined,
      existingReminders,
      editingReminderId: isEditing ? editingReminder?.id : undefined,
    });
    if (validationErr) {
      setError(validationErr);
      return;
    }

    onSave({
      mode: isEditing ? editScope : 'create',
      targetDate,
      medicineId: effectiveMedId,
      medicineName: effectiveMedName,
      medicineForm: selectedMed?.form || editingReminder?.medicineForm,
      doseTime,
      customDays,
      weekdays,
      startDate,
      courseEndDate: courseEndDate || undefined,
      ongoing: customDays !== 'daterange' && !courseEndDate,
      remindBeforeMinutes,
      label: label.trim(),
      soundEnabled,
      isImportant,
      isActive,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl text-slate-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-[#2E9E6B] flex items-center justify-center">
              <AlarmClock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isEditing ? 'Edit Reminder' : 'Set a New Reminder'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isEditing && editingReminder?.source === 'auto'
                  ? 'Editing converts this dose to Custom'
                  : 'Saved as Custom reminder offline'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reminder form"
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-xs">
          {/* Edit scope selector when editing */}
          {isEditing && (
            <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-1.5">
              <div className="text-[11px] font-bold text-blue-900">Apply change to:</div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditScope('edit_one')}
                  className={`h-9 rounded-xl text-[11px] font-bold border transition-all ${
                    editScope === 'edit_one'
                      ? 'bg-[#1E88E5] text-white border-[#1E88E5]'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  Only this dose
                </button>
                <button
                  type="button"
                  onClick={() => setEditScope('edit_all')}
                  className={`h-9 rounded-xl text-[11px] font-bold border transition-all ${
                    editScope === 'edit_all'
                      ? 'bg-[#1E88E5] text-white border-[#1E88E5]'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  All future doses of this medicine
                </button>
              </div>
            </div>
          )}

          {/* Medicine selector or Free Text */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Medicine or Reminder Subject *
            </label>
            <select
              value={selectedMedKey}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedMedKey(v);
                if (v === 'custom_text') setFreeTextName('');
                setError('');
              }}
              className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl font-semibold"
            >
              {confirmedMeds.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.strength ? `(${m.strength})` : ''}
                </option>
              ))}
              <option value="custom_text">+ Free text (e.g. Doctor visit)</option>
            </select>

            {selectedMedKey === 'custom_text' && (
              <input
                type="text"
                placeholder="e.g. Doctor visit, Blood sugar check"
                value={freeTextName}
                onChange={(e) => {
                  setFreeTextName(e.target.value);
                  if (error) setError('');
                }}
                className="mt-2 w-full h-11 px-3 border border-slate-300 rounded-xl font-medium"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Time *</label>
              <input
                type="time"
                required
                value={doseTime}
                onChange={(e) => {
                  setDoseTime(e.target.value);
                  if (error) setError('');
                }}
                className="w-full h-11 px-3 border border-slate-300 rounded-xl font-semibold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Remind me before
              </label>
              <select
                value={remindBeforeMinutes}
                onChange={(e) => setRemindBeforeMinutes(parseInt(e.target.value, 10) || 0)}
                className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl font-medium"
              >
                <option value={0}>At dose time (0 min)</option>
                <option value={5}>5 minutes before</option>
                <option value={10}>10 minutes before</option>
                <option value={15}>15 minutes before</option>
                <option value={30}>30 minutes before</option>
              </select>
            </div>
          </div>

          {/* Days / Schedule type */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Days</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'everyday', label: 'Every day' },
                { id: 'weekdays', label: 'Selected days' },
                { id: 'daterange', label: 'Date range' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCustomDays(opt.id as any)}
                  className={`h-9 rounded-xl text-[11px] font-bold border ${
                    customDays === opt.id
                      ? 'bg-[#2E9E6B] text-white border-[#2E9E6B]'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {customDays === 'weekdays' && (
              <div className="flex justify-between gap-1 pt-2">
                {WEEKDAY_LABELS.map((wd, idx) => (
                  <button
                    key={wd}
                    type="button"
                    onClick={() => toggleWeekday(idx)}
                    className={`flex-1 h-9 rounded-lg text-[10px] font-bold border ${
                      weekdays.includes(idx)
                        ? 'bg-[#1E88E5] text-white border-[#1E88E5]'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {wd}
                  </button>
                ))}
              </div>
            )}

            {customDays === 'daterange' && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-10 px-2.5 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={courseEndDate}
                    onChange={(e) => setCourseEndDate(e.target.value)}
                    className="w-full h-10 px-2.5 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Custom Label (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. With warm water, Fast checkup"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full h-10 px-3 border border-slate-300 rounded-xl font-medium"
            />
          </div>

          {/* Toggles: Sound, Important (Quiet hours override), Active On/Off */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`h-10 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 ${
                soundEnabled
                  ? 'bg-blue-50 text-[#1E88E5] border-blue-300'
                  : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>Sound</span>
            </button>

            <button
              type="button"
              onClick={() => setIsImportant(!isImportant)}
              className={`h-10 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 ${
                isImportant
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${isImportant ? 'fill-amber-500 text-amber-600' : ''}`} />
              <span>Important</span>
            </button>

            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`h-10 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 ${
                isActive
                  ? 'bg-emerald-50 text-[#2E9E6B] border-emerald-300'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              <AlarmClock className="w-3.5 h-3.5" />
              <span>{isActive ? 'On' : 'Off'}</span>
            </button>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 h-11 bg-[#2E9E6B] hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm"
            >
              Save Custom Reminder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 5. ACTIVE IN-APP RINGING ALARM BANNER
// ---------------------------------------------------------------------------

interface ActiveAlarmBannerProps {
  reminder: StoredReminder | null;
  hideMedicineName: boolean;
  snoozeMinutes: number;
  onTaken: (r: StoredReminder) => void;
  onSnooze: (r: StoredReminder, mins: number) => void;
  onSkip: (r: StoredReminder) => void;
}

export const ActiveAlarmBanner: React.FC<ActiveAlarmBannerProps> = ({
  reminder,
  hideMedicineName,
  snoozeMinutes,
  onTaken,
  onSnooze,
  onSkip,
}) => {
  if (!reminder) return null;

  return (
    <div
      role="alertdialog"
      aria-label="Medication alarm"
      className="fixed top-2 left-1/2 -translate-x-1/2 w-[94%] max-w-md z-50 p-4 bg-[#1E88E5] text-white rounded-3xl shadow-2xl border-2 border-white/40 animate-in fade-in space-y-3"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 animate-bounce">
          <AlarmClock className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-100">
            Medication Alarm &bull; {reminder.doseTime}
          </div>
          <div className="text-sm font-black truncate">
            {hideMedicineName ? 'Time for your medicine' : reminder.medicineName}
          </div>
          {!hideMedicineName && reminder.doseSentence && (
            <div className="text-xs text-blue-50 line-clamp-2 mt-0.5">{reminder.doseSentence}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onTaken(reminder)}
          className="h-11 bg-[#2E9E6B] hover:bg-emerald-600 text-white font-bold rounded-2xl text-xs shadow-sm flex items-center justify-center gap-1"
        >
          <Check className="w-4 h-4" />
          <span>Taken</span>
        </button>
        <button
          type="button"
          onClick={() => onSnooze(reminder, snoozeMinutes)}
          className="h-11 bg-white text-[#1E88E5] hover:bg-blue-50 font-bold rounded-2xl text-xs shadow-sm flex items-center justify-center gap-1"
        >
          <Clock className="w-4 h-4" />
          <span>Snooze {snoozeMinutes}m</span>
        </button>
        <button
          type="button"
          onClick={() => onSkip(reminder)}
          className="h-11 bg-white/15 hover:bg-white/25 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-1"
        >
          <SkipForward className="w-4 h-4" />
          <span>Skip</span>
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 6. MISSED DOSES SHEET ON APP OPEN
// ---------------------------------------------------------------------------

interface MissedDosesSheetProps {
  isOpen: boolean;
  missedItems: { reminder: StoredReminder; dateStr: string }[];
  onClose: () => void;
  onMarkTaken: (r: StoredReminder, dateStr: string, actualTime?: string) => void;
  onMarkSkipped: (r: StoredReminder, dateStr: string) => void;
  onMarkUnsure: (r: StoredReminder, dateStr: string) => void;
}

export const MissedDosesSheet: React.FC<MissedDosesSheetProps> = ({
  isOpen,
  missedItems,
  onClose,
  onMarkTaken,
  onMarkSkipped,
  onMarkUnsure,
}) => {
  const [customTimeRowKey, setCustomTimeRowKey] = useState<string | null>(null);
  const [customTimeValue, setCustomTimeValue] = useState('09:00');

  if (!isOpen || missedItems.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl text-slate-800 max-h-[85vh] overflow-y-auto space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Missed Doses Check-In</h3>
            <p className="text-[11px] text-slate-500">
              These scheduled doses passed without a response.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close missed doses sheet"
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          {missedItems.map(({ reminder, dateStr }) => {
            const rowKey = `${reminder.id}_${dateStr}`;
            return (
              <div
                key={rowKey}
                className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900">{reminder.medicineName}</div>
                    <div className="text-[11px] text-slate-500">
                      Scheduled: {dateStr} at {reminder.doseTime}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onMarkTaken(reminder, dateStr)}
                    className="h-10 bg-[#2E9E6B] hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold"
                  >
                    Taken
                  </button>
                  <button
                    type="button"
                    onClick={() => onMarkSkipped(reminder, dateStr)}
                    className="h-10 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-[11px] font-bold"
                  >
                    Skipped
                  </button>
                  <button
                    type="button"
                    onClick={() => onMarkUnsure(reminder, dateStr)}
                    className="h-10 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-[11px] font-bold"
                  >
                    I&rsquo;m not sure
                  </button>
                </div>

                {customTimeRowKey === rowKey ? (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="time"
                      value={customTimeValue}
                      onChange={(e) => setCustomTimeValue(e.target.value)}
                      className="h-9 px-2 border border-slate-300 rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onMarkTaken(reminder, dateStr, customTimeValue);
                        setCustomTimeRowKey(null);
                      }}
                      className="px-3 h-9 bg-[#1E88E5] text-white rounded-lg text-[11px] font-bold"
                    >
                      Save time
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomTimeRowKey(rowKey);
                      setCustomTimeValue(reminder.doseTime || '09:00');
                    }}
                    className="text-[11px] text-[#1E88E5] font-semibold hover:underline"
                  >
                    Taken at a different time
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 7. COURSE EXTENSION, PAUSE, RESET, & DIFFERENT TIME DIALOGS
// ---------------------------------------------------------------------------

interface PauseModalProps {
  isOpen: boolean;
  scopeLabel: string;
  onClose: () => void;
  onPause: (pausedUntilIsoOrDate: string) => void;
}

export const PauseRemindersModal: React.FC<PauseModalProps> = ({
  isOpen,
  scopeLabel,
  onClose,
  onPause,
}) => {
  const tomorrow = addLocalDays(getLocalDateStr(), 1);
  const [chosenDate, setChosenDate] = useState(addLocalDays(getLocalDateStr(), 3));
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl text-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PauseCircle className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900">Pause {scopeLabel}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 text-xs">
          <button
            type="button"
            onClick={() => onPause(new Date(Date.now() + 60 * 60000).toISOString())}
            className="w-full h-11 px-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-xl font-bold text-left"
          >
            Pause for 1 hour
          </button>
          <button
            type="button"
            onClick={() => onPause(tomorrow)}
            className="w-full h-11 px-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-xl font-bold text-left"
          >
            Pause until tomorrow ({tomorrow})
          </button>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <label className="block text-[11px] font-bold text-slate-700">
              Pause until a chosen date:
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                min={tomorrow}
                value={chosenDate}
                onChange={(e) => setChosenDate(e.target.value)}
                className="flex-1 h-10 px-2 border border-slate-300 rounded-lg text-xs bg-white"
              />
              <button
                type="button"
                onClick={() => chosenDate && onPause(chosenDate)}
                className="px-4 h-10 bg-[#1E88E5] text-white font-bold rounded-lg text-xs"
              >
                Pause
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface CourseExtensionModalProps {
  isOpen: boolean;
  medicine: StoredMedicine | null;
  onClose: () => void;
  onExtend: (med: StoredMedicine, extraDays: number) => void;
}

export const CourseExtensionModal: React.FC<CourseExtensionModalProps> = ({
  isOpen,
  medicine,
  onClose,
  onExtend,
}) => {
  const [extraDays, setExtraDays] = useState(5);
  if (!isOpen || !medicine) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl text-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Doctor Extended My Course</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-600">
          How many extra days did your doctor advise for <strong>{medicine.name}</strong>? PillSync
          will rebuild reminders starting today.
        </p>
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Extra Days</label>
          <input
            type="number"
            min={1}
            max={180}
            value={extraDays}
            onChange={(e) => setExtraDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-full h-11 px-3 border border-slate-300 rounded-xl text-xs font-bold"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onExtend(medicine, extraDays)}
            className="flex-1 h-11 bg-[#2E9E6B] text-white font-bold rounded-xl text-xs"
          >
            Rebuild Reminders
          </button>
        </div>
      </div>
    </div>
  );
};
