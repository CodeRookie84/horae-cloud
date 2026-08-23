/**
 * Supabase Edge Function: whatsapp-webhook
 *
 * Receives callbacks from Meta's WhatsApp Cloud API for the same business
 * number notify-dispatcher sends from:
 *  - GET  → webhook verification handshake (one-time, when registering the URL).
 *  - POST → `statuses` events (delivered/read/failed receipts) and `messages`
 *           events (inbound replies + the interactive task-capture flow).
 *
 * Inbound flows (all happen inside the 24-hr customer-service window the user
 * opens by messaging us, so free-form replies + interactive buttons are allowed
 * and free):
 *   #1 Forward/paste a message → we offer [Create Task] / [Dismiss] buttons →
 *      tapping Create Task stores a task_capture and replies with a prefilled
 *      /tasks/new?capture={id} link.
 *   #2 "new task" (text or voice note) → we transcribe voice via Whisper, store
 *      a task_capture, and reply with the same prefilled link.
 *
 * Meta requires a fast 200, and voice transcription is slow, so we acknowledge
 * immediately and finish the work via EdgeRuntime.waitUntil when available.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { transcribeAudio } from "../_shared/ai.ts";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFY_TOKEN      = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN")!;
const META_WA_TOKEN     = Deno.env.get("META_WA_TOKEN")!;
const META_PHONE_NUM_ID = Deno.env.get("META_PHONE_NUMBER_ID")!;
const APP_BASE_URL      = Deno.env.get("APP_BASE_URL") || "https://horae.cloud";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    // Meta's one-time verification handshake.
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: any = null;
  try { body = await req.json(); } catch { /* empty body — just 200 below */ }

  // Acknowledge Meta immediately; finish processing out-of-band so a slow
  // Whisper call can never make the webhook time out and get disabled.
  if (body) {
    const work = processWebhook(body).catch((err) =>
      console.error("[whatsapp-webhook] processing error:", err));
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(work);
    else await work; // local/dev fallback where waitUntil isn't available
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function processWebhook(body: any) {
  for (const entry of (body?.entry || [])) {
    for (const change of (entry.changes || [])) {
      const value = change.value || {};
      if (Array.isArray(value.statuses)) {
        for (const s of value.statuses) await handleStatus(s);
      }
      if (Array.isArray(value.messages)) {
        for (const m of value.messages) await handleInboundMessage(m, value.contacts?.[0]);
      }
    }
  }
}

/** A delivery/read/failed receipt for a message Horae previously sent. */
async function handleStatus(s: any) {
  const wamid = s?.id;
  const status = s?.status; // 'sent' | 'delivered' | 'read' | 'failed'
  if (!wamid || !status) return;

  const ts = s.timestamp ? new Date(Number(s.timestamp) * 1000).toISOString() : new Date().toISOString();
  const updates: Record<string, any> = {};
  if (status === "delivered") updates.delivered_at = ts;
  if (status === "read") updates.read_at = ts;
  if (status === "failed") updates.status = "failed";
  if (Object.keys(updates).length === 0) return;

  const { error } = await supabase
    .from("notification_log")
    .update(updates)
    .eq("wa_message_id", wamid);
  if (error) console.error("[whatsapp-webhook] status update failed:", error);
}

/** An inbound message from a staff member's phone to the Horae WhatsApp number. */
async function handleInboundMessage(m: any, contact: any) {
  const fromPhone: string = m?.from || contact?.wa_id || "";
  if (!fromPhone) return;

  // Idempotency: Meta re-delivers webhooks on any non-200/timeout. Skip a
  // message id we've already recorded so button taps don't create duplicates.
  if (m?.id) {
    const { data: seen } = await supabase
      .from("whatsapp_inbound_messages").select("id").eq("wa_message_id", m.id).limit(1);
    if (seen && seen.length) return;
  }

  const receivedAt = m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString();
  const contextWamid: string | undefined = m?.context?.id;

  // Resolve to a Horae user by the last 10 digits of their phone number — same
  // convention store.ts's normalizePhone() uses for login matching.
  const last10 = fromPhone.replace(/\D/g, "").slice(-10);
  let userId: string | null = null;
  let tenantId: string | null = null;
  if (last10.length === 10) {
    const { data: matched } = await supabase
      .from("users").select("id, tenant_id").like("phone_number", `%${last10}`).limit(1);
    if (matched && matched[0]) { userId = matched[0].id; tenantId = matched[0].tenant_id; }
  }

  // Log every inbound (also our dedup key above).
  const bodyText: string = m?.text?.body ?? (m?.type ? `[${m.type}]` : "");
  await supabase.from("whatsapp_inbound_messages").insert([{
    wa_message_id: m?.id, from_phone: fromPhone, user_id: userId, tenant_id: tenantId,
    body: bodyText, context_wa_message_id: contextWamid, received_at: receivedAt,
  }]);

  // Only registered staff can drive the capture flows.
  if (!userId) return;

  // ── Route by message type ───────────────────────────────────────────────────
  // Interactive replies: main-menu list selections + capture-menu button taps.
  if (m.type === "interactive") {
    const listId = m.interactive?.list_reply?.id;
    if (listId) {
      // "tpick~<taskId>" = a task chosen from the menu's status-update picker →
      // show its status list. "ts~<taskId>~<status>" = a status chosen from that
      // list → apply it. Everything else is a main-menu selection.
      if (listId.startsWith("tpick~")) { await sendTaskStatusList(fromPhone, listId.slice(6)); return; }
      if (listId.startsWith("ts~")) { await handleTaskStatusUpdate(listId, fromPhone, userId); return; }
      await handleMenuSelection(listId, fromPhone, userId, tenantId); return;
    }
    if (m.interactive?.button_reply?.id) { await handleButtonReply(m, fromPhone, userId, tenantId); return; }
    return;
  }

  // Quick-reply button tap on a business TEMPLATE (e.g. "Done ✅" on a task
  // alert, or "Got it 👍" on the digest). Arrives as type "button" with
  // context.id = the alert's WAMID. The tap itself already re-opened the free
  // 24-hour window (the whole point); here we also action it.
  if (m.type === "button") {
    await handleTemplateButtonTap(m, fromPhone, userId, tenantId);
    return;
  }

  // If the user just chose "Create a task"/"Raise a complaint" from the menu,
  // their next text/voice message IS the content — consume it here.
  if (m.type === "text" || m.type === "audio") {
    const pending = await takePendingInput(userId);
    if (pending) {
      const rawText = m.type === "text" ? (m.text?.body || "").trim() : "";
      if (/^\s*(cancel|menu|back|stop)\b/i.test(rawText)) { await sendMainMenu(fromPhone); return; }
      let content = rawText;
      if (m.type === "audio" && m.audio?.id) {
        content = await transcribeVoice(m.audio.id);
        if (!content) { await sendText(fromPhone, "🎙️ I couldn't read that voice note. Please type it instead."); return; }
      }
      const isComplaint = pending.intent === "complaint";
      await createCaptureAndReply(fromPhone, userId, tenantId, isComplaint ? "whatsapp_complaint" : "whatsapp_newtask", content, isComplaint);
      return;
    }
  }

  if (m.type === "audio" && m.audio?.id) {
    const transcript = await transcribeVoice(m.audio.id);
    if (!transcript) {
      await sendText(fromPhone, "🎙️ I couldn't read that voice note. Please type the task, or send it again.");
      return;
    }
    await createCaptureAndReply(fromPhone, userId, tenantId, "whatsapp_voice", transcript);
    return;
  }

  if (m.type === "text") {
    const text = (m.text?.body || "").trim();
    if (!text) return;
    // "new task ..." (or "newtask ...") → straight to a prefilled capture link.
    const newTask = text.match(/^\s*new\s*task\b[:\-\s]*(.*)$/is);
    if (newTask) {
      const content = (newTask[1] || "").trim();
      await createCaptureAndReply(fromPhone, userId, tenantId, "whatsapp_newtask", content);
      return;
    }
    // Greeting / "menu" → show the tappable main menu.
    if (text.length <= 12 && /^\s*(hi|hai|hey|hello|menu|start)\b/i.test(text)) {
      await sendMainMenu(fromPhone);
      return;
    }
    // "help" / "?" → the plain-text guide.
    if (text.length <= 8 && /^\s*(help|\?)/i.test(text)) {
      await sendHelp(fromPhone, userId);
      return;
    }
    // Any other free text (e.g. a forwarded message) → offer the action menu.
    await offerCaptureMenu(fromPhone, userId, tenantId, text);
    return;
  }

  // Media (image/document/video) — can't be actioned yet; nudge to text.
  if (["image", "document", "video"].includes(m.type)) {
    await sendText(fromPhone, "📎 I can't turn attachments into tasks yet. Send the details as *text*, or *\"new task …\"*, or forward a text message.");
    return;
  }
  // Everything else (reactions, location, contacts, …) is logged, no reply.
}

// ── Main menu (WhatsApp interactive list) ─────────────────────────────────────

/** Show the tappable action menu. Buttons cap at 3, so this uses a list. */
async function sendMainMenu(fromPhone: string) {
  await sendList(
    fromPhone,
    "👋 *Horae* — what would you like to do?",
    "Choose",
    [
      { id: "menu_create_task",   title: "📋 Create a task" },
      { id: "menu_complaint",     title: "⚠️ Raise a complaint" },
      { id: "menu_update_status", title: "🔄 Update task status" },
      { id: "menu_view_tasks",    title: "📋 View my tasks" },
      { id: "menu_help",          title: "❓ Help" },
    ],
  );
}

/** Dispatch a main-menu list selection. */
async function handleMenuSelection(id: string, fromPhone: string, userId: string, tenantId: string | null) {
  switch (id) {
    case "menu_create_task":   await startAwaitingInput(fromPhone, userId, tenantId, "create_task"); break;
    case "menu_complaint":     await startAwaitingInput(fromPhone, userId, tenantId, "complaint"); break;
    case "menu_update_status": await sendTaskPickerForStatus(fromPhone, userId, tenantId); break;
    case "menu_view_tasks":    await sendOpenTasksList(fromPhone, userId, tenantId, "view"); break;
    case "menu_help":          await sendHelp(fromPhone, userId); break;
    default:                   await sendMainMenu(fromPhone);
  }
}

/** Remember that we're waiting for the user's task/complaint details, and ask. */
async function startAwaitingInput(fromPhone: string, userId: string, tenantId: string | null, intent: string) {
  await supabase.from("whatsapp_conversations").insert([{
    user_id: userId, tenant_id: tenantId, from_phone: fromPhone,
    state: "awaiting_input", intent,
  }]);
  await sendText(
    fromPhone,
    intent === "complaint"
      ? "⚠️ Please describe the complaint or issue. You can type it or send a voice note.\n\n(Reply *cancel* to go back.)"
      : "📋 Please send the task details. You can type them or send a voice note.\n\n(Reply *cancel* to go back.)",
  );
}

/** Atomically claim the user's latest pending "awaiting_input" state (or null). */
async function takePendingInput(userId: string): Promise<{ id: string; intent: string } | null> {
  const { data } = await supabase.from("whatsapp_conversations")
    .select("id, intent")
    .eq("user_id", userId).eq("state", "awaiting_input")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(1);
  const row = data?.[0];
  if (!row) return null;
  await supabase.from("whatsapp_conversations")
    .update({ state: "done", updated_at: new Date().toISOString() }).eq("id", row.id);
  return row as { id: string; intent: string };
}

/**
 * Menu → "Update task status": show the user's open tasks as a TAPPABLE list.
 * Tapping a task (row id `tpick~<taskId>`) then shows the status picker — so the
 * whole update happens inside WhatsApp, no app link needed. This is the
 * button-free equivalent of the task-alert "Update status" button.
 */
async function sendTaskPickerForStatus(fromPhone: string, userId: string, tenantId: string | null) {
  let q = supabase.from("tasks")
    .select("id, title, status")
    .contains("assigned_user_ids", [userId])
    .not("status", "in", '("Completed","Closed")')
    .order("created_at", { ascending: false }).limit(10);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data: tasks } = await q;

  if (!tasks || tasks.length === 0) {
    await sendText(fromPhone, "✅ You have no open tasks to update right now.");
    return;
  }
  await sendList(
    fromPhone,
    "🔄 *Update a task* — pick which one:",
    "Pick task",
    tasks.map((t: any) => ({ id: `tpick~${t.id}`, title: t.title, description: `Currently: ${t.status}` })),
  );
}

