/**
 * Super-admin "WhatsApp Billing" tab — which WhatsApp messages Meta charged for,
 * to whom, and for which client. Fed by whatsapp_message_pricing, which
 * whatsapp-webhook fills with PAID messages only (from the `pricing` object on
 * Meta's status callbacks). Rupee amounts are an ESTIMATE from
 * Meta's India per-message rates; Meta's own billing page is the source of truth.
 */
import React, { useEffect, useMemo, useState } from "react";
import { IndianRupee, RefreshCw } from "lucide-react";
import { supabase } from "../services/supabaseClient";
import { Client, Tenant, User } from "../types";

// Approximate Meta India rates (₹ per delivered message). Update if Meta reprices.
const RATE_INR: Record<string, number> = { marketing: 0.7846, utility: 0.115, authentication: 0.115 };

const EVENT_LABELS: Record<string, string> = {
  morning_nudge: "Daily briefing",
  task_assigned: "New task",
  task_reassigned: "Task reassigned",
  urgent_push: "Urgent / Notify",
};

interface PricingRow {
  wa_message_id: string;
  recipient: string | null;
  user_id: string | null;
  tenant_id: string | null;
  client_id: string | null;
  billable: boolean | null;
  category: string | null;
  pricing_type: string | null;
  status: string | null;
  sent_at: string | null;
}

const UNMATCHED = "__unmatched";

export default function WhatsAppBillingReport({ clients, tenants, users }: { clients: Client[]; tenants: Tenant[]; users: User[] }) {
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [days, setDays] = useState<number>(7);
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [events, setEvents] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      let q = supabase.from("whatsapp_message_pricing").select("*").gte("sent_at", since).order("sent_at", { ascending: false }).limit(2000);
      if (clientFilter === UNMATCHED) q = q.is("client_id", null);
      else if (clientFilter !== "all") q = q.eq("client_id", clientFilter);
      const { data, error: err } = await q;
      if (err) throw err;
      const list = (data || []) as PricingRow[];
      setRows(list);

      // Label each message with the Horae event that sent it (when it came via
      // notify-dispatcher); everything else is a chat reply/other.
      const ids = list.map(r => r.wa_message_id);
      const map: Record<string, string> = {};
      for (let i = 0; i < ids.length; i += 200) {
        const { data: logs } = await supabase.from("notification_log")
          .select("wa_message_id, event_type").in("wa_message_id", ids.slice(i, i + 200));
        for (const l of logs || []) if (l.wa_message_id) map[l.wa_message_id] = l.event_type;
      }
      setEvents(map);
    } catch (e: any) {
      setError(e?.message || "Couldn't load billing data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clientFilter, days]);

  const userById = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
  const tenantById = useMemo(() => new Map(tenants.map(t => [t.id, t])), [tenants]);
  const clientById = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);

  // The table only ever holds paid messages; the filter is a belt-and-braces guard.
  const isPaid = (r: PricingRow) => r.billable === true && r.pricing_type !== "free_customer_service" && r.pricing_type !== "free_entry_point";
  const cost = (r: PricingRow) => RATE_INR[r.category || ""] ?? 0;

  const paid = rows.filter(isPaid);
  const totalCost = paid.reduce((s, r) => s + cost(r), 0);
  const byCategory = paid.reduce<Record<string, number>>((acc, r) => {
    const k = r.category || "unknown";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const byClient = useMemo(() => {
    const m = new Map<string, { paid: number; cost: number }>();
    for (const r of paid) {
      const k = r.client_id || UNMATCHED;
      const e = m.get(k) || { paid: 0, cost: 0 };
      e.paid++; e.cost += cost(r);
      m.set(k, e);
    }
    return [...m.entries()].sort((a, b) => b[1].cost - a[1].cost);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const shown = paid;
  const clientName = (id: string | null) => (id ? clientById.get(id)?.name || id : "Unmatched number");
  const fmtInr = (n: number) => `₹${n.toFixed(2)}`;

  return (
    <div className="space-y-5">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <IndianRupee className="w-4.5 h-4.5 text-indigo-600" />
              WhatsApp Billing
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              Paid WhatsApp messages only, as reported by Meta. ₹ amounts are estimates at India rates.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={clientFilter}
              onChange={e => setClientFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white font-semibold text-slate-700"
            >
              <option value="all">All clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.logo} {c.name}</option>)}
              <option value={UNMATCHED}>Unmatched numbers</option>
            </select>
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white font-semibold text-slate-700"
            >
              <option value={1}>Last 24 hours</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              onClick={load}
              className="flex items-center gap-1.5 text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat label="Paid messages" value={String(paid.length)} />
          <Stat label="Approx. charges" value={fmtInr(totalCost)} />
          <Stat
            label="Paid by category"
            value={Object.keys(byCategory).length ? Object.entries(byCategory).map(([k, v]) => `${k} ${v}`).join(" · ") : "—"}
            small
          />
        </div>
        {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}
      </div>

      {clientFilter === "all" && byClient.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="text-xs font-bold text-slate-700 mb-3">By client</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="py-2 pr-3">Client</th><th className="py-2 pr-3">Paid messages</th><th className="py-2">Approx. ₹</th>
                </tr>
              </thead>
              <tbody>
                {byClient.map(([id, v]) => (
                  <tr key={id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => setClientFilter(id)}>
                    <td className="py-2 pr-3 font-semibold text-slate-700">{clientName(id === UNMATCHED ? null : id)}</td>
                    <td className="py-2 pr-3">{v.paid}</td>
                    <td className="py-2 font-semibold">{fmtInr(v.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-slate-700">Paid messages ({shown.length})</h4>
        </div>
        {shown.length === 0 ? (
          <p className="text-xs text-slate-400 font-medium py-6 text-center">
            {loading ? "Loading…" : "No paid messages in this period. (Tracking started 26 Sep 2026.)"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="py-2 pr-3">Sent</th>
                  <th className="py-2 pr-3">Recipient</th>
                  <th className="py-2 pr-3">Client / Outlet</th>
                  <th className="py-2 pr-3">Message</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Approx. ₹</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(r => {
                  const u = r.user_id ? userById.get(r.user_id) : undefined;
                  const t = r.tenant_id ? tenantById.get(r.tenant_id) : undefined;
                  const ev = events[r.wa_message_id];
                  return (
                    <tr key={r.wa_message_id} className="border-t border-slate-100">
                      <td className="py-2 pr-3 whitespace-nowrap text-slate-500">
                        {r.sent_at ? new Date(r.sent_at).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="font-semibold text-slate-700">{u?.name || "Unknown"}</div>
                        <div className="text-[10px] text-slate-400 font-mono">+{r.recipient}</div>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">
                        {clientName(r.client_id)}{t ? <span className="text-slate-400"> · {t.name}</span> : null}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{ev ? (EVENT_LABELS[ev] || ev) : "Chat reply / other"}</td>
                      <td className="py-2 pr-3 capitalize">{r.category || "—"}</td>
                      <td className="py-2 pr-3">
                        <span className="font-semibold text-slate-700">{fmtInr(cost(r))}</span>
                      </td>
                      <td className="py-2 capitalize text-slate-500">{r.status || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="border border-slate-100 bg-slate-50/50 rounded-xl p-3">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
      <div className={`${small ? "text-xs" : "text-lg"} font-bold text-slate-800 capitalize mt-1`}>{value}</div>
    </div>
  );
}
