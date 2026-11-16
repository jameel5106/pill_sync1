import React, { useEffect, useState } from 'react';
import JSZip from 'jszip';
import {
  Check,
  Code2,
  Copy,
  Download,
  FileArchive,
  FolderGit2,
  GitBranch,
  Loader2,
  ShieldCheck,
  Smartphone,
  Terminal,
  Upload,
  X,
} from 'lucide-react';
import { FLUTTER_FILE_CONTENTS } from '../data/flutterFileContents';

export type GitHubExportTarget = 'full' | 'web' | 'flutter';

interface ManifestInfo {
  target: GitHubExportTarget;
  fileCount: number;
  totalBytes: number;
  topLevelEntries: string[];
}

interface GitHubExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export const GitHubExportModal: React.FC<GitHubExportModalProps> = ({ isOpen, onClose }) => {
  const [target, setTarget] = useState<GitHubExportTarget>('full');
  const [manifest, setManifest] = useState<ManifestInfo | null>(null);
  const [manifestLoading, setManifestLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [guideTab, setGuideTab] = useState<'cli' | 'web'>('cli');
  const [repoName, setRepoName] = useState('pillsync');
  const [copiedCmd, setCopiedCmd] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setManifestLoading(true);
    setDownloadError(null);

    fetch(`/api/export-github-manifest?target=${target}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Manifest unavailable');
        return res.json();
      })
      .then((data) => {
        if (!cancelled && data?.success) {
          setManifest({
            target: data.target,
            fileCount: data.fileCount,
            totalBytes: data.totalBytes,
            topLevelEntries: data.topLevelEntries || [],
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          if (target === 'flutter') {
            const entries = Object.keys(FLUTTER_FILE_CONTENTS);
            const total = entries.reduce((sum, k) => sum + FLUTTER_FILE_CONTENTS[k].length, 0);
            setManifest({
              target: 'flutter',
              fileCount: entries.length,
              totalBytes: total,
              topLevelEntries: ['pubspec.yaml', 'lib', 'l10n.yaml', 'firestore.rules'],
            });
          } else {
            setManifest(null);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setManifestLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, target]);

  if (!isOpen) return null;

  const cleanRepoSlug = (repoName || 'pillsync')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'pillsync';

  const gitCommands = [
    `# Extract the downloaded ZIP, open a terminal inside the folder, then run:`,
    `git init`,
    `git add .`,
    `git commit -m "Initial commit: PillSync"`,
    `git branch -M main`,
    `git remote add origin https://github.com/YOUR_USERNAME/${cleanRepoSlug}.git`,
    `git push -u origin main`,
  ].join('\n');

  const handleCopyCommands = async () => {
    try {
      await navigator.clipboard.writeText(gitCommands);
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    } catch {
      // Fallback ignored
    }
  };

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async () => {
    setDownloading(true);
    setDownloadError(null);
    setDownloadSuccess(null);

    const filenameMap: Record<GitHubExportTarget, string> = {
      full: 'pillsync-github-repo.zip',
      web: 'pillsync-web-app.zip',
      flutter: 'pillsync-flutter-app.zip',
    };

    try {
      const response = await fetch(`/api/export-github-zip?target=${target}`);
      if (!response.ok) {
        throw new Error(`Export failed (${response.status})`);
      }
      const blob = await response.blob();
      triggerBlobDownload(blob, filenameMap[target]);
      setDownloadSuccess(`Downloaded ${filenameMap[target]} (${formatBytes(blob.size)})`);
    } catch (err: any) {
      // Offline fallback for Flutter target using bundled FLUTTER_FILE_CONTENTS
      if (target === 'flutter') {
        try {
          const zip = new JSZip();
          for (const [filePath, content] of Object.entries(FLUTTER_FILE_CONTENTS)) {
            zip.file(filePath, content);
          }
          const blob = await zip.generateAsync({ type: 'blob' });
          triggerBlobDownload(blob, filenameMap.flutter);
          setDownloadSuccess(`Downloaded ${filenameMap.flutter} from offline bundle`);
        } catch (zipErr: any) {
          setDownloadError(zipErr?.message || 'Failed to build Flutter archive.');
        }
      } else {
        setDownloadError(
          err?.message || 'Could not download source archive. Please ensure you are online.'
        );
      }
    } finally {
      setDownloading(false);
    }
  };

  const targetOptions: {
    id: GitHubExportTarget;
    label: string;
    subtitle: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'full',
      label: 'Full GitHub Repo',
      subtitle: 'Web + Express API + Flutter + CI',
      icon: <FolderGit2 className="w-4 h-4" />,
    },
    {
      id: 'web',
      label: 'Web / PWA App',
      subtitle: 'React + Vite + Gemini Server',
      icon: <Code2 className="w-4 h-4" />,
    },
    {
      id: 'flutter',
      label: 'Flutter Mobile',
      subtitle: 'Dart + Firebase + 7-Lang ARB',
      icon: <Smartphone className="w-4 h-4" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl text-slate-800 max-h-[90vh] overflow-y-auto space-y-3.5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Download &amp; Export to GitHub</h3>
              <p className="text-[11px] text-slate-500">
                Clean repository ZIP with README, CI &amp; .gitignore
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

        {/* Secret Safety Guarantee */}
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-[11px] text-emerald-900 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-[#2E9E6B] shrink-0 mt-0.5" />
          <span>
            <strong>Safe for public or private GitHub repos:</strong> excludes <code>.env</code>,{' '}
            <code>node_modules</code>, and build caches. Includes <code>.env.example</code>,{' '}
            <code>README.md</code>, <code>LICENSE</code>, and GitHub Actions CI.
          </span>
        </div>

        {/* Package Selector */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-slate-700">
            Select Export Package
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            {targetOptions.map((opt) => {
              const active = target === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setTarget(opt.id);
                    setDownloadSuccess(null);
                  }}
                  className={`p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                    active
                      ? 'bg-blue-50/80 border-[#1E88E5] ring-2 ring-blue-100'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        active ? 'bg-[#1E88E5] text-white' : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      {opt.icon}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{opt.label}</div>
                      <div className="text-[10px] text-slate-500">{opt.subtitle}</div>
                    </div>
                  </div>
                  {active && <Check className="w-4 h-4 text-[#1E88E5]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Manifest Summary */}
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2 text-slate-700 font-medium">
            <FileArchive className="w-4 h-4 text-[#1E88E5]" />
            {manifestLoading ? (
              <span>Inspecting project files...</span>
            ) : manifest ? (
              <span>
                <strong>{manifest.fileCount}</strong> source files &bull;{' '}
                <strong>{formatBytes(manifest.totalBytes)}</strong> uncompressed
              </span>
            ) : (
              <span>Ready to package repository</span>
            )}
          </div>
        </div>

        {/* Feedback Banners */}
        {downloadError && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700 font-medium">
            {downloadError}
          </div>
        )}
        {downloadSuccess && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 font-semibold flex items-center gap-1.5">
            <Check className="w-4 h-4 text-[#2E9E6B] shrink-0" />
            <span>{downloadSuccess}</span>
          </div>
        )}

        {/* Primary Download CTA */}
        <button
          type="button"
          onClick={handleDownloadZip}
          disabled={downloading}
          className="w-full h-12 bg-[#1E88E5] hover:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-2xl shadow-md text-xs flex items-center justify-center gap-2 transition-all"
        >
          {downloading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Building GitHub ZIP...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Download .ZIP for GitHub</span>
            </>
          )}
        </button>

        {/* How to Upload to GitHub */}
        <div className="pt-1 space-y-2">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setGuideTab('cli')}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                guideTab === 'cli' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Git CLI Push</span>
            </button>
            <button
              type="button"
              onClick={() => setGuideTab('web')}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                guideTab === 'web' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>GitHub Web Upload</span>
            </button>
          </div>

          {guideTab === 'cli' ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-600 shrink-0">
                  GitHub Repo Name:
                </label>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="pillsync"
                  className="flex-1 h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono focus:ring-2 focus:ring-[#1E88E5] focus:outline-none"
                />
              </div>

              <div className="relative bg-slate-900 text-slate-100 rounded-2xl p-3 text-[10px] font-mono leading-relaxed overflow-x-auto select-text">
                <button
                  type="button"
                  onClick={handleCopyCommands}
                  className="absolute top-2 right-2 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-[10px] font-sans font-semibold flex items-center gap-1"
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
                <pre className="pr-14 whitespace-pre-wrap break-all">{gitCommands}</pre>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-[11px] text-slate-700">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[10px]">
                  1
                </span>
                <span>
                  Download and extract the <strong>.ZIP</strong> file on your computer.
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[10px]">
                  2
                </span>
                <span>
                  On <strong>github.com</strong>, click <strong>New repository</strong>, name it{' '}
                  <code>{cleanRepoSlug}</code>, and click <strong>Create repository</strong>.
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0 text-[10px]">
                  3
                </span>
                <span>
                  Click <strong>uploading an existing file</strong>, drag in the extracted folder
                  contents, and click <strong>Commit changes</strong>. Anyone can now clone or
                  download it from GitHub!
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
