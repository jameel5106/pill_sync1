import assert from 'node:assert/strict';
import {
  MEDICINE_FORMS,
  ALL_MEDICINE_FORM_IDS,
  isOralForm,
  isTopicalForm,
  isDropsForm,
  isFoodTimingApplicable,
  normalizeFormId,
  resolveApplicationAreaLabel,
} from '../../config/medicineForms';
import {
  inferFormFromPrescription,
  TOPICAL_BRAND_REFERENCE,
  shouldPromptTopicalCheckForSavedMedicine,
} from '../formInference';
import {
  buildMedicineSentenceFromTemplate,
  buildFormAwareReminderAlertText,
  REVIEW_CARD_LABELS,
  PRESCRIPTION_UI_LABELS,
  toSupportedLang,
} from '../../translations/glossary';
import { SUPPORTED_LANGUAGES } from '../../data/translations';
import { reminderService } from '../reminderService';

console.log('Running PillSync Medicine Form & Topical Handling Tests...');

// 1. Single source of truth checks (21 forms, Lotion present under Topical, 7-language labels)
assert.equal(ALL_MEDICINE_FORM_IDS.length, 21);
const lotionDef = MEDICINE_FORMS.find((f) => f.id === 'lotion');
assert.ok(lotionDef, 'Lotion must exist in MEDICINE_FORMS');
assert.equal(lotionDef?.group, 'topical');
assert.equal(lotionDef?.category, 'topical');
assert.equal(lotionDef?.verb, 'Apply');
assert.equal(lotionDef?.defaultUnit, 'application');
assert.equal(isTopicalForm('lotion'), true);
assert.equal(isOralForm('lotion'), false);
assert.equal(isFoodTimingApplicable('lotion'), false);

for (const formDef of MEDICINE_FORMS) {
  for (const lang of SUPPORTED_LANGUAGES) {
    const lc = toSupportedLang(lang.code);
    assert.ok(
      formDef.label[lc] && formDef.label[lc].trim().length > 0,
      `Missing ${lc} label for form ${formDef.id}`
    );
  }
}

// 2. Topical brand list review tag check
assert.ok(TOPICAL_BRAND_REFERENCE.length >= 10);
for (const entry of TOPICAL_BRAND_REFERENCE) {
  assert.equal(entry.reviewStatus, 'needs pharmacist review');
}

// 3. No default "tablet" for blank/unreadable items
const emptyInferred = inferFormFromPrescription({
  name: 'Unreadable medicine',
  modelForm: null,
  instructions: null,
});
assert.equal(emptyInferred.form, null);
assert.equal(emptyInferred.formCorrected, false);

// 4. Core Lotion bug test: "Lot. Calamine, apply on affected area BD x 5 days"
// Even if AI wrongly guesses "tablet", deterministic inference overrides it to "lotion"
const calamineInferred = inferFormFromPrescription({
  name: 'Lot. Calamine',
  modelForm: 'tablet',
  instructions: 'apply on affected area BD x 5 days',
});
assert.equal(calamineInferred.form, 'lotion');
assert.equal(calamineInferred.formCorrected, true);
assert.equal(calamineInferred.markerFlag, 'form_corrected');
assert.equal(calamineInferred.inferredArea, 'affected_area');

// Plain-language sentence for Lot. Calamine BD x 5 days (must say Apply, thin layer, affected area, NOT tablet or food)
const calamineSentenceEn = buildMedicineSentenceFromTemplate(
  {
    name: 'Calamine',
    form: 'lotion',
    dose: 'Apply a thin layer',
    applicationArea: 'affected_area',
    frequency: 'BD',
    timing: 'after food', // must be suppressed because lotion is non-oral!
    durationDays: 5,
  },
  'en'
);
assert.equal(
  calamineSentenceEn,
  'Apply a thin layer on the affected area twice a day for 5 days.'
);
assert.ok(!/tablet/i.test(calamineSentenceEn));
assert.ok(!/food/i.test(calamineSentenceEn));

// Check 7-language topical sentences keep Latin digits 0-9 and localize cleanly
for (const lang of SUPPORTED_LANGUAGES) {
  const lc = toSupportedLang(lang.code);
  const localizedSentence = buildMedicineSentenceFromTemplate(
    {
      name: 'Calamine',
      form: 'lotion',
      dose: 'Apply a thin layer',
      applicationArea: 'affected_area',
      frequency: 'BD',
      timing: 'after food',
      durationDays: 5,
    },
    lc
  );
  assert.ok(localizedSentence.includes('5'), `Expected Latin digit 5 in ${lc} sentence: ${localizedSentence}`);
  assert.ok(!localizedSentence.toLowerCase().includes('undefined'), `Undefined token in ${lc}: ${localizedSentence}`);
}

// 5. Oral abbreviations and other topical/drops clues
assert.equal(
  inferFormFromPrescription({ name: 'Tab. Paracetamol 500 mg', modelForm: null }).form,
  'tablet'
);
assert.equal(
  inferFormFromPrescription({ name: 'Cap. Omeprazole 20 mg', modelForm: null }).form,
  'capsule'
);
assert.equal(
  inferFormFromPrescription({ name: 'Syp. Ambroxol', modelForm: null, dose: '5 ml' }).form,
  'syrup'
);