/** Reply with the user's open tasks, each as its own deep link. */
async function sendOpenTasksList(fromPhone: string, userId: string, tenantId: string | null, mode: "update" | "view") {
  let q = supabase.from("tasks")
    .select("id, title, status")
    .contains("assigned_user_ids", [userId])
    .not("status", "in", '("Completed","Closed")')
    .order("created_at", { ascending: false }).limit(10);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data: tasks } = await q;

  if (!tasks || tasks.length === 0) {
    await sendText(fromPhone, "✅ You have no open tasks right now.");
    return;
  }
  const intro = mode === "update"
    ? "🔄 *Update a task* — tap one to open it in Horae and change its status:"
    : "📋 *Your open tasks* — tap one to open:";
  const lines = tasks.map((t: any, i: number) => `${i + 1}. *${t.title}* (${t.status})\n   👉 ${APP_BASE_URL}/tasks/${t.id}`);
  await sendText(fromPhone, `${intro}\n\n${lines.join("\n\n")}`);
}

/** Guide a staff member on what they can do over WhatsApp. */
async function sendHelp(fromPhone: string, userId: string) {
  const { data: u } = await supabase.from("users").select("name").eq("id", userId).limit(1);
  const first = ((u?.[0]?.name as string) || "there").split(" ")[0];
  await sendText(
    fromPhone,
    `👋 Hi ${first}! I'm *Horae*.\n\nHere's what I can do:\n\n` +
    `📋 *Send "menu"* → pick from create task, raise a complaint, update or view your tasks.\n` +
    `↪️ *Forward me any message* → I'll offer to turn it into a task.\n` +
    `✍️ Send *"new task <details>"* → I'll create a task from it.\n` +
    `🎙️ Send a *voice note* → I'll turn it into a task.\n\n` +
    `You'll also get task alerts and your daily briefing right here.\n\n👉 Open Horae: ${APP_BASE_URL}`,
  );
}

