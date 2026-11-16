/**
 * Real IndexedDB persistence service for PillSync.
 * Scopes all records strictly per signed-in user (owner-only access) under DPDP Act 2023.
 * Full offline-first support with WebCrypto encryption, dose logging, and offline scan queue.
 */
import { prescriptionCrypto } from './crypto';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  pinHash?: string;
  dpdpConsent: {
    accepted: boolean;
    timestamp: string;
    version: string;
  };
  preferredLanguage: string;
  createdAt: string;
}

export interface PatientProfile {
  id: string;
  userId: string;
  name: string;
  relation: 'Self' | 'Mother' | 'Father' | 'Spouse' | 'Child' | 'Other';
  age: number;
  language: string;
  isDefault: boolean;
  createdAt: string;
}

export interface StoredPrescription {
  id: string;
  userId: string;
  profileId: string;
  doctorName?: string;
  clinic?: string;
  doctorRegistrationNumber?: string;
  patientName?: string;
  patientAge?: string;
  patientSex?: string;
  prescriptionDate: string;
  imageBase64: string;
  fileSizeBytes: number;
  status: 'waiting_to_read' | 'uploaded' | 'needsReview' | 'confirmed';
  imageQuality?: string;
  warnings?: string[];
  followUpText?: string;
  followUpDays?: number;
  notes?: string;
  preferredLanguage?: string;
  isEncrypted?: boolean;
  offlineQueuedAt?: string;
  createdAt: string;
}

export interface StoredMedicine {
  id: string;
  prescriptionId: string;
  userId: string;
  profileId: string;
  rawText?: string;
  name: string;
  nameAsRead?: string;
  nameCorrected?: boolean;
  genericName?: string;
  strength?: string;
  form?: string;
  applicationArea?: string;
  formCorrected?: boolean;
  route?: string;
  dose?: string;
  frequency?: string;
  frequencyPlain?: string;
  doseSchedule?: {
    morning?: number | null;
    afternoon?: number | null;
    night?: number | null;
    bedtime?: number | null;
  } | null;
  timesPerDay?: number;
  timing?: string; // 'before food' | 'after food' | 'with food' | 'empty stomach' | 'bedtime' | 'unspecified'
  timingSuggested?: boolean;
  timingSuggestionSource?: 'reference' | 'ai';
  asNeeded?: boolean;
  durationDays?: number;
  durationText?: string;
  instructions?: string;
  confidence: number;
  illegible: boolean;
  flags?: string[];
  startDate?: string; // YYYY-MM-DD local wall-clock
  ongoing?: boolean;
  isImportant?: boolean;
  courseEndAlertDismissed?: boolean;
  confirmed: boolean;
  createdAt: string;
}

export interface StoredReminder {
  id: string;
  medicineId: string;
  prescriptionId: string;
  userId: string;
  profileId: string;
  medicineName: string;
  medicineForm?: string;
  applicationArea?: string;
  doseSentence?: string;
  doseTime: string; // Local wall-clock "HH:MM" e.g. "08:30"
  foodTiming: string; // "before food" | "after food" | "with food" | "empty stomach" | "bedtime" | "unspecified"
  timingSuggested?: boolean;
  remindBeforeMinutes: number; // 0, 5, 10, 15, 30
  repeatMinutes: number; // 0 (off), 5, 10
  quietHoursStart?: string;
  quietHoursEnd?: string;
  isActive: boolean;
  source?: 'auto' | 'custom';
  scheduleKind?: 'scheduled' | 'as_needed';
  slotKey?: 'morning' | 'afternoon' | 'night' | 'bedtime' | 'interval' | 'custom';
  label?: string;
  customDays?: 'everyday' | 'weekdays' | 'daterange';
  weekdays?: number[]; // 0=Sun..6=Sat
  startDate?: string; // YYYY-MM-DD local wall-clock
  courseEndDate?: string; // YYYY-MM-DD local wall-clock
  ongoing?: boolean;
  timezone?: string; // IANA timezone e.g. "Asia/Kolkata"
  soundEnabled?: boolean;
  isImportant?: boolean;
  pausedUntil?: string | null; // ISO timestamp or YYYY-MM-DD
  snoozedUntil?: string | null; // ISO timestamp when snoozed
  snoozeCount?: number; // number of repeats/snoozes fired for current slot
  skippedDates?: Record<string, boolean>;
  excludedDates?: Record<string, boolean>; // when "Only this dose" was split out
  takenDates?: Record<string, { takenAt: string; actualTime?: string }>;
  missedDates?: Record<string, 'missed' | 'unsure'>;
  lastStatus?: 'pending' | 'taken' | 'skipped' | 'snoozed' | 'missed';
  lastStatusDate?: string;
  createdAt: string;
}

