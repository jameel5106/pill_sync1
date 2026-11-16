// NEEDS NATIVE-SPEAKER REVIEW
// Layer 1 Deterministic Offline Medical Glossary, Language Templates, and UI Strings for PillSync.
// Supports 7 languages: English (en), Hindi (hi), Urdu (ur), Telugu (te), Bengali (bn), Marathi (mr), Tamil (ta).
// IMPORTANT SAFETY RULE: Always use Latin digits (0-9) for doses, strengths, and day counts in every language
// so medication numbers cannot be misread.

import type { StoredMedicine } from '../services/db';
import {
  normalizeHandwritingFrequency,
  buildEnglishFrequencySentence,
} from '../utils/frequencyHelper';
import {
  getMedicineFormDef,
  isFoodTimingApplicable,
  isTopicalForm,
  isDropsForm,
  normalizeFormId,
  resolveApplicationAreaLabel,
} from '../config/medicineForms';

export type SupportedLangCode = 'en' | 'hi' | 'ur' | 'te' | 'bn' | 'mr' | 'ta';

// NEEDS NATIVE-SPEAKER REVIEW
export const GLOSSARY_TERMS: Record<string, Record<SupportedLangCode, string>> = {
  take: {
    en: 'Take',
    hi: 'लें',
    ur: 'لیں',
    te: 'తీసుకోండి',
    bn: 'নিন',
    mr: 'घ्या',
    ta: 'எடுத்துக்கொள்ளவும்',
  },
  apply: {
    en: 'Apply',
    hi: 'लगाएं',
    ur: 'لگائیں',
    te: 'రాయండి',
    bn: 'লাগান',
    mr: 'लावा',
    ta: 'தடவவும்',
  },
  put_in_eye: {
    en: 'Put in the eye',
    hi: 'आँख में डालें',
    ur: 'آنکھ میں ڈالیں',
    te: 'కంటిలో వేసుకోండి',
    bn: 'চোখে দিন',
    mr: 'डोळ्यात टाका',
    ta: 'கண்ணில் போடவும்',
  },
  put_in_ear: {
    en: 'Put in the ear',
    hi: 'कान में डालें',
    ur: 'کان میں ڈالیں',
    te: 'చెవిలో వేసుకోండి',
    bn: 'কানে দিন',
    mr: 'कानात टाका',
    ta: 'காதில் போடவும்',
  },
  put_in_nose: {
    en: 'Put in the nose',
    hi: 'नाक में डालें',
    ur: 'ناک میں ڈالیں',
    te: 'ముక్కులో వేసుకోండి',
    bn: 'নাকে দিন',
    mr: 'नाकात टाका',
    ta: 'மூக்கில் போடவும்',
  },
  inhale: {
    en: 'Inhale',
    hi: 'सूंघें / पफ लें',
    ur: 'سانس کے ذریعے لیں',
    te: 'పీల్చుకోండి',
    bn: 'শ্বাসের সাথে টেনে নিন',
    mr: 'श्वासाद्वारे घ्या',
    ta: 'உள்ளிழுக்கவும்',
  },
  inject: {
    en: 'Inject',
    hi: 'लगवाएं (इंजेक्शन)',
    ur: 'انجیکشن لگوائیں',
    te: 'ఇంజెక్షన్ వేయించుకోండి',
    bn: 'ইনজেকশন নিন',
    mr: 'इंजेक्शन घ्या',
    ta: 'ஊசி போட்டுக்கொள்ளவும்',
  },
  use: {
    en: 'Use',
    hi: 'इस्तेमाल करें',
    ur: 'استعمال کریں',
    te: 'వాడండి',
    bn: 'ব্যবহার করুন',
    mr: 'वापरा',
    ta: 'பயன்படுத்தவும்',
  },
  thin_layer: {
    en: 'a thin layer',
    hi: 'पतली परत',
    ur: 'ہلکی تہہ',
    te: 'పలుచని పొర',
    bn: 'পাতলা স্তর',
    mr: 'पातळ थर',
    ta: 'மெல்லிய அடுக்கு',
  },
  tablet: {
    en: 'tablet',
    hi: 'गोली',
    ur: 'گولی',
    te: 'మాత్ర',
    bn: 'ট্যাবলেট',
    mr: 'गोळी',
    ta: 'மாத்திரை',
  },
  capsule: {
    en: 'capsule',
    hi: 'कैप्सूल',
    ur: 'کیپسول',
    te: 'క్యాప్సూల్',
    bn: 'ক্যাপসুল',
    mr: 'कॅप्सूल',
    ta: 'கேப்ஸ்யூல்',
  },
  syrup: {
    en: 'syrup',
    hi: 'सिरप',
    ur: 'شربت',
    te: 'సిరప్',
    bn: 'সিরাপ',
    mr: 'सिरप',
    ta: 'சிரப்',
  },
  injection: {
    en: 'injection',
    hi: 'इंजेक्शन',
    ur: 'انجیکشن',
    te: 'ఇంజెక్షన్',
    bn: 'ইনজেকশন',
    mr: 'इंजेक्शन',
    ta: 'ஊசி',
  },
  drops: {
    en: 'drops',
    hi: 'बूंदें',
    ur: 'قطرے',
    te: 'చుక్కలు',
    bn: 'ড্রপস',
    mr: 'थेंब',
    ta: 'சொட்டு மருந்து',
  },
  ointment: {
    en: 'ointment',
    hi: 'मलहम',
    ur: 'مرہم',
    te: 'లేపనం',
    bn: 'মলম',
    mr: 'मलम',
    ta: 'களிம்பு',
  },
  cream: {
    en: 'cream',
    hi: 'क्रीम',
    ur: 'کریم',
    te: 'క్రీమ్',
    bn: 'ক্রিম',
    mr: 'क्रीम',
    ta: 'கிரீம்',
  },
  lotion: {
    en: 'lotion',
    hi: 'लोशन',
    ur: 'لوشن',
    te: 'లోషన్',
    bn: 'লোশন',
    mr: 'लोशन',
    ta: 'லோஷன்',
  },
  gel: {
    en: 'gel',
    hi: 'जेल',
    ur: 'جیل',
    te: 'జెల్',
    bn: 'জেল',
    mr: 'जेल',
    ta: 'ஜெல்',
  },
  shampoo: {
    en: 'shampoo',
    hi: 'शैम्पू',
    ur: 'شیمپو',
    te: 'షాంపూ',
    bn: 'শ্যাম্পু',
    mr: 'शॅम्पू',
    ta: 'ஷாம்பூ',
  },
  spray: {
    en: 'spray',
    hi: 'स्प्रे',
    ur: 'اسپرے',
    te: 'స్ప్రే',
    bn: 'স্প্রে',
    mr: 'स्प्रे',
    ta: 'ஸ்ப்ரே',
  },
  solution: {
    en: 'solution',
    hi: 'घोल',
    ur: 'محلول',
    te: 'ద్రావణం',
    bn: 'সলিউশন',
    mr: 'द्रव',
    ta: 'கரைசல்',
  },
  patch: {
    en: 'patch',
    hi: 'पैच',
    ur: 'پیچ',
    te: 'ప్యాచ్',
    bn: 'প্যাচ',
    mr: 'पॅच',
    ta: 'பேட்ச்',
  },
  puff: {
    en: 'puff',
    hi: 'पफ',
    ur: 'پف',
    te: 'పఫ్',
    bn: 'পাফ',
    mr: 'पफ',
    ta: 'பஃப்',
  },
  sachet: {
    en: 'sachet',
    hi: 'पाउच',
    ur: 'ساشے',
    te: 'సాచెట్',
    bn: 'স্যাশে',
    mr: 'सॅशे',
    ta: 'சாஷே',
  },
  lozenge: {
    en: 'lozenge',
    hi: 'चूसने की गोली',
    ur: 'چوسنے والی گولی',
    te: 'చప్పరించే మాత్ర',
    bn: 'লজেন্স',
    mr: 'चघळण्याची गोळी',
    ta: 'சப்பும் மாத்திரை',
  },
  suppository: {
    en: 'suppository',
    hi: 'सपोज़िटरी',
    ur: 'سپوزیٹری',
    te: 'సపోజిటరీ',
    bn: 'সাপোজিটরি',
    mr: 'सपोझिटरी',
    ta: 'சப்போசிட்டரி',
  },
  dose: {
    en: 'dose',
    hi: 'खुराक',
    ur: 'خوراک',
    te: 'మోతాదు',
    bn: 'ডোজ',
    mr: 'डोस',
    ta: 'அளவு',
  },
  ml: {
    en: 'ml',
    hi: 'मि.ली. (ml)',
    ur: 'ملی لیٹر (ml)',
    te: 'మి.లీ. (ml)',
    bn: 'মি.লি. (ml)',
    mr: 'मि.ली. (ml)',
    ta: 'மி.லி. (ml)',
  },
  mg: {
    en: 'mg',
    hi: 'मि.ग्रा. (mg)',
    ur: 'ملی گرام (mg)',
    te: 'మి.గ్రా. (mg)',
    bn: 'মি.গ্রা. (mg)',
    mr: 'मि.ग्रॅ. (mg)',
    ta: 'மி.கி. (mg)',
  },
  morning: {
    en: 'morning',
    hi: 'सुबह',
    ur: 'صبح',
    te: 'ఉదయం',
    bn: 'সকাল',
    mr: 'सकाळी',
    ta: 'காலை',
  },
  afternoon: {
    en: 'afternoon',
    hi: 'दोपहर',
    ur: 'دوپہر',
    te: 'మధ్యాహ్నం',
    bn: 'দুপুর',
    mr: 'दुपारी',
    ta: 'மதியம்',
  },
  evening: {
    en: 'evening',
    hi: 'शाम',
    ur: 'شام',
    te: 'సాయంత్రం',
    bn: 'বিকেল',
    mr: 'संध्याकाळी',
    ta: 'மாலை',
  },
  night: {
    en: 'night',
    hi: 'रात',
    ur: 'رات',
    te: 'రాత్రి',
    bn: 'রাতে',
    mr: 'रात्री',
    ta: 'இரவு',
  },
  bedtime: {
    en: 'at bedtime',
    hi: 'सोने से पहले',
    ur: 'سوتے وقت',
    te: 'పడుకునే ముందు',
    bn: 'ঘুমানোর আগে',
    mr: 'झोपण्यापूर्वी',
    ta: 'படுக்கும் முன்',
  },
  before_food: {
    en: 'before food',
    hi: 'खाने से पहले',
    ur: 'کھانے سے پہلے',
    te: 'భోజనానికి ముందు',
    bn: 'খাওয়ার আগে',
    mr: 'जेवणापूर्वी',
    ta: 'உணவுக்கு முன்',
  },
  after_food: {
    en: 'after food',
    hi: 'खाने के बाद',
    ur: 'کھانے کے بعد',
    te: 'భోజనం తర్వాత',
    bn: 'খাওয়ার পরে',
    mr: 'जेवणानंतर',
    ta: 'உணவுக்குப் பின்',
  },
  with_food: {
    en: 'with food',
    hi: 'खाने के साथ',
    ur: 'کھانے کے ساتھ',
    te: 'భోజనంతో పాటు',
    bn: 'খাবারের সাথে',
    mr: 'जेवणासोबत',
    ta: 'உணவுடன்',
  },
  empty_stomach: {
    en: 'on an empty stomach',
    hi: 'खाली पेट',
    ur: 'خالی پیٹ',
    te: 'ఖాళీ కడుపుతో',
    bn: 'খালি পেটে',
    mr: 'उपाशी पोटी',
    ta: 'வெறும் வயிற்றில்',
  },
  once_a_day: {
    en: 'once a day',
    hi: 'दिन में 1 बार',
    ur: 'دن میں 1 بار',
    te: 'రోజుకు 1 సారి',
    bn: 'দিনে 1 বার',
    mr: 'दिवसातून 1 वेळा',
    ta: 'ஒரு நாளைக்கு 1 முறை',
  },
  twice_a_day: {
    en: 'morning and night',
    hi: 'सुबह और रात',
    ur: 'صبح اور رات',
    te: 'ఉదయం మరియు రాత్రి',
    bn: 'সকাল ও রাতে',
    mr: 'सकाळी आणि रात्री',
    ta: 'காலை மற்றும் இரவு',
  },
  three_times_a_day: {
    en: 'morning, afternoon, and night',
    hi: 'सुबह, दोपहर और रात',
    ur: 'صبح، دوپہر اور رات',
    te: 'ఉదయం, మధ్యాహ్నం మరియు రాత్రి',
    bn: 'সকাল, দুপুর ও রাতে',
    mr: 'सकाळी, दुपारी आणि रात्री',
    ta: 'காலை, மதியம் மற்றும் இரவு',
  },
  four_times_a_day: {
    en: '4 times a day',
    hi: 'दिन में 4 बार',
    ur: 'دن میں 4 بار',
    te: 'రోజుకు 4 సార్లు',
    bn: 'দিনে 4 বার',
    mr: 'दिवसातून 4 वेळा',
    ta: 'ஒரு நாளைக்கு 4 முறை',
  },
  as_needed: {
    en: 'only when needed',
    hi: 'ज़रूरत पड़ने पर ही',
    ur: 'صرف ضرورت پڑنے پر',
    te: 'అవసరమైనప్పుడు మాత్రమే',
    bn: 'শুধুমাত্র প্রয়োজনে',
    mr: 'फक्त गरज असल्यास',
    ta: 'தேவைப்படும்போது மட்டும்',
  },
  until_doctor_says: {
    en: 'until the doctor says',
    hi: 'डॉक्टर के कहने तक',
    ur: 'ڈاکٹر کے کہنے تک',
    te: 'డాక్టర్ చెప్పే వరకు',
    bn: 'ডাক্তার না বলা পর্যন্ত',
    mr: 'डॉक्टर सांगेपर्यंत',
    ta: 'மருத்துவர் சொல்லும் வரை',
  },
  visit_your_doctor: {
    en: 'visit your doctor',
    hi: 'अपने डॉक्टर से मिलें',
    ur: 'اپنے ڈاکٹر سے ملیں',
    te: 'మీ డాక్టర్‌ను కలవండి',
    bn: 'আপনার ডাক্তারের সাথে দেখা করুন',
    mr: 'तुमच्या डॉक्टरांना भेटा',
    ta: 'உங்கள் மருத்துவரைச் சந்திக்கவும்',
  },
  stat_once_now: {
    en: 'one time, right away',
    hi: 'एक बार, तुरंत',
    ur: 'ایک بار، فوراً',
    te: 'ఒకసారి, వెంటనే',
    bn: 'একবার, এখনই',
    mr: 'एकदाच, लगेच',
    ta: 'ஒருமுறை, உடனடியாக',
  },
};

