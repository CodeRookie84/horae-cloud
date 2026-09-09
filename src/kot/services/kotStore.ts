/**
 * kotStore — all KOT data access, funnelled through the single Supabase seam
 * (src/kot/lib/supabase.ts). No Horae service is imported; this file is the only
 * thing that talks to the kot_* tables + the kot-photos bucket.
 */
import { supabase } from "../lib/supabase";
import type {
  KotOrder, KotOrderItem, KotParticipant, KotStatusEvent, KotStation, KotFulfilment,
} from "../types";
import type { KotStatus } from "../status";

const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

// ── Row → domain mappers ──────────────────────────────────────────────────────

function mapItem(r: any): KotOrderItem {
  return {
    id: r.id,
    orderId: r.order_id,
    name: r.name ?? "",
    qty: Number(r.qty ?? 0),
    rate: Number(r.rate ?? 0),
    amount: Number(r.amount ?? 0),
    isExtraRemark: !!r.is_extra_remark,
    remarkText: r.remark_text ?? "",
    drawingPhotoUrl: r.drawing_photo_url ?? null,
    sortOrder: Number(r.sort_order ?? 0),
  };
}

function mapOrder(r: any, items: KotOrderItem[], assigneeIds: string[]): KotOrder {
  return {
    id: r.id,
    clientId: r.client_id,
    tenantId: r.tenant_id,
    invoiceNo: r.invoice_no ?? "",
    orderDate: r.order_date ?? "",
    customerName: r.customer_name ?? "",
    customerPhone: r.customer_phone ?? "",
    customerAddress: r.customer_address ?? "",
    deliveryAt: r.delivery_at ?? null,
    fulfilment: (r.fulfilment as KotFulfilment) ?? "delivery",
    billTotal: Number(r.bill_total ?? 0),
    advancePaid: Number(r.advance_paid ?? 0),
    balanceDue: Number(r.balance_due ?? 0),
    kotPhotoUrl: r.kot_photo_url ?? null,
    status: (r.status as KotStatus) ?? "order_received",
    extracted: r.extracted ?? undefined,
    createdByStation: r.created_by_station ?? null,
    createdByUserId: r.created_by_user_id ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    items,
    assigneeIds,
  };
}

function mapParticipant(r: any, outletIds: string[]): KotParticipant {
  return {
    id: r.id,
    clientId: r.client_id,
    name: r.name ?? "",
    phone: r.phone ?? "",
    team: r.team ?? "Outlet",
    linkedUserId: r.linked_user_id ?? null,
    active: r.active ?? true,
    outletIds,
  };
}

// ── Photos ────────────────────────────────────────────────────────────────────

/** Upload a captured photo to kot-photos and return its public URL. */
export async function uploadKotPhoto(file: Blob, folder: string): Promise<string> {
  const ext = (file as File).name?.split(".").pop() || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("kot-photos").upload(path, file, {
    upsert: false,
    contentType: (file as File).type || "image/jpeg",
  });
  if (error) throw error;
  return supabase.storage.from("kot-photos").getPublicUrl(path).data.publicUrl;
}

// ── Outlets (reused from Horae's `tenants`) ───────────────────────────────────
// The one documented coupling to a Horae table: outlets ARE tenants. When KOT is
// extracted into a standalone app, this is the single query to repoint at a KOT-
// owned outlets table.

export interface KotOutlet { id: string; name: string; }

export async function listOutlets(clientId: string): Promise<KotOutlet[]> {
  const { data } = await supabase
    .from("tenants").select("id, name").eq("client_id", clientId).order("name");
  return (data || []).map((t: any) => ({ id: t.id, name: t.name || t.id }));
}

/** Outlets for the PUBLIC kiosk picker. The kiosk renders before any Horae login,
 *  so it can't read the auth-gated `tenants` table — it reads the anon-readable
 *  `kot_stations` instead (permissive RLS). This is also semantically right: you
 *  can only sign into an outlet that has an active station. The station `label`
 *  defaults to the outlet name (see StationEditor), so it reads naturally. */
export async function listStationOutlets(clientId: string): Promise<KotOutlet[]> {
  const { data } = await supabase
    .from("kot_stations").select("tenant_id, label, active")
    .eq("client_id", clientId).eq("active", true);
  const seen = new Map<string, KotOutlet>();
  for (const r of data || []) {
    if (!seen.has(r.tenant_id)) seen.set(r.tenant_id, { id: r.tenant_id, name: (r.label || "").trim() || r.tenant_id });
  }
  return [...seen.values()];
}

