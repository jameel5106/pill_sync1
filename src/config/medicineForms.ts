// NEEDS NATIVE-SPEAKER REVIEW
// Single source of truth for medicine forms, categories, default units, verbs,
// application areas, and 7-language localized labels used across:
//   - AI OCR schema (server.ts)
//   - Deterministic form inference (src/services/formInference.ts)
//   - Custom grouped dropdown (src/components/MedicineFormSelect.tsx)
//   - Review & Manual modals (ReviewMedicinesScreen.tsx, ManualMedicineModal.tsx)
//   - Plain-language sentence builder & 7-language translations (frequencyHelper.ts, glossary.ts, translations.ts)
//   - Reminders & notifications (reminderService.ts, RealPillSyncApp.tsx)

export type FormLanguageCode = 'en' | 'hi' | 'ur' | 'te' | 'bn' | 'mr' | 'ta';

export type MedicineFormCategory =
  | 'oral'
  | 'topical'
  | 'drops'
  | 'injection'
  | 'inhaler'
  | 'other';

export type MedicineFormGroupId = 'oral' | 'topical' | 'drops' | 'other';

export type MedicineFormId =
  // Oral
  | 'tablet'
  | 'capsule'
  | 'syrup'
  | 'suspension'
  | 'powder_sachet'
  | 'lozenge'
  // Topical
  | 'lotion'
  | 'cream'
  | 'ointment'
  | 'gel'
  | 'shampoo'
  | 'spray'
  | 'solution'
  | 'patch'
  // Drops
  | 'eye_drops'
  | 'ear_drops'
  | 'nasal_drops'
  // Other
  | 'injection'
  | 'inhaler'
  | 'suppository'
  | 'other';

export type MedicineDefaultUnit =
  | 'tablet'
  | 'capsule'
  | 'ml'
  | 'application'
  | 'drop'
  | 'puff'
  | 'sachet'
  | 'lozenge'
  | 'patch'
  | 'injection'
  | 'suppository'
  | 'dose';

export type MedicineActionVerb =
  | 'Take'
  | 'Apply'
  | 'Put in the eye'
  | 'Put in the ear'
  | 'Put in the nose'
  | 'Inhale'
  | 'Inject'
  | 'Use';

export type ApplicationAreaId =
  | 'affected_area'
  | 'face'
  | 'scalp'
  | 'hands'
  | 'eye'
  | 'ear'
  | 'nose'
  | 'other';

export interface MedicineFormDefinition {
  id: MedicineFormId;
  group: MedicineFormGroupId;
  category: MedicineFormCategory;
  defaultUnit: MedicineDefaultUnit;
  verb: MedicineActionVerb;
  dosePlaceholder: string;
  label: Record<FormLanguageCode, string>;
}

export const MEDICINE_FORM_GROUP_LABELS: Record<
  MedicineFormGroupId,
  Record<FormLanguageCode, string>
> = {
  oral: {
    en: 'Oral',
    hi: 'मुँह से लेने वाली (Oral)',
    ur: 'منہ سے لینے والی (Oral)',
    te: 'నోటి ద్వారా (Oral)',
    bn: 'মুখে খাওয়ার (Oral)',
    mr: 'तोंडावाटे (Oral)',
    ta: 'வாய்வழி (Oral)',
  },
  topical: {
    en: 'Topical (Skin & Hair)',
    hi: 'त्वचा/बालों पर लगाने वाली (Topical)',
    ur: 'جلد اور بالوں پر لگانے والی (Topical)',
    te: 'చర్మం/జుట్టుకు రాసేవి (Topical)',
    bn: 'ত্বক/চুলে লাগানোর (Topical)',
    mr: 'त्वचा/केसांवर लावण्याची (Topical)',
    ta: 'சருமம்/முடியில் தடவும் (Topical)',
  },
  drops: {
    en: 'Drops',
    hi: 'बूंदें (Drops)',
    ur: 'قطرے (Drops)',
    te: 'చుక్కల మందు (Drops)',
    bn: 'ড্রপস (ফোঁটা)',
    mr: 'थेंब (Drops)',
    ta: 'சொட்டு மருந்து (Drops)',
  },
  other: {
    en: 'Other',
    hi: 'अन्य (Other)',
    ur: 'دیگر (Other)',
    te: 'ఇతర (Other)',
    bn: 'অন্যান্য (Other)',
    mr: 'इतर (Other)',
    ta: 'மற்றவை (Other)',
  },
};

