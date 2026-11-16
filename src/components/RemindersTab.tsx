import React, { useState, useRef } from 'react';
import {
  AlarmClock,
  AlertCircle,
  Bell,
  BellOff,
  Calendar,
  Check,
  Clock,
  Coffee,
  Download,
  Moon,
  PauseCircle,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Shield,
  SkipForward,
  Smartphone,
  Star,
  Sun,
  Sunrise,
  Sunset,
  Trash2,
  Undo2,
  User,
  Utensils,
  Vibrate,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  PatientProfile,
  ReminderSettings,
  StoredMedicine,
  StoredPrescription,
  StoredReminder,
} from '../services/db';
import {
  CompletedCourseAlert,
  ReminderDisplayStatus,
  TimeBucket,
  getLocalDateStr,
  getNextDateStrip,
  getReminderStatusForDate,
  getTimeBucketForHHMM,
  isInQuietHours,
  isReminderPausedAt,
  isReminderScheduledForDate,
} from '../services/reminderScheduler';
import { NotificationCapabilityStatus, reminderService } from '../services/reminderService';
import { isFoodTimingApplicable, isTopicalForm } from '../config/medicineForms';
import { translationService } from '../services/translationService';
import { getOfflineTransliteratedName } from '../services/sentenceBuilder';

export interface UndoBannerState {
  id: string;
  message: string;
  expiresAt: number;
  onUndo: () => Promise<void>;
}

interface RemindersTabProps {
  reminders: StoredReminder[];
  medicines: StoredMedicine[];
  prescriptions: StoredPrescription[];
  profiles: PatientProfile[];
  settings: ReminderSettings;
  capabilityStatus: NotificationCapabilityStatus;
  completedCourses: CompletedCourseAlert[];
  undoBanner: UndoBannerState | null;
  resolveLanguageForPrescription: (rxId?: string, profId?: string) => string;
  onUpdateSettings: (partial: Partial<ReminderSettings>) => Promise<void>;
  onOpenPermissionPrompt: () => void;
  onSendTestReminder: () => void;
  onOpenInstallModal: () => void;
  onOpenNewReminderForm: (dateStr: string) => void;
  onOpenEditReminderForm: (r: StoredReminder, dateStr: string) => void;
  onMarkTaken: (r: StoredReminder, dateStr: string, actualTime?: string) => Promise<void>;
  onSkipOneDose: (r: StoredReminder, dateStr: string) => Promise<void>;
  onSkipMedicineToday: (medicineId: string, medicineName: string, dateStr: string) => Promise<void>;
  onSnooze: (r: StoredReminder, dateStr: string, minutes: number) => Promise<void>;
  onDeleteOrDisableReminder: (r: StoredReminder) => Promise<void>;
  onPauseAll: () => void;
  onPauseMedicine: (medicineId: string, medicineName: string) => void;
  onResumeAll: () => Promise<void>;
  onResumeMedicine: (medicineId: string) => Promise<void>;
  onResetMedicineToRx: (medicineId: string) => Promise<void>;
  onResetAllReminders: (deleteCustomToo: boolean) => Promise<void>;
  onExtendCourse: (med: StoredMedicine) => void;
  onDismissCourseEnd: (med: StoredMedicine) => Promise<void>;
  onLogSosDose: (med: StoredMedicine) => Promise<void>;
  onDismissUndo: () => void;
  medicalDisclaimer: string;
}

const BUCKET_META: Record<
  TimeBucket,
  { label: string; icon: React.ReactNode }
> = {
  morning: { label: 'Morning', icon: <Sunrise className="w-4 h-4 text-amber-500" /> },
  afternoon: { label: 'Afternoon', icon: <Sun className="w-4 h-4 text-orange-500" /> },
  evening: { label: 'Evening', icon: <Sunset className="w-4 h-4 text-indigo-500" /> },
  night: { label: 'Night', icon: <Moon className="w-4 h-4 text-slate-700" /> },
};

const STATUS_BADGE: Record<
  ReminderDisplayStatus,
  { label: string; cls: string }
