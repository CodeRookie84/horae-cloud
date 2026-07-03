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

// VAPID public key for Web Push. Hardcoded on purpose (it is public, not a
// secret) so the client and the notify-dispatcher edge function can never
// drift out of sync via mismatched env config — a previous mismatch between
// VITE_VAPID_PUBLIC_KEY (client) and VAPID_PUBLIC_KEY (server) made the push
// service reject every send with "403 VAPID credentials do not correspond".
// MUST stay identical to VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in the edge
// function secrets. To rotate: `npx web-push generate-vapid-keys`, update this
// constant AND the two edge secrets together.
const VAPID_PUBLIC_KEY =
  'BN4eUHJux28yHCwatkpKWi5VhF5LtxP_kF_0DpXXF3mYVNc2uIePGeUsWavcz-ZXAGWUra_OMplvvdOL2Hg2mXk';

// Session-level state — avoid re-asking in same session
let pushInitialized = false;

// Last failure reason from initPush, surfaced in the UI so subscription
// problems on a user's device are diagnosable instead of silently swallowed.
let _lastPushError = '';
export function getLastPushError(): string { return _lastPushError; }

const OPT_OUT_KEY = 'horae_push_opt_out';

/** User explicitly turned push off via Settings — never auto-prompt again until they turn it back on */
export function isPushOptedOut(): boolean {
  return localStorage.getItem(OPT_OUT_KEY) === 'true';
}

export function setPushOptOut(optedOut: boolean): void {
  if (optedOut) localStorage.setItem(OPT_OUT_KEY, 'true');
  else localStorage.removeItem(OPT_OUT_KEY);
}

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
 * True if an existing push subscription was created with the given VAPID
 * public key. Used to detect a rotated server keypair so we can drop a stale
 * subscription instead of reusing one that the push service will 403.
 */
function applicationServerKeyMatches(sub: PushSubscription, currentKey: Uint8Array): boolean {
  const existing = sub.options?.applicationServerKey;
  if (!existing) return false; // unknown key → treat as mismatch and re-subscribe
  const a = new Uint8Array(existing as ArrayBuffer);
  if (a.length !== currentKey.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== currentKey[i]) return false;
  return true;
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
  _lastPushError = '';

  if (!isPushConfigured()) {
    _lastPushError = `Not supported/configured (vapidKey=${!!VAPID_PUBLIC_KEY}, `
      + `serviceWorker=${'serviceWorker' in navigator}, `
      + `PushManager=${'PushManager' in window}, Notification=${'Notification' in window})`;
    console.info('[Push]', _lastPushError);
    return null;
  }

  try {
    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      _lastPushError = `Permission not granted (permission=${permission})`;
      console.info('[Push]', _lastPushError);
      return null;
    }

    // Wait for service worker to be ready — guard against it never activating
    // (a broken registration would otherwise hang this call forever).
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<ServiceWorkerRegistration>((_, reject) =>
        setTimeout(() => reject(new Error('serviceWorker.ready timed out — SW not active')), 8000)
      ),
    ]);

    const currentKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

    // Re-use existing subscription if already subscribed…
    let subscription = await registration.pushManager.getSubscription();

    // …but only if it was created with the CURRENT VAPID key. If the server
    // keypair was rotated, the old subscription is signed against a stale key
    // and every push to it is rejected with 403. Drop it and re-subscribe.
    if (subscription && !applicationServerKeyMatches(subscription, currentKey)) {
      _lastPushError = '';
      await subscription.unsubscribe();
      subscription = null;
    }

    if (!subscription) {
      // Subscribe with VAPID public key
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // Required — ensures every push shows a notification
        applicationServerKey: currentKey,
      });
    }

    const subscriptionJson = JSON.stringify(subscription);
    pushInitialized = true;

    // Save to Supabase so Edge Function can send pushes
    const saveErr = await savePushSubscription(userId, subscriptionJson);
    setPushOptOut(false);

    if (saveErr) {
      // Browser is subscribed but the DB write failed — push still can't be
      // delivered, so treat it as a failure the user/logs can see.
      _lastPushError = `Subscribed in browser but DB save failed: ${saveErr}`;
      console.warn('[Push]', _lastPushError);
    } else {
      console.info('[Push] Subscribed successfully.');
    }
    return subscriptionJson;

  } catch (err: any) {
    _lastPushError = `${err?.name || 'Error'}: ${err?.message || String(err)}`;
    console.error('[Push] Subscription error:', err);
    return null;
  }
}

/** Save push subscription JSON to Supabase user profile. Returns an error
 *  message string on failure, or null on success. */
async function savePushSubscription(userId: string, subscription: string): Promise<string | null> {
  const { error } = await supabase
    .from('users')
    .update({ fcm_token: subscription }) // reusing fcm_token column to store WP subscription
    .eq('id', userId);

  if (error) {
    console.warn('[Push] Failed to save subscription to DB:', error.message);
    return error.message;
  }
  return null;
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
