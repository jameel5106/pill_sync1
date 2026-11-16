import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Image as ImageIcon,
  Plus,
  Trash2,
  Lock,
  LogOut,
  Calendar,
  Clock,
  Pill,
  User,
  Users,
  Settings,
  Home,
  AlarmClock,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Globe,
  Bell,
  BellOff,
  Download,
  Info,
  Shield,
  FileText,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  Wifi,
  WifiOff,
  HardDrive,
  MessageSquare,
  Send,
  HelpCircle,
  Sparkles,
  X,
  Languages,
  GitBranch,
  Smartphone,
} from 'lucide-react';
import {
  UserAccount,
  PatientProfile,
  StoredPrescription,
  StoredMedicine,
  StoredReminder,
  ReminderSettings,
  MealTimesConfig,
  DoseLog,
  dbService,
} from '../services/db';
import { authService } from '../services/auth';
import { prescriptionCrypto } from '../services/crypto';
import { fileImportService } from '../services/fileImport';
import { ImageAnalysisService, QualityAnalysisResult } from '../services/imageAnalysis';
import {
  parsePrescriptionWithGemini,
  ParsedMedicineItem,
  PrescriptionParseResult,
  normalizeTimingValue,
} from '../services/geminiClient';
import { NotificationCapabilityStatus, reminderService } from '../services/reminderService';
import {
  CompletedCourseAlert,
  DEFAULT_MEAL_TIMES,
  createDefaultReminderSettings,
  generateRemindersForMedicine,
  generateRemindersForMedicines,
  getCompletedCoursesNeedingAlert,
  getLocalDateStr,
  getLocalTimezone,
  getReminderStatusForDate,
  isReminderScheduledForDate,
  addLocalDays,
} from '../services/reminderScheduler';
import { offlineAssistant } from '../services/offlineAssistant';
import { translationService } from '../services/translationService';
import { getOfflineTransliteratedName } from '../services/sentenceBuilder';
import {
  SUPPORTED_LANGUAGES,
  TRANSLATIONS,
  LanguageConfig,
  translateMedicalTerm,
} from '../data/translations';
import {
  PROGRESS_UI_STRINGS,
  buildFormAwareReminderAlertText,
  toSupportedLang,
} from '../translations/glossary';
import { inferFormFromPrescription } from '../services/formInference';
import { isOralForm, isTopicalForm, normalizeFormId } from '../config/medicineForms';
import { PrescriptionCaptureModal } from './PrescriptionCaptureModal';
import { QualityCheckModal } from './QualityCheckModal';
import { AddProfileModal } from './AddProfileModal';
import { ReviewMedicinesScreen } from './ReviewMedicinesScreen';
import { DpdpComplianceModal } from './DpdpComplianceModal';
import { ManualMedicineModal } from './ManualMedicineModal';
import { InstallPwaModal } from './InstallPwaModal';
import { StorageOfflineModal } from './StorageOfflineModal';
import { GitHubExportModal } from './GitHubExportModal';
import { AndroidApkModal } from './AndroidApkModal';
import { PrescriptionTranslationView } from './PrescriptionTranslationView';
import {
  HonestProgressScreen,
  HonestProgressStatus,
  OfflineQueuedConfirmation,
} from './HonestProgressScreen';
import { RemindersTab, UndoBannerState } from './RemindersTab';
import {
  ActiveAlarmBanner,
  ConfirmScheduleDecision,
  ConfirmScheduleModal,
  CourseExtensionModal,
  FriendlyPermissionModal,
  MissedDosesSheet,
  PauseRemindersModal,
  ReminderFormModal,
  ReminderFormSavePayload,
  RemindersCreatedSummaryModal,
} from './ReminderModals';

type AppScreen =
  | 'splash'
  | 'language-select'
  | 'login'
  | 'signup'
  | 'app-lock'
  | 'home'
  | 'prescriptions'
  | 'reminders'
  | 'settings'
  | 'capture-metadata'
  | 'reading-loader'
  | 'offline-queued'
  | 'review-confirm'
  | 'view-prescription';

