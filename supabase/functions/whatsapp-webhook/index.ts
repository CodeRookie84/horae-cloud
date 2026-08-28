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
      if (listId.startsWith("tpick~")) { await sendTaskStatusList(fromPhone, listId.slice(6), userId); return; }
      if (listId.startsWith("cpick~")) { await startCommentForTask(fromPhone, userId, tenantId, listId.slice(6)); return; }
      if (listId.startsWith("ppick~")) { await startPhotoForTask(fromPhone, userId, tenantId, listId.slice(6)); return; }
      if (listId.startsWith("tview~")) { await sendTaskDetail(fromPhone, userId, tenantId, listId.slice(6)); return; }
      if (listId.startsWith("ts~")) { await handleTaskStatusUpdate(listId, fromPhone, userId); return; }
      await handleMenuSelection(listId, fromPhone, userId, tenantId); return;
    }
    if (m.interactive?.button_reply?.id) {
      const bid = m.interactive.button_reply.id;
      // Action buttons shown under a task's detail view.
      if (bid.startsWith("tstatus~")) { await sendTaskStatusList(fromPhone, bid.slice(8), userId); return; }
      if (bid.startsWith("tcomment~")) { await startCommentForTask(fromPhone, userId, tenantId, bid.slice(9)); return; }
      await handleButtonReply(m, fromPhone, userId, tenantId); return;
    }
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
      if (/^\s*(cancel|menu|back|stop)\b/i.test(rawText)) { await sendMainMenu(fromPhone, userId, tenantId); return; }
      let content = rawText;
      if (m.type === "audio" && m.audio?.id) {
        content = await transcribeVoice(m.audio.id);
        if (!content) { await sendText(fromPhone, "🎙️ I couldn't read that voice note. Please type it instead."); return; }
      }
      // "comment" → the content is a chat message on a task the user just picked.
      if (pending.intent === "comment") {
        await addTaskComment(fromPhone, userId, pending.payload?.taskId, content);
        return;
      }
      // "quick_task" → create a self-assigned task directly, no app link.
      if (pending.intent === "quick_task") {
        await createQuickTask(fromPhone, userId, tenantId, content);
        return;
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
      await sendMainMenu(fromPhone, userId, tenantId);
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

  // Media (image/document/video).
  if (["image", "document", "video"].includes(m.type)) {
    // If we're waiting for a photo for a specific task ("Add a photo" flow),
    // attach this image to it.
    if (m.type === "image" && m.image?.id) {
      const { data } = await supabase.from("whatsapp_conversations")
        .select("id, payload").eq("user_id", userId).eq("state", "awaiting_input").eq("intent", "photo")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }).limit(1);
      const conv = data?.[0];
      if (conv) {
        await supabase.from("whatsapp_conversations").update({ state: "done", updated_at: new Date().toISOString() }).eq("id", conv.id);
        await attachPhotoToTask(fromPhone, userId, (conv.payload as any)?.taskId, m.image.id);
        return;
      }
    }
    await sendText(fromPhone, "📎 I can't turn attachments into tasks yet. Send the details as *text*, or *\"new task …\"*.\n\n(To add a photo to a task: reply *menu* → *📷 Add a photo*.)");
    return;
  }
  // Everything else (reactions, location, contacts, …) is logged, no reply.
}

// ── Main menu (WhatsApp interactive list) ─────────────────────────────────────

/** Show the tappable action menu. The list BODY is a live personalised briefing
 *  (open tasks + overdue, new notices, pending training) so "Hi" doubles as the
 *  daily digest — all free, since it's inside the user-opened 24h window. */