export interface MealTimesConfig {
  wake: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  bedtime: string;
}

export interface ReminderSettings {
  userId: string;
  masterEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  snoozeDefaultMinutes: 5 | 10 | 15;
  repeatMaxCount: number;
  repeatIntervalMinutes: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  hideMedicineNamesInNotifications: boolean;
  mealTimes: MealTimesConfig;
  pausedUntil?: string | null;
  lastKnownTimezone?: string;
}

export interface DoseLog {
  id: string;
  userId: string;
  reminderId?: string;
  prescriptionId?: string;
  profileId?: string;
  medicineId: string;
  medicineName: string;
  action: 'taken' | 'skipped' | 'unsure';
  scheduledTime: string;
  actualTimeStr?: string;
  actualTimestamp: string;
  dateStr: string; // YYYY-MM-DD
  source?: 'auto' | 'custom';
}

export interface LocalChatMessage {
  id: string;
  userId: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  answeredOffline?: boolean;
}

export interface CloudBackupConfig {
  userId: string;
  enabled: boolean;
  lastSyncedAt?: string;
  syncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
}

export interface CachedTranslation {
  id: string; // `${medicineId}_${languageCode}`
  medicineId: string;
  languageCode: string;
  medicineHash: string; // for cache invalidation when medicine is edited
  transliteratedName: string;
  translatedInstructions: string;
  hasNumberWarning?: boolean;
  missingNumbers?: string[];
  translatedAt: string;
}

const DB_NAME = 'PillSync_DB_v2';
const DB_VERSION = 4;

class PillSyncDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
          const db = (e.target as IDBOpenDBRequest).result;

          if (!db.objectStoreNames.contains('users')) {
            const userStore = db.createObjectStore('users', { keyPath: 'id' });
            userStore.createIndex('email', 'email', { unique: true });
          }

          if (!db.objectStoreNames.contains('profiles')) {
            const profileStore = db.createObjectStore('profiles', { keyPath: 'id' });
            profileStore.createIndex('userId', 'userId', { unique: false });
          }

          if (!db.objectStoreNames.contains('prescriptions')) {
            const rxStore = db.createObjectStore('prescriptions', { keyPath: 'id' });
            rxStore.createIndex('userId', 'userId', { unique: false });
            rxStore.createIndex('status', 'status', { unique: false });
          }

          if (!db.objectStoreNames.contains('medicines')) {
            const medStore = db.createObjectStore('medicines', { keyPath: 'id' });
            medStore.createIndex('userId', 'userId', { unique: false });
            medStore.createIndex('prescriptionId', 'prescriptionId', { unique: false });
          }

          if (!db.objectStoreNames.contains('reminders')) {
            const remStore = db.createObjectStore('reminders', { keyPath: 'id' });
            remStore.createIndex('userId', 'userId', { unique: false });
          }

          if (!db.objectStoreNames.contains('doseLogs')) {
            const logStore = db.createObjectStore('doseLogs', { keyPath: 'id' });
            logStore.createIndex('userId', 'userId', { unique: false });
            logStore.createIndex('dateStr', 'dateStr', { unique: false });
          }

          if (!db.objectStoreNames.contains('chatHistory')) {
            const chatStore = db.createObjectStore('chatHistory', { keyPath: 'id' });
            chatStore.createIndex('userId', 'userId', { unique: false });
          }

          if (!db.objectStoreNames.contains('cloudBackup')) {
            db.createObjectStore('cloudBackup', { keyPath: 'userId' });
          }

          if (!db.objectStoreNames.contains('translations')) {
            const transStore = db.createObjectStore('translations', { keyPath: 'id' });
            transStore.createIndex('medicineId', 'medicineId', { unique: false });
            transStore.createIndex('languageCode', 'languageCode', { unique: false });
          }

          if (!db.objectStoreNames.contains('reminderSettings')) {
            db.createObjectStore('reminderSettings', { keyPath: 'userId' });
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbPromise;
  }

  // ---------------- USER OPERATIONS ----------------

  async saveUser(user: UserAccount): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readwrite');
      tx.objectStore('users').put(user);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getUserByEmail(email: string): Promise<UserAccount | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readonly');
      const req = tx.objectStore('users').index('email').get(email.toLowerCase().trim());
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(tx.error);
    });
  }

  async getUserById(id: string): Promise<UserAccount | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readonly');
      const req = tx.objectStore('users').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(tx.error);
    });
  }

  // ---------------- PROFILE OPERATIONS ----------------

  async saveProfile(profile: PatientProfile): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('profiles', 'readwrite');
      tx.objectStore('profiles').put(profile);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getProfiles(userId: string): Promise<PatientProfile[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('profiles', 'readonly');
      const req = tx.objectStore('profiles').index('userId').getAll(userId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(tx.error);
    });
  }

  async deleteProfile(userId: string, profileId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('profiles', 'readwrite');
      const store = tx.objectStore('profiles');
      const req = store.get(profileId);
      req.onsuccess = () => {
        if (req.result && req.result.userId === userId) {
          store.delete(profileId);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ---------------- PRESCRIPTION OPERATIONS WITH ENCRYPTION ----------------

  async savePrescription(prescription: StoredPrescription, encryptionKey?: string): Promise<void> {
    const db = await this.getDB();

    // Encrypt sensitive imagery and doctor notes if a key is provided
    let imageToStore = prescription.imageBase64;
    let notesToStore = prescription.notes;
    let isEncrypted = false;

    if (encryptionKey) {
      imageToStore = await prescriptionCrypto.encrypt(prescription.imageBase64, encryptionKey);
      if (notesToStore) {
        notesToStore = await prescriptionCrypto.encrypt(notesToStore, encryptionKey);
      }
      isEncrypted = true;
    }

    const payload: StoredPrescription = {
      ...prescription,
      imageBase64: imageToStore,
      notes: notesToStore,
      isEncrypted,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction('prescriptions', 'readwrite');
      tx.objectStore('prescriptions').put(payload);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getPrescriptions(userId: string, decryptionKey?: string): Promise<StoredPrescription[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('prescriptions', 'readonly');
      const req = tx.objectStore('prescriptions').index('userId').getAll(userId);
      req.onsuccess = async () => {
        const rawResults: StoredPrescription[] = req.result || [];
        if (!decryptionKey) {
          resolve(rawResults);
          return;
        }

        // Decrypt images and notes on retrieval
        const decrypted = await Promise.all(
          rawResults.map(async (rx) => {
            if (rx.isEncrypted && decryptionKey) {
              const decryptedImg = await prescriptionCrypto.decrypt(rx.imageBase64, decryptionKey);
              const decryptedNotes = rx.notes
                ? await prescriptionCrypto.decrypt(rx.notes, decryptionKey)
                : undefined;
              return {
                ...rx,
                imageBase64: decryptedImg,
                notes: decryptedNotes,
              };
            }
            return rx;
          })
        );
        resolve(decrypted);
      };
      req.onerror = () => reject(tx.error);
    });
  }

  async getQueuedScans(userId: string): Promise<StoredPrescription[]> {
    const all = await this.getPrescriptions(userId);
    return all.filter((rx) => rx.status === 'waiting_to_read');
  }

  async updatePrescriptionStatus(
    userId: string,
    rxId: string,
    status: StoredPrescription['status']
  ): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('prescriptions', 'readwrite');
      const store = tx.objectStore('prescriptions');
      const req = store.get(rxId);
      req.onsuccess = () => {
        if (req.result && req.result.userId === userId) {
          const updated = { ...req.result, status };
          store.put(updated);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async updatePrescriptionLanguage(
    userId: string,
    rxId: string,
    preferredLanguage: string
  ): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('prescriptions', 'readwrite');
      const store = tx.objectStore('prescriptions');
      const req = store.get(rxId);
      req.onsuccess = () => {
        if (req.result && req.result.userId === userId) {
          store.put({ ...req.result, preferredLanguage });
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deletePrescription(userId: string, rxId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['prescriptions', 'medicines', 'reminders'], 'readwrite');
      const rxStore = tx.objectStore('prescriptions');
      const medStore = tx.objectStore('medicines');
      const remStore = tx.objectStore('reminders');

      const rxReq = rxStore.get(rxId);
      rxReq.onsuccess = () => {
        if (rxReq.result && rxReq.result.userId === userId) {
          rxStore.delete(rxId);

          const medReq = medStore.index('prescriptionId').getAll(rxId);
          medReq.onsuccess = () => {
            for (const med of medReq.result) {
              medStore.delete(med.id);
            }
          };

          const remReq = remStore.getAll();
          remReq.onsuccess = () => {
            for (const rem of remReq.result) {
              if (rem.prescriptionId === rxId && rem.userId === userId) {
                remStore.delete(rem.id);
              }
            }
          };
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ---------------- MEDICINE OPERATIONS ----------------

  async saveMedicines(medicines: StoredMedicine[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('medicines', 'readwrite');
      const store = tx.objectStore('medicines');
      for (const m of medicines) {
        store.put(m);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveSingleMedicine(medicine: StoredMedicine): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['medicines', 'translations'], 'readwrite');
      tx.objectStore('medicines').put(medicine);
      
      // Invalidate translation cache for this medicine when updated/edited
      const transStore = tx.objectStore('translations');
      const req = transStore.index('medicineId').getAll(medicine.id);
      req.onsuccess = () => {
        for (const item of req.result || []) {
          transStore.delete(item.id);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ---------------- TRANSLATION CACHE OPERATIONS ----------------

  async getCachedTranslation(medicineId: string, languageCode: string): Promise<CachedTranslation | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('translations', 'readonly');
      const req = tx.objectStore('translations').get(`${medicineId}_${languageCode}`);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(tx.error);
    });
  }

  async saveCachedTranslation(translation: CachedTranslation): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('translations', 'readwrite');
      tx.objectStore('translations').put(translation);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async invalidateMedicineTranslations(medicineId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('translations', 'readwrite');
      const transStore = tx.objectStore('translations');
      const req = transStore.index('medicineId').getAll(medicineId);
      req.onsuccess = () => {
        for (const item of req.result || []) {
          transStore.delete(item.id);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMedicines(userId: string): Promise<StoredMedicine[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('medicines', 'readonly');
      const req = tx.objectStore('medicines').index('userId').getAll(userId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(tx.error);
    });
  }

  async deleteMedicine(userId: string, medId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['medicines', 'reminders'], 'readwrite');
      const medStore = tx.objectStore('medicines');
      const remStore = tx.objectStore('reminders');

      const medReq = medStore.get(medId);
      medReq.onsuccess = () => {
        if (medReq.result && medReq.result.userId === userId) {
          medStore.delete(medId);

          const remReq = remStore.getAll();
          remReq.onsuccess = () => {
            for (const rem of remReq.result) {
              if (rem.medicineId === medId && rem.userId === userId) {
                remStore.delete(rem.id);
              }
            }
          };
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ---------------- REMINDER & DOSE LOG OPERATIONS ----------------

  async saveReminders(reminders: StoredReminder[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('reminders', 'readwrite');
      const store = tx.objectStore('reminders');
      for (const r of reminders) {
        store.put(r);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getReminders(userId: string): Promise<StoredReminder[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('reminders', 'readonly');
      const req = tx.objectStore('reminders').index('userId').getAll(userId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(tx.error);
    });
  }

  async updateReminderStatus(
    userId: string,
    reminderId: string,
    status: 'taken' | 'skipped' | 'pending' | 'snoozed' | 'missed',
    options?: {
      dateStr?: string;
      actualTime?: string;
      snoozedUntil?: string | null;
      snoozeCount?: number;
      unsure?: boolean;
    }
  ): Promise<void> {
    const db = await this.getDB();
    const now = new Date();
    const localY = now.getFullYear();
    const localM = String(now.getMonth() + 1).padStart(2, '0');
    const localD = String(now.getDate()).padStart(2, '0');
    const targetDate = options?.dateStr || `${localY}-${localM}-${localD}`;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['reminders', 'doseLogs'], 'readwrite');
      const remStore = tx.objectStore('reminders');
      const logStore = tx.objectStore('doseLogs');

      const req = remStore.get(reminderId);
      req.onsuccess = () => {
        const rem: StoredReminder | undefined = req.result;
        if (rem && rem.userId === userId) {
          rem.lastStatus = status;
          rem.lastStatusDate = targetDate;

          const takenDates = { ...(rem.takenDates || {}) };
          const skippedDates = { ...(rem.skippedDates || {}) };
          const missedDates = { ...(rem.missedDates || {}) };

          if (status === 'taken') {
            takenDates[targetDate] = {
              takenAt: now.toISOString(),
              actualTime: options?.actualTime,
            };
            delete skippedDates[targetDate];
            delete missedDates[targetDate];
            rem.snoozedUntil = null;
            rem.snoozeCount = 0;
          } else if (status === 'skipped') {
            skippedDates[targetDate] = true;
            delete takenDates[targetDate];
            delete missedDates[targetDate];
            rem.snoozedUntil = null;
            rem.snoozeCount = 0;
          } else if (status === 'snoozed') {
            rem.snoozedUntil = options?.snoozedUntil ?? null;
            rem.snoozeCount = options?.snoozeCount ?? (rem.snoozeCount || 0) + 1;
          } else if (status === 'missed') {
            missedDates[targetDate] = options?.unsure ? 'unsure' : 'missed';
            rem.snoozedUntil = null;
          } else if (status === 'pending') {
            delete takenDates[targetDate];
            delete skippedDates[targetDate];
            delete missedDates[targetDate];
            rem.snoozedUntil = null;
            rem.snoozeCount = 0;
          }

          rem.takenDates = takenDates;
          rem.skippedDates = skippedDates;
          rem.missedDates = missedDates;
          remStore.put(rem);

          if (status === 'taken' || status === 'skipped' || options?.unsure) {
            const log: DoseLog = {
              id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              userId,
              reminderId: rem.id,
              prescriptionId: rem.prescriptionId,
              profileId: rem.profileId,
              medicineId: rem.medicineId,
              medicineName: rem.medicineName,
              action: options?.unsure ? 'unsure' : status === 'taken' ? 'taken' : 'skipped',
              scheduledTime: rem.doseTime,
              actualTimeStr: options?.actualTime,
              actualTimestamp: now.toISOString(),
              dateStr: targetDate,
              source: rem.source || 'auto',
            };
            logStore.put(log);
          }
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteReminder(userId: string, reminderId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('reminders', 'readwrite');
      const store = tx.objectStore('reminders');
      const req = store.get(reminderId);
      req.onsuccess = () => {
        if (req.result && req.result.userId === userId) {
          store.delete(reminderId);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async replaceRemindersSnapshot(
    userId: string,
    removeIds: string[],
    putReminders: StoredReminder[]
  ): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('reminders', 'readwrite');
      const store = tx.objectStore('reminders');
      for (const id of removeIds) {
        store.delete(id);
      }
      for (const r of putReminders) {
        if (r.userId === userId) {
          store.put(r);
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getReminderSettings(userId: string): Promise<ReminderSettings | null> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('reminderSettings', 'readonly');
        const req = tx.objectStore('reminderSettings').get(userId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async saveReminderSettings(settings: ReminderSettings): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('reminderSettings', 'readwrite');
      tx.objectStore('reminderSettings').put(settings);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getDoseLogs(userId: string): Promise<DoseLog[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('doseLogs', 'readonly');
      const req = tx.objectStore('doseLogs').index('userId').getAll(userId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(tx.error);
    });
  }

  async saveDoseLog(log: DoseLog): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('doseLogs', 'readwrite');
      tx.objectStore('doseLogs').put(log);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ---------------- OFFLINE CHAT ASSISTANT HISTORY ----------------

  async getChatHistory(userId: string): Promise<LocalChatMessage[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('chatHistory', 'readonly');
      const req = tx.objectStore('chatHistory').index('userId').getAll(userId);
      req.onsuccess = () => {
        const list: LocalChatMessage[] = req.result || [];
        list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        resolve(list);
      };
      req.onerror = () => reject(tx.error);
    });
  }

  async saveChatMessage(message: LocalChatMessage): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('chatHistory', 'readwrite');
      tx.objectStore('chatHistory').put(message);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ---------------- CLOUD BACKUP SETTINGS ----------------

  async getCloudBackupConfig(userId: string): Promise<CloudBackupConfig> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('cloudBackup', 'readonly');
      const req = tx.objectStore('cloudBackup').get(userId);
      req.onsuccess = () => {
        resolve(req.result || { userId, enabled: false });
      };
      req.onerror = () => resolve({ userId, enabled: false });
    });
  }

  async saveCloudBackupConfig(config: CloudBackupConfig): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cloudBackup', 'readwrite');
      tx.objectStore('cloudBackup').put(config);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ---------------- STORAGE ESTIMATE & DPDP ACT ERASURE ----------------

  async getStorageEstimate(): Promise<{ usageMB: number; quotaMB: number; percent: number }> {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const { usage = 0, quota = 0 } = await navigator.storage.estimate();
        const usageMB = +(usage / (1024 * 1024)).toFixed(2);
        const quotaMB = +(quota / (1024 * 1024)).toFixed(0);
        const percent = quota > 0 ? +((usage / quota) * 100).toFixed(1) : 0;
        return { usageMB, quotaMB, percent };
      } catch (e) {
        console.warn('Storage estimate error:', e);
      }
    }
    return { usageMB: 0.8, quotaMB: 1000, percent: 0.1 };
  }

  async wipeUserData(userId: string): Promise<void> {
    const db = await this.getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        ['users', 'profiles', 'prescriptions', 'medicines', 'reminders', 'doseLogs', 'chatHistory', 'cloudBackup', 'translations', 'reminderSettings'],
        'readwrite'
      );

      tx.objectStore('users').delete(userId);
      tx.objectStore('cloudBackup').delete(userId);
      tx.objectStore('reminderSettings').delete(userId);
      tx.objectStore('translations').clear();

      const deleteByIndex = (storeName: string, indexName: string) => {
        const store = tx.objectStore(storeName);
        const req = store.index(indexName).getAll(userId);
        req.onsuccess = () => {
          for (const item of req.result) store.delete(item.id);
        };
      };

      deleteByIndex('profiles', 'userId');
      deleteByIndex('prescriptions', 'userId');
      deleteByIndex('medicines', 'userId');
      deleteByIndex('reminders', 'userId');
      deleteByIndex('doseLogs', 'userId');
      deleteByIndex('chatHistory', 'userId');

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Also purge caches and unregister service workers
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (e) {
        console.warn('Cache purge failed:', e);
      }
    }

    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      } catch (e) {
        console.warn('Service worker unregister failed:', e);
      }
    }
  }

  async purgeAllDatabases(): Promise<void> {
    if (this.dbPromise) {
      try {
        const db = await this.dbPromise;
        db.close();
      } catch {
        // Ignored
      }
      this.dbPromise = null;
    }
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });

    // Also delete v1 database if present
    try {
      indexedDB.deleteDatabase('PillSync_DB_v1');
    } catch {}
  }
}

export const dbService = new PillSyncDatabase();
