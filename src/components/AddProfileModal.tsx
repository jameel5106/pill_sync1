import React, { useState } from 'react';
import { X, UserPlus, Check, Trash2 } from 'lucide-react';
import { PatientProfile, dbService } from '../services/db';
import { SUPPORTED_LANGUAGES } from '../data/translations';

interface AddProfileModalProps {
  isOpen: boolean;
  userId: string;
  onClose: () => void;
  onProfileSaved: (profile: PatientProfile) => void;
  existingProfile?: PatientProfile | null;
  onProfileDeleted?: (profileId: string) => void;
}

export const AddProfileModal: React.FC<AddProfileModalProps> = ({
  isOpen,
  userId,
  onClose,
  onProfileSaved,
  existingProfile,
  onProfileDeleted,
}) => {
  const [name, setName] = useState(existingProfile?.name || '');
  const [relation, setRelation] = useState<'Mother' | 'Father' | 'Spouse' | 'Child' | 'Other'>(
    existingProfile?.relation !== 'Self' ? (existingProfile?.relation as any) || 'Mother' : 'Mother'
  );
  const [age, setAge] = useState<number>(existingProfile?.age || 50);
  const [language, setLanguage] = useState(existingProfile?.language || 'hi');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync when existingProfile changes
  React.useEffect(() => {
    if (existingProfile) {
      setName(existingProfile.name);
      if (existingProfile.relation !== 'Self') {
        setRelation(existingProfile.relation as any);
      }
      setAge(existingProfile.age);
      setLanguage(existingProfile.language);
    } else {
      setName('');
      setRelation('Mother');
      setAge(50);
      setLanguage('hi');
    }
    setError('');
  }, [existingProfile, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter the person\'s name.');
      return;
    }

    if (age <= 0 || age > 125) {
      setError('Please enter a valid age between 1 and 125.');
      return;
    }

    try {
      setIsSaving(true);
      setError('');

      const profile: PatientProfile = {
        id: existingProfile ? existingProfile.id : `prof_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId,
        name: name.trim(),
        relation: existingProfile?.relation === 'Self' ? 'Self' : relation,
        age: Number(age),
        language,
        isDefault: existingProfile?.isDefault || false,
        createdAt: existingProfile?.createdAt || new Date().toISOString(),
      };

      await dbService.saveProfile(profile);
      onProfileSaved(profile);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingProfile || existingProfile.isDefault) return;
    if (confirm(`Are you sure you want to delete ${existingProfile.name}'s profile?`)) {
      try {
        await dbService.deleteProfile(userId, existingProfile.id);
        if (onProfileDeleted) onProfileDeleted(existingProfile.id);
        onClose();
      } catch (err: any) {
        setError(err?.message || 'Failed to delete profile.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 text-slate-800">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-[#1E88E5] flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {existingProfile ? 'Edit Profile' : 'Add Family Member'}
              </h3>
              <p className="text-[10px] text-slate-500">Track prescriptions separately</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="my-3 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {/* Full Name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Smt. Kamala Devi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#1E88E5] focus:outline-none"
            />
          </div>

          {/* Relation (disabled if 'Self') */}
          {existingProfile?.relation !== 'Self' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Relation *
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['Mother', 'Father', 'Spouse', 'Child', 'Other'] as const).map((rel) => (
                  <button
                    type="button"
                    key={rel}
                    onClick={() => setRelation(rel)}
                    className={`h-8 rounded-lg text-xs font-semibold border transition-all ${
                      relation === rel
                        ? 'bg-blue-50 border-[#1E88E5] text-[#1E88E5]'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {rel}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Age & Language */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Age *
              </label>
              <input
                type="number"
                min={1}
                max={120}
                required
                value={age}
                onChange={(e) => setAge(parseInt(e.target.value, 10) || 0)}
                className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#1E88E5] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full h-10 px-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#1E88E5] focus:outline-none"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.nativeName} ({lang.englishName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-3 flex items-center gap-2">
            {existingProfile && !existingProfile.isDefault && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"
                title="Delete Profile"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 h-11 bg-[#2E9E6B] hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : existingProfile ? 'Update Profile' : 'Save Profile'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