async function sendMainMenu(fromPhone: string, userId?: string, tenantId?: string | null) {
  const body = userId ? await buildBriefingBody(userId, tenantId ?? null)
                      : "👋 *Horae* — what would you like to do?";
  await sendList(
    fromPhone,
    body,
    "Choose",
    [
      { id: "menu_create_task",   title: "📋 Create a task" },
      { id: "menu_quick_task",    title: "⚡ Quick task (for me)" },
      { id: "menu_add_photo",     title: "📷 Add a photo" },
      { id: "menu_add_comment",   title: "💬 Comment on a task" },
      { id: "menu_update_status", title: "🔄 Update task status" },
      { id: "menu_view_tasks",    title: "📋 View my tasks" },
      { id: "menu_checklists",    title: "✅ My checklists" },
      { id: "menu_training",      title: "📚 My training" },
      { id: "menu_complaint",     title: "⚠️ Raise a complaint" },
      { id: "menu_go_app",        title: "🔗 Go to Horae app", description: `${APP_BASE_URL}/dashboard` },
    ],
  );
}

/** Build the personalised briefing shown as the menu's body text. Best-effort:
 *  each section is independently guarded so a query hiccup can't blank the menu. */
async function buildBriefingBody(userId: string, tenantId: string | null): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: u } = await supabase.from("users").select("name, department, role").eq("id", userId).limit(1);
  const firstName = (String(u?.[0]?.name || "there")).split(" ")[0];
  const lines: string[] = [];

  try {
    const { data: tasks } = await supabase.from("tasks")
      .select("due_date")
      .or(`assigned_user_ids.cs.{${userId}},cc_user_ids.cs.{${userId}}`)
      .not("status", "in", '("Completed","Closed")');
    const open = tasks?.length || 0;
    const overdue = (tasks || []).filter((t: any) => (t.due_date || "").slice(0, 10) < today).length;
    if (open) lines.push(`📋 ${open} task${open === 1 ? "" : "s"} open${overdue ? ` · *${overdue} overdue*` : ""}`);
  } catch (_) { /* skip tasks line */ }

  try {
    if (tenantId) {
      // Real compliance checklists only — SOP/quiz rows share the table as JSON
      // in `description` and are filtered out (mirrors daily-digest).
      const { data: rows } = await supabase.from("checklists").select("description").eq("tenant_id", tenantId);
      const count = (rows || []).filter((c: any) => {
        try {
          if (typeof c.description === "string" && c.description.startsWith("{")) {
            const o = JSON.parse(c.description);
            if (o.type === "sop" || o.type === "quiz") return false;
          }
        } catch (_) { /* plain-text description = real checklist */ }
        return true;
      }).length;
      if (count) lines.push(`✅ ${count} checklist${count === 1 ? "" : "s"} to complete`);
    }
  } catch (_) { /* skip checklist line */ }

  try {
    const since = new Date(Date.now() - 86400000).toISOString();
    let q = supabase.from("notices").select("id", { count: "exact", head: true }).gte("created_at", since);
    if (tenantId) q = q.eq("tenant_id", tenantId);
    const { count } = await q;
    if (count) lines.push(`📢 ${count} new notice${count === 1 ? "" : "s"} today`);
  } catch (_) { /* skip notices line */ }

  try {
    const pending = await pendingTrainingCount(userId, tenantId, u?.[0]);
    if (pending) lines.push(`📚 ${pending} training pending`);
  } catch (_) { /* skip training line */ }

  if (lines.length === 0) return `👋 Hi ${firstName}! You're all caught up 🎉\n\nWhat would you like to do?`;
  return `👋 Hi ${firstName}! Here's your briefing:\n\n${lines.join("\n")}\n\nWhat would you like to do?`;
}

/** Count published trainings targeted to this user that they haven't passed. */
async function pendingTrainingCount(userId: string, tenantId: string | null, user: any): Promise<number> {
  if (!tenantId) return 0;
  const { data: t } = await supabase.from("tenants").select("client_id").eq("id", tenantId).single();
  const clientId = t?.client_id;
  if (!clientId) return 0;
  const { data: trainings } = await supabase.from("trainings")
    .select("id, outlets, department, role, questions")
    .eq("client_id", clientId).eq("published", true);
  if (!trainings?.length) return 0;
  const { data: atts } = await supabase.from("training_attempts").select("training_id, passed").eq("user_id", userId);
  const passed = new Set((atts || []).filter((a: any) => a.passed).map((a: any) => a.training_id));
  const dept = String(user?.department ?? "");
  const role = String(user?.role ?? "");
  return (trainings || []).filter((tr: any) => {
    if (!(tr.questions?.length)) return false;
    if (passed.has(tr.id)) return false;
    const outletOk = !Array.isArray(tr.outlets) || tr.outlets.length === 0 || tr.outlets.includes(tenantId);
    const deptOk = String(tr.department || "All Departments") === "All Departments" || String(tr.department) === dept;
    const roleOk = String(tr.role || "All Roles") === "All Roles" || String(tr.role) === role;
    return outletOk && deptOk && roleOk;
  }).length;
}