export const MEDICINE_FORMS: MedicineFormDefinition[] = [
  // ---------------- ORAL ----------------
  {
    id: 'tablet',
    group: 'oral',
    category: 'oral',
    defaultUnit: 'tablet',
    verb: 'Take',
    dosePlaceholder: 'e.g. 1 tablet',
    label: {
      en: 'Tablet',
      hi: 'गोली (Tablet)',
      ur: 'گولی (Tablet)',
      te: 'మాత్ర (Tablet)',
      bn: 'ট্যাবলেট',
      mr: 'गोळी (Tablet)',
      ta: 'மாத்திரை (Tablet)',
    },
  },
  {
    id: 'capsule',
    group: 'oral',
    category: 'oral',
    defaultUnit: 'capsule',
    verb: 'Take',
    dosePlaceholder: 'e.g. 1 capsule',
    label: {
      en: 'Capsule',
      hi: 'कैप्सूल (Capsule)',
      ur: 'کیپسول (Capsule)',
      te: 'క్యాప్సూల్ (Capsule)',
      bn: 'ক্যাপসুল',
      mr: 'कॅप्सूल (Capsule)',
      ta: 'கேப்ஸ்யூல் (Capsule)',
    },
  },
  {
    id: 'syrup',
    group: 'oral',
    category: 'oral',
    defaultUnit: 'ml',
    verb: 'Take',
    dosePlaceholder: 'e.g. 5 ml',
    label: {
      en: 'Syrup',
      hi: 'सिरप (Syrup)',
      ur: 'شربت (Syrup)',
      te: 'సిరప్ (Syrup)',
      bn: 'সিরাপ',
      mr: 'सिरप (Syrup)',
      ta: 'சிரப் (Syrup)',
    },
  },
  {
    id: 'suspension',
    group: 'oral',
    category: 'oral',
    defaultUnit: 'ml',
    verb: 'Take',
    dosePlaceholder: 'e.g. 5 ml',
    label: {
      en: 'Suspension',
      hi: 'सस्पेंशन (घोल)',
      ur: 'سسپنشن (محلول)',
      te: 'సస్పెన్షన్',
      bn: 'সাসপেনশন',
      mr: 'सस्पेन्शन (द्रव)',
      ta: 'சஸ்பென்ஷன்',
    },
  },
  {
    id: 'powder_sachet',
    group: 'oral',
    category: 'oral',
    defaultUnit: 'sachet',
    verb: 'Take',
    dosePlaceholder: 'e.g. 1 sachet',
    label: {
      en: 'Powder or Sachet',
      hi: 'पाउडर / पाउच',
      ur: 'پاؤڈر / ساشے',
      te: 'పౌడర్ / సాచెట్',
      bn: 'পাউডার / স্যাশে',
      mr: 'पावडर / सॅशे',
      ta: 'பவுடர் / சாஷே',
    },
  },
  {
    id: 'lozenge',
    group: 'oral',
    category: 'oral',
    defaultUnit: 'lozenge',
    verb: 'Take',
    dosePlaceholder: 'e.g. 1 lozenge',
    label: {
      en: 'Lozenge',
      hi: 'चूसने की गोली (Lozenge)',
      ur: 'چوسنے والی گولی (Lozenge)',
      te: 'చప్పరించే మాత్ర (Lozenge)',
      bn: 'লজেন্স',
      mr: 'चघळण्याची गोळी (Lozenge)',
      ta: 'சப்பும் மாத்திரை (Lozenge)',
    },
  },

  // ---------------- TOPICAL ----------------
  {
    id: 'lotion',
    group: 'topical',
    category: 'topical',
    defaultUnit: 'application',
    verb: 'Apply',
    dosePlaceholder: 'Apply a thin layer',
    label: {
      en: 'Lotion',
      hi: 'लोशन (Lotion)',
      ur: 'لوشن (Lوشن)',
      te: 'లోషన్ (Lotion)',
      bn: 'লোশন',
      mr: 'लोशन (Lotion)',
      ta: 'லோஷன் (Lotion)',
    },
  },
  {
    id: 'cream',
    group: 'topical',
    category: 'topical',
    defaultUnit: 'application',
    verb: 'Apply',
    dosePlaceholder: 'Apply a thin layer',
    label: {
      en: 'Cream',
      hi: 'क्रीम (Cream)',
      ur: 'کریم (Cream)',
      te: 'క్రీమ్ (Cream)',
      bn: 'ক্রিম',
      mr: 'क्रीम (Cream)',
      ta: 'கிரீம் (Cream)',
    },
  },
  {
    id: 'ointment',
    group: 'topical',
    category: 'topical',
    defaultUnit: 'application',
    verb: 'Apply',
    dosePlaceholder: 'Apply a thin layer',
    label: {
      en: 'Ointment',
      hi: 'मलहम (Ointment)',
      ur: 'مرہم (Ointment)',
      te: 'లేపనం (Ointment)',
      bn: 'মলম',
      mr: 'मलम (Ointment)',
      ta: 'களிம்பு (Ointment)',
    },
  },
  {
    id: 'gel',
    group: 'topical',
    category: 'topical',
    defaultUnit: 'application',
    verb: 'Apply',
    dosePlaceholder: 'Apply a thin layer',
    label: {
      en: 'Gel',
      hi: 'जेल (Gel)',
      ur: 'جیل (Gel)',
      te: 'జెల్ (Gel)',
      bn: 'জেল',
      mr: 'जेल (Gel)',
      ta: 'ஜெல் (Gel)',
    },
  },
  {
    id: 'shampoo',
    group: 'topical',
    category: 'topical',
    defaultUnit: 'application',
    verb: 'Apply',
    dosePlaceholder: 'Apply a thin layer',
    label: {
      en: 'Shampoo',
      hi: 'शैम्पू (Shampoo)',
      ur: 'شیمپو (Shampoo)',
      te: 'షాంపూ (Shampoo)',
      bn: 'শ্যাম্পু',
      mr: 'शॅम्पू (Shampoo)',
      ta: 'ஷாம்பூ (Shampoo)',
    },
  },
  {
    id: 'spray',
    group: 'topical',
    category: 'topical',
    defaultUnit: 'application',
    verb: 'Apply',
    dosePlaceholder: 'Apply a thin layer',
    label: {
      en: 'Spray',
      hi: 'स्प्रे (Spray)',
      ur: 'اسپرے (Spray)',
      te: 'స్ప్రే (Spray)',
      bn: 'স্প্রে',
      mr: 'स्प्रे (Spray)',
      ta: 'ஸ்ப்ரே (Spray)',
    },
  },
  {
    id: 'solution',
    group: 'topical',
    category: 'topical',
    defaultUnit: 'application',
    verb: 'Apply',
    dosePlaceholder: 'Apply a thin layer',
    label: {
      en: 'Solution (skin)',
      hi: 'घोल / लोशन (त्वचा के लिए)',
      ur: 'محلول (جلد کے لیے)',
      te: 'ద్రావణం (చర్మానికి)',
      bn: 'সলিউশন (ত্বকের জন্য)',
      mr: 'द्रव (त्वचेसाठी)',
      ta: 'கரைசல் (சருமத்திற்கு)',
    },
  },
  {
    id: 'patch',
    group: 'topical',
    category: 'topical',
    defaultUnit: 'patch',
    verb: 'Apply',
    dosePlaceholder: 'e.g. 1 patch',
    label: {
      en: 'Patch',
      hi: 'पैच (चिपकाने वाली पट्टी)',
      ur: 'پیچ (پٹی)',
      te: 'ప్యాచ్',
      bn: 'প্যাচ',
      mr: 'पॅच (पट्टी)',
      ta: 'பேட்ச் (ஒட்டு)',
    },
  },

  // ---------------- DROPS ----------------
  {
    id: 'eye_drops',
    group: 'drops',
    category: 'drops',
    defaultUnit: 'drop',
    verb: 'Put in the eye',
    dosePlaceholder: 'e.g. 2 drops',
    label: {
      en: 'Eye drops',
      hi: 'आँख की बूंदें',
      ur: 'آنکھ کے قطرے',
      te: 'కంటి చుక్కలు',
      bn: 'চোখের ড্রপস',
      mr: 'डोळ्यांचे थेंब',
      ta: 'கண் சொட்டு மருந்து',
    },
  },
  {
    id: 'ear_drops',
    group: 'drops',
    category: 'drops',
    defaultUnit: 'drop',
    verb: 'Put in the ear',
    dosePlaceholder: 'e.g. 2 drops',
    label: {
      en: 'Ear drops',
      hi: 'कान की बूंदें',
      ur: 'کان کے قطرے',
      te: 'చెవి చుక్కలు',
      bn: 'কানের ড্রপস',
      mr: 'कानाचे थेंब',
      ta: 'காது சொட்டு மருந்து',
    },
  },
  {
    id: 'nasal_drops',
    group: 'drops',
    category: 'drops',
    defaultUnit: 'drop',
    verb: 'Put in the nose',
    dosePlaceholder: 'e.g. 2 drops',
    label: {
      en: 'Nasal drops',
      hi: 'नाक की बूंदें',
      ur: 'ناک کے قطرے',
      te: 'ముక్కు చుక్కలు',
      bn: 'নাকের ড্রপস',
      mr: 'नाकाचे थेंब',
      ta: 'மூக்கு சொட்டு மருந்து',
    },
  },

  // ---------------- OTHER ----------------
  {
    id: 'injection',
    group: 'other',
    category: 'injection',
    defaultUnit: 'injection',
    verb: 'Inject',
    dosePlaceholder: 'e.g. 1 injection',
    label: {
      en: 'Injection',
      hi: 'इंजेक्शन (सुई)',
      ur: 'انجیکشن',
      te: 'ఇంజెక్షన్',
      bn: 'ইনজেকশন',
      mr: 'इंजेक्शन',
      ta: 'ஊசி (Injection)',
    },
  },
  {
    id: 'inhaler',
    group: 'other',
    category: 'inhaler',
    defaultUnit: 'puff',
    verb: 'Inhale',
    dosePlaceholder: 'e.g. 1 puff',
    label: {
      en: 'Inhaler',
      hi: 'इनहेलर (पफ)',
      ur: 'انہیلر (پف)',
      te: 'ఇన్హేలర్ (పఫ్)',
      bn: 'ইনহেলার (পাফ)',
      mr: 'इनहेलर (पफ)',
      ta: 'இன்ஹேலர் (பஃப்)',
    },
  },
  {
    id: 'suppository',
    group: 'other',
    category: 'other',
    defaultUnit: 'suppository',
    verb: 'Use',
    dosePlaceholder: 'e.g. 1 suppository',
    label: {
      en: 'Suppository',
      hi: 'सपोज़िटरी',
      ur: 'سپوزیٹری',
      te: 'సపోజిటరీ',
      bn: 'সাপোজিটরি',
      mr: 'सपोझिटरी',
      ta: 'சப்போசிட்டரி',
    },
  },
  {
    id: 'other',
    group: 'other',
    category: 'other',
    defaultUnit: 'dose',
    verb: 'Use',
    dosePlaceholder: 'e.g. 1 dose',
    label: {
      en: 'Other',
      hi: 'अन्य',
      ur: 'دیگر',
      te: 'ఇతర',
      bn: 'অন্যান্য',
      mr: 'इतर',
      ta: 'மற்றவை',
    },
  },
];

