import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, AlertTriangle, RefreshCw, Loader2, Sparkles, Clock } from 'lucide-react';
import { LanguageConfig } from '../data/translations';

export type HonestProgressStatus = 'running' | 'slow' | 'retrying' | 'error' | 'complete';

export interface HonestProgressScreenProps {
  title: string;
  subtitle: string;
  progress: number; // 0 to 100
  steps: string[];
  currentStepIndex: number; // 0-indexed
  status: HonestProgressStatus;
  errorMessage?: string;
  thumbnailBase64?: string;
  tips?: string[];
  language: LanguageConfig;
  isLargeText?: boolean;
  compact?: boolean;
  cancelLabel: string;
  retryLabel?: string;
  enterManuallyLabel?: string;
  saveForLaterLabel?: string;
  onCancel?: () => void;
  onRetry?: () => void;
  onEnterManually?: () => void;
  onSaveForLater?: () => void;
}

export const HonestProgressScreen: React.FC<HonestProgressScreenProps> = ({
  title,
  subtitle,
  progress,
  steps,
  currentStepIndex,
  status,
  errorMessage,
  thumbnailBase64,
  tips = [],
  language,
  isLargeText = false,
  compact = false,
  cancelLabel,
  retryLabel = 'Retry',
  enterManuallyLabel = 'Enter manually',
  saveForLaterLabel = 'Save and read later',
  onCancel,
  onRetry,
  onEnterManually,
  onSaveForLater,
}) => {
  const [tipIndex, setTipIndex] = useState(0);
  const [tipVisible, setTipVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  const isRtl = language.isRtl;
  const isError = status === 'error';
  const isComplete = status === 'complete';
  const isRetrying = status === 'retrying';

  // Observe prefers-reduced-motion media query
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Rotating helpful tips every 4 seconds with gentle opacity fade
  useEffect(() => {
    if (!tips || tips.length <= 1 || isError || isComplete) return;
    let fadeTimeout: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      if (reducedMotion) {
        setTipIndex((prev) => (prev + 1) % tips.length);
      } else {
        setTipVisible(false);
        fadeTimeout = setTimeout(() => {
          setTipIndex((prev) => (prev + 1) % tips.length);
          setTipVisible(true);
        }, 200);
      }
    }, 4000);
    return () => {
      clearInterval(interval);
      if (fadeTimeout) clearTimeout(fadeTimeout);
    };
  }, [tips, isError, isComplete, reducedMotion]);

  // Clamp progress & quantize slightly in reduced motion mode
  const clamped = Math.max(0, Math.min(100, progress));
  const roundedPercent = Math.round(clamped);
  const steppedPercent = reducedMotion ? Math.round(roundedPercent / 5) * 5 : roundedPercent;
  const displayPercent = isComplete ? 100 : steppedPercent;

  // Compositor-only transform: fills from left in LTR, from right in RTL
  const fillTranslatePercent = isRtl ? 100 - displayPercent : displayPercent - 100;

  const currentStepLabel =
    isComplete
      ? subtitle
      : isError
      ? errorMessage || subtitle
      : steps[Math.min(Math.max(0, currentStepIndex), steps.length - 1)] || subtitle;

  // Announce ONLY step/status changes in aria-live="polite" (never every 1%)
  const liveAnnouncement = isError
    ? `${subtitle}. ${errorMessage || ''}`
    : isComplete
    ? `${title} ${subtitle}`
    : isRetrying
    ? subtitle
    : steps[currentStepIndex] || subtitle;

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{ fontFamily: language.fontFamily }}
      className={
        compact
          ? 'w-full bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4'
          : 'flex-1 min-h-full bg-white flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto'
      }
    >
      {/* Screen reader polite region: announces step & state transitions only */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      <div
        className={
          compact
            ? 'w-full space-y-4'
            : 'w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5'
        }
      >
        {/* Top Visual: 96px captured prescription thumbnail with soft green scan line, or translation emblem */}
        <div className="flex flex-col items-center text-center space-y-3">
          {thumbnailBase64 ? (
            <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 shadow-xs shrink-0">
              <img
                src={thumbnailBase64}
                alt="Captured prescription"
                className="w-full h-full object-cover"
              />
              {/* Soft green scanning line moving up and down via transform + opacity */}
              {!isError && !isComplete && !reducedMotion && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-transparent via-[#2E9E6B] to-transparent shadow-[0_0_10px_rgba(46,158,107,0.85)] animate-ps-scan"
                />
              )}
              {isComplete && (
                <div className="absolute inset-0 bg-[#2E9E6B]/20 flex items-center justify-center">
                  <div className="w-9 h-9 rounded-full bg-[#2E9E6B] text-white flex items-center justify-center shadow-sm">
                    <Check className="w-5 h-5" />
                  </div>
                </div>
              )}
              {isError && (
                <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                  <div className="w-9 h-9 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-sm">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                isError
                  ? 'bg-amber-50 text-amber-600 border border-amber-200'
                  : isComplete
                  ? 'bg-emerald-50 text-[#2E9E6B] border border-emerald-200'
                  : 'bg-blue-50 text-[#1E88E5] border border-blue-200'
              }`}
            >
              {isError ? (
                <AlertTriangle className="w-7 h-7" />
              ) : isComplete ? (
                <CheckCircle2 className="w-7 h-7" />
              ) : (
                <Sparkles className="w-6 h-6" />
              )}
            </div>
          )}

          {/* Title & One-Line Plain Subtitle */}
          <div className="space-y-1 max-w-sm">
            <h2
              className={`font-bold text-slate-900 leading-snug ${
                isLargeText ? 'text-xl' : 'text-lg'
              }`}
            >
              {title}
            </h2>
            <p
              className={`leading-snug flex items-center justify-center gap-1.5 ${
                isLargeText ? 'text-sm' : 'text-xs'
              } ${
                isError
                  ? 'text-amber-800 font-semibold'
                  : isRetrying
                  ? 'text-amber-700 font-semibold'
                  : isComplete
                  ? 'text-[#2E9E6B] font-semibold'
                  : 'text-slate-600'
              }`}
            >
              {isRetrying && (
                <span
                  aria-hidden="true"
                  className="w-2 h-2 rounded-full bg-amber-500 shrink-0 inline-block"
                />
              )}
              <span>{subtitle}</span>
            </p>
          </div>
        </div>

        {/* 12px Rounded Progress Bar + Bold Percentage */}
        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-valuenow={displayPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={currentStepLabel}
            className="flex-1 h-3 bg-slate-100 border border-slate-200/80 rounded-full overflow-hidden relative"
          >
            <div
              className={`w-full h-full rounded-full relative overflow-hidden ${
                reducedMotion ? '' : 'transition-transform duration-150 ease-out'
              } ${
                isError
                  ? 'bg-amber-500'
                  : isRtl
                  ? 'bg-gradient-to-l from-[#1E88E5] to-[#2E9E6B]'
                  : 'bg-gradient-to-r from-[#1E88E5] to-[#2E9E6B]'
              }`}
              style={{
                transform: `translateX(${fillTranslatePercent}%)`,
                willChange: 'transform',
              }}
            >
              {/* Subtle moving shimmer on filled portion; paused on retry, error, complete, or reduced motion */}
              {!isError && !isComplete && !isRetrying && !reducedMotion && (
                <div
                  aria-hidden="true"
                  className={`absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent ${
                    isRtl ? 'animate-ps-shimmer-rtl' : 'animate-ps-shimmer-ltr'
                  }`}
                />
              )}
            </div>
          </div>

          <span
            dir="ltr"
            className={`font-bold tabular-nums shrink-0 min-w-[3ch] text-right ${
              isLargeText ? 'text-base' : 'text-sm'
            } ${isError ? 'text-amber-700' : isComplete ? 'text-[#2E9E6B]' : 'text-slate-900'}`}
          >
            {displayPercent}%
          </span>
        </div>

        {/* Vertical Step Checklist */}
        <ul className="space-y-2.5 pt-1" aria-label={title}>
          {steps.map((stepLabel, idx) => {
            const stepDone = isComplete || idx < currentStepIndex;
            const stepCurrent = !isComplete && !isError && idx === currentStepIndex;
            return (
              <li key={idx} className="flex items-center gap-3">
                {stepDone ? (
                  <span className="w-5 h-5 rounded-full bg-[#2E9E6B]/15 text-[#2E9E6B] flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" strokeWidth={2.75} />
                  </span>
                ) : stepCurrent ? (
                  <span className="w-5 h-5 rounded-full bg-blue-50 text-[#1E88E5] flex items-center justify-center shrink-0">
                    <Loader2
                      className={`w-3.5 h-3.5 ${reducedMotion ? '' : 'animate-spin'}`}
                    />
                  </span>
                ) : (
                  <span className="w-5 h-5 rounded-full border border-slate-300 bg-white shrink-0" />
                )}

                <span
                  className={`leading-snug ${isLargeText ? 'text-sm' : 'text-xs'} ${
                    stepDone
                      ? 'text-slate-800 font-semibold'
                      : stepCurrent
                      ? isError
                        ? 'text-amber-800 font-bold'
                        : 'text-[#1E88E5] font-bold'
                      : 'text-slate-400 font-medium'
                  }`}
                >
                  {stepLabel}
                </span>
              </li>
            );
          })}
        </ul>

        {/* Error Box & Recovery Buttons */}
        {isError ? (
          <div className="space-y-3 pt-1">
            {errorMessage && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 leading-relaxed">
                {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="w-full min-h-[44px] px-4 py-2.5 bg-[#1E88E5] hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{retryLabel}</span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                {onEnterManually && (
                  <button
                    type="button"
                    onClick={onEnterManually}
                    className="min-h-[44px] px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-semibold text-xs transition-colors"
                  >
                    {enterManuallyLabel}
                  </button>
                )}

                {onSaveForLater && (
                  <button
                    type="button"
                    onClick={onSaveForLater}
                    className="min-h-[44px] px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#2E9E6B] border border-emerald-200 rounded-xl font-semibold text-xs transition-colors"
                  >
                    {saveForLaterLabel}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Rotating Tip every 4s */
          tips.length > 0 &&
          !isComplete && (
            <div className="pt-2 border-t border-slate-100 text-center min-h-[2.5rem] flex items-center justify-center">
              <p
                className={`text-slate-500 leading-snug ${
                  isLargeText ? 'text-xs' : 'text-[11px]'
                } ${reducedMotion ? '' : 'transition-opacity duration-200'}`}
                style={{ opacity: tipVisible ? 1 : 0 }}
              >
                {tips[tipIndex % tips.length]}
              </p>
            </div>
          )
        )}

        {/* Bottom Cancel Text Button */}
        {onCancel && !isComplete && (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[44px] px-6 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            >
              {cancelLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

interface OfflineQueuedConfirmationProps {
  title: string;
  description: string;
  doneLabel: string;
  thumbnailBase64?: string;
  language: LanguageConfig;
  isLargeText?: boolean;
  onDone: () => void;
}

export const OfflineQueuedConfirmation: React.FC<OfflineQueuedConfirmationProps> = ({
  title,
  description,
  doneLabel,
  thumbnailBase64,
  language,
  isLargeText = false,
  onDone,
}) => {
  return (
    <div
      dir={language.isRtl ? 'rtl' : 'ltr'}
      style={{ fontFamily: language.fontFamily }}
      className="flex-1 min-h-full bg-white flex flex-col items-center justify-center p-4 sm:p-6"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-sm text-center space-y-4">
        {thumbnailBase64 && (
          <div className="w-24 h-24 rounded-2xl overflow-hidden border border-slate-200 mx-auto">
            <img
              src={thumbnailBase64}
              alt="Saved prescription"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
          <Clock className="w-6 h-6" />
        </div>

        <div className="space-y-1.5">
          <h2 className={`font-bold text-slate-900 ${isLargeText ? 'text-xl' : 'text-lg'}`}>
            {title}
          </h2>
          <p className={`text-slate-600 leading-relaxed ${isLargeText ? 'text-sm' : 'text-xs'}`}>
            {description}
          </p>
        </div>

        <button
          type="button"
          onClick={onDone}
          className="w-full min-h-[44px] bg-[#2E9E6B] hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors"
        >
          {doneLabel}
        </button>
      </div>
    </div>
  );
};
