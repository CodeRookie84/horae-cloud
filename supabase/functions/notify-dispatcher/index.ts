/**
 * Supabase Edge Function: notify-dispatcher
 *
 * Triggered by Supabase DB webhooks on:
 *  - tasks INSERT (new task assigned)
 *  - tasks UPDATE (status or chat changed)
 *  - notices INSERT (new notice posted)
 *  - type: "DIGEST" (called from daily-digest function)
 *
 * Sends via:
 *  1. WhatsApp (Meta Cloud API direct — no BSP fee)
 *  2. Web Push (browser push via VAPID — no Firebase needed)
 *
 * Anti-spam rules applied before every send.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Environment Variables ────────────────────────────────────────────────────
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_WA_TOKEN     = Deno.env.get("META_WA_TOKEN")!;
const META_PHONE_NUM_ID = Deno.env.get("META_PHONE_NUMBER_ID")!;
const APP_BASE_URL      = Deno.env.get("APP_BASE_URL") || "https://horae.cloud";
const DISABLE_WHATSAPP  = Deno.env.get("DISABLE_WHATSAPP") === "true";


// VAPID config for Web Push (no Firebase needed)
const VAPID_SUBJECT     = Deno.env.get("VAPID_SUBJECT")!;   // e.g. "mailto:you@horae.io"
const VAPID_PUBLIC_KEY  = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

// ─── Anti-spam constants ──────────────────────────────────────────────────────
const ONLINE_THRESHOLD_MIN       = 0;   // Skip WA if user seen < 5 min ago (set to 0 for testing)
const TASK_DEDUP_HOURS           = 0;   // No repeat for same task within 3h
const MAX_MESSAGES_PER_USER_DAY  = 20;   // Daily WhatsApp cap per user

// "horae_task_alert" is used specifically for new task assignments.
// "horae_alert" is the generic template for every other WhatsApp push
// (status updates, task chat, notices, digests, urgent pushes) — now approved by Meta.
const GENERIC_TEMPLATE_NAME = "horae_alert";

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Needed because this function is called directly from the browser (urgent
// push button), not just server-to-server (DB webhooks, cron, curl).
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Entry Point ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Empty or invalid JSON body" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
  const { type, table, record, old_record } = body;
  console.log(`[notify-dispatcher] Received ${type} event on table ${table}`);

  try {
    if (table === "tasks") {
      if (type === "INSERT")       await handleTaskAssigned(record);
      else if (type === "UPDATE")  await handleTaskUpdated(record, old_record);
    } else if (table === "notices" && type === "INSERT") {
      await handleNoticePosted(record);
    } else if (type === "DIGEST") {
      await handleDigest(body.userId, body.tenantId, body.items, body.runMode);
    } else if (type === "URGENT_PUSH") {
      await handleUrgentPush(body.kind, body.record, body.userIds, body.tenantId);
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[notify-dispatcher] Error:", err);
    await logNotif("system", "system", "debug", "global_error", "system", "failed", String(err));
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});

// ─── Event Handlers ───────────────────────────────────────────────────────────

async function handleTaskAssigned(task: any) {
  const assigneeIds: string[] = task.assigned_user_ids || (task.assigned_user_id ? [task.assigned_user_id] : []);
  
  // DEBUG LOG
  await logNotif(assigneeIds[0] || "unknown", task.tenant_id, "debug", task.id, "whatsapp", "sent", `Assignees parsed: ${JSON.stringify(assigneeIds)}`);
  const deepLink = `${APP_BASE_URL}/tasks/${task.id}`;

  for (const userId of assigneeIds) {
    const user = await getUser(userId);
    if (!user) {
      await logNotif(userId, task.tenant_id, "debug", task.id, "whatsapp", "failed", "getUser: User not found in users table for ID: " + userId);
      continue;
    }
    if (!await checkAntiSpam(userId, task.tenant_id, "task_assigned", task.id)) continue;

    const details = `Priority: ${task.priority} | Due: ${task.due_date} | ${deepLink}`;
    await sendNotifications(user, {
      waMessage: buildTaskAssignedMessage(user.name, task.title, task.priority, task.due_date, deepLink),
      waTemplate: {
        name: "horae_task_alert",
        params: [task.title, details]
      },
      pushTitle: `🔔 New Task: ${task.title}`,
      pushBody: `Priority: ${task.priority}`,
      url: deepLink,
    }, task.tenant_id, "task_assigned", task.id);
  }
}

async function handleTaskUpdated(task: any, oldTask: any) {
  const deepLink = `${APP_BASE_URL}/tasks/${task.id}`;

  if (task.status !== oldTask?.status) {
    const significantStatuses = ["Completed", "Closed", "On Hold"];
    if (!significantStatuses.includes(task.status)) return;

    const recipients = await getTaskRecipients(task);
    for (const user of recipients) {
      if (!await checkAntiSpam(user.id, task.tenant_id, "task_status", task.id)) continue;
      await sendNotifications(user, {
        waMessage: buildStatusMessage(user.name, task.title, task.status, deepLink),
        waTemplate: { name: GENERIC_TEMPLATE_NAME, params: [task.title, `Now ${task.status}. ${deepLink}`] },
        pushTitle: `🔄 Task ${task.status}: ${task.title}`,
        pushBody: `Status updated`,
        url: deepLink,
      }, task.tenant_id, "task_status", task.id);
    }
  }

  const oldChatLen = (oldTask?.chat || []).length;
  const newChatLen = (task?.chat || []).length;
  if (newChatLen > oldChatLen) {
    const latest = task.chat[newChatLen - 1];
    const recipients = await getTaskRecipients(task, latest?.userId);
    for (const user of recipients) {
      if (!await checkAntiSpam(user.id, task.tenant_id, "task_chat", task.id)) continue;
      await sendNotifications(user, {
        waMessage: buildChatMessage(latest?.senderName || "Someone", task.title, latest?.message || "", deepLink),
        waTemplate: { name: GENERIC_TEMPLATE_NAME, params: [task.title, `${latest?.senderName || "Someone"}: ${(latest?.message || "").slice(0, 80)} ${deepLink}`] },
        pushTitle: `💬 ${latest?.senderName}: ${task.title}`,
        pushBody: (latest?.message || "").slice(0, 80),
        url: deepLink,
      }, task.tenant_id, "task_chat", task.id);
    }
  }
}

async function handleNoticePosted(notice: any) {
  const deepLink = `${APP_BASE_URL}/notices/${notice.id}`;
  const { data: users } = await supabase.from("users").select("*").eq("tenant_id", notice.tenant_id);

  for (const user of (users || [])) {
    if (user.id === notice.created_by_user_id) continue;
    if (!await checkAntiSpam(user.id, notice.tenant_id, "notice", notice.id)) continue;
    await sendNotifications(user, {
      waMessage: buildNoticeMessage(user.name, notice.title, notice.content?.slice(0, 100) || "", deepLink),
      waTemplate: { name: GENERIC_TEMPLATE_NAME, params: [notice.title, `${(notice.content || "").slice(0, 80)} ${deepLink}`] },
      pushTitle: `📢 ${notice.title}`,
      pushBody: notice.content?.slice(0, 80) || "",
      url: deepLink,
    }, notice.tenant_id, "notice", notice.id);
  }
}

async function handleDigest(userId: string, tenantId: string, items: any, runMode: "morning" | "evening" = "morning") {
  const user = await getUser(userId);
  if (!user) return;

  const firstName = user.name.split(" ")[0];
  const parts: string[] = runMode === "evening"
    ? [`Evening wrap-up, ${firstName} 🌙\n`]
    : [`Good morning ${firstName}! Your Horae briefing 🌅\n`];

  if (runMode === "morning") {
    if (items.checklists?.length) parts.push(`✅ CHECKLIST: "${items.checklists[0].title}" is pending`);
    if (items.notices?.length)    parts.push(`📢 NOTICE: "${items.notices[0].title}"`);
    if (items.quizzes?.length)    parts.push(`📝 QUIZ: "${items.quizzes[0].title}" — complete today`);
    if (items.tasks?.length)      parts.push(`📋 TASKS DUE TODAY: ${items.tasks.length} task(s) need attention`);
  } else {
    if (items.tasks?.length)      parts.push(`📋 STILL OPEN: ${items.tasks.length} task(s) — check before tomorrow`);
    if (items.mentions?.length)   parts.push(`💬 TEAM TALK: ${items.mentions.length} unread mention(s) today`);
  }
  if (parts.length <= 1) return;

  const deepLink = `${APP_BASE_URL}/digest`;
  parts.push(`\n👉 Open Horae: ${deepLink}`);

  const digestHeading = runMode === "evening" ? "Evening wrap-up" : "Morning briefing";
  await sendNotifications(user, {
    waMessage: parts.join("\n"),
    waTemplate: { name: GENERIC_TEMPLATE_NAME, params: [digestHeading, `${parts.slice(1, -1).join(" ")} ${deepLink}`] },
    pushTitle: runMode === "evening" ? "🌙 Your Horae Evening Wrap-up" : "📋 Your Horae Morning Briefing",
    pushBody: `${items.tasks?.length || 0} tasks${runMode === "evening" ? ", " + (items.mentions?.length || 0) + " mentions" : ", " + (items.checklists?.length || 0) + " checklists"}`,
    url: deepLink,
    pushTag: "horae-digest",
  }, tenantId, "daily_digest", `digest-${runMode}-` + new Date().toISOString().slice(0, 10));
}

async function handleUrgentPush(kind: "task" | "notice" | "message", record: any, userIds: string[], tenantId: string) {
  if (!record || !userIds?.length) return;
  const deepLink = kind === "task" ? `${APP_BASE_URL}/tasks/${record.id}`
    : kind === "notice" ? `${APP_BASE_URL}/notices/${record.id}`
    : `${APP_BASE_URL}/team-talk?channel=${record.channelId}&msg=${record.id}`;

  for (const userId of userIds) {
    const user = await getUser(userId);
    if (!user) continue;
    if (!await checkAntiSpam(userId, tenantId, "urgent_push", record.id)) continue;

    const waMessage = kind === "task"
      ? `🔴 *Urgent task — Horae*\n\nHi ${user.name.split(" ")[0]},\n*${record.title}*\nPlease action within the hour.\n\n👉 ${deepLink}`
      : kind === "notice"
      ? `🔴 *Urgent notice — Horae*\n\nHi ${user.name.split(" ")[0]},\n*${record.title}*\n\n👉 ${deepLink}`
      : `🔴 *Urgent message — Horae*\n\nHi ${user.name.split(" ")[0]},\n${record.senderName ? `${record.senderName}: ` : ""}"${record.title}"\n\n👉 ${deepLink}`;

    await sendNotifications(user, {
      waMessage,
      waTemplate: { name: GENERIC_TEMPLATE_NAME, params: [record.title, `Urgent — action within the hour. ${deepLink}`] },
      pushTitle: kind === "task" ? `🔴 Urgent task: ${record.title}` : `🔴 Urgent notice: ${record.title}`,
      pushBody: "Needs attention within the hour",
      url: deepLink,
    }, tenantId, "urgent_push", record.id, true);
  }
}

// ─── Anti-Spam Check ──────────────────────────────────────────────────────────

async function checkAntiSpam(userId: string, tenantId: string, eventType: string, refId: string): Promise<boolean> {
  const { data: user } = await supabase.from("users")
    .select("last_seen_at, whatsapp_opted_in, phone_number, fcm_token")
    .eq("id", userId).single();
  
  if (!user) {
    await logNotif(userId, tenantId, "debug", refId, "whatsapp", "failed", "checkAntiSpam: User not found");
    console.log(`[checkAntiSpam] User ${userId} not found`);
    return false;
  }

  // Must have at least one channel configured
  const hasWA   = user.phone_number && user.whatsapp_opted_in;
  const hasPush = !!user.fcm_token;
  
  if (!hasWA && !hasPush) {
    await logNotif(userId, tenantId, "debug", refId, "whatsapp", "failed", `checkAntiSpam: No WA/Push config. phone=${user.phone_number}, opted=${user.whatsapp_opted_in}`);
    console.log(`[checkAntiSpam] User ${userId} has no WA or Push configured (phone: ${user.phone_number}, opted_in: ${user.whatsapp_opted_in})`);
    return false;
  }

  // Removed Quiet Hours check based on user request - let WhatsApp handle muting at the device level

  // Skip WhatsApp if user was active recently (they're online — push is enough)
  if (hasWA && user.last_seen_at) {
    const ms = Date.now() - new Date(user.last_seen_at).getTime();
    if (ms < ONLINE_THRESHOLD_MIN * 60 * 1000) {
      await logNotif(userId, tenantId, "debug", refId, "whatsapp", "failed", `checkAntiSpam: User online (last seen ${ms/1000}s ago)`);
      console.log(`[checkAntiSpam] Skipped WA because user is online (last seen ${ms/1000}s ago)`);
      return false;
    }
  }

  console.log(`[checkAntiSpam] User ${userId} passed all checks for ${eventType}!`);

  // Daily WhatsApp cap
  if (hasWA) {
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await supabase.from("notification_log")
      .select("id", { count: "exact" })
      .eq("user_id", userId).eq("channel", "whatsapp").eq("status", "sent")
      .gte("sent_at", today + "T00:00:00Z");
    if ((count || 0) >= MAX_MESSAGES_PER_USER_DAY) {
      await logNotif(userId, tenantId, "debug", refId, "whatsapp", "failed", `checkAntiSpam: Daily WA cap reached (${count})`);
      return false;
    }
  }

  // Task dedup — no repeat for same task within TASK_DEDUP_HOURS
  if (refId && !["daily_digest", "notice"].includes(eventType)) {
    const cutoff = new Date(Date.now() - TASK_DEDUP_HOURS * 3600000).toISOString();
    const { count } = await supabase.from("notification_log")
      .select("id", { count: "exact" })
      .eq("user_id", userId).eq("reference_id", refId)
      .eq("event_type", eventType)
      .gte("sent_at", cutoff);
    if ((count || 0) > 0) {
      await logNotif(userId, tenantId, "debug", refId, "whatsapp", "failed", `checkAntiSpam: Task dedup triggered`);
      return false;
    }
  }

  return true;
}

// ─── Send to Both Channels ────────────────────────────────────────────────────

async function sendNotifications(user: any, payload: {
  waMessage: string;
  waTemplate?: { name: string, params: string[] };
  pushTitle: string;
  pushBody: string;
  url: string;
  pushTag?: string;
}, tenantId: string, eventType: string, refId: string, isUrgent: boolean = false) {
  const promises: Promise<void>[] = [];

  if (user.phone_number && user.whatsapp_opted_in && !DISABLE_WHATSAPP) {
    const prefix = META_WA_TOKEN.substring(0, 15) + '...';
    await logNotif(user.id, tenantId, "debug", refId, "whatsapp", "sent", "Token prefix in EF: " + prefix);
    promises.push(
      sendWhatsApp(user.phone_number, payload.waMessage, payload.waTemplate)
        .then(() => logNotif(user.id, tenantId, eventType, refId, "whatsapp", "sent", undefined, isUrgent))
        .catch(e => logNotif(user.id, tenantId, eventType, refId, "whatsapp", "failed", String(e), isUrgent))
    );
  }

  if (user.fcm_token) {
    promises.push(
      sendWebPush(user.fcm_token, payload)
        .then(() => logNotif(user.id, tenantId, eventType, refId, "webpush", "sent", undefined, isUrgent))
        .catch(e => logNotif(user.id, tenantId, eventType, refId, "webpush", "failed", String(e), isUrgent))
    );
  }

  await Promise.allSettled(promises);
}

// ─── WhatsApp (Meta Cloud API) ────────────────────────────────────────────────

async function sendWhatsApp(phone: string, message: string, template?: { name: string, params: string[] }): Promise<void> {
  const body: any = {
    messaging_product: "whatsapp",
    to: phone.replace(/\D/g, ""),
  };

  if (template) {
    body.type = "template";
    body.template = {
      name: template.name,
      language: { code: "en_US" },
      components: [
        {
          type: "body",
          parameters: template.params.map(text => ({ type: "text", text }))
        }
      ]
    };
  } else {
    body.type = "text";
    body.text = { body: message };
  }

  const res = await fetch(`https://graph.facebook.com/v19.0/${META_PHONE_NUM_ID}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${META_WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`WA ${res.status}: ${await res.text()}`);
}

// ─── Web Push (Pure VAPID — No Firebase) ─────────────────────────────────────

async function sendWebPush(subscriptionJson: string, payload: {
  pushTitle: string;
  pushBody: string;
  url: string;
  pushTag?: string;
}): Promise<void> {
  const subscription = JSON.parse(subscriptionJson);
  const endpoint: string = subscription.endpoint;

  // Build the push payload
  const messagePayload = JSON.stringify({
    title: payload.pushTitle,
    body: payload.pushBody,
    url: payload.url,
    icon: "/app-icon.jpg",
    badge: "/app-icon.jpg",
    tag: payload.pushTag || "horae-notif",
  });

  // Encode payload using VAPID authentication
  const authHeader = await buildVapidAuthHeader(endpoint);
  const { ciphertext, salt, serverPublicKey } = await encryptPayload(
    messagePayload,
    subscription.keys.p256dh,
    subscription.keys.auth
  );

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
      "Urgency": "normal",
    },
    body: buildEncryptedBody(ciphertext, salt, serverPublicKey),
  });

  if (res.status !== 201 && res.status !== 200) {
    const text = await res.text();
    if (res.status === 410 || res.status === 404) {
      // Subscription expired — clean up
      console.warn("[WebPush] Subscription expired, status:", res.status);
    }
    throw new Error(`WebPush ${res.status}: ${text}`);
  }
}

// ─── VAPID Auth Header Builder ────────────────────────────────────────────────

async function buildVapidAuthHeader(endpoint: string): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const expiry = Math.floor(Date.now() / 1000) + 12 * 3600;

  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud: audience, exp: expiry, sub: VAPID_SUBJECT };

  const encodeBase64url = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const signingInput = `${encodeBase64url(header)}.${encodeBase64url(payload)}`;

  const privateKeyBytes = base64UrlToUint8Array(VAPID_PRIVATE_KEY);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    addPkcs8Header(privateKeyBytes),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${uint8ArrayToBase64url(new Uint8Array(signature))}`;
  return `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`;
}

// ─── Payload Encryption (RFC 8291 aes128gcm) ─────────────────────────────────

async function encryptPayload(plaintext: string, clientPublicKeyB64: string, authB64: string) {
  const clientPublicKey = base64UrlToUint8Array(clientPublicKeyB64);
  const authSecret = base64UrlToUint8Array(authB64);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]
  );

  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeyPair.publicKey)
  );

  const clientKey = await crypto.subtle.importKey(
    "raw", clientPublicKey, { name: "ECDH", namedCurve: "P-256" }, false, []
  );

  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientKey }, serverKeyPair.privateKey, 256
  );

  // HKDF context info
  const keyInfo   = buildInfo("aesgcm", clientPublicKey, serverPublicKeyRaw);
  const nonceInfo = buildInfo("nonce",  clientPublicKey, serverPublicKeyRaw);

  const ikm = await hkdf(authSecret, new Uint8Array(sharedBits), buildInfo("Content-Encoding: auth\0", new Uint8Array(0), new Uint8Array(0)), 32);
  const cek   = await hkdf(salt, ikm, keyInfo,   16);
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  const encKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const encoded = new TextEncoder().encode(plaintext);

  // Padding: 1 byte pad length + content
  const padded = new Uint8Array(2 + encoded.length);
  padded[0] = 0; padded[1] = 0; // 2-byte pad length = 0
  padded.set(encoded, 2);

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, encKey, padded)
  );

  return { ciphertext, salt, serverPublicKey: serverPublicKeyRaw };
}

function buildEncryptedBody(ciphertext: Uint8Array, salt: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
  const body = new Uint8Array(21 + serverPublicKey.length + ciphertext.length);
  body.set(salt, 0);
  new DataView(body.buffer).setUint32(16, 4096);    // record size = 4096
  body[20] = serverPublicKey.length;
  body.set(serverPublicKey, 21);
  body.set(ciphertext, 21 + serverPublicKey.length);
  return body;
}

function buildInfo(type: string, clientKey: Uint8Array, serverKey: Uint8Array): Uint8Array {
  const info = new TextEncoder().encode(`Content-Encoding: ${type}\0P-256\0`);
  const result = new Uint8Array(info.length + 2 + clientKey.length + 2 + serverKey.length);
  let offset = 0;
  result.set(info, offset); offset += info.length;
  new DataView(result.buffer).setUint16(offset, clientKey.length); offset += 2;
  result.set(clientKey, offset); offset += clientKey.length;
  new DataView(result.buffer).setUint16(offset, serverKey.length); offset += 2;
  result.set(serverKey, offset);
  return result;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

function base64UrlToUint8Array(b64: string): Uint8Array {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

function uint8ArrayToBase64url(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function addPkcs8Header(rawKey: Uint8Array): ArrayBuffer {
  const header = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a,
    0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86,
    0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x04, 0x27, 0x30, 0x25,
    0x02, 0x01, 0x01, 0x04, 0x20
  ]);
  const result = new Uint8Array(header.length + rawKey.length);
  result.set(header); result.set(rawKey, header.length);
  return result.buffer;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getUser(userId: string) {
  const { data } = await supabase.from("users").select("*").eq("id", userId).single();
  return data;
}

async function getTaskRecipients(task: any, excludeId?: string) {
  const ids = [...(task.assigned_user_ids || [])];
  if (task.assigned_user_id && !ids.includes(task.assigned_user_id)) ids.push(task.assigned_user_id);
  if (task.created_by_user_id && !ids.includes(task.created_by_user_id)) ids.push(task.created_by_user_id);
  const filtered = excludeId ? ids.filter(id => id !== excludeId) : ids;
  const { data } = await supabase.from("users").select("*").in("id", filtered);
  return data || [];
}

async function logNotif(userId: string, tenantId: string, eventType: string, refId: string, channel: string, status: string, error?: string, isUrgent: boolean = false) {
  await supabase.from("notification_log").insert([{
    user_id: userId, tenant_id: tenantId, event_type: eventType,
    reference_id: refId, channel, status, error_message: error, is_urgent: isUrgent,
  }]);
}

// ─── Message Builders ─────────────────────────────────────────────────────────

function buildTaskAssignedMessage(name: string, title: string, priority: string, dueDate: string, link: string) {
  return `🔔 *New Task — Horae*\n\nHi ${name.split(" ")[0]},\n*${title}*\nPriority: ${priority} | Due: ${dueDate}\n\n👉 ${link}`;
}
function buildStatusMessage(name: string, title: string, status: string, link: string) {
  return `🔄 *Task Update — Horae*\n\nHi ${name.split(" ")[0]},\n"${title}" is now *${status}*.\n\n👉 ${link}`;
}
function buildChatMessage(sender: string, taskTitle: string, msg: string, link: string) {
  return `💬 *New Message — Horae*\n\n${sender} on "${taskTitle}":\n"${msg.slice(0, 100)}"\n\n👉 ${link}`;
}
function buildNoticeMessage(name: string, title: string, preview: string, link: string) {
  return `📢 *Notice — Horae*\n\nHi ${name.split(" ")[0]},\n*${title}*\n${preview}...\n\n👉 ${link}`;
}