export const ALL_MEDICINE_FORM_IDS: MedicineFormId[] = MEDICINE_FORMS.map((f) => f.id);

export const MEDICINE_FORMS_BY_ID: Record<MedicineFormId, MedicineFormDefinition> =
  MEDICINE_FORMS.reduce((acc, def) => {
    acc[def.id] = def;
    return acc;
  }, {} as Record<MedicineFormId, MedicineFormDefinition>);

export function normalizeFormId(rawForm?: string | null): MedicineFormId | null {
  if (!rawForm) return null;
  const clean = rawForm
    .toLowerCase()
    .trim()
    .replace(/\.+/g, '')
    .replace(/[\s-]+/g, '_');
  if (!clean) return null;

  if (clean in MEDICINE_FORMS_BY_ID) {
    return clean as MedicineFormId;
  }

  // Common synonyms & legacy values
  if (clean === 'tab' || clean === 'tablets') return 'tablet';
  if (clean === 'cap' || clean === 'capsules') return 'capsule';
  if (clean === 'syp' || clean === 'syrups') return 'syrup';
  if (clean === 'susp') return 'suspension';
  if (clean === 'powder' || clean === 'sachet' || clean === 'powder_or_sachet') {
    return 'powder_sachet';
  }
  if (clean === 'lozenges') return 'lozenge';
  if (clean === 'lot' || clean === 'lotions') return 'lotion';
  if (clean === 'crm' || clean === 'creams') return 'cream';
  if (clean === 'oint' || clean === 'ointments') return 'ointment';
  if (clean === 'gels') return 'gel';
  if (clean === 'shmp' || clean === 'shampoos') return 'shampoo';
  if (clean === 'sprays') return 'spray';
  if (clean === 'sol' || clean === 'soln' || clean === 'solution_skin') return 'solution';
  if (clean === 'patches') return 'patch';
  if (clean === 'eyedrops' || clean === 'eye_drop') return 'eye_drops';
  if (clean === 'eardrops' || clean === 'ear_drop') return 'ear_drops';
  if (clean === 'nasaldrops' || clean === 'nasal_drop' || clean === 'nose_drops') {
    return 'nasal_drops';
  }
  if (clean === 'inj' || clean === 'injections') return 'injection';
  if (clean === 'inh' || clean === 'inhalers' || clean === 'rotacap' || clean === 'rotacaps') {
    return 'inhaler';
  }
  if (clean === 'sup' || clean === 'supp' || clean === 'suppositories') return 'suppository';
  // Generic "drops" without a site stays null or drops? Map generic "drops" to null unless specified?
  // Wait: if legacy stored data has "drops", let's handle safely in getMedicineFormDef without guessing eye/ear/nose.
  return null;
}

