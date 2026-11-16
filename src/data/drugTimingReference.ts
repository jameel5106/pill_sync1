/**
 * Bundled evidence-based reference for default medication time-of-day and food timing.
 *
 * CLINICAL PRIORITY ORDER:
 *   1. Explicit prescription instructions (AC, PC, before/after/with food, empty stomach, HS) ALWAYS take precedence.
 *   2. If prescription omits timing, match against this reference and tag as "Suggested for this medicine, not written on the prescription".
 *   3. Otherwise default to "Unspecified / Anytime" (or high-confidence Gemini labeling fallback).
 *
 * All starter entries are marked "needs pharmacist review" with reviewedBy left empty.
 */

export type ReferenceUsualTimeOfDay = 'morning' | 'night' | 'bedtime' | 'any';
export type ReferenceFoodTiming =
  | 'before_food'
  | 'after_food'
  | 'with_food'
  | 'empty_stomach'
  | 'bedtime'
  | 'anytime';

export interface DrugTimingReferenceEntry {
  genericName: string;
  brandAliases: string[];
  usualTimeOfDay: ReferenceUsualTimeOfDay;
  foodTiming: ReferenceFoodTiming;
  note: string;
  source: string;
  reviewedBy: string; // Left empty for a pharmacist to fill in
  reviewStatus: 'needs pharmacist review';
}

