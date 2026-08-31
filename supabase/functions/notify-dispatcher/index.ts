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

// Template routing — two approved Utility templates ship WhatsApp:
//   • horae_task_alert — task assignments, reassignments, urgent task pings ONLY.
//   • notice_alert     — the generic 2-variable template ("Update for your outlet:
//     {{1}} / {{2}} / Hi for more details"), used for the morning digest nudge.
// Everything else — notices, task CC/status/chat, training, checklist, the full
// digest body — stays push + in-app ONLY (no waTemplate).
const TASK_TEMPLATE_NAME   = "horae_task_alert";
const DIGEST_TEMPLATE_NAME = "notice_alert";

// ─── Plan B: push-first, WhatsApp only as last-mile fallback ───────────────────
// WhatsApp is paid; web push is free. So paid WhatsApp is sent ONLY for:
//   • 'urgent' events (immediate WhatsApp + push, in parallel), and
//   • the daily digest to users whose push pipe looks dead (the digest is the
//     safety net that catches everything the free channels missed).
// Every other ('normal') event goes push + in-app only — no paid message — and
// anything unread is swept up by the next digest. See horae-whatsapp-flows-build.
const EVENT_TIERS: Record<string, "urgent" | "normal"> = {
  urgent_push:        "urgent",
  task_assigned:      "urgent", // user choice: new-task assignment always pings WhatsApp
  task_reassigned:    "urgent", // escalation to a new primary owner pings WhatsApp
  task_cc:            "normal", // CC users: push + digest only, never WhatsApp
  task_status:        "normal",
  task_chat:          "normal",
  notice:             "normal", // app push + in-app ONLY (notice template flagged Marketing by Meta)
  training_published: "normal",
  checklist_posted:   "normal",
  daily_digest:       "normal", // push + in-app ONLY — never WhatsApp (digest content = Marketing category, too costly)
};

// Days since the last service-worker push ack before we treat a user's push as
// dead and route their digest to WhatsApp instead.
const PUSH_HEALTH_DAYS = 3;

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
      // Only a NEW task assignment notifies. Status changes and task-chat
      // messages deliberately do NOT push/WhatsApp (chats surface in the daily
      // digest instead); handleTaskUpdated/handleTaskComment are left defined
      // but intentionally unrouted.
      if (type === "INSERT") await handleTaskAssigned(record);
    } else if (table === "notices" && type === "INSERT") {
      await handleNoticePosted(record);
    } else if (table === "trainings") {
      // Fire once, when a training becomes published: either it is inserted
      // already-published, or a draft is flipped published=true on update.
      if (type === "INSERT" && record?.published) await handleTrainingPublished(record);
      else if (type === "UPDATE" && record?.published && !old_record?.published) await handleTrainingPublished(record);
    } else if (table === "checklists" && type === "INSERT") {
      await handleChecklistPosted(record);
    } else if (type === "DIGEST") {
      await handleDigest(body.userId, body.tenantId, body.items, body.runMode);
    } else if (type === "URGENT_PUSH") {
      await handleUrgentPush(body.kind, body.record, body.userIds, body.tenantId);
    } else if (type === "TASK_REASSIGNED") {
      await handleTaskReassigned(body.record, body.newPrimaryId, body.actorName);
    } else if (type === "NUDGE") {
      await handleMorningNudge(body.userId, body.tenantId, body.summary);
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
  const primaryIds: string[] = task.assigned_user_ids || (task.assigned_user_id ? [task.assigned_user_id] : []);
  const ccIds: string[] = (task.cc_user_ids || []).filter((id: string) => !primaryIds.includes(id));
  const deepLink = `${APP_BASE_URL}/tasks/${task.id}`;

  // PRIMARY assignees — paid WhatsApp ping (+ push + in-app). task_assigned is
  // the "urgent" tier, so whatsappAllowedForEvent() lets the WhatsApp through.
  for (const userId of primaryIds) {
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
        name: TASK_TEMPLATE_NAME,
        params: [task.title, details]
      },
      pushTitle: `🔔 New Task: ${task.title}`,
      pushBody: `Priority: ${task.priority}`,
      url: deepLink,
      pushTag: `task-${task.id}`,
    }, task.tenant_id, "task_assigned", task.id);
  }

  // CC users — push + in-app ONLY (pushOnly=true forces no WhatsApp, so the cost
  // of a fan-out task stays at just the primary assignees). Anything they miss is
  // swept up by the daily digest.
  for (const userId of ccIds) {
    const user = await getUser(userId);
    if (!user) continue;
    if (!await checkAntiSpam(userId, task.tenant_id, "task_cc", task.id)) continue;
    await sendNotifications(user, {
      waMessage: buildTaskAssignedMessage(user.name, task.title, task.priority, task.due_date, deepLink),
      pushTitle: `👀 CC — New Task: ${task.title}`,
      pushBody: `Priority: ${task.priority}`,
      url: deepLink,
      pushTag: `task-${task.id}`,
    }, task.tenant_id, "task_cc", task.id, false, true);
  }
}

