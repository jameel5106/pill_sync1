# PillSync — Prescription Translator & Health Companion

AI-powered handwritten doctor prescription reader, 7-language Indian prescription translator, meal-synchronized smart medication reminders, and DPDP Act 2023 compliant local-first health vault.

Includes both the **Full-Stack React + Express Web/PWA App** and the **Flutter Mobile Architecture** (`flutter_project/`).

---

## Key Features

- **Handwritten Prescription OCR (Gemini AI)**: Server-side `/api/parse-prescription` pipeline with image quality inspection (blur, brightness, resolution), HEIC & PDF first-page import, and safety-first review confirmation.
- **7 Indian Languages + RTL Support**: Instant patient-friendly instructions and medicine name transliteration across **English**, **Hindi (हिन्दी)**, **Urdu (اردو — RTL)**, **Telugu (తెలుగు)**, **Bengali (বাংলা)**, **Marathi (मराठी)**, and **Tamil (தமிழ்)**.
- **Meal-Synchronized Smart Reminders**: Deterministic schedule builder tied to breakfast, lunch, dinner, and bedtime with snooze, skip, 10-second undo, course completion advisories, and Service Worker notifications.
- **Offline-First & Encrypted Storage**: Local IndexedDB persistence with Web Crypto encryption for prescription images and offline scan queueing that auto-syncs when online.
- **DPDP Act 2023 Compliance**: Explicit consent capture, JSON health record export, and one-tap permanent data erasure.
- **Flutter Mobile Source (`flutter_project/`)**: Clean Riverpod + `go_router` + Firebase Auth/Firestore + PBKDF2 PIN lock architecture with ARB catalogs for all 7 languages.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons, Noto Sans / Nastaliq fonts
- **Backend**: Node.js, Express, `@google/genai` SDK (`server.ts`)
- **PWA & Offline**: Service Worker (`public/sw.js`), Web App Manifest, IndexedDB, `pdfjs-dist`, `heic2any`, `jspdf`, `jszip`
- **Mobile Companion**: Flutter 3, Riverpod, `go_router`, Firebase (`flutter_project/`)

---

## Getting Started (Local & GitHub Clone)

### Prerequisites

- **Node.js** 20+ and **npm**
- A **Gemini API Key** from Google AI Studio

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/pillsync.git
cd pillsync
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and add your Gemini API key:

```bash
cp .env.example .env
```

Edit `.env`:

```env
GEMINI_API_KEY="your_gemini_api_key_here"
APP_URL="http://localhost:3000"
```

> **Security note**: Never commit `.env` to GitHub. It is already ignored in `.gitignore`.

### 4. Run in development

```bash
npm run dev
```

The Express + Vite server will start on `http://localhost:3000`.

### 5. Build, lint, and test

```bash
npm run lint
npm test
npm run build
```

---

## Android APK Download & Build (`android/`)

### Automatic APK via GitHub Actions & Releases
Pushing to `main` (or manually triggering the **Build Android APK** workflow under **Actions**) compiles `PillSync.apk` (`com.pillsync.app`) using Capacitor + Android Gradle and publishes it to:
- **GitHub Releases**: `https://github.com/<your-username>/<your-repo>/releases/download/apk-latest/PillSync.apk`
- **GitHub Actions Artifacts**: `PillSync-Android-APK`

### Build APK Locally (requires Java 21 & Android SDK)
```bash
npm install
npm run android:apk
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Project Structure

```text
.
├── .github/workflows/
│   ├── ci.yml                 # GitHub Actions CI (lint, test, build)
│   └── build-apk.yml          # Automated Capacitor Android APK builder & Release publisher
├── .env.example               # Environment variable template
├── .gitignore                 # Excludes node_modules, dist, .env, build artifacts
├── .npmrc                     # Sets legacy-peer-deps=true for clean npm installs
├── capacitor.config.ts        # Capacitor config (com.pillsync.app)
├── android/                   # Native Android Gradle project
├── server.ts                  # Express server, Gemini OCR/translation API & GitHub ZIP export
├── index.html                 # App entry HTML & PWA metadata
├── public/                    # Manifest, Service Worker & app icons
├── src/
│   ├── components/            # React UI screens & modals
│   ├── config/                # Medicine forms & API base configuration
│   ├── data/                  # Translations, drug timing reference & Flutter catalog
│   ├── services/              # IndexedDB, crypto, OCR client, scheduler & PDF export
│   ├── translations/          # Multilingual glossary & tests
│   └── utils/                 # Frequency & review helpers
└── flutter_project/           # Flutter mobile architecture & l10n ARB files
```

---

## Flutter Mobile App (`flutter_project/`)

See [`flutter_project/README.md`](./flutter_project/README.md) for Firebase setup, Android/iOS camera & biometric permissions, and `flutter run` instructions.

---

## Medical Disclaimer

PillSync is a prescription reading and medication reminder assistant, **not a doctor**. Always verify transcribed medicine names, strengths, and dosage instructions with your doctor or pharmacist.

---

## License

MIT License — see [`LICENSE`](./LICENSE).
