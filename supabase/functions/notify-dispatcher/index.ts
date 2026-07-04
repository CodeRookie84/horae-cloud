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
import webpush from "npm:web-push@3.6.7";

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
const TASK_DEDUP_HOURS           = 3;   // No repeat for same task within 3h
const MAX_MESSAGES_PER_USER_DAY  = 20;   // Daily WhatsApp cap per user

// Event types that are architecturally one-time-per-(user, reference) — a task
// is assigned once, so this event should never legitimately fire twice for the
// same user+task. Used to atomically claim a single send even if the underlying
// event is triggered more than once (e.g. a DB webhook firing alongside a
// client-side fallback call).
const SINGLE_FIRE_EVENTS = new Set(["task_assigned"]);

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
      else if (type === "UPDATE")  await handleTaskUpdated(record, old_record, body.actorId);
    } else if (table === "notices" && type === "INSERT") {
      await handleNoticePosted(record);
    } else if (table === "chat_messages" && type === "INSERT") {
      await handleChatMessage(record);
    } else if (type === "TASK_COMMENT") {
      await handleTaskComment(body);
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
      pushTag: `task-${task.id}`,
    }, task.tenant_id, "task_assigned", task.id);
  }
}

async function handleTaskUpdated(task: any, oldTask: any, actorId?: string) {
  const deepLink = `${APP_BASE_URL}/tasks/${task.id}`;

  // Notify recipients on any real status change (previously only Completed/
  // Closed/On Hold fired, so most updates produced no notification at all).
  if (task.status === oldTask?.status) return;

  // Include the new status in the dedup key so each distinct transition can
  // notify, while a duplicate fire of the SAME transition (DB webhook +
  // client-side fallback) is still collapsed into a single message.
  const statusRef = `${task.id}:${task.status}`;

  // Exclude whoever made the change — they don't need to be told about their
  // own action.
  const recipients = await getTaskRecipients(task, actorId);
  for (const user of recipients) {
    if (!await checkAntiSpam(user.id, task.tenant_id, "task_status", statusRef)) continue;
    await sendNotifications(user, {
      waMessage: buildStatusMessage(user.name, task.title, task.status, deepLink),
      waTemplate: { name: GENERIC_TEMPLATE_NAME, params: [task.title, `Now ${task.status}. ${deepLink}`] },
      pushTitle: `🔄 Task ${task.status}: ${task.title}`,
      pushBody: `Status updated`,
      url: deepLink,
      pushTag: `task-${task.id}`,
    }, task.tenant_id, "task_status", statusRef);
  }
  // Note: task chat messages are in a separate task_messages table, not in task.chat.
  // Chat push is handled by the TASK_COMMENT event type dispatched from the client.
}

async function handleTaskComment(body: any) {
  const { taskId, taskTitle, senderName, senderId, message, recipientIds, tenantId } = body;
  const deepLink = `${APP_BASE_URL}/tasks/${taskId}`;
  const preview = (message || "").slice(0, 80);

  for (const userId of (recipientIds || [])) {
    if (userId === senderId) continue;
    const user = await getUser(userId);
    if (!user) continue;
    if (!await checkAntiSpam(userId, tenantId, "task_chat", taskId)) continue;
    await sendNotifications(user, {
      waMessage: buildChatMessage(senderName || "Someone", taskTitle, preview, deepLink),
      waTemplate: { name: GENERIC_TEMPLATE_NAME, params: [taskTitle, `${senderName || "Someone"}: ${preview} ${deepLink}`] },
      pushTitle: `💬 ${senderName}: ${taskTitle}`,
      pushBody: preview,
      url: deepLink,
      pushTag: `task-${taskId}`,
    }, tenantId, "task_chat", taskId, false, true);
  }
}

async function handleNoticePosted(notice: any) {
  const deepLink = `${APP_BASE_URL}/notices/${notice.id}`;
  const { data: users } = await supabase.from("users").select("*").eq("tenant_id", notice.tenant_id);

  for (const user of (users || [])) {
    if (user.id === notice.created_by_user_id) continue;
    if (!await checkAntiSpam(user.id, notice.tenant_id, "notice", notice.id)) continue;
    // Push/in-app only — WhatsApp for notices stays manual, via the "Notify on WhatsApp" button.
    await sendNotifications(user, {
      waMessage: buildNoticeMessage(user.name, notice.title, notice.content?.slice(0, 100) || "", deepLink),
      waTemplate: { name: GENERIC_TEMPLATE_NAME, params: [notice.title, `${(notice.content || "").slice(0, 80)} ${deepLink}`] },
      pushTitle: `📢 ${notice.title}`,
      pushBody: notice.content?.slice(0, 80) || "",
      url: deepLink,
      pushTag: `notice-${notice.id}`,
    }, notice.tenant_id, "notice", notice.id, false, true);
  }
}