// Number words 0 to 10 where natural in descriptive contexts (doses/counts always retain Latin digits 0-9)
export const NUMBER_WORDS_0_TO_10: Record<SupportedLangCode, string[]> = {
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
  hi: ['शून्य', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ', 'दस'],
  ur: ['صفر', 'ایک', 'دو', 'تین', 'چار', 'پانچ', 'چھ', 'سات', 'آٹھ', 'نو', 'دس'],
  te: ['సున్నా', 'ఒకటి', 'రెండు', 'మూడు', 'నాలుగు', 'ఐదు', 'ఆరు', 'ఏడు', 'ఎనిమిది', 'తొమ్మిది', 'పది'],
  bn: ['শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ'],
  mr: ['शून्य', 'एक', 'दोन', 'तीन', 'चार', 'पाच', 'सहा', 'सात', 'आठ', 'नऊ', 'दहा'],
  ta: ['பூஜ்ஜியம்', 'ஒன்று', 'இரண்டு', 'மூன்று', 'நான்கு', 'ஐந்து', 'ஆறு', 'ஏழு', 'எட்டு', 'ஒன்பது', 'பத்து'],
};

export function formatEveryNHours(n: number, lang: SupportedLangCode): string {
  switch (lang) {
    case 'hi':
      return `हर ${n} घंटे में`;
    case 'ur':
      return `ہر ${n} گھنٹے بعد`;
    case 'te':
      return `ప్రతి ${n} గంటలకు ఒకసారి`;
    case 'bn':
      return `প্রতি ${n} ঘণ্টা পর`;
    case 'mr':
      return `दर ${n} तासांनी`;
    case 'ta':
      return `ஒவ்வொரு ${n} மணி நேரத்திற்கும்`;
    case 'en':
    default:
      return `every ${n} hours`;
  }
}

export function formatForNDays(n: number, lang: SupportedLangCode): string {
  switch (lang) {
    case 'hi':
      return `${n} दिन तक`;
    case 'ur':
      return `${n} دن تک`;
    case 'te':
      return `${n} రోజులు`;
    case 'bn':
      return `${n} দিন`;
    case 'mr':
      return `${n} दिवस`;
    case 'ta':
      return `${n} நாட்கள்`;
    case 'en':
    default:
      return `for ${n} day${n === 1 ? '' : 's'}`;
  }
}

export function formatForNWeeks(n: number, lang: SupportedLangCode): string {
  switch (lang) {
    case 'hi':
      return `${n} सप्ताह तक`;
    case 'ur':
      return `${n} ہفتے تک`;
    case 'te':
      return `${n} వారాలు`;
    case 'bn':
      return `${n} সপ্তাহ`;
    case 'mr':
      return `${n} आठवडे`;
    case 'ta':
      return `${n} வாரங்கள்`;
    case 'en':
    default:
      return `for ${n} week${n === 1 ? '' : 's'}`;
  }
}

export function formatReviewAfterNDays(n: number, lang: SupportedLangCode): string {
  switch (lang) {
    case 'hi':
      return `${n} दिन बाद डॉक्टर को दिखाएं (${GLOSSARY_TERMS.visit_your_doctor.hi})`;
    case 'ur':
      return `${n} دن بعد ڈاکٹر کو دکھائیں (${GLOSSARY_TERMS.visit_your_doctor.ur})`;
    case 'te':
      return `${n} రోజుల తర్వాత డాక్టర్‌ను కలవండి`;
    case 'bn':
      return `${n} দিন পর আপনার ডাক্তারের সাথে দেখা করুন`;
    case 'mr':
      return `${n} दिवसांनी डॉक्टरांना भेटा`;
    case 'ta':
      return `${n} நாட்களுக்குப் பிறகு மருத்துவரைச் சந்திக்கவும்`;
    case 'en':
    default:
      return `Review after ${n} day${n === 1 ? '' : 's'} (${GLOSSARY_TERMS.visit_your_doctor.en})`;
  }
}

// Localized UI labels for Prescription View, Medicine Card, and Footer
export interface PrescriptionUiLabels {
  headerTitle: string;
  viewInLabel: string;
  translating: string;
  summaryTitle: string;
  medicinesCount: (n: number) => string;
  patientProfile: string;
  visitDate: string;
  doctorLabel: string;
  clinicLabel: string;
  notesLabel: string;
  followUpLabel: string;
  medicationsSectionTitle: string;
  listen: string;
  stop: string;
  shareText: string;
  sharePdf: string;
  showOriginalEnglish: string;
  hideOriginalEnglish: string;
  doctorInstructionsLabel: string;
  offlineNotePending: string;
  offlineBanner: string;
  checkTranslationWarning: string;
  onlineErrorTitle: string;
  retry: string;
  disclaimer: string;
  originalEnglishHeading: string;
  editLabel: string;
  savedWrongFormPrompt: string;
}

export const PRESCRIPTION_UI_LABELS: Record<SupportedLangCode, PrescriptionUiLabels> = {
  en: {
    headerTitle: 'Prescription',
    viewInLabel: 'View prescription in:',
    translating: 'Translating...',
    summaryTitle: 'Prescription Details',
    medicinesCount: (n) => `${n} Medicine${n === 1 ? '' : 's'}`,
    patientProfile: 'Patient',
    visitDate: 'Date',
    doctorLabel: 'Doctor',
    clinicLabel: 'Clinic',
    notesLabel: "Doctor's Notes",
    followUpLabel: 'Follow-up Advice',
    medicationsSectionTitle: 'Your Medicines',
    listen: 'Listen',
    stop: 'Stop',
    shareText: 'Share Text',
    sharePdf: 'Share PDF',
    showOriginalEnglish: 'Show original English',
    hideOriginalEnglish: 'Hide original English',
    doctorInstructionsLabel: 'Special Instructions',
    offlineNotePending: 'Translation will finish when you are online',
    offlineBanner: 'Offline mode: showing built-in translation. Free-text notes will finish translating when you are online.',
    checkTranslationWarning: 'Please check this translation',
    onlineErrorTitle: 'Could not translate free-text instructions',
    retry: 'Retry',
    disclaimer: 'PillSync is an assistant, not a doctor. Always confirm with your doctor or pharmacist.',
    originalEnglishHeading: 'Original English:',
    editLabel: 'Edit',
    savedWrongFormPrompt: 'Is this a lotion? Please check the form.',
  },
  hi: {
    headerTitle: 'दवा का पर्चा',
    viewInLabel: 'पर्चा किस भाषा में देखें:',
    translating: 'अनुवाद हो रहा है...',
    summaryTitle: 'पर्चे का विवरण',
    medicinesCount: (n) => `${n} दवा${n === 1 ? '' : 'इयाँ'}`,
    patientProfile: 'मरीज़',
    visitDate: 'तारीख',
    doctorLabel: 'डॉक्टर',
    clinicLabel: 'क्लिनिक / अस्पताल',
    notesLabel: 'डॉक्टर के नोट्स',
    followUpLabel: 'दोबारा दिखाने की सलाह',
    medicationsSectionTitle: 'आपकी दवाइयाँ',
    listen: 'सुनें',
    stop: 'रोकें',
    shareText: 'टेक्स्ट शेयर करें',
    sharePdf: 'PDF शेयर करें',
    showOriginalEnglish: 'मूल अंग्रेज़ी देखें',
    hideOriginalEnglish: 'अंग्रेज़ी छिपाएं',
    doctorInstructionsLabel: 'विशेष निर्देश',
    offlineNotePending: 'ऑनलाइन होने पर पूरा अनुवाद हो जाएगा',
    offlineBanner: 'ऑफ़लाइन मोड: बिल्ट-इन अनुवाद दिख रहा है। ऑनलाइन होने पर बाकी नोट्स का अनुवाद पूरा होगा।',
    checkTranslationWarning: 'कृपया इस अनुवाद की जाँच करें',
    onlineErrorTitle: 'निर्देशों का अनुवाद नहीं हो सका',
    retry: 'पुनः प्रयास करें',
    disclaimer: 'PillSync केवल एक सहायक है, डॉक्टर नहीं। हमेशा अपने डॉक्टर या फार्मासिस्ट से पुष्टि करें।',
    originalEnglishHeading: 'मूल अंग्रेज़ी विवरण:',
    editLabel: 'संपादित करें',
    savedWrongFormPrompt: 'क्या यह लोशन है? कृपया दवा का रूप जाँचें।',
  },
  ur: {
    headerTitle: 'نسخہ',
    viewInLabel: 'نسخہ کس زبان میں دیکھیں:',
    translating: 'ترجمہ ہو رہا ہے...',
    summaryTitle: 'نسخے کی تفصیل',
    medicinesCount: (n) => `${n} دوا${n === 1 ? '' : 'ئیاں'}`,
    patientProfile: 'مریض',
    visitDate: 'تاریخ',
    doctorLabel: 'ڈاکٹر',
    clinicLabel: 'کلینک / ہسپتال',
    notesLabel: 'ڈاکٹر کی ہدایات',
    followUpLabel: 'دوبارہ معائنے کا مشورہ',
    medicationsSectionTitle: 'آپ کی ادویات',
    listen: 'سنیں',
    stop: 'روکیں',
    shareText: 'شیئر کریں',
    sharePdf: 'PDF شیئر کریں',
    showOriginalEnglish: 'اصل انگریزی دیکھیں',
    hideOriginalEnglish: 'انگریزی چھپائیں',
    doctorInstructionsLabel: 'خصوصی ہدایات',
    offlineNotePending: 'آن لائن ہونے پر ترجمہ مکمل ہو جائے گا',
    offlineBanner: 'آف لائن موڈ: فوری لغت سے ترجمہ دکھایا جا رہا ہے۔ آن لائن ہونے پر باقی ترجمہ مکمل ہو گا۔',
    checkTranslationWarning: 'براہ کرم اس ترجمے کو چیک کریں',
    onlineErrorTitle: 'ہدایات کا ترجمہ نہیں ہو سکا',
    retry: 'دوبارہ کوشش کریں',
    disclaimer: 'PillSync ایک مددگار ہے، ڈاکٹر نہیں۔ ہمیشہ اپنے ڈاکٹر یا فارماسسٹ سے تصدیق کریں۔',
    originalEnglishHeading: 'اصل انگریزی:',
    editLabel: 'ترمیم',
    savedWrongFormPrompt: 'کیا یہ لوشن ہے؟ براہ کرم دوا کی قسم چیک کریں۔',
  },
  te: {
    headerTitle: 'మందుల చీటీ',
    viewInLabel: 'ప్రిస్క్రిప్షన్ భాషను ఎంచుకోండి:',
    translating: 'అనువదిస్తోంది...',
    summaryTitle: 'ప్రిస్క్రిప్షన్ వివరాలు',
    medicinesCount: (n) => `${n} మందు${n === 1 ? '' : 'లు'}`,
    patientProfile: 'రోగి',
    visitDate: 'తేదీ',
    doctorLabel: 'డాక్టర్',
    clinicLabel: 'క్లినిక్ / ఆసుపత్రి',
    notesLabel: 'డాక్టర్ గమనికలు',
    followUpLabel: 'తదుపరి సలహా',
    medicationsSectionTitle: 'మీ మందులు',
    listen: 'వినండి',
    stop: 'ఆపండి',
    shareText: 'షేర్ చేయండి',
    sharePdf: 'PDF షేర్',
    showOriginalEnglish: 'అసలు ఇంగ్లీష్ చూడండి',
    hideOriginalEnglish: 'ఇంగ్లీష్ దాచండి',
    doctorInstructionsLabel: 'ప్రత్యేక సూచనలు',
    offlineNotePending: 'ఆన్‌లైన్‌లోకి వచ్చినప్పుడు అనువాదం పూర్తవుతుంది',
    offlineBanner: 'ఆఫ్‌లైన్ మోడ్: గ్లాసరీ అనువాదం చూపబడుతోంది. ఆన్‌లైన్ అయినప్పుడు పూర్తి అనువాదం పూర్తవుతుంది.',
    checkTranslationWarning: 'దయచేసి ఈ అనువాదాన్ని తనిఖీ చేయండి',
    onlineErrorTitle: 'సూచనలను అనువదించలేకపోయాము',
    retry: 'మళ్లీ ప్రయత్నించండి',
    disclaimer: 'PillSync ఒక సహాయకుడు మాత్రమే, డాక్టర్ కాదు. ఎల్లప్పుడూ మీ డాక్టర్ లేదా ఫార్మసిస్ట్‌తో నిర్ధారించుకోండి.',
    originalEnglishHeading: 'అసలు ఇంగ్లీష్:',
    editLabel: 'మార్చండి',
    savedWrongFormPrompt: 'ఇది లోషనా? దయచేసి మందు రూపాన్ని తనిఖీ చేయండి.',
  },
  bn: {
    headerTitle: 'প্রেসক্রিপশন',
    viewInLabel: 'প্রেসক্রিপশন দেখার ভাষা:',
    translating: 'অনুবাদ হচ্ছে...',
    summaryTitle: 'প্রেসক্রিপশনের বিবরণ',
    medicinesCount: (n) => `${n} টি ওষুধ`,
    patientProfile: 'রোগী',
    visitDate: 'তারিখ',
    doctorLabel: 'ডাক্তার',
    clinicLabel: 'ক্লিনিক / হাসপাতাল',
    notesLabel: 'ডাক্তারের নোট',
    followUpLabel: 'পরবর্তী পরামর্শ',
    medicationsSectionTitle: 'আপনার ওষুধসমূহ',
    listen: 'শুনুন',
    stop: 'থামান',
    shareText: 'শেয়ার করুন',
    sharePdf: 'PDF শেয়ার',
    showOriginalEnglish: 'আসল ইংরেজি দেখুন',
    hideOriginalEnglish: 'ইংরেজি লুকান',
    doctorInstructionsLabel: 'বিশেষ নির্দেশাবলী',
    offlineNotePending: 'অনলাইনে এলে অনুবাদ সম্পূর্ণ হবে',
    offlineBanner: 'অফলাইন মোড: গ্লসারি অনুবাদ দেখানো হচ্ছে। অনলাইন হলে বাকি অনুবাদ সম্পূর্ণ হবে।',
    checkTranslationWarning: 'অনুগ্রহ করে এই অনুবাদটি যাচাই করুন',
    onlineErrorTitle: 'নির্দেশাবলী অনুবাদ করা যায়নি',
    retry: 'আবার চেষ্টা করুন',
    disclaimer: 'PillSync শুধুমাত্র একটি সহায়ক, ডাক্তার নয়। সর্বদা আপনার ডাক্তার বা ফার্মাসিস্টের সাথে নিশ্চিত করুন।',
    originalEnglishHeading: 'আসল ইংরেজি:',
    editLabel: 'সম্পাদনা',
    savedWrongFormPrompt: 'এটি কি লোশন? অনুগ্রহ করে ওষুধের ধরন যাচাই করুন।',
  },
  mr: {
    headerTitle: 'प्रिस्क्रिप्शन',
    viewInLabel: 'प्रिस्क्रिप्शन कोणत्या भाषेत पहावे:',
    translating: 'भाषांतर होत आहे...',
    summaryTitle: 'प्रिस्क्रिप्शन तपशील',
    medicinesCount: (n) => `${n} औषध${n === 1 ? '' : 'े'}`,
    patientProfile: 'रुग्ण',
    visitDate: 'तारीख',
    doctorLabel: 'डॉक्टर',
    clinicLabel: 'क्लिनिक / रुग्णालय',
    notesLabel: 'डॉक्टरांच्या सूचना',
    followUpLabel: 'पुढील तपासणी सल्ला',
    medicationsSectionTitle: 'तुमची औषधे',
    listen: 'ऐका',
    stop: 'थांबवा',
    shareText: 'शेअर करा',
    sharePdf: 'PDF शेअर',
    showOriginalEnglish: 'मूळ इंग्रजी पहा',
    hideOriginalEnglish: 'इंग्रजी लपवा',
    doctorInstructionsLabel: 'विशेष सूचना',
    offlineNotePending: 'ऑनलाइन आल्यावर भाषांतर पूर्ण होईल',
    offlineBanner: 'ऑफलाइन मोड: त्वरित शब्दकोश भाषांतर दिसत आहे. ऑनलाइन आल्यावर उर्वरित भाषांतर पूर्ण होईल.',
    checkTranslationWarning: 'कृपया हे भाषांतर तपासा',
    onlineErrorTitle: 'सूचनांचे भाषांतर होऊ शकले नाही',
    retry: 'पुन्हा प्रयत्न करा',
    disclaimer: 'PillSync हा केवळ मदतनीस आहे, डॉक्टर नाही. नेहमी तुमच्या डॉक्टर किंवा फार्मासिस्टशी खात्री करा.',
    originalEnglishHeading: 'मूळ इंग्रजी:',
    editLabel: 'बदला',
    savedWrongFormPrompt: 'हे लोशन आहे का? कृपया औषधाचा प्रकार तपासा.',
  },
  ta: {
    headerTitle: 'மருந்துச்சீட்டு',
    viewInLabel: 'மருந்துச்சீட்டைப் பார்க்கும் மொழி:',
    translating: 'மொழிபெயர்க்கிறது...',
    summaryTitle: 'மருந்துச்சீட்டு விவரம்',
    medicinesCount: (n) => `${n} மருந்து${n === 1 ? '' : 'கள்'}`,
    patientProfile: 'நோயாளி',
    visitDate: 'தேதி',
    doctorLabel: 'மருத்துவர்',
    clinicLabel: 'மருத்துவமனை',
    notesLabel: 'மருத்துவரின் குறிப்புகள்',
    followUpLabel: 'மறுபரிசோதனை ஆலோசனை',
    medicationsSectionTitle: 'உங்கள் மருந்துகள்',
    listen: 'கேட்கவும்',
    stop: 'நிறுத்து',
    shareText: 'பகிரவும்',
    sharePdf: 'PDF பகிர்',
    showOriginalEnglish: 'அசல் ஆங்கிலத்தைக் காட்டு',
    hideOriginalEnglish: 'ஆங்கிலத்தை மறை',
    doctorInstructionsLabel: 'சிறப்பு வழிமுறைகள்',
    offlineNotePending: 'ஆன்லைனில் வரும்போது மொழிபெயர்ப்பு நிறைவடையும்',
    offlineBanner: 'ஆஃப்லைன் நிலை: அடிப்படை மொழிபெயர்ப்பு காட்டப்படுகிறது. ஆன்லைன் வந்ததும் முழு மொழிபெயர்ப்பு முடியும்.',
    checkTranslationWarning: 'தயவுசெய்து இந்த மொழிபெயர்ப்பைச் சரிபார்க்கவும்',
    onlineErrorTitle: 'வழிமுறைகளை மொழிபெயர்க்க முடியவில்லை',
    retry: 'மீண்டும் முயலவும்',
    disclaimer: 'PillSync ஒரு உதவியாளர் மட்டுமே, மருத்துவர் அல்ல. எப்போதும் உங்கள் மருத்துவர் அல்லது மருந்தாளரிடம் உறுதிப்படுத்தவும்.',
    originalEnglishHeading: 'அசல் ஆங்கிலம்:',
    editLabel: 'திருத்து',
    savedWrongFormPrompt: 'இது லோஷனா? தயவுசெய்து மருந்தின் வகையைச் சரிபார்க்கவும்.',
  },
};

export function toSupportedLang(code?: string): SupportedLangCode {
  if (code && ['en', 'hi', 'ur', 'te', 'bn', 'mr', 'ta'].includes(code)) {
    return code as SupportedLangCode;
  }
  return 'en';
}

/**
 * Resolves a medicine's form into the localized unit/form noun.
 * NEVER defaults to "tablet" for non-oral or empty forms.
 */
function resolveFormWord(formRaw: string | undefined, lang: SupportedLangCode): string {
  const formId = normalizeFormId(formRaw);
  if (formId) {
    const def = getMedicineFormDef(formId)!;
    switch (def.defaultUnit) {
      case 'capsule':
        return GLOSSARY_TERMS.capsule[lang];
      case 'tablet':
        return GLOSSARY_TERMS.tablet[lang];
      case 'ml':
        return GLOSSARY_TERMS.syrup[lang];
      case 'drop':
        return GLOSSARY_TERMS.drops[lang];
      case 'puff':
        return GLOSSARY_TERMS.puff[lang];
      case 'sachet':
        return GLOSSARY_TERMS.sachet[lang];
      case 'lozenge':
        return GLOSSARY_TERMS.lozenge[lang];
      case 'patch':
        return GLOSSARY_TERMS.patch[lang];
      case 'injection':
        return GLOSSARY_TERMS.injection[lang];
      case 'suppository':
        return GLOSSARY_TERMS.suppository[lang];
      case 'application':
        return GLOSSARY_TERMS[formId]?.[lang] || def.label[lang];
      case 'dose':
      default:
        return GLOSSARY_TERMS.dose[lang];
    }
  }

  const f = (formRaw || '').toLowerCase().trim();
  if (!f) return GLOSSARY_TERMS.dose[lang];
  if (f.includes('cap')) return GLOSSARY_TERMS.capsule[lang];
  if (f.includes('tab')) return GLOSSARY_TERMS.tablet[lang];
  if (f.includes('syr') || f.includes('susp')) return GLOSSARY_TERMS.syrup[lang];
  if (f.includes('inj')) return GLOSSARY_TERMS.injection[lang];
  if (f.includes('drop')) return GLOSSARY_TERMS.drops[lang];
  if (f.includes('lot')) return GLOSSARY_TERMS.lotion[lang];
  if (f.includes('cream')) return GLOSSARY_TERMS.cream[lang];
  if (f.includes('oint')) return GLOSSARY_TERMS.ointment[lang];
  if (f.includes('gel')) return GLOSSARY_TERMS.gel[lang];
  if (f.includes('shamp')) return GLOSSARY_TERMS.shampoo[lang];
  if (f.includes('spray')) return GLOSSARY_TERMS.spray[lang];
  if (f.includes('sol')) return GLOSSARY_TERMS.solution[lang];
  if (f.includes('patch')) return GLOSSARY_TERMS.patch[lang];
  if (f.includes('inhal')) return GLOSSARY_TERMS.puff[lang];
  if (f.includes('powder') || f.includes('sachet')) return GLOSSARY_TERMS.sachet[lang];
  return GLOSSARY_TERMS.dose[lang];
}

function resolveActionVerbPhrase(formRaw: string | undefined, lang: SupportedLangCode): string {
  const def = getMedicineFormDef(formRaw);
  if (!def) {
    if ((formRaw || '').toLowerCase().includes('drop')) {
      return GLOSSARY_TERMS.use[lang];
    }
    return GLOSSARY_TERMS.take[lang];
  }

  switch (def.verb) {
    case 'Apply':
      return GLOSSARY_TERMS.apply[lang];
    case 'Put in the eye':
      return GLOSSARY_TERMS.put_in_eye[lang];
    case 'Put in the ear':
      return GLOSSARY_TERMS.put_in_ear[lang];
    case 'Put in the nose':
      return GLOSSARY_TERMS.put_in_nose[lang];
    case 'Inhale':
      return GLOSSARY_TERMS.inhale[lang];
    case 'Inject':
      return GLOSSARY_TERMS.inject[lang];
    case 'Use':
      return GLOSSARY_TERMS.use[lang];
    case 'Take':
    default:
      return GLOSSARY_TERMS.take[lang];
  }
}

function formatLocalizedAreaPhrase(areaRaw: string | undefined, lang: SupportedLangCode): string {
  if (!areaRaw) return '';
  const areaLabel = resolveApplicationAreaLabel(areaRaw, lang);
  if (!areaLabel) return '';

  switch (lang) {
    case 'en':
      return /^on\b/i.test(areaLabel) ? areaLabel : `on the ${areaLabel}`;
    case 'hi':
      return `${areaLabel} पर`;
    case 'ur':
      return `${areaLabel} پر`;
    case 'te':
      return `${areaLabel} పై`;
    case 'bn':
      return areaLabel.endsWith('এ') || areaLabel.endsWith('তে') ? areaLabel : `${areaLabel}-এ`;
    case 'mr':
      return `${areaLabel} वर`;
    case 'ta':
      return `${areaLabel} மீது`;
    default:
      return `on the ${areaLabel}`;
  }
}

/**
 * Extracts dose phrase keeping Latin digits 0-9 (never Indic digits).
 * Never emits "1 tablet" for topical forms or unselected forms.
 */
function resolveDoseAndForm(medicine: Partial<StoredMedicine>, lang: SupportedLangCode): string {
  const formId = normalizeFormId(medicine.form);
  const formWord = resolveFormWord(medicine.form, lang);
  const rawDose = (medicine.dose || '').trim();
  const isTopical = formId ? isTopicalForm(formId) : false;

  // Topical forms (lotion, cream, ointment, gel, shampoo, spray, solution) use "a thin layer" by default
  if (isTopical && formId !== 'patch') {
    if (!rawDose || /^apply\s+(a\s+)?thin\s+layer$/i.test(rawDose) || /^thin\s+layer$/i.test(rawDose)) {
      return GLOSSARY_TERMS.thin_layer[lang];
    }
    const stripped = rawDose.replace(/^apply\s+/i, '').trim();
    return stripped || GLOSSARY_TERMS.thin_layer[lang];
  }

  if (!rawDose) {
    return medicine.form ? `1 ${formWord}` : GLOSSARY_TERMS.dose[lang];
  }

  const mlMatch = rawDose.match(/(\d+(?:\.\d+)?)\s*ml\b/i);
  if (mlMatch) {
    const mlWord = lang === 'en' ? 'ml' : GLOSSARY_TERMS.ml[lang];
    return medicine.form && (medicine.form.toLowerCase().includes('syrup') || formId === 'syrup')
      ? `${mlMatch[1]} ${mlWord} ${formWord}`
      : `${mlMatch[1]} ${mlWord}`;
  }

  const mgMatch = rawDose.match(/(\d+(?:\.\d+)?)\s*mg\b/i);
  if (mgMatch) {
    const mgWord = lang === 'en' ? 'mg' : GLOSSARY_TERMS.mg[lang];
    return `${mgMatch[1]} ${mgWord}`;
  }

  const numMatch = rawDose.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) {
    return `${numMatch[1]} ${formWord}`;
  }

  return rawDose;
}

