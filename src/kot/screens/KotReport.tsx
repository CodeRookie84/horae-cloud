/**
 * KotReport — the cross-outlet order report for managers/admins.
 *
 * Reached by the "Report" button in KotApp, which only shows when the viewer has
 * canReport (a Horae admin, or a device signed in with the client Manager
 * passcode). It lists EVERY order of the client in one filterable table — outlet,
 * invoice, customer, delivery, status, last updated — with per-status counts at
 * the top so a manager can spot what's stuck and step in. Tapping a row opens the
 * full OrderDetail (same actions the manager has elsewhere).
 */
import { useEffect, useMemo, useState } from "react";
import type { KotViewer } from "../KotApp";
import type { KotOrder } from "../types";
import { listOrders } from "../services/kotStore";
import { KOT_PIPELINE, type KotStatus } from "../status";
import { KotSpinner, KotStatusBadge, cn } from "../ui/primitives";
import { formatDeliveryAt, deliveryUrgency } from "../lib/format";
import OrderDetail from "./OrderDetail";

function updatedTime(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

const selCls = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400";

type DateFilter = "all" | "today" | "tomorrow" | "week" | "overdue" | "on";

/** Local (device-time) YYYY-MM-DD key for a date. */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Whether an order's DELIVERY date passes the chosen date filter. Orders with no
 *  delivery date are excluded from every date filter except "all". */
function matchesDateFilter(o: KotOrder, filter: DateFilter, onDate: string): boolean {
  if (filter === "all") return true;
  if (!o.deliveryAt) return false;
  const d = new Date(o.deliveryAt);
  if (isNaN(d.getTime())) return false;

  const now = new Date();
  const todayKey = dateKey(now);
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);

  if (filter === "today") return dateKey(d) === todayKey;
  if (filter === "tomorrow") return dateKey(d) === dateKey(tomorrow);
  if (filter === "overdue") return d.getTime() < now.getTime() && o.status !== "completed" && o.status !== "closed";
  if (filter === "on") return onDate ? dateKey(d) === onDate : true;
  if (filter === "week") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59);
    return d >= start && d <= end;
  }
  return true;
}

