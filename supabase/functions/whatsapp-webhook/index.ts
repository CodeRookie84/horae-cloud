/**
 * Supabase Edge Function: whatsapp-webhook
 *
 * Receives callbacks from Meta's WhatsApp Cloud API for the same business
 * number notify-dispatcher sends from:
 *  - GET  → webhook verification handshake (one-time, when registering the
 *           URL in the Meta App Dashboard).
 *  - POST → `statuses` events (delivered/read/failed receipts for messages
 *           Horae sent) and `messages` events (inbound replies from staff).
 *
 * Meta requires a fast 200 response regardless of internal outcome, so every
 * failure path here logs and swallows rather than surfacing an error status.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFY_TOKEN     = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN")!;

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

  try {
    const body = await req.json();
    const entries = body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        if (Array.isArray(value.statuses)) {
          for (const s of value.statuses) await handleStatus(s);
        }
        if (Array.isArray(value.messages)) {
          for (const m of value.messages) await handleInboundMessage(m, value.contacts?.[0]);
        }
      }
    }
  } catch (err) {
    console.error("[whatsapp-webhook] Error:", err);
    // Fall through to the 200 below anyway — Meta will disable the webhook
    // after too many non-200 responses, and there's nothing the sender can
    // retry-fix on their end for a parsing/internal error.
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

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

/** An inbound reply from a staff member's phone to the Horae WhatsApp number. */
async function handleInboundMessage(m: any, contact: any) {
  const fromPhone: string = m?.from || contact?.wa_id || "";
  if (!fromPhone) return;

  const body: string = m?.text?.body ?? (m?.type ? `[${m.type}]` : "");
  const receivedAt = m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString();
  const contextWamid: string | undefined = m?.context?.id;

  // Match to a Horae user by the last 10 digits of their phone number — same
  // convention store.ts's normalizePhone() uses for login matching.
  const last10 = fromPhone.replace(/\D/g, "").slice(-10);
  let userId: string | null = null;
  let tenantId: string | null = null;
  if (last10.length === 10) {
    const { data: matched } = await supabase
      .from("users")
      .select("id, tenant_id")
      .like("phone_number", `%${last10}`)
      .limit(1);
    if (matched && matched[0]) {
      userId = matched[0].id;
      tenantId = matched[0].tenant_id;
    }
  }

  const { error } = await supabase.from("whatsapp_inbound_messages").insert([{
    wa_message_id: m?.id,
    from_phone: fromPhone,
    user_id: userId,
    tenant_id: tenantId,
    body,
    context_wa_message_id: contextWamid,
    received_at: receivedAt,
  }]);
  if (error) console.error("[whatsapp-webhook] inbound insert failed:", error);
}
