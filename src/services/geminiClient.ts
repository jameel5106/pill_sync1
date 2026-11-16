/**
 * Client service to call the server-side Gemini OCR transcription route (/api/parse-prescription).
 * Returns typed structured prescription result matching PillSync's safety-critical OCR schema.
 * Supports abort signals, transient retries, and honest upload/validation phase callbacks.
 */

import { inferFormFromPrescription } from './formInference';
import { isFoodTimingApplicable } from '../config/medicineForms';

export type PrescriptionFlag =
  | 'name_uncertain'
  | 'strength_uncertain'
  | 'dose_missing'
  | 'frequency_missing'
  | 'duration_missing'
  | 'timing_missing'
  | 'abbreviation_unknown'
  | 'look_alike_risk'
  | 'possible_overwriting'
  | 'handwriting_unclear'
  | 'partly_cut_off'
  | string;

export interface DoseSchedule {
  morning?: number | null;
  afternoon?: number | null;
  night?: number | null;
  bedtime?: number | null;
}

export interface ParsedMedicineItem {
  rawText: string;
  name: string | null;
  nameAsRead?: string | null;
  nameCorrected: boolean;
  genericName?: string | null;
  strength?: string | null;
  form?: string | null;
  applicationArea?: string | null;
  formCorrected?: boolean;
  isAmbiguousForm?: boolean;
  route?: string | null;
  dose?: string | null;
  frequencyCode?: string | null;
  frequencyPlain?: string | null;
  frequency?: string | null;
  doseSchedule?: DoseSchedule | null;
  timesPerDay?: number | null;
  timing?:
    | 'before_food'
    | 'after_food'
    | 'with_food'
    | 'empty_stomach'
    | 'bedtime'
    | 'anytime'
    | string
    | null;
  asNeeded: boolean;
  durationDays?: number | null;
  durationText?: string | null;
  instructions?: string | null;
  confidence: number;
  illegible: boolean;
  flags: PrescriptionFlag[];
}

export interface PrescriptionFollowUp {
  text?: string | null;
  days?: number | null;
}

export interface PrescriptionParseResult {
  isPrescription: boolean;
  imageQuality: 'good' | 'fair' | 'poor' | string;
  warnings: string[];
  doctorName?: string | null;
  clinic?: string | null;
  doctorRegistrationNumber?: string | null;
  patientName?: string | null;
  patientAge?: string | null;
  patientSex?: string | null;
  date?: string | null;
  followUp?: PrescriptionFollowUp | null;
  notes?: string | null;
  medicines: ParsedMedicineItem[];
}

export interface ParsePrescriptionOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  maxAttempts?: number;
  onPhase?: (
    phase: 'sending' | 'awaiting_model' | 'headers_received' | 'validating' | 'validated',
    uploadFraction?: number
  ) => void;
  onRetry?: (attempt: number, maxAttempts: number) => void;
}

export function normalizeTimingValue(rawTiming?: string | null): string {
  if (!rawTiming) return 'unspecified';
  const t = rawTiming.toLowerCase().trim();
  if (t === 'before_food' || t === 'before food') return 'before food';
  if (t === 'after_food' || t === 'after food') return 'after food';
  if (t === 'with_food' || t === 'with food') return 'with food';
  if (t === 'empty_stomach' || t === 'empty stomach') return 'empty stomach';
  if (t === 'bedtime') return 'bedtime';
  if (t === 'anytime') return 'unspecified';
  return rawTiming;
}

function createAbortError(): Error {
  const err = new Error('Request cancelled');
  err.name = 'AbortError';
  return err;
}

function sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(createAbortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function sendXhrParseRequest(
  payload: string,
  timeoutMs: number,
  options?: ParsePrescriptionOptions
): Promise<{ status: number; bodyText: string }> {
  return new Promise((resolve, reject) => {
    const signal = options?.signal;
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/parse-prescription', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = timeoutMs;

    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      xhr.abort();
      cleanup();
      reject(createAbortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    let headersNotified = false;
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && evt.total > 0) {
        options?.onPhase?.('sending', evt.loaded / evt.total);
      }
    };
    xhr.upload.onload = () => {
      options?.onPhase?.('sending', 1);
      options?.onPhase?.('awaiting_model', 1);
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED && !headersNotified) {
        headersNotified = true;
        options?.onPhase?.('headers_received', 1);
      }
    };

    xhr.onload = () => {
      cleanup();
      resolve({ status: xhr.status, bodyText: xhr.responseText });
    };

    xhr.onerror = () => {
      cleanup();
      const netErr: any = new Error('Network error while connecting to PillSync service.');
      netErr.retryable = true;
      reject(netErr);
    };

    xhr.ontimeout = () => {
      cleanup();
      const toErr: any = new Error('The request timed out while reading handwriting.');
      toErr.retryable = true;
      reject(toErr);
    };

    options?.onPhase?.('sending', 0);
    xhr.send(payload);
  });
}

