import React from 'react';
import { ShieldCheck, X, FileText, Lock, Trash2, Globe2 } from 'lucide-react';

interface DpdpComplianceModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'privacy' | 'terms';
}

export const DpdpComplianceModal: React.FC<DpdpComplianceModalProps> = ({
  isOpen,
  onClose,
  type,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 text-slate-800">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-emerald-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-200" />
            <div>
              <h3 className="font-bold text-lg leading-tight">
                {type === 'privacy'
                  ? 'DPDP Act 2023 Privacy Policy'
                  : 'Healthcare Terms of Service'}
              </h3>
              <p className="text-xs text-blue-100">
                Republic of India • DPDP Act 2023 Statutory Compliance v1.0.0
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-600 leading-relaxed">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
            <Globe2 className="w-5 h-5 text-emerald-700 shrink-0" />
            <div className="text-xs text-emerald-900">
              <span className="font-semibold">Statutory Jurisdictional Note:</span> In
              compliance with India's <strong>Digital Personal Data Protection Act, 2023</strong>,
              PillSync acts as a Data Fiduciary for medical prescription transcription.
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
              <Lock className="w-4 h-4 text-blue-600" /> 1. Explicit Purpose Limitation
            </h4>
            <p className="text-xs text-slate-600">
              Prescription photos uploaded or captured are parsed solely to extract dosage schedules,
              frequency, and doctor instructions in your chosen Indian regional language. No healthcare data is ever sold or shared with insurance companies or advertisers.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-blue-600" /> 2. Granular Data Minimization
            </h4>
            <p className="text-xs text-slate-600">
              Only necessary account identifiers (name and verified email or Indian +91 phone) are collected. Passwords, PINs, and OTPs are never stored in plain text—PINs are irreversibly hashed with salted PBKDF2-HMAC-SHA256.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
              <Trash2 className="w-4 h-4 text-rose-600" /> 3. Section 12 Right to Erasure
            </h4>
            <p className="text-xs text-slate-600">
              You retain the absolute right to delete your data. Clicking "Delete My Account & Data" triggers an immediate cryptographic erasure of all prescription records, schedule builders, and auth credentials across both Cloud Firestore and local device secure storage.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl transition-colors shadow-sm"
          >
            I Understand & Accept
          </button>
        </div>
      </div>
    </div>
  );
};