/**
 * Team Talk: new chat message. DMs notify every other member on every
 * message (small, focused audience). Channels/groups only notify users who
 * were actually @mentioned or are participants of the thread being replied
 * to — broadcasting every channel message to every member would be noise,
 * not a notification.
 */
async function handleChatMessage(msg: any) {
  if (msg.message_type === "system") return;

  const { data: channel } = await supabase
    .from("chat_channels")
    .select("*")
    .eq("id", msg.channel_id)
    .single();
  if (!channel) return;

  const recipientIds = new Set<string>();
  // Track which users get a "mention" vs regular notification title
  const mentionUserIds = new Set<string>(msg.mentioned_user_ids || []);

  // All channel types: always notify @mentioned users
  (msg.mentioned_user_ids || []).forEach((uid: string) => recipientIds.add(uid));

  if (channel.type === "dm") {
    // DMs: notify all members
    const { data: members } = await supabase
      .from("chat_members")
      .select("user_id")
      .eq("channel_id", msg.channel_id);
    (members || []).forEach((m: any) => recipientIds.add(m.user_id));
  } else {
    // Channels & rooms: notify thread participants for replies
    if (msg.thread_id) {
      const { data: participants } = await supabase
        .from("chat_thread_participants")
        .select("user_id")
        .eq("thread_id", msg.thread_id);
      (participants || []).forEach((p: any) => recipientIds.add(p.user_id));
    }
    // For main-chat messages (not thread replies) AND for ALL channel messages:
    // also notify all channel members — they need to know activity is happening.
    // Anti-spam is applied per user below, so high-traffic channels don't spam.
    const { data: members } = await supabase
      .from("chat_members")
      .select("user_id")
      .eq("channel_id", msg.channel_id);
    (members || []).forEach((m: any) => recipientIds.add(m.user_id));
  }

  recipientIds.delete(msg.sender_id);
  if (recipientIds.size === 0) return;

  const preview = msg.message_type === "voice" ? "🎤 Voice message"
    : msg.message_type === "image" ? "📷 Photo"
    : (msg.content || "").slice(0, 80);
  const deepLink = `${APP_BASE_URL}/team-talk?channel=${msg.channel_id}&msg=${msg.id}`;
  const channelLabel = channel.type === "dm" ? msg.sender_name || "Someone" : `#${channel.name}`;

  for (const userId of recipientIds) {
    const user = await getUser(userId);
    if (!user) continue;
    if (!await checkAntiSpam(userId, channel.tenant_id, "chat_message", msg.id)) continue;

    const isMentionForUser = mentionUserIds.has(userId);
    const pushTitle = isMentionForUser
      ? `🔔 ${msg.sender_name} mentioned you in ${channelLabel}`
      : msg.thread_id
        ? `💬 ${msg.sender_name} replied in ${channelLabel}`
        : `💬 ${msg.sender_name} in ${channelLabel}`;

    // Push/in-app only — WhatsApp for Team Talk messages stays manual, via the "Notify on WhatsApp" button.
    await sendNotifications(user, {
      waMessage: buildChatMessage(msg.sender_name || "Someone", channel.name, preview, deepLink),
      waTemplate: { name: GENERIC_TEMPLATE_NAME, params: [msg.sender_name || "Someone", `${preview} ${deepLink}`] },
      pushTitle,
      pushBody: preview,
      url: deepLink,
      pushTag: `chat-${msg.channel_id}`,
    }, channel.tenant_id, "chat_message", msg.id, false, true);
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
      ? `🔴 *Urgent task — Horae*\n\nHi ${user.name.split(" ")[0]},\n*${record.title}*\nImmediate action required.\n\n👉 ${deepLink}`
      : kind === "notice"
      ? `🔴 *Urgent notice — Horae*\n\nHi ${user.name.split(" ")[0]},\n*${record.title}*\n\n👉 ${deepLink}`
      : `🔴 *Urgent message — Horae*\n\nHi ${user.name.split(" ")[0]},\n${record.senderName ? `${record.senderName}: ` : ""}"${record.title}"\n\n👉 ${deepLink}`;

    await sendNotifications(user, {
      waMessage,
      waTemplate: { name: GENERIC_TEMPLATE_NAME, params: [record.title, `Urgent — Immediate action needed. ${deepLink}`] },
      pushTitle: kind === "task" ? `🔴 Urgent task: ${record.title}` : `🔴 Urgent notice: ${record.title}`,
      pushBody: "Immediate action needed",
      url: deepLink,
      pushTag: `urgent-${kind}-${record.id}`,
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

  // Single-fire events (e.g. task_assigned) can be triggered more than once by
  // the app (DB webhook + client-side fallback). Atomically claim the send so
  // only the first caller ever actually proceeds, regardless of how many times
  // the event fires or how close together the calls arrive.
  if (SINGLE_FIRE_EVENTS.has(eventType) && refId) {
    const claimed = await claimEventOnce(userId, eventType, refId);
    if (!claimed) {
      await logNotif(userId, tenantId, "debug", refId, "whatsapp", "failed", `checkAntiSpam: Duplicate ${eventType} event blocked by claim lock`);
      console.log(`[checkAntiSpam] Blocked duplicate ${eventType} for user ${userId} (already claimed)`);
      return false;
    }
  }

  // NOTE: the daily WhatsApp cap is enforced in sendNotifications, NOT here.
  // It is a WhatsApp-only limit; enforcing it here returned false and skipped
  // BOTH channels, so hitting the WA cap silently killed push too.

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
}, tenantId: string, eventType: string, refId: string, isUrgent: boolean = false, pushOnly: boolean = false) {
  const promises: Promise<void>[] = [];

  if (!pushOnly && user.phone_number && user.whatsapp_opted_in && !DISABLE_WHATSAPP) {
    // Daily WhatsApp cap — enforced here (WhatsApp-only) so it never suppresses
    // push. Counts only real sends (event_type != 'debug') so diagnostic rows
    // can't inflate the count and lock the user out.
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await supabase.from("notification_log")
      .select("id", { count: "exact" })
      .eq("user_id", user.id).eq("channel", "whatsapp").eq("status", "sent")
      .neq("event_type", "debug")
      .gte("sent_at", today + "T00:00:00Z");
    if ((count || 0) < MAX_MESSAGES_PER_USER_DAY) {
      promises.push(
        sendWhatsApp(user.phone_number, payload.waMessage, payload.waTemplate)
          .then(() => logNotif(user.id, tenantId, eventType, refId, "whatsapp", "sent", undefined, isUrgent))
          .catch(e => logNotif(user.id, tenantId, eventType, refId, "whatsapp", "failed", String(e), isUrgent))
      );
    }
  }

  if (user.fcm_token) {
    promises.push(
      sendWebPush(user.fcm_token, payload)
        .then(() => logNotif(user.id, tenantId, eventType, refId, "webpush", "sent", undefined, isUrgent))
        .catch(async e => {
          const msg = String(e);
          if (msg.includes("WebPush 410") || msg.includes("WebPush 404")) {
            // Subscription is dead — clear it so the client re-prompts the
            // user for notification permission next session instead of
            // silently failing forever.
            await supabase.from("users").update({ fcm_token: null }).eq("id", user.id);
          }
          await logNotif(user.id, tenantId, eventType, refId, "webpush", "failed", msg, isUrgent);
        })
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

// ─── Web Push (VAPID via the web-push library) ───────────────────────────────
// Uses the battle-tested `web-push` package for RFC 8291 aes128gcm encryption
// + VAPID signing. The previous hand-rolled implementation sent a
// `Content-Encoding: aes128gcm` header but derived the encryption keys with
// the legacy "aesgcm" scheme (wrong HKDF info strings), so browsers could
// never decrypt the payload — no push ever arrived on any device.

async function sendWebPush(subscriptionJson: string, payload: {
  pushTitle: string;
  pushBody: string;
  url: string;
  pushTag?: string;
}): Promise<void> {
  const subscription = JSON.parse(subscriptionJson);

  const messagePayload = JSON.stringify({
    title: payload.pushTitle,
    body: payload.pushBody,
    url: payload.url,
    icon: "/app-icon.jpg",
    badge: "/app-icon.jpg",
    tag: payload.pushTag || "horae-notif",
  });

  try {
    await webpush.sendNotification(subscription, messagePayload, {
      TTL: 86400,
      vapidDetails: {
        subject: VAPID_SUBJECT,
        publicKey: VAPID_PUBLIC_KEY,
        privateKey: VAPID_PRIVATE_KEY,
      },
    });
  } catch (err: any) {
    // Normalize to the "WebPush <status>" shape the caller relies on to detect
    // dead subscriptions (410 Gone / 404 Not Found) and clear the token.
    const status = err?.statusCode;
    if (status) throw new Error(`WebPush ${status}: ${err?.body || err?.message || ""}`);
    throw err;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getUser(userId: string) {
  const { data } = await supabase.from("users").select("*").eq("id", userId).single();
  return data;
}

// Atomically claims a single-fire notification event for a user. Returns true
// if this call won the claim (proceed with sending), false if another call
// already claimed it (a duplicate trigger — skip sending).
async function claimEventOnce(userId: string, eventType: string, refId: string): Promise<boolean> {
  const { error } = await supabase.from("notification_claims").insert([{
    user_id: userId, event_type: eventType, reference_id: refId,
  }]);
  if (!error) return true;
  // Postgres unique_violation — someone else already claimed this event.
  if ((error as any).code === "23505") return false;
  // Unexpected error (e.g. table missing) — fail open so we don't silently
  // drop legitimate notifications if the migration hasn't been applied yet.
  console.error("[claimEventOnce] Unexpected error, failing open:", error);
  return true;
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