/** Outlets a signed-in manager/participant may view. Admins get every outlet;
 *  a participant gets the outlets their People-directory record covers (falling
 *  back to all if they have none set, e.g. management). Runs in the authed app,
 *  so it can read `tenants` for names. */
export async function accessibleOutlets(
  clientId: string, userId: string | undefined, phone: string | undefined, isAdmin: boolean,
): Promise<KotOutlet[]> {
  const all = await listOutlets(clientId);
  if (isAdmin) return all;

  const digits = (phone || "").replace(/\D/g, "");
  const { data } = await supabase.from("kot_participants")
    .select("id, phone, linked_user_id").eq("client_id", clientId).eq("active", true);
  const me = (data || []).find((p: any) =>
    (userId && p.linked_user_id === userId) ||
    (digits && String(p.phone || "").replace(/\D/g, "").endsWith(digits.slice(-10))));
  if (!me) return [];

  const { data: links } = await supabase
    .from("kot_participant_outlets").select("tenant_id").eq("participant_id", me.id);
  const ids = new Set((links || []).map((l: any) => l.tenant_id));
  const mine = all.filter((o) => ids.has(o.id));
  return mine.length ? mine : all; // no explicit outlets → management-style, see all
}

// ── Station access codes ──────────────────────────────────────────────────────

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function listStations(clientId: string): Promise<Array<KotStation & { tenantName?: string }>> {
  const { data } = await supabase.from("kot_stations").select("*").eq("client_id", clientId);
  const outlets = await listOutlets(clientId);
  const nameById = new Map(outlets.map((o) => [o.id, o.name]));
  return (data || []).map((r: any) => ({
    id: r.id, clientId: r.client_id, tenantId: r.tenant_id, label: r.label ?? "",
    active: r.active ?? true, tenantName: nameById.get(r.tenant_id),
  }));
}

export async function createStation(input: { clientId: string; tenantId: string; label: string; code: string }): Promise<void> {
  const { error } = await supabase.from("kot_stations").insert([{
    id: `kst_${crypto.randomUUID()}`,
    client_id: input.clientId, tenant_id: input.tenantId, label: input.label,
    code_hash: await sha256Hex(input.code), active: true,
  }]);
  if (error) throw error;
}

/** Rotate a station's access code — old remembered-device tokens stop working. */
export async function rotateStationCode(stationId: string, code: string): Promise<void> {
  const { error } = await supabase.from("kot_stations")
    .update({ code_hash: await sha256Hex(code), updated_at: new Date().toISOString() })
    .eq("id", stationId);
  if (error) throw error;
}

export async function setStationActive(stationId: string, active: boolean): Promise<void> {
  await supabase.from("kot_stations").update({ active }).eq("id", stationId);
}

export interface KotStationAuth { id: string; clientId: string; tenantId: string; label: string; codeHash: string; }

/** Validate an outlet's access code (client-side hash compare). Null = wrong/disabled. */
export async function authenticateStation(tenantId: string, code: string): Promise<KotStationAuth | null> {
  const codeHash = await sha256Hex(code);
  const { data } = await supabase.from("kot_stations")
    .select("*").eq("tenant_id", tenantId).eq("code_hash", codeHash).eq("active", true).limit(1);
  const r = data?.[0];
  if (!r) return null;
  return { id: r.id, clientId: r.client_id, tenantId: r.tenant_id, label: r.label ?? "", codeHash };
}

/** Re-check a remembered-device session: still active AND code not rotated. */
export async function revalidateStation(stationId: string, codeHash: string): Promise<boolean> {
  const { data } = await supabase.from("kot_stations").select("code_hash, active").eq("id", stationId).limit(1);
  const r = data?.[0];
  return !!r && !!r.active && r.code_hash === codeHash;
}

// ── Manager passcode (client-level, cross-outlet) ─────────────────────────────
// One passcode per KOT client, stored hashed on kot_clients.manager_code_hash.
// Entering it on the kiosk signs in as a manager: all outlets + Report + manage.

/** Validate a client's manager passcode. Returns the hash (for remember-device)
 *  on success, or null when wrong / not set. */
export async function authenticateManager(clientId: string, code: string): Promise<string | null> {
  if (!code.trim()) return null;
  const codeHash = await sha256Hex(code.trim());
  const { data } = await supabase
    .from("kot_clients").select("manager_code_hash").eq("client_id", clientId).limit(1);
  const stored = data?.[0]?.manager_code_hash;
  return stored && stored === codeHash ? codeHash : null;
}

