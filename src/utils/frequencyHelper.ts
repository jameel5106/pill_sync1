/**
 * Shared frequency normalization, dose-chip parsing, unit pluralization, and
 * plain-language sentence builder across Review, Today, Reminders, and Translations.
 */
import type { DoseSchedule } from '../services/geminiClient';
import { getMedicineFormDef, isFoodTimingApplicable, normalizeFormId } from '../config/medicineForms';

export type SupportedLang = 'en' | 'hi' | 'ur' | 'te' | 'bn' | 'mr' | 'ta';

export const STEPPER_VALUES = [0, 0.5, 1, 1.5, 2, 3] as const;

export type FrequencySpecialCode = 'bd' | 'tds' | 'qid' | 'hs' | 'sos' | 'stat' | null;

export interface NormalizedFrequency {
  schedule: {
    morning: number;
    afternoon: number;
    night: number;
    bedtime: number;
  };
  specialCode: FrequencySpecialCode;
  everyHours: number | null;
  canonicalCode: string; // e.g. "1-0-1", "0-0-1", "BD", "q8h", "SOS"
  isOnceDailyUnspecifiedTime: boolean;
  isValid: boolean;
}

function snapToStepper(val: number): number {
  if (!Number.isFinite(val) || val <= 0) return 0;
  // Preserve valid fractional/integer quantities; clamp reasonable range
  return Math.round(val * 100) / 100;
}

/**
 * Normalizes handwritten frequency variants before display/editing:
 * - "o", "O", "-", "--", "---" -> 0
 * - "(N)", "(night)" -> night slot
 * Examples:
 * - "o --- 1 (N)" -> 0-0-1 (night = 1)
 * - "O--1(N)"     -> 0-0-1 (night = 1)
 * - "1-o-1"       -> 1-0-1
 * - "0-1 (N)"     -> 0-0-1
 * - "--1"         -> 0-0-1
 * - "2-0-1"       -> morning=2, afternoon=0, night=1
 */
