// Offline Health Assistant Engine
// When offline: answers schedule/medication questions directly from local IndexedDB data!
// For general queries: clearly indicates that internet is required for external AI.

import { StoredMedicine, StoredReminder } from './db';

export interface AssistantAnswer {
  text: string;
  isOfflineAnswer: boolean;
  needsInternet?: boolean;
}

export class OfflineAssistantService {
  /**
   * Process a user health question
   */
  async answerQuestion(
    query: string,
    medicines: StoredMedicine[],
    reminders: StoredReminder[]
  ): Promise<AssistantAnswer> {
    const q = query.toLowerCase().trim();
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    // 1. Next Dose Queries (Works 100% offline)
    if (
      q.includes('next dose') ||
      q.includes('next medicine') ||
      q.includes('when is my') ||
      q.includes('what medicine next') ||
      q.includes('agla dose') ||
      q.includes('अगली दवा')
    ) {
      return this.getNextDoseAnswer(reminders);
    }

    // 2. Today's Medicines / Schedule Queries (Works 100% offline)
    if (
      q.includes('today') ||
      q.includes('schedule') ||
      q.includes('what medicines') ||
      q.includes('which medicines') ||
      q.includes('list medicines') ||
      q.includes('आज की दवा')
    ) {
      return this.getTodayScheduleAnswer(medicines, reminders);
    }

    // 3. Course Status Queries (Works 100% offline)
    if (q.includes('course') || q.includes('how many days') || q.includes('revisit') || q.includes('doctor visit')) {
      return this.getCourseStatusAnswer(medicines);
    }

    // 4. If offline and general query: explain internet limit honestly
    if (!isOnline) {
      return {
        text: 'Needs internet to consult external medical AI. However, your local schedule and medication alarms remain fully operational on this device! You can ask "What is my next dose?" or "What medicines today?" anytime offline.',
        isOfflineAnswer: true,
        needsInternet: true,
      };
    }

    // 5. If online, provide local intelligent answer
    return {
      text: `Based on your active records, you have ${medicines.filter((m) => m.confirmed).length} confirmed medicines. Always take your medications as directed by your doctor. Ask "what is my next dose" to check upcoming times.`,
      isOfflineAnswer: false,
    };
  }

  private getNextDoseAnswer(reminders: StoredReminder[]): AssistantAnswer {
    const active = reminders.filter((r) => r.isActive);
    if (active.length === 0) {
      return {
        text: 'You have no upcoming doses scheduled. Please scan a prescription or add a medicine manually.',
        isOfflineAnswer: true,
      };
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Find the next reminder after current time
    const sorted = [...active].sort((a, b) => {
      const [ah, am] = a.doseTime.split(':').map(Number);
      const [bh, bm] = b.doseTime.split(':').map(Number);
      return ah * 60 + am - (bh * 60 + bm);
    });

    const nextOne = sorted.find((r) => {
      const [h, m] = r.doseTime.split(':').map(Number);
      return h * 60 + m >= currentMinutes && r.lastStatus !== 'taken';
    }) || sorted[0]; // Roll over to tomorrow's first

    return {
      text: `Your next scheduled dose is **${nextOne.medicineName}** at **${nextOne.doseTime}** (${nextOne.foodTiming}).`,
      isOfflineAnswer: true,
    };
  }

  private getTodayScheduleAnswer(
    medicines: StoredMedicine[],
    reminders: StoredReminder[]
  ): AssistantAnswer {
    const confirmed = medicines.filter((m) => m.confirmed);
    if (confirmed.length === 0) {
      return {
        text: 'No active medicines recorded yet. You can scan a handwritten prescription or tap "+ Add Medicine" to start.',
        isOfflineAnswer: true,
      };
    }

    const list = reminders
      .map((r) => `• ${r.doseTime}: ${r.medicineName} (${r.foodTiming}) - Status: ${r.lastStatus || 'pending'}`)
      .join('\n');

    return {
      text: `Here is your schedule for today (${confirmed.length} active medicines):\n\n${list}`,
      isOfflineAnswer: true,
    };
  }

  private getCourseStatusAnswer(medicines: StoredMedicine[]): AssistantAnswer {
    const confirmed = medicines.filter((m) => m.confirmed && m.durationDays);
    if (confirmed.length === 0) {
      return {
        text: 'You do not have any fixed duration courses active. Ongoing medicines will continue until advised by your doctor.',
        isOfflineAnswer: true,
      };
    }

    const summary = confirmed
      .map((m) => `• ${m.name}: ${m.durationDays} days total course`)
      .join('\n');

    return {
      text: `Active Treatment Courses:\n${summary}\n\nPillSync will alert you automatically when any course completes so you can revisit your doctor.`,
      isOfflineAnswer: true,
    };
  }
}

export const offlineAssistant = new OfflineAssistantService();