/**
 * Resolves frequency phrase from normalized handwriting codes, doseSchedule, or special codes.
 */
function resolveFrequencyPhrase(medicine: Partial<StoredMedicine>, lang: SupportedLangCode): string {
  const norm = normalizeHandwritingFrequency(
    medicine.frequency,
    medicine.doseSchedule,
    !!medicine.asNeeded
  );

  if (norm.specialCode === 'sos') {
    return GLOSSARY_TERMS.as_needed[lang];
  }
  if (norm.specialCode === 'stat') {
    return GLOSSARY_TERMS.stat_once_now[lang];
  }
  if (norm.everyHours) {
    return formatEveryNHours(norm.everyHours, lang);
  }

  const { morning: m, afternoon: a, night: n, bedtime: b } = norm.schedule;
  const activeCount = [m, a, n, b].filter((v) => v > 0).length;

  if (m === 1 && a === 0 && n === 1 && b === 0) {
    return GLOSSARY_TERMS.twice_a_day[lang];
  }
  if (m === 1 && a === 1 && n === 1 && b === 0) {
    return GLOSSARY_TERMS.three_times_a_day[lang];
  }
  if (m === 1 && a === 1 && n === 1 && b === 1) {
    return GLOSSARY_TERMS.four_times_a_day[lang];
  }
  if (m === 1 && a === 0 && n === 0 && b === 0) {
    return `${GLOSSARY_TERMS.once_a_day[lang]} (${GLOSSARY_TERMS.morning[lang]})`;
  }
  if (m === 0 && a === 1 && n === 0 && b === 0) {
    return `${GLOSSARY_TERMS.once_a_day[lang]} (${GLOSSARY_TERMS.afternoon[lang]})`;
  }
  if (m === 0 && a === 0 && n === 1 && b === 0) {
    return `${GLOSSARY_TERMS.once_a_day[lang]} (${GLOSSARY_TERMS.night[lang]})`;
  }
  if (m === 0 && a === 0 && n === 0 && b === 1) {
    return GLOSSARY_TERMS.bedtime[lang];
  }

  if (activeCount > 0) {
    const slotParts: string[] = [];
    if (m > 0) slotParts.push(`${m} ${GLOSSARY_TERMS.morning[lang]}`);
    if (a > 0) slotParts.push(`${a} ${GLOSSARY_TERMS.afternoon[lang]}`);
    if (n > 0) slotParts.push(`${n} ${GLOSSARY_TERMS.night[lang]}`);
    if (b > 0) slotParts.push(`${b} ${GLOSSARY_TERMS.bedtime[lang]}`);
    return slotParts.join(lang === 'ur' ? '، ' : ', ');
  }

  return '';
}

