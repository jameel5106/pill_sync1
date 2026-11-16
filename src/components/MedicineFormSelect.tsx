import React, { useState, useEffect } from 'react';
import {
  Pill,
  CircleDot,
  FlaskConical,
  Beaker,
  Package,
  Sparkles,
  Droplet,
  Droplets,
  SprayCan,
  Layers,
  Eye,
  Ear,
  Wind,
  Syringe,
  Shield,
  ChevronDown,
  Check,
  X,
} from 'lucide-react';
import {
  MEDICINE_FORMS,
  MEDICINE_FORM_GROUP_LABELS,
  MedicineFormGroupId,
  MedicineFormId,
  getMedicineFormDef,
  normalizeFormId,
} from '../config/medicineForms';
import { REVIEW_CARD_LABELS, toSupportedLang } from '../translations/glossary';

interface MedicineFormSelectProps {
  value?: string | null;
  onChange: (formId: MedicineFormId) => void;
  langCode?: string;
  hasError?: boolean;
  helperText?: string;
  compact?: boolean;
}

const GROUP_ORDER: MedicineFormGroupId[] = ['oral', 'topical', 'drops', 'other'];

export function getFormIcon(formId: MedicineFormId | null, className = 'w-4 h-4'): React.ReactNode {
  switch (formId) {
    case 'tablet':
      return <CircleDot className={className} />;
    case 'capsule':
      return <Pill className={className} />;
    case 'syrup':
      return <FlaskConical className={className} />;
    case 'suspension':
      return <Beaker className={className} />;
    case 'powder_sachet':
      return <Package className={className} />;
    case 'lozenge':
      return <Sparkles className={className} />;
    case 'lotion':
      return <Droplet className={className} />;
    case 'cream':
      return <Layers className={className} />;
    case 'ointment':
      return <Layers className={className} />;
    case 'gel':
      return <Droplets className={className} />;
    case 'shampoo':
      return <Sparkles className={className} />;
    case 'spray':
      return <SprayCan className={className} />;
    case 'solution':
      return <FlaskConical className={className} />;
    case 'patch':
      return <Shield className={className} />;
    case 'eye_drops':
      return <Eye className={className} />;
    case 'ear_drops':
      return <Ear className={className} />;
    case 'nasal_drops':
      return <Droplet className={className} />;
    case 'injection':
      return <Syringe className={className} />;
    case 'inhaler':
      return <Wind className={className} />;
    case 'suppository':
      return <Pill className={className} />;
    case 'other':
    default:
      return <CircleDot className={className} />;
  }
}

export const MedicineFormSelect: React.FC<MedicineFormSelectProps> = ({
  value,
  onChange,
  langCode = 'en',
  hasError = false,
  helperText,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const lang = toSupportedLang(langCode);
  const labels = REVIEW_CARD_LABELS[lang];
  const isUrdu = lang === 'ur';

  const normalizedId = normalizeFormId(value);
  const selectedDef = normalizedId ? getMedicineFormDef(normalizedId) : null;

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full ${
          compact ? 'min-h-[40px] px-2.5 py-1.5' : 'min-h-[44px] px-3 py-2'
        } rounded-xl text-left flex items-center justify-between gap-2 transition-all cursor-pointer bg-slate-50 hover:bg-slate-100/80 focus:outline-none focus:ring-2 focus:ring-[#1E88E5] ${
          hasError || !selectedDef
            ? 'border-2 border-red-400 bg-red-50/40'
            : 'border border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`shrink-0 ${
              selectedDef ? 'text-[#1E88E5]' : 'text-red-500'
            }`}
          >
            {getFormIcon(normalizedId, 'w-4 h-4')}
          </span>
          <span
            className={`text-xs font-bold truncate ${
              selectedDef ? 'text-slate-900' : 'text-red-600'
            }`}
          >
            {selectedDef ? selectedDef.label[lang] : labels.selectFormPlaceholder}
          </span>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </button>

      {helperText && (
        <p className="mt-1 text-[11px] font-semibold text-red-600">{helperText}</p>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in"
          onClick={() => setIsOpen(false)}
        >
          <div
            dir={isUrdu ? 'rtl' : 'ltr'}
            role="listbox"
            aria-label={labels.formLabel}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 max-h-[82vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3.5 bg-gradient-to-r from-[#1E88E5] to-[#2E9E6B] text-white flex items-center justify-between shrink-0">
              <div className="min-w-0">
                <h4 className="text-sm font-extrabold tracking-tight">{labels.formLabel}</h4>
                <p className="text-[11px] text-white/90">{labels.selectFormPlaceholder}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Grouped Form Options */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-4 bg-[#F9FAFB]">
              {GROUP_ORDER.map((groupId) => {
                const items = MEDICINE_FORMS.filter((f) => f.group === groupId);
                return (
                  <div key={groupId} className="space-y-1.5">
                    <div className="px-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#1E88E5] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2E9E6B]" />
                      <span>{MEDICINE_FORM_GROUP_LABELS[groupId][lang]}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {items.map((item) => {
                        const isSelected = normalizedId === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              onChange(item.id);
                              setIsOpen(false);
                            }}
                            className={`min-h-[46px] px-3 py-2.5 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#2E9E6B] text-white border-[#2E9E6B] shadow-sm'
                                : 'bg-white text-slate-800 border-slate-200 hover:border-[#1E88E5] hover:bg-blue-50/50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? 'bg-white/20 text-white'
                                    : 'bg-blue-50 text-[#1E88E5]'
                                }`}
                              >
                                {getFormIcon(item.id, 'w-4 h-4')}
                              </span>
                              <span className="truncate">{item.label[lang]}</span>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
