import assert from 'node:assert/strict';
import {
  normalizeHandwritingFrequency,
  buildEnglishFrequencySentence,
  resolveEnglishUnit,
  formatEnglishQtyWithUnit,
} from '../frequencyHelper';
import {
  lookupDrugTimingReference,
  referenceFoodTimingToUiValue,
  detectTimingConflict,
  DRUG_TIMING_REFERENCE,
} from '../../data/drugTimingReference';
import {
  buildMedicineSentenceFromTemplate,
  REVIEW_CARD_LABELS,
  toSupportedLang,
} from '../../translations/glossary';
import { SUPPORTED_LANGUAGES } from '../../data/translations';

console.log('Running PillSync Review Card & Frequency/Timing Reference Tests...');

// 1. Handwriting variant normalization: "o --- 1 (N)" -> 0-0-1 at night -> "Once a day, at night"
const nightVariant = normalizeHandwritingFrequency('o --- 1 (N)');
assert.equal(nightVariant.isValid, true);
assert.deepEqual(nightVariant.schedule, { morning: 0, afternoon: 0, night: 1, bedtime: 0 });
assert.equal(nightVariant.canonicalCode, '0-0-1');
assert.equal(
  buildEnglishFrequencySentence(nightVariant, 'tablet', '1 tablet'),
  'Once a day, at night'
);

const oVariant = normalizeHandwritingFrequency('O--1(N)');
assert.equal(oVariant.canonicalCode, '0-0-1');
assert.equal(buildEnglishFrequencySentence(oVariant, 'tablet'), 'Once a day, at night');

const sharedEnSentence = buildMedicineSentenceFromTemplate(
  { name: 'Zolfresh', form: 'tablet', dose: '1 tablet', frequency: 'o --- 1 (N)', timing: 'bedtime' },
  'en'
);
assert.ok(sharedEnSentence.includes('once a day, at night'), `Expected shared sentence to contain "once a day, at night", got: ${sharedEnSentence}`);

// 2. All required plain-language frequency formats
assert.equal(
  buildEnglishFrequencySentence(normalizeHandwritingFrequency('1-0-0'), 'tablet'),
  'Once a day, in the morning'
);
assert.equal(
  buildEnglishFrequencySentence(normalizeHandwritingFrequency('0-1-0'), 'tablet'),
  'Once a day, in the afternoon'
);
assert.equal(
  buildEnglishFrequencySentence(normalizeHandwritingFrequency('0-0-1'), 'tablet'),
  'Once a day, at night'
);
assert.equal(
  buildEnglishFrequencySentence(normalizeHandwritingFrequency('1-0-1'), 'tablet'),
  'Twice a day: morning and night'
);
assert.equal(
  buildEnglishFrequencySentence(normalizeHandwritingFrequency('1-1-1'), 'tablet'),
  'Three times a day: morning, afternoon, and night'
);
assert.equal(
  buildEnglishFrequencySentence(normalizeHandwritingFrequency('2-0-1'), 'tablet'),
  '2 tablets in the morning and 1 at night'
);
assert.equal(
  buildEnglishFrequencySentence(normalizeHandwritingFrequency('2-0-1'), 'capsule'),
  '2 capsules in the morning and 1 at night'
);
assert.equal(
  buildEnglishFrequencySentence(normalizeHandwritingFrequency('BD'), 'tablet'),
  'Twice a day'
);
assert.equal(
  buildEnglishFrequencySentence(normalizeHandwritingFrequency('TDS'), 'tablet'),
  'Three times a day'
);
assert.equal(
  buildEnglishFrequencySentence(normalizeHandwritingFrequency('QID'), 'tablet'),
  'Four times a day'
);
assert.equal(
  buildEnglishFrequencySentence(normalizeHandwritingFrequency('HS'), 'tablet'),
  'At bedtime'
);
assert.equal(
  buildEnglishFrequencySentence(normalizeHandwritingFrequency('SOS'), 'tablet'),
  'Only when needed'
);
assert.equal(
  buildEnglishFrequencySentence(normalizeHandwritingFrequency('PRN'), 'tablet'),
  'Only when needed'
);
assert.equal(
  buildEnglishFrequencySentence(normalizeHandwritingFrequency('q8h'), 'tablet'),
  'Every 8 hours'
);
assert.equal(
  buildEnglishFrequencySentence(normalizeHandwritingFrequency('stat'), 'tablet'),
  'One time, right away'
);

// 3. Unit pluralization
assert.equal(formatEnglishQtyWithUnit(1, resolveEnglishUnit('tablet')), '1 tablet');
assert.equal(formatEnglishQtyWithUnit(2, resolveEnglishUnit('tablet')), '2 tablets');
assert.equal(formatEnglishQtyWithUnit(1, resolveEnglishUnit('inhaler')), '1 puff');
assert.equal(formatEnglishQtyWithUnit(2, resolveEnglishUnit('inhaler')), '2 puffs');
assert.equal(formatEnglishQtyWithUnit(5, resolveEnglishUnit('syrup')), '5 ml');

// 4. Invalid custom pattern check
const badPattern = normalizeHandwritingFrequency('take randomly whenever');
assert.equal(badPattern.isValid, false);

// 5. Reference lookup & metadata verification
for (const entry of DRUG_TIMING_REFERENCE) {
  assert.equal(entry.reviewStatus, 'needs pharmacist review');
  assert.equal(entry.reviewedBy, '');
}

const zolpidemRef = lookupDrugTimingReference('Zolpidem 10 mg');
assert.ok(zolpidemRef, 'Zolpidem must match reference');
assert.equal(zolpidemRef?.usualTimeOfDay, 'bedtime');
assert.equal(referenceFoodTimingToUiValue(zolpidemRef!.foodTiming), 'bedtime');

// Conflict note detection: sleep drug scheduled in morning
const zolpidemConflict = detectTimingConflict(
  zolpidemRef,
  { morning: 1, afternoon: 0, night: 0, bedtime: 0 },
  'unspecified'
);
assert.equal(zolpidemConflict, 'usually_night');

// Pantoprazole Indian brand match & conflict if written after food (while never overriding explicit Rx timing)
const pantopRef = lookupDrugTimingReference('Pan 40');
assert.ok(pantopRef, 'Pan 40 must match Pantoprazole');
assert.equal(referenceFoodTimingToUiValue(pantopRef!.foodTiming), 'empty_stomach' === 'empty_stomach' ? 'empty stomach' : '');
assert.equal(
  detectTimingConflict(pantopRef, { morning: 1, afternoon: 0, night: 0, bedtime: 0 }, 'after food'),
  'usually_morning'
);

// Unknown medicine returns null -> stays Anytime ("unspecified")
const unknownRef = lookupDrugTimingReference('UnknownDrugXYZ 100 mg');
assert.equal(unknownRef, null);

// 6. All 7 languages have complete review card labels
for (const lang of SUPPORTED_LANGUAGES) {
  const lbl = REVIEW_CARD_LABELS[toSupportedLang(lang.code)];
  assert.ok(lbl.morning && lbl.afternoon && lbl.night && lbl.bedtime);
  assert.ok(lbl.beforeFood && lbl.afterFood && lbl.withFood && lbl.emptyStomach && lbl.anytime);
  assert.ok(lbl.suggestedTag && lbl.aiSuggestedTag && lbl.usuallyNightConflict);
}

console.log('All PillSync Review Card & Timing Reference Tests PASSED!');