// Escalation / reassignment: the NEW primary gets a paid WhatsApp ping (urgent).
// The previous primary was already dropped to CC by store.reassignTask, so they
// simply stop getting WhatsApp from here on.
async function handleTaskReassigned(task: any, newPrimaryId: string, actorName: string) {
  if (!newPrimaryId) return;
  const user = await getUser(newPrimaryId);
  if (!user) return;
  const deepLink = `${APP_BASE_URL}/tasks/${task.id}`;
  // Dedup key changes per (task, new owner) so each distinct handoff can notify.
  const refId = `${task.id}:${newPrimaryId}`;
  if (!await checkAntiSpam(newPrimaryId, task.tenant_id, "task_reassigned", refId)) return;

  const who = actorName || "A colleague";
  await sendNotifications(user, {
    waMessage: `🔀 *Task reassigned to you — Horae*\n\nHi ${user.name.split(" ")[0]},\n${who} handed you:\n*${task.title}*\nPriority: ${task.priority} | Due: ${task.due_date}\n\n👉 ${deepLink}`,
    waTemplate: { name: TASK_TEMPLATE_NAME, params: [task.title, `Reassigned to you by ${who}. ${deepLink}`] },
    pushTitle: `🔀 Task reassigned to you: ${task.title}`,
    pushBody: `From ${who} · Priority: ${task.priority}`,
    url: deepLink,
    pushTag: `task-${task.id}`,
  }, task.tenant_id, "task_reassigned", refId, true);
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
    // Notices are APP PUSH + in-app ONLY (notice tier = "normal", so no WhatsApp).
    // Meta flagged the notice template Marketing, so we don't send it over WhatsApp.
    await sendNotifications(user, {
      waMessage: buildNoticeMessage(user.name, notice.title, notice.content?.slice(0, 100) || "", deepLink),
      pushTitle: `📢 ${notice.title}`,
      pushBody: notice.content?.slice(0, 80) || "",
      url: deepLink,
      pushTag: `notice-${notice.id}`,
    }, notice.tenant_id, "notice", notice.id, false, true);
  }
}

async function handleTrainingPublished(training: any) {
  const deepLink = `${APP_BASE_URL}/training`;
  const audience = await getTrainingAudience(training);
  for (const user of audience) {
    if (user.id === training.created_by) continue;
    // Log/dedup under the user's own outlet so a multi-outlet training reports
    // correctly per tenant.
    if (!await checkAntiSpam(user.id, user.tenant_id, "training_published", training.id)) continue;
    await sendNotifications(user, {
      waMessage: buildTrainingMessage(user.name, training.title, deepLink),
      pushTitle: `📚 New Training: ${training.title}`,
      pushBody: "Tap to start your training",
      url: deepLink,
      pushTag: `training-${training.id}`,
    }, user.tenant_id, "training_published", training.id);
  }
}

async function handleChecklistPosted(checklist: any) {
  // The checklists table is overloaded — SOPs and some quizzes are stored here
  // as JSON in `description`. Only notify for real compliance checklists.
  try {
    if (typeof checklist.description === "string" && checklist.description.startsWith("{")) {
      const obj = JSON.parse(checklist.description);
      if (obj.type === "sop" || obj.type === "quiz") return;
    }
  } catch { /* legacy plain-text description — treat as a real checklist */ }

  const title = checklist.title || "New checklist";
  const deepLink = `${APP_BASE_URL}/checklists/${checklist.id}`;
  const { data: users } = await supabase.from("users").select("*").eq("tenant_id", checklist.tenant_id);
  for (const user of (users || [])) {
    if (user.id === checklist.created_by || user.id === checklist.created_by_user_id) continue;
    if (!await checkAntiSpam(user.id, checklist.tenant_id, "checklist_posted", checklist.id)) continue;
    await sendNotifications(user, {
      waMessage: buildChecklistMessage(user.name, title, deepLink),
      pushTitle: `✅ New Checklist: ${title}`,
      pushBody: "Tap to complete your checklist",
      url: deepLink,
      pushTag: `checklist-${checklist.id}`,
    }, checklist.tenant_id, "checklist_posted", checklist.id);
  }
}