/** #1 step 1 — store the forwarded text and offer tappable action buttons. */
async function offerCaptureMenu(fromPhone: string, userId: string, tenantId: string | null, text: string) {
  const { data: conv, error } = await supabase.from("whatsapp_conversations").insert([{
    user_id: userId, tenant_id: tenantId, from_phone: fromPhone,
    state: "menu_offered", intent: "forward_capture", payload: { text },
  }]).select("id").single();
  if (error || !conv) { console.error("[whatsapp-webhook] conv insert failed:", error); return; }

  const preview = text.length > 120 ? text.slice(0, 117) + "…" : text;
  const wamid = await sendButtons(
    fromPhone,
    `📥 *Got it.*\n"${preview}"\n\nWhat would you like to do with this?`,
    [
      { id: "create_task", title: "📋 Create Task" },
      { id: "dismiss",     title: "Dismiss" },
    ],
  );
  // Tie the eventual button tap (arrives with context.id = this wamid) back to
  // the stored conversation.
  if (wamid) await supabase.from("whatsapp_conversations").update({ menu_message_id: wamid }).eq("id", conv.id);
}

// Staff-settable task statuses offered over WhatsApp. "Assigned" is the initial
// state (nothing to set) and "Closed" is creator/admin-only in the app, so both
// are intentionally omitted from the self-service list.
const WA_TASK_STATUSES = ["In Progress", "Pending", "On Hold", "Completed"];