function resolveTimingPhrase(
  timingRaw: string | undefined,
  lang: SupportedLangCode,
  formRaw?: string
): string {
  // Food timing NEVER applies to non-oral forms (topical, drops, inhalers, injections)
  if (formRaw && !isFoodTimingApplicable(formRaw)) {
    return '';
  }
  const t = (timingRaw || '').toLowerCase().trim();
  if (!t || t === 'unspecified' || t === 'anytime' || t === 'not_food_related') return '';
  if (t.includes('empty')) return GLOSSARY_TERMS.empty_stomach[lang];
  if (t.includes('before')) return GLOSSARY_TERMS.before_food[lang];
  if (t.includes('after')) return GLOSSARY_TERMS.after_food[lang];
  if (t.includes('with')) return GLOSSARY_TERMS.with_food[lang];
  if (t.includes('bed')) return GLOSSARY_TERMS.bedtime[lang];
  return '';
}

function resolveDurationPhrase(medicine: Partial<StoredMedicine>, lang: SupportedLangCode): string {
  const durText = (medicine.durationText || '').toLowerCase().trim();
  if (durText.includes('continue') || durText.includes('ongoing') || durText.includes('until')) {
    return GLOSSARY_TERMS.until_doctor_says[lang];
  }
  const weeksMatch = durText.match(/(\d+)\s*week/i);
  if (weeksMatch) {
    return formatForNWeeks(parseInt(weeksMatch[1], 10), lang);
  }
  if (medicine.durationDays && medicine.durationDays > 0) {
    return formatForNDays(medicine.durationDays, lang);
  }
  return '';
}

/**
 * Layer 1: Builds one natural, grammatically ordered sentence per language strictly from structured fields.
 * Shares the exact same plain-language, form-aware sentence across Review, Today, Reminders, and Translations.
 */
export function buildMedicineSentenceFromTemplate(
  medicine: Partial<StoredMedicine>,
  langCode: string
): string {
  const lang = toSupportedLang(langCode);
  const formId = normalizeFormId(medicine.form);
  const def = formId ? getMedicineFormDef(formId) : null;
  const isTopical = formId ? isTopicalForm(formId) : false;
  const isDrops = isDropsForm(medicine.form);
  const doseAndForm = resolveDoseAndForm(medicine, lang);
  const freqPhrase = resolveFrequencyPhrase(medicine, lang);
  const timingPhrase = resolveTimingPhrase(medicine.timing, lang, medicine.form);
  const durationPhrase = resolveDurationPhrase(medicine, lang);
  const actionVerb = resolveActionVerbPhrase(medicine.form, lang);
  const areaPhrase =
    isTopical && medicine.applicationArea
      ? formatLocalizedAreaPhrase(medicine.applicationArea, lang)
      : '';

  if (lang === 'en') {
    const norm = normalizeHandwritingFrequency(
      medicine.frequency,
      medicine.doseSchedule,
      !!medicine.asNeeded
    );
    const freqEn = buildEnglishFrequencySentence(norm, medicine.form, medicine.dose);
    const freqLower =
      freqEn && freqEn !== 'No times selected'
        ? `${freqEn.charAt(0).toLowerCase()}${freqEn.slice(1)}`
        : '';
    const { morning: m, afternoon: a, night: n, bedtime: b } = norm.schedule;
    const hasVaryingCounts = [m, a, n, b].some((v) => v > 0 && v !== 1);

    // 1. Topical form sentence:
    // e.g. "Apply a thin layer on the affected area twice a day for 5 days."
    if (isTopical) {
      const lead = areaPhrase ? `Apply ${doseAndForm} ${areaPhrase}` : `Apply ${doseAndForm}`;
      const flowParts = [lead, freqLower, durationPhrase].filter(Boolean);
      return `${flowParts.join(' ')}.`;
    }

    // 2. Drops form sentence:
    // e.g. "Put 2 drops in the eye twice a day for 5 days."
    if (isDrops) {
      const siteClause =
        formId === 'eye_drops'
          ? 'in the eye'
          : formId === 'ear_drops'
          ? 'in the ear'
          : formId === 'nasal_drops'
          ? 'in the nose'
          : '';
      const lead = siteClause ? `Put ${doseAndForm} ${siteClause}` : `Use ${doseAndForm}`;
      const flowParts = [lead, freqLower, durationPhrase].filter(Boolean);
      return `${flowParts.join(' ')}.`;
    }

    // 3. Inhaler / Injection / Oral / Other
    const verbWord = def ? def.verb : 'Take';
    const timingAvoidDup =
      timingPhrase === GLOSSARY_TERMS.bedtime.en && freqEn.toLowerCase().includes('bedtime')
        ? ''
        : timingPhrase;

    if (hasVaryingCounts) {
      const parts = [`${verbWord} ${freqEn}`, timingAvoidDup, durationPhrase].filter(Boolean);
      return `${parts.join(', ')}.`;
    }

    const head = freqLower ? `${verbWord} ${doseAndForm}, ${freqLower}` : `${verbWord} ${doseAndForm}`;
    const parts = [head, timingAvoidDup, durationPhrase].filter(Boolean);
    return `${parts.join(', ')}.`;
  }

  // Indic & Urdu SOV order:
  // [Area Phrase] [Dose & Form] [Frequency], [Food Timing (if oral)], [Duration] [Action-Verb]
  const headParts = isTopical
    ? [areaPhrase, doseAndForm, freqPhrase].filter(Boolean)
    : [doseAndForm, freqPhrase].filter(Boolean);
  const head = headParts.join(' ');
  const clauses = [head, timingPhrase, durationPhrase].filter(Boolean);
  const body = lang === 'ur' ? clauses.join('، ') : clauses.join(', ');
  const endPunctuation = lang === 'hi' || lang === 'bn' ? '।' : lang === 'ur' ? '۔' : '.';
  return `${body} ${actionVerb}${endPunctuation}`.replace(/\s+/g, ' ').trim();
}

// NEEDS NATIVE-SPEAKER REVIEW
// Builds localized reminder alert sentence: e.g. "Time to apply Calamine on the affected area."
export function buildFormAwareReminderAlertText(
  medicineName: string,
  formRaw: string | undefined,
  applicationArea: string | undefined,
  langCode: string
): string {
  const lang = toSupportedLang(langCode);
  const formId = normalizeFormId(formRaw);
  const isTopical = formId ? isTopicalForm(formId) : false;

  if (isTopical) {
    const areaEn = applicationArea
      ? resolveApplicationAreaLabel(applicationArea, 'en')
      : 'affected area';
    const areaLoc = applicationArea
      ? resolveApplicationAreaLabel(applicationArea, lang)
      : GLOSSARY_TERMS.apply[lang];

    switch (lang) {
      case 'hi':
        return `${medicineName} (${applicationArea ? `${areaLoc} पर` : ''}) लगाने का समय हो गया है।`.replace(' ()', '');
      case 'ur':
        return `${medicineName} (${applicationArea ? `${areaLoc} پر` : ''}) لگانے کا وقت ہو گیا ہے۔`.replace(' ()', '');
      case 'te':
        return `${medicineName} (${applicationArea ? `${areaLoc} పై` : ''}) రాసే సమయం అయింది.`.replace(' ()', '');
      case 'bn':
        return `${medicineName} (${applicationArea ? areaLoc : ''}) লাগানোর সময় হয়েছে।`.replace(' ()', '');
      case 'mr':
        return `${medicineName} (${applicationArea ? `${areaLoc} वर` : ''}) लावण्याची वेळ झाली आहे.`.replace(' ()', '');
      case 'ta':
        return `${medicineName} (${applicationArea ? `${areaLoc} மீது` : ''}) தடவும் நேரம் வந்துவிட்டது.`.replace(' ()', '');
      case 'en':
      default:
        return `Time to apply ${medicineName} on ${areaEn}.`;
    }
  }

  const verb = resolveActionVerbPhrase(formRaw, lang);
  if (lang === 'en') {
    return `${verb} ${medicineName}`;
  }
  return `${medicineName} — ${verb}`;
}