export async function parsePrescriptionWithGemini(
  imageBase64: string,
  mimeType = 'image/jpeg',
  options?: ParsePrescriptionOptions
): Promise<PrescriptionParseResult> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const timeoutMs = options?.timeoutMs ?? 45000;
  const payload = JSON.stringify({ imageBase64, mimeType });

  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (options?.signal?.aborted) {
      throw createAbortError();
    }

    if (attempt > 1) {
      options?.onRetry?.(attempt, maxAttempts);
    }

    try {
      const { status, bodyText } = await sendXhrParseRequest(payload, timeoutMs, options);

      let parsedJson: any = null;
      try {
        parsedJson = JSON.parse(bodyText);
      } catch {
        // leave null
      }

      const isTransientStatus = status === 429 || status === 502 || status === 503 || status === 504;
      if (status < 200 || status >= 300) {
        const msg = parsedJson?.error || `Server error ${status}`;
        const err: any = new Error(msg);
        err.retryable = isTransientStatus;
        throw err;
      }

      // Response arrived: run JSON & safety validation
      options?.onPhase?.('validating');

      if (!parsedJson || !parsedJson.success || !parsedJson.data) {
        throw new Error(parsedJson?.error || 'Invalid transcription format received.');
      }

      const data = parsedJson.data as PrescriptionParseResult;
      if (typeof data.isPrescription !== 'boolean' || !Array.isArray(data.medicines)) {
        throw new Error('Transcription validation failed: incomplete prescription structure.');
      }

      data.warnings = Array.isArray(data.warnings) ? data.warnings : [];
      data.medicines = data.medicines.map((m) => {
        const inferred = inferFormFromPrescription({
          name: m.name,
          genericName: m.genericName,
          rawText: m.rawText,
          instructions: m.instructions,
          dose: m.dose,
          route: m.route,
          modelForm: m.form,
        });
        const baseFlags = Array.isArray(m.flags) ? [...m.flags] : [];
        if (inferred.markerFlag && !baseFlags.includes(inferred.markerFlag)) {
          baseFlags.push(inferred.markerFlag);
        }
        const resolvedTiming =
          inferred.form && !isFoodTimingApplicable(inferred.form) ? 'unspecified' : m.timing;

        return {
          ...m,
          form: inferred.form,
          applicationArea: inferred.inferredArea || m.applicationArea || null,
          formCorrected: inferred.formCorrected,
          isAmbiguousForm: inferred.isAmbiguousForm,
          timing: resolvedTiming,
          frequency: m.frequencyCode || m.frequency || null,
          flags: baseFlags,
          nameCorrected: !!m.nameCorrected,
          asNeeded: !!m.asNeeded,
          illegible: !!m.illegible,
          confidence: typeof m.confidence === 'number' ? m.confidence : 0.5,
        };
      });

      options?.onPhase?.('validated');
      return data;
    } catch (err: any) {
      if (err?.name === 'AbortError' || options?.signal?.aborted) {
        throw err;
      }
      lastError = err;

      if (attempt < maxAttempts && err?.retryable) {
        await sleepAbortable(1000, options?.signal);
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('Failed to read prescription.');
}

export async function suggestFoodTimingWithGemini(
  medicineName: string,
  genericName?: string | null,
  signal?: AbortSignal
): Promise<string | null> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;
  try {
    const res = await fetch('/api/suggest-food-timing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ medicineName, genericName }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.foodTiming;
    if (!raw || typeof raw !== 'string') return null;
    if (raw === 'anytime') return 'unspecified';
    return normalizeTimingValue(raw);
  } catch {
    return null;
  }
}