/**
 * A quick-reply button tap on a business-initiated TEMPLATE (task alert, digest,
 * notice…). We match it back to the exact alert via context.id → notification_log
 * (which stores the WAMID + the task/reference id at send time).
 *   • Task alert  → reply with a status LIST so the staff picks the CORRECT
 *     status (never auto-complete — a fresh task shouldn't jump to Completed).
 *   • Anything else → a light ack.
 * Either way the tap has already re-opened the free 24-hour window.
 */
async function handleTemplateButtonTap(m: any, fromPhone: string, userId: string, tenantId: string | null) {
  const contextId: string | undefined = m?.context?.id;

  // Resolve which notification this button belonged to.
  let ref: { reference_id: string; event_type: string } | null = null;
  if (contextId) {
    const { data: logs } = await supabase
      .from("notification_log")
      .select("reference_id, event_type")
      .eq("wa_message_id", contextId)
      .limit(1);
    ref = (logs?.[0] as any) || null;
  }

  const taskEvents = ["task_assigned", "task_reassigned", "task_cc", "task_status", "urgent_push"];
  const looksLikeTask = ref && (taskEvents.includes(ref.event_type) || String(ref.reference_id).startsWith("task-"));

  if (looksLikeTask && ref) {
    // reference_id is the task id, sometimes suffixed with ":status" — strip it.
    const taskId = String(ref.reference_id).split(":")[0];
    await sendTaskStatusList(fromPhone, taskId);
    return;
  }

  // Digest / notice / non-task, or a task we couldn't resolve — the window is
  // open, that's the win. Acknowledge lightly.
  await sendText(fromPhone, "👍 Got it — thanks!");
}