export function getMedicineFormDef(rawForm?: string | null): MedicineFormDefinition | null {
  const id = normalizeFormId(rawForm);
  return id ? MEDICINE_FORMS_BY_ID[id] : null;
}

export function isOralForm(rawForm?: string | null): boolean {
  const def = getMedicineFormDef(rawForm);
  if (!def) return false;
  return def.category === 'oral';
}

export function isTopicalForm(rawForm?: string | null): boolean {
  const def = getMedicineFormDef(rawForm);
  if (!def) return false;
  return def.category === 'topical';
}

export function isDropsForm(rawForm?: string | null): boolean {
  const def = getMedicineFormDef(rawForm);
  if (def && def.category === 'drops') return true;
  const lower = (rawForm || '').toLowerCase();
  return lower === 'drops' || lower === 'drop';
}

export function isFoodTimingApplicable(rawForm?: string | null): boolean {
  const id = normalizeFormId(rawForm);
  if (!id) {
    // When form is still blank/unset, do not assume oral or non-oral prematurely;
    // keep food timing hidden or optional only for oral? Wait: if unknown/generic, allow or hide?
    // Checking explicit requirement:
    // "Food timing applies ONLY to oral forms. For topical, drops, inhalers, and injections,
    //  hide the 6 food timing buttons and show 'Not related to food'."
    const lower = (rawForm || '').toLowerCase();
    if (lower === 'drops' || lower === 'drop') return false;
    return false;
  }
  return MEDICINE_FORMS_BY_ID[id].category === 'oral';
}

