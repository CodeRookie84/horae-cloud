/**
 * Supabase Edge Function: kot-reminders  (part of the isolated KOT lane)
 *
 * Cron-invoked. Selects due orders, claims each in kot_reminder_log (so a
 * reminder fires at most once), then hands off to kot-notify for delivery.
 *
 *   { mode: "day_before" }  → run daily at 19:00 IST; orders delivering TOMORROW.
 *   { mode: "soon" }        → run every ~15 min; orders delivering within ~2h.
 *
 * Suggested Supabase cron (times in UTC; IST = UTC+5:30):
 *   day_before : 30 13 * * *      (= 19:00 IST)   body {"mode":"day_before"}
 *   soon       : every 15 min      * / 15 * * * *    body {"mode":"soon"}
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NOTIFY_URL       = `${SUPABASE_URL}/functions/v1/kot-notify`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

serve(async (req) => {
  let mode: "day_before" | "soon" = "soon";
  try { const b = await req.json(); if (b?.mode === "day_before") mode = "day_before"; } catch { /* default soon */ }

  const now = Date.now();
  let startIso: string, endIso: string;

  if (mode === "day_before") {
    // Tomorrow's full day in IST → expressed as a UTC range.
    const istNow = new Date(now + IST_OFFSET_MS);
    const y = istNow.getUTCFullYear(), m = istNow.getUTCMonth(), d = istNow.getUTCDate();
    const tomorrowStartUtc = Date.UTC(y, m, d + 1, 0, 0, 0) - IST_OFFSET_MS;
    startIso = new Date(tomorrowStartUtc).toISOString();
    endIso = new Date(tomorrowStartUtc + 24 * 3600 * 1000).toISOString();
  } else {
    // Next ~2 hours from now.
    startIso = new Date(now).toISOString();
    endIso = new Date(now + 2 * 3600 * 1000).toISOString();
  }

  const { data: orders } = await supabase
    .from("kot_orders")
    .select("id, delivery_at, status")
    .neq("status", "completed")
    .not("delivery_at", "is", null)
    .gte("delivery_at", startIso)
    .lt("delivery_at", endIso);

  let sent = 0;
  for (const o of orders || []) {
    // Claim atomically — PK (order_id, kind); a duplicate insert (23505) means
    // this reminder already went out, so skip.
    const { error } = await supabase.from("kot_reminder_log").insert([{ order_id: o.id, kind: mode }]);
    if (error) continue;
    try {
      await fetch(NOTIFY_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${SUPABASE_SERVICE}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "reminder", orderId: o.id, kind: mode }),
      });
      sent++;
    } catch (e) {
      console.error("[kot-reminders] notify failed", o.id, String(e));
      // Roll back the claim so a later sweep retries.
      await supabase.from("kot_reminder_log").delete().eq("order_id", o.id).eq("kind", mode);
    }
  }

  return new Response(JSON.stringify({ ok: true, mode, considered: orders?.length || 0, sent }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
