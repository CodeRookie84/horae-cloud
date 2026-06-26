/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Bell, BellOff, X, Smartphone } from 'lucide-react';
import { isPushConfigured, initPush, isPushOptedOut } from '../services/fcmService';

interface NotificationPermissionBannerProps {
  userId: string;
  /** Called when user grants permission and token is obtained */
  onPermissionGranted?: (token: string) => void;
  /** 'login' = shown immediately after login | 'reminder' = shown as subtle bar later */
  variant?: 'login' | 'reminder';
}

/**
 * Non-intrusive banner to request FCM push notification permission.
 *
 * Anti-spam rules:
 * - Not shown if already granted
 * - Not shown if already dismissed (sessionStorage)
 * - Not shown if Firebase not configured
 * - 'reminder' variant only shown after 60 seconds of use
 */
const NotificationPermissionBanner: React.FC<NotificationPermissionBannerProps> = ({
  userId,
  onPermissionGranted,
  variant = 'reminder',
}) => {
  const [visible, setVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    // Don't show if not configured
    if (!isPushConfigured()) return;

    // Don't show if already granted
    if (Notification.permission === 'granted') return;

    // Browser previously blocked — re-asking is pointless until the user
    // changes it in browser settings; no banner can help with that.
    if (Notification.permission === 'denied') return;

    // User explicitly turned push off via Settings — respect that, don't re-prompt
    if (isPushOptedOut()) return;

    // Don't show if user explicitly dismissed this session
    if (sessionStorage.getItem('horae_notif_dismissed')) return;

    if (variant === 'login') {
      // Push is on by default — try the permission prompt immediately,
      // no click required. If the browser silently blocks the
      // programmatic call (no decision made), fall back to the banner
      // so there's at least one user-gesture path to grant it.
      (async () => {
        const token = await initPush(userId);
        if (token) {
          onPermissionGranted?.(token);
        } else if (Notification.permission === 'default') {
          setVisible(true);
        }
      })();
    } else {
      // Show reminder only after 60 seconds of use
      const timer = setTimeout(() => {
        if (Notification.permission !== 'granted') {
          setVisible(true);
        }
      }, 60_000);
      return () => clearTimeout(timer);
    }
  }, [variant, userId, onPermissionGranted]);

  const handleEnable = async () => {
    setRequesting(true);
    try {
      const token = await initPush(userId);
      if (token) {
        setGranted(true);
        onPermissionGranted?.(token);
        setTimeout(() => setVisible(false), 2500);
      } else {
        // Permission denied — dismiss silently
        setVisible(false);
        sessionStorage.setItem('horae_notif_dismissed', 'true');
      }
    } finally {
      setRequesting(false);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    sessionStorage.setItem('horae_notif_dismissed', 'true');
  };

  if (!visible) return null;

  if (granted) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-lg flex items-center gap-2 text-sm font-semibold animate-fade-in">
        <Bell className="w-4 h-4" />
        Push notifications enabled! ✓
      </div>
    );
  }

  if (variant === 'login') {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4 pointer-events-none">
        <div className="pointer-events-auto bg-white border border-slate-200 rounded-3xl shadow-2xl p-5 max-w-sm w-full">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-[#162D4E]/10 rounded-2xl flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-[#162D4E]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800">Enable Push Notifications</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Get instant alerts for tasks, checklists, and notices — even when Horae is in the background.
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="text-slate-400 hover:text-slate-600 shrink-0 -mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleEnable}
              disabled={requesting}
              className="flex-1 bg-[#162D4E] text-white text-xs font-bold py-2.5 rounded-xl hover:bg-[#162D4E]/90 transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {requesting ? (
                <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />
              ) : (
                <Bell className="w-3.5 h-3.5" />
              )}
              {requesting ? 'Enabling...' : 'Enable Notifications'}
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 text-xs font-semibold text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Reminder variant — subtle top bar
  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 pointer-events-none px-4 w-full max-w-lg">
      <div className="pointer-events-auto bg-[#162D4E] text-white rounded-2xl shadow-lg px-4 py-2.5 flex items-center gap-3 text-xs">
        <Bell className="w-4 h-4 text-[#C5A880] shrink-0" />
        <span className="flex-1 font-medium">Enable push notifications for real-time task alerts</span>
        <button
          onClick={handleEnable}
          disabled={requesting}
          className="bg-[#C5A880] text-[#162D4E] font-bold px-3 py-1 rounded-lg hover:bg-[#C5A880]/90 transition-all cursor-pointer shrink-0 disabled:opacity-60"
        >
          {requesting ? '...' : 'Enable'}
        </button>
        <button onClick={handleDismiss} className="text-white/60 hover:text-white cursor-pointer shrink-0">
          <BellOff className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default NotificationPermissionBanner;