export const TOPICAL_APPLICATION_AREAS: {
  id: ApplicationAreaId;
  label: Record<FormLanguageCode, string>;
}[] = [
  {
    id: 'affected_area',
    label: {
      en: 'affected area',
      hi: 'प्रभावित जगह',
      ur: 'متاثرہ جگہ',
      te: 'ప్రభావిత ప్రాంతం',
      bn: 'আক্রান্ত স্থানে',
      mr: 'बाधित भाग',
      ta: 'பாதிக்கப்பட்ட பகுதி',
    },
  },
  {
    id: 'face',
    label: {
      en: 'face',
      hi: 'चेहरे',
      ur: 'چہرے',
      te: 'ముఖం',
      bn: 'মুখে',
      mr: 'चेहरा',
      ta: 'முகம்',
    },
  },
  {
    id: 'scalp',
    label: {
      en: 'scalp',
      hi: 'सिर की त्वचा',
      ur: 'سر کی جلد',
      te: 'తల చర్మం',
      bn: 'মাথার ত্বকে',
      mr: 'डोक्याची त्वचा',
      ta: 'உச்சந்தலை',
    },
  },
  {
    id: 'hands',
    label: {
      en: 'hands',
      hi: 'हाथों',
      ur: 'ہاتھوں',
      te: 'చేతులు',
      bn: 'হাতে',
      mr: 'हात',
      ta: 'கைகள்',
    },
  },
  {
    id: 'other',
    label: {
      en: 'other area',
      hi: 'अन्य जगह',
      ur: 'دیگر جگہ',
      te: 'ఇతర భాగం',
      bn: 'অন্য স্থান',
      mr: 'इतर भाग',
      ta: 'மற்ற பகுதி',
    },
  },
];

