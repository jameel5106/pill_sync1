import {
  MealTimesConfig,
  ReminderSettings,
  StoredMedicine,
  StoredPrescription,
  StoredReminder,
} from './db';
import {
  getMedicineFormDef,
  isOralForm,
  isTopicalForm,
  normalizeFormId,
  resolveApplicationAreaLabel,
} from '../config/medicineForms';
import { normalizeHandwritingFrequency } from '../utils/frequencyHelper';
import {
  buildFormAwareReminderAlertText,
  buildMedicineSentenceFromTemplate,
  toSupportedLang,
} from '../translations/glossary';

export const DEFAULT_MEAL_TIMES: MealTimesConfig = {
  wake: '07:00',
  breakfast: '08:00',
  lunch: '13:00',
  dinner: '20:00',
  bedtime: '22:00',
};

export function getLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

export function createDefaultReminderSettings(userId: string): ReminderSettings {
  return {
    userId,
    masterEnabled: true,
    soundEnabled: true,
    vibrationEnabled: true,
    snoozeDefaultMinutes: 10,
    repeatMaxCount: 2,
    repeatIntervalMinutes: 10,
    quietHoursEnabled: false,
    quietHoursStart: '22:30',
    quietHoursEnd: '07:00',
    hideMedicineNamesInNotifications: false,
    mealTimes: { ...DEFAULT_MEAL_TIMES },
    pausedUntil: null,
    lastKnownTimezone: getLocalTimezone(),
  };
}

export function getLocalDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getLocalTimeStr(date: Date = new Date()): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function addLocalDays(dateStr: string, deltaDays: number): string {
  const parts = dateStr.split('-').map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return getLocalDateStr(new Date(Date.now() + deltaDays * 86400000));
  }
  const dt = new Date(parts[0], parts[1] - 1, parts[2] + deltaDays);
  return getLocalDateStr(dt);
}

export function getDayOfWeekFromDateStr(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return new Date().getDay();
  return new Date(y, m - 1, d).getDay();
}

export function parseHHMMToMinutes(hhmm: string): number {
  const [hRaw, mRaw] = (hhmm || '08:00').split(':');
  const h = Math.max(0, Math.min(23, parseInt(hRaw || '8', 10) || 0));
  const m = Math.max(0, Math.min(59, parseInt(mRaw || '0', 10) || 0));
  return h * 60 + m;
}

