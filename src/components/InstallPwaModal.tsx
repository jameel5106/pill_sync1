import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Check, Share, MoreVertical, PlusSquare, Bell, AlertCircle } from 'lucide-react';

interface InstallPwaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallPwaModal: React.FC<InstallPwaModalProps> = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [activePlatform, setActivePlatform] = useState<'android' | 'ios'>('android');

  useEffect(() => {
    // Detect if already installed / standalone
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsInstalled(true);
    }

    // Capture beforeinstallprompt event on Android Chrome
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl text-slate-800 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-100 text-[#1E88E5] flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Install PillSync to Home Screen</h3>
              <p className="text-[11px] text-slate-500">For offline reliability & background reminders</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Honest explanation banner */}
        <div className="my-3 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 leading-relaxed flex items-start gap-2.5">
          <Bell className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Why install?</strong> Medical reminders work with high priority and without browser tab sleeping when installed to your Home Screen. In standard browser tabs, Safari and Chrome throttle alarms after inactivity.
          </div>
        </div>

        {/* Direct One-Click Install Button (if Chrome prompt available) */}
        {deferredPrompt && (
          <button
            onClick={handleInstallClick}
            className="w-full mb-3 h-12 bg-[#1E88E5] hover:bg-blue-700 text-white font-bold rounded-2xl shadow-md text-xs flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Install App Now (1 Tap)</span>
          </button>
        )}

        {/* Platform Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-3">
          <button
            onClick={() => setActivePlatform('android')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activePlatform === 'android' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
            }`}
          >
            Android (Chrome)
          </button>
          <button
            onClick={() => setActivePlatform('ios')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activePlatform === 'ios' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
            }`}
          >
            iPhone (Safari)
          </button>
        </div>

        {/* Platform Instructions */}
        {activePlatform === 'android' ? (
          <div className="space-y-2.5 text-xs text-slate-700">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-xs">
                1
              </div>
              <div>
                <span className="font-bold text-slate-900 block">Open Chrome Menu</span>
                <span>Tap the three dots (<strong>⋮</strong>) in the top-right corner of Google Chrome.</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-xs">
                2
              </div>
              <div>
                <span className="font-bold text-slate-900 block">Select "Install app" or "Add to Home screen"</span>
                <span>Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>).</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0 text-xs">
                3
              </div>
              <div>
                <span className="font-bold text-slate-900 block">Done!</span>
                <span>PillSync will launch as a native full-screen app with offline support and alarm access.</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 text-xs text-slate-700">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-xs">
                1
              </div>
              <div>
                <span className="font-bold text-slate-900 block">Tap the Share button in Safari</span>
                <span>Tap the Share icon (<strong>􀈂</strong> square with an upward arrow) in the Safari bottom bar.</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-xs">
                2
              </div>
              <div>
                <span className="font-bold text-slate-900 block">Select "Add to Home Screen"</span>
                <span>Scroll down the share sheet and tap <strong>Add to Home Screen</strong> (<PlusSquare className="w-3.5 h-3.5 inline mx-0.5" />).</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0 text-xs">
                3
              </div>
              <div>
                <span className="font-bold text-slate-900 block">Tap "Add"</span>
                <span>Confirm "Add" in the top-right corner. You can now open PillSync directly from your iPhone home screen!</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
          >
            Got it, continue in browser
          </button>
        </div>
      </div>
    </div>
  );
};