export const DRUG_TIMING_REFERENCE: DrugTimingReferenceEntry[] = [
  // Sleep / Sedative-Hypnotics
  {
    genericName: 'Zolpidem',
    brandAliases: ['zolfresh', 'nitrest', 'stilnox', 'zoldem', 'zolpidem'],
    usualTimeOfDay: 'bedtime',
    foodTiming: 'bedtime',
    note: 'Taken right before sleep; do not take with or right after a meal.',
    source: 'CDSCO / Standard Prescribing Information',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    genericName: 'Zaleplon',
    brandAliases: ['zaplon', 'sonata', 'zaleplon'],
    usualTimeOfDay: 'bedtime',
    foodTiming: 'bedtime',
    note: 'Taken right before sleep; do not take with or right after a heavy meal.',
    source: 'Standard Prescribing Information',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    genericName: 'Eszopiclone',
    brandAliases: ['eszopiclone', 'fulnite', 'zopicon', 'lunesta', 'eszo'],
    usualTimeOfDay: 'bedtime',
    foodTiming: 'bedtime',
    note: 'Taken right before sleep; avoid taking with or immediately after a heavy meal.',
    source: 'Standard Prescribing Information',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    genericName: 'Melatonin',
    brandAliases: ['meloset', 'melatonin', 'melozet', 'zytonin'],
    usualTimeOfDay: 'bedtime',
    foodTiming: 'bedtime',
    note: 'Usually taken 30 to 60 minutes before bedtime.',
    source: 'Standard Clinical Reference',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },

  // Proton Pump Inhibitors (PPIs)
  {
    genericName: 'Pantoprazole',
    brandAliases: ['pan', 'pan 40', 'pan-40', 'pantocid', 'pantop', 'pan d', 'pan-d', 'pantodac', 'pantosec', 'pantin'],
    usualTimeOfDay: 'morning',
    foodTiming: 'empty_stomach',
    note: 'Usually taken in the morning on an empty stomach, 30 to 60 minutes before breakfast.',
    source: 'CDSCO / Standard PPI Labeling',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    genericName: 'Omeprazole',
    brandAliases: ['omez', 'omez 20', 'omez-20', 'ocid', 'omez d', 'omez-d', 'prilosec', 'omeprazole'],
    usualTimeOfDay: 'morning',
    foodTiming: 'empty_stomach',
    note: 'Usually taken in the morning on an empty stomach, 30 to 60 minutes before breakfast.',
    source: 'CDSCO / Standard PPI Labeling',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    genericName: 'Esomeprazole',
    brandAliases: ['nexpro', 'sompraz', 'raciper', 'esomac', 'nexium', 'esomeprazole'],
    usualTimeOfDay: 'morning',
    foodTiming: 'empty_stomach',
    note: 'Usually taken in the morning on an empty stomach, 30 to 60 minutes before breakfast.',
    source: 'CDSCO / Standard PPI Labeling',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    genericName: 'Rabeprazole',
    brandAliases: ['razo', 'rabium', 'rabicip', 'rablet', 'veloz', 'cyra', 'rekool', 'rabeprazole'],
    usualTimeOfDay: 'morning',
    foodTiming: 'empty_stomach',
    note: 'Usually taken in the morning on an empty stomach, usually 30 to 60 minutes before breakfast.',
    source: 'CDSCO / Standard PPI Labeling',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },

  // Thyroid Hormone
  {
    genericName: 'Levothyroxine',
    brandAliases: ['thyronorm', 'eltroxin', 'thyrox', 'lethyrox', 'thyroup', 'levothyroxine'],
    usualTimeOfDay: 'morning',
    foodTiming: 'empty_stomach',
    note: 'Taken in the morning on an empty stomach, 30 to 60 minutes before breakfast.',
    source: 'Indian Pharmacopoeia / Standard Labeling',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },

  // Statins
  {
    genericName: 'Atorvastatin',
    brandAliases: ['atorva', 'tonact', 'storvas', 'atorlip', 'atocor', 'lipitor', 'atorvastatin'],
    usualTimeOfDay: 'any',
    foodTiming: 'anytime',
    note: 'May be taken at any consistent time of day, with or without food.',
    source: 'Standard Prescribing Information',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    genericName: 'Rosuvastatin',
    brandAliases: ['rosuvas', 'rozavel', 'rosulip', 'roseday', 'rosuvast', 'crestor', 'rosuvastatin'],
    usualTimeOfDay: 'any',
    foodTiming: 'anytime',
    note: 'May be taken at any time of day, with or without food.',
    source: 'Standard Prescribing Information',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },

  // Diabetes (Metformin, Glimepiride)
  {
    genericName: 'Metformin',
    brandAliases: ['glycomet', 'glucophage', 'obimet', 'metsmall', 'glyciphage', 'cetapin', 'metformin'],
    usualTimeOfDay: 'any',
    foodTiming: 'with_food',
    note: 'Take with or immediately after food to reduce stomach upset.',
    source: 'CDSCO / Standard Prescribing Information',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    genericName: 'Glimepiride',
    brandAliases: ['amaryl', 'glimestar', 'gemer', 'zoryl', 'azulix', 'glimy', 'glimepiride'],
    usualTimeOfDay: 'morning',
    foodTiming: 'before_food',
    note: 'Usually taken right before or with the first main meal of the day.',
    source: 'Standard Prescribing Information',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },

  // NSAIDs / Analgesics / Antiplatelet
  {
    genericName: 'Ibuprofen',
    brandAliases: ['brufen', 'combiflam', 'ibugesic', 'advil', 'flexon', 'ibuprofen'],
    usualTimeOfDay: 'any',
    foodTiming: 'after_food',
    note: 'Take with or after food to help prevent stomach irritation.',
    source: 'CDSCO / Standard Prescribing Information',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    genericName: 'Diclofenac',
    brandAliases: ['voveran', 'reactin', 'dynapar', 'voltaren', 'dicloran', 'diclofenac'],
    usualTimeOfDay: 'any',
    foodTiming: 'after_food',
    note: 'Take with or after food to reduce stomach irritation.',
    source: 'CDSCO / Standard Prescribing Information',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    genericName: 'Aceclofenac',
    brandAliases: ['zerodol', 'hifenac', 'aceclo', 'zerodol sp', 'zerodol-sp', 'aceclofenac'],
    usualTimeOfDay: 'any',
    foodTiming: 'after_food',
    note: 'Take with or after food to reduce stomach irritation.',
    source: 'CDSCO Labeling',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    genericName: 'Aspirin',
    brandAliases: ['ecosprin', 'ecosprin 75', 'ecosprin 150', 'disprin', 'loprin', 'aspirin'],
    usualTimeOfDay: 'any',
    foodTiming: 'after_food',
    note: 'Take with or after food.',
    source: 'Standard Prescribing Information',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    genericName: 'Paracetamol',
    brandAliases: ['dolo', 'dolo 650', 'dolo-650', 'crocin', 'calpol', 'pacimol', 'p 500', 'paracetamol', 'acetaminophen'],
    usualTimeOfDay: 'any',
    foodTiming: 'anytime',
    note: 'Can be taken with or without food.',
    source: 'Standard Prescribing Information',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },

  // Antibiotics
  {
    genericName: 'Amoxicillin-Clavulanate',
    brandAliases: ['augmentin', 'augmentin 625', 'clavam', 'moxclav', 'moxikind cv', 'moxikind-cv', 'advent', 'amoxyclav', 'amoxicillin clavulanate'],
    usualTimeOfDay: 'any',
    foodTiming: 'with_food',
    note: 'Take at the start of a meal for best absorption and stomach comfort.',
    source: 'CDSCO / Standard Labeling',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    genericName: 'Azithromycin',
    brandAliases: ['azithral', 'azee', 'zithromax', 'azimax', 'azithromycin'],
    usualTimeOfDay: 'any',
    foodTiming: 'anytime',
    note: 'Tablets may be taken with or without food.',
    source: 'Standard Prescribing Information',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    genericName: 'Cefixime',
    brandAliases: ['taxim o', 'taxim-o', 'zifi', 'ceftas', 'mahacef', 'cefixime'],
    usualTimeOfDay: 'any',
    foodTiming: 'anytime',
    note: 'May be taken with or without food (taking with food can ease stomach upset).',
    source: 'Standard Prescribing Information',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    genericName: 'Doxycycline',
    brandAliases: ['doxy', 'doxt', 'doxt sl', 'vibramycin', 'doxycycline'],
    usualTimeOfDay: 'any',
    foodTiming: 'after_food',
    note: 'Take after food with plenty of water and stay upright for 30 minutes.',
    source: 'Standard Prescribing Information',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },

  // Iron Supplements
  {
    genericName: 'Iron Supplements (Ferrous Sulfate / Fumarate)',
    brandAliases: ['ferrous', 'fefol', 'autrin', 'livogen', 'dexorange', 'orofer', 'hemfer', 'iron'],
    usualTimeOfDay: 'any',
    foodTiming: 'empty_stomach',
    note: 'Best absorbed on an empty stomach if tolerated; otherwise take with food.',
    source: 'Standard Clinical Reference',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },

  // Allergy / Respiratory
  {
    genericName: 'Montelukast',
    brandAliases: ['montair', 'montek', 'singulair', 'telekast', 'romilast', 'montair lc', 'montek lc', 'montelukast'],
    usualTimeOfDay: 'night',
    foodTiming: 'anytime',
    note: 'Usually taken in the evening or at night, with or without food.',
    source: 'CDSCO / Standard Prescribing Information',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    genericName: 'Cetirizine',
    brandAliases: ['zyrtec', 'cetzine', 'okacet', 'alerid', 'incid', 'cetirizine'],
    usualTimeOfDay: 'night',
    foodTiming: 'anytime',
    note: 'Often taken at night as it can cause drowsiness; anytime with or without food.',
    source: 'CDSCO / Standard Prescribing Information',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    genericName: 'Levocetirizine',
    brandAliases: ['levocet', 'xyzal', 'teczine', 'vozet', '1 al', '1-al', 'l cet', 'levocetirizine'],
    usualTimeOfDay: 'night',
    foodTiming: 'anytime',
    note: 'Often taken at night as it can cause drowsiness; anytime with or without food.',
    source: 'CDSCO / Standard Prescribing Information',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },

  // Corticosteroids
  {
    genericName: 'Prednisolone',
    brandAliases: ['wysolone', 'omnacortil', 'deltacortril', 'predone', 'prednisolone'],
    usualTimeOfDay: 'morning',
    foodTiming: 'after_food',
    note: 'Usually taken in the morning, with or after food.',
    source: 'Standard Prescribing Information',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },

  // GI / Prokinetic / Antiemetic
  {
    genericName: 'Domperidone',
    brandAliases: ['domstal', 'vomistop', 'domperidone'],
    usualTimeOfDay: 'any',
    foodTiming: 'before_food',
    note: 'Usually taken 15 to 30 minutes before meals.',
    source: 'CDSCO Labeling',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
  {
    genericName: 'Ondansetron',
    brandAliases: ['emeset', 'ondem', 'vomikind', 'zofran', 'ondansetron'],
    usualTimeOfDay: 'any',
    foodTiming: 'anytime',
    note: 'May be taken with or without food.',
    source: 'Standard Prescribing Information',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },

  // Bone Health
  {
    genericName: 'Alendronate',
    brandAliases: ['osteofos', 'fosamax', 'alendronate'],
    usualTimeOfDay: 'morning',
    foodTiming: 'empty_stomach',
    note: 'Take first thing in the morning on an empty stomach with plain water.',
    source: 'Standard Prescribing Information',
    reviewedBy: '',
    reviewStatus: 'needs pharmacist review',
  },
];

function cleanDrugName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(tab|tablet|tablets|cap|capsule|capsules|syp|syrup|inj|injection|drops|drop|oint|ointment|cream|gel|susp|suspension|sr|er|xr|dr|cr|dt|md|ds|plus|forte)\b/g, ' ')
    .replace(/\b\d+(?:\.\d+)?\s*(mg|mcg|g|gm|ml|iu|%)\b/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function lookupDrugTimingReference(
  medicineName?: string | null,
  genericName?: string | null
): DrugTimingReferenceEntry | null {
  const candidates = [medicineName, genericName].filter(Boolean) as string[];
  for (const rawCandidate of candidates) {
    const cleaned = cleanDrugName(rawCandidate);
    const cleanedNoDash = cleaned.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) continue;

    // 1. Exact alias or generic match
    for (const entry of DRUG_TIMING_REFERENCE) {
      const genericLower = entry.genericName.toLowerCase();
      if (cleaned === genericLower || cleanedNoDash === genericLower) {
        return entry;
      }
      for (const alias of entry.brandAliases) {
        const aliasClean = alias.toLowerCase().replace(/-/g, ' ').trim();
        if (cleaned === alias || cleanedNoDash === aliasClean) {
          return entry;
        }
      }
    }

    // 2. Prefix / whole-word alias match (e.g. "Pan 40", "Augmentin Duo", "Zolfresh 10")
    for (const entry of DRUG_TIMING_REFERENCE) {
      const terms = [entry.genericName.toLowerCase(), ...entry.brandAliases];
      for (const term of terms) {
        const t = term.replace(/-/g, ' ').trim();
        if (t.length < 3) continue;
        const regex = new RegExp(`(^|\\s)${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|\\d|$)`, 'i');
        if (regex.test(cleanedNoDash)) {
          return entry;
        }
      }
    }
  }

  return null;
}

