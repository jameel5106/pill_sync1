import assert from 'node:assert/strict';
import { SUPPORTED_LANGUAGES } from '../../data/translations';
import {
  PRESCRIPTION_UI_LABELS,
  buildMedicineSentenceFromTemplate,
  getOfflineTransliteratedName,
  formatReviewAfterNDays,
  toSupportedLang,
} from '../glossary';
import { validateNumberPreservation } from '../../services/sentenceBuilder';

const FIXTURE_MEDICINE = {
  id: 'fixture_paracetamol',
  prescriptionId: 'fixture_rx',
  userId: 'fixture_user',
  profileId: 'fixture_profile',
  name: 'Paracetamol 500 mg',
  strength: '500 mg',
  form: 'tablet',
  dose: '1 tablet',
  frequency: '1-0-1',
  timing: 'after food',
  durationDays: 5,
  instructions: 'Take 1 tablet 500 mg twice daily after food for 5 days.',
  confidence: 1,
  illegible: false,
  confirmed: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const EXPECTED_TRANSLITERATIONS: Record<string, string> = {
  en: 'Paracetamol',
  hi: 'पैरासिटामोल',
  ur: 'پیراسیٹامول',
  te: 'పారాసెటమాల్',
  bn: 'প্যারাসিটামল',
  mr: 'पॅरासिटामॉल',
  ta: 'பாராசிட்டமால்',
};

console.log('Running PillSync 7-Language Translation Tests...');

// 1. Ensure all 7 languages render the Paracetamol 500 mg fixture with numbers 500, 1, 5 & script transliteration
assert.equal(SUPPORTED_LANGUAGES.length, 7, 'Must support all 7 languages');

for (const lang of SUPPORTED_LANGUAGES) {
  const transliterated = getOfflineTransliteratedName(FIXTURE_MEDICINE.name, lang.code);
  const sentence = buildMedicineSentenceFromTemplate(FIXTURE_MEDICINE, lang.code);
  const followUp = formatReviewAfterNDays(5, toSupportedLang(lang.code));
  const combinedCardText = `${FIXTURE_MEDICINE.name} / ${transliterated}\n${sentence}`;

  // Assert expected target-script transliteration of "Paracetamol"
  assert.ok(
    transliterated.includes(EXPECTED_TRANSLITERATIONS[lang.code]),
    `[${lang.code}] Expected transliteration to contain ${EXPECTED_TRANSLITERATIONS[lang.code]}, got: ${transliterated}`
  );

  // Assert critical Latin numbers 500, 1, 5 appear unchanged
  for (const num of ['500', '1', '5']) {
    assert.ok(
      combinedCardText.includes(num),
      `[${lang.code}] Expected combined text to preserve Latin number "${num}":\n${combinedCardText}`
    );
  }

  // Assert follow-up review phrasing keeps 5
  assert.ok(followUp.includes('5'), `[${lang.code}] Follow-up sentence must keep number 5`);

  // Assert UI labels and medical disclaimer exist and are non-empty
  const ui = PRESCRIPTION_UI_LABELS[toSupportedLang(lang.code)];
  assert.ok(ui.disclaimer.includes('PillSync'), `[${lang.code}] UI disclaimer must mention PillSync`);
  assert.ok(ui.showOriginalEnglish.length > 0, `[${lang.code}] Show original English label required`);

  // Assert Hindi reference sentence matches expected SOV ordering cleanly
  if (lang.code === 'hi') {
    assert.ok(sentence.startsWith('1 गोली सुबह और रात'), `Unexpected Hindi sentence: ${sentence}`);
    assert.ok(sentence.endsWith('लें।'), `Hindi verb must be last: ${sentence}`);
  }

  console.log(`  PASS [${lang.code}] ${transliterated} -> ${sentence}`);
}

// 2. Assert Urdu is marked RTL and all other 6 languages are LTR
const urduConfig = SUPPORTED_LANGUAGES.find((l) => l.code === 'ur');
assert.ok(urduConfig && urduConfig.isRtl === true, 'Urdu must be configured with isRtl: true');
for (const lang of SUPPORTED_LANGUAGES.filter((l) => l.code !== 'ur')) {
  assert.equal(lang.isRtl, false, `${lang.code} must be LTR`);
}

// 3. Assert bidirectional number safety validation
const passCheck = validateNumberPreservation(
  'Take 1 tablet 500 mg for 5 days',
  '1 गोली 500 mg 5 दिन तक लें'
);
assert.equal(passCheck.isValid, true, 'Exact matching numbers should pass validation');

const missingCheck = validateNumberPreservation(
  'Take 1 tablet 500 mg for 5 days',
  '1 गोली 500 mg लें'
);
assert.equal(missingCheck.isValid, false, 'Missing duration number 5 must fail validation');
assert.deepEqual(missingCheck.missingNumbers, ['5']);

const extraNumberCheck = validateNumberPreservation(
  'Take 1 tablet 500 mg for 5 days',
  '1 गोली 500 mg 5 दिन तक 2 बार लें'
);
assert.equal(extraNumberCheck.isValid, false, 'Extra hallucinated number 2 must fail validation');
assert.deepEqual(extraNumberCheck.extraNumbers, ['2']);

console.log('All PillSync 7-Language Translation Tests PASSED!');