/** Dispatch a main-menu list selection. */
async function handleMenuSelection(id: string, fromPhone: string, userId: string, tenantId: string | null) {
  switch (id) {
    case "menu_create_task":   await startAwaitingInput(fromPhone, userId, tenantId, "create_task"); break;
    case "menu_quick_task":    await startAwaitingInput(fromPhone, userId, tenantId, "quick_task"); break;
    case "menu_add_photo":     await sendTaskPickerForPhoto(fromPhone, userId, tenantId); break;
    case "menu_add_comment":   await sendTaskPickerForComment(fromPhone, userId, tenantId); break;
    case "menu_complaint":     await startAwaitingInput(fromPhone, userId, tenantId, "complaint"); break;
    case "menu_update_status": await sendTaskPickerForStatus(fromPhone, userId, tenantId); break;
    case "menu_view_tasks":    await sendTaskPickerForView(fromPhone, userId, tenantId); break;
    case "menu_checklists":    await sendChecklistsList(fromPhone, tenantId); break;
    case "menu_training":      await sendTrainingList(fromPhone, userId, tenantId); break;
    case "menu_go_app":        await sendText(fromPhone, `👉 *Go to Horae app*:\n${APP_BASE_URL}/dashboard`); break;
    default:                   await sendMainMenu(fromPhone, userId, tenantId);
  }
}

/** Remember that we're waiting for the user's task/complaint details, and ask. */
async function startAwaitingInput(fromPhone: string, userId: string, tenantId: string | null, intent: string) {
  await supabase.from("whatsapp_conversations").insert([{
    user_id: userId, tenant_id: tenantId, from_phone: fromPhone,
    state: "awaiting_input", intent,
  }]);
  const prompt =
    intent === "complaint"
      ? "⚠️ Please describe the complaint or issue. You can type it or send a voice note.\n\n(Reply *cancel* to go back.)"
      : intent === "quick_task"
      ? "⚡ *Quick task for you* — send the task in one message (type or voice). I'll create it, assign it to you, and set it due tomorrow.\n\n(Reply *cancel* to go back.)"
      : "📋 Please send the task details. You can type them or send a voice note.\n\n(Reply *cancel* to go back.)";
  await sendText(fromPhone, prompt);
}

/** Atomically claim the user's latest pending "awaiting_input" state (or null). */
async function takePendingInput(userId: string): Promise<{ id: string; intent: string; payload: any } | null> {
  const { data } = await supabase.from("whatsapp_conversations")
    .select("id, intent, payload")
    .eq("user_id", userId).eq("state", "awaiting_input")
    // A photo session is driven by the image handler, not by text/voice input.
    .neq("intent", "photo")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(1);
  const row = data?.[0];
  if (!row) return null;
  await supabase.from("whatsapp_conversations")
    .update({ state: "done", updated_at: new Date().toISOString() }).eq("id", row.id);
  return row as { id: string; intent: string; payload: any };
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

/**
 * Menu → "Comment on a task": show the user's open tasks as a tappable list.
 * Tapping a task (row id `cpick~<taskId>`) then asks for the comment text/voice,
 * which is captured back into the task chat — mirrors the update-status flow.
 */
async function sendTaskPickerForComment(fromPhone: string, userId: string, tenantId: string | null) {
  let q = supabase.from("tasks")
    .select("id, title, status")
    .contains("assigned_user_ids", [userId])
    .not("status", "in", '("Completed","Closed")')
    .order("created_at", { ascending: false }).limit(10);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data: tasks } = await q;

  if (!tasks || tasks.length === 0) {
    await sendText(fromPhone, "✅ You have no open tasks to comment on right now.");
    return;
  }
  await sendList(
    fromPhone,
    "💬 *Comment on a task* — pick which one:",
    "Pick task",
    tasks.map((t: any) => ({ id: `cpick~${t.id}`, title: t.title, description: `Currently: ${t.status}` })),
  );
}

