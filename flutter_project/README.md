# PillSync (Flutter Mobile App) — Step 1 Architecture

> **AI-Powered Handwritten Prescription Reader, Indian Language Translator & Medication Adherence Companion**  
> Built with Flutter (Material 3), Riverpod 2.5, go_router, Firebase Auth & Firestore (offline persistence), Hardware Secure Enclave PIN hashing (PBKDF2), and DPDP Act 2023 compliance.

---

## 📁 Project Architecture & Clean Folder Structure

```
pillsync/
├── pubspec.yaml                 # Dependencies (Riverpod, go_router, firebase, crypto, local_auth)
├── l10n.yaml                    # Flutter l10n ARB translation generator config
├── firestore.rules              # Strict user-isolated rules (/users/{uid}/**)
├── android/
│   └── app/src/main/AndroidManifest.xml   # Permissions (Biometrics, SMS Autofill, Notifications)
├── ios/
│   └── Runner/Info.plist        # NSFaceIDUsageDescription, APNs background modes
└── lib/
    ├── main.dart                # App entrypoint, WidgetsBindingObserver, ProviderScope
    ├── core/
    │   ├── theme/
    │   │   ├── app_colors.dart  # Strict color palette (Blue #1E88E5, Green #2E9E6B, Gray #1F2937)
    │   │   └── app_theme.dart   # 12px radius, 48dp+ tap targets, WCAG AA, multi-script fonts
    │   ├── i18n/
    │   │   └── app_languages.dart # Config array: en, hi, ur (RTL), te, bn, mr, ta
    │   ├── router/
    │   │   └── app_router.dart  # GoRouter redirect guards (auth guard + 1-min app lock guard)
    │   └── utils/
    │       ├── security_utils.dart # PBKDF2 salt+hash PIN, local_auth, 5-attempt lockout
    │       └── firebase_error_mapper.dart # Sanitized user-friendly error strings
    ├── features/
    │   ├── auth/
    │   │   ├── domain/
    │   │   │   ├── user_entity.dart     # Minimal entity with DPDP Act 2023 audit trail
    │   │   │   └── auth_repository.dart # Swappable repository interface
    │   │   ├── data/
    │   │   │   └── firebase_auth_repository.dart # Firebase Auth + Cloud Firestore offline DB
    │   │   └── presentation/
    │   │       ├── auth_providers.dart  # Riverpod StateNotifiers & StreamProviders
    │   │       └── screens/
    │   │           ├── splash_screen.dart             # Gradient #1E88E5 -> #2E9E6B + Logo
    │   │           ├── language_selection_screen.dart # 7 Indian languages selector
    │   │           ├── login_screen.dart              # Email/pass + Phone OTP (+91, 30s timer)
    │   │           ├── signup_screen.dart             # Password meter + mandatory DPDP consent
    │   │           ├── security_setup_screen.dart     # Skippable Biometric + PIN setup
    │   │           ├── app_lock_screen.dart           # Background timeout & biometric unlock
    │   │           └── home_placeholder_screen.dart   # Welcome, re-auth deletion flow
    │   ├── capture/       # (Step 2: camera, crop, multi-page scan upload)
    │   ├── parsing/       # (Step 2: Gemini OCR client, medicine review screen)
    │   ├── translation/   # (Step 3: Indic translator, medical glossary, PDF export)
    │   ├── schedule/      # (Step 3: ScheduleBuilder, today view)
    │   ├── reminders/     # (Step 4: ReminderScheduler, alarms & push notifications)
    │   ├── courses/       # (Step 4: doctor course completion alerts & re-visit tracking)
    │   └── settings/      # (Step 5: profiles, privacy, language switcher)
    ├── shared/
    │   └── ui/
    │       ├── offline_banner.dart        # connectivity_plus offline banner
    │       └── dpdp_consent_dialog.dart   # DPDP Act 2023 Privacy Policy & Terms modal
    └── l10n/
        ├── app_en.arb   # English
        ├── app_hi.arb   # हिन्दी (Hindi)
        ├── app_ur.arb   # اردو (Urdu - full RTL)
        ├── app_te.arb   # తెలుగు (Telugu)
        ├── app_bn.arb   # বাংলা (Bengali)
        ├── app_mr.arb   # मराठी (Marathi)
        └── app_ta.arb   # தமிழ் (Tamil)
```

---

## ⚙️ Platform Setup Instructions