/** Show the status picker for one task. Row ids carry the task id + status. */
async function sendTaskStatusList(fromPhone: string, taskId: string) {
  const { data: task } = await supabase.from("tasks").select("id, title, status").eq("id", taskId).single();
  if (!task) { await sendText(fromPhone, "👍 Got it — thanks!"); return; }
  await sendList(
    fromPhone,
    `🔄 *${task.title}*\nCurrently: *${task.status}*\n\nWhat's the new status?`,
    "Set status",
    WA_TASK_STATUSES.map(s => ({ id: `ts~${taskId}~${s}`, title: s })),
  );
}

/** Apply a status picked from the task-status list (row id `ts~<taskId>~<status>`). */
async function handleTaskStatusUpdate(listId: string, fromPhone: string, userId: string) {
  const parts = listId.split("~");            // ["ts", "task-123", "In Progress"]
  const taskId = parts[1];
  const status = parts.slice(2).join("~");    // status names have no "~", but be safe
  if (!taskId || !WA_TASK_STATUSES.includes(status)) { await sendText(fromPhone, "👍 Got it."); return; }

  const { data: task } = await supabase.from("tasks").select("id, title, status").eq("id", taskId).single();
  if (!task) { await sendText(fromPhone, "That task couldn't be found — it may have been removed."); return; }
  if (task.status === status) { await sendText(fromPhone, `👍 *${task.title}* is already *${status}*.`); return; }

  await supabase.from("tasks").update({ status }).eq("id", taskId);
  const { data: u } = await supabase.from("users").select("name, role").eq("id", userId).limit(1);
  await supabase.from("task_messages").insert([{
    id: "msg-" + Date.now(), task_id: taskId, user_id: userId,
    sender_name: u?.[0]?.name || "Staff", sender_role: u?.[0]?.role || "",
    message: `🔄 Status set to ${status} via WhatsApp`, timestamp: new Date().toISOString(),
  }]);
  await sendText(fromPhone, `✅ *${task.title}* is now *${status}*.`);
}

/** #1 step 2 — a button tap on the menu we offered. */
async function handleButtonReply(m: any, fromPhone: string, userId: string, tenantId: string | null) {
  const buttonId: string = m.interactive?.button_reply?.id || "";
  const contextId: string | undefined = m?.context?.id;
  if (!contextId) return;

  const { data: conv } = await supabase.from("whatsapp_conversations")
    .select("*").eq("menu_message_id", contextId).eq("state", "menu_offered").limit(1).maybeSingle();
  if (!conv) return; // menu expired or already handled

  if (buttonId === "create_task") {
    const text = conv.payload?.text || "";
    await supabase.from("whatsapp_conversations").update({ state: "done", updated_at: new Date().toISOString() }).eq("id", conv.id);
    await createCaptureAndReply(fromPhone, userId, tenantId, "whatsapp_forward", text);
  } else {
    await supabase.from("whatsapp_conversations").update({ state: "done", updated_at: new Date().toISOString() }).eq("id", conv.id);
    await sendText(fromPhone, "👍 Okay, ignored.");
  }
}

/** Create a task_capture and reply with the prefilled create-task deep link. */
async function createCaptureAndReply(
  fromPhone: string, userId: string, tenantId: string | null, source: string, content: string, complaint = false,
) {
  const base = deriveTitle(content);
  // Flag complaints so an admin spots them in the Task Manager.
  const title = complaint ? `Complaint: ${base}`.slice(0, 80) : base;
  const { data: cap, error } = await supabase.from("task_captures").insert([{
    tenant_id: tenantId, user_id: userId, source,
    suggested_title: title, raw_text: content, status: "pending",
  }]).select("id").single();
  if (error || !cap) { console.error("[whatsapp-webhook] capture insert failed:", error); return; }

  const link = `${APP_BASE_URL}/tasks/new?capture=${cap.id}`;
  const shown = title ? `\n\n📝 "${title}"` : "";
  const verb = complaint ? "log your complaint" : "create your task";
  await sendText(fromPhone, `✅ Tap to ${verb} in Horae:${shown}\n\n👉 ${link}`);
}