/**
 * Menu → "View my tasks": list the user's tasks (primary or CC) as a tappable
 * list. Tapping one (row id `tview~<taskId>`) shows the FULL task detail —
 * description, assigned-by, comments and photos — entirely in WhatsApp.
 */
async function sendTaskPickerForView(fromPhone: string, userId: string, tenantId: string | null) {
  let q = supabase.from("tasks")
    .select("id, title, status")
    .or(`assigned_user_ids.cs.{${userId}},cc_user_ids.cs.{${userId}}`)
    .not("status", "in", '("Completed","Closed")')
    .order("created_at", { ascending: false }).limit(10);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data: tasks } = await q;

  if (!tasks || tasks.length === 0) {
    await sendText(fromPhone, "📋 You have no active tasks right now.");
    return;
  }
  await sendList(
    fromPhone,
    "📋 *Your tasks* — pick one to see the full details:",
    "View task",
    tasks.map((t: any) => ({ id: `tview~${t.id}`, title: t.title, description: t.status })),
  );
}

/** Send a task's full detail (description, assigned-by, comments, photos) plus
 *  action buttons — the in-WhatsApp equivalent of opening the task in the app. */
async function sendTaskDetail(fromPhone: string, userId: string, _tenantId: string | null, taskId: string) {
  const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).single();
  if (!task) { await sendText(fromPhone, "That task couldn't be found — it may have been removed."); return; }

  // Unpack the clean description + photos from the metadata blob.
  let desc = task.description || "";
  let photos: string[] = [];
  const parts = desc.split("\n\n---HORAE-METADATA---\n");
  if (parts.length > 1) {
    try { const meta = JSON.parse(parts[1]); if (Array.isArray(meta.photos)) photos = meta.photos; } catch (_) { /* ignore */ }
    desc = parts[0];
  }

  const { data: creator } = await supabase.from("users").select("name").eq("id", task.created_by_user_id).limit(1);
  const by = creator?.[0]?.name || "—";
  const { data: msgs } = await supabase.from("task_messages")
    .select("sender_name, message").eq("task_id", taskId)
    .order("timestamp", { ascending: false }).limit(5);
  const comments = (msgs || []).reverse();

  let text = `📋 *${task.title}*\n`;
  text += `Status: *${task.status}*  ·  Priority: ${task.priority || "—"}\n`;
  if (task.due_date) text += `Due: ${String(task.due_date).slice(0, 10)}\n`;
  text += `Assigned by: ${by}\n`;
  if (desc.trim()) text += `\n${desc.trim()}\n`;
  if (photos.length) text += `\n📎 ${photos.length} photo${photos.length === 1 ? "" : "s"} attached${photos.length ? " (below)" : ""}\n`;
  if (comments.length) {
    text += `\n💬 *Recent comments:*\n`;
    text += comments.map((c: any) => `• ${c.sender_name || "Someone"}: ${(c.message || "").slice(0, 160)}`).join("\n");
  } else {
    text += `\n💬 No comments yet.`;
  }

  await sendText(fromPhone, text.slice(0, 4000));

  // Attached photos as real images (they're base64 data URIs → upload to Meta first).
  for (const p of photos.slice(0, 3)) {
    const mediaId = await uploadMediaFromDataUri(p);
    if (mediaId) await waSend({ type: "image", to: fromPhone.replace(/\D/g, ""), image: { id: mediaId } });
  }

  // Act-on-this-task buttons.
  await sendButtons(fromPhone, "What would you like to do with this task?", [
    { id: `tstatus~${taskId}`, title: "🔄 Update status" },
    { id: `tcomment~${taskId}`, title: "💬 Add comment" },
  ]);
}

