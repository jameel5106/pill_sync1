import assert from 'node:assert/strict';
import {
  DEFAULT_MEAL_TIMES,
  buildReminderNotificationPayload,
  computeCourseEndDate,
  computeDoseTimeForSlot,
  countScheduledDoseOccurrences,
  generateRemindersForMedicine,
  generateRemindersForMedicines,
  getCompletedCoursesNeedingAlert,
  isInQuietHours,
  isReminderScheduledForDate,
  validateCustomReminderForm,
} from '../reminderScheduler';
import { StoredMedicine, StoredPrescription } from '../db';

function makeMed(overrides: Partial<StoredMedicine> = {}): StoredMedicine {
  return {
    id: 'med_test_1',
    prescriptionId: 'rx_test_1',
    userId: 'user_test_1',
    profileId: 'prof_test_1',
    name: 'Paracetamol 500mg',
    form: 'tablet',
    dose: '1 tablet',
    frequency: '1-0-1',
    doseSchedule: { morning: 1, afternoon: 0, night: 1, bedtime: 0 },
    timing: 'after food',
    asNeeded: false,
    durationDays: 5,
    confirmed: true,
    confidence: 1,
    illegible: false,
    createdAt: '2026-11-13T08:00:00.000Z',
    ...overrides,
  };
}

// 1. Food offsets (before -30, after +30, with 0, empty -60)
assert.equal(computeDoseTimeForSlot('morning', 'before food', DEFAULT_MEAL_TIMES, true), '07:30');
assert.equal(computeDoseTimeForSlot('morning', 'after food', DEFAULT_MEAL_TIMES, true), '08:30');
assert.equal(computeDoseTimeForSlot('morning', 'with food', DEFAULT_MEAL_TIMES, true), '08:00');
assert.equal(computeDoseTimeForSlot('morning', 'empty stomach', DEFAULT_MEAL_TIMES, true), '07:00');
assert.equal(computeDoseTimeForSlot('bedtime', 'bedtime', DEFAULT_MEAL_TIMES, true), '22:00');

// 2. 1-0-1 after food x 5 days -> 08:30 & 20:30, 10 occurrences, ends startDate + 4
{
  const med = makeMed();
  const res = generateRemindersForMedicine(med, {
    startDate: '2026-11-13',
    mealTimes: DEFAULT_MEAL_TIMES,
    langCode: 'en',
  });
  assert.equal(res.isAsNeededOnly, false);
  assert.equal(res.scheduledReminders.length, 2);
  assert.deepEqual(
    res.scheduledReminders.map((r) => r.doseTime),
    ['08:30', '20:30']
  );
  assert.equal(res.scheduledReminders[0].courseEndDate, '2026-11-17');
  assert.equal(countScheduledDoseOccurrences(res.scheduledReminders), 10);
  assert.equal(isReminderScheduledForDate(res.scheduledReminders[0], '2026-11-13'), true);
  assert.equal(isReminderScheduledForDate(res.scheduledReminders[0], '2026-11-17'), true);
  assert.equal(isReminderScheduledForDate(res.scheduledReminders[0], '2026-11-18'), false);
}

// 3. 0-0-1 at night (night slot) & bedtime HS
{
  const nightMed = makeMed({
    id: 'med_night',
    frequency: '0-0-1',
    doseSchedule: { morning: 0, afternoon: 0, night: 1, bedtime: 0 },
    timing: 'after food',
  });
  const resNight = generateRemindersForMedicine(nightMed, {
    startDate: '2026-11-13',
    mealTimes: DEFAULT_MEAL_TIMES,
  });
  assert.deepEqual(
    resNight.scheduledReminders.map((r) => r.doseTime),
    ['20:30']
  );

  const bedtimeMed = makeMed({
    id: 'med_hs',
    frequency: '0-0-0-1',
    doseSchedule: { morning: 0, afternoon: 0, night: 0, bedtime: 1 },
    timing: 'bedtime',
  });
  const resHs = generateRemindersForMedicine(bedtimeMed, {
    startDate: '2026-11-13',
    mealTimes: DEFAULT_MEAL_TIMES,
  });
  assert.deepEqual(
    resHs.scheduledReminders.map((r) => r.doseTime),
    ['22:00']
  );
}

// 4. Interval schedule ("every 8 hours" / q8h) anchored on user's firstDoseTime
{
  const q8hMed = makeMed({
    id: 'med_q8h',
    name: 'Amoxicillin 500mg',
    frequency: 'every 8 hours',
    doseSchedule: null,
    timing: 'after food',
    durationDays: 5,
  });
  const res = generateRemindersForMedicine(q8hMed, {
    startDate: '2026-11-13',
    firstDoseTime: '07:00',
    mealTimes: DEFAULT_MEAL_TIMES,
  });
  assert.equal(res.isAsNeededOnly, false);
  assert.deepEqual(
    res.scheduledReminders.map((r) => r.doseTime),
    ['07:00', '15:00', '23:00']
  );
  assert.equal(res.scheduledReminders.every((r) => r.slotKey === 'interval'), true);
}

// 5. SOS / PRN medicines get zero automatic fixed reminders
{
  const sosMed = makeMed({
    id: 'med_sos',
    name: 'Dolo 650',
    frequency: 'SOS',
    doseSchedule: null,
    asNeeded: true,
    durationDays: undefined,
  });
  const res = generateRemindersForMedicine(sosMed, {
    startDate: '2026-11-13',
    mealTimes: DEFAULT_MEAL_TIMES,
  });
  assert.equal(res.isAsNeededOnly, true);
  assert.equal(res.scheduledReminders.length, 0);
}