export function normalizeHandwritingFrequency(
  rawInput?: string | null,
  existingSchedule?: DoseSchedule | null,
  asNeeded = false
): NormalizedFrequency {
  const schedule = {
    morning: snapToStepper(existingSchedule?.morning ?? 0),
    afternoon: snapToStepper(existingSchedule?.afternoon ?? 0),
    night: snapToStepper(existingSchedule?.night ?? 0),
    bedtime: snapToStepper(existingSchedule?.bedtime ?? 0),
  };
  const hasScheduleSlots =
    schedule.morning > 0 || schedule.afternoon > 0 || schedule.night > 0 || schedule.bedtime > 0;

  const raw = (rawInput || '').trim();
  const hasNightMarker = /\(\s*n\s*\)|\(\s*night\s*\)|\bnocte\b|\bnight\b/i.test(raw);
  const hasMorningMarker = /\(\s*m\s*\)|\bmane\b|\bmorning\b/i.test(raw);
  const hasAfternoonMarker = /\(\s*a\s*\)|\bafternoon\b|\bnoon\b/i.test(raw);
  const hasBedtimeMarker = /\(\s*b\s*\)|\bhs\b|\bbedtime\b/i.test(raw);

  // Strip markers like (N), (M), (night) cleanly for numeric pattern inspection
  const stripped = raw
    .replace(/\(\s*(n|night|m|morning|a|afternoon|b|bedtime)\s*\)/gi, ' ')
    .trim();

  const lower = stripped.toLowerCase();

  // Check asNeeded / SOS / PRN
  if (asNeeded || /^(sos|prn|as needed|when needed|if needed|only when needed)$/i.test(lower)) {
    return {
      schedule: { morning: 0, afternoon: 0, night: 0, bedtime: 0 },
      specialCode: 'sos',
      everyHours: null,
      canonicalCode: 'SOS',
      isOnceDailyUnspecifiedTime: false,
      isValid: true,
    };
  }

  // Check q<N>h / every N hours
  const qhMatch = lower.match(/^q\s*(\d+)\s*h$/i) || lower.match(/^every\s+(\d+)\s+hours?$/i);
  if (qhMatch) {
    const hrs = parseInt(qhMatch[1], 10);
    if (hrs > 0 && hrs <= 72) {
      return {
        schedule: { morning: 0, afternoon: 0, night: 0, bedtime: 0 },
        specialCode: null,
        everyHours: hrs,
        canonicalCode: `q${hrs}h`,
        isOnceDailyUnspecifiedTime: false,
        isValid: true,
      };
    }
  }

  // Check standard abbreviations
  if (/^(stat|once now|right away|immediately)$/i.test(lower)) {
    return {
      schedule: { morning: 0, afternoon: 0, night: 0, bedtime: 0 },
      specialCode: 'stat',
      everyHours: null,
      canonicalCode: 'stat',
      isOnceDailyUnspecifiedTime: false,
      isValid: true,
    };
  }

  if (/^(hs|at bedtime|bedtime|nocte)$/i.test(lower)) {
    return {
      schedule: { morning: 0, afternoon: 0, night: 0, bedtime: 1 },
      specialCode: 'hs',
      everyHours: null,
      canonicalCode: '0-0-0-1',
      isOnceDailyUnspecifiedTime: false,
      isValid: true,
    };
  }

  if (/^(bd|bid|twice a day|twice daily)$/i.test(lower)) {
    return {
      schedule: hasScheduleSlots ? schedule : { morning: 1, afternoon: 0, night: 1, bedtime: 0 },
      specialCode: 'bd',
      everyHours: null,
      canonicalCode: 'BD',
      isOnceDailyUnspecifiedTime: false,
      isValid: true,
    };
  }

  if (/^(tds|tid|three times a day|thrice daily)$/i.test(lower)) {
    return {
      schedule: hasScheduleSlots ? schedule : { morning: 1, afternoon: 1, night: 1, bedtime: 0 },
      specialCode: 'tds',
      everyHours: null,
      canonicalCode: 'TDS',
      isOnceDailyUnspecifiedTime: false,
      isValid: true,
    };
  }

  if (/^(qid|four times a day)$/i.test(lower)) {
    return {
      schedule: hasScheduleSlots ? schedule : { morning: 1, afternoon: 1, night: 1, bedtime: 1 },
      specialCode: 'qid',
      everyHours: null,
      canonicalCode: 'QID',
      isOnceDailyUnspecifiedTime: false,
      isValid: true,
    };
  }

  if (/^(od|qd|once a day|once daily|daily)$/i.test(lower)) {
    if (hasNightMarker) {
      return {
        schedule: { morning: 0, afternoon: 0, night: 1, bedtime: 0 },
        specialCode: null,
        everyHours: null,
        canonicalCode: '0-0-1',
        isOnceDailyUnspecifiedTime: false,
        isValid: true,
      };
    }
    if (hasBedtimeMarker) {
      return {
        schedule: { morning: 0, afternoon: 0, night: 0, bedtime: 1 },
        specialCode: 'hs',
        everyHours: null,
        canonicalCode: '0-0-0-1',
        isOnceDailyUnspecifiedTime: false,
        isValid: true,
      };
    }
    if (hasAfternoonMarker) {
      return {
        schedule: { morning: 0, afternoon: 1, night: 0, bedtime: 0 },
        specialCode: null,
        everyHours: null,
        canonicalCode: '0-1-0',
        isOnceDailyUnspecifiedTime: false,
        isValid: true,
      };
    }
    return {
      schedule: hasScheduleSlots ? schedule : { morning: 1, afternoon: 0, night: 0, bedtime: 0 },
      specialCode: null,
      everyHours: null,
      canonicalCode: hasScheduleSlots
        ? scheduleToCode(schedule)
        : '1-0-0',
      // "OD"/"once a day" had no time of day specified on the Rx unless already assigned
      isOnceDailyUnspecifiedTime: true,
      isValid: true,
    };
  }

  if (/^morning$/i.test(lower)) {
    return {
      schedule: { morning: 1, afternoon: 0, night: 0, bedtime: 0 },
      specialCode: null,
      everyHours: null,
      canonicalCode: '1-0-0',
      isOnceDailyUnspecifiedTime: false,
      isValid: true,
    };
  }
  if (/^afternoon$/i.test(lower)) {
    return {
      schedule: { morning: 0, afternoon: 1, night: 0, bedtime: 0 },
      specialCode: null,
      everyHours: null,
      canonicalCode: '0-1-0',
      isOnceDailyUnspecifiedTime: false,
      isValid: true,
    };
  }
  if (/^night$/i.test(lower)) {
    return {
      schedule: { morning: 0, afternoon: 0, night: 1, bedtime: 0 },
      specialCode: null,
      everyHours: null,
      canonicalCode: '0-0-1',
      isOnceDailyUnspecifiedTime: false,
      isValid: true,
    };
  }

  // Parse numeric / handwriting dash-and-O patterns like:
  // "o --- 1 (N)", "O - 0 - 1", "1-o-1", "--1", "0-1 (N)", "1-1-1-1", "2-0-1"
  const slotParsed = parseDashAndZeroTokens(stripped, {
    hasNightMarker,
    hasMorningMarker,
    hasAfternoonMarker,
    hasBedtimeMarker,
  });

  if (slotParsed) {
    return {
      schedule: slotParsed,
      specialCode: null,
      everyHours: null,
      canonicalCode: scheduleToCode(slotParsed),
      isOnceDailyUnspecifiedTime: false,
      isValid: true,
    };
  }

  // Fall back to existingSchedule if provided (e.g. from Gemini structured output)
  if (!raw && hasScheduleSlots) {
    return {
      schedule,
      specialCode: null,
      everyHours: null,
      canonicalCode: scheduleToCode(schedule),
      isOnceDailyUnspecifiedTime: false,
      isValid: true,
    };
  }

  if (!raw) {
    return {
      schedule,
      specialCode: null,
      everyHours: null,
      canonicalCode: '',
      isOnceDailyUnspecifiedTime: false,
      isValid: true,
    };
  }

  return {
    schedule: hasScheduleSlots ? schedule : { morning: 0, afternoon: 0, night: 0, bedtime: 0 },
    specialCode: null,
    everyHours: null,
    canonicalCode: raw,
    isOnceDailyUnspecifiedTime: false,
    isValid: false,
  };
}