const ketoShampoo = inferFormFromPrescription({
  name: 'Ketoconazole shampoo 2%',
  modelForm: 'tablet', // erroneous AI guess
  instructions: 'use twice weekly on scalp',
});
assert.equal(ketoShampoo.form, 'shampoo');
assert.equal(ketoShampoo.formCorrected, true);
assert.equal(ketoShampoo.inferredArea, 'scalp');

const eyeDrop = inferFormFromPrescription({
  name: 'Moxifloxacin',
  modelForm: null,
  instructions: 'Put 2 drops in the left eye twice daily',
});
assert.equal(eyeDrop.form, 'eye_drops');
assert.equal(isDropsForm(eyeDrop.form), true);
assert.equal(isFoodTimingApplicable(eyeDrop.form), false);

const eyeDropSentence = buildMedicineSentenceFromTemplate(
  {
    name: 'Moxifloxacin',
    form: 'eye_drops',
    dose: '2 drops',
    frequency: '1-0-1',
    durationDays: 7,
  },
  'en'
);
assert.ok(eyeDropSentence.startsWith('Put 2 drops in the eye'), `Got: ${eyeDropSentence}`);

// 6. Dual oral + topical forms with no explicit clue stay ambiguous (null -> "Please select the form")
const ambiguousDiclofenac = inferFormFromPrescription({
  name: 'Diclofenac 50 mg',
  modelForm: null,
  instructions: 'twice a day',
});
assert.equal(ambiguousDiclofenac.form, null);
assert.equal(ambiguousDiclofenac.isAmbiguousForm, true);

// When Diclofenac HAS a topical clue ("Diclofenac gel"), it resolves to gel cleanly
const diclofenacGel = inferFormFromPrescription({
  name: 'Diclofenac gel',
  modelForm: 'tablet',
  instructions: 'apply on knee',
});
assert.equal(diclofenacGel.form, 'gel');
assert.equal(diclofenacGel.formCorrected, true);

// 7. Manual edit protection: userEditedForm=true is NEVER overwritten
const userManualPick = inferFormFromPrescription({
  name: 'Diclofenac',
  modelForm: 'lotion',
  instructions: '1 tablet twice daily',
  userEditedForm: true,
});
assert.equal(userManualPick.form, 'lotion');
assert.equal(userManualPick.formCorrected, false);

// 8. Existing saved IndexedDB data check (non-destructive prompt detection)
const legacySavedLotion = {
  form: 'tablet',
  name: 'Calamine',
  instructions: 'apply on affected skin',
};
assert.equal(shouldPromptTopicalCheckForSavedMedicine(legacySavedLotion), true);
assert.equal(legacySavedLotion.form, 'tablet', 'Saved record must NEVER be silently mutated');

assert.equal(
  shouldPromptTopicalCheckForSavedMedicine({
    form: 'tablet',
    name: 'Paracetamol 500 mg',
    instructions: 'after food',
  }),
  false
);
assert.equal(
  shouldPromptTopicalCheckForSavedMedicine({
    form: 'lotion',
    name: 'Calamine',
    instructions: 'apply on skin',
  }),
  false
);

// 9. Reminders & .ics generation for topical medicines
assert.equal(
  buildFormAwareReminderAlertText('Calamine', 'lotion', 'affected_area', 'en'),
  'Time to apply Calamine on affected area.'
);
const ics = reminderService.generateIcsCalendar([
  {
    id: 'rem_test_1',
    medicineId: 'med_test_1',
    prescriptionId: 'rx_test_1',
    userId: 'usr_1',
    profileId: 'prof_1',
    medicineName: 'Calamine Lotion',
    medicineForm: 'lotion',
    applicationArea: 'affected_area',
    doseTime: '08:30',
    foodTiming: 'after food', // even if stale, non-oral suppresses food timing
    remindBeforeMinutes: 0,
    repeatMinutes: 0,
    isActive: true,
    lastStatus: 'pending',
    createdAt: new Date().toISOString(),
  },
]);
assert.ok(ics.includes('SUMMARY:Apply Calamine Lotion'));
assert.ok(ics.includes('DESCRIPTION:Time to apply Calamine Lotion on affected area.'));
assert.ok(!ics.includes('(after food)'), 'Topical ICS must not claim after food');

// 10. All 7 languages have form UI labels & savedWrongFormPrompt
for (const lang of SUPPORTED_LANGUAGES) {
  const lc = toSupportedLang(lang.code);
  assert.ok(REVIEW_CARD_LABELS[lc].notRelatedToFood);
  assert.ok(REVIEW_CARD_LABELS[lc].pleaseSelectForm);
  assert.ok(REVIEW_CARD_LABELS[lc].whereToApply);
  assert.ok(PRESCRIPTION_UI_LABELS[lc].savedWrongFormPrompt);
  assert.ok(resolveApplicationAreaLabel('affected_area', lc));
}

assert.equal(normalizeFormId('Lot.'), 'lotion');

console.log('All PillSync Medicine Form & Topical Handling Tests PASSED!');
