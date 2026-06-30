import React, { useState, useEffect } from 'react';
import { Download, X, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Extend the window object to include the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// ── Module-level capture ─────────────────────────────────────────────────────
// The browser fires `beforeinstallprompt` very early — often before React
// components mount. By capturing it at module scope we never miss the event.
let _capturedPrompt: BeforeInstallPromptEvent | null = null;
let _captureListeners: Array<() => void> = [];

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    _capturedPrompt = e as BeforeInstallPromptEvent;
    _captureListeners.forEach(fn => fn());
    _captureListeners = [];
  });
}

export default function PWAInstallPrompt({ activeTab }: { activeTab?: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(_capturedPrompt);
  const [showPrompt, setShowPrompt] = useState(!!_capturedPrompt);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSTooltip, setShowIOSTooltip] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;

    setIsStandalone(isStandaloneMode);
    if (isStandaloneMode) return;

    // If the prompt was already captured before mount, use it.
    if (_capturedPrompt) {
      setDeferredPrompt(_capturedPrompt);
      setShowPrompt(true);
      return;
    }

    // Otherwise, register a listener for future capture.
    const onCapture = () => {
      setDeferredPrompt(_capturedPrompt);
      setShowPrompt(true);
    };
    _captureListeners.push(onCapture);

    // Detect iOS Safari (doesn't support beforeinstallprompt)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);

    if (isIOSDevice && !isStandaloneMode) {
      setIsIOS(true);
      setShowPrompt(true);
      setTimeout(() => setShowIOSTooltip(true), 1500);
    }

    return () => {
      _captureListeners = _captureListeners.filter(fn => fn !== onCapture);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstalled(true);
        _capturedPrompt = null;
        // Auto-hide success toast after 3 seconds
        setTimeout(() => setShowPrompt(false), 3000);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSTooltip(!showIOSTooltip);
    }
  };

  if (!showPrompt || isStandalone) return null;
  if (activeTab && activeTab !== 'dashboard') return null;

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          className="relative flex flex-col items-center gap-2 mb-4 w-full"
        >
          <AnimatePresence>
            {isIOS && showIOSTooltip && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                className="absolute top-14 bg-[#162D4E] text-white text-xs p-4 rounded-xl shadow-2xl w-48 border border-slate-700 text-center z-50"
              >
                <button
                  onClick={() => setShowIOSTooltip(false)}
                  className="absolute top-1 right-1 p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
                <p className="mt-1">
                  To install the app, tap the <strong>Share</strong> icon in your browser, then select <strong>"Add to Home Screen"</strong>.
                </p>
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#162D4E] border-t border-l border-slate-700 transform rotate-45"></div>
              </motion.div>
            )}
          </AnimatePresence>

          {installed ? (
            <div className="w-auto h-8 px-4 bg-emerald-600 text-white rounded-full shadow-lg flex items-center justify-center gap-1.5 font-semibold tracking-wide text-[11px]">
              <CheckCircle className="w-3.5 h-3.5" strokeWidth={2.5} />
              Installed! Added to home screen
            </div>
          ) : (
            <button
              onClick={handleInstallClick}
              className="w-auto h-8 px-4 bg-[#1e1e1e] hover:bg-[#333333] text-white rounded-full shadow-lg flex items-center justify-center gap-1.5 transition-transform hover:scale-105 active:scale-95 font-semibold tracking-wide text-[11px] animate-bounce"
              aria-label="Install App"
            >
              <Download className="w-3.5 h-3.5" strokeWidth={2.5} />
              Add to Home Screen
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}


