// [KOT] ───────────────────────────────────────────────────────────────────────
// View-only WhatsApp flow for the Cake-Order (KOT) module.
//
// A KOT participant (matched by phone against kot_participants of a KOT-enabled
// client) can reply *kot* to get a small menu and browse their outlet's orders:
//   kot                → the KOT menu (today / upcoming / open / open app)
//   tap "Today"/…      → an interactive list of up to 10 matching orders
//   tap an order       → its full details (items, the handwritten custom note,
//                        payment, status) + an "Open in KOT app" button
// It is READ-ONLY: no status changes here (those stay in the app/kiosk, where the
// photo-required steps live). Anyone who isn't a KOT participant falls straight
// through to normal Horae handling, so this keyword is invisible to everyone else.
//
// ISOLATION: this file is fully self-contained — its own Supabase client, its own
// WhatsApp send helpers, its own status labels (duplicated, never imported from
// Horae). Removing KOT = delete this file + the two `// [KOT]` seams in index.ts.
// The inbound reply always goes out on Horae's number (META_*), i.e. the number
// that received the message — the separate KOT_* number only sends proactive
// notifications from kot-notify.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_WA_TOKEN     = Deno.env.get("META_WA_TOKEN")!;
const META_PHONE_NUM_ID = Deno.env.get("META_PHONE_NUMBER_ID")!;
const APP_BASE_URL      = Deno.env.get("APP_BASE_URL") || "https://horae.cloud";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

// Duplicated from src/kot/status.ts (isolation — no cross-import).
const STATUS_LABEL: Record<string, string> = {
  order_received: "Order received",
  indent_created: "Indent created by kitchen",
  in_progress:    "Order in progress",
  ready:          "Ready marked by kitchen",
  handed_over:    "Handed over by kitchen",
  collected:      "Collected by outlet",
  completed:      "Order completed",
};
const statusLabel = (s: string) => STATUS_LABEL[s] ?? s;

interface KotWho { participantId: string; clientId: string; clientName: string; name: string; outletIds: string[]; }

// ── Public entry points (the only two things index.ts calls) ───────────────────

/** "kot" typed as free text → show the view menu. Returns false (not handled) if
 *  the sender isn't a KOT participant, so normal Horae routing takes over. */
export async function routeKotText(text: string, fromPhone: string): Promise<boolean> {
  if (!/^\s*kot\b/i.test(text)) return false;
  const who = await resolveKotParticipant(fromPhone);
  if (!who) return false;
  await sendKotMenu(fromPhone, who);
  return true;
}

/** An interactive list_reply whose id starts with "kot". Returns false if it's
 *  not a KOT id (or the sender isn't a participant) so index.ts keeps routing. */
export async function routeKotList(listId: string, fromPhone: string): Promise<boolean> {
  if (!listId.startsWith("kot")) return false;
  const who = await resolveKotParticipant(fromPhone);
  if (!who) return false;
  if (listId === "kotapp")                await sendKotApp(fromPhone, who);
  else if (listId.startsWith("kotlist~")) await sendKotList(fromPhone, who, listId.slice(8));
  else if (listId.startsWith("kotv~"))    await sendKotDetail(fromPhone, who, listId.slice(5));
  else                                     await sendKotMenu(fromPhone, who);
  return true;
}

// ── Participant resolution ─────────────────────────────────────────────────────

/** Match a phone to a KOT participant of a KOT-enabled client. Digits are stripped
 *  on both sides and compared on the last 10 (robust to +91 / spaces), mirroring
 *  src/kot/access.ts. The People Directory is small, so fetching active rows and
 *  filtering in JS is cheaper than a leading-wildcard LIKE. */
async function resolveKotParticipant(fromPhone: string): Promise<KotWho | null> {
  const last10 = fromPhone.replace(/\D/g, "").slice(-10);
  if (last10.length !== 10) return null;

  const { data: parts } = await supabase
    .from("kot_participants").select("id, client_id, name, phone").eq("active", true);
  const candidates = (parts || []).filter((p: any) =>
    String(p.phone || "").replace(/\D/g, "").endsWith(last10));
  if (!candidates.length) return null;

  const clientIds = [...new Set(candidates.map((p: any) => p.client_id))];
  const { data: enabled } = await supabase
    .from("kot_clients").select("client_id").in("client_id", clientIds);
  const enabledSet = new Set((enabled || []).map((c: any) => c.client_id));
  const p = candidates.find((c: any) => enabledSet.has(c.client_id));
  if (!p) return null;

  const [{ data: links }, { data: client }] = await Promise.all([
    supabase.from("kot_participant_outlets").select("tenant_id").eq("participant_id", p.id),
    supabase.from("clients").select("name").eq("id", p.client_id).limit(1).maybeSingle(),
  ]);
  const outletIds = (links || []).map((l: any) => l.tenant_id);
  const clientName = ((client?.name as string) || "Cake").trim();
  return { participantId: p.id, clientId: p.client_id, clientName, name: p.name ?? "", outletIds };
}