/** Re-check a remembered manager device: passcode still set and not rotated. */
export async function revalidateManager(clientId: string, codeHash: string): Promise<boolean> {
  const { data } = await supabase
    .from("kot_clients").select("manager_code_hash").eq("client_id", clientId).limit(1);
  const stored = data?.[0]?.manager_code_hash;
  return !!stored && stored === codeHash;
}

/** Set / rotate the client manager passcode. Rotating revokes remembered devices. */
export async function setManagerCode(clientId: string, code: string): Promise<void> {
  const { error } = await supabase.from("kot_clients")
    .update({ manager_code_hash: await sha256Hex(code.trim()) })
    .eq("client_id", clientId);
  if (error) throw error;
}

/** Whether this client has a manager passcode configured (for the admin UI). */
export async function hasManagerCode(clientId: string): Promise<boolean> {
  const { data } = await supabase
    .from("kot_clients").select("manager_code_hash").eq("client_id", clientId).limit(1);
  return !!data?.[0]?.manager_code_hash;
}

// ── Participant admin (People Directory) ──────────────────────────────────────

export async function createParticipant(input: {
  clientId: string; name: string; phone: string; team: string; outletIds: string[];
}): Promise<void> {
  const id = `kpt_${crypto.randomUUID()}`;
  const { error } = await supabase.from("kot_participants").insert([{
    id, client_id: input.clientId, name: input.name, phone: input.phone, team: input.team, active: true,
  }]);
  if (error) throw error;
  await replaceParticipantOutlets(id, input.outletIds);
}

export async function updateParticipant(id: string, patch: {
  name: string; phone: string; team: string; active: boolean; outletIds: string[];
}): Promise<void> {
  const { error } = await supabase.from("kot_participants")
    .update({ name: patch.name, phone: patch.phone, team: patch.team, active: patch.active })
    .eq("id", id);
  if (error) throw error;
  await replaceParticipantOutlets(id, patch.outletIds);
}

export async function deleteParticipant(id: string): Promise<void> {
  await supabase.from("kot_participant_outlets").delete().eq("participant_id", id);
  await supabase.from("kot_participants").delete().eq("id", id);
}

async function replaceParticipantOutlets(participantId: string, tenantIds: string[]): Promise<void> {
  await supabase.from("kot_participant_outlets").delete().eq("participant_id", participantId);
  if (tenantIds.length) {
    await supabase.from("kot_participant_outlets").insert(
      tenantIds.map((tenant_id) => ({ participant_id: participantId, tenant_id })),
    );
  }
}

// ── AI extraction (kot-extract edge function) ─────────────────────────────────

/** Shape returned by the kot-extract function — a DRAFT for the confirm form. */
export interface KotExtraction {
  invoiceNo: string;
  orderDate: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  deliveryAt: string | null;
  fulfilment: "pickup" | "delivery";
  billTotal: number;
  advancePaid: number;
  balanceDue: number;
  items: Array<{ name: string; qty: number; rate: number; amount: number }>;
  extraRemarks: Array<{ text: string }>;
  lowConfidenceFields: string[];
}