### 1. Firebase Provisioning & Storage Rules
Run the FlutterFire CLI in the project root:
```bash
flutterfire configure \
  --project=pillsync-health \
  --platforms=android,ios
```
Deploy the Storage rules (`storage.rules`) and Firestore rules (`firestore.rules`):
```bash
firebase deploy --only storage,firestore
```
Prescription images are saved exclusively to `users/{uid}/prescriptions/{rxId}.jpg` and protected by owner-only read/write rules under DPDP Act 2023.

### 2. Android Setup (Camera, Gallery, SMS & Biometrics)
1. **Camera & Gallery**: Manifest permissions configured in `android/app/src/main/AndroidManifest.xml`:
   - `android.permission.CAMERA`
   - `android.permission.READ_MEDIA_IMAGES` (Android 13+)
   - `android.permission.READ_EXTERNAL_STORAGE` (legacy)
2. **SHA-1 and SHA-256 Fingerprints**:
   Required by Firebase Phone Auth:
   ```bash
   cd android && ./gradlew signingReport
   ```
   Add the generated keys to Firebase Console.

### 3. iOS Setup (Camera, Photos & Face ID)
Keys configured in `ios/Runner/Info.plist`:
- `NSCameraUsageDescription`: *"PillSync needs access to your camera to photograph doctor prescriptions and convert them into clear dosage reminders."*
- `NSPhotoLibraryUsageDescription`: *"PillSync needs photo gallery access to let you upload previously saved prescription images and medical documents."*
- `NSFaceIDUsageDescription`: Face ID biometric encryption.
- Supports Apple HEIC image decoding natively via `image_picker`.

---

## 🚀 How to Run the App

1. Fetch dependencies:
   ```bash
   flutter pub get
   ```
2. Generate localized synthetic classes:
   ```bash
   flutter gen-l10n
   ```
3. Run on connected emulator or physical device:
   ```bash
   flutter run
   ```

---

## 🧪 Comprehensive Testing Checklist

| Test Item | Verification Scenario | Expected Result |
| :--- | :--- | :--- |
| **1. Permission Denied** | Tap camera and tap "Deny"; repeat until permanently denied | Friendly explanation dialog displays. Permanently denied state exposes "Open Settings" button via `openAppSettings()`. |
| **2. Blurry Image Warning** | Capture out-of-focus or motion-blurred photo | Quality check detects low sharpness score and shows yellow warning banner: *"Image appears blurry. Doctor's handwriting may be difficult to transcribe"* with "Retake Photo". |
| **3. Darkness & Low Res** | Photograph in dark room or pick tiny low-res thumbnail | Quality inspector flags darkness (< 0.22 avg luminance) and low resolution (< 80 KB). |
| **4. Large File (> 10 MB)** | Attempt to import a raw file > 10 MB | Rejected immediately before upload with friendly banner: *"File exceeds the 10 MB limit. Please select a smaller photo or document."* |
| **5. HEIC Format Handling**| Select Apple high-efficiency `.heic` photo from iOS gallery | Decoded cleanly, cropped, rotated, and compressed into standard 1600px JPEG. |
| **6. PDF Document Import** | Select medical PDF multi-page document | First page is rendered and extracted to high-res JPEG via `pdfx` for OCR preparation. |
| **7. "Who is this for?"** | Check profile attribution dropdown during metadata entry | Defaults to "Me" (created automatically on first login). Tapping "+ Add Profile" creates family members (Mother, Father, Child). |
| **8. Upload Progress & Storage**| Save prescription with network active | Real-time progress bar advances (0% to 100%). File saved to `users/{uid}/prescriptions/{rxId}.jpg` and Firestore doc created with status `"uploaded"`. |
| **9. Offline Queueing** | Turn on airplane mode / toggle offline then save | Local copy saved in app-private folder. Warning chip appears: *"Saved locally. Will upload when you're online."* |
| **10. Deletion Flow** | Tap delete icon on prescription card | Confirmation dialog warns under DPDP Act 2023. Confirmed deletion permanently purges Firebase Storage file, Firestore document, and local private cache. |
| **11. Shell Navigation & RTL**| Switch between Bottom NavigationBar tabs and select Urdu | Home, Medicines, prominent green Scan button, Reminders, and Settings adjust smoothly. Urdu renders 100% RTL. |
| **12. Medical Disclaimer** | Inspect footer on Home and Prescriptions | Permanent localized statutory note: *"PillSync is an assistant, not a doctor. Always confirm with your doctor or pharmacist."* |