export function referenceFoodTimingToUiValue(foodTiming: ReferenceFoodTiming): string {
  switch (foodTiming) {
    case 'before_food':
      return 'before food';
    case 'after_food':
      return 'after food';
    case 'with_food':
      return 'with food';
    case 'empty_stomach':
      return 'empty stomach';
    case 'bedtime':
      return 'bedtime';
    case 'anytime':
    default:
      return 'unspecified';
  }
}

export type TimingConflictType = 'usually_night' | 'usually_morning' | null;

/**
 * Checks whether explicit prescription schedule/timing conflicts with well-established reference timing.
 * Never overrides the prescription — only returns a quiet warning type.
 */
export function detectTimingConflict(
  entry: DrugTimingReferenceEntry | null,
  schedule: { morning: number; afternoon: number; night: number; bedtime: number },
  explicitTiming: string
): TimingConflictType {
  if (!entry) return null;

  const hasMorning = schedule.morning > 0;
  const hasAfternoon = schedule.afternoon > 0;
  const hasNightOrBed = schedule.night > 0 || schedule.bedtime > 0;

  // e.g. sleep medicine (zolpidem) scheduled in morning, not at night/bedtime
  if (
    (entry.usualTimeOfDay === 'bedtime' || entry.usualTimeOfDay === 'night') &&
    (hasMorning || hasAfternoon) &&
    !hasNightOrBed
  ) {
    return 'usually_night';
  }

  // e.g. morning empty-stomach medicine (levothyroxine / pantoprazole) written after food or only at bedtime
  if (entry.usualTimeOfDay === 'morning') {
    const t = explicitTiming.toLowerCase().trim();
    if (
      (hasNightOrBed && !hasMorning) ||
      (entry.foodTiming === 'empty_stomach' && (t === 'after food' || t === 'with food' || t === 'bedtime'))
    ) {
      return 'usually_morning';
    }
  }

  return null;
}