// 6. Topical form (lotion) uses base meal times, ignores food offsets, uses "Apply" verb
{
  const lotionMed = makeMed({
    id: 'med_lotion',
    name: 'Calamine Lotion',
    form: 'lotion',
    applicationArea: 'affected_area',
    dose: 'thin layer',
    frequency: 'BD',
    doseSchedule: { morning: 1, afternoon: 0, night: 1, bedtime: 0 },
    timing: 'after food', // even if accidentally marked, topical treats as unspecified
    durationDays: 5,
  });
  const res = generateRemindersForMedicine(lotionMed, {
    startDate: '2026-11-13',
    mealTimes: DEFAULT_MEAL_TIMES,
  });
  assert.equal(res.scheduledReminders.length, 2);
  assert.deepEqual(
    res.scheduledReminders.map((r) => r.doseTime),
    ['08:00', '20:00']
  );
  assert.equal(res.scheduledReminders[0].foodTiming, 'unspecified');

  const notif = buildReminderNotificationPayload(res.scheduledReminders[0], lotionMed, 'en', false);
  assert.match(notif.body, /Time to apply Calamine Lotion/i);
  assert.doesNotMatch(notif.body, /after food/i);
}

// 7. Course end date formula & ongoing fallback
assert.equal(computeCourseEndDate('2026-11-13', 5, false), '2026-11-17');
assert.equal(computeCourseEndDate('2026-11-13', undefined, true), undefined);
{
  const ongoingMed = makeMed({ id: 'med_ongoing', durationDays: undefined, ongoing: true });
  const res = generateRemindersForMedicine(ongoingMed, { startDate: '2026-11-13' });
  assert.equal(res.scheduledReminders[0].ongoing, true);
  assert.equal(res.scheduledReminders[0].courseEndDate, undefined);
  assert.equal(isReminderScheduledForDate(res.scheduledReminders[0], '2026-12-30'), true);
}

// 8. Edited meal times shift auto-generated slot reminders accurately
{
  const shiftedMeals = { ...DEFAULT_MEAL_TIMES, breakfast: '09:00', dinner: '21:00' };
  const med = makeMed();
  const res = generateRemindersForMedicine(med, {
    startDate: '2026-11-13',
    mealTimes: shiftedMeals,
  });
  assert.deepEqual(
    res.scheduledReminders.map((r) => r.doseTime),
    ['09:30', '21:30']
  );
}

// 9. Lock-screen privacy mode & Quiet hours window checks
{
  const med = makeMed();
  const res = generateRemindersForMedicine(med, { startDate: '2026-11-13' });
  const hiddenPayload = buildReminderNotificationPayload(
    res.scheduledReminders[0],
    med,
    'en',
    true
  );
  assert.equal(hiddenPayload.body, 'Time for your medicine');
  assert.equal(isInQuietHours('23:30', '22:30', '07:00'), true);
  assert.equal(isInQuietHours('06:15', '22:30', '07:00'), true);
  assert.equal(isInQuietHours('14:00', '22:30', '07:00'), false);
}

// 10. Validation checks (duplicate same med + time, end date < start date, empty subject)
{
  const med = makeMed();
  const gen = generateRemindersForMedicines([med], { startDate: '2026-11-13' });
  assert.equal(
    validateCustomReminderForm({
      medicineId: med.id,
      medicineName: med.name,
      doseTime: '08:30',
      customDays: 'everyday',
      startDate: '2026-11-13',
      existingReminders: gen.reminders,
    }) !== null,
    true
  );
  assert.equal(
    validateCustomReminderForm({
      medicineId: med.id,
      medicineName: med.name,
      doseTime: '11:00',
      customDays: 'daterange',
      startDate: '2026-11-15',
      courseEndDate: '2026-11-13',
      existingReminders: gen.reminders,
    }),
    'End date cannot be before start date.'
  );
  assert.equal(
    validateCustomReminderForm({
      medicineId: 'custom_1',
      medicineName: 'Doctor visit',
      doseTime: '10:00',
      customDays: 'everyday',
      startDate: '2026-11-13',
      existingReminders: gen.reminders,
    }),
    null
  );
}

// 11. Course-end doctor visit wording (with follow-up vs without follow-up)
{
  const medDone = makeMed({
    id: 'med_done_1',
    prescriptionId: 'rx_followup',
    startDate: '2026-11-01',
    durationDays: 5,
    ongoing: false,
  });
  const rxWithFollowUp: StoredPrescription = {
    id: 'rx_followup',
    userId: 'user_test_1',
    profileId: 'prof_test_1',
    prescriptionDate: '2026-11-01',
    imageBase64: '',
    fileSizeBytes: 0,
    status: 'confirmed',
    followUpText: 'Review after 5 days',
    followUpDays: 5,
    createdAt: '2026-11-01T08:00:00.000Z',
  };
  const alerts1 = getCompletedCoursesNeedingAlert(
    [medDone],
    [rxWithFollowUp],
    [],
    new Date('2026-11-13T10:00:00')
  );
  assert.equal(alerts1.length, 1);
  assert.equal(alerts1[0].message, 'Your dose is over. Please visit your doctor.');

  const rxNoFollowUp: StoredPrescription = { ...rxWithFollowUp, followUpText: undefined, followUpDays: undefined };
  const alerts2 = getCompletedCoursesNeedingAlert(
    [medDone],
    [rxNoFollowUp],
    [],
    new Date('2026-11-13T10:00:00')
  );
  assert.equal(alerts2.length, 1);
  assert.equal(
    alerts2[0].message,
    'Your course is complete. If you still have symptoms, please visit your doctor.'
  );
}

console.log('✓ All reminderScheduler unit tests passed!');
