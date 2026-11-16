import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  GitBranch,
  Loader2,
  PackageCheck,
  Smartphone,
  Terminal,
  X,
} from 'lucide-react';
import { apiUrl } from '../config/apiConfig';

interface AndroidApkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenInstallPwa?: () => void;
}

export const AndroidApkModal: React.FC<AndroidApkModalProps> = ({
  isOpen,
  onClose,
  onOpenInstallPwa,
}) => {
  const [githubOwner, setGithubOwner] = useState('');
  const [githubRepo, setGithubRepo] = useState('pill_sync1');
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [zipFeedback, setZipFeedback] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  if (!isOpen) return null;

  const cleanOwner = githubOwner.trim().replace(/[^a-zA-Z0-9-]/g, '');
  const cleanRepo = (githubRepo.trim() || 'pill_sync1').replace(/[^a-zA-Z0-9._-]/g, '');
  const hasValidRepo = cleanOwner.length > 0 && cleanRepo.length > 0;

  const releaseApkUrl = hasValidRepo
    ? `https://github.com/${cleanOwner}/${cleanRepo}/releases/download/apk-latest/PillSync.apk`
    : undefined;
  const actionsBuildUrl = hasValidRepo
    ? `https://github.com/${cleanOwner}/${cleanRepo}/actions/workflows/build-apk.yml`
    : undefined;

  const localBuildCmd = [
    `npm install`,
    `npm run android:apk`,
    `# APK output: android/app/build/outputs/apk/debug/app-debug.apk`,
  ].join('\n');

  const handleCopyLocal = async () => {
    try {
      await navigator.clipboard.writeText(localBuildCmd);
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleDownloadRepoWithAndroid = async () => {
    setDownloadingZip(true);
    setZipFeedback(null);
    try {
      const res = await fetch(apiUrl('/api/export-github-zip?target=full'));
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pillsync-github-repo.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setZipFeedback('Downloaded pillsync-github-repo.zip with Capacitor Android project & APK workflow.');
    } catch (err: any) {
      setZipFeedback(err?.message || 'Failed to download project archive.');
    } finally {
      setDownloadingZip(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl text-slate-800 max-h-[90vh] overflow-y-auto space-y-3.5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-[#2E9E6B] flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Download Android APK</h3>
              <p className="text-[11px] text-slate-500">
                Package ID: <code>com.pillsync.app</code> (Capacitor Android)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Explanation */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-[11px] text-blue-950 leading-relaxed flex items-start gap-2">
          <PackageCheck className="w-4 h-4 text-[#1E88E5] shrink-0 mt-0.5" />
          <div>
            <strong>How PillSync.apk is built:</strong> This project includes a complete{' '}
            <code>android/</code> Gradle project and an automated{' '}
            <code>.github/workflows/build-apk.yml</code> workflow. When pushed to GitHub, GitHub
            Actions compiles <strong>PillSync.apk</strong> and publishes it directly to your
            repository&apos;s <strong>Releases</strong> page.
          </div>
        </div>

        {/* Step 1: Download Updated Repo ZIP */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
              1
            </span>
            <span className="text-xs font-bold text-slate-900">
              Push Android Project &amp; APK Builder to GitHub
            </span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Download the updated repository ZIP containing <code>android/</code> and{' '}
            <code>.github/workflows/build-apk.yml</code>, then push it to your repo.
          </p>
          <button
            type="button"
            onClick={handleDownloadRepoWithAndroid}
            disabled={downloadingZip}
            className="w-full h-10 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2"
          >
            {downloadingZip ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Preparing ZIP...</span>
              </>
            ) : (
              <>
                <GitBranch className="w-4 h-4" />
                <span>Download Repo ZIP (with Android APK Builder)</span>
              </>
            )}
          </button>
          {zipFeedback && (
            <div className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
              {zipFeedback}
            </div>
          )}
        </div>

        {/* Step 2: Direct APK Download from GitHub Release */}
        <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#2E9E6B] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
              2
            </span>
            <span className="text-xs font-bold text-slate-900">
              Download Built PillSync.apk from GitHub
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                GitHub Username
              </label>
              <input
                type="text"
                value={githubOwner}
                onChange={(e) => setGithubOwner(e.target.value)}
                placeholder="your-username"
                className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-[11px] font-mono focus:ring-2 focus:ring-[#2E9E6B] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                Repository Name
              </label>
              <input
                type="text"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                placeholder="pill_sync1"
                className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-[11px] font-mono focus:ring-2 focus:ring-[#2E9E6B] focus:outline-none"
              />
            </div>
          </div>

          {hasValidRepo ? (
            <div className="space-y-1.5">
              <a
                href={releaseApkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-11 bg-[#2E9E6B] hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Download PillSync.apk (GitHub Release)</span>
              </a>
              <a
                href={actionsBuildUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-9 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-800 font-semibold rounded-xl text-[11px] flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open GitHub Actions APK Build</span>
              </a>
            </div>
          ) : (
            <div className="text-[11px] text-slate-600 bg-white/80 border border-emerald-200 rounded-xl p-2 text-center">
              Enter your GitHub username above to generate your direct <strong>PillSync.apk</strong>{' '}
              download link.
            </div>
          )}
        </div>

        {/* Step 3: Local Gradle Build Command */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
              <Terminal className="w-3.5 h-3.5 text-[#1E88E5]" />
              <span>Or Build APK Locally (Android SDK / Java 21)</span>
            </div>
          </div>
          <div className="relative bg-slate-900 text-slate-100 rounded-xl p-2.5 text-[10px] font-mono leading-relaxed select-text">
            <button
              type="button"
              onClick={handleCopyLocal}
              className="absolute top-2 right-2 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-md text-[10px] font-sans font-semibold flex items-center gap-1"
            >
              {copiedCmd ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
            <pre className="pr-14 whitespace-pre-wrap break-all">{localBuildCmd}</pre>
          </div>
        </div>

        {/* Instant PWA Alternative */}
        {onOpenInstallPwa && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenInstallPwa();
            }}
            className="w-full h-10 bg-blue-50 hover:bg-blue-100 text-[#1E88E5] font-bold rounded-xl text-xs transition-colors"
          >
            Want it on your phone right now? Install as Android App (PWA)
          </button>
        )}
      </div>
    </div>
  );
};