export function minutesToHHMM(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addMinutesToHHMM(hhmm: string, deltaMinutes: number): string {
  return minutesToHHMM(parseHHMMToMinutes(hhmm) + deltaMinutes);
}

/**
 * Computes dose wall-clock HH:MM for a prescription slot from meal times and food timing:
 * - before food  = meal - 30 min
 * - after food   = meal + 30 min
 * - with food    = at the meal
 * - empty stomach = meal - 60 min
 * - bedtime      = mealTimes.bedtime
 */
export function computeDoseTimeForSlot(
  slot: 'morning' | 'afternoon' | 'night' | 'bedtime',
  foodTiming: string | undefined,
  mealTimes: MealTimesConfig = DEFAULT_MEAL_TIMES,
  oral = true
): string {
  if (slot === 'bedtime') {
    return mealTimes.bedtime || DEFAULT_MEAL_TIMES.bedtime;
  }

  const baseMeal =
    slot === 'morning'
      ? mealTimes.breakfast || DEFAULT_MEAL_TIMES.breakfast
      : slot === 'afternoon'
      ? mealTimes.lunch || DEFAULT_MEAL_TIMES.lunch
      : mealTimes.dinner || DEFAULT_MEAL_TIMES.dinner;

  const ft = (foodTiming || 'unspecified').toLowerCase().trim();
  if (!oral || ft === 'unspecified' || ft === 'anytime' || ft === 'not_food_related') {
    return baseMeal;
  }
  if (ft === 'bedtime') {
    return slot === 'night' ? mealTimes.bedtime || DEFAULT_MEAL_TIMES.bedtime : baseMeal;
  }
  if (ft.includes('empty')) {
    return addMinutesToHHMM(baseMeal, -60);
  }
  if (ft.includes('before')) {
    return addMinutesToHHMM(baseMeal, -30);
  }
  if (ft.includes('after')) {
    return addMinutesToHHMM(baseMeal, 30);
  }
  if (ft.includes('with')) {
    return baseMeal;
  }
  return baseMeal;
}

/**
 * End date = startDate + durationDays - 1 (inclusive wall-clock date).
 * If durationDays is missing/<=0 or ongoing is true, returns undefined (ongoing).
 */
export function computeCourseEndDate(
  startDate: string,
  durationDays?: number | null,
  ongoing?: boolean
): string | undefined {
  if (ongoing || !durationDays || durationDays <= 0) {
    return undefined;
  }
  return addLocalDays(startDate, Math.floor(durationDays) - 1);
}

export interface FirstDoseOption {
  startDate: string;
  firstDoseTime: string;
  slotLabel: string;
}

/**
 * Picks the next upcoming meal slot from current local time so the confirmation prompt
 * starts cleanly on the patient's next realistic dose.
 */
export function getDefaultFirstDoseSelection(
  mealTimes: MealTimesConfig = DEFAULT_MEAL_TIMES,
  now: Date = new Date()
): FirstDoseOption {
  const todayStr = getLocalDateStr(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const candidates = [
    { time: mealTimes.breakfast, label: 'Morning (Breakfast)' },
    { time: mealTimes.lunch, label: 'Afternoon (Lunch)' },
    { time: mealTimes.dinner, label: 'Night (Dinner)' },
    { time: mealTimes.bedtime, label: 'Bedtime' },
  ];

  for (const c of candidates) {
    if (parseHHMMToMinutes(c.time) > nowMinutes + 5) {
      return { startDate: todayStr, firstDoseTime: c.time, slotLabel: c.label };
    }
  }

  return {
    startDate: addLocalDays(todayStr, 1),
    firstDoseTime: mealTimes.breakfast,
    slotLabel: 'Tomorrow Morning',
  };
}

export interface GenerateMedicineRemindersOptions {
  startDate: string;
  firstDoseTime?: string; // used for interval ("every 8 hours") or STAT
  mealTimes?: MealTimesConfig;
  langCode?: string;
  ongoingOverride?: boolean;
  timezone?: string;
  settings?: Partial<ReminderSettings>;
}

export interface GeneratedMedicineRemindersResult {
  scheduledReminders: StoredReminder[];
  isAsNeededOnly: boolean;
}

/**
 * Deterministically converts a confirmed medicine into scheduled StoredReminder rows.
 * - Oral & Non-oral (topical, drops, inhaler, injection) are both scheduled.
 * - SOS / PRN without fixed numeric schedule returns [] and isAsNeededOnly = true.
 * - Interval schedules (e.g. every 8 hours / q8h) anchor on options.firstDoseTime.
 * - Finite durations compute courseEndDate = startDate + durationDays - 1.
 */
export function generateRemindersForMedicine(
  med: StoredMedicine,
  options: GenerateMedicineRemindersOptions
): GeneratedMedicineRemindersResult {
  const mealTimes = options.mealTimes || DEFAULT_MEAL_TIMES;
  const startDate = options.startDate || getLocalDateStr();
  const timezone = options.timezone || getLocalTimezone();
  const langCode = toSupportedLang(options.langCode || 'en');
  const ongoing = Boolean(options.ongoingOverride ?? med.ongoing ?? !med.durationDays);
  const effectiveDuration = ongoing ? undefined : med.durationDays;
  const formId = normalizeFormId(med.form);
  const oral = formId ? isOralForm(formId) : isOralForm(med.form);

  const norm = normalizeHandwritingFrequency(med.frequency, med.doseSchedule, !!med.asNeeded);

  // SOS / PRN medicines get no automatic timed reminders
  if (
    norm.specialCode === 'sos' ||
    (med.asNeeded && !norm.schedule.morning && !norm.schedule.afternoon && !norm.schedule.night && !norm.schedule.bedtime && !norm.everyHours)
  ) {
    return { scheduledReminders: [], isAsNeededOnly: true };
  }

  const effectiveFood = oral
    ? (med.timing && med.timing !== 'not_food_related' ? med.timing : 'unspecified')
    : 'unspecified';

  const doseSentence = buildMedicineSentenceFromTemplate(
    {
      ...med,
      timing: effectiveFood,
    },
    langCode
  );

  const baseReminderFields = {
    medicineId: med.id,
    prescriptionId: med.prescriptionId,
    userId: med.userId,
    profileId: med.profileId,
    medicineName: med.name,
    medicineForm: formId || med.form,
    applicationArea: med.applicationArea,
    doseSentence,
    timingSuggested: oral ? !!med.timingSuggested : false,
    remindBeforeMinutes: 0,
    repeatMinutes: options.settings?.repeatIntervalMinutes ?? 10,
    quietHoursStart: options.settings?.quietHoursEnabled
      ? options.settings.quietHoursStart
      : undefined,
    quietHoursEnd: options.settings?.quietHoursEnabled
      ? options.settings.quietHoursEnd
      : undefined,
    isActive: true,
    source: 'auto' as const,
    scheduleKind: 'scheduled' as const,
    customDays: 'everyday' as const,
    startDate,
    ongoing,
    timezone,
    soundEnabled: options.settings?.soundEnabled ?? true,
    isImportant: !!med.isImportant,
    lastStatus: 'pending' as const,
    createdAt: new Date().toISOString(),
  };

  // 1. Interval schedule (e.g., q8h / every 8 hours) starts from firstDoseTime
  if (norm.everyHours && norm.everyHours > 0) {
    const startTime = options.firstDoseTime || mealTimes.breakfast || '08:00';
    const intervalMins = Math.round(norm.everyHours * 60);
    const count = Math.max(1, Math.floor(1440 / intervalMins));
    const endDate = computeCourseEndDate(startDate, effectiveDuration, ongoing);

    const intervalTimes: string[] = [];
    for (let i = 0; i < count; i++) {
      const t = addMinutesToHHMM(startTime, i * intervalMins);
      if (!intervalTimes.includes(t)) {
        intervalTimes.push(t);
      }
    }

    const intervalReminders: StoredReminder[] = intervalTimes.map((doseTime, idx) => ({
      ...baseReminderFields,
      id: `rem_${med.id}_int_${idx}_${doseTime.replace(':', '')}`,
      doseTime,
      foodTiming: effectiveFood,
      slotKey: 'interval',
      courseEndDate: endDate,
    }));

    return { scheduledReminders: intervalReminders, isAsNeededOnly: false };
  }

  // 2. STAT (one time right away)
  if (norm.specialCode === 'stat') {
    const statTime = options.firstDoseTime || getLocalTimeStr();
    return {
      scheduledReminders: [
        {
          ...baseReminderFields,
          id: `rem_${med.id}_stat_0`,
          doseTime: statTime,
          foodTiming: effectiveFood,
          slotKey: 'custom',
          courseEndDate: startDate,
          ongoing: false,
        },
      ],
      isAsNeededOnly: false,
    };
  }

  // 3. Slot-based schedules (morning, afternoon, night, bedtime, BD, TDS, QID, HS, OD)
  const slots: {
    slotKey: 'morning' | 'afternoon' | 'night' | 'bedtime';
    time: string;
    food: string;
  }[] = [];

  if (norm.specialCode === 'bd') {
    slots.push({
      slotKey: 'morning',
      time: computeDoseTimeForSlot('morning', effectiveFood, mealTimes, oral),
      food: effectiveFood,
    });
    slots.push({
      slotKey: 'night',
      time: computeDoseTimeForSlot('night', effectiveFood, mealTimes, oral),
      food: effectiveFood,
    });
  } else if (norm.specialCode === 'tds') {
    slots.push({
      slotKey: 'morning',
      time: computeDoseTimeForSlot('morning', effectiveFood, mealTimes, oral),
      food: effectiveFood,
    });
    slots.push({
      slotKey: 'afternoon',
      time: computeDoseTimeForSlot('afternoon', effectiveFood, mealTimes, oral),
      food: effectiveFood,
    });
    slots.push({
      slotKey: 'night',
      time: computeDoseTimeForSlot('night', effectiveFood, mealTimes, oral),
      food: effectiveFood,
    });
  } else if (norm.specialCode === 'qid') {
    const first = options.firstDoseTime || mealTimes.breakfast || '08:00';
    slots.push({ slotKey: 'morning', time: first, food: effectiveFood });
    slots.push({ slotKey: 'afternoon', time: addMinutesToHHMM(first, 240), food: effectiveFood });
    slots.push({ slotKey: 'night', time: addMinutesToHHMM(first, 480), food: effectiveFood });
    slots.push({ slotKey: 'bedtime', time: addMinutesToHHMM(first, 720), food: effectiveFood });
  } else if (norm.specialCode === 'hs') {
    const hsFood = oral ? 'bedtime' : 'unspecified';
    slots.push({
      slotKey: 'bedtime',
      time: computeDoseTimeForSlot('bedtime', hsFood, mealTimes, oral),
      food: hsFood,
    });
  } else {
    const s = norm.schedule;
    if (s.morning > 0) {
      slots.push({
        slotKey: 'morning',
        time: computeDoseTimeForSlot('morning', effectiveFood, mealTimes, oral),
        food: effectiveFood,
      });
    }
    if (s.afternoon > 0) {
      slots.push({
        slotKey: 'afternoon',
        time: computeDoseTimeForSlot('afternoon', effectiveFood, mealTimes, oral),
        food: effectiveFood,
      });
    }
    if (s.night > 0) {
      slots.push({
        slotKey: 'night',
        time: computeDoseTimeForSlot('night', effectiveFood, mealTimes, oral),
        food: effectiveFood,
      });
    }
    if (s.bedtime > 0) {
      const btFood = oral ? 'bedtime' : 'unspecified';
      slots.push({
        slotKey: 'bedtime',
        time: computeDoseTimeForSlot('bedtime', btFood, mealTimes, oral),
        food: btFood,
      });
    }
  }

  // Fallback for once-daily unspecified frequency like OD or generic non-empty pattern
  if (slots.length === 0 && (norm.isOnceDailyUnspecifiedTime || (med.frequency || '').trim())) {
    if (effectiveFood === 'bedtime') {
      slots.push({
        slotKey: 'bedtime',
        time: computeDoseTimeForSlot('bedtime', oral ? 'bedtime' : 'unspecified', mealTimes, oral),
        food: oral ? 'bedtime' : 'unspecified',
      });
    } else {
      slots.push({
        slotKey: 'morning',
        time: computeDoseTimeForSlot('morning', effectiveFood, mealTimes, oral),
        food: effectiveFood,
      });
    }
  }

  const endDate = computeCourseEndDate(startDate, effectiveDuration, ongoing);

  const reminders: StoredReminder[] = slots.map((slot, idx) => ({
    ...baseReminderFields,
    id: `rem_${med.id}_${slot.slotKey}_${idx}`,
    doseTime: slot.time,
    foodTiming: slot.food,
    slotKey: slot.slotKey,
    courseEndDate: endDate,
  }));

  return { scheduledReminders: reminders, isAsNeededOnly: false };
}

export function generateRemindersForMedicines(
  medicines: StoredMedicine[],
  options: GenerateMedicineRemindersOptions
): {
  reminders: StoredReminder[];
  asNeededMedicines: StoredMedicine[];
  totalDoseCount: number;
} {
  const reminders: StoredReminder[] = [];
  const asNeededMedicines: StoredMedicine[] = [];

  for (const med of medicines) {
    const res = generateRemindersForMedicine(med, options);
    if (res.isAsNeededOnly) {
      asNeededMedicines.push(med);
    }
    reminders.push(...res.scheduledReminders);
  }

  const totalDoseCount = countScheduledDoseOccurrences(reminders);
  return { reminders, asNeededMedicines, totalDoseCount };
}

/**
 * Computes the total number of scheduled dose occurrences across finite courses
 * (or 1 per daily slot if ongoing) for human-friendly summary notices like
 * "12 reminders set for Paracetamol, Pantoprazole".
 */
export function countScheduledDoseOccurrences(reminders: StoredReminder[]): number {
  let total = 0;
  for (const r of reminders) {
    if (!r.startDate || !r.courseEndDate || r.ongoing) {
      total += 1;
      continue;
    }
    const [sy, sm, sd] = r.startDate.split('-').map((n) => parseInt(n, 10));
    const [ey, em, ed] = r.courseEndDate.split('-').map((n) => parseInt(n, 10));
    if (!sy || !ey) {
      total += 1;
      continue;
    }
    const startUtc = Date.UTC(sy, sm - 1, sd);
    const endUtc = Date.UTC(ey, em - 1, ed);
    const diffDays = Math.max(1, Math.round((endUtc - startUtc) / 86400000) + 1);
    total += diffDays;
  }
  return total;
}

export function isReminderPausedAt(reminder: StoredReminder, settings?: ReminderSettings | null, now: Date = new Date()): boolean {
  const nowIso = now.toISOString();
  const todayStr = getLocalDateStr(now);
  const checkPause = (pausedUntil?: string | null) => {
    if (!pausedUntil) return false;
    if (/^\d{4}-\d{2}-\d{2}$/.test(pausedUntil)) {
      return todayStr < pausedUntil;
    }
    return nowIso < pausedUntil;
  };
  return checkPause(settings?.pausedUntil) || checkPause(reminder.pausedUntil);
}

export function isReminderScheduledForDate(reminder: StoredReminder, dateStr: string): boolean {
  if (!reminder.isActive) return false;
  if (reminder.scheduleKind === 'as_needed') return false;
  if (reminder.excludedDates?.[dateStr]) return false;

  const start = reminder.startDate || (reminder.createdAt ? reminder.createdAt.slice(0, 10) : dateStr);
  if (dateStr < start) return false;
  if (reminder.courseEndDate && !reminder.ongoing && dateStr > reminder.courseEndDate) {
    return false;
  }

  if (reminder.customDays === 'weekdays' && Array.isArray(reminder.weekdays) && reminder.weekdays.length > 0) {
    const dow = getDayOfWeekFromDateStr(dateStr);
    return reminder.weekdays.includes(dow);
  }

  return true;
}

export type ReminderDisplayStatus =
  | 'upcoming'
  | 'due_now'
  | 'taken'
  | 'skipped'
  | 'snoozed'
  | 'missed'
  | 'paused';

export function getReminderStatusForDate(
  reminder: StoredReminder,
  dateStr: string,
  settings?: ReminderSettings | null,
  now: Date = new Date()
): ReminderDisplayStatus {
  if (reminder.takenDates?.[dateStr] || (reminder.lastStatus === 'taken' && reminder.lastStatusDate === dateStr)) {
    return 'taken';
  }
  if (reminder.skippedDates?.[dateStr] || (reminder.lastStatus === 'skipped' && reminder.lastStatusDate === dateStr)) {
    return 'skipped';
  }
  if (reminder.missedDates?.[dateStr]) {
    return 'missed';
  }

  const todayStr = getLocalDateStr(now);
  if (isReminderPausedAt(reminder, settings, now)) {
    return 'paused';
  }

  if (dateStr > todayStr) {
    return 'upcoming';
  }

  if (reminder.snoozedUntil && dateStr === todayStr) {
    if (now.toISOString() < reminder.snoozedUntil) {
      return 'snoozed';
    }
  }

  if (dateStr < todayStr) {
    return 'missed';
  }

  // Same day (today)
  const doseMins = parseHHMMToMinutes(reminder.doseTime);
  const effectiveTriggerMins = doseMins - (reminder.remindBeforeMinutes || 0);
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const repeatLimitMins =
    (settings?.repeatMaxCount ?? 2) * (settings?.repeatIntervalMinutes ?? 10) + 15;

  if (nowMins < effectiveTriggerMins) {
    return 'upcoming';
  }
  if (nowMins <= doseMins + repeatLimitMins) {
    return 'due_now';
  }
  return 'missed';
}

export type TimeBucket = 'morning' | 'afternoon' | 'evening' | 'night';

export function getTimeBucketForHHMM(hhmm: string): TimeBucket {
  const mins = parseHHMMToMinutes(hhmm);
  if (mins >= 4 * 60 && mins < 12 * 60) return 'morning';
  if (mins >= 12 * 60 && mins < 17 * 60) return 'afternoon';
  if (mins >= 17 * 60 && mins < 21 * 60) return 'evening';
  return 'night';
}

export function isInQuietHours(hhmm: string, startHHMM: string, endHHMM: string): boolean {
  const val = parseHHMMToMinutes(hhmm);
  const start = parseHHMMToMinutes(startHHMM);
  const end = parseHHMMToMinutes(endHHMM);
  if (start === end) return false;
  if (start < end) {
    return val >= start && val < end;
  }
  // Wraps across midnight, e.g. 22:30 -> 07:00
  return val >= start || val < end;
}

export function getNextDateStrip(baseDate: Date = new Date()): {
  dateStr: string;
  label: string;
  shortDay: string;
  dayNum: string;
}[] {
  const baseStr = getLocalDateStr(baseDate);
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const list = [];
  for (let i = 0; i < 8; i++) {
    const dStr = addLocalDays(baseStr, i);
    const [y, m, d] = dStr.split('-').map((n) => parseInt(n, 10));
    const dt = new Date(y, m - 1, d);
    list.push({
      dateStr: dStr,
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : weekdayNames[dt.getDay()],
      shortDay: weekdayNames[dt.getDay()],
      dayNum: String(d),
    });
  }
  return list;
}

export interface CompletedCourseAlert {
  medicine: StoredMedicine;
  prescription?: StoredPrescription;
  courseEndDate: string;
  hasFollowUp: boolean;
  message: string;
}

/**
 * Finds confirmed finite-course medicines whose last dose has passed so the user sees
 * an explicit doctor-visit alert (never advising stopping or continuing medication on our own).
 */
export function getCompletedCoursesNeedingAlert(
  medicines: StoredMedicine[],
  prescriptions: StoredPrescription[],
  reminders: StoredReminder[],
  now: Date = new Date()
): CompletedCourseAlert[] {
  const todayStr = getLocalDateStr(now);
  const nowTime = getLocalTimeStr(now);
  const results: CompletedCourseAlert[] = [];

  for (const med of medicines) {
    if (!med.confirmed || med.ongoing || med.courseEndAlertDismissed) continue;

    const medReminders = reminders.filter(
      (r) => r.medicineId === med.id && r.source !== 'custom' && !r.ongoing
    );
    const explicitEndDates = medReminders
      .map((r) => r.courseEndDate)
      .filter((d): d is string => Boolean(d))
      .sort();

    let courseEndDate: string | undefined = explicitEndDates[explicitEndDates.length - 1];
    if (!courseEndDate && med.startDate && med.durationDays) {
      courseEndDate = computeCourseEndDate(med.startDate, med.durationDays, false);
    }
    if (!courseEndDate) continue;

    let lastDosePassed = false;
    if (todayStr > courseEndDate) {
      lastDosePassed = true;
    } else if (todayStr === courseEndDate && medReminders.length > 0) {
      const latestTime = [...medReminders]
        .map((r) => r.doseTime)
        .sort()
        .pop();
      if (latestTime && nowTime > addMinutesToHHMM(latestTime, 5)) {
        lastDosePassed = true;
      }
    }

    if (!lastDosePassed) continue;

    const rx = prescriptions.find((p) => p.id === med.prescriptionId);
    const hasFollowUp = Boolean(rx?.followUpText || rx?.followUpDays);
    const message = hasFollowUp
      ? 'Your dose is over. Please visit your doctor.'
      : 'Your course is complete. If you still have symptoms, please visit your doctor.';

    results.push({
      medicine: med,
      prescription: rx,
      courseEndDate,
      hasFollowUp,
      message,
    });
  }

  return results;
}

export interface CustomReminderInput {
  medicineId: string;
  medicineName: string;
  doseTime: string;
  customDays: 'everyday' | 'weekdays' | 'daterange';
  weekdays?: number[];
  startDate: string;
  courseEndDate?: string;
  existingReminders: StoredReminder[];
  editingReminderId?: string;
}

export function validateCustomReminderForm(input: CustomReminderInput): string | null {
  if (!input.medicineName.trim()) {
    return 'Please select a medicine or enter a label.';
  }
  if (!/^\d{2}:\d{2}$/.test(input.doseTime)) {
    return 'Please choose a valid time.';
  }
  if (input.customDays === 'weekdays' && (!input.weekdays || input.weekdays.length === 0)) {
    return 'Please pick at least one day of the week.';
  }
  if (input.customDays === 'daterange') {
    if (!input.startDate || !input.courseEndDate) {
      return 'Please pick both start and end dates.';
    }
    if (input.courseEndDate < input.startDate) {
      return 'End date cannot be before start date.';
    }
  } else if (input.courseEndDate && input.startDate && input.courseEndDate < input.startDate) {
    return 'End date cannot be before start date.';
  }

  const normalizedName = input.medicineName.trim().toLowerCase();
  const duplicate = input.existingReminders.find(
    (r) =>
      r.id !== input.editingReminderId &&
      r.isActive &&
      r.doseTime === input.doseTime &&
      ((input.medicineId && r.medicineId === input.medicineId) ||
        r.medicineName.trim().toLowerCase() === normalizedName)
  );
  if (duplicate) {
    return `A reminder for ${input.medicineName.trim()} is already set at ${input.doseTime}.`;
  }

  return null;
}

/**
 * Formats reminder notification title & body honoring lock-screen privacy toggle,
 * medicine form verbs ("Apply", "Put in the eye"), and target language.
 */
export function buildReminderNotificationPayload(
  reminder: StoredReminder,
  medicine: StoredMedicine | undefined,
  langCode: string,
  hideMedicineNamesInNotifications: boolean
): { title: string; body: string } {
  if (hideMedicineNamesInNotifications) {
    return {
      title: 'PillSync Reminder',
      body: 'Time for your medicine',
    };
  }

  const lang = toSupportedLang(langCode);
  const strengthStr = medicine?.strength ? ` ${medicine.strength}` : '';
  const formId = normalizeFormId(medicine?.form || reminder.medicineForm);
  const formDef = getMedicineFormDef(formId);

  if (formId && isTopicalForm(formId)) {
    const areaEn = resolveApplicationAreaLabel(
      reminder.applicationArea || medicine?.applicationArea || 'affected_area',
      'en'
    );
    const text =
      lang === 'en'
        ? `Time to apply ${reminder.medicineName}${strengthStr} on ${areaEn}.`
        : buildFormAwareReminderAlertText(
            `${reminder.medicineName}${strengthStr}`,
            formId,
            reminder.applicationArea || medicine?.applicationArea,
            lang
          );
    return {
      title: `${reminder.medicineName}${strengthStr} (${reminder.doseTime})`,
      body: text,
    };
  }

  if (lang === 'en') {
    const dosePart = medicine?.dose ? `, ${medicine.dose}` : '';
    const oral = formId ? isOralForm(formId) : isOralForm(reminder.medicineForm);
    const ft =
      oral && reminder.foodTiming && reminder.foodTiming !== 'unspecified'
        ? `, ${reminder.foodTiming}`
        : '';
    const actionPrefix =
      formDef && formDef.verb !== 'Take'
        ? `${formDef.verb}: `
        : 'Time for ';
    return {
      title: `${reminder.medicineName}${strengthStr} (${reminder.doseTime})`,
      body: `${actionPrefix}${reminder.medicineName}${strengthStr}${dosePart}${ft}.`,
    };
  }

  const localizedSentence =
    medicine
      ? buildMedicineSentenceFromTemplate(medicine, lang)
      : reminder.doseSentence ||
        buildFormAwareReminderAlertText(
          reminder.medicineName,
          reminder.medicineForm,
          reminder.applicationArea,
          lang
        );

  return {
    title: `${reminder.medicineName}${strengthStr} (${reminder.doseTime})`,
    body: localizedSentence,
  };
}