/** Upload a base64 data-URI image to the WhatsApp Media API; returns its media id. */
async function uploadMediaFromDataUri(dataUri: string): Promise<string | null> {
  try {
    const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s.exec(dataUri || "");
    if (!m) return null;
    const mime = m[1];
    const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", mime);
    form.append("file", new Blob([bytes], { type: mime }), `photo.${mime.split("/")[1] || "jpg"}`);
    const res = await fetch(`https://graph.facebook.com/v19.0/${META_PHONE_NUM_ID}/media`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${META_WA_TOKEN}` },
      body: form,
    });
    if (!res.ok) { console.error("[whatsapp-webhook] media upload failed:", res.status, (await res.text().catch(() => "")).slice(0, 200)); return null; }
    const data = await res.json().catch(() => null);
    return data?.id || null;
  } catch (e) {
    console.error("[whatsapp-webhook] uploadMediaFromDataUri error:", e);
    return null;
  }
}

/** A task was picked for a comment → remember it and ask for the text/voice note. */
async function startCommentForTask(fromPhone: string, userId: string, tenantId: string | null, taskId: string) {
  const { data: task } = await supabase.from("tasks").select("id, title").eq("id", taskId).single();
  if (!task) { await sendText(fromPhone, "That task couldn't be found — it may have been removed."); return; }
  await supabase.from("whatsapp_conversations").insert([{
    user_id: userId, tenant_id: tenantId, from_phone: fromPhone,
    state: "awaiting_input", intent: "comment", payload: { taskId },
  }]);
  await sendText(
    fromPhone,
    `💬 Add your comment for *${task.title}*.\nType it or send a voice note.\n\n(Reply *cancel* to go back.)`,
  );
}

/** Save a WhatsApp-captured comment into the task chat (task_messages). */
async function addTaskComment(fromPhone: string, userId: string, taskId: string | undefined, content: string) {
  const text = (content || "").trim();
  if (!taskId) { await sendText(fromPhone, "Hmm, I lost track of which task that was for. Reply *menu* and pick it again."); return; }
  if (!text)   { await sendText(fromPhone, "That comment looked empty — reply *menu* to try again."); return; }

  const { data: task } = await supabase.from("tasks").select("id, title").eq("id", taskId).single();
  if (!task) { await sendText(fromPhone, "That task couldn't be found — it may have been removed."); return; }

  const { data: u } = await supabase.from("users").select("name, role").eq("id", userId).limit(1);
  await supabase.from("task_messages").insert([{
    id: "msg-" + Date.now(), task_id: taskId, user_id: userId,
    sender_name: u?.[0]?.name || "Staff", sender_role: u?.[0]?.role || "",
    message: text, timestamp: new Date().toISOString(),
  }]);
  await sendText(fromPhone, `💬 Comment added to *${task.title}*.\nEveryone on the task will see it in Horae and their next digest.`);
}

/** Menu → "Add a photo": list the user's active tasks (rows `ppick~<taskId>`). */
async function sendTaskPickerForPhoto(fromPhone: string, userId: string, tenantId: string | null) {
  let q = supabase.from("tasks")
    .select("id, title, status")
    .or(`assigned_user_ids.cs.{${userId}},cc_user_ids.cs.{${userId}}`)
    .not("status", "in", '("Completed","Closed")')
    .order("created_at", { ascending: false }).limit(10);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data: tasks } = await q;

  if (!tasks || tasks.length === 0) {
    await sendText(fromPhone, "📷 You have no active tasks to add a photo to.");
    return;
  }
  await sendList(
    fromPhone,
    "📷 *Add a photo* — pick the task:",
    "Pick task",
    tasks.map((t: any) => ({ id: `ppick~${t.id}`, title: t.title, description: t.status })),
  );
}

/** A task was picked for a photo → remember it and ask for the image. */
async function startPhotoForTask(fromPhone: string, userId: string, tenantId: string | null, taskId: string) {
  const { data: task } = await supabase.from("tasks").select("id, title").eq("id", taskId).single();
  if (!task) { await sendText(fromPhone, "That task couldn't be found — it may have been removed."); return; }
  await supabase.from("whatsapp_conversations").insert([{
    user_id: userId, tenant_id: tenantId, from_phone: fromPhone,
    state: "awaiting_input", intent: "photo", payload: { taskId },
  }]);
  await sendText(fromPhone, `📷 Send the photo now for *${task.title}*.\n(Send one image; reply *menu* → *Add a photo* to add more, up to 3.)`);
}

/** Download the WhatsApp image and append it to the task's photos (base64, max 3). */
async function attachPhotoToTask(fromPhone: string, userId: string, taskId: string | undefined, mediaId: string) {
  if (!taskId) { await sendText(fromPhone, "Hmm, I lost track of which task that was for. Reply *menu* → *Add a photo* to try again."); return; }
  const { data: task } = await supabase.from("tasks").select("id, title, description").eq("id", taskId).single();
  if (!task) { await sendText(fromPhone, "That task couldn't be found — it may have been removed."); return; }

  // Unpack the metadata blob so we can append to its photos array.
  let clean = task.description || "";
  let meta: any = {};
  const parts = clean.split("\n\n---HORAE-METADATA---\n");
  if (parts.length > 1) { try { meta = JSON.parse(parts[1]); } catch (_) { /* ignore */ } clean = parts[0]; }
  const photos: string[] = Array.isArray(meta.photos) ? meta.photos : [];
  if (photos.length >= 3) { await sendText(fromPhone, `📷 *${task.title}* already has the maximum of 3 photos.`); return; }

  const dataUri = await downloadMediaAsDataUri(mediaId);
  if (!dataUri) { await sendText(fromPhone, "Sorry, I couldn't save that photo. Please try sending it again."); return; }

  photos.push(dataUri);
  meta.photos = photos;
  await supabase.from("tasks").update({ description: `${clean}\n\n---HORAE-METADATA---\n${JSON.stringify(meta)}` }).eq("id", taskId);

  const { data: u } = await supabase.from("users").select("name, role").eq("id", userId).limit(1);
  await supabase.from("task_messages").insert([{
    id: "msg-" + Date.now(), task_id: taskId, user_id: userId,
    sender_name: u?.[0]?.name || "Staff", sender_role: u?.[0]?.role || "",
    message: "📷 Added a photo via WhatsApp", timestamp: new Date().toISOString(),
  }]);
  await sendText(fromPhone, `📷 Photo added to *${task.title}* (${photos.length}/3).${photos.length < 3 ? "\nReply *menu* → *Add a photo* to add another." : ""}`);
}

/** Fetch a WhatsApp media id and return it as a base64 `data:` URI (two-step). */
async function downloadMediaAsDataUri(mediaId: string): Promise<string | null> {
  try {
    const metaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, { headers: { "Authorization": `Bearer ${META_WA_TOKEN}` } });
    if (!metaRes.ok) return null;
    const meta = await metaRes.json();
    const mediaUrl: string = meta?.url;
    const mime: string = meta?.mime_type || "image/jpeg";
    if (!mediaUrl) return null;
    const fileRes = await fetch(mediaUrl, { headers: { "Authorization": `Bearer ${META_WA_TOKEN}` } });
    if (!fileRes.ok) return null;
    const bytes = new Uint8Array(await fileRes.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return `data:${mime};base64,${btoa(binary)}`;
  } catch (e) {
    console.error("[whatsapp-webhook] downloadMediaAsDataUri error:", e);
    return null;
  }
}

/** Create a self-assigned task from one message (defaults: Medium, due tomorrow). */
async function createQuickTask(fromPhone: string, userId: string, tenantId: string | null, content: string) {
  const text = (content || "").trim();
  if (!text) { await sendText(fromPhone, "That looked empty — reply *menu* → *Quick task* to try again."); return; }
  const firstLine = text.split("\n").map(s => s.trim()).find(Boolean) || text;
  const title = firstLine.length > 80 ? firstLine.slice(0, 77) + "…" : firstLine;
  const due = new Date(Date.now() + 86400000).toISOString().slice(0, 10); // tomorrow
  const taskId = "task-" + Date.now();
  const meta = { assigneeIds: [userId], ccIds: [] };
  const { error } = await supabase.from("tasks").insert([{
    id: taskId, tenant_id: tenantId, title,
    description: `${text}\n\n---HORAE-METADATA---\n${JSON.stringify(meta)}`,
    status: "Assigned", priority: "Medium", due_date: due,
    assigned_user_id: userId, assigned_user_ids: [userId], cc_user_ids: [],
    created_by_user_id: userId, created_at: new Date().toISOString(),
  }]);
  if (error) { console.error("[whatsapp-webhook] createQuickTask insert failed:", error); await sendText(fromPhone, "Sorry, I couldn't create that task. Please try again."); return; }
  await sendText(fromPhone, `✅ Task created & assigned to you:\n*${title}*\nPriority: Medium · Due: ${due}\n\nReply *menu* → *📷 Add a photo* to attach one, or *🔄 Update task status* when you start.`);
}

/** Menu → "My checklists": list this outlet's pending checklists with a deep link. */
async function sendChecklistsList(fromPhone: string, tenantId: string | null) {
  if (!tenantId) { await sendText(fromPhone, "✅ No checklists found for your outlet."); return; }
  const { data: rows } = await supabase.from("checklists")
    .select("id, title, description").eq("tenant_id", tenantId);
  // Same filter the digest uses — the checklists table also stores SOP/quiz rows.
  const checklists = (rows || []).filter((c: any) => {
    try {
      if (typeof c.description === "string" && c.description.startsWith("{")) {
        const o = JSON.parse(c.description);
        if (o.type === "sop" || o.type === "quiz") return false;
      }
    } catch { /* plain-text description = real checklist */ }
    return true;
  }).slice(0, 10);

  if (checklists.length === 0) { await sendText(fromPhone, "✅ No checklists pending for your outlet right now."); return; }
  const lines = checklists.map((c: any, i: number) => `${i + 1}. *${c.title}*`);
  await sendText(fromPhone, `✅ *Your checklists*\n\n${lines.join("\n")}\n\n👉 Complete them in Horae:\n${APP_BASE_URL}/checklists`);
}

/** Menu → "My training": list trainings targeted to this user they haven't passed. */
async function sendTrainingList(fromPhone: string, userId: string, tenantId: string | null) {
  const { data: u } = await supabase.from("users")
    .select("department, role, tenant_id").eq("id", userId).single();
  const { data: t } = await supabase.from("tenants").select("client_id").eq("id", tenantId).single();
  const clientId = t?.client_id;
  if (!clientId) { await sendText(fromPhone, "📚 No training assigned to you right now."); return; }

  const { data: trainings } = await supabase.from("trainings")
    .select("id, title, outlets, department, role, questions")
    .eq("client_id", clientId).eq("published", true);
  const ids = (trainings || []).map((x: any) => x.id);
  const passed = new Set<string>();
  if (ids.length) {
    const { data: atts } = await supabase.from("training_attempts")
      .select("training_id, passed").eq("user_id", userId).in("training_id", ids);
    for (const a of (atts || [])) if (a.passed) passed.add(a.training_id);
  }
  // Mirror trainingService.trainingMatchesUser: outlet/dept/role wildcards.
  const pending = (trainings || []).filter((x: any) => {
    if (!(x.questions?.length)) return false;
    if (passed.has(x.id)) return false;
    const outletOk = !Array.isArray(x.outlets) || x.outlets.length === 0 || x.outlets.includes(u?.tenant_id);
    const deptOk = String(x.department || "All Departments") === "All Departments" || String(x.department) === String(u?.department);
    const roleOk = String(x.role || "All Roles") === "All Roles" || String(x.role) === String(u?.role);
    return outletOk && deptOk && roleOk;
  }).slice(0, 10);

  if (pending.length === 0) { await sendText(fromPhone, "📚 You're all caught up — no pending training. 🎉"); return; }
  const lines = pending.map((x: any, i: number) => `${i + 1}. *${x.title}*`);
  await sendText(fromPhone, `📚 *Your training*\n\n${lines.join("\n")}\n\n👉 Take them in Horae:\n${APP_BASE_URL}/training`);
}

/** Guide a staff member on what they can do over WhatsApp. */
async function sendHelp(fromPhone: string, userId: string) {
  const { data: u } = await supabase.from("users").select("name").eq("id", userId).limit(1);
  const first = ((u?.[0]?.name as string) || "there").split(" ")[0];
  await sendText(
    fromPhone,
    `👋 Hi ${first}! I'm *Horae*.\n\nHere's what I can do:\n\n` +
    `📋 *Send "menu"* → create a task, comment on a task, update or view tasks, see your checklists & training, or raise a complaint.\n` +
    `↪️ *Forward me any message* → I'll offer to turn it into a task.\n` +
    `✍️ Send *"new task <details>"* → I'll create a task from it.\n` +
    `🎙️ Send a *voice note* → I'll turn it into a task (or a comment when I ask for one).\n\n` +
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
    await sendTaskStatusList(fromPhone, taskId, userId);
    return;
  }

  // Digest / notice / non-task, or a task we couldn't resolve — the window is
  // open, that's the win. Acknowledge lightly.
  await sendText(fromPhone, "👍 Got it — thanks!");
}

/** Whether this user may CLOSE the task: only its creator or an admin, and only
 *  once it's already Completed (mirrors the app's close rule). */
async function canCloseTask(task: any, userId: string): Promise<boolean> {
  if (task.status !== "Completed") return false;
  if (task.created_by_user_id === userId) return true;
  const { data: u } = await supabase.from("users").select("role").eq("id", userId).limit(1);
  const role = String(u?.[0]?.role || "");
  return role === "Admin" || role === "Super Admin";
}

/** Show the status picker for one task. Row ids carry the task id + status. */
async function sendTaskStatusList(fromPhone: string, taskId: string, userId: string) {
  const { data: task } = await supabase.from("tasks").select("id, title, status, created_by_user_id").eq("id", taskId).single();
  if (!task) { await sendText(fromPhone, "👍 Got it — thanks!"); return; }
  const statuses = [...WA_TASK_STATUSES];
  // "Closed" appears only for the creator/admin once the task is Completed.
  if (await canCloseTask(task, userId)) statuses.push("Closed");
  await sendList(
    fromPhone,
    `🔄 *${task.title}*\nCurrently: *${task.status}*\n\nWhat's the new status?`,
    "Set status",
    statuses.map(s => ({ id: `ts~${taskId}~${s}`, title: s })),
  );
}

/** Apply a status picked from the task-status list (row id `ts~<taskId>~<status>`). */
async function handleTaskStatusUpdate(listId: string, fromPhone: string, userId: string) {
  const parts = listId.split("~");            // ["ts", "task-123", "In Progress"]
  const taskId = parts[1];
  const status = parts.slice(2).join("~");    // status names have no "~", but be safe
  if (!taskId || !(WA_TASK_STATUSES.includes(status) || status === "Closed")) { await sendText(fromPhone, "👍 Got it."); return; }

  const { data: task } = await supabase.from("tasks").select("id, title, status, created_by_user_id").eq("id", taskId).single();
  if (!task) { await sendText(fromPhone, "That task couldn't be found — it may have been removed."); return; }

  // Closing is gated: only after the task is Completed, and only by its creator
  // or an admin (defence-in-depth on top of the picker only offering it to them).
  if (status === "Closed" && !(await canCloseTask(task, userId))) {
    await sendText(fromPhone, task.status !== "Completed"
      ? `A task must be marked *Completed* before it can be Closed.`
      : `Only the person who created this task (or an admin) can close it.`);
    return;
  }

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

async function sendText(to: string, bodyText: string): Promise<string | undefined> {
  return waSend({ type: "text", text: { body: bodyText, preview_url: true }, to: to.replace(/\D/g, "") });
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
