/**
 * Real Medication Reminders & Alarm Delivery Service for PillSync.
 * 1. Web Audio API looping alarm + single chime (stops immediately when user acts).
 * 2. Browser Notification API + Service Worker actions (Taken / Snooze 10 min / Skip).
 * 3. Scheduled TimestampTrigger & Periodic Background Sync where supported.
 * 4. Standard RFC 5545 iCalendar (.ics) export (per-medicine & all reminders).
 * 5. Active foreground reminder, snooze, repeat (up to 2x, 10 min apart -> Missed) engine.
 */

import { ReminderSettings, StoredMedicine, StoredReminder } from './db';
import {
  GLOSSARY_TERMS,
  toSupportedLang,
} from '../translations/glossary';
import {
  getMedicineFormDef,
  isFoodTimingApplicable,
  isTopicalForm,
  resolveApplicationAreaLabel,
} from '../config/medicineForms';
import {
  buildReminderNotificationPayload,
  getLocalDateStr,
  getLocalTimeStr,
  isInQuietHours,
  isReminderPausedAt,
  isReminderScheduledForDate,
  minutesToHHMM,
  parseHHMMToMinutes,
} from './reminderScheduler';

export type NotificationCapabilityStatus =
  | 'working'
  | 'needs_permission'
  | 'denied'
  | 'not_supported'
  | 'installed_recommended';

