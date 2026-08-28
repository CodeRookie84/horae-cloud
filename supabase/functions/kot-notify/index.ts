/**
 * Supabase Edge Function: kot-notify
 *
 * The ISOLATED KOT notification lane. Completely separate from notify-dispatcher
 * and daily-digest — its own WhatsApp credentials, its own Meta templates, its
 * own push tag namespace. Nothing here can affect Horae's own notifications.
 *
 * WhatsApp number switching (per user request): reads KOT_WA_TOKEN /
 * KOT_PHONE_NUMBER_ID, FALLING BACK to Horae's META_WA_TOKEN /
 * META_PHONE_NUMBER_ID. Set the KOT_* secrets to Cakewala's own number later —
 * Horae's lane keeps using META_* and is unaffected.
 *
 * Channels:
 *   • WhatsApp → every assignee participant's phone (primary; the floor & kitchen
 *     use the shared kiosk, not individual logins, so phone is the reliable pipe).
 *   • Web push → best-effort, only to assignees LINKED to a Horae user that has a
 *     push subscription (managers). Reuses the shared VAPID keys.
 *
 * Triggers (POST body):
 *   { type: "order_created", orderId }
 *   { type: "reminder", orderId, kind: "day_before" | "soon" }
 *
 * Required Meta templates (approve in the sending number's WABA), en language:
 *   kot_new_order  body: "🎂 New cake order — {{1}}. Delivery: {{2}}. {{3}}"
 *   kot_reminder   body: "⏰ Cake order reminder — {{1}}. {{2}}. {{3}}"
 * Each has 3 body params, no newlines/tabs (Meta template rule).
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_BASE_URL     = Deno.env.get("APP_BASE_URL") || "https://horae.cloud";

// KOT's own WhatsApp sender — falls back to Horae's number until Cakewala's is set.
const WA_TOKEN     = Deno.env.get("KOT_WA_TOKEN")       || Deno.env.get("META_WA_TOKEN")!;
const WA_PHONE_ID  = Deno.env.get("KOT_PHONE_NUMBER_ID") || Deno.env.get("META_PHONE_NUMBER_ID")!;
const DISABLE_WA   = Deno.env.get("DISABLE_WHATSAPP") === "true";

// Shared VAPID keys (best-effort push to linked managers).
const VAPID_SUBJECT     = Deno.env.get("VAPID_SUBJECT") || "";
const VAPID_PUBLIC_KEY  = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STATUS_LABELS: Record<string, string> = {
  order_received: "Order received",
  indent_created: "Indent created by kitchen",
  in_progress: "Order in progress",
  ready: "Ready marked by kitchen",
  handed_over: "Handed over by kitchen",
  collected: "Collected by outlet",
  completed: "Order completed",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json();
    if (body.type === "order_created") await handleOrderCreated(body.orderId);
    else if (body.type === "reminder") await handleReminder(body.orderId, body.kind);
    return json({ ok: true });
  } catch (err) {
    console.error("[kot-notify]", err);
    return json({ error: String(err) }, 500);
  }
});

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleOrderCreated(orderId: string) {
  const ctx = await loadOrderContext(orderId);
  if (!ctx) return;
  const { order, participants } = ctx;

  const when = formatDelivery(order.delivery_at);
  const summary = itemsSummary(ctx.items);
  const tail = order.fulfilment === "pickup" ? "Self pickup" : "Delivery";
  const link = `${APP_BASE_URL}/kot?c=${order.client_id}`;

  const template = {
    name: "kot_new_order",
    params: [ `${order.customer_name || "Customer"} (${summary})`, when, `${tail} · Open KOT ${link}` ],
  };
  const pushTitle = `🎂 New cake order: ${order.customer_name || "Customer"}`;
  const pushBody = `${summary} · ${when}`;

  await fanOut(participants, template, pushTitle, pushBody, `kot-order-${orderId}`, link);
}

async function handleReminder(orderId: string, kind: "day_before" | "soon") {
  const ctx = await loadOrderContext(orderId);
  if (!ctx) return;
  const { order, participants } = ctx;
  if (order.status === "completed") return;

  const when = formatDelivery(order.delivery_at);
  const summary = itemsSummary(ctx.items);
  const whenLabel = kind === "day_before" ? "Delivery tomorrow" : "Delivery in ~2 hours";
  const link = `${APP_BASE_URL}/kot?c=${order.client_id}`;

  const template = {
    name: "kot_reminder",
    params: [ `${order.customer_name || "Customer"} (${summary})`, `${whenLabel}: ${when}`, `Status: ${STATUS_LABELS[order.status] || order.status}` ],
  };
  const pushTitle = `⏰ ${whenLabel}: ${order.customer_name || "Cake order"}`;
  const pushBody = `${summary} · ${STATUS_LABELS[order.status] || order.status}`;

  await fanOut(participants, template, pushTitle, pushBody, `kot-reminder-${orderId}-${kind}`, link);
}

// ── Fan-out to the two channels ────────────────────────────────────────────────

async function fanOut(
  participants: any[],
  template: { name: string; params: string[] },
  pushTitle: string, pushBody: string, tag: string, url: string,
) {
  const jobs: Promise<unknown>[] = [];
  const seenPhones = new Set<string>();

  for (const p of participants) {
    // WhatsApp to the participant's phone.
    const phone = String(p.phone || "").replace(/\D/g, "");
    if (phone && !seenPhones.has(phone) && !DISABLE_WA) {
      seenPhones.add(phone);
      jobs.push(sendWhatsApp(phone, template).catch((e) => console.error("[kot-notify] wa fail", phone, String(e))));
    }
    // Best-effort push to a LINKED Horae user (managers).
    if (p.linked_user_id && VAPID_PUBLIC_KEY) {
      jobs.push(pushToUser(p.linked_user_id, pushTitle, pushBody, tag, url).catch(() => {}));
    }
  }
  await Promise.allSettled(jobs);
}

async function sendWhatsApp(phone: string, template: { name: string; params: string[] }) {
  const res = await fetch(`https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: template.name,
        language: { code: "en" },
        components: [{ type: "body", parameters: template.params.map((text) => ({ type: "text", text })) }],
      },
    }),
  });
  if (!res.ok) throw new Error(`WA ${res.status}: ${await res.text()}`);
}

async function pushToUser(userId: string, title: string, bodyText: string, tag: string, url: string) {
  const { data: user } = await supabase.from("users").select("fcm_token").eq("id", userId).single();
  if (!user?.fcm_token) return;
  webpush.setVapidDetails(VAPID_SUBJECT || "mailto:ops@horae.cloud", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const payload = JSON.stringify({ title, body: bodyText, url, tag, icon: "/app-icon.jpg", badge: "/app-icon.jpg" });
  await webpush.sendNotification(JSON.parse(user.fcm_token), payload, { urgency: "high" });
}

// ── Data loading ───────────────────────────────────────────────────────────────

async function loadOrderContext(orderId: string) {
  const { data: order } = await supabase.from("kot_orders").select("*").eq("id", orderId).single();
  if (!order) return null;
  const [{ data: items }, { data: assignees }] = await Promise.all([
    supabase.from("kot_order_items").select("*").eq("order_id", orderId),
    supabase.from("kot_order_assignees").select("participant_id").eq("order_id", orderId),
  ]);
  const ids = (assignees || []).map((a: any) => a.participant_id);
  let participants: any[] = [];
  if (ids.length) {
    const { data } = await supabase.from("kot_participants").select("*").in("id", ids).eq("active", true);
    participants = data || [];
  }
  return { order, items: items || [], participants };
}

// ── Formatting ─────────────────────────────────────────────────────────────────

function itemsSummary(items: any[]): string {
  const cakes = items.filter((i) => !i.is_extra_remark);
  const extras = items.filter((i) => i.is_extra_remark).length;
  const names = cakes.slice(0, 2).map((c: any) => `${c.qty ? c.qty + "× " : ""}${c.name}`).join(", ");
  const more = cakes.length > 2 ? ` +${cakes.length - 2}` : "";
  const note = extras > 0 ? ` · ${extras} custom note${extras > 1 ? "s" : ""}` : "";
  return (names || "items") + more + note;
}

/** Compact single-line IST time (Meta template params allow no newlines). */
function formatDelivery(iso: string | null): string {
  if (!iso) return "no time set";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "no time set";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function json(b: unknown, status = 200): Response {
  return new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