/** Send an uploaded slip's URL to Claude vision; returns a best-effort draft. */
export async function extractKot(imageUrl: string): Promise<KotExtraction> {
  const { data, error } = await supabase.functions.invoke("kot-extract", {
    body: { imageUrl },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "Extraction failed");
  return data.data as KotExtraction;
}

// ── Participants (People Directory) ───────────────────────────────────────────

export async function listParticipants(clientId: string): Promise<KotParticipant[]> {
  const { data: parts } = await supabase
    .from("kot_participants").select("*").eq("client_id", clientId).eq("active", true);
  if (!parts?.length) return [];
  const { data: links } = await supabase
    .from("kot_participant_outlets").select("*")
    .in("participant_id", parts.map((p: any) => p.id));
  const byPart = new Map<string, string[]>();
  for (const l of links || []) {
    const arr = byPart.get(l.participant_id) || [];
    arr.push(l.tenant_id);
    byPart.set(l.participant_id, arr);
  }
  return parts.map((p: any) => mapParticipant(p, byPart.get(p.id) || []));
}

/** Default assignees for an outlet: everyone whose group covers that tenant. */
export async function outletParticipants(clientId: string, tenantId: string): Promise<KotParticipant[]> {
  const all = await listParticipants(clientId);
  return all.filter((p) => p.outletIds.includes(tenantId));
}

// ── Orders ────────────────────────────────────────────────────────────────────

async function hydrateOrders(rows: any[]): Promise<KotOrder[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [{ data: items }, { data: assignees }] = await Promise.all([
    supabase.from("kot_order_items").select("*").in("order_id", ids).order("sort_order"),
    supabase.from("kot_order_assignees").select("*").in("order_id", ids),
  ]);
  const itemsByOrder = new Map<string, KotOrderItem[]>();
  for (const it of items || []) {
    const arr = itemsByOrder.get(it.order_id) || [];
    arr.push(mapItem(it));
    itemsByOrder.set(it.order_id, arr);
  }
  const assigneesByOrder = new Map<string, string[]>();
  for (const a of assignees || []) {
    const arr = assigneesByOrder.get(a.order_id) || [];
    arr.push(a.participant_id);
    assigneesByOrder.set(a.order_id, arr);
  }
  return rows.map((r) => mapOrder(r, itemsByOrder.get(r.id) || [], assigneesByOrder.get(r.id) || []));
}

export async function listOrders(
  opts: { clientId: string; tenantId?: string; tenantIds?: string[] },
): Promise<KotOrder[]> {
  let q = supabase.from("kot_orders").select("*").eq("client_id", opts.clientId);
  // A single outlet, or an explicit set of outlets (the kiosk's unlocked list,
  // for the "All Outlets" view). Omit both → every outlet of the client
  // (manager/admin "All Outlets").
  if (opts.tenantId) q = q.eq("tenant_id", opts.tenantId);
  else if (opts.tenantIds?.length) q = q.in("tenant_id", opts.tenantIds);
  const { data } = await q.order("created_at", { ascending: false });
  return hydrateOrders(data || []);
}

/** Does an order with this invoice already exist for the client? Used to warn of
 *  a duplicate scan early (the DB also enforces UNIQUE(client_id, invoice_no)).
 *  Returns the existing order's customer/status for a helpful message, or null. */
export async function findOrderByInvoice(
  clientId: string, invoiceNo: string,
): Promise<{ id: string; customerName: string; status: string } | null> {
  const inv = invoiceNo.trim();
  if (!inv) return null;
  const { data } = await supabase.from("kot_orders")
    .select("id, customer_name, status")
    .eq("client_id", clientId).eq("invoice_no", inv).limit(1);
  const r = data?.[0];
  return r ? { id: r.id, customerName: r.customer_name ?? "", status: r.status } : null;
}

export async function getOrder(id: string): Promise<KotOrder | null> {
  const { data } = await supabase.from("kot_orders").select("*").eq("id", id).single();
  if (!data) return null;
  const [order] = await hydrateOrders([data]);
  return order || null;
}

/** Hard-delete an order and everything hanging off it. Manager/admin only — the
 *  UI gates this on viewer.canManage; there's no undo. */
export async function deleteOrder(id: string): Promise<void> {
  await supabase.from("kot_status_events").delete().eq("order_id", id);
  await supabase.from("kot_order_assignees").delete().eq("order_id", id);
  await supabase.from("kot_order_items").delete().eq("order_id", id);
  const { error } = await supabase.from("kot_orders").delete().eq("id", id);
  if (error) throw error;
}

export interface CreateOrderInput {
  clientId: string;
  tenantId: string;
  invoiceNo: string;
  orderDate: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  deliveryAt: string | null;
  fulfilment: KotFulfilment;
  billTotal: number;
  advancePaid: number;
  balanceDue: number;
  kotPhotoUrl?: string | null;
  extracted?: unknown;
  items: Array<Omit<KotOrderItem, "id" | "orderId">>;
  assigneeIds: string[];
  actor: { stationId?: string; userId?: string; participantId?: string; name?: string };
}

/** Creates the order + its items + default assignees + the opening status event. */
export async function createOrder(input: CreateOrderInput): Promise<KotOrder> {
  const orderId = uid("kot");
  const { error } = await supabase.from("kot_orders").insert([{
    id: orderId,
    client_id: input.clientId,
    tenant_id: input.tenantId,
    invoice_no: input.invoiceNo || null,
    order_date: input.orderDate,
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    customer_address: input.customerAddress,
    delivery_at: input.deliveryAt,
    fulfilment: input.fulfilment,
    bill_total: input.billTotal,
    advance_paid: input.advancePaid,
    balance_due: input.balanceDue,
    kot_photo_url: input.kotPhotoUrl ?? null,
    status: "order_received",
    extracted: input.extracted ?? null,
    created_by_station: input.actor.stationId ?? null,
    created_by_user_id: input.actor.userId ?? null,
  }]);
  if (error) throw error;

  if (input.items.length) {
    await supabase.from("kot_order_items").insert(
      input.items.map((it, i) => ({
        id: uid("kti"),
        order_id: orderId,
        name: it.name,
        qty: it.qty,
        rate: it.rate,
        amount: it.amount,
        is_extra_remark: it.isExtraRemark,
        remark_text: it.remarkText,
        drawing_photo_url: it.drawingPhotoUrl ?? null,
        sort_order: it.sortOrder ?? i,
      })),
    );
  }
  if (input.assigneeIds.length) {
    await supabase.from("kot_order_assignees").insert(
      input.assigneeIds.map((pid) => ({ order_id: orderId, participant_id: pid })),
    );
  }
  await recordStatus(orderId, input.tenantId, "order_received", { actor: input.actor });

  // Fire the isolated KOT notification lane (best-effort; a DB webhook can also
  // drive this server-side, but this guarantees it without webhook setup).
  supabase.functions.invoke("kot-notify", { body: { type: "order_created", orderId } })
    .catch((e) => console.warn("[kot] notify on create failed", e));

  const created = await getOrder(orderId);
  if (!created) throw new Error("Order created but could not be re-read");
  return created;
}

/** Appends a status event and moves the order's current status forward. */
export async function recordStatus(
  orderId: string,
  tenantId: string,
  status: KotStatus,
  opts: {
    photoUrl?: string | null;
    note?: string;
    actor?: { stationId?: string; participantId?: string; name?: string };
  } = {},
): Promise<void> {
  await supabase.from("kot_status_events").insert([{
    id: uid("kse"),
    order_id: orderId,
    tenant_id: tenantId,
    status,
    photo_url: opts.photoUrl ?? null,
    note: opts.note ?? "",
    actor_station_id: opts.actor?.stationId ?? null,
    actor_participant_id: opts.actor?.participantId ?? null,
    actor_name: opts.actor?.name ?? "",
  }]);
  await supabase.from("kot_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId);
}

export async function listStatusEvents(orderId: string): Promise<KotStatusEvent[]> {
  const { data } = await supabase
    .from("kot_status_events").select("*").eq("order_id", orderId)
    .order("created_at", { ascending: true });
  return (data || []).map((r: any) => ({
    id: r.id,
    orderId: r.order_id,
    tenantId: r.tenant_id,
    status: r.status,
    photoUrl: r.photo_url,
    note: r.note ?? "",
    actorStationId: r.actor_station_id,
    actorParticipantId: r.actor_participant_id,
    actorName: r.actor_name ?? "",
    createdAt: r.created_at,
  }));
}

// ── Realtime ──────────────────────────────────────────────────────────────────

/** Subscribe to order + status changes for an outlet (kitchen/outlet tablets). */
export function subscribeOrders(tenantId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`kot_orders_${tenantId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "kot_orders", filter: `tenant_id=eq.${tenantId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "kot_status_events", filter: `tenant_id=eq.${tenantId}` }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

/** Subscribe to order changes across many outlets (the "All Outlets" board).
 *  `clientId` scopes the client-wide case (empty `tenantIds` = all outlets of the
 *  client); a non-empty `tenantIds` watches just those outlets (kiosk unlocked
 *  set). Filtering the reload happens in listOrders, so here we only need a wake. */
export function subscribeOrdersMulti(
  opts: { clientId: string; tenantIds?: string[] },
  onChange: () => void,
): () => void {
  const ch = supabase.channel(`kot_orders_multi_${opts.clientId}_${(opts.tenantIds || []).join("-") || "all"}`);
  if (opts.tenantIds?.length) {
    for (const t of opts.tenantIds) {
      ch.on("postgres_changes", { event: "*", schema: "public", table: "kot_orders", filter: `tenant_id=eq.${t}` }, onChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "kot_status_events", filter: `tenant_id=eq.${t}` }, onChange);
    }
  } else {
    ch.on("postgres_changes", { event: "*", schema: "public", table: "kot_orders", filter: `client_id=eq.${opts.clientId}` }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "kot_status_events" }, onChange);
  }
  ch.subscribe();
  return () => { supabase.removeChannel(ch); };
}
