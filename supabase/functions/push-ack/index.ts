/**
 * Supabase Edge Function: push-ack
 *
 * Plan B health signal. The Horae service worker POSTs here whenever it actually
 * receives a web push (and again, as 'seen', when the user taps it). That's the
 * only reliable proof a push reached the device — web push itself gives no
 * delivery receipt.
 *
 * We stamp users.last_push_ack_at (read by notify-dispatcher's pushHealthy()) and
 * log a row in push_receipts for deliverability analytics. This does NOT drive a
 * per-message fallback; it only tells the daily digest whether a user's push pipe
 * is alive, so the digest can fall back to WhatsApp for users whose push is dead.
 *
 * Note: acks are unauthenticated (a service worker has no user JWT handy). The
 * worst a spoofed ack can do is mark a user "push healthy" and thereby skip a
 * WhatsApp digest fallback — a low-severity failure — so we accept it for now.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  const userId   = body.userId as string | undefined;
  const tenantId = body.tenantId as string | undefined;
  const tag      = body.tag as string | undefined;
  const ackType  = body.ackType === "seen" ? "seen" : "delivered";

  if (!userId) {
    return new Response(JSON.stringify({ ok: false, error: "userId required" }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    await supabase.from("users").update({ last_push_ack_at: new Date().toISOString() }).eq("id", userId);
    await supabase.from("push_receipts").insert([{ user_id: userId, tenant_id: tenantId, tag, ack_type: ackType }]);
  } catch (err) {
    console.error("[push-ack] failed:", err);
    // Swallow — a lost ack just risks one unnecessary WhatsApp digest later.
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { ...CORS, "Content-Type": "application/json" },
  });
});