// Common Indian/international drug names + phonetic syllable mapper for instant offline transliteration
const COMMON_BRAND_TRANSLITERATIONS: Record<string, Record<SupportedLangCode, string>> = {
  paracetamol: {
    en: 'Paracetamol',
    hi: 'पैरासिटामोल',
    ur: 'پیراسیٹامول',
    te: 'పారాసెటమాల్',
    bn: 'প্যারাসিটামল',
    mr: 'पॅरासिटामॉल',
    ta: 'பாராசிட்டமால்',
  },
  dolo: {
    en: 'Dolo',
    hi: 'डोलो',
    ur: 'ڈولو',
    te: 'డోలో',
    bn: 'ডোলো',
    mr: 'डोलो',
    ta: 'டோலோ',
  },
  crocin: {
    en: 'Crocin',
    hi: 'क्रोसिन',
    ur: 'کروسن',
    te: 'క్రోసిన్',
    bn: 'ক্রোসিন',
    mr: 'क्रोसिन',
    ta: 'குரோசின்',
  },
  augmentin: {
    en: 'Augmentin',
    hi: 'ऑगमेंटिन',
    ur: 'آگمینٹن',
    te: 'ఆగ్మెంటిన్',
    bn: 'অগমেন্টিন',
    mr: 'ऑगमेंटिन',
    ta: 'ஆக்மென்டின்',
  },
  amoxicillin: {
    en: 'Amoxicillin',
    hi: 'अमोक्सिसिलिन',
    ur: 'اموکسیسلن',
    te: 'అమోక్సిసిలిన్',
    bn: 'অ্যামোক্সিসিলিন',
    mr: 'अमोक्सिसिलिन',
    ta: 'அமாக்சிசிலின்',
  },
  azithromycin: {
    en: 'Azithromycin',
    hi: 'एज़िथ्रोमाइसिन',
    ur: 'ایزتھرومائسن',
    te: 'అజిత్రోమైసిన్',
    bn: 'অ্যাজিথ্রোমাইসিন',
    mr: 'अझिथ्रोमायसिन',
    ta: 'அசித்ரோமைசின்',
  },
  pantocid: {
    en: 'Pantocid',
    hi: 'पैंटोसिड',
    ur: 'پینٹوسڈ',
    te: 'పాంటోసిడ్',
    bn: 'প্যান্টোসিড',
    mr: 'पँटोसिड',
    ta: 'பாண்டோசிட்',
  },
  pan: {
    en: 'Pan',
    hi: 'पैन',
    ur: 'پین',
    te: 'పాన్',
    bn: 'প্যান',
    mr: 'पॅन',
    ta: 'பான்',
  },
  metformin: {
    en: 'Metformin',
    hi: 'मेटफॉर्मिन',
    ur: 'میٹفارمن',
    te: 'మెట్‌ఫార్మిన్',
    bn: 'মেটফর্মিন',
    mr: 'मेटफॉर्मिन',
    ta: 'மெட்ஃபார்மின்',
  },
  cetirizine: {
    en: 'Cetirizine',
    hi: 'सेटिरिज़ीन',
    ur: 'سیٹیریزین',
    te: 'సెటిరిజిన్',
    bn: 'সেটিরিজিন',
    mr: 'सेटिरिझिन',
    ta: 'செடிரிசின்',
  },
  ibuprofen: {
    en: 'Ibuprofen',
    hi: 'इबुप्रोफेन',
    ur: 'آئیبوپروفین',
    te: 'ఇబుప్రోఫెన్',
    bn: 'আইবুপ্রোফেন',
    mr: 'इबुप्रोफेन',
    ta: 'இப்யூபுரூஃபன்',
  },
};

/**
 * Provides an instant offline transliteration for common drug names and preserves numbers/strengths
 * (e.g. "Paracetamol 500 mg" -> "पैरासिटामोल 500 mg"). Layer 2 Gemini API refines/replaces this
 * for any arbitrary brand name when online.
 */
export function getOfflineTransliteratedName(name: string, langCode: string): string {
  const lang = toSupportedLang(langCode);
  if (lang === 'en' || !name) return name;

  const words = name.trim().split(/\s+/);
  const mapped = words.map((word) => {
    const clean = word.toLowerCase().replace(/[^a-z]/g, '');
    if (clean && COMMON_BRAND_TRANSLITERATIONS[clean]) {
      return COMMON_BRAND_TRANSLITERATIONS[clean][lang];
    }
    return word;
  });

  return mapped.join(' ');
}

// Localized Progress Screen Strings (All 7 Languages)
export interface ProgressUiStrings {
  readingTitle: string;
  translatingTitle: (langNativeName: string) => string;
  readingSteps: [string, string, string, string, string];
  translationSteps: [string, string, string];
  slowWorkingSubtitle: string;
  retryingSubtitle: (attempt: number, max: number) => string;
  completedSubtitle: string;
  failedSubtitle: string;
  tips: [string, string, string, string];
  cancel: string;
  retry: string;
  enterManually: string;
  saveAndReadLater: string;
  offlineSavedTitle: string;
  offlineSavedDesc: string;
  backToHome: string;
}