/** First non-empty line, trimmed to a sensible task-title length. */
function deriveTitle(text: string): string {
  const firstLine = (text || "").split("\n").map(s => s.trim()).find(Boolean) || "";
  return firstLine.length > 80 ? firstLine.slice(0, 77) + "…" : firstLine;
}

// ─── Meta media (voice notes) ──────────────────────────────────────────────────

/** Download a voice note from Meta by media id and transcribe it. */
async function transcribeVoice(mediaId: string): Promise<string> {
  try {
    // Two-step: media id → temporary signed URL → bytes (both need the token).
    const metaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
      headers: { "Authorization": `Bearer ${META_WA_TOKEN}` },
    });
    if (!metaRes.ok) throw new Error(`media meta ${metaRes.status}`);
    const meta = await metaRes.json();
    const mediaUrl: string = meta?.url;
    const mime: string = meta?.mime_type || "audio/ogg";
    if (!mediaUrl) throw new Error("no media url");

    const fileRes = await fetch(mediaUrl, { headers: { "Authorization": `Bearer ${META_WA_TOKEN}` } });
    if (!fileRes.ok) throw new Error(`media download ${fileRes.status}`);
    const bytes = new Uint8Array(await fileRes.arrayBuffer());

    return await transcribeAudio(bytes, mime, "voice.ogg");
  } catch (e) {
    console.error("[whatsapp-webhook] transcribeVoice failed:", e);
    return "";
  }
}

// ─── WhatsApp send (free-form + interactive; allowed inside the 24-hr window) ────

// WhatsApp opens links in its own in-app browser, which never hands off to an
// installed PWA. Route every in-message app deep-link through the /open
// interstitial (public/open.html): it bounces the tap out of WhatsApp's WebView
// into the user's real browser / installed PWA, preserving the target via ?to=.
const APP_LINK_RE = new RegExp(
  APP_BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
    "(?!/open)(/(?:tasks|notices|checklists|training|sops|digest)[^\\s)]*)?",
  "g",
);
function wrapWaLinks(text: string): string {
  if (!text) return text;
  return text.replace(APP_LINK_RE, (_m, path) => {
    let p = path || "/dashboard";
    let trail = "";
    const punct = p.match(/[.,!?;:]+$/); // don't swallow trailing sentence punctuation into the URL
    if (punct) { trail = punct[0]; p = p.slice(0, -trail.length); }
    return `${APP_BASE_URL}/open?to=${encodeURIComponent(p)}${trail}`;
  });
}

async function sendText(to: string, bodyText: string): Promise<string | undefined> {
  return waSend({ type: "text", text: { body: wrapWaLinks(bodyText), preview_url: true }, to: to.replace(/\D/g, "") });
}

async function sendButtons(to: string, bodyText: string, buttons: { id: string; title: string }[]): Promise<string | undefined> {
  return waSend({
    type: "interactive",
    to: to.replace(/\D/g, ""),
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: { buttons: buttons.slice(0, 3).map(b => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })) },
    },
  });
}

async function sendList(to: string, bodyText: string, buttonLabel: string, rows: { id: string; title: string; description?: string }[]): Promise<string | undefined> {
  return waSend({
    type: "interactive",
    to: to.replace(/\D/g, ""),
    interactive: {
      type: "list",
      body: { text: bodyText },
      action: {
        button: buttonLabel.slice(0, 20),
        sections: [{ title: "Options", rows: rows.slice(0, 10).map(r => {
          const row: Record<string, string> = { id: r.id, title: r.title.slice(0, 24) };
          if (r.description) row.description = r.description.slice(0, 72);
          return row;
        }) }],
      },
    },
  });
}

async function waSend(partial: Record<string, any>): Promise<string | undefined> {
  const payload = { messaging_product: "whatsapp", ...partial };
  const res = await fetch(`https://graph.facebook.com/v19.0/${META_PHONE_NUM_ID}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${META_WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error(`[whatsapp-webhook] send failed ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    return undefined;
  }
  const data = await res.json().catch(() => null);
  return data?.messages?.[0]?.id;
}
