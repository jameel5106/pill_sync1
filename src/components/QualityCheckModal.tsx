import React from 'react';
import { AlertTriangle, CheckCircle2, RotateCw, X, Camera, ArrowRight } from 'lucide-react';
import { QualityAnalysisResult } from '../services/imageAnalysis';

interface QualityCheckModalProps {
  isOpen: boolean;
  imageBase64: string;
  analysis: QualityAnalysisResult | null;
  onRetake: () => void;
  onRotate: () => void;
  onProceed: () => void;
}

export const QualityCheckModal: React.FC<QualityCheckModalProps> = ({
  isOpen,
  imageBase64,
  analysis,
  onRetake,
  onRotate,
  onProceed,
}) => {
  if (!isOpen || !analysis) return null;

  const hasIssues = analysis.isBlurry || analysis.isDark || analysis.isLowRes;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-sm bg-white rounded-3xl p-4 shadow-2xl border border-slate-200 text-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            {hasIssues ? (
              <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {hasIssues ? 'Quality Warning' : 'Photo Quality Checked'}
              </h3>
              <p className="text-[10px] text-slate-500">
                {hasIssues ? 'Possible handwriting readability issues' : 'Image is clear for handwriting reading'}
              </p>
            </div>
          </div>
          <button
            onClick={onRetake}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning banner if issues found */}
        {hasIssues && (
          <div className="my-2.5 p-2.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
            {analysis.warnings.map((w, idx) => (
              <div key={idx} className="flex items-start gap-1.5">
                <span className="text-amber-600 font-bold">•</span>
                <span className="leading-snug">{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Photo Preview Container */}
        <div className="relative my-2 bg-slate-900 rounded-2xl overflow-hidden h-48 flex items-center justify-center border border-slate-800">
          <img
            src={imageBase64}
            alt="Captured prescription"
            className="max-h-full max-w-full object-contain"
          />

          <button
            onClick={onRotate}
            className="absolute bottom-2 right-2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-xl text-[10px] font-semibold flex items-center gap-1 backdrop-blur-xs shadow-sm transition-all"
            title="Rotate 90 degrees"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Rotate 90°</span>
          </button>
        </div>

        {/* Real Canvas Analysis Metrics */}
        <div className="grid grid-cols-3 gap-1.5 my-2 text-[10px]">
          <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-center">
            <span className="text-slate-400 block">Sharpness</span>
            <span className={`font-bold ${analysis.isBlurry ? 'text-amber-600' : 'text-emerald-600'}`}>
              {analysis.sharpnessScore} / 100
            </span>
          </div>

          <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-center">
            <span className="text-slate-400 block">Lighting</span>
            <span className={`font-bold ${analysis.isDark ? 'text-amber-600' : 'text-emerald-600'}`}>
              {analysis.averageLuminance} / 255
            </span>
          </div>

          <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-center">
            <span className="text-slate-400 block">Resolution</span>
            <span className="font-bold text-slate-700">
              {analysis.width}x{analysis.height}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={onRetake}
            className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Retake Photo</span>
          </button>

          <button
            onClick={onProceed}
            className={`flex-1 h-10 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all ${
              hasIssues
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-[#2E9E6B] hover:bg-emerald-700'
            }`}
          >
            <span>{hasIssues ? 'Proceed Anyway' : 'Continue'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