function parseDashAndZeroTokens(
  stripped: string,
  markers: {
    hasNightMarker: boolean;
    hasMorningMarker: boolean;
    hasAfternoonMarker: boolean;
    hasBedtimeMarker: boolean;
  }
): { morning: number; afternoon: number; night: number; bedtime: number } | null {
  if (!stripped) return null;

  // Reject clearly non-pattern words (only digits, o/O, decimal dot, slash, whitespace, dashes allowed)
  if (/[^0-9oO.\s\-\/]/.test(stripped)) {
    return null;
  }

  // Replace standalone o/O with 0
  let s = stripped.replace(/\bo\b/gi, '0');

  // Step 1: Compact separator spaces around dashes vs standalone dash groups
  // Handle patterns like "o --- 1" (spaced multi-dashes meaning zero slots):
  // Split on whitespace first if whitespace separates tokens
  if (/\s/.test(s)) {
    const rawParts = s.split(/\s+/).filter(Boolean);
    const expanded: number[] = [];

    for (const part of rawParts) {
      if (/^[-]+$/.test(part)) {
        // Standalone dash token in spaced form:
        // "-" is a separator between tokens (ignore if already between two tokens? Wait: "o - 1 - 1" vs "o --- 1")
        // Multiple dashes "---" or "--" as an isolated word mean 0 placeholder(s) unless single "-"
        if (part.length >= 2) {
          expanded.push(0);
        }
        continue;
      }
      // Sub-split attached dashes like "1-0-1" or "--1"
      const subParsed = parseCompactDashToken(part);
      if (!subParsed) return null;
      expanded.push(...subParsed);
    }

    return mapSlotsToSchedule(expanded, markers);
  }

  // Compact token with no spaces, e.g. "1-0-1", "1--1", "o--1", "--1", "1-1-1-1", "0-1"
  const compactSlots = parseCompactDashToken(s);
  if (!compactSlots) return null;
  return mapSlotsToSchedule(compactSlots, markers);
}