export const DROPS_APPLICATION_SITES: {
  formId: MedicineFormId;
  areaId: ApplicationAreaId;
  label: Record<FormLanguageCode, string>;
}[] = [
  {
    formId: 'eye_drops',
    areaId: 'eye',
    label: {
      en: 'Eye',
      hi: 'आँख',
      ur: 'آنکھ',
      te: 'కన్ను',
      bn: 'চোখ',
      mr: 'डोळा',
      ta: 'கண்',
    },
  },
  {
    formId: 'ear_drops',
    areaId: 'ear',
    label: {
      en: 'Ear',
      hi: 'कान',
      ur: 'کان',
      te: 'చెవి',
      bn: 'কান',
      mr: 'कान',
      ta: 'காது',
    },
  },
  {
    formId: 'nasal_drops',
    areaId: 'nose',
    label: {
      en: 'Nose',
      hi: 'नाक',
      ur: 'ناک',
      te: 'ముక్కు',
      bn: 'নাক',
      mr: 'नाक',
      ta: 'மூக்கு',
    },
  },
];

export function resolveApplicationAreaLabel(
  areaRaw: string | null | undefined,
  lang: FormLanguageCode
): string {
  if (!areaRaw) return '';
  const clean = areaRaw.toLowerCase().trim().replace(/\s+/g, '_');
  const match = TOPICAL_APPLICATION_AREAS.find((a) => a.id === clean);
  if (match) return match.label[lang];
  const dropMatch = DROPS_APPLICATION_SITES.find((d) => d.areaId === clean);
  if (dropMatch) return dropMatch.label[lang];
  // Preserve custom user-typed area string safely
  return areaRaw.trim();
}