// ── Screens ────────────────────────────────────────────────────────────────────

async function sendKotMenu(fromPhone: string, who: KotWho) {
  const first = (who.name || "there").split(" ")[0];
  await sendList(
    fromPhone,
    `🎂 *${who.clientName} KOT* — hi ${first}.\nPick what you'd like to view.`,
    "View orders",
    [
      { id: "kotlist~today",    title: "📋 Today's orders",  description: "Delivery/pickup due today" },
      { id: "kotlist~upcoming", title: "📅 Upcoming orders", description: "Due after today, still open" },
      { id: "kotlist~open",     title: "🔧 Open orders",     description: "Anything not yet completed" },
      { id: "kotapp",           title: "🔗 Open KOT app",    description: "Capture & update in the app" },
    ],
  );
}

async function sendKotApp(fromPhone: string, who: KotWho) {
  await sendCtaUrl(fromPhone, "Open the full KOT app to capture slips and update status:", "Open KOT app", kotAppLink(who.clientId));
}

async function sendKotList(fromPhone: string, who: KotWho, mode: string) {
  const label = mode === "today" ? "Today's" : mode === "upcoming" ? "Upcoming" : "Open";
  const rows = await fetchOrders(who, mode);
  if (!rows.length) {
    await sendCtaUrl(fromPhone, `No ${label.toLowerCase()} cake orders right now.`, "Open KOT app", kotAppLink(who.clientId));
    return;
  }

  const shown = rows.slice(0, 10);
  const summaries = await itemSummaries(shown.map((r: any) => r.id));
  const listRows = shown.map((r: any) => {
    const items = summaries.get(r.id) || "";
    const desc = [fmtDateTime(r.delivery_at), statusLabel(r.status), items].filter(Boolean).join(" • ");
    return { id: `kotv~${r.id}`, title: r.customer_name || "Customer", description: desc };
  });

  const more = rows.length > 10 ? " (showing 10 — open the app for the rest)" : "";
  await sendList(
    fromPhone,
    `🎂 *${label} cake orders* (${rows.length}${more})\nTap one to see full details.`,
    "See an order",
    listRows,
  );
}

async function sendKotDetail(fromPhone: string, who: KotWho, orderId: string) {
  const { data: order } = await supabase.from("kot_orders").select("*").eq("id", orderId).limit(1).maybeSingle();
  // Scope guard — only orders of this participant's client (and covered outlet).
  const inScope = order && order.client_id === who.clientId &&
    (who.outletIds.length === 0 || who.outletIds.includes(order.tenant_id));
  if (!inScope) {
    await sendText(fromPhone, "That order isn't available. Reply *kot* to see your current orders.");
    return;
  }

  const { data: items } = await supabase
    .from("kot_order_items").select("*").eq("order_id", orderId).order("sort_order");
  const outletName = await outletName_(order.tenant_id);

  const real = (items || []).filter((i: any) => !i.is_extra_remark);
  const remarks = (items || []).filter((i: any) => i.is_extra_remark && (i.remark_text || "").trim());
  const fulfil = order.fulfilment === "pickup" ? "Self pickup" : "Delivery";

  const lines: string[] = [];
  lines.push(`🎂 *${order.customer_name || "Customer"}*${order.invoice_no ? `  ·  Inv ${order.invoice_no}` : ""}`);
  if (outletName) lines.push(`🏪 ${outletName}`);
  lines.push(`📦 ${fulfil}: ${fmtDateTime(order.delivery_at) || "—"}`);
  if (order.fulfilment !== "pickup" && (order.customer_address || "").trim()) lines.push(`📍 ${order.customer_address.trim()}`);
  if ((order.customer_phone || "").trim()) lines.push(`☎️ ${order.customer_phone.trim()}`);
  lines.push("");
  lines.push("🧾 *Items*");
  lines.push(real.length ? real.map((i: any) => ` • ${fmtQty(i.qty)}${i.name || "Item"}`).join("\n") : " • —");
  if (remarks.length) {
    lines.push("");
    lines.push("📝 *Custom note*");
    lines.push(remarks.map((r: any) => ` • ${r.remark_text.trim()}`).join("\n"));
  }
  lines.push("");
  lines.push(`💰 Total ₹${money(order.bill_total)} · Advance ₹${money(order.advance_paid)} · *Balance ₹${money(order.balance_due)}*`);
  lines.push(`📌 Status: *${statusLabel(order.status)}*`);

  // One message: the detail as the button body + an "Open in KOT app" button.
  await sendCtaUrl(fromPhone, lines.join("\n"), "Open in KOT app", kotAppLink(who.clientId));
}