function parseCompactDashToken(token: string): number[] | null {
  // Accept fractional/integer numbers and dashes, converting o/O -> 0
  const normalized = token.replace(/[oO]/g, '0');
  if (!/^[0-9.\-\/]+$/.test(normalized)) return null;

  // If pure number without dashes (only valid when part of multi-token or single digit if marked)
  if (!normalized.includes('-') && !normalized.includes('/')) {
    const num = parseFloat(normalized);
    if (!Number.isFinite(num)) return null;
    return [snapToStepper(num)];
  }

  // Replace '/' separator with '-'
  const unified = normalized.replace(/\//g, '-');
  // Split preserving empty gaps from consecutive dashes:
  // Leading "-1" -> ['', '1'] -> 0, 1
  // Double dash "1--1" -> ['1', '', '1'] -> 1, 0, 1
  // Triple dash "---1" -> ['', '', '', '1'] -> 0, 0, 1 (clamp empty slots sensibly)
  const pieces = unified.split('-');
  const slots: number[] = [];

  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (p === '') {
      // Collapse >2 consecutive dashes inside/leading appropriately if needed
      slots.push(0);
    } else {
      const val = parseFloat(p);
      if (!Number.isFinite(val)) return null;
      slots.push(snapToStepper(val));
    }
  }

  // Cap accidental extra zero from leading triple dash like "---1" (['','','','1'] -> 4 items ending in 1 -> reduce leading zeros to 3 slots)
  while (slots.length > 4 && slots[0] === 0) {
    slots.shift();
  }

  return slots;
}

function mapSlotsToSchedule(
  slots: number[],
  markers: {
    hasNightMarker: boolean;
    hasMorningMarker: boolean;
    hasAfternoonMarker: boolean;
    hasBedtimeMarker: boolean;
  }
): { morning: number; afternoon: number; night: number; bedtime: number } | null {
  if (slots.length === 1) {
    const qty = slots[0];
    if (qty <= 0) return null;
    if (markers.hasBedtimeMarker) return { morning: 0, afternoon: 0, night: 0, bedtime: qty };
    if (markers.hasNightMarker) return { morning: 0, afternoon: 0, night: qty, bedtime: 0 };
    if (markers.hasAfternoonMarker) return { morning: 0, afternoon: qty, night: 0, bedtime: 0 };
    if (markers.hasMorningMarker) return { morning: qty, afternoon: 0, night: 0, bedtime: 0 };
    return null;
  }

  if (slots.length === 2) {
    // Two-number pattern like "0-1 (N)" means 0 morning, 0 afternoon, 1 night
    if (markers.hasBedtimeMarker) {
      return { morning: slots[0], afternoon: 0, night: 0, bedtime: slots[1] };
    }
    if (markers.hasNightMarker || slots[0] === 0) {
      return { morning: slots[0], afternoon: 0, night: slots[1], bedtime: 0 };
    }
    return { morning: slots[0], afternoon: 0, night: slots[1], bedtime: 0 };
  }

  if (slots.length === 3) {
    return {
      morning: slots[0],
      afternoon: slots[1],
      night: slots[2],
      bedtime: 0,
    };
  }

  if (slots.length === 4) {
    return {
      morning: slots[0],
      afternoon: slots[1],
      night: slots[2],
      bedtime: slots[3],
    };
  }

  return null;
}

export function scheduleToCode(schedule: {
  morning: number;
  afternoon: number;
  night: number;
  bedtime: number;
}): string {
  if (schedule.bedtime > 0) {
    return `${schedule.morning}-${schedule.afternoon}-${schedule.night}-${schedule.bedtime}`;
  }
  return `${schedule.morning}-${schedule.afternoon}-${schedule.night}`;
}