// Resolves the staff a training targets, mirroring trainingMatchesUser() in
// src/services/trainingService.ts: outlets ([] = all of the client's outlets),
// then 'All Departments'/'All Roles' wildcards.
async function getTrainingAudience(training: any): Promise<any[]> {
  let tenantIds: string[] = Array.isArray(training.outlets) ? training.outlets : [];
  if (tenantIds.length === 0) {
    const { data: tenants } = await supabase.from("tenants").select("id").eq("client_id", training.client_id);
    tenantIds = (tenants || []).map((t: any) => t.id);
  }
  if (tenantIds.length === 0) return [];

  const { data: users } = await supabase.from("users").select("*").in("tenant_id", tenantIds);
  const dept = String(training.department || "All Departments");
  const role = String(training.role || "All Roles");
  return (users || []).filter((u: any) =>
    (dept === "All Departments" || String(u.department) === dept) &&
    (role === "All Roles" || String(u.role) === role)
  );
}

/**
 * Morning "reply Hi" nudge — a single Utility WhatsApp on the generic
 * notice_alert template that prompts the staff member to reply Hi and get their
 * full briefing FREE inside the window they open by replying. (Its wording is
 * more generic than horae_task_alert, which we reserve for real task alerts.)
 * Sent by daily-digest's morning run ONLY to users who actually have pending
 * items (so it's genuinely transactional, not a blast). Respects opt-in + the
 * daily cap. This is the only scheduled paid ping.
 */
async function handleMorningNudge(userId: string, tenantId: string, summary: string) {
  const user = await getUser(userId);
  if (!user || !user.phone_number || !user.whatsapp_opted_in || DISABLE_WHATSAPP) return;

  // Daily WhatsApp cap (real sends only) — never exceed it with the nudge.
  const today = new Date().toISOString().slice(0, 10);
  const { count } = await supabase.from("notification_log")
    .select("id", { count: "exact" })
    .eq("user_id", user.id).eq("channel", "whatsapp").eq("status", "sent")
    .neq("event_type", "debug").gte("sent_at", today + "T00:00:00Z");
  if ((count || 0) >= MAX_MESSAGES_PER_USER_DAY) return;

  // notice_alert renders: "Update for your outlet: {{1}} / {{2}} / Hi for more
  // details". {{1}} = short headline, {{2}} = the pending-items summary. The
  // template's static last line already prompts the reply-Hi that opens the
  // free window, so we don't repeat it here.
  try {
    const wamid = await sendWhatsApp(user.phone_number, "", { name: DIGEST_TEMPLATE_NAME, params: ["your morning briefing", summary] });
    await logNotif(user.id, tenantId, "morning_nudge", `nudge-${today}`, "whatsapp", "sent", undefined, false, wamid);
  } catch (e) {
    await logNotif(user.id, tenantId, "morning_nudge", `nudge-${today}`, "whatsapp", "failed", String(e));
  }
}

async function handleDigest(userId: string, tenantId: string, items: any, runMode: "morning" | "evening" = "morning") {
  const user = await getUser(userId);
  if (!user) return;

  const firstName = user.name.split(" ")[0];
  const parts: string[] = runMode === "evening"
    ? [`Evening wrap-up, ${firstName} 🌙\n`]
    : [`Good morning ${firstName}! Your Horae briefing 🌅\n`];

  // One line per feature. Chats/comments are placed high and flagged with a 🔔
  // so a staff member never scrolls past them — they're the thing most easily
  // missed (they don't push on their own; they only surface in the digest).
  const taskLead = runMode === "morning" ? "due today" : "still open — check before tomorrow";
  const sections: string[] = [];
  if (items.tasks?.length)      sections.push(`📋 TASKS · ${items.tasks.length} ${taskLead}`);
  if (items.chats?.length)      sections.push(`🔔 CHATS · ${items.chats.length} new on your tasks — latest from ${items.chats[0].sender_name}`);
  if (items.checklists?.length) sections.push(`✅ CHECKLISTS · "${items.checklists[0].title}"${items.checklists.length > 1 ? ` +${items.checklists.length - 1} more` : ""} pending`);
  if (items.training?.length)   sections.push(`📚 TRAINING · ${items.training.length} pending — "${items.training[0].title}"`);
  if (items.notices?.length)    sections.push(`📢 NOTICES · "${items.notices[0].title}"${items.notices.length > 1 ? ` +${items.notices.length - 1} more` : ""}`);
  if (sections.length === 0) return;

  const deepLink = `${APP_BASE_URL}/digest`;

  // Digest is push + in-app ONLY (no WhatsApp — see EVENT_TIERS.daily_digest), so
  // no template; waMessage is kept for the push body / any future in-window use.
  const waMessage = `${parts[0]}\n${sections.join("\n")}\n\n👉 Open Horae: ${deepLink}`;

  await sendNotifications(user, {
    waMessage,
    pushTitle: runMode === "evening" ? "🌙 Your Horae Evening Wrap-up" : "📋 Your Horae Morning Briefing",
    pushBody: `${items.tasks?.length || 0} tasks · ${items.chats?.length || 0} chats · ${items.checklists?.length || 0} checklists · ${items.training?.length || 0} training · ${items.notices?.length || 0} notices`,
    url: deepLink,
    pushTag: "horae-digest",
  }, tenantId, "daily_digest", `digest-${runMode}-` + new Date().toISOString().slice(0, 10));
}