export const PROGRESS_UI_STRINGS: Record<SupportedLangCode, ProgressUiStrings> = {
  en: {
    readingTitle: 'Reading your prescription...',
    translatingTitle: (langName) => `Translating into ${langName}...`,
    readingSteps: [
      'Preparing your image',
      'Sending securely',
      'Reading the handwriting',
      'Finding medicines, doses, and timings',
      'Checking for unclear items',
    ],
    translationSteps: ['Preparing', 'Translating', 'Checking numbers'],
    slowWorkingSubtitle: 'Still working, handwriting can take a little longer',
    retryingSubtitle: (attempt, max) => `The AI service is busy, retrying (${attempt} of ${max})...`,
    completedSubtitle: 'Ready for your review',
    failedSubtitle: 'We could not finish reading this photo right now.',
    tips: [
      'Always confirm each medicine on the next screen',
      'Unclear words will be flagged for you to check',
      'Your photo stays private to your account',
      'Good light and a flat page give the best results',
    ],
    cancel: 'Cancel',
    retry: 'Retry',
    enterManually: 'Enter manually',
    saveAndReadLater: 'Save and read later',
    offlineSavedTitle: 'Saved. Will be read when you are online',
    offlineSavedDesc:
      'Your prescription photo is safely encrypted on this device and queued to be read automatically when your internet reconnects.',
    backToHome: 'Done',
  },
  hi: {
    readingTitle: 'आपका पर्चा पढ़ा जा रहा है...',
    translatingTitle: (langName) => `${langName} में अनुवाद हो रहा है...`,
    readingSteps: [
      'आपकी फ़ोटो तैयार की जा रही है',
      'सुरक्षित रूप से भेजा जा रहा है',
      'लिखावट पढ़ी जा रही है',
      'दवाइयाँ, खुराक और समय खोजे जा रहे हैं',
      'अस्पष्ट शब्दों की जाँच हो रही है',
    ],
    translationSteps: ['तैयारी हो रही है', 'अनुवाद हो रहा है', 'संख्याओं की जाँच हो रही है'],
    slowWorkingSubtitle: 'अभी काम जारी है, लिखावट पढ़ने में थोड़ा अधिक समय लग सकता है',
    retryingSubtitle: (attempt, max) => `सेवा व्यस्त है, पुनः प्रयास (${attempt}/${max})...`,
    completedSubtitle: 'आपकी जाँच के लिए तैयार है',
    failedSubtitle: 'अभी इस फ़ोटो को पूरा पढ़ा नहीं जा सका।',
    tips: [
      'अगली स्क्रीन पर हमेशा हर दवा की पुष्टि करें',
      'अस्पष्ट शब्दों को आपके देखने के लिए चिह्नित किया जाएगा',
      'आपकी फ़ोटो केवल आपके खाते में निजी रहती है',
      'अच्छी रोशनी और सीधा पन्ना सबसे अच्छे परिणाम देते हैं',
    ],
    cancel: 'रद्द करें',
    retry: 'पुनः प्रयास करें',
    enterManually: 'स्वयं दर्ज करें',
    saveAndReadLater: 'सहेजें और बाद में पढ़ें',
    offlineSavedTitle: 'सहेजा गया। ऑनलाइन होने पर पढ़ा जाएगा',
    offlineSavedDesc:
      'आपके पर्चे की फ़ोटो इस डिवाइस पर सुरक्षित है और इंटरनेट जुड़ने पर अपने आप पढ़ ली जाएगी।',
    backToHome: 'ठीक है',
  },
  ur: {
    readingTitle: 'آپ کا نسخہ پڑھا جا رہا ہے...',
    translatingTitle: (langName) => `${langName} میں ترجمہ ہو رہا ہے...`,
    readingSteps: [
      'آپ کی تصویر تیار کی جا رہی ہے',
      'محفوظ طریقے سے بھیجا جا رہا ہے',
      'ہاتھ کی لکھائی پڑھی جا رہی ہے',
      'ادویات، خوراک اور اوقات تلاش کیے جا رہے ہیں',
      'غیر واضح الفاظ کی جانچ ہو رہی ہے',
    ],
    translationSteps: ['تیاری ہو رہی ہے', 'ترجمہ ہو رہا ہے', 'اعداد کی جانچ ہو رہی ہے'],
    slowWorkingSubtitle: 'ابھی کام جاری ہے، لکھائی پڑھنے میں تھوڑا وقت لگ سکتا ہے',
    retryingSubtitle: (attempt, max) => `سروس مصروف ہے، دوبارہ کوشش (${attempt} از ${max})...`,
    completedSubtitle: 'آپ کے جائزے کے لیے تیار ہے',
    failedSubtitle: 'اس وقت اس تصویر کو مکمل پڑھا نہیں جا سکا۔',
    tips: [
      'اگلی اسکرین پر ہمیشہ ہر دوا کی تصدیق کریں',
      'غیر واضح الفاظ کو آپ کے چیک کرنے کے لیے نشان زد کیا جائے گا',
      'آپ کی تصویر صرف آپ کے اکاؤنٹ تک نجی رہتی ہے',
      'اچھی روشنی اور سیدھا صفحہ بہترین نتائج دیتے ہیں',
    ],
    cancel: 'منسوخ کریں',
    retry: 'دوبارہ کوشش کریں',
    enterManually: 'خود درج کریں',
    saveAndReadLater: 'محفوظ کریں اور بعد میں پڑھیں',
    offlineSavedTitle: 'محفوظ ہو گیا۔ آن لائن ہونے پر پڑھا جائے گا',
    offlineSavedDesc:
      'آپ کے نسخے کی تصویر اس ڈیوائس پر محفوظ ہے اور انٹرنیٹ بحال ہونے پر خودکار طور پر پڑھ لی جائے گی۔',
    backToHome: 'مکمل',
  },
  te: {
    readingTitle: 'మీ ప్రిస్క్రిప్షన్ చదువుతోంది...',
    translatingTitle: (langName) => `${langName}లోకి అనువదిస్తోంది...`,
    readingSteps: [
      'మీ చిత్రాన్ని సిద్ధం చేస్తోంది',
      'సురక్షితంగా పంపుతోంది',
      'చేతివ్రాతను చదువుతోంది',
      'మందులు, మోతాదులు మరియు సమయాలను గుర్తిస్తోంది',
      'అస్పష్టమైన పదాలను తనిఖీ చేస్తోంది',
    ],
    translationSteps: ['సిద్ధం చేస్తోంది', 'అనువదిస్తోంది', 'సంఖ్యలను తనిఖీ చేస్తోంది'],
    slowWorkingSubtitle: 'ఇంకా పని జరుగుతోంది, చేతివ్రాతకు కొంచెం ఎక్కువ సమయం పట్టవచ్చు',
    retryingSubtitle: (attempt, max) => `సేవ బిజీగా ఉంది, మళ్లీ ప్రయత్నిస్తోంది (${attempt}/${max})...`,
    completedSubtitle: 'మీ పరిశీలనకు సిద్ధంగా ఉంది',
    failedSubtitle: 'ఈ ఫోటోను పూర్తిగా చదవలేకపోయాము.',
    tips: [
      'తదుపరి స్క్రీన్‌లో ఎల్లప్పుడూ ప్రతి మందును నిర్ధారించండి',
      'అస్పష్టమైన పదాలను మీరు తనిఖీ చేయడానికి గుర్తు చేస్తాము',
      'మీ ఫోటో మీ ఖాతాలో మాత్రమే సురక్షితంగా ఉంటుంది',
      'మంచి వెలుతురు మరియు చదునైన కాగితం ఉత్తమ ఫలితాలను ఇస్తాయి',
    ],
    cancel: 'రద్దు చేయండి',
    retry: 'మళ్లీ ప్రయత్నించండి',
    enterManually: 'స్వయంగా నమోదు చేయండి',
    saveAndReadLater: 'సేవ్ చేసి తర్వాత చదవండి',
    offlineSavedTitle: 'సేవ్ చేయబడింది. ఆన్‌లైన్‌లోకి వచ్చినప్పుడు చదవబడుతుంది',
    offlineSavedDesc:
      'మీ ప్రిస్క్రిప్షన్ ఫోటో ఈ పరికరంలో సురక్షితంగా సేవ్ చేయబడింది మరియు ఇంటర్నెట్ వచ్చినప్పుడు స్వయంచాలకంగా చదవబడుతుంది.',
    backToHome: 'పూర్తయింది',
  },
  bn: {
    readingTitle: 'আপনার প্রেসক্রিপশন পড়া হচ্ছে...',
    translatingTitle: (langName) => `${langName} ভাষায় অনুবাদ হচ্ছে...`,
    readingSteps: [
      'আপনার ছবি প্রস্তুত করা হচ্ছে',
      'নিরাপদে পাঠানো হচ্ছে',
      'হাতের লেখা পড়া হচ্ছে',
      'ওষুধ, মাত্রা ও সময় খোঁজা হচ্ছে',
      'অস্পষ্ট শব্দ যাচাই করা হচ্ছে',
    ],
    translationSteps: ['প্রস্তুত করা হচ্ছে', 'অনুবাদ হচ্ছে', 'সংখ্যা যাচাই করা হচ্ছে'],
    slowWorkingSubtitle: 'কাজ চলছে, হাতের লেখা পড়তে একটু বেশি সময় লাগতে পারে',
    retryingSubtitle: (attempt, max) => `সার্ভিস ব্যস্ত, আবার চেষ্টা চলছে (${attempt}/${max})...`,
    completedSubtitle: 'আপনার যাচাইয়ের জন্য প্রস্তুত',
    failedSubtitle: 'এই মুহূর্তে ছবিটি পুরোপুরি পড়া যায়নি।',
    tips: [
      'পরবর্তী স্ক্রিনে সর্বদা প্রতিটি ওষুধ নিশ্চিত করুন',
      'অস্পষ্ট শব্দগুলো আপনার দেখার জন্য চিহ্নিত থাকবে',
      'আপনার ছবি শুধু আপনার অ্যাকাউন্টেই গোপন থাকে',
      'ভালো আলো এবং সমতল পৃষ্ঠায় সবচেয়ে ভালো ফলাফল পাওয়া যায়',
    ],
    cancel: 'বাতিল করুন',
    retry: 'আবার চেষ্টা করুন',
    enterManually: 'নিজে লিখুন',
    saveAndReadLater: 'সংরক্ষণ করে পরে পড়ুন',
    offlineSavedTitle: 'সংরক্ষিত হয়েছে। অনলাইনে এলে পড়া হবে',
    offlineSavedDesc:
      'আপনার প্রেসক্রিপশনের ছবি এই ডিভাইসে সুরক্ষিত আছে এবং ইন্টারনেট ফিরলে স্বয়ংক্রিয়ভাবে পড়া হবে।',
    backToHome: 'ঠিক আছে',
  },
  mr: {
    readingTitle: 'तुमचे प्रिस्क्रिप्शन वाचले जात आहे...',
    translatingTitle: (langName) => `${langName} मध्ये भाषांतर होत आहे...`,
    readingSteps: [
      'तुमचा फोटो तयार करत आहे',
      'सुरक्षितपणे पाठवत आहे',
      'हस्ताक्षर वाचत आहे',
      'औषधे, प्रमाण आणि वेळा शोधत आहे',
      'अस्पष्ट मजकूर तपासत आहे',
    ],
    translationSteps: ['तयारी करत आहे', 'भाषांतर होत आहे', 'अंक तपासत आहे'],
    slowWorkingSubtitle: 'काम सुरू आहे, हस्ताक्षर वाचायला थोडा वेळ लागू शकतो',
    retryingSubtitle: (attempt, max) => `सेवा व्यस्त आहे, पुन्हा प्रयत्न (${attempt}/${max})...`,
    completedSubtitle: 'तुमच्या तपासणीसाठी तयार आहे',
    failedSubtitle: 'हा फोटो आत्ता पूर्ण वाचता आला नाही.',
    tips: [
      'पुढील स्क्रीनवर नेहमी प्रत्येक औषधाची खात्री करा',
      'अस्पष्ट शब्द तुमच्या तपासणीसाठी चिन्हांकित केले जातील',
      'तुमचा फोटो फक्त तुमच्या खात्यात खाजगी राहतो',
      'चांगला प्रकाश आणि सपाट पान यामुळे अचूक परिणाम मिळतात',
    ],
    cancel: 'रद्द करा',
    retry: 'पुन्हा प्रयत्न करा',
    enterManually: 'स्वतः प्रविष्ट करा',
    saveAndReadLater: 'जतन करा आणि नंतर वाचा',
    offlineSavedTitle: 'जतन केले. ऑनलाइन आल्यावर वाचले जाईल',
    offlineSavedDesc:
      'तुमचा प्रिस्क्रिप्शन फोटो या डिव्हाइसवर सुरक्षित आहे आणि इंटरनेट जोडल्यावर आपोआप वाचला जाईल.',
    backToHome: 'पूर्ण झाले',
  },
  ta: {
    readingTitle: 'உங்கள் மருந்துச்சீட்டைப் படிக்கிறது...',
    translatingTitle: (langName) => `${langName} மொழியில் மொழிபெயர்க்கிறது...`,
    readingSteps: [
      'உங்கள் படத்தைத் தயார் செய்கிறது',
      'பாதுகாப்பாக அனுப்புகிறது',
      'கையெழுத்தைப் படிக்கிறது',
      'மருந்துகள், அளவு மற்றும் நேரங்களைக் கண்டறிகிறது',
      'தெளிவற்ற சொற்களைச் சரிபார்க்கிறது',
    ],
    translationSteps: ['தயார் செய்கிறது', 'மொழிபெயர்க்கிறது', 'எண்களைச் சரிபார்க்கிறது'],
    slowWorkingSubtitle: 'இன்னும் செயல்படுகிறது, கையெழுத்துப் படிக்கச் சிறிது நேரம் ஆகலாம்',
    retryingSubtitle: (attempt, max) => `சேவை பிஸியாக உள்ளது, மீண்டும் முயற்சிக்கிறது (${attempt}/${max})...`,
    completedSubtitle: 'உங்கள் சரிபார்ப்புக்குத் தயார்',
    failedSubtitle: 'இப்போது இந்தப் படத்தை முழுமையாகப் படிக்க முடியவில்லை.',
    tips: [
      'அடுத்த திரையில் எப்போதும் ஒவ்வொரு மருந்தையும் உறுதிப்படுத்தவும்',
      'தெளிவற்ற சொற்கள் நீங்கள் சரிபார்க்கக் குறிக்கப்படும்',
      'உங்கள் புகைப்படம் உங்கள் கணக்கில் மட்டுமே தனிப்பட்டதாக இருக்கும்',
      'நல்ல வெளிச்சம் மற்றும் சமமான தாள் சிறந்த முடிவுகளைத் தரும்',
    ],
    cancel: 'ரத்து செய்',
    retry: 'மீண்டும் முயலவும்',
    enterManually: 'கைமுறையாக உள்ளிடவும்',
    saveAndReadLater: 'சேமித்து பிறகு படிக்கவும்',
    offlineSavedTitle: 'சேமிக்கப்பட்டது. ஆன்லைனில் வரும்போது படிக்கப்படும்',
    offlineSavedDesc:
      'உங்கள் மருந்துச்சீட்டுப் படம் இந்தச் சாதனத்தில் பாதுகாப்பாக உள்ளது. இணையம் இணைந்தவுடன் தானாகப் படிக்கப்படும்.',
    backToHome: 'முடிந்தது',
  },
};

export interface ReviewCardLabels {
  reviewTitle: string;
  reviewSubtitle: string;
  viewOriginalPhoto: string;
  zoomHint: string;
  cancel: string;
  medicinesExtracted: (n: number) => string;
  addMedicine: string;
  strength: string;
  dose: string;
  durationDays: string;
  notWritten: string;
  daysPlaceholder: string;
  frequencyLabel: string;
  morning: string;
  afternoon: string;
  night: string;
  bedtime: string;
  typeCustomPattern: string;
  applyPattern: string;
  customPatternPlaceholder: string;
  customPatternError: string;
  foodTimingLabel: string;
  beforeFood: string;
  afterFood: string;
  withFood: string;
  emptyStomach: string;
  bedtimeOpt: string;
  anytime: string;
  suggestedTag: string;
  aiSuggestedTag: string;
  suggestedBadge: string;
  usuallyNightConflict: string;
  usuallyMorningConflict: string;
  lowConfidence: (pct: number) => string;
  confidencePct: (pct: number) => string;
  removeMedicine: string;
  verifiedAgainstRx: string;
  checkAgainstRx: string;
  fillAllNames: string;
  flaggedRemaining: (n: number) => string;
  confirmAllBtn: string;
  footerDisclaimer: string;
  formLabel: string;
  selectFormPlaceholder: string;
  pleaseSelectForm: string;
  notRelatedToFood: string;
  whereToApply: string;
  dropsWhereLabel: string;
  applyThinLayerPlaceholder: string;
  selectFormsMissing: string;
}