export interface UnitLabel {
  singular: string;
  plural: string;
}

/**
 * Extracts and pluralizes unit from medicine form/dose using medicineForms.ts.
 * Never defaults to "tablet" for non-oral or empty forms unless "tab"/"tablet" is explicit.
 */
export function resolveEnglishUnit(formRaw?: string | null, doseRaw?: string | null): UnitLabel {
  const d = (doseRaw || '').toLowerCase();
  const f = (formRaw || '').toLowerCase();
  const def = getMedicineFormDef(formRaw);

  if (/\bml\b/.test(d)) {
    return { singular: 'ml', plural: 'ml' };
  }
  if (/\bpuffs?\b/.test(d)) {
    return { singular: 'puff', plural: 'puffs' };
  }
  if (/\bdrops?\b/.test(d)) {
    return { singular: 'drop', plural: 'drops' };
  }
  if (/\bsachets?\b/.test(d)) {
    return { singular: 'sachet', plural: 'sachets' };
  }
  if (/\bpatch(?:es)?\b/.test(d)) {
    return { singular: 'patch', plural: 'patches' };
  }
  if (/\bcapsules?\b/.test(d)) {
    return { singular: 'capsule', plural: 'capsules' };
  }
  if (/\btablets?\b/.test(d)) {
    return { singular: 'tablet', plural: 'tablets' };
  }

  if (def) {
    switch (def.defaultUnit) {
      case 'ml':
        return { singular: 'ml', plural: 'ml' };
      case 'puff':
        return { singular: 'puff', plural: 'puffs' };
      case 'drop':
        return { singular: 'drop', plural: 'drops' };
      case 'capsule':
        return { singular: 'capsule', plural: 'capsules' };
      case 'injection':
        return { singular: 'injection', plural: 'injections' };
      case 'application':
        return { singular: 'application', plural: 'applications' };
      case 'patch':
        return { singular: 'patch', plural: 'patches' };
      case 'sachet':
        return { singular: 'sachet', plural: 'sachets' };
      case 'lozenge':
        return { singular: 'lozenge', plural: 'lozenges' };
      case 'suppository':
        return { singular: 'suppository', plural: 'suppositories' };
      case 'tablet':
        return { singular: 'tablet', plural: 'tablets' };
      case 'dose':
      default:
        return { singular: 'dose', plural: 'doses' };
    }
  }

  if (f.includes('drop')) return { singular: 'drop', plural: 'drops' };
  if (f.includes('cap')) return { singular: 'capsule', plural: 'capsules' };
  if (f.includes('tab')) return { singular: 'tablet', plural: 'tablets' };
  if (f.includes('syr') || f.includes('susp')) return { singular: 'ml', plural: 'ml' };
  if (f.includes('inhal')) return { singular: 'puff', plural: 'puffs' };
  if (f.includes('inj')) return { singular: 'injection', plural: 'injections' };
  if (f.includes('powder') || f.includes('sachet')) return { singular: 'sachet', plural: 'sachets' };
  if (f.includes('lot') || f.includes('cream') || f.includes('oint') || f.includes('gel') || f.includes('shamp') || f.includes('spray') || f.includes('sol')) {
    return { singular: 'application', plural: 'applications' };
  }

  return { singular: 'dose', plural: 'doses' };
}

export function formatEnglishQtyWithUnit(qty: number, unit: UnitLabel): string {
  const numStr = Number.isInteger(qty) ? String(qty) : String(qty);
  if (unit.singular === 'ml') {
    return `${numStr} ml`;
  }
  const word = qty === 1 || qty === 0.5 ? unit.singular : unit.plural;
  return `${numStr} ${word}`;
}

/**
 * Builds the exact readable English frequency sentence requested:
 * - 1-0-0 -> "Once a day, in the morning"
 * - 0-1-0 -> "Once a day, in the afternoon"
 * - 0-0-1 -> "Once a day, at night"
 * - 1-0-1 -> "Twice a day: morning and night"
 * - 1-1-1 -> "Three times a day: morning, afternoon, and night"
 * - 2-0-1 -> "2 tablets in the morning and 1 at night"
 * - BD -> "Twice a day", TDS -> "Three times a day", QID -> "Four times a day"
 * - HS -> "At bedtime", SOS/PRN -> "Only when needed", q8h -> "Every 8 hours", stat -> "One time, right away"
 */