export default function KotReport(
  { clientId, outletName, viewer, onClose, onChanged }:
  {
    clientId: string;
    outletName: (id: string) => string;
    viewer: KotViewer;
    onClose: () => void;
    onChanged?: () => void;
  },
) {
  const [orders, setOrders] = useState<KotOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<KotStatus | "all" | "open">("open");
  const [outletFilter, setOutletFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [onDate, setOnDate] = useState<string>(""); // YYYY-MM-DD for the "on a date" option
  const [open, setOpen] = useState<KotOrder | null>(null);

  async function load() {
    setOrders(await listOrders({ clientId }));
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  // Distinct outlets actually present in the data (so the picker never lists
  // empty outlets), sorted by name.
  const outlets = useMemo(() => {
    const ids = Array.from(new Set(orders.map((o) => o.tenantId)));
    return ids.map((id) => ({ id, name: outletName(id) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [orders, outletName]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const o of orders) c[o.status] = (c[o.status] || 0) + 1;
    return c;
  }, [orders]);
  const openCount = orders.filter((o) => o.status !== "completed" && o.status !== "closed").length;

  const rows = useMemo(() => {
    return orders
      .filter((o) => outletFilter === "all" || o.tenantId === outletFilter)
      .filter((o) => {
        if (statusFilter === "all") return true;
        if (statusFilter === "open") return o.status !== "completed" && o.status !== "closed";
        return o.status === statusFilter;
      })
      .filter((o) => matchesDateFilter(o, dateFilter, onDate))
      // Most-urgent delivery first; orders with no delivery time sink to the end.
      .sort((a, b) => {
        const ta = a.deliveryAt ? new Date(a.deliveryAt).getTime() : Infinity;
        const tb = b.deliveryAt ? new Date(b.deliveryAt).getTime() : Infinity;
        return ta - tb;
      });
  }, [orders, outletFilter, statusFilter, dateFilter, onDate]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Order Report</p>
          <h2 className="text-lg font-bold text-slate-900">All outlets · {orders.length} orders</h2>
        </div>
        <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-5xl">
          {loading ? (
            <div className="flex justify-center py-20"><KotSpinner className="h-8 w-8" /></div>
          ) : (
            <>
              {/* Status count tiles — also act as quick filters. */}
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-9">
                <CountTile label="Open" count={openCount} active={statusFilter === "open"} onClick={() => setStatusFilter("open")} tone="rose" />
                {KOT_PIPELINE.map((s) => (
                  <CountTile
                    key={s.id}
                    label={s.label}
                    count={counts[s.id] || 0}
                    active={statusFilter === s.id}
                    onClick={() => setStatusFilter(s.id)}
                  />
                ))}
              </div>

              {/* Status + date + outlet filters. The count tiles above and this
                  status dropdown stay in sync (both drive statusFilter). */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <select className={selCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as KotStatus | "all" | "open")}>
                  <option value="all">All statuses</option>
                  <option value="open">Open (not completed)</option>
                  {KOT_PIPELINE.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>

                <select className={selCls} value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)}>
                  <option value="all">All dates</option>
                  <option value="today">Delivery today</option>
                  <option value="tomorrow">Delivery tomorrow</option>
                  <option value="week">Next 7 days</option>
                  <option value="overdue">Overdue</option>
                  <option value="on">On a date…</option>
                </select>
                {dateFilter === "on" && (
                  <input type="date" className={selCls} value={onDate} onChange={(e) => setOnDate(e.target.value)} />
                )}

                <select className={selCls} value={outletFilter} onChange={(e) => setOutletFilter(e.target.value)}>
                  <option value="all">All outlets</option>
                  {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>

                <span className="text-sm text-slate-500">{rows.length} shown</span>
              </div>

              {/* Table (scrolls horizontally on small screens). */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Outlet</th>
                      <th className="px-3 py-2 font-semibold">Invoice</th>
                      <th className="px-3 py-2 font-semibold">Customer</th>
                      <th className="px-3 py-2 font-semibold">Delivery</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-500">No orders match this filter.</td></tr>
                    ) : rows.map((o) => {
                      const urg = deliveryUrgency(o.deliveryAt);
                      return (
                        <tr
                          key={o.id}
                          onClick={() => setOpen(o)}
                          className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-rose-50/40"
                        >
                          <td className="px-3 py-2 font-medium text-slate-700">{outletName(o.tenantId)}</td>
                          <td className="px-3 py-2 text-slate-500">#{o.invoiceNo || "—"}</td>
                          <td className="px-3 py-2">
                            <span className="font-medium text-slate-800">{o.customerName || "—"}</span>
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            <span className="whitespace-nowrap">{formatDeliveryAt(o.deliveryAt)}</span>
                            {urg.tone !== "ok" && (
                              <span className={cn(
                                "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                                urg.tone === "overdue" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700",
                              )}>{urg.label}</span>
                            )}
                          </td>
                          <td className="px-3 py-2"><KotStatusBadge status={o.status} /></td>
                          <td className="px-3 py-2 whitespace-nowrap text-slate-500">{updatedTime(o.updatedAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {open && (
        <OrderDetail
          order={open}
          viewer={viewer}
          onClose={() => setOpen(null)}
          onChanged={() => { load(); onChanged?.(); }}
          onDeleted={() => { setOpen(null); load(); onChanged?.(); }}
        />
      )}
    </div>
  );
}

function CountTile(
  { label, count, active, onClick, tone = "slate" }:
  { label: string; count: number; active: boolean; onClick: () => void; tone?: "slate" | "rose" },
) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "rounded-xl border px-3 py-2 text-left transition-colors",
        active
          ? "border-rose-500 bg-rose-50"
          : tone === "rose"
            ? "border-rose-200 bg-white hover:bg-rose-50"
            : "border-slate-200 bg-white hover:bg-slate-50",
      )}
    >
      <p className="text-lg font-bold text-slate-900">{count}</p>
      <p className="truncate text-[11px] font-medium text-slate-500">{label}</p>
    </button>
  );
}
