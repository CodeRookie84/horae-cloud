/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pure Web Push Service for Horae PWA (No Firebase, No BSP)
 *
 * Uses the browser's built-in PushManager API with VAPID authentication.
 * Works on Chrome, Edge, Firefox. No external accounts needed beyond
 * storing VITE_VAPID_PUBLIC_KEY in .env.local
 *
 * Anti-spam rules:
 * - Never ask more than once per session
 * - Foreground messages suppressed when app is visible (user is looking at it)
 * - Subscription stored in Supabase so Edge Function can reach the user
 */

import supabase from './supabaseClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

// Session-level state — avoid re-asking in same session
let pushInitialized = false;

/** True only if VAPID key is configured and browser supports push */
export function isPushConfigured(): boolean {
  return !!(
    VAPID_PUBLIC_KEY &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Convert base64url string to Uint8Array (required for applicationServerKey)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Request push notification permission and subscribe the browser.
 * Stores the subscription object in Supabase so the Edge Function can push.
 * Returns a token string (JSON) or null if denied / not supported.
 */
export async function initPush(userId: string): Promise<string | null> {
  if (!isPushConfigured()) {
    console.info('[Push] Not configured or not supported in this browser.');
    return null;
  }

  if (pushInitialized) {
    // Already subscribed this session — get existing subscription
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    return existing ? JSON.stringify(existing) : null;
  }

  try {
    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.info('[Push] Permission denied by user.');
      return null;
    }

    // Wait for service worker to be ready
    const registration = await navigator.serviceWorker.ready;

    // Re-use existing subscription if already subscribed
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Subscribe with VAPID public key
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // Required — ensures every push shows a notification
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const subscriptionJson = JSON.stringify(subscription);
    pushInitialized = true;

    // Save to Supabase so Edge Function can send pushes
    await savePushSubscription(userId, subscriptionJson);

    console.info('[Push] Subscribed successfully.');
    return subscriptionJson;

  } catch (err) {
    console.error('[Push] Subscription error:', err);
    return null;
  }
}

/** Save push subscription JSON to Supabase user profile */
async function savePushSubscription(userId: string, subscription: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ fcm_token: subscription }) // reusing fcm_token column to store WP subscription
    .eq('id', userId);

  if (error) {
    console.warn('[Push] Failed to save subscription to DB:', error.message);
  }
}

/** Unsubscribe from push and clear from DB (call on logout) */
export async function clearPushSubscription(userId: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    await supabase.from('users').update({ fcm_token: null }).eq('id', userId);
    pushInitialized = false;
    console.info('[Push] Unsubscribed.');
  } catch (err) {
    console.warn('[Push] Unsubscribe error:', err);
  }
}

/**
 * Listen for deep-link NAVIGATE messages from the service worker.
 * When user taps a notification while app is already open,
 * the SW sends { type: 'NAVIGATE', url } instead of opening a new window.
 */
export function listenForSWNavigation(onNavigate: (url: string) => void): () => void {
  if (!('serviceWorker' in navigator)) return () => {};

  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'NAVIGATE' && event.data?.url) {
      onNavigate(event.data.url);
    }
  };

  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}