export function buildEnglishFrequencySentence(
  normalized: NormalizedFrequency,
  form?: string | null,
  dose?: string | null
): string {
  if (normalized.specialCode === 'sos') {
    return 'Only when needed';
  }
  if (normalized.specialCode === 'stat') {
    return 'One time, right away';
  }
  if (normalized.everyHours) {
    return `Every ${normalized.everyHours} hour${normalized.everyHours === 1 ? '' : 's'}`;
  }

  const { morning: m, afternoon: a, night: n, bedtime: b } = normalized.schedule;
  const activeCount = [m, a, n, b].filter((v) => v > 0).length;

  // Abbreviations when user typed/parsed BD/TDS/QID/HS
  if (normalized.specialCode === 'hs' && b === 1 && m === 0 && a === 0 && n === 0) {
    return 'At bedtime';
  }
  if (normalized.specialCode === 'bd' && activeCount === 2 && m === 1 && n === 1 && a === 0 && b === 0) {
    return 'Twice a day';
  }
  if (normalized.specialCode === 'tds' && activeCount === 3 && m === 1 && a === 1 && n === 1 && b === 0) {
    return 'Three times a day';
  }
  if (normalized.specialCode === 'qid' && activeCount === 4 && m === 1 && a === 1 && n === 1 && b === 1) {
    return 'Four times a day';
  }

  if (activeCount === 0) {
    return 'No times selected';
  }

  const unit = resolveEnglishUnit(form, dose);

  // Exact single-unit standard 1-per-slot cases
  if (m === 1 && a === 0 && n === 0 && b === 0) {
    return 'Once a day, in the morning';
  }
  if (m === 0 && a === 1 && n === 0 && b === 0) {
    return 'Once a day, in the afternoon';
  }
  if (m === 0 && a === 0 && n === 1 && b === 0) {
    return 'Once a day, at night';
  }
  if (m === 0 && a === 0 && n === 0 && b === 1) {
    return 'At bedtime';
  }
  if (m === 1 && a === 0 && n === 1 && b === 0) {
    return 'Twice a day: morning and night';
  }
  if (m === 1 && a === 1 && n === 1 && b === 0) {
    return 'Three times a day: morning, afternoon, and night';
  }
  if (m === 1 && a === 1 && n === 1 && b === 1) {
    return 'Four times a day';
  }

  // Varying or multi-unit doses e.g. 2-0-1 -> "2 tablets in the morning and 1 at night"
  const slotLabels: { qty: number; phrase: string }[] = [];
  if (m > 0) slotLabels.push({ qty: m, phrase: 'in the morning' });
  if (a > 0) slotLabels.push({ qty: a, phrase: 'in the afternoon' });
  if (n > 0) slotLabels.push({ qty: n, phrase: 'at night' });
  if (b > 0) slotLabels.push({ qty: b, phrase: 'at bedtime' });

  const formId = normalizeFormId(form);
  const isTopicalCat = formId ? !isFoodTimingApplicable(formId) && unit.singular === 'application' : false;

  const segments = slotLabels.map((item, idx) => {
    if (isTopicalCat) {
      return `${item.qty} time${item.qty === 1 ? '' : 's'} ${item.phrase}`;
    }
    const qtyPart = idx === 0 ? formatEnglishQtyWithUnit(item.qty, unit) : String(item.qty);
    return `${qtyPart} ${item.phrase}`;
  });

  if (segments.length === 1) {
    return `${segments[0]}`;
  }
  if (segments.length === 2) {
    return `${segments[0]} and ${segments[1]}`;
  }
  const head = segments.slice(0, -1).join(', ');
  return `${head}, and ${segments[segments.length - 1]}`;
}