export const RealPillSyncApp: React.FC = () => {
  // Navigation & User State
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('splash');
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<LanguageConfig>(SUPPORTED_LANGUAGES[0]);

  // Online / Offline state
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [swUpdateAvailable, setSwUpdateAvailable] = useState<boolean>(false);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);

  // Real Data State (Strictly loaded from IndexedDB for the signed-in user)
  const [profiles, setProfiles] = useState<PatientProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [prescriptions, setPrescriptions] = useState<StoredPrescription[]>([]);
  const [medicines, setMedicines] = useState<StoredMedicine[]>([]);
  const [reminders, setReminders] = useState<StoredReminder[]>([]);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(() =>
    createDefaultReminderSettings('default')
  );
  const [mealTimesDraft, setMealTimesDraft] = useState<MealTimesConfig>({ ...DEFAULT_MEAL_TIMES });
  const [viewingRx, setViewingRx] = useState<StoredPrescription | null>(null);

  // Auth form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Sign up state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConsent, setSignupConsent] = useState(false);

  // Password reset modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // PIN Lock State
  const [unlockPin, setUnlockPin] = useState('');
  const [lockError, setLockError] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);

  // Capture & Quality Check State
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null);
  const [capturedFileSize, setCapturedFileSize] = useState<number>(0);
  const [qualityAnalysis, setQualityAnalysis] = useState<QualityAnalysisResult | null>(null);
  const [showQualityModal, setShowQualityModal] = useState(false);

  // Manual Medicine Entry Modal
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);

  // PWA, Storage, GitHub Export & Android APK Modals
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [showGitHubExportModal, setShowGitHubExportModal] = useState(false);
  const [showAndroidApkModal, setShowAndroidApkModal] = useState(false);

  // Offline Health Assistant Drawer
  const [showAssistantModal, setShowAssistantModal] = useState(false);
  const [assistantQuery, setAssistantQuery] = useState('');
  const [assistantMessages, setAssistantMessages] = useState<
    { sender: 'user' | 'assistant'; text: string; isOffline?: boolean }[]
  >([]);

  // Prescription Details State
  const [rxDoctorName, setRxDoctorName] = useState('');
  const [rxDate, setRxDate] = useState(new Date().toISOString().slice(0, 10));

  // Profile management modal
  const [showAddProfileModal, setShowAddProfileModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PatientProfile | null>(null);

  // Gemini OCR & Review State
  const [ocrResult, setOcrResult] = useState<PrescriptionParseResult | null>(null);
  const [ocrMedicines, setOcrMedicines] = useState<ParsedMedicineItem[]>([]);
  const [ocrDoctor, setOcrDoctor] = useState<string | null>(null);
  const [ocrClinic, setOcrClinic] = useState<string | null>(null);
  const [ocrNotes, setOcrNotes] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Honest Prescription Reading Progress State
  const [readProgress, setReadProgress] = useState(0);
  const [readStepIndex, setReadStepIndex] = useState(0);
  const [readStatus, setReadStatus] = useState<HonestProgressStatus>('running');
  const [readSubtitle, setReadSubtitle] = useState('');
  const [isStartingRead, setIsStartingRead] = useState(false);
  const readingAbortRef = useRef<AbortController | null>(null);
  const readingLockRef = useRef(false);
  const readingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Modals & Extras
  const [showDeleteRxId, setShowDeleteRxId] = useState<string | null>(null);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [modalType, setModalType] = useState<'privacy' | 'terms' | null>(null);
  const [notificationPerm, setNotificationPerm] = useState<string>('default');
  const [capabilityStatus, setCapabilityStatus] = useState<NotificationCapabilityStatus>(() =>
    reminderService.getCapabilityStatus()
  );
  const [showReportTransModal, setShowReportTransModal] = useState(false);
  const [reportTransText, setReportTransText] = useState('');
  const [reportTransSubmitted, setReportTransSubmitted] = useState(false);

  // Reminders & Alarms Flow State
  const [pendingRxConfirm, setPendingRxConfirm] = useState<{
    confirmedMeds: any[];
    confirmedDoc: string;
    confirmedClinic: string;
  } | null>(null);
  const [createdSummary, setCreatedSummary] = useState<{
    text: string;
    asNeededCount: number;
    rx: StoredPrescription;
  } | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [activeAlarmReminder, setActiveAlarmReminder] = useState<StoredReminder | null>(null);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [editingReminder, setEditingReminder] = useState<StoredReminder | null>(null);
  const [reminderFormTargetDate, setReminderFormTargetDate] = useState<string>(() => getLocalDateStr());
  const [pauseModalTarget, setPauseModalTarget] = useState<
    | { type: 'all' }
    | { type: 'medicine'; medicineId: string; medicineName: string }
    | null
  >(null);
  const [extendingMedicine, setExtendingMedicine] = useState<StoredMedicine | null>(null);
  const [missedDosesList, setMissedDosesList] = useState<
    { reminder: StoredReminder; dateStr: string }[]
  >([]);
  const [showMissedDosesModal, setShowMissedDosesModal] = useState(false);
  const missedCheckUserRef = useRef<string | null>(null);
  const [undoBanner, setUndoBanner] = useState<UndoBannerState | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mealTimesSavedToast, setMealTimesSavedToast] = useState(false);

  // Live refs for interval/SW callbacks without churning intervals
  const remindersRef = useRef<StoredReminder[]>([]);
  const medicinesRef = useRef<StoredMedicine[]>([]);
  const reminderSettingsRef = useRef<ReminderSettings>(reminderSettings);
  remindersRef.current = reminders;
  medicinesRef.current = medicines;
  reminderSettingsRef.current = reminderSettings;

  // Translation helper
  const t = (key: string) => {
    return (
      TRANSLATIONS[activeLanguage.code]?.[key] ||
      TRANSLATIONS['en']?.[key] ||
      key
    );
  };

  // 1. Online / Offline listeners & Service Worker Registration
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync queued offline scans
      syncQueuedScans();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register Service Worker with versioned update listener
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  waitingWorkerRef.current = newWorker;
                  setSwUpdateAvailable(true);
                }
              });
            }
          });
        })
        .catch((err) => console.warn('Service worker registration failed:', err));
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentUser]);

  // Handle service worker update
  const handleUpdateApp = () => {
    if (waitingWorkerRef.current) {
      waitingWorkerRef.current.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  };

  // 2. Initialize session & check for shared prescription
  useEffect(() => {
    const init = async () => {
      try {
        // Check for Web Share Target incoming file
        const sharedFile = await fileImportService.checkSharedPrescription();
        if (sharedFile) {
          const res = await fileImportService.processFile(sharedFile);
          if (res.success && res.base64) {
            processCapturedImage(res.base64, res.fileSize);
          }
        }

        const user = await authService.initSession();
        if (user) {
          setCurrentUser(user);
          const matchedLang = SUPPORTED_LANGUAGES.find((l) => l.code === user.preferredLanguage);
          if (matchedLang) setActiveLanguage(matchedLang);

          await loadUserData(user.id);
          setCurrentScreen('home');
        } else {
          const hasChosenLang = localStorage.getItem('pillsync_lang_chosen');
          setTimeout(() => {
            if (!hasChosenLang) {
              setCurrentScreen('language-select');
            } else {
              setCurrentScreen('login');
            }
          }, 1200);
        }
      } catch (err) {
        console.error('Session init error:', err);
        setCurrentScreen('login');
      }
    };
    init();
  }, []);

  // 3. Load all user data from IndexedDB
  const loadUserData = async (userId: string) => {
    try {
      const decKey = authService.getEncryptionKey();
      const [userProfiles, userRx, userMeds, loadedReminders, loadedSettings] = await Promise.all([
        dbService.getProfiles(userId),
        dbService.getPrescriptions(userId, decKey),
        dbService.getMedicines(userId),
        dbService.getReminders(userId),
        dbService.getReminderSettings(userId),
      ]);

      const currentTz = getLocalTimezone();
      let effectiveSettings = loadedSettings || createDefaultReminderSettings(userId);
      let userReminders = loadedReminders;

      if (!loadedSettings || effectiveSettings.lastKnownTimezone !== currentTz) {
        effectiveSettings = { ...effectiveSettings, lastKnownTimezone: currentTz };
        await dbService.saveReminderSettings(effectiveSettings);
        if (userReminders.length > 0 && loadedSettings?.lastKnownTimezone !== currentTz) {
          userReminders = userReminders.map((r) => ({ ...r, timezone: currentTz }));
          await dbService.saveReminders(userReminders);
        }
      }

      setProfiles(userProfiles);
      if (userProfiles.length > 0 && !selectedProfileId) {
        const defaultProf = userProfiles.find((p) => p.isDefault) || userProfiles[0];
        setSelectedProfileId(defaultProf.id);
      }

      setPrescriptions(userRx);
      setMedicines(userMeds);
      setReminders(userReminders);
      setReminderSettings(effectiveSettings);
      setMealTimesDraft({ ...effectiveSettings.mealTimes });
      setNotificationPerm(reminderService.getNotificationPermission());
      setCapabilityStatus(reminderService.getCapabilityStatus());

      // Check once per session on app open for unhandled missed doses (today or yesterday)
      if (missedCheckUserRef.current !== userId) {
        missedCheckUserRef.current = userId;
        const now = new Date();
        const todayStr = getLocalDateStr(now);
        const yesterdayStr = addLocalDays(todayStr, -1);
        const pendingMissed: { reminder: StoredReminder; dateStr: string }[] = [];

        for (const dStr of [yesterdayStr, todayStr]) {
          for (const r of userReminders) {
            if (!isReminderScheduledForDate(r, dStr)) continue;
            if (r.takenDates?.[dStr] || r.skippedDates?.[dStr] || r.missedDates?.[dStr]) continue;
            const st = getReminderStatusForDate(r, dStr, effectiveSettings, now);
            if (st === 'missed') {
              pendingMissed.push({ reminder: r, dateStr: dStr });
            }
          }
        }
        if (pendingMissed.length > 0) {
          setMissedDosesList(pendingMissed);
          setShowMissedDosesModal(true);
        }
      }
    } catch (err) {
      console.error('Failed to load user data:', err);
    }
  };

  // Helper to resolve effective language for a prescription or reminder:
  // Priority: prescription override -> profile's last chosen language -> user's Settings default
  const resolveLanguageForPrescription = (rxId?: string, profId?: string): string => {
    const rx = rxId ? prescriptions.find((p) => p.id === rxId) : undefined;
    if (rx?.preferredLanguage) return rx.preferredLanguage;
    const prof = profId ? profiles.find((p) => p.id === profId) : undefined;
    if (prof?.language) return prof.language;
    return activeLanguage.code;
  };

  // 4. Background lock detector + timezone change detector + SW action sync listener
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        authService.recordBackgroundTime();
      } else if (document.visibilityState === 'visible') {
        if (currentUser?.pinHash && authService.shouldTriggerPinLock()) {
          setCurrentScreen('app-lock');
          setUnlockPin('');
          setLockError('');
        }
        authService.clearBackgroundTime();
        setNotificationPerm(reminderService.getNotificationPermission());
        setCapabilityStatus(reminderService.getCapabilityStatus());

        if (currentUser) {
          const currentTz = getLocalTimezone();
          if (reminderSettingsRef.current.lastKnownTimezone !== currentTz) {
            await loadUserData(currentUser.id);
          } else {
            await reminderService.syncNotificationScheduleToSW(
              remindersRef.current,
              medicinesRef.current,
              reminderSettingsRef.current,
              resolveLanguageForPrescription
            );
          }
        }
      }
    };

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel('pillsync-reminders');
      bc.onmessage = (evt) => {
        if (evt.data?.type === 'REMINDER_UPDATED' && currentUser) {
          reminderService.stopLoopingAlarm();
          setActiveAlarmReminder(null);
          loadUserData(currentUser.id);
        }
      };
    }

    const handleSwMessage = (evt: MessageEvent) => {
      if (evt.data?.type === 'REMINDER_UPDATED' && currentUser) {
        reminderService.stopLoopingAlarm();
        setActiveAlarmReminder(null);
        loadUserData(currentUser.id);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    navigator.serviceWorker?.addEventListener?.('message', handleSwMessage);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      navigator.serviceWorker?.removeEventListener?.('message', handleSwMessage);
      bc?.close();
    };
  }, [currentUser]);

  // 5. Start active reminder engine & sync SW notification schedule
  useEffect(() => {
    if (!currentUser) {
      reminderService.stopActiveReminderEngine();
      return;
    }

    reminderService.startActiveReminderEngine({
      getReminders: () => remindersRef.current,
      getMedicines: () => medicinesRef.current,
      getSettings: () => reminderSettingsRef.current,
      getLanguageForReminder: (r) => resolveLanguageForPrescription(r.prescriptionId, r.profileId),
      onTriggerAlarm: (triggered) => {
        setActiveAlarmReminder(triggered);
      },
      onAutoMarkMissed: async (r, dateStr) => {
        reminderService.stopLoopingAlarm();
        setActiveAlarmReminder((curr) => (curr?.id === r.id ? null : curr));
        await dbService.updateReminderStatus(currentUser.id, r.id, 'missed', { dateStr });
        await loadUserData(currentUser.id);
      },
    });

    return () => reminderService.stopActiveReminderEngine();
  }, [currentUser?.id]);

  // Sync SW notifications & stop finished finite courses automatically whenever schedule state changes
  useEffect(() => {
    if (!currentUser) return;
    reminderService.syncNotificationScheduleToSW(
      reminders,
      medicines,
      reminderSettings,
      resolveLanguageForPrescription
    );

    const completedAlerts = getCompletedCoursesNeedingAlert(medicines, prescriptions, reminders);
    if (completedAlerts.length > 0) {
      const finishedMedIds = new Set(completedAlerts.map((a) => a.medicine.id));
      const stillActiveAuto = reminders.filter(
        (r) => finishedMedIds.has(r.medicineId) && r.source !== 'custom' && r.isActive && !r.ongoing
      );
      if (stillActiveAuto.length > 0) {
        const stopped = stillActiveAuto.map((r) => ({ ...r, isActive: false }));
        dbService.saveReminders(stopped).then(() => {
          loadUserData(currentUser.id);
        });
      }
    }
  }, [currentUser?.id, reminders, medicines, prescriptions, reminderSettings, activeLanguage.code]);

  // 6. Sync offline queued scans when online
  const syncQueuedScans = async () => {
    if (!navigator.onLine || !currentUser) return;
    try {
      const queued = await dbService.getQueuedScans(currentUser.id);
      if (queued.length === 0) return;

      for (const rx of queued) {
        try {
          const decKey = authService.getEncryptionKey();
          const cleanImage = rx.isEncrypted
            ? await prescriptionCrypto.decrypt(rx.imageBase64, decKey)
            : rx.imageBase64;

          const result = await parsePrescriptionWithGemini(cleanImage, 'image/jpeg');
          if (result && result.medicines && result.medicines.length > 0) {
            const newStoredMeds: StoredMedicine[] = result.medicines.map((m, idx) => {
              const inferred = inferFormFromPrescription({
                name: m.name,
                modelForm: m.form,
                route: m.route,
                instructions: m.instructions,
                dose: m.dose,
                rawText: m.rawText,
                userEditedForm: false,
              });
              const resolvedForm = inferred.form || undefined;
              const resolvedTiming =
                resolvedForm && !isOralForm(resolvedForm)
                  ? 'unspecified'
                  : normalizeTimingValue(m.timing);
              return {
                id: `med_${Date.now()}_${idx}`,
                prescriptionId: rx.id,
                userId: currentUser.id,
                profileId: rx.profileId,
                name: m.name || 'Unreadable medicine',
                nameAsRead: m.nameAsRead || undefined,
                nameCorrected: m.nameCorrected,
                genericName: m.genericName || undefined,
                strength: m.strength || undefined,
                form: resolvedForm,
                applicationArea: inferred.inferredArea || m.applicationArea || undefined,
                formCorrected: inferred.formCorrected || !!m.formCorrected,
                route: m.route || undefined,
                dose: m.dose || undefined,
                frequency: m.frequencyCode || m.frequency || undefined,
                frequencyPlain: m.frequencyPlain || undefined,
                doseSchedule: m.doseSchedule || undefined,
                timesPerDay: m.timesPerDay ?? undefined,
                timing: resolvedTiming,
                asNeeded: m.asNeeded,
                durationDays: m.durationDays ?? undefined,
                durationText: m.durationText || undefined,
                instructions: m.instructions || undefined,
                confidence: m.confidence ?? 0.5,
                illegible: !!m.illegible,
                flags: m.flags || [],
                confirmed: false,
                createdAt: new Date().toISOString(),
              };
            });

            await dbService.saveMedicines(newStoredMeds);
            await dbService.updatePrescriptionStatus(currentUser.id, rx.id, 'needsReview');
          }
        } catch (e) {
          console.warn('Sync failed for queued prescription:', rx.id, e);
        }
      }

      await loadUserData(currentUser.id);
      alert('Your queued offline prescription has been transcribed by Gemini and is ready for your review!');
    } catch (err) {
      console.warn('Sync queue error:', err);
    }
  };

  // ---------------- AUTH HANDLERS ----------------

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const user = await authService.login(loginEmail, loginPassword);
      setCurrentUser(user);
      await loadUserData(user.id);
      setLoginEmail('');
      setLoginPassword('');
      setCurrentScreen('home');
    } catch (err: any) {
      setAuthError(err?.message || 'Login failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const user = await authService.signUp({
        name: signupName,
        email: signupEmail,
        password: signupPassword,
        dpdpConsent: signupConsent,
        preferredLanguage: activeLanguage.code,
      });
      setCurrentUser(user);
      await loadUserData(user.id);
      setSignupName('');
      setSignupEmail('');
      setSignupPassword('');
      setCurrentScreen('home');
    } catch (err: any) {
      setAuthError(err?.message || 'Sign up failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setProfiles([]);
    setPrescriptions([]);
    setMedicines([]);
    setReminders([]);
    setCurrentScreen('login');
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    try {
      await authService.deleteAccount();
      setShowDeleteAccountModal(false);
      setCurrentUser(null);
      setProfiles([]);
      setPrescriptions([]);
      setMedicines([]);
      setReminders([]);
      setCurrentScreen('language-select');
    } catch (err: any) {
      alert('Failed to delete account: ' + err?.message);
    }
  };

  const handleUnlockPin = async () => {
    if (!unlockPin) return;
    const isValid = await authService.verifyPin(unlockPin);
    if (isValid) {
      setUnlockPin('');
      setLockError('');
      setCurrentScreen('home');
    } else {
      setLockError('Incorrect PIN. Please try again.');
    }
  };

  // ---------------- CAPTURE & QUALITY ANALYSIS ----------------

  const processCapturedImage = async (base64: string, sizeBytes: number) => {
    try {
      const img = await ImageAnalysisService.loadImage(base64);
      const analysis = await ImageAnalysisService.analyzeQuality(img, sizeBytes);
      setCapturedBase64(base64);
      setCapturedFileSize(sizeBytes);
      setQualityAnalysis(analysis);
      setShowQualityModal(true);
    } catch (err) {
      console.error('Failed to process image:', err);
      alert('Could not decode the selected image file.');
    }
  };

  const handleRotateCaptured = async () => {
    if (!capturedBase64) return;
    try {
      const rotated = await ImageAnalysisService.rotateImage(capturedBase64, 90);
      setCapturedBase64(rotated);
      const img = await ImageAnalysisService.loadImage(rotated);
      const analysis = await ImageAnalysisService.analyzeQuality(img, capturedFileSize);
      setQualityAnalysis(analysis);
    } catch (err) {
      console.error('Rotate failed:', err);
    }
  };

  const handleProceedAfterQuality = async () => {
    setShowQualityModal(false);
    if (!capturedBase64) return;

    try {
      const img = await ImageAnalysisService.loadImage(capturedBase64);
      const { base64: optimizedBase64, sizeBytes } = await ImageAnalysisService.resizeAndCompress(img);
      setCapturedBase64(optimizedBase64);
      setCapturedFileSize(sizeBytes);
      setCurrentScreen('capture-metadata');
    } catch (err) {
      console.error('Resize failed:', err);
      setCurrentScreen('capture-metadata');
    }
  };

  // ---------------- GEMINI HANDWRITING READING OR OFFLINE QUEUE ----------------

  const clearReadingTimer = () => {
    if (readingTimerRef.current) {
      clearInterval(readingTimerRef.current);
      readingTimerRef.current = null;
    }
  };

  const savePrescriptionOfflineForLater = async () => {
    if (!capturedBase64 || !currentUser) return;
    const rxId = `rx_offline_${Date.now()}`;
    const newRx: StoredPrescription = {
      id: rxId,
      userId: currentUser.id,
      profileId: selectedProfileId || profiles[0]?.id || `prof_me_${currentUser.id}`,
      doctorName: rxDoctorName || undefined,
      prescriptionDate: rxDate,
      imageBase64: capturedBase64,
      fileSizeBytes: capturedFileSize,
      status: 'waiting_to_read',
      offlineQueuedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    await dbService.savePrescription(newRx, authService.getEncryptionKey());
    await loadUserData(currentUser.id);
    setCurrentScreen('offline-queued');
  };

  const handleCancelReading = () => {
    if (readingAbortRef.current) {
      readingAbortRef.current.abort();
      readingAbortRef.current = null;
    }
    clearReadingTimer();
    readingLockRef.current = false;
    setIsStartingRead(false);
    // Return to capture-metadata without losing capturedBase64
    setCurrentScreen('capture-metadata');
  };

  // Handle browser Back navigation during reading-loader so it cancels cleanly without triggering a second request
  useEffect(() => {
    if (currentScreen !== 'reading-loader') return;
    window.history.pushState({ pillsyncReading: true }, '');
    const handlePopState = () => {
      handleCancelReading();
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentScreen]);

  const handleStartGeminiReading = async () => {
    if (!capturedBase64 || !currentUser) return;
    // Double-tap / re-entry protection
    if (readingLockRef.current) return;

    const langCode = toSupportedLang(activeLanguage.code);
    const ui = PROGRESS_UI_STRINGS[langCode];

    // If offline: skip progress screen completely and show offline clock confirmation
    if (!navigator.onLine) {
      await savePrescriptionOfflineForLater();
      return;
    }

    readingLockRef.current = true;
    setIsStartingRead(true);

    if (readingAbortRef.current) {
      readingAbortRef.current.abort();
    }
    clearReadingTimer();

    const abortController = new AbortController();
    readingAbortRef.current = abortController;

    setOcrError(null);
    setOcrResult(null);
    setReadStatus('running');
    setReadStepIndex(0);
    setReadProgress(2);
    setReadSubtitle(ui.readingSteps[0]);
    setCurrentScreen('reading-loader');

    const safeWait = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        if (abortController.signal.aborted) {
          const e = new Error('Cancelled');
          e.name = 'AbortError';
          reject(e);
          return;
        }
        const tId = setTimeout(() => {
          abortController.signal.removeEventListener('abort', onAb);
          resolve();
        }, ms);
        const onAb = () => {
          clearTimeout(tId);
          const e = new Error('Cancelled');
          e.name = 'AbortError';
          reject(e);
        };
        abortController.signal.addEventListener('abort', onAb, { once: true });
      });

    try {
      // STEP 1 (0 -> 15%): Real image resize, contrast verification & JPEG compression
      setReadProgress(6);
      const img = await ImageAnalysisService.loadImage(capturedBase64);
      if (abortController.signal.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });

      const { base64: preparedBase64, sizeBytes } = await ImageAnalysisService.resizeAndCompress(img);
      if (abortController.signal.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });

      setCapturedBase64(preparedBase64);
      setCapturedFileSize(sizeBytes);
      setReadProgress(15);

      // STEP 2 (15 -> 30%): Request sent & response headers received
      setReadStepIndex(1);
      setReadSubtitle(ui.readingSteps[1]);

      let waitStartedAt: number | null = null;
      let isRetryingNow = false;

      const startAsymptoticWait = () => {
        if (waitStartedAt === null) {
          waitStartedAt = Date.now();
        }
        if (readingTimerRef.current) return;
        readingTimerRef.current = setInterval(() => {
          if (abortController.signal.aborted || waitStartedAt === null) return;
          if (isRetryingNow) return; // Hold progress bar steady & pause shimmer while retrying

          const elapsedSec = (Date.now() - waitStartedAt) / 1000;
          const curved = Math.min(89.9, 90 - 60 * Math.exp(-elapsedSec / 12));
          // Monotonic guarantee: never move backwards
          setReadProgress((prev) => Math.max(prev, curved));

          if (elapsedSec >= 20) {
            setReadStepIndex((prev) => Math.max(prev, 3));
            setReadStatus('slow');
            setReadSubtitle(ui.slowWorkingSubtitle);
          } else if (elapsedSec >= 6) {
            setReadStepIndex((prev) => Math.max(prev, 3));
            setReadStatus('running');
            setReadSubtitle(ui.readingSteps[3]);
          } else {
            setReadStepIndex((prev) => Math.max(prev, 2));
            setReadStatus('running');
            setReadSubtitle(ui.readingSteps[2]);
          }
        }, 120);
      };

      const result = await parsePrescriptionWithGemini(preparedBase64, 'image/jpeg', {
        signal: abortController.signal,
        onPhase: (phase, fraction) => {
          if (abortController.signal.aborted) return;

          if (phase === 'sending') {
            if (isRetryingNow) return; // Keep retrying banner/paused state steady until retry receives data
            const frac = typeof fraction === 'number' ? fraction : 0;
            const sendPct = 15 + Math.round(frac * 13);
            setReadStepIndex((prev) => Math.max(prev, 1));
            setReadProgress((prev) => Math.max(prev, sendPct));
          } else if (phase === 'awaiting_model' || phase === 'headers_received') {
            if (isRetryingNow) return;
            setReadProgress((prev) => Math.max(prev, 30));
            setReadStepIndex((prev) => Math.max(prev, 2));
            setReadStatus('running');
            setReadSubtitle((prevSub) =>
              prevSub === ui.slowWorkingSubtitle ? prevSub : ui.readingSteps[2]
            );
            startAsymptoticWait();
          } else if (phase === 'validating') {
            isRetryingNow = false;
            clearReadingTimer();
            setReadStepIndex(4);
            setReadStatus('running');
            setReadSubtitle(ui.readingSteps[4]);
            setReadProgress((prev) => Math.max(prev, 95));
          } else if (phase === 'validated') {
            isRetryingNow = false;
            clearReadingTimer();
            setReadStepIndex(4);
            setReadProgress(100);
            setReadStatus('complete');
            setReadSubtitle(ui.completedSubtitle);
          }
        },
        onRetry: (attempt, maxAttempts) => {
          if (abortController.signal.aborted) return;
          isRetryingNow = true;
          clearReadingTimer();
          setReadStatus('retrying');
          setReadSubtitle(ui.retryingSubtitle(attempt, maxAttempts));
        },
      });

      // Hold at 100% with green check for 600ms before navigating to review
      await safeWait(600);

      setOcrResult(result);
      setOcrMedicines(result.medicines || []);
      setOcrDoctor(result.doctorName || rxDoctorName || '');
      setOcrClinic(result.clinic || '');
      setOcrNotes(result.notes || '');
      if (result.date) {
        setRxDate(result.date);
      }
      readingLockRef.current = false;
      setIsStartingRead(false);
      setCurrentScreen('review-confirm');
    } catch (err: any) {
      clearReadingTimer();
      readingLockRef.current = false;
      setIsStartingRead(false);

      if (err?.name === 'AbortError' || abortController.signal.aborted) {
        setCurrentScreen('capture-metadata');
        return;
      }

      console.warn('Gemini transcription issue:', err);
      const errMsg = err?.message || ui.failedSubtitle;
      setOcrError(errMsg);
      setReadStatus('error');
      setReadSubtitle(ui.failedSubtitle);
    }
  };

  // ---------------- CONFIRM & SCHEDULE CREATION ----------------

  const handleConfirmPrescription = async (
    confirmedMeds: any[],
    confirmedDoc: string,
    confirmedClinic: string
  ) => {
    if (!currentUser || !capturedBase64) return;
    setPendingRxConfirm({ confirmedMeds, confirmedDoc, confirmedClinic });
  };

  const handleFinalizePrescriptionSchedule = async (decision: ConfirmScheduleDecision) => {
    if (!currentUser || !capturedBase64 || !pendingRxConfirm) return;
    const { confirmedMeds, confirmedDoc, confirmedClinic } = pendingRxConfirm;

    try {
      const rxId = `rx_${Date.now()}`;
      const targetProfileId =
        selectedProfileId || profiles[0]?.id || `prof_me_${currentUser.id}`;
      const newRx: StoredPrescription = {
        id: rxId,
        userId: currentUser.id,
        profileId: targetProfileId,
        doctorName: confirmedDoc || undefined,
        clinic: confirmedClinic || undefined,
        doctorRegistrationNumber: ocrResult?.doctorRegistrationNumber || undefined,
        patientName: ocrResult?.patientName || undefined,
        patientAge: ocrResult?.patientAge || undefined,
        patientSex: ocrResult?.patientSex || undefined,
        prescriptionDate: ocrResult?.date || rxDate,
        imageBase64: capturedBase64,
        fileSizeBytes: capturedFileSize,
        status: 'confirmed',
        imageQuality: ocrResult?.imageQuality || undefined,
        warnings: ocrResult?.warnings || undefined,
        followUpText: ocrResult?.followUp?.text || undefined,
        followUpDays: ocrResult?.followUp?.days ?? undefined,
        notes: ocrNotes || undefined,
        createdAt: new Date().toISOString(),
      };

      await dbService.savePrescription(newRx, authService.getEncryptionKey());

      const newStoredMeds: StoredMedicine[] = confirmedMeds.map((m, idx) => {
        const tempKey = m.tempId || String(idx);
        const cleanForm = normalizeFormId(m.form) || undefined;
        const oral = isOralForm(cleanForm);
        const overrideDur = decision.durationOverrideByMedicineTempId[tempKey];
        const finalDuration = m.durationDays ?? overrideDur ?? undefined;
        const isOngoing =
          !m.asNeeded &&
          Boolean(decision.ongoingByMedicineTempId[tempKey]) &&
          !finalDuration;

        return {
          id: `med_${Date.now()}_${idx}`,
          prescriptionId: rxId,
          userId: currentUser.id,
          profileId: newRx.profileId,
          name: m.name,
          nameAsRead: m.nameAsRead || undefined,
          nameCorrected: !!m.nameCorrected,
          genericName: m.genericName || undefined,
          strength: m.strength || undefined,
          form: cleanForm,
          applicationArea: m.applicationArea || undefined,
          formCorrected: !!m.formCorrected,
          route: m.route || undefined,
          dose: m.dose || undefined,
          frequency: m.frequencyCode || m.frequency || undefined,
          frequencyPlain: m.frequencyPlain || undefined,
          doseSchedule: m.doseSchedule || undefined,
          timesPerDay: m.timesPerDay ?? undefined,
          timing: oral ? normalizeTimingValue(m.timing) : 'unspecified',
          timingSuggested: oral ? !!m.timingSuggested : false,
          timingSuggestionSource:
            oral && m.timingSuggested ? m.timingSuggestionSource : undefined,
          asNeeded: !!m.asNeeded,
          durationDays: finalDuration,
          durationText: m.durationText || undefined,
          instructions: m.instructions || undefined,
          confidence: m.confidence ?? 1.0,
          illegible: false,
          flags: m.flags || [],
          startDate: decision.startDate,
          ongoing: isOngoing,
          isImportant: Boolean(decision.importantByMedicineTempId[tempKey]),
          courseEndAlertDismissed: false,
          confirmed: true,
          createdAt: new Date().toISOString(),
        };
      });

      await dbService.saveMedicines(newStoredMeds);

      const targetLang = resolveLanguageForPrescription(rxId, newRx.profileId);
      const generated = generateRemindersForMedicines(newStoredMeds, {
        startDate: decision.startDate,
        firstDoseTime: decision.firstDoseTime,
        mealTimes: reminderSettings.mealTimes,
        langCode: targetLang,
        timezone: getLocalTimezone(),
        settings: reminderSettings,
      });

      if (generated.reminders.length > 0) {
        await dbService.saveReminders(generated.reminders);
      }

      setPendingRxConfirm(null);
      await loadUserData(currentUser.id);

      const scheduledMedNames = newStoredMeds
        .filter((m) => !generated.asNeededMedicines.some((a) => a.id === m.id))
        .map((m) => m.name);
      const medListText =
        scheduledMedNames.length > 0
          ? scheduledMedNames.join(', ')
          : newStoredMeds.map((m) => m.name).join(', ');
      const summaryText =
        generated.totalDoseCount > 0
          ? `${generated.totalDoseCount} reminder${generated.totalDoseCount === 1 ? '' : 's'} set for ${medListText}`
          : `Saved ${medListText} to your schedule`;

      setCreatedSummary({
        text: summaryText,
        asNeededCount: generated.asNeededMedicines.length,
        rx: newRx,
      });
    } catch (err: any) {
      alert('Failed to save prescription: ' + err?.message);
    }
  };

  // ---------------- MANUAL MEDICINE ADDITION (OFFLINE) ----------------

  const handleManualMedicineSaved = async (med: StoredMedicine) => {
    if (!currentUser) return;
    try {
      const existingRx = prescriptions.find((p) => p.id === med.prescriptionId);
      let targetRx = existingRx;
      if (!existingRx) {
        const manualRx: StoredPrescription = {
          id: med.prescriptionId,
          userId: currentUser.id,
          profileId: med.profileId,
          doctorName: rxDoctorName || 'Manual Entry',
          prescriptionDate: rxDate || getLocalDateStr(),
          imageBase64: capturedBase64 || '',
          fileSizeBytes: capturedFileSize || 0,
          status: 'confirmed',
          createdAt: new Date().toISOString(),
        };
        await dbService.savePrescription(manualRx, authService.getEncryptionKey());
        targetRx = manualRx;
      }

      const medWithDates: StoredMedicine = {
        ...med,
        startDate: med.startDate || getLocalDateStr(),
        ongoing: !med.asNeeded && !med.durationDays,
      };
      await dbService.saveSingleMedicine(medWithDates);

      const gen = generateRemindersForMedicine(medWithDates, {
        startDate: medWithDates.startDate || getLocalDateStr(),
        mealTimes: reminderSettings.mealTimes,
        langCode: resolveLanguageForPrescription(medWithDates.prescriptionId, medWithDates.profileId),
        timezone: getLocalTimezone(),
        settings: reminderSettings,
      });

      if (gen.scheduledReminders.length > 0) {
        await dbService.saveReminders(gen.scheduledReminders);
      }

      await loadUserData(currentUser.id);
      if (targetRx) {
        setViewingRx(targetRx);
        setCurrentScreen('view-prescription');
      } else {
        setCurrentScreen('home');
      }
    } catch (e: any) {
      alert('Failed to save medicine: ' + e?.message);
    }
  };

  // ---------------- DELETE PRESCRIPTION ----------------

  const handleDeletePrescription = async (rxId: string) => {
    if (!currentUser) return;
    try {
      await dbService.deletePrescription(currentUser.id, rxId);
      setShowDeleteRxId(null);
      await loadUserData(currentUser.id);
    } catch (err: any) {
      alert('Failed to delete prescription: ' + err?.message);
    }
  };

  // ---------------- REMINDER ACTIONS & 10-SECOND UNDO ----------------

  const pushUndoBanner = (message: string, onUndo: () => Promise<void>) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const id = `undo_${Date.now()}`;
    setUndoBanner({ id, message, expiresAt: Date.now() + 10000, onUndo });
    undoTimerRef.current = setTimeout(() => {
      setUndoBanner((curr) => (curr?.id === id ? null : curr));
    }, 10000);
  };

  const handleUpdateReminderSettings = async (partial: Partial<ReminderSettings>) => {
    if (!currentUser) return;
    const updated: ReminderSettings = { ...reminderSettings, ...partial };
    setReminderSettings(updated);
    setMealTimesDraft({ ...updated.mealTimes });
    await dbService.saveReminderSettings(updated);
  };

  const handleSaveMealTimesAndRebuild = async (newMeals: MealTimesConfig) => {
    if (!currentUser) return;
    const prevSettings = { ...reminderSettings };
    const prevReminders = reminders.map((r) => ({ ...r }));

    const nextSettings: ReminderSettings = {
      ...reminderSettings,
      mealTimes: { ...newMeals },
    };
    setReminderSettings(nextSettings);
    await dbService.saveReminderSettings(nextSettings);

    // Rebuild only Auto meal-slot reminders (preserve Custom, interval, pauses, history)
    const autoReminders = reminders.filter(
      (r) => r.source !== 'custom' && r.slotKey !== 'interval' && r.slotKey !== 'custom'
    );
    const removeIds = autoReminders.map((r) => r.id);
    const rebuilt: StoredReminder[] = [];

    for (const med of medicines) {
      if (!med.confirmed) continue;
      const medAuto = autoReminders.filter((r) => r.medicineId === med.id);
      if (medAuto.length === 0) continue;

      const gen = generateRemindersForMedicine(med, {
        startDate: med.startDate || medAuto[0]?.startDate || getLocalDateStr(),
        mealTimes: newMeals,
        langCode: resolveLanguageForPrescription(med.prescriptionId, med.profileId),
        timezone: getLocalTimezone(),
        settings: nextSettings,
      });
      for (const nr of gen.scheduledReminders) {
        const prevSlot = medAuto.find((o) => o.slotKey === nr.slotKey) || medAuto[0];
        rebuilt.push({
          ...nr,
          id: prevSlot?.id || nr.id,
          isActive: prevSlot ? prevSlot.isActive : nr.isActive,
          pausedUntil: prevSlot?.pausedUntil,
          takenDates: prevSlot?.takenDates,
          skippedDates: prevSlot?.skippedDates,
          missedDates: prevSlot?.missedDates,
          excludedDates: prevSlot?.excludedDates,
        });
      }
    }

    await dbService.replaceRemindersSnapshot(currentUser.id, removeIds, rebuilt);
    await loadUserData(currentUser.id);
    setMealTimesSavedToast(true);
    setTimeout(() => setMealTimesSavedToast(false), 3000);

    pushUndoBanner('Meal times & auto reminders updated', async () => {
      await dbService.saveReminderSettings(prevSettings);
      await dbService.replaceRemindersSnapshot(
        currentUser.id,
        rebuilt.map((r) => r.id),
        prevReminders
      );
      setUndoBanner(null);
      await loadUserData(currentUser.id);
    });
  };

  const handleMarkTaken = async (
    reminder: StoredReminder,
    dateStr: string,
    actualTime?: string
  ) => {
    if (!currentUser) return;
    reminderService.stopLoopingAlarm();
    setActiveAlarmReminder((curr) => (curr?.id === reminder.id ? null : curr));

    const prevSnapshot = { ...reminder };
    const isAlreadyTaken = Boolean(reminder.takenDates?.[dateStr]);
    const targetStatus = isAlreadyTaken && !actualTime ? 'pending' : 'taken';

    await dbService.updateReminderStatus(currentUser.id, reminder.id, targetStatus, {
      dateStr,
      actualTime,
    });
    await loadUserData(currentUser.id);

    if (targetStatus === 'taken') {
      pushUndoBanner(
        `Marked ${reminder.medicineName} as taken${actualTime ? ` at ${actualTime}` : ''}`,
        async () => {
          await dbService.saveReminders([prevSnapshot]);
          setUndoBanner(null);
          await loadUserData(currentUser.id);
        }
      );
    }
  };

  const handleSkipOneDose = async (reminder: StoredReminder, dateStr: string) => {
    if (!currentUser) return;
    reminderService.stopLoopingAlarm();
    setActiveAlarmReminder((curr) => (curr?.id === reminder.id ? null : curr));

    const prevSnapshot = { ...reminder };
    await dbService.updateReminderStatus(currentUser.id, reminder.id, 'skipped', { dateStr });
    await loadUserData(currentUser.id);

    pushUndoBanner(`Skipped ${reminder.medicineName} (${reminder.doseTime})`, async () => {
      await dbService.saveReminders([prevSnapshot]);
      setUndoBanner(null);
      await loadUserData(currentUser.id);
    });
  };

  const handleSkipMedicineToday = async (
    medicineId: string,
    medicineName: string,
    dateStr: string
  ) => {
    if (!currentUser) return;
    reminderService.stopLoopingAlarm();
    const targetRems = reminders.filter(
      (r) => r.medicineId === medicineId && isReminderScheduledForDate(r, dateStr)
    );
    if (targetRems.length === 0) return;

    const prevSnapshots = targetRems.map((r) => ({ ...r }));
    for (const r of targetRems) {
      await dbService.updateReminderStatus(currentUser.id, r.id, 'skipped', { dateStr });
    }
    await loadUserData(currentUser.id);

    pushUndoBanner(`Skipped ${medicineName} for ${dateStr}`, async () => {
      await dbService.saveReminders(prevSnapshots);
      setUndoBanner(null);
      await loadUserData(currentUser.id);
    });
  };

  const handleSnooze = async (
    reminder: StoredReminder,
    dateStr: string,
    minutes: number
  ) => {
    if (!currentUser) return;
    reminderService.stopLoopingAlarm();
    setActiveAlarmReminder((curr) => (curr?.id === reminder.id ? null : curr));

    const snoozedUntil = new Date(Date.now() + minutes * 60000).toISOString();
    await dbService.updateReminderStatus(currentUser.id, reminder.id, 'snoozed', {
      dateStr,
      snoozedUntil,
    });
    await loadUserData(currentUser.id);
  };

  const handleSaveCustomReminder = async (payload: ReminderFormSavePayload) => {
    if (!currentUser) return;
    const prevReminders = reminders.map((r) => ({ ...r }));

    if (payload.mode === 'create') {
      const created: StoredReminder = {
        id: `rem_custom_${Date.now()}`,
        medicineId: payload.medicineId,
        prescriptionId:
          medicines.find((m) => m.id === payload.medicineId)?.prescriptionId || 'custom',
        userId: currentUser.id,
        profileId: selectedProfileId || profiles[0]?.id || '',
        medicineName: payload.medicineName,
        medicineForm: payload.medicineForm,
        doseSentence: payload.label || payload.medicineName,
        doseTime: payload.doseTime,
        foodTiming: 'unspecified',
        remindBeforeMinutes: payload.remindBeforeMinutes,
        repeatMinutes: reminderSettings.repeatIntervalMinutes,
        isActive: payload.isActive,
        source: 'custom',
        scheduleKind: 'scheduled',
        slotKey: 'custom',
        label: payload.label,
        customDays: payload.customDays,
        weekdays: payload.weekdays,
        startDate: payload.startDate,
        courseEndDate: payload.courseEndDate,
        ongoing: payload.ongoing,
        timezone: getLocalTimezone(),
        soundEnabled: payload.soundEnabled,
        isImportant: payload.isImportant,
        lastStatus: 'pending',
        createdAt: new Date().toISOString(),
      };
      await dbService.saveReminders([created]);
      setShowReminderForm(false);
      setEditingReminder(null);
      await loadUserData(currentUser.id);
      return;
    }

    if (!editingReminder) return;

    if (payload.mode === 'edit_one') {
      // Split single occurrence into 1-day custom reminder and exclude targetDate from parent
      const isAlreadySingleDay =
        editingReminder.startDate === payload.targetDate &&
        editingReminder.courseEndDate === payload.targetDate;

      if (isAlreadySingleDay) {
        const updatedSingle: StoredReminder = {
          ...editingReminder,
          medicineId: payload.medicineId,
          medicineName: payload.medicineName,
          medicineForm: payload.medicineForm,
          doseTime: payload.doseTime,
          remindBeforeMinutes: payload.remindBeforeMinutes,
          label: payload.label,
          soundEnabled: payload.soundEnabled,
          isImportant: payload.isImportant,
          isActive: payload.isActive,
          source: 'custom',
        };
        await dbService.saveReminders([updatedSingle]);
      } else {
        const updatedParent: StoredReminder = {
          ...editingReminder,
          excludedDates: {
            ...(editingReminder.excludedDates || {}),
            [payload.targetDate]: true,
          },
        };
        const singleDose: StoredReminder = {
          ...editingReminder,
          id: `rem_custom_one_${Date.now()}`,
          medicineId: payload.medicineId,
          medicineName: payload.medicineName,
          medicineForm: payload.medicineForm,
          doseTime: payload.doseTime,
          remindBeforeMinutes: payload.remindBeforeMinutes,
          label: payload.label,
          customDays: 'daterange',
          startDate: payload.targetDate,
          courseEndDate: payload.targetDate,
          ongoing: false,
          excludedDates: {},
          soundEnabled: payload.soundEnabled,
          isImportant: payload.isImportant,
          isActive: payload.isActive,
          source: 'custom',
          slotKey: 'custom',
          createdAt: new Date().toISOString(),
        };
        await dbService.saveReminders([updatedParent, singleDose]);
      }

      setShowReminderForm(false);
      setEditingReminder(null);
      await loadUserData(currentUser.id);
      pushUndoBanner(`Updated single dose for ${payload.targetDate}`, async () => {
        const curRems = await dbService.getReminders(currentUser.id);
        await dbService.replaceRemindersSnapshot(
          currentUser.id,
          curRems.map((r) => r.id),
          prevReminders
        );
        setUndoBanner(null);
        await loadUserData(currentUser.id);
      });
      return;
    }

    // edit_all: editing an Auto reminder converts it into Custom
    const updatedAll: StoredReminder = {
      ...editingReminder,
      medicineId: payload.medicineId,
      medicineName: payload.medicineName,
      medicineForm: payload.medicineForm,
      doseTime: payload.doseTime,
      customDays: payload.customDays,
      weekdays: payload.weekdays,
      startDate: payload.startDate,
      courseEndDate: payload.courseEndDate,
      ongoing: payload.ongoing,
      remindBeforeMinutes: payload.remindBeforeMinutes,
      label: payload.label,
      soundEnabled: payload.soundEnabled,
      isImportant: payload.isImportant,
      isActive: payload.isActive,
      source: 'custom',
    };
    await dbService.saveReminders([updatedAll]);
    setShowReminderForm(false);
    setEditingReminder(null);
    await loadUserData(currentUser.id);
  };

  const handleDeleteOrDisableReminder = async (r: StoredReminder) => {
    if (!currentUser) return;
    const prevSnapshot = { ...r };
    if (r.source === 'custom') {
      await dbService.deleteReminder(currentUser.id, r.id);
      await loadUserData(currentUser.id);
      pushUndoBanner(`Deleted custom reminder for ${r.medicineName}`, async () => {
        await dbService.saveReminders([prevSnapshot]);
        setUndoBanner(null);
        await loadUserData(currentUser.id);
      });
    } else {
      await dbService.saveReminders([{ ...r, isActive: false }]);
      await loadUserData(currentUser.id);
      pushUndoBanner(`Turned off ${r.medicineName} (${r.doseTime}). Recoverable via Reset.`, async () => {
        await dbService.saveReminders([prevSnapshot]);
        setUndoBanner(null);
        await loadUserData(currentUser.id);
      });
    }
  };

  const handleApplyPause = async (pausedUntilIsoOrDate: string) => {
    if (!currentUser || !pauseModalTarget) return;
    if (pauseModalTarget.type === 'all') {
      const prev = { ...reminderSettings };
      await handleUpdateReminderSettings({ pausedUntil: pausedUntilIsoOrDate });
      setPauseModalTarget(null);
      pushUndoBanner('All reminders paused', async () => {
        await dbService.saveReminderSettings(prev);
        setUndoBanner(null);
        await loadUserData(currentUser.id);
      });
    } else {
      const medRems = reminders.filter((r) => r.medicineId === pauseModalTarget.medicineId);
      const prevSnapshots = medRems.map((r) => ({ ...r }));
      await dbService.saveReminders(
        medRems.map((r) => ({ ...r, pausedUntil: pausedUntilIsoOrDate }))
      );
      setPauseModalTarget(null);
      await loadUserData(currentUser.id);
      pushUndoBanner(`Paused ${pauseModalTarget.medicineName} reminders`, async () => {
        await dbService.saveReminders(prevSnapshots);
        setUndoBanner(null);
        await loadUserData(currentUser.id);
      });
    }
  };

  const handleResumeAll = async () => {
    await handleUpdateReminderSettings({ pausedUntil: null });
  };

  const handleResumeMedicine = async (medicineId: string) => {
    if (!currentUser) return;
    const medRems = reminders.filter((r) => r.medicineId === medicineId);
    if (medRems.length === 0) return;
    await dbService.saveReminders(medRems.map((r) => ({ ...r, pausedUntil: null })));
    await loadUserData(currentUser.id);
  };

  const handleResetMedicineToRx = async (medicineId: string) => {
    if (!currentUser) return;
    const med = medicines.find((m) => m.id === medicineId);
    if (!med) return;

    const existingForMed = reminders.filter((r) => r.medicineId === medicineId);
    const prevSnapshots = existingForMed.map((r) => ({ ...r }));
    const gen = generateRemindersForMedicine(med, {
      startDate: med.startDate || getLocalDateStr(),
      mealTimes: reminderSettings.mealTimes,
      langCode: resolveLanguageForPrescription(med.prescriptionId, med.profileId),
      timezone: getLocalTimezone(),
      settings: reminderSettings,
    });

    await dbService.replaceRemindersSnapshot(
      currentUser.id,
      existingForMed.map((r) => r.id),
      gen.scheduledReminders
    );
    await loadUserData(currentUser.id);

    pushUndoBanner(`Reset ${med.name} to prescription schedule`, async () => {
      await dbService.replaceRemindersSnapshot(
        currentUser.id,
        gen.scheduledReminders.map((r) => r.id),
        prevSnapshots
      );
      setUndoBanner(null);
      await loadUserData(currentUser.id);
    });
  };

  const handleResetAllReminders = async (deleteCustomToo: boolean) => {
    if (!currentUser) return;
    const prevSnapshots = reminders.map((r) => ({ ...r }));
    const toRemove = reminders.filter((r) => deleteCustomToo || r.source !== 'custom');

    const rebuilt: StoredReminder[] = [];
    for (const med of confirmedMeds) {
      const gen = generateRemindersForMedicine(med, {
        startDate: med.startDate || getLocalDateStr(),
        mealTimes: reminderSettings.mealTimes,
        langCode: resolveLanguageForPrescription(med.prescriptionId, med.profileId),
        timezone: getLocalTimezone(),
        settings: reminderSettings,
      });
      rebuilt.push(...gen.scheduledReminders);
    }

    await dbService.replaceRemindersSnapshot(
      currentUser.id,
      toRemove.map((r) => r.id),
      rebuilt
    );
    await loadUserData(currentUser.id);

    pushUndoBanner('All reminders reset to prescription schedule', async () => {
      await dbService.replaceRemindersSnapshot(
        currentUser.id,
        rebuilt.map((r) => r.id),
        prevSnapshots
      );
      setUndoBanner(null);
      await loadUserData(currentUser.id);
    });
  };

  const handleExtendCourse = async (med: StoredMedicine, extraDays: number) => {
    if (!currentUser) return;
    const todayStr = getLocalDateStr();
    const updatedMed: StoredMedicine = {
      ...med,
      startDate: todayStr,
      durationDays: extraDays,
      ongoing: false,
      courseEndAlertDismissed: false,
    };
    await dbService.saveSingleMedicine(updatedMed);

    const oldAutoIds = reminders
      .filter((r) => r.medicineId === med.id && r.source !== 'custom')
      .map((r) => r.id);

    const gen = generateRemindersForMedicine(updatedMed, {
      startDate: todayStr,
      mealTimes: reminderSettings.mealTimes,
      langCode: resolveLanguageForPrescription(updatedMed.prescriptionId, updatedMed.profileId),
      timezone: getLocalTimezone(),
      settings: reminderSettings,
    });

    await dbService.replaceRemindersSnapshot(currentUser.id, oldAutoIds, gen.scheduledReminders);
    setExtendingMedicine(null);
    await loadUserData(currentUser.id);
  };

  const handleDismissCourseEnd = async (med: StoredMedicine) => {
    if (!currentUser) return;
    await dbService.saveSingleMedicine({ ...med, courseEndAlertDismissed: true });
    await loadUserData(currentUser.id);
  };

  const handleLogSosDose = async (med: StoredMedicine) => {
    if (!currentUser) return;
    const now = new Date();
    const log: DoseLog = {
      id: `log_sos_${Date.now()}`,
      userId: currentUser.id,
      prescriptionId: med.prescriptionId,
      profileId: med.profileId,
      medicineId: med.id,
      medicineName: med.name,
      action: 'taken',
      scheduledTime: 'SOS',
      actualTimeStr: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      actualTimestamp: now.toISOString(),
      dateStr: getLocalDateStr(now),
      source: 'auto',
    };
    await dbService.saveDoseLog(log);
  };

  const handleRequestNotificationWithExplanation = async () => {
    const status = reminderService.getCapabilityStatus();
    if (status === 'denied' || status === 'needs_permission') {
      setShowPermissionModal(true);
    } else {
      await reminderService.sendTestReminder(
        activeLanguage.code,
        reminderSettings.soundEnabled,
        reminderSettings.vibrationEnabled
      );
    }
  };

  const handleConfirmNativePermission = async () => {
    const result = await reminderService.requestNotificationPermission();
    setNotificationPerm(result);
    setCapabilityStatus(reminderService.getCapabilityStatus());
    if (result === 'granted') {
      setShowPermissionModal(false);
      await reminderService.sendTestReminder(
        activeLanguage.code,
        reminderSettings.soundEnabled,
        reminderSettings.vibrationEnabled
      );
      await reminderService.syncNotificationScheduleToSW(
        reminders,
        medicines,
        reminderSettings,
        resolveLanguageForPrescription
      );
    }
  };

  // ---------------- PASSWORD STRENGTH METER ----------------
  const calculatePasswordStrength = (pwd: string) => {
    if (!pwd) return { label: 'Empty', score: 0, color: 'bg-slate-200' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { label: 'Weak', score: 25, color: 'bg-red-500' };
    if (score === 2) return { label: 'Fair', score: 50, color: 'bg-amber-500' };
    if (score === 3) return { label: 'Good', score: 75, color: 'bg-blue-500' };
    return { label: 'Strong', score: 100, color: 'bg-[#2E9E6B]' };
  };

  const pwdStrength = calculatePasswordStrength(signupPassword);

  // Filter confirmed medicines and today's schedule
  const confirmedMeds = medicines.filter((m) => m.confirmed);
  const activeReminders = reminders.filter((r) => r.isActive);
  const activePrescriptions = prescriptions.filter((p) => p.status === 'confirmed');
  const queuedScans = prescriptions.filter((p) => p.status === 'waiting_to_read');

  // Completed finite courses needing doctor-visit advisory
  const completedCourseAlerts: CompletedCourseAlert[] = getCompletedCoursesNeedingAlert(
    medicines,
    prescriptions,
    reminders
  );

  const todayDateStr = getLocalDateStr();
  const todayScheduledReminders = reminders
    .filter((r) => isReminderScheduledForDate(r, todayDateStr))
    .sort((a, b) => a.doseTime.localeCompare(b.doseTime));

  // Greeting time of day
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? t('greetingMorning')
      : hour < 17
      ? t('greetingAfternoon')
      : t('greetingEvening');

  // Assistant Query Submission
  const handleAskAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assistantQuery.trim()) return;
    const q = assistantQuery.trim();
    setAssistantQuery('');

    const newMsgs = [...assistantMessages, { sender: 'user' as const, text: q }];
    setAssistantMessages(newMsgs);

    const answer = await offlineAssistant.answerQuestion(q, medicines, reminders);
    setAssistantMessages([
      ...newMsgs,
      { sender: 'assistant', text: answer.text, isOffline: answer.isOfflineAnswer },
    ]);
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#F9FAFB] text-[#1F2937] select-none font-sans overflow-hidden">
      {/* ---------------- OFFLINE STATUS BANNER (Small, quiet) ---------------- */}
      {!isOnline && (
        <div className="w-full bg-amber-600 text-white text-[11px] px-3 py-1 flex items-center justify-between z-40 shrink-0">
          <div className="flex items-center gap-1.5 font-medium">
            <WifiOff className="w-3.5 h-3.5" />
            <span>{translateMedicalTerm('offline_banner', activeLanguage.code)}</span>
          </div>
          <button
            onClick={() => setShowStorageModal(true)}
            className="text-[10px] underline font-bold"
          >
            Details
          </button>
        </div>
      )}

      {/* ---------------- SERVICE WORKER UPDATE PROMPT ---------------- */}
      {swUpdateAvailable && (
        <div className="w-full bg-[#1E88E5] text-white text-[11px] px-3 py-1.5 flex items-center justify-between z-40 shrink-0 shadow-sm">
          <span>New version available</span>
          <button
            onClick={handleUpdateApp}
            className="px-2 py-0.5 bg-white text-blue-700 font-bold rounded text-[10px] shadow-xs"
          >
            Tap to update
          </button>
        </div>
      )}

      {/* ---------------- 1. SPLASH SCREEN ---------------- */}
      {currentScreen === 'splash' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-[#1E88E5] via-[#1976D2] to-[#2E9E6B] text-white text-center">
          <div className="w-20 h-20 bg-white rounded-3xl shadow-2xl flex items-center justify-center mb-4 p-3 animate-bounce">
            <Pill className="w-12 h-12 text-[#1E88E5]" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">PillSync</h1>
          <p className="text-xs text-blue-100 max-w-[240px] mt-1 font-medium">
            Handwritten Doctor Prescriptions in Your Language • Offline-Ready
          </p>
          <div className="mt-8 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-white/70 animate-pulse delay-75" />
            <div className="w-2 h-2 rounded-full bg-white/40 animate-pulse delay-150" />
          </div>
        </div>
      )}

      {/* ---------------- 2. FIRST-LAUNCH LANGUAGE SELECT ---------------- */}
      {currentScreen === 'language-select' && (
        <div className="flex-1 flex flex-col p-5 bg-[#F9FAFB] justify-between">
          <div className="space-y-1 pt-2">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-[#1E88E5] flex items-center justify-center mb-2">
              <Globe className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">{t('selectLanguage')}</h2>
            <p className="text-xs text-slate-500">{t('selectLanguageSubtitle')}</p>
          </div>

          <div className="space-y-2 my-auto py-2">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setActiveLanguage(lang)}
                className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                  activeLanguage.code === lang.code
                    ? 'bg-blue-50/80 border-[#1E88E5] ring-2 ring-blue-100 text-[#1E88E5]'
                    : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="text-sm font-bold" style={{ fontFamily: lang.fontFamily }}>
                    {lang.nativeName}
                  </div>
                  <div className="text-[11px] text-slate-500">{lang.englishName}</div>
                </div>
                {activeLanguage.code === lang.code && (
                  <CheckCircle2 className="w-5 h-5 text-[#1E88E5]" />
                )}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              localStorage.setItem('pillsync_lang_chosen', activeLanguage.code);
              setCurrentScreen('login');
            }}
            className="w-full h-12 bg-[#1E88E5] hover:bg-blue-700 text-white font-bold rounded-2xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
          >
            <span>{t('continueButton')}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ---------------- 3. REAL LOGIN SCREEN ---------------- */}
      {currentScreen === 'login' && (
        <div className="flex-1 flex flex-col p-5 bg-[#F9FAFB] justify-between overflow-y-auto">
          <div className="space-y-4 pt-4">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1E88E5] to-[#2E9E6B] flex items-center justify-center text-white mb-3 shadow-md shadow-blue-500/20">
                <Pill className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">{t('loginTitle')}</h2>
              <p className="text-xs text-slate-500 mt-1">{t('loginSubtitle')}</p>
            </div>

            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-3 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {t('emailLabel')}
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#1E88E5] focus:outline-none shadow-xs"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    {t('passwordLabel')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-[11px] text-[#1E88E5] font-semibold hover:underline"
                  >
                    {t('forgotPassword')}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter your password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full h-11 px-3 pr-10 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#1E88E5] focus:outline-none shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full h-12 bg-[#1E88E5] hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
              >
                {authLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <span>{t('loginButton')}</span>
                )}
              </button>
            </form>
          </div>

          <div className="pt-4 space-y-3 text-center">
            <div>
              <span className="text-xs text-slate-500">{t('dontHaveAccount')} </span>
              <button
                onClick={() => {
                  setAuthError('');
                  setCurrentScreen('signup');
                }}
                className="text-xs font-bold text-[#1E88E5] hover:underline"
              >
                {t('signUp')}
              </button>
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowGitHubExportModal(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <GitBranch className="w-3.5 h-3.5 text-slate-700" />
                <span>Download Source for GitHub</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAndroidApkModal(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#2E9E6B] text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <Smartphone className="w-3.5 h-3.5 text-[#2E9E6B]" />
                <span>Download Android APK</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 4. REAL SIGN-UP SCREEN ---------------- */}
      {currentScreen === 'signup' && (
        <div className="flex-1 flex flex-col p-5 bg-[#F9FAFB] justify-between overflow-y-auto">
          <div className="space-y-3 pt-1">
            <button
              onClick={() => setCurrentScreen('login')}
              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 font-semibold"
            >
              ← Back to Sign In
            </button>

            <div>
              <h2 className="text-xl font-bold text-slate-900">{t('signUpTitle')}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t('signUpSubtitle')}</p>
            </div>

            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
                {authError}
              </div>
            )}

            <form onSubmit={handleSignUp} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {t('fullNameLabel')} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Priya Sharma"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#1E88E5] focus:outline-none shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {t('emailLabel')} *
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#1E88E5] focus:outline-none shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {t('passwordLabel')} * (min 8 characters)
                </label>
                <input
                  type="password"
                  required
                  placeholder="Create a strong password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#1E88E5] focus:outline-none shadow-xs"
                />

                {/* Password Strength Meter */}
                {signupPassword && (
                  <div className="mt-1.5 space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-500">Strength:</span>
                      <span className="font-bold">{pwdStrength.label}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${pwdStrength.color} transition-all duration-300`}
                        style={{ width: `${pwdStrength.score}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Mandatory DPDP Act Consent Checkbox */}
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-2xl">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={signupConsent}
                    onChange={(e) => setSignupConsent(e.target.checked)}
                    className="w-4 h-4 text-[#2E9E6B] rounded border-slate-300 focus:ring-[#2E9E6B] mt-0.5"
                  />
                  <span className="text-[11px] text-slate-700 leading-snug">
                    I consent to PillSync processing my prescription data under India's{' '}
                    <strong>Digital Personal Data Protection (DPDP) Act 2023</strong>.{' '}
                    <button
                      type="button"
                      onClick={() => setModalType('privacy')}
                      className="text-blue-600 font-bold underline"
                    >
                      Read Policy
                    </button>
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={authLoading || !signupConsent}
                className="w-full h-12 bg-[#2E9E6B] hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2"
              >
                {authLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Create Account & Continue</span>
                )}
              </button>
            </form>
          </div>

          <div className="pt-2 text-center">
            <span className="text-xs text-slate-500">Already registered? </span>
            <button
              onClick={() => {
                setAuthError('');
                setCurrentScreen('login');
              }}
              className="text-xs font-bold text-[#1E88E5] hover:underline"
            >
              Sign In
            </button>
          </div>
        </div>
      )}

      {/* ---------------- 5. APP LOCK SCREEN (1 MINUTE BACKGROUND TIMEOUT) ---------------- */}
      {currentScreen === 'app-lock' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#F9FAFB] text-center">
          <div className="w-16 h-16 rounded-3xl bg-blue-100 text-[#1E88E5] flex items-center justify-center mb-4 shadow-md">
            <Lock className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">{t('lockedTitle')}</h3>
          <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
            {t('lockedSubtitle')}
          </p>

          {lockError && (
            <div className="p-2.5 my-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium w-full">
              {lockError}
            </div>
          )}

          <div className="w-full my-4">
            <input
              type="password"
              maxLength={6}
              value={unlockPin}
              onChange={(e) => setUnlockPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-40 h-12 mx-auto bg-white border border-slate-300 rounded-2xl text-center text-2xl font-bold tracking-[8px] focus:ring-2 focus:ring-[#1E88E5] focus:outline-none block shadow-xs"
            />
          </div>

          <div className="w-full space-y-2">
            <button
              onClick={handleUnlockPin}
              className="w-full h-11 bg-[#1E88E5] hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm"
            >
              {t('unlockPin')}
            </button>

            <button
              onClick={handleLogout}
              className="text-xs text-red-600 font-semibold hover:underline block mx-auto pt-2"
            >
              Sign out from this device
            </button>
          </div>
        </div>
      )}

      {/* ---------------- 6. HOME DASHBOARD (REAL USER & EMPTY STATE UNTIL CONFIRMED) ---------------- */}
      {currentScreen === 'home' && currentUser && (
        <div className="flex-1 flex flex-col bg-[#F9FAFB] overflow-y-auto">
          {/* Header */}
          <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
            <div>
              <div className="text-[11px] font-semibold text-slate-500">
                {greeting},
              </div>
              <h2 className="text-base font-extrabold text-slate-900">
                {currentUser.name}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAssistantModal(true)}
                className="p-2 rounded-xl bg-blue-50 text-[#1E88E5] hover:bg-blue-100 transition-colors"
                title="Ask Health Assistant"
              >
                <Sparkles className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  if (currentUser.pinHash) {
                    setCurrentScreen('app-lock');
                  } else {
                    setShowPinModal(true);
                  }
                }}
                className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
                title="PIN Lock"
              >
                <Lock className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4 flex-1">
            {/* PROMINENT GREEN "SCAN A PRESCRIPTION" CTA */}
            <button
              onClick={() => {
                setCapturedBase64(null);
                setShowCaptureModal(true);
              }}
              className="w-full h-14 bg-[#2E9E6B] hover:bg-emerald-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2.5 transition-all text-sm"
            >
              <Camera className="w-5 h-5" />
              <span>{t('scanPrescriptionBtn')}</span>
            </button>

            {/* QUEUED SCANS CLOCK BADGE CARD */}
            {queuedScans.length > 0 && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <div>
                    <span className="text-xs font-bold text-amber-900 block">
                      {queuedScans.length} Prescription{queuedScans.length > 1 ? 's' : ''} Waiting to be read
                    </span>
                    <span className="text-[10px] text-amber-700">
                      Captured offline • Will auto-read when internet reconnects
                    </span>
                  </div>
                </div>

                {isOnline && (
                  <button
                    onClick={syncQueuedScans}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Read</span>
                  </button>
                )}
              </div>
            )}

            {/* EXPIRED COURSE / DOCTOR REVISIT ALERT CARD */}
            {completedCourseAlerts.length > 0 && (
              <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl shadow-xs space-y-2 text-amber-950 animate-in fade-in">
                <div className="flex items-center gap-2 font-bold text-xs text-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Course Complete &bull; Doctor Advisory</span>
                </div>
                {completedCourseAlerts.map((alertItem) => (
                  <div key={alertItem.medicine.id} className="space-y-1">
                    <div className="text-xs font-bold">{alertItem.medicine.name}</div>
                    <p className="text-[11px] leading-relaxed">{alertItem.message}</p>
                    <button
                      type="button"
                      onClick={() => setExtendingMedicine(alertItem.medicine)}
                      className="text-[11px] font-bold text-[#1E88E5] hover:underline"
                    >
                      Doctor extended my course &rarr;
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* EMPTY STATE FOR BRAND NEW USER (ZERO CONFIRMED MEDICINES) */}
            {confirmedMeds.length === 0 ? (
              <div className="p-6 bg-white border border-slate-200 rounded-3xl shadow-xs text-center space-y-3">
                <div className="w-14 h-14 bg-emerald-50 text-[#2E9E6B] rounded-2xl flex items-center justify-center mx-auto">
                  <Pill className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">No medicines yet</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-[240px] mx-auto">
                    Scan a prescription or add medicine manually to build your meal-synchronized schedule.
                  </p>
                </div>

                <button
                  onClick={() => setShowManualEntryModal(true)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Medicine Manually</span>
                </button>
              </div>
            ) : (
              /* DYNAMIC POPULATED CARDS (ONLY SHOWN AFTER A REAL CONFIRMED PRESCRIPTION) */
              <div className="space-y-3">
                {/* 1. Today's Medicines Card */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#1E88E5]" />
                      <h4 className="text-xs font-bold text-slate-800">{t('todaysMedicinesTitle')}</h4>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                      {
                        todayScheduledReminders.filter(
                          (r) =>
                            getReminderStatusForDate(r, todayDateStr, reminderSettings) === 'taken'
                        ).length
                      }{' '}
                      of {todayScheduledReminders.length} Taken
                    </span>
                  </div>

                  <div className="space-y-2">
                    {todayScheduledReminders.slice(0, 4).map((r) => {
                      const rLang = resolveLanguageForPrescription(r.prescriptionId, r.profileId);
                      const med = medicines.find((m) => m.id === r.medicineId);
                      const statusToday = getReminderStatusForDate(
                        r,
                        todayDateStr,
                        reminderSettings
                      );
                      const displayMedName =
                        rLang !== 'en'
                          ? `${r.medicineName} / ${getOfflineTransliteratedName(r.medicineName, rLang)}`
                          : r.medicineName;
                      const sentence = med
                        ? translationService.getInstantMedicineSentence(med, rLang)
                        : buildFormAwareReminderAlertText(
                            r.medicineName,
                            r.medicineForm,
                            r.applicationArea,
                            rLang
                          );
                      const topicalReminder = isTopicalForm(med?.form || r.medicineForm);
                      return (
                        <div
                          key={r.id}
                          className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div
                              dir={rLang === 'ur' ? 'rtl' : 'ltr'}
                              className={`text-xs font-bold truncate ${
                                statusToday === 'taken' || statusToday === 'skipped'
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-800'
                              }`}
                            >
                              {displayMedName}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {r.doseTime} &bull; {sentence}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {statusToday !== 'taken' && statusToday !== 'skipped' && (
                              <button
                                onClick={() => handleSkipOneDose(r, todayDateStr)}
                                className="px-2 py-1 rounded-lg text-[10px] font-medium text-slate-500 hover:bg-slate-200"
                              >
                                Skip
                              </button>
                            )}
                            <button
                              onClick={() => handleMarkTaken(r, todayDateStr)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                statusToday === 'taken'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-[#2E9E6B] text-white hover:bg-emerald-700'
                              }`}
                            >
                              {statusToday === 'taken'
                                ? topicalReminder
                                  ? 'Applied ✓'
                                  : 'Taken ✓'
                                : topicalReminder
                                ? 'Apply'
                                : 'Take'}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {todayScheduledReminders.length === 0 && (
                      <div className="text-xs text-slate-500 text-center py-2">
                        No scheduled doses remaining for today.
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setCurrentScreen('reminders')}
                    className="w-full mt-2 pt-1 text-[11px] text-[#1E88E5] font-semibold flex items-center justify-center gap-1 hover:underline"
                  >
                    <span>View all reminders &amp; timing settings</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 2. Active Courses Card */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-500" />
                      <h4 className="text-xs font-bold text-slate-800">{t('activeCoursesTitle')}</h4>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                      {confirmedMeds.length} Active
                    </span>
                  </div>

                  <div className="space-y-2">
                    {confirmedMeds.map((med) => {
                      const mLang = resolveLanguageForPrescription(med.prescriptionId, med.profileId);
                      const localizedLine = translationService.getInstantMedicineSentence(med, mLang);
                      return (
                        <div key={med.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-900">
                            <span>
                              {mLang !== 'en'
                                ? `${med.name} / ${getOfflineTransliteratedName(med.name, mLang)}`
                                : med.name}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {med.durationDays ? `${med.durationDays} Days` : 'Ongoing'}
                            </span>
                          </div>
                          <div
                            dir={mLang === 'ur' ? 'rtl' : 'ltr'}
                            className="text-[11px] text-slate-600 mt-0.5"
                          >
                            {localizedLine}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Prescription & 7-Language Translation Card */}
                {activePrescriptions.length > 0 && (
                  <button
                    onClick={() => {
                      setViewingRx(activePrescriptions[0]);
                      setCurrentScreen('view-prescription');
                    }}
                    className="w-full text-left p-3.5 bg-gradient-to-r from-blue-50 to-emerald-50 hover:from-blue-100 hover:to-emerald-100 border border-blue-200/80 rounded-2xl shadow-xs transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#1E88E5] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                        <Languages className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <span>View in 7 Indian Languages</span>
                          <span className="text-[9px] bg-[#2E9E6B] text-white px-1.5 py-0.5 rounded font-bold uppercase">
                            Instant
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-600 mt-0.5">
                          {activePrescriptions[0].doctorName ? `Dr. ${activePrescriptions[0].doctorName} • ` : ''}
                          Hindi, Urdu, Telugu, Bengali, Marathi, Tamil
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors shrink-0" />
                  </button>
                )}

                {/* 4. Doctor Visit Card (Only if real prescription with doctor exists) */}
                {activePrescriptions[0]?.doctorName && (
                  <div
                    onClick={() => {
                      setViewingRx(activePrescriptions[0]);
                      setCurrentScreen('view-prescription');
                    }}
                    className="p-3 bg-white border border-slate-200 hover:border-blue-300 rounded-2xl shadow-xs flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="text-[10px] text-slate-500">Prescribing Doctor</div>
                      <div className="text-xs font-bold text-slate-900">
                        {activePrescriptions[0].doctorName}
                      </div>
                      {activePrescriptions[0].clinic && (
                        <div className="text-[10px] text-slate-500">
                          {activePrescriptions[0].clinic}
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                      {activePrescriptions[0].prescriptionDate}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PERMANENT STATUTORY MEDICAL DISCLAIMER FOOTER */}
          <div className="p-3 bg-white border-t border-slate-200 shrink-0">
            <div className="p-2 bg-blue-50/70 border border-blue-200/60 rounded-xl flex items-start gap-2 text-[10px] text-slate-600">
              <Info className="w-3.5 h-3.5 text-[#1E88E5] shrink-0 mt-0.5" />
              <span>{t('medicalDisclaimer')}</span>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 7. PRESCRIPTIONS VAULT TAB ---------------- */}
      {currentScreen === 'prescriptions' && currentUser && (
        <div className="flex-1 flex flex-col bg-[#F9FAFB] overflow-y-auto">
          <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-base font-bold text-slate-900">Prescriptions</h2>
              <p className="text-[10px] text-slate-500">
                {prescriptions.length} Records Scoped in IndexedDB
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowManualEntryModal(true)}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                + Manual
              </button>
              <button
                onClick={() => {
                  setCapturedBase64(null);
                  setShowCaptureModal(true);
                }}
                className="p-2 bg-[#2E9E6B] text-white rounded-xl hover:bg-emerald-700 shadow-xs flex items-center gap-1 text-xs font-bold"
              >
                <Plus className="w-4 h-4" />
                <span>Scan</span>
              </button>
            </div>
          </div>

          <div className="p-4 flex-1">
            {prescriptions.length === 0 ? (
              <div className="p-8 bg-white border border-slate-200 rounded-3xl text-center space-y-3 mt-4">
                <FileText className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-900">No prescriptions uploaded yet</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  Capture a photo of your doctor's handwritten prescription or upload a PDF/HEIC document.
                </p>
                <button
                  onClick={() => setShowCaptureModal(true)}
                  className="px-4 py-2 bg-[#1E88E5] hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
                >
                  Scan First Prescription
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {prescriptions.map((rx) => {
                  const rxMeds = medicines.filter((m) => m.prescriptionId === rx.id);
                  return (
                    <div
                      key={rx.id}
                      onClick={() => {
                        setViewingRx(rx);
                        setCurrentScreen('view-prescription');
                      }}
                      className="p-3.5 bg-white border border-slate-200 hover:border-blue-400 rounded-2xl shadow-xs flex items-center gap-3 cursor-pointer transition-all active:scale-[0.99] group"
                    >
                      {rx.imageBase64 ? (
                        <img
                          src={rx.imageBase64}
                          alt="Prescription"
                          className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-emerald-50 border border-emerald-200 text-[#2E9E6B] flex items-center justify-center shrink-0">
                          <Pill className="w-7 h-7" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-900 truncate">
                            {rx.doctorName || 'Doctor Prescription'}
                          </h4>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              rx.status === 'confirmed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : rx.status === 'waiting_to_read'
                                ? 'bg-amber-100 text-amber-800 flex items-center gap-1'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {rx.status === 'waiting_to_read' ? '⏱ Waiting to be read' : rx.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Date: {rx.prescriptionDate} • {rxMeds.length} {rxMeds.length === 1 ? 'medicine' : 'medicines'}
                        </div>
                        {rx.clinic && (
                          <div className="text-[10px] text-slate-400 truncate">{rx.clinic}</div>
                        )}
                        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-[#1E88E5] font-semibold group-hover:text-blue-700">
                          <Languages className="w-3.5 h-3.5" />
                          <span>View in 7 Languages</span>
                          <ChevronRight className="w-3 h-3 ml-auto text-slate-400 group-hover:text-blue-600" />
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteRxId(rx.id);
                        }}
                        className="p-2 text-slate-400 hover:text-red-600 rounded-lg shrink-0"
                        title="Delete Prescription"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-3 bg-white border-t border-slate-200 shrink-0 text-[10px] text-slate-500 text-center">
            {t('medicalDisclaimer')}
          </div>
        </div>
      )}

      {/* ---------------- 8. REMINDERS & SCHEDULE TAB ---------------- */}
      {currentScreen === 'reminders' && currentUser && (
        <RemindersTab
          reminders={reminders}
          medicines={medicines}
          prescriptions={prescriptions}
          profiles={profiles}
          settings={reminderSettings}
          capabilityStatus={capabilityStatus}
          completedCourses={completedCourseAlerts}
          undoBanner={undoBanner}
          resolveLanguageForPrescription={resolveLanguageForPrescription}
          onUpdateSettings={handleUpdateReminderSettings}
          onOpenPermissionPrompt={handleRequestNotificationWithExplanation}
          onSendTestReminder={() =>
            reminderService.sendTestReminder(
              activeLanguage.code,
              reminderSettings.soundEnabled,
              reminderSettings.vibrationEnabled
            )
          }
          onOpenInstallModal={() => setShowInstallModal(true)}
          onOpenNewReminderForm={(dateStr) => {
            setEditingReminder(null);
            setReminderFormTargetDate(dateStr);
            setShowReminderForm(true);
          }}
          onOpenEditReminderForm={(r, dateStr) => {
            setEditingReminder(r);
            setReminderFormTargetDate(dateStr);
            setShowReminderForm(true);
          }}
          onMarkTaken={handleMarkTaken}
          onSkipOneDose={handleSkipOneDose}
          onSkipMedicineToday={handleSkipMedicineToday}
          onSnooze={handleSnooze}
          onDeleteOrDisableReminder={handleDeleteOrDisableReminder}
          onPauseAll={() => setPauseModalTarget({ type: 'all' })}
          onPauseMedicine={(medicineId, medicineName) =>
            setPauseModalTarget({ type: 'medicine', medicineId, medicineName })
          }
          onResumeAll={handleResumeAll}
          onResumeMedicine={handleResumeMedicine}
          onResetMedicineToRx={handleResetMedicineToRx}
          onResetAllReminders={handleResetAllReminders}
          onExtendCourse={(med) => setExtendingMedicine(med)}
          onDismissCourseEnd={handleDismissCourseEnd}
          onLogSosDose={handleLogSosDose}
          onDismissUndo={() => setUndoBanner(null)}
          medicalDisclaimer={t('medicalDisclaimer')}
        />
      )}

      {/* ---------------- 9. SETTINGS TAB ---------------- */}
      {currentScreen === 'settings' && currentUser && (
        <div className="flex-1 flex flex-col p-4 bg-[#F9FAFB] space-y-4 overflow-y-auto">
          {/* Header */}
          <div className="p-4 bg-white border border-slate-200 rounded-3xl shadow-xs space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-[#1E88E5] flex items-center justify-center font-bold text-base">
                {currentUser.name[0]}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{currentUser.name}</h3>
                <p className="text-xs text-slate-500">{currentUser.email}</p>
              </div>
            </div>
          </div>

          {/* Offline & Storage Manager */}
          <button
            onClick={() => setShowStorageModal(true)}
            className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1E88E5] flex items-center justify-center">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Storage & Offline Health
                </span>
                <span className="text-[11px] text-slate-500">
                  {isOnline ? 'Online • Storage usage & offline queue' : "You're offline • Data safe locally"}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Install to Home Screen Card */}
          <button
            onClick={() => setShowInstallModal(true)}
            className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#2E9E6B] flex items-center justify-center">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Install to Home Screen
                </span>
                <span className="text-[11px] text-slate-500">
                  Step-by-step guidance for Android and iOS
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Download & Export to GitHub Card */}
          <button
            onClick={() => setShowGitHubExportModal(true)}
            className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                <GitBranch className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Download &amp; Export to GitHub
                </span>
                <span className="text-[11px] text-slate-500">
                  Download clean repo ZIP (Web + Android + Flutter + CI)
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Download Android APK Card */}
          <button
            onClick={() => setShowAndroidApkModal(true)}
            className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#2E9E6B] flex items-center justify-center">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Download Android APK
                </span>
                <span className="text-[11px] text-slate-500">
                  Build &amp; download PillSync.apk via GitHub Actions or Gradle
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Default Language Selection */}
          <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-[#1E88E5]" />
                <span>Preferred Default Language</span>
              </div>
              <span className="text-xs font-bold text-blue-600">
                {activeLanguage.nativeName} ({activeLanguage.englishName})
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={async () => {
                    setActiveLanguage(lang);
                    if (currentUser) {
                      const updatedUser = { ...currentUser, preferredLanguage: lang.code };
                      setCurrentUser(updatedUser);
                      await dbService.saveUser(updatedUser);
                    }
                  }}
                  className={`p-2 rounded-xl text-xs font-semibold text-left border transition-all ${
                    activeLanguage.code === lang.code
                      ? 'bg-blue-50 border-[#1E88E5] text-[#1E88E5]'
                      : 'bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {lang.nativeName}
                </button>
              ))}
            </div>
          </div>

          {/* Meal & Sleep Times (Auto-reminder anchor times) */}
          <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <AlarmClock className="w-4 h-4 text-[#2E9E6B]" />
                <span>Meal &amp; Sleep Times</span>
              </div>
              {mealTimesSavedToast && (
                <span className="text-[10px] font-bold text-[#2E9E6B]">Saved &amp; rebuilt</span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Before food runs 30m earlier, after food 30m later, and empty stomach 60m earlier.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {(
                [
                  { key: 'wake', label: 'Wake up' },
                  { key: 'breakfast', label: 'Breakfast' },
                  { key: 'lunch', label: 'Lunch' },
                  { key: 'dinner', label: 'Dinner' },
                  { key: 'bedtime', label: 'Bedtime' },
                ] as { key: keyof MealTimesConfig; label: string }[]
              ).map((slot) => (
                <div key={slot.key}>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                    {slot.label}
                  </label>
                  <input
                    type="time"
                    value={mealTimesDraft[slot.key]}
                    onChange={(e) =>
                      setMealTimesDraft((prev) => ({ ...prev, [slot.key]: e.target.value }))
                    }
                    className="w-full h-9 px-2 border border-slate-300 rounded-xl text-xs bg-slate-50"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => handleSaveMealTimesAndRebuild(mealTimesDraft)}
              className="w-full h-10 bg-[#1E88E5] hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
            >
              Save &amp; Update Meal-Based Reminders
            </button>
          </div>

          {/* Security & PIN Lock */}
          <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-[#1E88E5]" />
                <span>PIN Lock Protection</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 rounded text-slate-700">
                {currentUser.pinHash ? 'Configured' : 'Not Set'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Auto-locks the app when left in the background for 1 minute to prevent unauthorized access.
            </p>
            <button
              onClick={() => setShowPinModal(true)}
              className="w-full h-9 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold"
            >
              {currentUser.pinHash ? 'Change 4-Digit PIN' : 'Set Up Security PIN'}
            </button>
          </div>

          {/* Data Export & Account Deletion (DPDP Act) */}
          <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-[#2E9E6B]" />
              <span>DPDP Act 2023 Data Rights</span>
            </div>

            <button
              onClick={async () => {
                const dump = {
                  user: { name: currentUser.name, email: currentUser.email, consent: currentUser.dpdpConsent },
                  profiles,
                  prescriptions: prescriptions.map((p) => ({ ...p, imageBase64: '[REDACTED_FOR_EXPORT]' })),
                  medicines,
                  reminders,
                };
                const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `PillSync_Health_Data_${currentUser.email}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="w-full h-9 bg-blue-50 text-[#1E88E5] hover:bg-blue-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download My Health Records (JSON)</span>
            </button>

            <button
              onClick={() => setShowDeleteAccountModal(true)}
              className="w-full h-9 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete My Account and Data</span>
            </button>
          </div>

          {/* About & Translation Quality Feedback */}
          <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-[#1E88E5]" />
              <span>About PillSync</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Version 1.0 • Built-in medical glossaries in 7 languages.
            </p>
            <button
              onClick={() => {
                setReportTransText('');
                setReportTransSubmitted(false);
                setShowReportTransModal(true);
              }}
              className="w-full h-9 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#1E88E5]" />
              <span>Report a translation error</span>
            </button>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={handleLogout}
            className="w-full h-11 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4 text-red-500" />
            <span>Sign Out</span>
          </button>
        </div>
      )}

      {/* ---------------- 10. PRESCRIPTION DETAILS SCREEN (REAL + ADD BUTTON) ---------------- */}
      {currentScreen === 'capture-metadata' && currentUser && (
        <div className="flex-1 flex flex-col p-4 bg-[#F9FAFB] justify-between overflow-y-auto">
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Prescription Details</h3>
              <button
                onClick={() => setCurrentScreen('home')}
                className="text-xs text-slate-500 hover:text-slate-700 font-semibold"
              >
                Cancel
              </button>
            </div>

            {/* Thumbnail Preview */}
            {capturedBase64 && (
              <div className="h-32 bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center relative border border-slate-800">
                <img
                  src={capturedBase64}
                  alt="Captured"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )}

            {/* "Who is this for?" Profile Selector with working "+ Add" button */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-800">
                  Who is this prescription for? *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setEditingProfile(null);
                    setShowAddProfileModal(true);
                  }}
                  className="text-xs font-bold text-[#1E88E5] flex items-center gap-1 hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {profiles.map((prof) => (
                  <button
                    type="button"
                    key={prof.id}
                    onClick={() => setSelectedProfileId(prof.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      selectedProfileId === prof.id
                        ? 'bg-blue-50 border-[#1E88E5] text-[#1E88E5] ring-2 ring-blue-100'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {prof.name} {prof.isDefault && '(Me)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Doctor Name Field (EMPTY by default) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Doctor Name (optional)
              </label>
              <input
                type="text"
                placeholder="Leave blank or enter doctor's name"
                value={rxDoctorName}
                onChange={(e) => setRxDoctorName(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#1E88E5] focus:outline-none"
              />
            </div>

            {/* Prescription Date Field (defaults to today) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Prescription Date
              </label>
              <input
                type="date"
                value={rxDate}
                onChange={(e) => setRxDate(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#1E88E5] focus:outline-none"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={isStartingRead}
            onClick={handleStartGeminiReading}
            className="w-full h-12 bg-[#2E9E6B] hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 mt-4"
          >
            <span>{isOnline ? 'Read Prescription with Gemini AI' : 'Save & Queue Offline'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ---------------- 11. HONEST GEMINI READING PROGRESS SCREEN ---------------- */}
      {currentScreen === 'reading-loader' && (() => {
        const langCode = toSupportedLang(activeLanguage.code);
        const ui = PROGRESS_UI_STRINGS[langCode];
        return (
          <HonestProgressScreen
            title={ui.readingTitle}
            subtitle={readSubtitle}
            progress={readProgress}
            steps={ui.readingSteps}
            currentStepIndex={readStepIndex}
            status={readStatus}
            errorMessage={ocrError || undefined}
            thumbnailBase64={capturedBase64 || undefined}
            tips={ui.tips}
            language={activeLanguage}
            cancelLabel={ui.cancel}
            retryLabel={ui.retry}
            enterManuallyLabel={ui.enterManually}
            saveForLaterLabel={ui.saveAndReadLater}
            onCancel={handleCancelReading}
            onRetry={() => {
              readingLockRef.current = false;
              handleStartGeminiReading();
            }}
            onEnterManually={() => {
              setOcrMedicines([]);
              setShowManualEntryModal(true);
            }}
            onSaveForLater={savePrescriptionOfflineForLater}
          />
        );
      })()}

      {/* ---------------- 11B. OFFLINE QUEUED CLOCK CONFIRMATION ---------------- */}
      {currentScreen === 'offline-queued' && (() => {
        const langCode = toSupportedLang(activeLanguage.code);
        const ui = PROGRESS_UI_STRINGS[langCode];
        return (
          <OfflineQueuedConfirmation
            title={ui.offlineSavedTitle}
            description={ui.offlineSavedDesc}
            doneLabel={ui.backToHome}
            thumbnailBase64={capturedBase64 || undefined}
            language={activeLanguage}
            onDone={() => {
              setCapturedBase64(null);
              setCurrentScreen('home');
            }}
          />
        );
      })()}

      {/* ---------------- 12. REVIEW & CONFIRM SCREEN ---------------- */}
      {currentScreen === 'review-confirm' && capturedBase64 && (
        <ReviewMedicinesScreen
          imageBase64={capturedBase64}
          isPrescription={ocrResult?.isPrescription ?? true}
          imageQuality={ocrResult?.imageQuality || 'good'}
          warnings={ocrResult?.warnings || []}
          doctorName={ocrDoctor || rxDoctorName}
          clinic={ocrClinic}
          doctorRegistrationNumber={ocrResult?.doctorRegistrationNumber}
          patientName={ocrResult?.patientName}
          patientAge={ocrResult?.patientAge}
          patientSex={ocrResult?.patientSex}
          prescriptionDate={ocrResult?.date || rxDate}
          followUp={ocrResult?.followUp}
          notes={ocrNotes}
          medicines={ocrMedicines}
          readingFailed={!!ocrError && ocrMedicines.length === 0}
          errorMessage={ocrError || ''}
          language={activeLanguage}
          onRetryReading={handleStartGeminiReading}
          onConfirm={handleConfirmPrescription}
          onCancel={() => setCurrentScreen('home')}
        />
      )}

      {/* ---------------- 13. CONFIRMED PRESCRIPTION 7-LANGUAGE TRANSLATION VIEW ---------------- */}
      {currentScreen === 'view-prescription' && viewingRx && currentUser && (
        <PrescriptionTranslationView
          prescription={viewingRx}
          medicines={medicines.filter((m) => m.prescriptionId === viewingRx.id)}
          patientProfile={profiles.find((p) => p.id === viewingRx.profileId)}
          initialLanguageCode={
            viewingRx.preferredLanguage ||
            profiles.find((p) => p.id === viewingRx.profileId)?.language ||
            activeLanguage.code
          }
          onBack={() => setCurrentScreen('prescriptions')}
          onUpdateLanguagePreference={async (langCode) => {
            // Save per-prescription override AND remember last chosen language on the profile
            await dbService.updatePrescriptionLanguage(currentUser.id, viewingRx.id, langCode);
            setViewingRx((prev) => (prev ? { ...prev, preferredLanguage: langCode } : prev));
            const prof = profiles.find((p) => p.id === viewingRx.profileId);
            if (prof) {
              const updatedProf: PatientProfile = { ...prof, language: langCode };
              await dbService.saveProfile(updatedProf);
            }
            await loadUserData(currentUser.id);
          }}
          onEditMedicine={async (updatedMed) => {
            await dbService.saveSingleMedicine(updatedMed);
            const oldAutoReminders = reminders.filter(
              (r) => r.medicineId === updatedMed.id && r.source !== 'custom'
            );
            const gen = generateRemindersForMedicine(updatedMed, {
              startDate: updatedMed.startDate || getLocalDateStr(),
              mealTimes: reminderSettings.mealTimes,
              langCode: resolveLanguageForPrescription(
                updatedMed.prescriptionId,
                updatedMed.profileId
              ),
              timezone: getLocalTimezone(),
              settings: reminderSettings,
            });
            const rebuiltAuto = gen.scheduledReminders.map((nr) => {
              const prev = oldAutoReminders.find((o) => o.slotKey === nr.slotKey);
              return prev
                ? {
                    ...nr,
                    id: prev.id,
                    isActive: prev.isActive,
                    pausedUntil: prev.pausedUntil,
                    takenDates: prev.takenDates,
                    skippedDates: prev.skippedDates,
                    missedDates: prev.missedDates,
                    excludedDates: prev.excludedDates,
                  }
                : nr;
            });
            await dbService.replaceRemindersSnapshot(
              currentUser.id,
              oldAutoReminders.map((r) => r.id),
              rebuiltAuto
            );
            await loadUserData(currentUser.id);
          }}
        />
      )}

      {/* ---------------- BOTTOM NAVIGATION BAR (Prominent center green Scan button) ---------------- */}
      {['home', 'prescriptions', 'reminders', 'settings'].includes(currentScreen) && currentUser && (
        <div className="relative w-full bg-white border-t border-slate-200 h-16 flex items-center justify-around px-2 z-30 shrink-0">
          {/* Home */}
          <button
            onClick={() => setCurrentScreen('home')}
            className={`flex flex-col items-center justify-center flex-1 py-1 ${
              currentScreen === 'home' ? 'text-[#1E88E5]' : 'text-slate-400'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5">{t('navHome')}</span>
          </button>

          {/* Medicines */}
          <button
            onClick={() => setCurrentScreen('prescriptions')}
            className={`flex flex-col items-center justify-center flex-1 py-1 ${
              currentScreen === 'prescriptions' ? 'text-[#1E88E5]' : 'text-slate-400'
            }`}
          >
            <Pill className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5">{t('navMedicines')}</span>
          </button>

          {/* Prominent Center Green Scan Button */}
          <div className="flex-1 flex justify-center -translate-y-4">
            <button
              onClick={() => {
                setCapturedBase64(null);
                setShowCaptureModal(true);
              }}
              className="w-14 h-14 bg-[#2E9E6B] hover:bg-emerald-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-600/35 border-4 border-[#F9FAFB] transition-transform active:scale-95"
              title="Scan Prescription"
            >
              <Camera className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Reminders */}
          <button
            onClick={() => setCurrentScreen('reminders')}
            className={`flex flex-col items-center justify-center flex-1 py-1 ${
              currentScreen === 'reminders' ? 'text-[#1E88E5]' : 'text-slate-400'
            }`}
          >
            <AlarmClock className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5">{t('navReminders')}</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => setCurrentScreen('settings')}
            className={`flex flex-col items-center justify-center flex-1 py-1 ${
              currentScreen === 'settings' ? 'text-[#1E88E5]' : 'text-slate-400'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5">{t('navSettings')}</span>
          </button>
        </div>
      )}

      {/* ---------------- MODALS & POPUPS ---------------- */}

      {/* PRESCRIPTION CAPTURE MODAL (Label/Input accessible, HEIC, PDF, Drag & Drop, Camera) */}
      <PrescriptionCaptureModal
        isOpen={showCaptureModal}
        onClose={() => setShowCaptureModal(false)}
        onFileProcessed={processCapturedImage}
        onOpenManualEntry={() => setShowManualEntryModal(true)}
      />

      {/* QUALITY CHECK MODAL (Real Canvas Blur & Darkness analysis) */}
      <QualityCheckModal
        isOpen={showQualityModal}
        imageBase64={capturedBase64 || ''}
        analysis={qualityAnalysis}
        onRetake={() => {
          setShowQualityModal(false);
          setShowCaptureModal(true);
        }}
        onRotate={handleRotateCaptured}
        onProceed={handleProceedAfterQuality}
      />

      {/* MANUAL MEDICINE ENTRY MODAL (Offline-Ready) */}
      <ManualMedicineModal
        isOpen={showManualEntryModal}
        userId={currentUser?.id || ''}
        profileId={selectedProfileId || profiles[0]?.id || ''}
        onClose={() => setShowManualEntryModal(false)}
        onMedicineAdded={handleManualMedicineSaved}
        langCode={activeLanguage.code}
      />

      {/* STORAGE & OFFLINE HEALTH MODAL */}
      <StorageOfflineModal
        isOpen={showStorageModal}
        userId={currentUser?.id || ''}
        isOnline={isOnline}
        queuedCount={queuedScans.length}
        onClose={() => setShowStorageModal(false)}
        onSyncQueuedScans={syncQueuedScans}
      />

      {/* INSTALL TO HOME SCREEN MODAL */}
      <InstallPwaModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />

      {/* GITHUB EXPORT & ZIP DOWNLOAD MODAL */}
      <GitHubExportModal
        isOpen={showGitHubExportModal}
        onClose={() => setShowGitHubExportModal(false)}
      />

      {/* ANDROID APK DOWNLOAD & BUILDER MODAL */}
      <AndroidApkModal
        isOpen={showAndroidApkModal}
        onClose={() => setShowAndroidApkModal(false)}
        onOpenInstallPwa={() => setShowInstallModal(true)}
      />

      {/* OFFLINE HEALTH ASSISTANT MODAL */}
      {showAssistantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl text-slate-800 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#1E88E5] flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">PillSync Health Assistant</h4>
                  <span className="text-[10px] text-slate-500">
                    {isOnline ? 'Online • AI Medical Advice' : 'Offline Mode • Schedule Helper'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowAssistantModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2.5 min-h-[180px]">
              {assistantMessages.length === 0 ? (
                <div className="text-center py-6 space-y-2 text-xs text-slate-500">
                  <HelpCircle className="w-8 h-8 text-slate-300 mx-auto" />
                  <p>Ask anything about your medications or schedule:</p>
                  <div className="flex flex-wrap gap-1.5 justify-center pt-2">
                    <button
                      onClick={() => setAssistantQuery('What is my next dose?')}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px]"
                    >
                      "What is my next dose?"
                    </button>
                    <button
                      onClick={() => setAssistantQuery('What medicines today?')}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px]"
                    >
                      "What medicines today?"
                    </button>
                  </div>
                </div>
              ) : (
                assistantMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-[#1E88E5] text-white rounded-br-none'
                          : 'bg-slate-100 text-slate-800 rounded-bl-none'
                      }`}
                    >
                      {msg.text}
                    </div>
                    {msg.isOffline && (
                      <span className="text-[9px] text-amber-600 mt-0.5">Answered from local records</span>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Input form */}
            <form onSubmit={handleAskAssistant} className="pt-2 border-t border-slate-100 flex gap-2">
              <input
                type="text"
                placeholder={isOnline ? 'Ask about medicines...' : 'Ask about schedule (works offline)...'}
                value={assistantQuery}
                onChange={(e) => setAssistantQuery(e.target.value)}
                className="flex-1 h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#1E88E5] focus:outline-none"
              />
              <button
                type="submit"
                className="w-10 h-10 bg-[#1E88E5] text-white rounded-xl flex items-center justify-center shrink-0 hover:bg-blue-700"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* WORKING "+ ADD" PROFILE MODAL */}
      <AddProfileModal
        isOpen={showAddProfileModal}
        userId={currentUser?.id || ''}
        existingProfile={editingProfile}
        onClose={() => {
          setShowAddProfileModal(false);
          setEditingProfile(null);
        }}
        onProfileSaved={(newProf) => {
          if (currentUser) loadUserData(currentUser.id);
          setSelectedProfileId(newProf.id);
        }}
        onProfileDeleted={() => {
          if (currentUser) loadUserData(currentUser.id);
        }}
      />

      {/* PIN SETUP MODAL */}
      {showPinModal && currentUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl text-slate-800">
            <h4 className="text-sm font-bold text-slate-900 mb-1">Set 4-6 Digit Security PIN</h4>
            <p className="text-[11px] text-slate-500 mb-3">
              PIN is hashed with PBKDF2 salt. Automatically locks when backgrounded for 1+ minute.
            </p>
            <input
              type="password"
              maxLength={6}
              value={newPinInput}
              onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full h-11 px-3 text-center tracking-[6px] text-xl font-bold border border-slate-300 rounded-xl mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowPinModal(false);
                  setNewPinInput('');
                }}
                className="flex-1 h-9 bg-slate-100 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (newPinInput.length >= 4) {
                    await authService.setPin(newPinInput);
                    setShowPinModal(false);
                    setNewPinInput('');
                    alert('Security PIN configured successfully.');
                  }
                }}
                className="flex-1 h-9 bg-[#1E88E5] text-white rounded-xl text-xs font-bold"
              >
                Save PIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORGOT PASSWORD MODAL */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl text-slate-800">
            <h4 className="text-sm font-bold text-slate-900 mb-1">Reset Account Password</h4>
            <p className="text-[11px] text-slate-500 mb-3">
              Enter your registered email address to receive password recovery instructions.
            </p>
            {!isOnline ? (
              <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs mb-3 font-medium">
                You are currently offline. Please connect to the internet to reset your password.
              </div>
            ) : forgotSuccess ? (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs mb-3 font-medium">
                Password reset link sent to your email address!
              </div>
            ) : (
              <input
                type="email"
                placeholder="name@example.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full h-10 px-3 border border-slate-300 rounded-xl text-xs mb-3"
              />
            )}
            <button
              onClick={() => {
                if (forgotSuccess || !isOnline) {
                  setShowForgotModal(false);
                  setForgotSuccess(false);
                  setForgotEmail('');
                } else if (forgotEmail.includes('@')) {
                  setForgotSuccess(true);
                }
              }}
              className="w-full h-10 bg-[#1E88E5] text-white rounded-xl text-xs font-bold"
            >
              {forgotSuccess || !isOnline ? 'Close' : 'Send Reset Link'}
            </button>
          </div>
        </div>
      )}

      {/* DELETE PRESCRIPTION CONFIRMATION MODAL */}
      {showDeleteRxId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl text-slate-800">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">Delete Prescription?</h4>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              This will permanently delete this prescription, its transcribed medicines, and all scheduled alarms from your device.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowDeleteRxId(null)}
                className="flex-1 h-9 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePrescription(showDeleteRxId)}
                className="flex-1 h-9 bg-red-600 text-white rounded-xl text-xs font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ACCOUNT MODAL */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl text-slate-800">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">{t('deleteDialogTitle')}</h4>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              {t('deleteWarning')}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowDeleteAccountModal(false)}
                className="flex-1 h-9 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="flex-1 h-9 bg-red-600 text-white rounded-xl text-xs font-bold"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DPDP STATUTORY CONSENT MODAL */}
      <DpdpComplianceModal
        isOpen={modalType !== null}
        onClose={() => setModalType(null)}
        type={modalType || 'privacy'}
      />

      {/* REPORT TRANSLATION ERROR MODAL */}
      {showReportTransModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl text-slate-800">
            <h4 className="text-sm font-bold text-slate-900 mb-1">Report a translation error</h4>
            <p className="text-[11px] text-slate-500 mb-3">
              Help native speakers improve PillSync's built-in glossary. Note the language, English phrase, and suggested wording.
            </p>
            {reportTransSubmitted ? (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs mb-3 font-medium">
                Thank you! Your translation feedback has been saved for native-speaker review.
              </div>
            ) : (
              <textarea
                rows={4}
                placeholder="e.g. Hindi: 'after food' wording or medicine sentence..."
                value={reportTransText}
                onChange={(e) => setReportTransText(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl text-xs mb-3 focus:ring-2 focus:ring-[#1E88E5] focus:outline-none"
              />
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setShowReportTransModal(false)}
                className="flex-1 h-9 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
              >
                {reportTransSubmitted ? 'Close' : 'Cancel'}
              </button>
              {!reportTransSubmitted && (
                <button
                  onClick={() => {
                    if (!reportTransText.trim()) return;
                    try {
                      const prev = JSON.parse(
                        localStorage.getItem('pillsync_translation_feedback') || '[]'
                      );
                      prev.push({
                        text: reportTransText.trim(),
                        lang: activeLanguage.code,
                        at: new Date().toISOString(),
                      });
                      localStorage.setItem('pillsync_translation_feedback', JSON.stringify(prev));
                    } catch {
                      // ignore storage error
                    }
                    setReportTransSubmitted(true);
                  }}
                  className="flex-1 h-9 bg-[#1E88E5] text-white rounded-xl text-xs font-bold"
                >
                  Submit Feedback
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- REMINDERS & ALARMS MODALS & OVERLAYS ---------------- */}
      <ActiveAlarmBanner
        reminder={activeAlarmReminder}
        hideMedicineName={reminderSettings.hideMedicineNamesInNotifications}
        snoozeMinutes={reminderSettings.snoozeDefaultMinutes}
        onTaken={(r) => handleMarkTaken(r, getLocalDateStr())}
        onSnooze={(r, mins) => handleSnooze(r, getLocalDateStr(), mins)}
        onSkip={(r) => handleSkipOneDose(r, getLocalDateStr())}
      />

      <ConfirmScheduleModal
        isOpen={pendingRxConfirm !== null}
        pendingMeds={pendingRxConfirm?.confirmedMeds || []}
        mealTimes={reminderSettings.mealTimes}
        onCancel={() => setPendingRxConfirm(null)}
        onConfirmSchedule={handleFinalizePrescriptionSchedule}
      />

      <RemindersCreatedSummaryModal
        isOpen={createdSummary !== null}
        summaryText={createdSummary?.text || ''}
        asNeededCount={createdSummary?.asNeededCount || 0}
        onReviewReminders={() => {
          const rx = createdSummary?.rx || null;
          setCreatedSummary(null);
          if (rx) setViewingRx(rx);
          setCurrentScreen('reminders');
        }}
        onContinueToPrescription={() => {
          const rx = createdSummary?.rx || null;
          setCreatedSummary(null);
          if (rx) setViewingRx(rx);
          setCurrentScreen('view-prescription');
        }}
      />

      <FriendlyPermissionModal
        isOpen={showPermissionModal}
        permissionState={notificationPerm}
        onClose={() => setShowPermissionModal(false)}
        onAllowClick={handleConfirmNativePermission}
      />

      <ReminderFormModal
        isOpen={showReminderForm}
        editingReminder={editingReminder}
        targetDate={reminderFormTargetDate}
        confirmedMeds={confirmedMeds}
        existingReminders={reminders}
        onClose={() => {
          setShowReminderForm(false);
          setEditingReminder(null);
        }}
        onSave={handleSaveCustomReminder}
      />

      <MissedDosesSheet
        isOpen={showMissedDosesModal}
        missedItems={missedDosesList}
        onClose={() => setShowMissedDosesModal(false)}
        onMarkTaken={async (r, dateStr, actualTime) => {
          await handleMarkTaken(r, dateStr, actualTime);
          setMissedDosesList((prev) => {
            const next = prev.filter((x) => !(x.reminder.id === r.id && x.dateStr === dateStr));
            if (next.length === 0) setShowMissedDosesModal(false);
            return next;
          });
        }}
        onMarkSkipped={async (r, dateStr) => {
          await handleSkipOneDose(r, dateStr);
          setMissedDosesList((prev) => {
            const next = prev.filter((x) => !(x.reminder.id === r.id && x.dateStr === dateStr));
            if (next.length === 0) setShowMissedDosesModal(false);
            return next;
          });
        }}
        onMarkUnsure={async (r, dateStr) => {
          if (!currentUser) return;
          await dbService.updateReminderStatus(currentUser.id, r.id, 'missed', {
            dateStr,
            unsure: true,
          });
          await loadUserData(currentUser.id);
          setMissedDosesList((prev) => {
            const next = prev.filter((x) => !(x.reminder.id === r.id && x.dateStr === dateStr));
            if (next.length === 0) setShowMissedDosesModal(false);
            return next;
          });
        }}
      />

      <PauseRemindersModal
        isOpen={pauseModalTarget !== null}
        scopeLabel={
          pauseModalTarget?.type === 'medicine'
            ? pauseModalTarget.medicineName
            : 'All Reminders'
        }
        onClose={() => setPauseModalTarget(null)}
        onPause={handleApplyPause}
      />

      <CourseExtensionModal
        isOpen={extendingMedicine !== null}
        medicine={extendingMedicine}
        onClose={() => setExtendingMedicine(null)}
        onExtend={handleExtendCourse}
      />
    </div>
  );
};