> = {
  upcoming: { label: 'Upcoming', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  due_now: { label: 'Due now', cls: 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse' },
  taken: { label: 'Taken', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  skipped: { label: 'Skipped', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  snoozed: { label: 'Snoozed', cls: 'bg-purple-100 text-purple-800 border-purple-200' },
  missed: { label: 'Missed', cls: 'bg-red-100 text-red-700 border-red-200' },
  paused: { label: 'Paused', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export const RemindersTab: React.FC<RemindersTabProps> = ({
  reminders,
  medicines,
  profiles,
  settings,
  capabilityStatus,
  completedCourses,
  undoBanner,
  resolveLanguageForPrescription,
  onUpdateSettings,
  onOpenPermissionPrompt,
  onSendTestReminder,
  onOpenInstallModal,
  onOpenNewReminderForm,
  onOpenEditReminderForm,
  onMarkTaken,
  onSkipOneDose,
  onSkipMedicineToday,
  onSnooze,
  onDeleteOrDisableReminder,
  onPauseAll,
  onPauseMedicine,
  onResumeAll,
  onResumeMedicine,
  onResetMedicineToRx,
  onResetAllReminders,
  onExtendCourse,
  onDismissCourseEnd,
  onLogSosDose,
  onDismissUndo,
  medicalDisclaimer,
}) => {
  const dateStrip = getNextDateStrip();
  const [selectedDate, setSelectedDate] = useState(dateStrip[0].dateStr);
  const [showQuietEditor, setShowQuietEditor] = useState(false);
  const [snoozePickerId, setSnoozePickerId] = useState<string | null>(null);
  const [skipMenuId, setSkipMenuId] = useState<string | null>(null);
  const [diffTimeReminderId, setDiffTimeReminderId] = useState<string | null>(null);
  const [diffTimeVal, setDiffTimeVal] = useState('08:30');
  const [resetMedConfirm, setResetMedConfirm] = useState<StoredMedicine | null>(null);
  const [showGlobalResetModal, setShowGlobalResetModal] = useState(false);
  const [deleteCustomToo, setDeleteCustomToo] = useState(false);
  const [sosLoggedMedId, setSosLoggedMedId] = useState<string | null>(null);

  const touchStartXRef = useRef<Record<string, number>>({});

  const now = new Date();
  const todayStr = getLocalDateStr(now);
  const isGloballyPaused =
    Boolean(settings.pausedUntil) &&
    ((/^\d{4}-\d{2}-\d{2}$/.test(settings.pausedUntil || '') && todayStr < (settings.pausedUntil || '')) ||
      (!/^\d{4}-\d{2}-\d{2}$/.test(settings.pausedUntil || '') && now.toISOString() < (settings.pausedUntil || '')));

  // Capability badge metadata
  const statusCardMeta = (() => {
    switch (capabilityStatus) {
      case 'working':
        return { text: 'Working', color: 'text-[#2E9E6B]', bg: 'bg-emerald-50 border-emerald-200' };
      case 'installed_recommended':
        return {
          text: 'Installed app recommended',
          color: 'text-[#1E88E5]',
          bg: 'bg-blue-50 border-blue-200',
        };
      case 'not_supported':
        return { text: 'Not supported', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' };
      case 'denied':
        return { text: 'Needs permission (Blocked)', color: 'text-red-600', bg: 'bg-red-50 border-red-200' };
      case 'needs_permission':
      default:
        return { text: 'Needs permission', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
    }
  })();

  const dayReminders = reminders
    .filter((r) => isReminderScheduledForDate(r, selectedDate))
    .sort((a, b) => a.doseTime.localeCompare(b.doseTime));

  const grouped: Record<TimeBucket, StoredReminder[]> = {
    morning: [],
    afternoon: [],
    evening: [],
    night: [],
  };
  for (const r of dayReminders) {
    grouped[getTimeBucketForHHMM(r.doseTime)].push(r);
  }

  const sosMedicines = medicines.filter((m) => m.confirmed && m.asNeeded);

  const buildResetPreviewText = (med: StoredMedicine): string => {
    const autoCount = reminders.filter(
      (r) => r.medicineId === med.id && r.source !== 'custom'
    ).length;
    const offOrEditedCount = reminders.filter(
      (r) => r.medicineId === med.id && (!r.isActive || r.source === 'custom')
    ).length;
    return `This will restore ${med.name} reminders to match your prescription (${med.frequency || 'prescribed schedule'}) and your meal times, replacing ${autoCount + offOrEditedCount} existing reminder rule(s) for this medicine.`;
  };

  const formatPauseLabel = (pausedUntil?: string | null): string => {
    if (!pausedUntil) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(pausedUntil)) return pausedUntil;
    try {
      return new Date(pausedUntil).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return pausedUntil;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F9FAFB] overflow-y-auto">
      {/* Header */}
      <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
        <div>
          <h2 className="text-base font-bold text-slate-900">Reminders &amp; Alarms</h2>
          <p className="text-[10px] text-slate-500">
            Meal-synced schedules, offline notifications &amp; calendar backup
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => reminderService.downloadIcsFile(reminders)}
            disabled={reminders.filter((r) => r.isActive).length === 0}
            aria-label="Add all reminders to calendar (.ics)"
            className={`px-2.5 h-10 rounded-xl text-[11px] font-bold flex items-center gap-1 border transition-all ${
              reminders.filter((r) => r.isActive).length === 0
                ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                : 'bg-blue-50 border-blue-200 text-[#1E88E5] hover:bg-blue-100'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>.ics</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenNewReminderForm(selectedDate)}
            aria-label="Set a new reminder"
            className="px-3 h-10 bg-[#2E9E6B] hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3 flex-1">
        {/* 10-second Undo Toast */}
        {undoBanner && (
          <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg flex items-center justify-between gap-2 text-xs">
            <span className="font-medium leading-snug">{undoBanner.message}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={undoBanner.onUndo}
                className="px-3 py-1.5 bg-[#2E9E6B] hover:bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-1"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>
              <button
                type="button"
                onClick={onDismissUndo}
                className="px-2 py-1 text-slate-400 hover:text-white text-[11px]"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Global Paused Banner */}
        {isGloballyPaused && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl flex items-center justify-between gap-2 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <PauseCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-bold">
                Paused until {formatPauseLabel(settings.pausedUntil)}
              </span>
            </div>
            <button
              type="button"
              onClick={onResumeAll}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-[11px] flex items-center gap-1"
            >
              <Play className="w-3 h-3" />
              <span>Resume</span>
            </button>
          </div>
        )}

        {/* Status Card */}
        <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {capabilityStatus === 'working' || capabilityStatus === 'installed_recommended' ? (
                <Bell className="w-4 h-4 text-[#2E9E6B] shrink-0" />
              ) : (
                <BellOff className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <div className="text-xs font-bold text-slate-900 truncate">
                Reminders:{' '}
                <span className={statusCardMeta.color}>{statusCardMeta.text}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onSendTestReminder}
              className="px-2.5 min-h-[36px] bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[11px] font-bold shrink-0"
            >
              Send test reminder
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {capabilityStatus !== 'working' && capabilityStatus !== 'installed_recommended' && (
              <button
                type="button"
                onClick={onOpenPermissionPrompt}
                className="flex-1 min-h-[40px] px-3 bg-[#1E88E5] hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
              >
                Enable reminders
              </button>
            )}

            <button
              type="button"
              onClick={onOpenInstallModal}
              className="flex-1 min-h-[40px] px-3 bg-blue-50 hover:bg-blue-100 text-[#1E88E5] border border-blue-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Smartphone className="w-4 h-4" />
              <span>Install to Home Screen</span>
            </button>
          </div>

          <p className="text-[10px] text-slate-500 leading-relaxed">
            For the most dependable alarms, keep PillSync installed and allow notifications. Web
            alarms can be delayed by battery saver.
          </p>
        </div>

        {/* Master Switch & Quick Toggles */}
        <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlarmClock className="w-4 h-4 text-[#1E88E5]" />
              <span className="text-xs font-bold text-slate-900">All Medication Alarms</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.masterEnabled}
              aria-label="Master reminders on or off"
              onClick={() => onUpdateSettings({ masterEnabled: !settings.masterEnabled })}
              className={`w-12 h-7 rounded-full p-1 transition-colors flex items-center ${
                settings.masterEnabled ? 'bg-[#2E9E6B] justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
              className={`min-h-[40px] rounded-xl border font-bold flex flex-col items-center justify-center gap-0.5 ${
                settings.soundEnabled
                  ? 'bg-blue-50 border-blue-300 text-[#1E88E5]'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
            >
              {settings.soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>Sound</span>
            </button>

            <button
              type="button"
              onClick={() => onUpdateSettings({ vibrationEnabled: !settings.vibrationEnabled })}
              className={`min-h-[40px] rounded-xl border font-bold flex flex-col items-center justify-center gap-0.5 ${
                settings.vibrationEnabled
                  ? 'bg-blue-50 border-blue-300 text-[#1E88E5]'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
            >
              <Vibrate className="w-3.5 h-3.5" />
              <span>Vibrate</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const next =
                  settings.snoozeDefaultMinutes === 5
                    ? 10
                    : settings.snoozeDefaultMinutes === 10
                    ? 15
                    : 5;
                onUpdateSettings({ snoozeDefaultMinutes: next });
              }}
              className="min-h-[40px] rounded-xl border bg-blue-50 border-blue-300 text-[#1E88E5] font-bold flex flex-col items-center justify-center gap-0.5"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Snooze {settings.snoozeDefaultMinutes}m</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onUpdateSettings({ quietHoursEnabled: !settings.quietHoursEnabled });
                setShowQuietEditor(!settings.quietHoursEnabled);
              }}
              className={`min-h-[40px] rounded-xl border font-bold flex flex-col items-center justify-center gap-0.5 ${
                settings.quietHoursEnabled
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Quiet hrs</span>
            </button>
          </div>

          {/* Privacy + Pause All + Reset All row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({
                  hideMedicineNamesInNotifications: !settings.hideMedicineNamesInNotifications,
                })
              }
              className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold border flex items-center gap-1 ${
                settings.hideMedicineNamesInNotifications
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              <Shield className="w-3 h-3" />
              <span>Hide medicine names on lock screen</span>
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onPauseAll}
                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-[10px] font-bold flex items-center gap-1"
              >
                <PauseCircle className="w-3 h-3" />
                <span>Pause all</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDeleteCustomToo(false);
                  setShowGlobalResetModal(true);
                }}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-bold flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset all</span>
              </button>
            </div>
          </div>

          {(settings.quietHoursEnabled || showQuietEditor) && (
            <div className="p-2.5 bg-indigo-50/60 border border-indigo-200 rounded-xl flex items-center justify-between gap-2 text-[11px]">
              <span className="font-bold text-indigo-900">Quiet hours:</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="time"
                  value={settings.quietHoursStart}
                  onChange={(e) => onUpdateSettings({ quietHoursStart: e.target.value })}
                  className="h-8 px-2 border border-indigo-200 rounded-lg bg-white text-xs"
                />
                <span>to</span>
                <input
                  type="time"
                  value={settings.quietHoursEnd}
                  onChange={(e) => onUpdateSettings({ quietHoursEnd: e.target.value })}
                  className="h-8 px-2 border border-indigo-200 rounded-lg bg-white text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Course-End Doctor Visit Alerts */}
        {completedCourses.map((alertItem) => (
          <div
            key={alertItem.medicine.id}
            className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl space-y-2 text-xs"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold text-amber-950">{alertItem.medicine.name}</div>
                <p className="text-amber-900 leading-relaxed">{alertItem.message}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onExtendCourse(alertItem.medicine)}
                className="flex-1 h-9 bg-[#1E88E5] hover:bg-blue-700 text-white rounded-xl font-bold text-[11px]"
              >
                Doctor extended my course
              </button>
              <button
                type="button"
                onClick={() => onDismissCourseEnd(alertItem.medicine)}
                className="px-3 h-9 bg-white border border-amber-300 text-amber-900 rounded-xl font-semibold text-[11px]"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}

        {/* Date Strip: Today, Tomorrow, Next 6 days */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none"
          role="tablist"
          aria-label="Choose schedule date"
        >
          {dateStrip.map((d) => {
            const active = selectedDate === d.dateStr;
            return (
              <button
                key={d.dateStr}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedDate(d.dateStr)}
                className={`min-w-[68px] px-2.5 py-2 rounded-2xl border text-center shrink-0 transition-all ${
                  active
                    ? 'bg-[#1E88E5] text-white border-[#1E88E5] shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="text-[10px] font-bold uppercase">{d.label}</div>
                <div className="text-xs font-black mt-0.5">{d.dayNum}</div>
              </button>
            );
          })}
        </div>

        {/* Empty State or Grouped Reminders */}
        {reminders.length === 0 && sosMedicines.length === 0 ? (
          <div className="p-8 bg-white border border-slate-200 rounded-3xl text-center space-y-3">
            <AlarmClock className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed font-medium">
              No reminders yet. Confirm a prescription to set them automatically, or tap + to add one.
            </p>
            <button
              type="button"
              onClick={() => onOpenNewReminderForm(selectedDate)}
              className="px-4 h-11 bg-[#2E9E6B] hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Set a new reminder</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {(['morning', 'afternoon', 'evening', 'night'] as TimeBucket[]).map((bucket) => {
              const items = grouped[bucket];
              if (items.length === 0) return null;

              return (
                <div key={bucket} className="space-y-2">
                  <div className="flex items-center gap-1.5 px-1 text-xs font-bold text-slate-700">
                    {BUCKET_META[bucket].icon}
                    <span>{BUCKET_META[bucket].label}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      ({items.length})
                    </span>
                  </div>

                  {items.map((r) => {
                    const med = medicines.find((m) => m.id === r.medicineId);
                    const profile = profiles.find((p) => p.id === r.profileId);
                    const showProfileBadge =
                      profile &&
                      profile.relation !== 'Self' &&
                      profile.name.toLowerCase() !== 'me';
                    const rLang = resolveLanguageForPrescription(r.prescriptionId, r.profileId);
                    const displayMedName =
                      rLang !== 'en'
                        ? `${r.medicineName} / ${getOfflineTransliteratedName(r.medicineName, rLang)}`
                        : r.medicineName;
                    const sentence = med
                      ? translationService.getInstantMedicineSentence(med, rLang)
                      : r.doseSentence || r.label || r.medicineName;
                    const status = getReminderStatusForDate(r, selectedDate, settings, now);
                    const badge = STATUS_BADGE[status];
                    const showFoodIcon =
                      isFoodTimingApplicable(med?.form || r.medicineForm) &&
                      r.foodTiming &&
                      r.foodTiming !== 'unspecified' &&
                      r.foodTiming !== 'anytime';
                    const isEmptyStomach = (r.foodTiming || '').toLowerCase().includes('empty');
                    const topical = isTopicalForm(med?.form || r.medicineForm);
                    const quietSuppressed =
                      settings.quietHoursEnabled &&
                      !r.isImportant &&
                      isInQuietHours(r.doseTime, settings.quietHoursStart, settings.quietHoursEnd);
                    const medPaused = isReminderPausedAt(r, settings, now);

                    return (
                      <div
                        key={r.id}
                        onTouchStart={(e) => {
                          touchStartXRef.current[r.id] = e.changedTouches[0]?.clientX ?? 0;
                        }}
                        onTouchEnd={(e) => {
                          const startX = touchStartXRef.current[r.id];
                          const endX = e.changedTouches[0]?.clientX ?? 0;
                          if (typeof startX === 'number') {
                            if (endX - startX > 75) {
                              onMarkTaken(r, selectedDate);
                            } else if (startX - endX > 75) {
                              onSkipOneDose(r, selectedDate);
                            }
                          }
                        }}
                        className={`p-3.5 bg-white rounded-2xl border space-y-2.5 transition-all ${
                          status === 'due_now'
                            ? 'border-amber-400 shadow-sm'
                            : 'border-slate-200 shadow-xs'
                        }`}
                      >
                        {/* Top row: Time + Status + Auto/Custom + Profile */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-slate-900 font-mono">
                              {r.doseTime}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.cls}`}
                            >
                              {badge.label}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                r.source === 'custom'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : 'bg-blue-50 text-[#1E88E5] border border-blue-200'
                              }`}
                            >
                              {r.source === 'custom' ? 'Custom' : 'Auto'}
                            </span>
                            {r.isImportant && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                                Important
                              </span>
                            )}
                            {showProfileBadge && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {profile?.name}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {r.courseEndDate && !r.ongoing && (
                              <span className="text-[10px] text-slate-400">
                                Ends {r.courseEndDate}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Medicine Name & Dose Sentence */}
                        <div>
                          <div
                            dir={rLang === 'ur' ? 'rtl' : 'ltr'}
                            className={`text-xs font-bold flex items-center gap-1.5 ${
                              status === 'taken' || status === 'skipped'
                                ? 'line-through text-slate-400'
                                : 'text-slate-900'
                            }`}
                          >
                            {showFoodIcon &&
                              (isEmptyStomach ? (
                                <Coffee className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                              ) : (
                                <Utensils className="w-3.5 h-3.5 text-[#2E9E6B] shrink-0" />
                              ))}
                            <span>{displayMedName}</span>
                          </div>

                          <div
                            dir={rLang === 'ur' ? 'rtl' : 'ltr'}
                            className="text-[11px] text-slate-600 mt-0.5 leading-snug"
                          >
                            {sentence}
                            {r.label ? ` • ${r.label}` : ''}
                          </div>

                          {quietSuppressed && (
                            <div className="text-[10px] text-indigo-600 mt-0.5">
                              Muted during quiet hours (mark Important to override)
                            </div>
                          )}
                          {medPaused && r.pausedUntil && !isGloballyPaused && (
                            <div className="mt-1 flex items-center gap-2 text-[10px] text-amber-800 bg-amber-50 px-2 py-1 rounded-lg">
                              <span>Paused until {formatPauseLabel(r.pausedUntil)}</span>
                              <button
                                type="button"
                                onClick={() => onResumeMedicine(r.medicineId)}
                                className="font-bold text-[#1E88E5] underline"
                              >
                                Resume
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Primary Touch Actions: Taken | Skip | Snooze | Edit */}
                        <div className="grid grid-cols-4 gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => onMarkTaken(r, selectedDate)}
                            className={`min-h-[40px] rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                              status === 'taken'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-[#2E9E6B] hover:bg-emerald-700 text-white'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>
                              {status === 'taken'
                                ? topical
                                  ? 'Applied'
                                  : 'Taken'
                                : topical
                                ? 'Apply'
                                : 'Taken'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSkipMenuId(skipMenuId === r.id ? null : r.id)}
                            className={`min-h-[40px] rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1 ${
                              status === 'skipped'
                                ? 'bg-slate-200 text-slate-700 border-slate-300'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <SkipForward className="w-3.5 h-3.5" />
                            <span>Skip</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSnoozePickerId(snoozePickerId === r.id ? null : r.id)}
                            className="min-h-[40px] rounded-xl text-[11px] font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-1"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Snooze</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenEditReminderForm(r, selectedDate)}
                            className="min-h-[40px] rounded-xl text-[11px] font-bold bg-white text-[#1E88E5] border border-blue-200 hover:bg-blue-50 flex items-center justify-center gap-1"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        </div>

                        {/* Skip sub-choices ("Skip this dose" vs "Skip today") */}
                        {skipMenuId === r.id && (
                          <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap gap-1.5 text-[11px]">
                            <button
                              type="button"
                              onClick={() => {
                                setSkipMenuId(null);
                                onSkipOneDose(r, selectedDate);
                              }}
                              className="flex-1 min-h-[36px] px-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 hover:bg-slate-100"
                            >
                              Skip this dose
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSkipMenuId(null);
                                onSkipMedicineToday(r.medicineId, r.medicineName, selectedDate);
                              }}
                              className="flex-1 min-h-[36px] px-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 hover:bg-slate-100"
                            >
                              Skip today ({r.medicineName})
                            </button>
                          </div>
                        )}

                        {/* Snooze picker (5, 10, 15 min) */}
                        {snoozePickerId === r.id && (
                          <div className="p-2 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-1.5 text-[11px]">
                            <span className="font-bold text-purple-900 mr-1">Snooze:</span>
                            {[5, 10, 15].map((mins) => (
                              <button
                                key={mins}
                                type="button"
                                onClick={() => {
                                  setSnoozePickerId(null);
                                  onSnooze(r, selectedDate, mins);
                                }}
                                className="flex-1 min-h-[36px] bg-white border border-purple-300 rounded-lg font-bold text-purple-800 hover:bg-purple-100"
                              >
                                {mins} min
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Taken at a different time inline input */}
                        {diffTimeReminderId === r.id && (
                          <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-[11px]">
                            <input
                              type="time"
                              value={diffTimeVal}
                              onChange={(e) => setDiffTimeVal(e.target.value)}
                              className="h-9 px-2 bg-white border border-emerald-300 rounded-lg text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setDiffTimeReminderId(null);
                                onMarkTaken(r, selectedDate, diffTimeVal);
                              }}
                              className="px-3 h-9 bg-[#2E9E6B] text-white rounded-lg font-bold"
                            >
                              Log time
                            </button>
                            <button
                              type="button"
                              onClick={() => setDiffTimeReminderId(null)}
                              className="px-2 h-9 text-slate-500 font-semibold"
                            >
                              Cancel
                            </button>
                          </div>
                        )}

                        {/* Secondary utility bar: Taken at a different time | Reset to Rx | Pause | .ics | Turn Off/Delete */}
                        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500 flex-wrap">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                setDiffTimeReminderId(
                                  diffTimeReminderId === r.id ? null : r.id
                                );
                                setDiffTimeVal(r.doseTime || '08:30');
                              }}
                              className="font-semibold text-[#1E88E5] hover:underline"
                            >
                              Taken at a different time
                            </button>

                            {med && (
                              <button
                                type="button"
                                onClick={() => setResetMedConfirm(med)}
                                className="font-semibold text-slate-600 hover:text-slate-900 hover:underline"
                              >
                                Reset to Rx
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => onPauseMedicine(r.medicineId, r.medicineName)}
                              className="font-semibold text-slate-600 hover:text-slate-900 hover:underline"
                            >
                              Pause
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const medRems = reminders.filter(
                                  (x) => x.medicineId === r.medicineId && x.isActive
                                );
                                reminderService.downloadIcsFile(
                                  medRems.length > 0 ? medRems : [r],
                                  `PillSync_${r.medicineName.replace(/\s+/g, '_')}.ics`,
                                  `PillSync - ${r.medicineName}`
                                );
                              }}
                              className="font-semibold text-[#1E88E5] hover:underline flex items-center gap-0.5"
                            >
                              <Calendar className="w-3 h-3" />
                              <span>.ics</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => onDeleteOrDisableReminder(r)}
                            className="font-semibold text-red-500 hover:text-red-700 flex items-center gap-0.5"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>{r.source === 'custom' ? 'Delete' : 'Turn off'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {dayReminders.length === 0 && reminders.length > 0 && (
              <div className="p-6 bg-white border border-slate-200 rounded-2xl text-center text-xs text-slate-500">
                No scheduled reminders on {selectedDate}.
              </div>
            )}

            {/* WHEN NEEDED (SOS / PRN) SECTION */}
            {sosMedicines.length > 0 && (
              <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    When Needed (SOS / PRN)
                  </span>
                  <span className="text-[10px] text-slate-500">No fixed alarms</span>
                </div>

                {sosMedicines.map((med) => (
                  <div
                    key={med.id}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{med.name}</div>
                      <div className="text-[11px] text-slate-600 truncate">
                        {translationService.getInstantMedicineSentence(
                          med,
                          resolveLanguageForPrescription(med.prescriptionId, med.profileId)
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        await onLogSosDose(med);
                        setSosLoggedMedId(med.id);
                        setTimeout(() => setSosLoggedMedId(null), 2500);
                      }}
                      className="px-3 min-h-[38px] bg-[#1E88E5] hover:bg-blue-700 text-white rounded-xl text-[11px] font-bold shrink-0"
                    >
                      {sosLoggedMedId === med.id ? 'Logged ✓' : 'Log a dose'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Per-medicine Reset Confirmation Modal */}
      {resetMedConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl space-y-3 text-slate-800">
            <h3 className="text-sm font-bold text-slate-900">
              Reset to Prescription Schedule?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {buildResetPreviewText(resetMedConfirm)}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setResetMedConfirm(null)}
                className="flex-1 h-11 bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetId = resetMedConfirm.id;
                  setResetMedConfirm(null);
                  await onResetMedicineToRx(targetId);
                }}
                className="flex-1 h-11 bg-[#1E88E5] text-white font-bold rounded-xl text-xs"
              >
                Reset Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Reset All Confirmation Modal */}
      {showGlobalResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl space-y-3 text-slate-800">
            <h3 className="text-sm font-bold text-slate-900">Reset All Reminders?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This rebuilds every Auto reminder from your confirmed prescriptions and meal times. You
              will have 10 seconds to Undo.
            </p>
            <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteCustomToo}
                onChange={(e) => setDeleteCustomToo(e.target.checked)}
                className="w-4 h-4 accent-[#1E88E5]"
              />
              <span>Delete custom reminders too</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowGlobalResetModal(false)}
                className="flex-1 h-11 bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const flag = deleteCustomToo;
                  setShowGlobalResetModal(false);
                  await onResetAllReminders(flag);
                }}
                className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs"
              >
                Reset All
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-3 bg-white border-t border-slate-200 shrink-0 text-[10px] text-slate-500 text-center">
        {medicalDisclaimer}
      </div>
    </div>
  );
};