export const REVIEW_CARD_LABELS: Record<SupportedLangCode, ReviewCardLabels> = {
  en: {
    reviewTitle: 'Review Transcribed Prescription',
    reviewSubtitle: 'Verify every medicine and dose against original handwriting',
    viewOriginalPhoto: 'View original',
    zoomHint: 'Pinch / Zoom to check handwriting',
    cancel: 'Cancel',
    medicinesExtracted: (n) => `${n} Medicine${n === 1 ? '' : 's'} Extracted`,
    addMedicine: 'Add Medicine',
    strength: 'Strength',
    dose: 'Dose',
    durationDays: 'Duration (Days)',
    notWritten: 'Not written',
    daysPlaceholder: 'Days',
    frequencyLabel: 'Frequency',
    morning: 'Morning',
    afternoon: 'Afternoon',
    night: 'Night',
    bedtime: 'Bedtime',
    typeCustomPattern: 'Type a custom pattern',
    applyPattern: 'Apply',
    customPatternPlaceholder: 'e.g. 1-0-1, BD, TDS, q8h, HS, SOS, stat',
    customPatternError: 'Could not understand that pattern. Try 1-0-1, 2-0-1, BD, TDS, QID, HS, q8h, SOS, or stat.',
    foodTimingLabel: 'Food Timing',
    beforeFood: 'Before food',
    afterFood: 'After food',
    withFood: 'With food',
    emptyStomach: 'Empty stomach',
    bedtimeOpt: 'Bedtime',
    anytime: 'Anytime',
    suggestedTag: 'Suggested for this medicine, not written on the prescription',
    aiSuggestedTag: 'AI suggestion, please verify',
    suggestedBadge: 'Suggested',
    usuallyNightConflict: 'This medicine is usually taken at night. Please check with your doctor or pharmacist.',
    usuallyMorningConflict: 'This medicine is usually taken in the morning on an empty stomach. Please check with your doctor or pharmacist.',
    lowConfidence: (pct) => `Low Confidence (${pct}%)`,
    confidencePct: (pct) => `${pct}% Confidence`,
    removeMedicine: 'Remove',
    verifiedAgainstRx: 'Verified against the original prescription',
    checkAgainstRx: 'I checked this against the original Rx',
    fillAllNames: 'Please fill in all medicine names before confirming',
    flaggedRemaining: (n) => `${n} item${n > 1 ? 's' : ''} need verification before confirming`,
    confirmAllBtn: 'Confirm All & Save Medicines',
    footerDisclaimer: 'AI can misread handwriting. Verify every medicine and dose against the original, or ask your pharmacist.',
    formLabel: 'Form',
    selectFormPlaceholder: 'Select form',
    pleaseSelectForm: 'Please select the form',
    notRelatedToFood: 'Not related to food',
    whereToApply: 'Where to apply',
    dropsWhereLabel: 'Where to use drops',
    applyThinLayerPlaceholder: 'Apply a thin layer',
    selectFormsMissing: 'Please select the medicine form for highlighted items before confirming',
  },
  hi: {
    reviewTitle: 'पर्चे की जाँच और पुष्टि करें',
    reviewSubtitle: 'मूल लिखावट से हर दवा और खुराक का मिलान करें',
    viewOriginalPhoto: 'मूल पर्चा देखें',
    zoomHint: 'लिखावट जाँचने के लिए ज़ूम करें',
    cancel: 'रद्द करें',
    medicinesExtracted: (n) => `${n} दवा${n === 1 ? '' : 'इयाँ'} मिलीं`,
    addMedicine: 'दवा जोड़ें',
    strength: 'ताक़त (mg/ml)',
    dose: 'खुराक',
    durationDays: 'अवधि (दिन)',
    notWritten: 'लिखा नहीं है',
    daysPlaceholder: 'दिन',
    frequencyLabel: 'कब और कितनी बार (समय)',
    morning: 'सुबह',
    afternoon: 'दोपहर',
    night: 'रात',
    bedtime: 'सोने से पहले',
    typeCustomPattern: 'कस्टम पैटर्न लिखें',
    applyPattern: 'लागू करें',
    customPatternPlaceholder: 'जैसे 1-0-1, BD, TDS, q8h, HS, SOS, stat',
    customPatternError: 'यह पैटर्न समझ नहीं आया। 1-0-1, BD, TDS, QID, HS, q8h, SOS या stat लिखें।',
    foodTimingLabel: 'भोजन के साथ समय',
    beforeFood: 'खाने से पहले',
    afterFood: 'खाने के बाद',
    withFood: 'खाने के साथ',
    emptyStomach: 'खाली पेट',
    bedtimeOpt: 'सोने से पहले',
    anytime: 'कभी भी',
    suggestedTag: 'इस दवा के लिए सुझाया गया, पर्चे पर नहीं लिखा था',
    aiSuggestedTag: 'AI सुझाव, कृपया पुष्टि करें',
    suggestedBadge: 'सुझाया गया',
    usuallyNightConflict: 'यह दवा आमतौर पर रात में ली जाती है। कृपया अपने डॉक्टर या फार्मासिस्ट से पूछें।',
    usuallyMorningConflict: 'यह दवा आमतौर पर सुबह खाली पेट ली जाती है। कृपया अपने डॉक्टर या फार्मासिस्ट से पूछें।',
    lowConfidence: (pct) => `कम भरोसा (${pct}%)`,
    confidencePct: (pct) => `${pct}% भरोसा`,
    removeMedicine: 'हटाएं',
    verifiedAgainstRx: 'मूल पर्चे से मिलान किया गया',
    checkAgainstRx: 'मैंने इसे मूल पर्चे से जाँच लिया है',
    fillAllNames: 'पुष्टि करने से पहले सभी दवाओं के नाम भरें',
    flaggedRemaining: (n) => `पुष्टि से पहले ${n} दवा${n > 1 ? 'ओं' : ''} की जाँच बाकी है`,
    confirmAllBtn: 'सभी की पुष्टि करें और सहेजें',
    footerDisclaimer: 'AI लिखावट पढ़ने में गलती कर सकता है। हर दवा की जाँच मूल पर्चे से करें या फार्मासिस्ट से पूछें।',
    formLabel: 'दवा का रूप (Form)',
    selectFormPlaceholder: 'रूप चुनें',
    pleaseSelectForm: 'कृपया दवा का रूप चुनें',
    notRelatedToFood: 'भोजन से संबंधित नहीं',
    whereToApply: 'कहाँ लगाना है',
    dropsWhereLabel: 'कहाँ डालना है',
    applyThinLayerPlaceholder: 'पतली परत लगाएं',
    selectFormsMissing: 'पुष्टि करने से पहले कृपया सभी दवाओं का रूप चुनें',
  },
  ur: {
    reviewTitle: 'نسخے کا جائزہ اور تصدیق کریں',
    reviewSubtitle: 'اصل لکھائی سے ہر دوا اور خوراک کی تصدیق کریں',
    viewOriginalPhoto: 'اصل نسخہ دیکھیں',
    zoomHint: 'لکھائی چیک کرنے کے لیے زوم کریں',
    cancel: 'منسوخ کریں',
    medicinesExtracted: (n) => `${n} دوا${n === 1 ? '' : 'ئیاں'} ملیں`,
    addMedicine: 'دوا شامل کریں',
    strength: 'طاقت (mg/ml)',
    dose: 'خوراک',
    durationDays: 'مدت (دن)',
    notWritten: 'نہیں لکھا گیا',
    daysPlaceholder: 'دن',
    frequencyLabel: 'دوا لینے کے اوقات',
    morning: 'صبح',
    afternoon: 'دوپہر',
    night: 'رات',
    bedtime: 'سوتے وقت',
    typeCustomPattern: 'کسٹم پیٹرن لکھیں',
    applyPattern: 'لاگو کریں',
    customPatternPlaceholder: 'مثلاً 1-0-1, BD, TDS, q8h, HS, SOS, stat',
    customPatternError: 'یہ پیٹرن سمجھ نہیں آیا۔ 1-0-1, BD, TDS, QID, HS, q8h, SOS یا stat درج کریں۔',
    foodTimingLabel: 'کھانے کا وقت',
    beforeFood: 'کھانے سے پہلے',
    afterFood: 'کھانے کے بعد',
    withFood: 'کھانے کے ساتھ',
    emptyStomach: 'خالی پیٹ',
    bedtimeOpt: 'سوتے وقت',
    anytime: 'کسی بھی وقت',
    suggestedTag: 'اس دوا کے لیے تجویز کردہ، نسخے پر نہیں لکھا تھا',
    aiSuggestedTag: 'AI تجویز، براہ کرم تصدیق کریں',
    suggestedBadge: 'تجویز کردہ',
    usuallyNightConflict: 'یہ دوا عام طور پر رات کو لی جاتی ہے۔ براہ کرم اپنے ڈاکٹر یا فارماسسٹ سے چیک کریں۔',
    usuallyMorningConflict: 'یہ دوا عام طور پر صبح خالی پیٹ لی جاتی ہے۔ براہ کرم اپنے ڈاکٹر یا فارماسسٹ سے چیک کریں۔',
    lowConfidence: (pct) => `کم اعتماد (${pct}%)`,
    confidencePct: (pct) => `${pct}% اعتماد`,
    removeMedicine: 'حذف کریں',
    verifiedAgainstRx: 'اصل نسخے سے تصدیق شدہ',
    checkAgainstRx: 'میں نے اسے اصل نسخے سے چیک کر لیا ہے',
    fillAllNames: 'تصدیق سے پہلے تمام ادویات کے نام درج کریں',
    flaggedRemaining: (n) => `تصدیق سے پہلے ${n} دوا کی جانچ باقی ہے`,
    confirmAllBtn: 'سب کی تصدیق اور محفوظ کریں',
    footerDisclaimer: 'AI لکھائی پڑھنے میں غلطی کر سکتا ہے۔ ہر دوا کی تصدیق اصل نسخے سے کریں یا فارماسسٹ سے پوچھیں۔',
    formLabel: 'دوا کی قسم (Form)',
    selectFormPlaceholder: 'قسم منتخب کریں',
    pleaseSelectForm: 'براہ کرم دوا کی قسم منتخب کریں',
    notRelatedToFood: 'کھانے سے متعلق نہیں',
    whereToApply: 'کہاں لگانا ہے',
    dropsWhereLabel: 'کہاں ڈالنا ہے',
    applyThinLayerPlaceholder: 'ہلکی تہہ لگائیں',
    selectFormsMissing: 'تصدیق سے پہلے براہ کرم تمام ادویات کی قسم منتخب کریں',
  },
  te: {
    reviewTitle: 'ప్రిస్క్రిప్షన్‌ను పరిశీలించి నిర్ధారించండి',
    reviewSubtitle: 'అసలు చేతివ్రాతతో ప్రతి మందు మరియు మోతాదును సరిచూడండి',
    viewOriginalPhoto: 'అసలు చిత్రం చూడండి',
    zoomHint: 'చేతివ్రాత చూడటానికి జూమ్ చేయండి',
    cancel: 'రద్దు చేయండి',
    medicinesExtracted: (n) => `${n} మందు${n === 1 ? '' : 'లు'} గుర్తించబడ్డాయి`,
    addMedicine: 'మందు జోడించండి',
    strength: 'శక్తి (mg/ml)',
    dose: 'మోతాదు',
    durationDays: 'వ్యవధి (రోజులు)',
    notWritten: 'రాయలేదు',
    daysPlaceholder: 'రోజులు',
    frequencyLabel: 'ఎప్పుడు తీసుకోవాలి',
    morning: 'ఉదయం',
    afternoon: 'మధ్యాహ్నం',
    night: 'రాత్రి',
    bedtime: 'పడుకునే ముందు',
    typeCustomPattern: 'కస్టమ్ ప్యాటర్న్ టైప్ చేయండి',
    applyPattern: 'వర్తింపజేయి',
    customPatternPlaceholder: 'ఉదా. 1-0-1, BD, TDS, q8h, HS, SOS, stat',
    customPatternError: 'ఈ ప్యాటర్న్ అర్థం కాలేదు. 1-0-1, BD, TDS, QID, HS, q8h, SOS లేదా stat ప్రయత్నించండి.',
    foodTimingLabel: 'ఆహార సమయం',
    beforeFood: 'భోజనానికి ముందు',
    afterFood: 'భోజనం తర్వాత',
    withFood: 'భోజనంతో పాటు',
    emptyStomach: 'ఖాళీ కడుపుతో',
    bedtimeOpt: 'పడుకునే ముందు',
    anytime: 'ఎప్పుడైనా',
    suggestedTag: 'ఈ మందు కోసం సూచించబడింది, చీటీలో రాయలేదు',
    aiSuggestedTag: 'AI సూచన, దయచేసి సరిచూడండి',
    suggestedBadge: 'సూచించబడింది',
    usuallyNightConflict: 'ఈ మందు సాధారణంగా రాత్రిపూట తీసుకుంటారు. దయచేసి మీ డాక్టర్ లేదా ఫార్మసిస్ట్‌ని అడగండి.',
    usuallyMorningConflict: 'ఈ మందు సాధారణంగా ఉదయం ఖాళీ కడుపుతో తీసుకుంటారు. దయచేసి మీ డాక్టర్ లేదా ఫార్మసిస్ట్‌ని అడగండి.',
    lowConfidence: (pct) => `తక్కువ నమ్మకం (${pct}%)`,
    confidencePct: (pct) => `${pct}% నమ్మకం`,
    removeMedicine: 'తొలగించు',
    verifiedAgainstRx: 'అసలు చీటీతో సరిచూడబడింది',
    checkAgainstRx: 'నేను దీనిని అసలు చీటీతో సరిచూశాను',
    fillAllNames: 'నిర్ధారించే ముందు అన్ని మందుల పేర్లను పూరించండి',
    flaggedRemaining: (n) => `నిర్ధారించే ముందు ${n} అంశం తనిఖీ చేయాల్సి ఉంది`,
    confirmAllBtn: 'అన్నీ నిర్ధారించి సేవ్ చేయండి',
    footerDisclaimer: 'AI చేతివ్రాతను తప్పుగా చదవవచ్చు. ఎల్లప్పుడూ అసలు చీటీతో సరిచూడండి లేదా ఫార్మసిస్ట్‌ను సంప్రదించండి.',
    formLabel: 'మందు రూపం (Form)',
    selectFormPlaceholder: 'రూపాన్ని ఎంచుకోండి',
    pleaseSelectForm: 'దయచేసి మందు రూపాన్ని ఎంచుకోండి',
    notRelatedToFood: 'ఆహారంతో సంబంధం లేదు',
    whereToApply: 'ఎక్కడ రాయాలి',
    dropsWhereLabel: 'ఎక్కడ వేసుకోవాలి',
    applyThinLayerPlaceholder: 'పలుచని పొర రాయండి',
    selectFormsMissing: 'నిర్ధారించే ముందు దయచేసి మందు రూపాన్ని ఎంచుకోండి',
  },
  bn: {
    reviewTitle: 'প্রেসক্রিপশন যাচাই ও নিশ্চিত করুন',
    reviewSubtitle: 'আসল হাতের লেখার সাথে প্রতিটি ওষুধ ও মাত্রা মিলিয়ে নিন',
    viewOriginalPhoto: 'আসল ছবি দেখুন',
    zoomHint: 'হাতের লেখা দেখতে জুম করুন',
    cancel: 'বাতিল করুন',
    medicinesExtracted: (n) => `${n} টি ওষুধ পাওয়া গেছে`,
    addMedicine: 'ওষুধ যোগ করুন',
    strength: 'মাত্রা (mg/ml)',
    dose: 'ডোজ',
    durationDays: 'সময়কাল (দিন)',
    notWritten: 'লেখা নেই',
    daysPlaceholder: 'দিন',
    frequencyLabel: 'কখন এবং কতবার',
    morning: 'সকাল',
    afternoon: 'দুপুর',
    night: 'রাত',
    bedtime: 'ঘুমানোর আগে',
    typeCustomPattern: 'কাস্টম প্যাটার্ন লিখুন',
    applyPattern: 'প্রয়োগ করুন',
    customPatternPlaceholder: 'যেমন 1-0-1, BD, TDS, q8h, HS, SOS, stat',
    customPatternError: 'প্যাটার্নটি বোঝা যায়নি। 1-0-1, BD, TDS, QID, HS, q8h, SOS বা stat লিখুন।',
    foodTimingLabel: 'খাওয়ার সময়',
    beforeFood: 'খাওয়ার আগে',
    afterFood: 'খাওয়ার পরে',
    withFood: 'খাবারের সাথে',
    emptyStomach: 'খালি পেটে',
    bedtimeOpt: 'ঘুমানোর আগে',
    anytime: 'যেকোনো সময়',
    suggestedTag: 'এই ওষুধের জন্য প্রস্তাবিত, প্রেসক্রিপশনে লেখা ছিল না',
    aiSuggestedTag: 'AI পরামর্শ, অনুগ্রহ করে যাচাই করুন',
    suggestedBadge: 'প্রস্তাবিত',
    usuallyNightConflict: 'এই ওষুধটি সাধারণত রাতে খাওয়া হয়। অনুগ্রহ করে আপনার ডাক্তার বা ফার্মাসিস্টের সাথে যাচাই করুন।',
    usuallyMorningConflict: 'এই ওষুধটি সাধারণত সকালে খালি পেটে খাওয়া হয়। অনুগ্রহ করে আপনার ডাক্তার বা ফার্মাসিস্টের সাথে যাচাই করুন।',
    lowConfidence: (pct) => `কম নির্ভরযোগ্যতা (${pct}%)`,
    confidencePct: (pct) => `${pct}% নির্ভরযোগ্যতা`,
    removeMedicine: 'মুছুন',
    verifiedAgainstRx: 'আসল প্রেসক্রিপশনের সাথে মিলিয়ে দেখা হয়েছে',
    checkAgainstRx: 'আমি আসল প্রেসক্রিপশনের সাথে এটি যাচাই করেছি',
    fillAllNames: 'নিশ্চিত করার আগে সব ওষুধের নাম লিখুন',
    flaggedRemaining: (n) => `নিশ্চিত করার আগে ${n} টি আইটেম যাচাই করা বাকি আছে`,
    confirmAllBtn: 'সব নিশ্চিত ও সংরক্ষণ করুন',
    footerDisclaimer: 'AI হাতের লেখা পড়তে ভুল করতে পারে। আসল প্রেসক্রিপশনের সাথে মিলিয়ে নিন বা ফার্মাসিস্টকে জিজ্ঞাসা করুন।',
    formLabel: 'ওষুধের ধরন (Form)',
    selectFormPlaceholder: 'ধরন নির্বাচন করুন',
    pleaseSelectForm: 'অনুগ্রহ করে ওষুধের ধরন নির্বাচন করুন',
    notRelatedToFood: 'খাবারের সাথে সম্পর্কিত নয়',
    whereToApply: 'কোথায় লাগাতে হবে',
    dropsWhereLabel: 'কোথায় দিতে হবে',
    applyThinLayerPlaceholder: 'পাতলা স্তর লাগান',
    selectFormsMissing: 'নিশ্চিত করার আগে অনুগ্রহ করে ওষুধের ধরন নির্বাচন করুন',
  },
  mr: {
    reviewTitle: 'प्रिस्क्रिप्शन तपासा आणि खात्री करा',
    reviewSubtitle: 'मूळ हस्ताक्षराशी प्रत्येक औषध आणि डोस तपासा',
    viewOriginalPhoto: 'मूळ प्रत पहा',
    zoomHint: 'हस्ताक्षर तपासण्यासाठी झूम करा',
    cancel: 'रद्द करा',
    medicinesExtracted: (n) => `${n} औषध${n === 1 ? '' : 'े'} आढळली`,
    addMedicine: 'औषध जोडा',
    strength: 'क्षमता (mg/ml)',
    dose: 'प्रमाण',
    durationDays: 'कालावधी (दिवस)',
    notWritten: 'लिहिलेले नाही',
    daysPlaceholder: 'दिवस',
    frequencyLabel: 'केव्हा आणि किती वेळा',
    morning: 'सकाळी',
    afternoon: 'दुपारी',
    night: 'रात्री',
    bedtime: 'झोपण्यापूर्वी',
    typeCustomPattern: 'कस्टम पॅटर्न टाइप करा',
    applyPattern: 'लागू करा',
    customPatternPlaceholder: 'उदा. 1-0-1, BD, TDS, q8h, HS, SOS, stat',
    customPatternError: 'हा पॅटर्न समजला नाही. 1-0-1, BD, TDS, QID, HS, q8h, SOS किंवा stat वापरा.',
    foodTimingLabel: 'जेवणाची वेळ',
    beforeFood: 'जेवणापूर्वी',
    afterFood: 'जेवणानंतर',
    withFood: 'जेवणासोबत',
    emptyStomach: 'उपाशी पोटी',
    bedtimeOpt: 'झोपण्यापूर्वी',
    anytime: 'कधीही',
    suggestedTag: 'या औषधासाठी सुचवलेले, प्रिस्क्रिप्शनवर लिहिलेले नव्हते',
    aiSuggestedTag: 'AI सूचना, कृपया खात्री करा',
    suggestedBadge: 'सुचवलेले',
    usuallyNightConflict: 'हे औषध सहसा रात्री घेतले जाते. कृपया तुमच्या डॉक्टर किंवा फार्मासिस्टशी खात्री करा.',
    usuallyMorningConflict: 'हे औषध सहसा सकाळी उपाशी पोटी घेतले जाते. कृपया तुमच्या डॉक्टर किंवा फार्मासिस्टशी खात्री करा.',
    lowConfidence: (pct) => `कमी खात्री (${pct}%)`,
    confidencePct: (pct) => `${pct}% खात्री`,
    removeMedicine: 'काढा',
    verifiedAgainstRx: 'मूळ प्रिस्क्रिप्शनशी तपासले',
    checkAgainstRx: 'मी हे मूळ प्रिस्क्रिप्शनशी तपासले आहे',
    fillAllNames: 'पुष्टी करण्यापूर्वी सर्व औषधांची नावे भरा',
    flaggedRemaining: (n) => `पुष्टी करण्यापूर्वी ${n} बाबींची तपासणी बाकी आहे`,
    confirmAllBtn: 'सर्व खात्री करा आणि जतन करा',
    footerDisclaimer: 'AI हस्ताक्षर वाचताना चूक करू शकते. प्रत्येक औषध मूळ प्रतीशी तपासा किंवा फार्मासिस्टला विचारा.',
    formLabel: 'औषधाचा प्रकार (Form)',
    selectFormPlaceholder: 'प्रकार निवडा',
    pleaseSelectForm: 'कृपया औषधाचा प्रकार निवडा',
    notRelatedToFood: 'जेवणाशी संबंधित नाही',
    whereToApply: 'कुठे लावायचे',
    dropsWhereLabel: 'कुठे टाकायचे',
    applyThinLayerPlaceholder: 'पातळ थर लावा',
    selectFormsMissing: 'पुष्टी करण्यापूर्वी कृपया सर्व औषधांचा प्रकार निवडा',
  },
  ta: {
    reviewTitle: 'மருந்துச்சீட்டைச் சரிபார்த்து உறுதிசெய்யவும்',
    reviewSubtitle: 'அசல் கையெழுத்துடன் ஒவ்வொரு மருந்தையும் அளவையும் சரிபார்க்கவும்',
    viewOriginalPhoto: 'அசல் படம் காண்க',
    zoomHint: 'கையெழுத்தைக் காண பெரிதாக்கவும்',
    cancel: 'ரத்து செய்',
    medicinesExtracted: (n) => `${n} மருந்து${n === 1 ? '' : 'கள்'} கண்டறியப்பட்டன`,
    addMedicine: 'மருந்து சேர்',
    strength: 'திறன் (mg/ml)',
    dose: 'அளவு',
    durationDays: 'நாட்கள்',
    notWritten: 'எழுதப்படவில்லை',
    daysPlaceholder: 'நாட்கள்',
    frequencyLabel: 'எப்போது எடுத்துக்கொள்ள வேண்டும்',
    morning: 'காலை',
    afternoon: 'மதியம்',
    night: 'இரவு',
    bedtime: 'படுக்கும் முன்',
    typeCustomPattern: 'தனிப்பயன் முறையை உள்ளிடவும்',
    applyPattern: 'பயன்படுத்து',
    customPatternPlaceholder: 'எ.கா. 1-0-1, BD, TDS, q8h, HS, SOS, stat',
    customPatternError: 'இந்த முறை புரியவில்லை. 1-0-1, BD, TDS, QID, HS, q8h, SOS அல்லது stat முயற்சிக்கவும்.',
    foodTimingLabel: 'உணவு நேரம்',
    beforeFood: 'உணவுக்கு முன்',
    afterFood: 'உணவுக்குப் பின்',
    withFood: 'உணவுடன்',
    emptyStomach: 'வெறும் வயிற்றில்',
    bedtimeOpt: 'படுக்கும் முன்',
    anytime: 'எப்போது வேண்டுமானாலும்',
    suggestedTag: 'இந்த மருந்துக்குப் பரிந்துரைக்கப்பட்டது, சீட்டில் எழுதப்படவில்லை',
    aiSuggestedTag: 'AI பரிந்துரை, தயவுசெய்து சரிபார்க்கவும்',
    suggestedBadge: 'பரிந்துரைக்கப்பட்டது',
    usuallyNightConflict: 'இந்த மருந்து பொதுவாக இரவில் எடுத்துக்கொள்ளப்படும். தயவுசெய்து உங்கள் மருத்துவர் அல்லது மருந்தாளரிடம் சரிபார்க்கவும்.',
    usuallyMorningConflict: 'இந்த மருந்து பொதுவாகக் காலையில் வெறும் வயிற்றில் எடுத்துக்கொள்ளப்படும். தயவுசெய்து உங்கள் மருத்துவர் அல்லது மருந்தாளரிடம் சரிபார்க்கவும்.',
    lowConfidence: (pct) => `குறைந்த நம்பிக்கை (${pct}%)`,
    confidencePct: (pct) => `${pct}% நம்பிக்கை`,
    removeMedicine: 'நீக்கு',
    verifiedAgainstRx: 'அசல் மருந்துச்சீட்டுடன் சரிபார்க்கப்பட்டது',
    checkAgainstRx: 'அசல் சீட்டுடன் இதைச் சரிபார்த்துவிட்டேன்',
    fillAllNames: 'உறுதிசெய்யும் முன் அனைத்து மருந்துப் பெயர்களையும் உள்ளிடவும்',
    flaggedRemaining: (n) => `உறுதிசெய்யும் முன் ${n} உருப்படியைச் சரிபார்க்க வேண்டும்`,
    confirmAllBtn: 'அனைத்தையும் உறுதிசெய்து சேமி',
    footerDisclaimer: 'AI கையெழுத்தைத் தவறாகப் படிக்கக்கூடும். அசல் சீட்டுடன் சரிபார்க்கவும் அல்லது மருந்தாளரிடம் கேட்கவும்.',
    formLabel: 'மருந்து வகை (Form)',
    selectFormPlaceholder: 'வகையைத் தேர்ந்தெடுக்கவும்',
    pleaseSelectForm: 'தயவுசெய்து மருந்தின் வகையைத் தேர்ந்தெடுக்கவும்',
    notRelatedToFood: 'உணவுடன் தொடர்புடையதல்ல',
    whereToApply: 'எங்கே தடவ வேண்டும்',
    dropsWhereLabel: 'எங்கே போட வேண்டும்',
    applyThinLayerPlaceholder: 'மெல்லிய அடுக்கு தடவவும்',
    selectFormsMissing: 'உறுதிசெய்யும் முன் அனைத்து மருந்து வகைகளையும் தேர்ந்தெடுக்கவும்',
  },
};