async function handleUrgentPush(kind: "task" | "notice" | "training", record: any, userIds: string[], tenantId: string) {
  if (!record || !userIds?.length) return;
  const deepLink = kind === "task" ? `${APP_BASE_URL}/tasks/${record.id}`
    : kind === "training" ? `${APP_BASE_URL}/training`
    : `${APP_BASE_URL}/notices/${record.id}`;

  for (const userId of userIds) {
    const user = await getUser(userId);
    if (!user) continue;
    // Training reminders are opt-in nudges, not one-shot urgent events — use a
    // dedup key that changes per calendar day so a reminder can be re-sent later.
    const refId = kind === "training" ? `${record.id}:${new Date().toISOString().slice(0, 10)}` : record.id;
    if (!await checkAntiSpam(userId, tenantId, "urgent_push", refId)) continue;

    const waMessage = kind === "task"
      ? `🔴 *Urgent task — Horae*\n\nHi ${user.name.split(" ")[0]},\n*${record.title}*\nImmediate action required.\n\n👉 ${deepLink}`
      : kind === "training"
      ? `📚 *Training reminder — Horae*\n\nHi ${user.name.split(" ")[0]},\nPlease complete your training: *${record.title}*.\n\n👉 ${deepLink}`
      : `🔴 *Urgent notice — Horae*\n\nHi ${user.name.split(" ")[0]},\n*${record.title}*\n\n👉 ${deepLink}`;

    await sendNotifications(user, {
      waMessage,
      // Task/training urgent pings go WhatsApp on the Utility task template.
      // Notices are app-push-only, so pushOnly is set for them below (no template).
      waTemplate: { name: TASK_TEMPLATE_NAME, params: [record.title, kind === "training" ? `Training to complete. ${deepLink}` : `Urgent — Immediate action needed. ${deepLink}`] },
      pushTitle: kind === "task" ? `🔴 Urgent task: ${record.title}`
        : kind === "training" ? `📚 Training: ${record.title}`
        : `🔴 Urgent notice: ${record.title}`,
      pushBody: kind === "training" ? "Tap to complete your training" : "Immediate action needed",
      url: deepLink,
      pushTag: `urgent-${kind}-${record.id}`,
    }, tenantId, "urgent_push", refId, true, kind === "notice");
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

// ─── Plan B channel routing ────────────────────────────────────────────────────

/** Is this user's web-push pipe alive? Used to decide whether the digest (the
 *  fallback carrier) needs to go via paid WhatsApp. `last_push_ack_at` is null
 *  until the service worker acks its first push — during that grace period we
 *  trust the token's presence so a freshly-onboarded user isn't over-messaged. */
function pushHealthy(user: any): boolean {
  if (!user.fcm_token) return false;
  if (!user.last_push_ack_at) return true; // grace: no telemetry yet
  return (Date.now() - new Date(user.last_push_ack_at).getTime()) < PUSH_HEALTH_DAYS * 86400000;
}

/** Whether a paid WhatsApp message is allowed for this event+user under Plan B. */
function whatsappAllowedForEvent(eventType: string, user: any): boolean {
  // Urgent-tier events — new task, reassignment, notice, and now the daily
  // digest (user priority) — always send WhatsApp in addition to push. Everything
  // else (task_cc, status, chat, training, checklist) is push + in-app only.
  // NOTE: pushHealthy() is retained as telemetry but no longer gates the digest.
  return (EVENT_TIERS[eventType] || "normal") === "urgent";
}

// ─── Demo guard ───────────────────────────────────────────────────────────────
// Resolve tenant → client → is_demo, cached per invocation. Demo clients must
// never spend a paid WhatsApp message (see the guard in sendNotifications).
const _demoTenantCache = new Map<string, boolean>();
async function isDemoTenant(tenantId: string): Promise<boolean> {
  if (!tenantId) return false;
  const cached = _demoTenantCache.get(tenantId);
  if (cached !== undefined) return cached;
  let isDemo = false;
  try {
    const { data: tenant } = await supabase.from("tenants").select("client_id").eq("id", tenantId).single();
    if (tenant?.client_id) {
      const { data: client } = await supabase.from("clients").select("is_demo").eq("id", tenant.client_id).single();
      isDemo = !!client?.is_demo;
    }
  } catch (_e) { /* fail open to "not demo" — WhatsApp gating has other belts */ }
  _demoTenantCache.set(tenantId, isDemo);
  return isDemo;
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

  // Plan B gate: only spend a paid WhatsApp message when the event tier warrants
  // it (urgent), or when it's the digest fallback to a push-dead user. `pushOnly`
  // still forces a push-only send regardless.
  const waAllowed = whatsappAllowedForEvent(eventType, user);
  // Demo workspaces never send paid WhatsApp — a prospect could add staff with
  // real numbers, so this client-level guard is the reliable belt (push still flows).
  if (waAllowed && !pushOnly && user.phone_number && user.whatsapp_opted_in && !DISABLE_WHATSAPP && !(await isDemoTenant(tenantId))) {
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
          .then(waMessageId => logNotif(user.id, tenantId, eventType, refId, "whatsapp", "sent", undefined, isUrgent, waMessageId))
          .catch(e => logNotif(user.id, tenantId, eventType, refId, "whatsapp", "failed", String(e), isUrgent))
      );
    }
  }

  if (user.fcm_token) {
    promises.push(
      sendWebPush(user.fcm_token, payload, user.id, tenantId)
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

/** Returns the Meta WhatsApp message id (WAMID) for the send, so delivery/
 * read receipts arriving later on the webhook can be matched back to this
 * exact notification_log row. */
async function sendWhatsApp(phone: string, message: string, template?: { name: string, params: string[] }): Promise<string | undefined> {
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
  const data = await res.json().catch(() => null);
  return data?.messages?.[0]?.id;
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
}, userId?: string, tenantId?: string): Promise<void> {
  const subscription = JSON.parse(subscriptionJson);

  const messagePayload = JSON.stringify({
    title: payload.pushTitle,
    body: payload.pushBody,
    url: payload.url,
    icon: "/app-icon.jpg",
    badge: "/app-icon.jpg",
    tag: payload.pushTag || "horae-notif",
    // Plan B: the service worker echoes these back to push-ack when the push is
    // actually delivered/opened, which stamps users.last_push_ack_at — our only
    // proof a push reached the device (see pushHealthy()).
    userId,
    tenantId,
    ackUrl: `${SUPABASE_URL}/functions/v1/push-ack`,
  });

  try {
    await webpush.sendNotification(subscription, messagePayload, {
      TTL: 86400,
      // High urgency tells the push service (FCM) to deliver the message
      // immediately even when the device is in Doze / battery-saver. Aggressive
      // Android OEMs (esp. Xiaomi/MIUI) silently defer or drop "normal" urgency
      // pushes once the app has been idle in the background — the send is
      // accepted (201) but the service worker is never woken to show it.
      // Use the library's `urgency` option (the documented way) so it isn't
      // overridden by web-push's own default Urgency header.
      urgency: "high",
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

async function logNotif(userId: string, tenantId: string, eventType: string, refId: string, channel: string, status: string, error?: string, isUrgent: boolean = false, waMessageId?: string) {
  await supabase.from("notification_log").insert([{
    user_id: userId, tenant_id: tenantId, event_type: eventType,
    reference_id: refId, channel, status, error_message: error, is_urgent: isUrgent,
    wa_message_id: waMessageId,
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
function buildTrainingMessage(name: string, title: string, link: string) {
  return `📚 *New Training — Horae*\n\nHi ${name.split(" ")[0]},\nA new training is assigned to you:\n*${title}*\n\n👉 ${link}`;
}
function buildChecklistMessage(name: string, title: string, link: string) {
  return `✅ *New Checklist — Horae*\n\nHi ${name.split(" ")[0]},\nA new checklist is ready for you:\n*${title}*\n\n👉 ${link}`;
}