// ── Data ───────────────────────────────────────────────────────────────────────

async function fetchOrders(who: KotWho, mode: string): Promise<any[]> {
  let q = supabase.from("kot_orders").select("*").eq("client_id", who.clientId);
  if (who.outletIds.length) q = q.in("tenant_id", who.outletIds);

  const todayStart    = istDayStart(0).toISOString();
  const tomorrowStart = istDayStart(1).toISOString();
  if (mode === "today") {
    q = q.gte("delivery_at", todayStart).lt("delivery_at", tomorrowStart);
  } else if (mode === "upcoming") {
    q = q.gte("delivery_at", tomorrowStart).neq("status", "completed");
  } else { // "open" and any fallback
    q = q.neq("status", "completed");
  }
  // 11 so we can tell the user there are "more" beyond the 10-row WhatsApp cap.
  const { data } = await q.order("delivery_at", { ascending: true, nullsFirst: false }).limit(11);
  return data || [];
}

/** order_id → short items summary ("2× Choco, 1× Vanilla"), non-remark items only. */
async function itemSummaries(orderIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!orderIds.length) return out;
  const { data } = await supabase
    .from("kot_order_items").select("order_id, name, qty, is_extra_remark, sort_order")
    .in("order_id", orderIds).order("sort_order");
  const byOrder = new Map<string, any[]>();
  for (const it of data || []) {
    if (it.is_extra_remark) continue;
    const arr = byOrder.get(it.order_id) || [];
    arr.push(it);
    byOrder.set(it.order_id, arr);
  }
  for (const [oid, its] of byOrder) {
    out.set(oid, its.map((i) => `${fmtQty(i.qty)}${i.name || "Item"}`).join(", "));
  }
  return out;
}

async function outletName_(tenantId: string): Promise<string> {
  if (!tenantId) return "";
  const { data } = await supabase.from("tenants").select("name").eq("id", tenantId).limit(1).maybeSingle();
  return (data?.name as string) || "";
}

// ── Formatting ─────────────────────────────────────────────────────────────────

const kotAppLink = (clientId: string) => `${APP_BASE_URL}/kot?c=${clientId}`;

function fmtQty(qty: unknown): string {
  const n = Number(qty || 0);
  return n > 0 ? `${n % 1 === 0 ? n : n.toFixed(2)}× ` : "";
}

function money(v: unknown): string {
  const n = Number(v || 0);
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

/** Compact IST date+time, e.g. "9 Sep, 4:00 PM". Empty for a null delivery time. */
function fmtDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

/** UTC instant of the start (00:00 IST) of today + dayOffset. */
function istDayStart(dayOffset: number): Date {
  const IST = 5.5 * 3600 * 1000;
  const ist = new Date(Date.now() + IST);
  const startUtc = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + dayOffset, 0, 0, 0) - IST;
  return new Date(startUtc);
}

// ── WhatsApp send (duplicated, minimal — isolation) ─────────────────────────────

type ListRow = { id: string; title: string; description?: string };

async function sendText(to: string, body: string): Promise<void> {
  await waSend({ type: "text", text: { body, preview_url: true }, to: to.replace(/\D/g, "") });
}

async function sendList(to: string, body: string, buttonLabel: string, rows: ListRow[]): Promise<void> {
  const section = {
    title: "Orders",
    rows: rows.slice(0, 10).map((r) => {
      const row: Record<string, string> = { id: r.id, title: r.title.slice(0, 24) };
      if (r.description) row.description = r.description.slice(0, 72);
      return row;
    }),
  };
  await waSend({
    type: "interactive",
    to: to.replace(/\D/g, ""),
    interactive: { type: "list", body: { text: body }, action: { button: buttonLabel.slice(0, 20), sections: [section] } },
  });
}

async function sendCtaUrl(to: string, body: string, buttonText: string, url: string): Promise<void> {
  await waSend({
    type: "interactive",
    to: to.replace(/\D/g, ""),
    interactive: { type: "cta_url", body: { text: body }, action: { name: "cta_url", parameters: { display_text: buttonText.slice(0, 20), url } } },
  });
}

async function waSend(partial: Record<string, any>): Promise<void> {
  const res = await fetch(`https://graph.facebook.com/v19.0/${META_PHONE_NUM_ID}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${META_WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...partial }),
  });
  if (!res.ok) console.error(`[kot] send failed ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
}