export class ReminderService {
  private audioCtx: AudioContext | null = null;
  private checkIntervalId: number | null = null;
  private alarmLoopId: number | null = null;
  private triggeredKeysToday = new Set<string>();
  private lastClearedDateStr = '';

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  playChime(): void {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.28, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.55);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1320, now + 0.14);
      gain2.gain.setValueAtTime(0.32, now + 0.14);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.14);
      osc2.stop(now + 0.85);
    } catch (e) {
      console.warn('Audio playback not permitted yet or failed:', e);
    }
  }

  startLoopingAlarm(soundEnabled = true, vibrationEnabled = true): void {
    this.stopLoopingAlarm();
    if (soundEnabled) {
      this.playChime();
    }
    if (vibrationEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([250, 120, 250]);
      } catch {}
    }

    this.alarmLoopId = window.setInterval(() => {
      if (soundEnabled) {
        this.playChime();
      }
      if (vibrationEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([200, 100, 200]);
        } catch {}
      }
    }, 3000);
  }

  stopLoopingAlarm(): void {
    if (this.alarmLoopId !== null) {
      clearInterval(this.alarmLoopId);
      this.alarmLoopId = null;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(0);
      } catch {}
    }
  }

  getNotificationPermission(): NotificationPermission | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  isStandaloneInstalled(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  }

  getCapabilityStatus(): NotificationCapabilityStatus {
    const perm = this.getNotificationPermission();
    if (perm === 'unsupported') return 'not_supported';
    if (perm === 'denied') return 'denied';
    if (perm === 'default') return 'needs_permission';
    if (!this.isStandaloneInstalled()) return 'installed_recommended';
    return 'working';
  }

  async requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  }

  async showServiceWorkerOrBrowserNotification(
    title: string,
    body: string,
    meta?: {
      reminderId?: string;
      userId?: string;
      dateStr?: string;
      tag?: string;
      vibrate?: boolean;
    }
  ): Promise<void> {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const payload = {
      type: 'SCHEDULE_MEDICINE_NOTIFICATION',
      title,
      body,
      tag: meta?.tag || `pillsync-rem-${meta?.reminderId || 'test'}`,
      reminderId: meta?.reminderId,
      userId: meta?.userId,
      dateStr: meta?.dateStr || getLocalDateStr(),
      vibrate: meta?.vibrate !== false,
    };

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.showNotification) {
          await reg.showNotification(title, {
            body,
            tag: payload.tag,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            requireInteraction: true,
            actions: meta?.reminderId
              ? [
                  { action: 'taken', title: 'Taken' },
                  { action: 'snooze', title: 'Snooze 10 min' },
                  { action: 'skip', title: 'Skip' },
                ]
              : undefined,
            data: payload,
          } as NotificationOptions);
          return;
        }
      }
    } catch (err) {
      console.warn('SW showNotification fallback to Notification():', err);
    }

    try {
      new Notification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: payload.tag,
      });
    } catch (err) {
      console.warn('Notification display failed:', err);
    }
  }

  async sendTestReminder(langCode = 'en', soundEnabled = true, vibrationEnabled = true): Promise<void> {
    const lang = toSupportedLang(langCode);
    const takeWord = GLOSSARY_TERMS.take[lang];
    const body =
      lang === 'en'
        ? 'Your medication reminder system is working properly! PillSync is ready to alert you on time.'
        : `PillSync (${takeWord}) — Reminder chime and notifications active.`;

    if (soundEnabled) this.playChime();
    if (vibrationEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([200, 100, 200]);
      } catch {}
    }

    await this.showServiceWorkerOrBrowserNotification('PillSync Test Reminder', body, {
      tag: `pillsync-test-${Date.now()}`,
      vibrate: vibrationEnabled,
    });
  }

  /**
   * Pushes rebuilt schedule to the Service Worker so future notifications
   * (where TimestampTrigger is supported) and Periodic Sync stay in sync with IndexedDB.
   */
  async syncNotificationScheduleToSW(
    reminders: StoredReminder[],
    medicines: StoredMedicine[],
    settings: ReminderSettings,
    resolveLanguageFn: (rxId?: string, profId?: string) => string
  ): Promise<void> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;

      // Register periodic background sync if browser supports it
      if ('periodicSync' in reg) {
        try {
          await (reg as any).periodicSync.register('pillsync-reminder-check', {
            minInterval: 15 * 60 * 1000,
          });
        } catch {
          // Safe ignore when permission or platform doesn't grant periodic-background-sync
        }
      }

      if (!settings.masterEnabled || Notification.permission !== 'granted') {
        reg.active?.postMessage({ type: 'REBUILD_NOTIFICATION_SCHEDULE', items: [] });
        return;
      }

      const now = new Date();
      const todayStr = getLocalDateStr(now);
      const tomorrowStr = getLocalDateStr(new Date(now.getTime() + 86400000));
      const items: any[] = [];

      for (const dateStr of [todayStr, tomorrowStr]) {
        const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
        for (const r of reminders) {
          if (!isReminderScheduledForDate(r, dateStr)) continue;
          if (r.takenDates?.[dateStr] || r.skippedDates?.[dateStr]) continue;
          if (isReminderPausedAt(r, settings, now)) continue;

          if (
            settings.quietHoursEnabled &&
            !r.isImportant &&
            isInQuietHours(r.doseTime, settings.quietHoursStart, settings.quietHoursEnd)
          ) {
            continue;
          }

          const triggerMins = parseHHMMToMinutes(r.doseTime) - (r.remindBeforeMinutes || 0);
          const wrappedH = Math.floor((((triggerMins % 1440) + 1440) % 1440) / 60);
          const wrappedM = (((triggerMins % 1440) + 1440) % 1440) % 60;
          const fireDate = new Date(y, m - 1, d, wrappedH, wrappedM, 0, 0);
          if (fireDate.getTime() <= now.getTime()) continue;

          const med = medicines.find((x) => x.id === r.medicineId);
          const langCode = resolveLanguageFn(r.prescriptionId, r.profileId);
          const payload = buildReminderNotificationPayload(
            r,
            med,
            langCode,
            settings.hideMedicineNamesInNotifications
          );

          items.push({
            title: payload.title,
            body: payload.body,
            tag: `pillsync-rem-${r.id}-${dateStr}`,
            timestamp: fireDate.getTime(),
            reminderId: r.id,
            userId: r.userId,
            dateStr,
            vibrate: settings.vibrationEnabled,
          });
        }
      }

      reg.active?.postMessage({
        type: 'REBUILD_NOTIFICATION_SCHEDULE',
        items,
      });
    } catch (err) {
      console.warn('[ReminderService] SW sync warning:', err);
    }
  }

  generateIcsCalendar(reminders: StoredReminder[], calendarTitle = 'PillSync Medication Schedule'): string {
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PillSync//Prescription Schedule//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${calendarTitle}`,
      `X-WR-TIMEZONE:${reminders[0]?.timezone || 'Asia/Kolkata'}`,
    ];

    const fallbackToday = getLocalDateStr();

    for (const r of reminders) {
      if (!r.isActive || r.scheduleKind === 'as_needed') continue;
      const startDateClean = (r.startDate || fallbackToday).replace(/-/g, '');
      const [hours, minutes] = (r.doseTime || '08:00').split(':');
      const timeClean = `${(hours || '08').padStart(2, '0')}${(minutes || '00').padStart(2, '0')}00`;
      const uid = `pillsync_${r.id}_${startDateClean}@pillsync.app`;
      const tzid = r.timezone || 'Asia/Kolkata';

      let repeatCount = 14;
      if (r.startDate && r.courseEndDate && !r.ongoing) {
        const [sy, sm, sd] = r.startDate.split('-').map((n) => parseInt(n, 10));
        const [ey, em, ed] = r.courseEndDate.split('-').map((n) => parseInt(n, 10));
        if (sy && ey) {
          repeatCount = Math.max(
            1,
            Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000) + 1
          );
        }
      }

      const isTopical = isTopicalForm(r.medicineForm);
      const formDef = getMedicineFormDef(r.medicineForm);
      const verb = formDef?.verb || 'Take';
      const areaEn = resolveApplicationAreaLabel(r.applicationArea || 'affected_area', 'en');
      const hasFoodTiming =
        isFoodTimingApplicable(r.medicineForm) &&
        r.foodTiming &&
        r.foodTiming !== 'unspecified' &&
        r.foodTiming !== 'not_food_related';

      const summaryLine = `${verb} ${r.medicineName}`;
      const alarmDescLine = isTopical
        ? `Time to apply ${r.medicineName} on ${areaEn}.`
        : `Reminder: ${verb} ${r.medicineName}`;
      const eventDescLine = isTopical
        ? `Time to apply ${r.medicineName} on ${areaEn}. Always confirm with your doctor or pharmacist.`
        : `PillSync Dose Reminder: ${r.medicineName}${
            hasFoodTiming ? ` (${r.foodTiming})` : ''
          }. Always confirm with your doctor or pharmacist.`;

      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${startDateClean}T000000Z`,
        `DTSTART;TZID=${tzid}:${startDateClean}T${timeClean}`,
        `SUMMARY:${summaryLine}`,
        `DESCRIPTION:${eventDescLine}`,
        `RRULE:FREQ=DAILY;COUNT=${repeatCount}`,
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${alarmDescLine}`,
        `TRIGGER:-PT${r.remindBeforeMinutes || 0}M`,
        'END:VALARM',
        'END:VEVENT'
      );
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  downloadIcsFile(reminders: StoredReminder[], filename = 'PillSync_Medication_Schedule.ics', title?: string): void {
    const icsContent = this.generateIcsCalendar(reminders, title);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Starts foreground interval checking for due doses, snoozed doses, and repeat alerts
   * (up to settings.repeatMaxCount repeats, settings.repeatIntervalMinutes apart, then Missing).
   */
  startActiveReminderEngine(params: {
    getReminders: () => StoredReminder[];
    getMedicines: () => StoredMedicine[];
    getSettings: () => ReminderSettings;
    getLanguageForReminder: (reminder: StoredReminder) => string;
    onTriggerAlarm: (reminder: StoredReminder, isRepeat: boolean) => void;
    onAutoMarkMissed: (reminder: StoredReminder, dateStr: string) => void;
  }): void {
    if (this.checkIntervalId) clearInterval(this.checkIntervalId);

    const runTick = () => {
      const settings = params.getSettings();
      if (!settings.masterEnabled) return;

      const now = new Date();
      const todayStr = getLocalDateStr(now);
      const currentTimeStr = getLocalTimeStr(now);
      const nowMins = now.getHours() * 60 + now.getMinutes();

      if (this.lastClearedDateStr !== todayStr) {
        this.triggeredKeysToday.clear();
        this.lastClearedDateStr = todayStr;
      }

      const reminders = params.getReminders();
      const medicines = params.getMedicines();

      for (const r of reminders) {
        if (!isReminderScheduledForDate(r, todayStr)) continue;
        if (r.takenDates?.[todayStr] || r.skippedDates?.[todayStr] || r.missedDates?.[todayStr]) {
          continue;
        }
        if (isReminderPausedAt(r, settings, now)) continue;

        if (
          settings.quietHoursEnabled &&
          !r.isImportant &&
          isInQuietHours(r.doseTime, settings.quietHoursStart, settings.quietHoursEnd)
        ) {
          continue;
        }

        const med = medicines.find((m) => m.id === r.medicineId);
        const langCode = params.getLanguageForReminder(r);

        // 1. Check active Snooze expiry first
        if (r.snoozedUntil && now.toISOString() >= r.snoozedUntil) {
          const snoozeKey = `${r.id}|${todayStr}|snooze|${r.snoozedUntil}`;
          if (!this.triggeredKeysToday.has(snoozeKey)) {
            this.triggeredKeysToday.add(snoozeKey);
            const payload = buildReminderNotificationPayload(
              r,
              med,
              langCode,
              settings.hideMedicineNamesInNotifications
            );
            this.startLoopingAlarm(
              r.soundEnabled ?? settings.soundEnabled,
              settings.vibrationEnabled
            );
            this.showServiceWorkerOrBrowserNotification(payload.title, payload.body, {
              reminderId: r.id,
              userId: r.userId,
              dateStr: todayStr,
              tag: `pillsync-rem-${r.id}-${todayStr}`,
              vibrate: settings.vibrationEnabled,
            });
            params.onTriggerAlarm(r, true);
          }
          continue;
        }

        // 2. Check primary trigger & repeat triggers
        const baseMins = parseHHMMToMinutes(r.doseTime) - (r.remindBeforeMinutes || 0);
        const repeatGap = Math.max(1, settings.repeatIntervalMinutes || 10);
        const maxRepeats = Math.max(0, settings.repeatMaxCount ?? 2);

        // Past all repeats -> mark Missed (never Taken!)
        const finalCutoffMins = baseMins + (maxRepeats + 1) * repeatGap;
        if (nowMins >= finalCutoffMins) {
          const missedKey = `${r.id}|${todayStr}|missed`;
          if (!this.triggeredKeysToday.has(missedKey)) {
            this.triggeredKeysToday.add(missedKey);
            params.onAutoMarkMissed(r, todayStr);
          }
          continue;
        }

        for (let attempt = 0; attempt <= maxRepeats; attempt++) {
          const checkHHMM = minutesToHHMM(baseMins + attempt * repeatGap);
          if (checkHHMM === currentTimeStr) {
            const trigKey = `${r.id}|${todayStr}|att_${attempt}`;
            if (!this.triggeredKeysToday.has(trigKey)) {
              this.triggeredKeysToday.add(trigKey);
              const payload = buildReminderNotificationPayload(
                r,
                med,
                langCode,
                settings.hideMedicineNamesInNotifications
              );
              this.startLoopingAlarm(
                r.soundEnabled ?? settings.soundEnabled,
                settings.vibrationEnabled
              );
              this.showServiceWorkerOrBrowserNotification(payload.title, payload.body, {
                reminderId: r.id,
                userId: r.userId,
                dateStr: todayStr,
                tag: `pillsync-rem-${r.id}-${todayStr}`,
                vibrate: settings.vibrationEnabled,
              });
              params.onTriggerAlarm(r, attempt > 0);
            }
            break;
          }
        }
      }
    };

    runTick();
    this.checkIntervalId = window.setInterval(runTick, 20000);
  }

  stopActiveReminderEngine(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
    this.stopLoopingAlarm();
  }
}

export const reminderService = new ReminderService();
