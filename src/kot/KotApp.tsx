/**
 * KotApp — the KOT module shell. Mounted two ways (both are [KOT] touchpoints in
 * Horae, added later):
 *   • kiosk  — the shared floor tablet reached via the QR + code route
 *   • manager — an icon inside Horae for linked managers/management
 * Both render the same screens; `viewer` says who is acting and which outlet(s).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { KotOrder } from "./types";
import {
  listOrders, subscribeOrders, subscribeOrdersMulti,
  accessibleOutlets, type KotOutlet,
} from "./services/kotStore";
import { KOT_PIPELINE, type KotStatus } from "./status";
import { KotButton, KotSpinner, KotEmpty, cn } from "./ui/primitives";
import OrderList from "./screens/OrderList";
import CaptureConfirm from "./screens/CaptureConfirm";
import OrderDetail from "./screens/OrderDetail";
import KotAdmin from "./screens/KotAdmin";
import KotReport from "./screens/KotReport";

/** Sentinel for the combined "All Outlets" board. */
const ALL = "__all__";

export interface KotViewer {
  clientId: string;
  mode: "kiosk" | "manager";
  tenantId: string;        // the "home" / default outlet (for + New KOT)
  tenantLabel: string;
  /** Admins/managers get the "Manage" (People + Stations) entry point. */
  canManage?: boolean;
  /** Admins + managers may delete an order (separate from People/Station admin). */
  canDelete?: boolean;
  /** Admins/managers get the cross-outlet order Report. */
  canReport?: boolean;
  /** The outlets this viewer may switch between. When omitted (Horae manager
   *  login) we derive them from the People directory. The kiosk passes its
   *  unlocked set; a manager passcode passes every station outlet. */
  coveredOutlets?: KotOutlet[];
  /** When true, "All Outlets" spans every order of the client (manager/admin),
   *  not just the covered set. */
  seesAllClient?: boolean;
  /** Kiosk only: the station id unlocked for each outlet, so a status action is
   *  attributed to the right station when several outlets are unlocked on one
   *  device. Absent for Horae-login / manager viewers. */
  stationByTenant?: Record<string, string>;
  actor: { stationId?: string; userId?: string; participantId?: string; name?: string; phone?: string };
}

type Filter = "active" | "all" | "kitchen" | "outlet";

const KITCHEN_STATUSES = new Set<KotStatus>(["indent_created", "in_progress", "ready", "handed_over"]);
const OUTLET_STATUSES = new Set<KotStatus>(["order_received", "collected", "completed"]);

export default function KotApp(
  { viewer, onExit, onAddOutlet }:
  { viewer: KotViewer; onExit?: () => void; onAddOutlet?: () => void },
) {
  const [orders, setOrders] = useState<KotOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("active");
  const [capturing, setCapturing] = useState(false);
  const [openOrder, setOpenOrder] = useState<KotOrder | null>(null);
  const [managing, setManaging] = useState(false);
  const [reporting, setReporting] = useState(false);
  // The outlet switcher is collapsed by default (one button) to save space on
  // mobile; tapping it expands the individual outlet options.
  const [switcherOpen, setSwitcherOpen] = useState(false);

  // The outlets this viewer can switch between. Kiosk/manager-passcode pass them
  // in; a Horae-login manager has them derived from the People directory.
  const [outlets, setOutlets] = useState<KotOutlet[]>(viewer.coveredOutlets || []);
  // Which board is showing: ALL (combined) or a single outlet id.
  const [scope, setScope] = useState<string>(ALL);

  useEffect(() => {
    if (viewer.coveredOutlets) { setOutlets(viewer.coveredOutlets); return; }
    if (viewer.mode !== "manager") return;
    accessibleOutlets(viewer.clientId, viewer.actor.userId, viewer.actor.phone, !!viewer.canManage)
      .then(setOutlets)
      .catch(() => { /* fall back to the single viewer.tenantId */ });
  }, [viewer.coveredOutlets, viewer.clientId, viewer.actor.userId, viewer.actor.phone, viewer.canManage, viewer.mode]);

  // Default board: combined when the viewer covers more than one outlet,
  // otherwise the single outlet they have.
  useEffect(() => {
    if (outlets.length <= 1) setScope(outlets[0]?.id || viewer.tenantId);
    else setScope(ALL);
  }, [outlets, viewer.tenantId]);

  const outletIds = useMemo(() => outlets.map((o) => o.id), [outlets]);
  const nameById = useMemo(() => {
    const m = new Map(outlets.map((o) => [o.id, o.name]));
    return (id: string) => m.get(id) || id;
  }, [outlets]);

  const load = useCallback(async () => {
    if (scope === ALL) {
      const rows = viewer.seesAllClient
        ? await listOrders({ clientId: viewer.clientId })
        : await listOrders({ clientId: viewer.clientId, tenantIds: outletIds });
      setOrders(rows);
    } else {
      setOrders(await listOrders({ clientId: viewer.clientId, tenantId: scope }));
    }
    setLoading(false);
  }, [viewer.clientId, viewer.seesAllClient, scope, outletIds]);

  useEffect(() => {
    setLoading(true);
    load();
    const unsub = scope === ALL
      ? subscribeOrdersMulti({ clientId: viewer.clientId, tenantIds: viewer.seesAllClient ? undefined : outletIds }, load)
      : subscribeOrders(scope, load);
    return unsub;
  }, [load, scope, viewer.clientId, viewer.seesAllClient, outletIds]);

  const showingAll = scope === ALL;
  const activeLabel = showingAll ? "All Outlets" : (nameById(scope) || viewer.tenantLabel);
  // Children act on the currently-selected outlet. In the combined view there is
  // no single outlet, so capture (which needs one) falls back to the home outlet.
  const activeOutletId = showingAll ? viewer.tenantId : scope;
  const captureLabel = showingAll ? viewer.tenantLabel : (nameById(scope) || viewer.tenantLabel);
  // On a multi-outlet kiosk each outlet has its own station — attribute the
  // action (and the actor name) to whichever outlet is currently selected.
  const actorStationId = viewer.stationByTenant?.[activeOutletId] ?? viewer.actor.stationId;
  const actorName = viewer.stationByTenant ? (nameById(activeOutletId) || viewer.actor.name) : viewer.actor.name;
  const activeViewer: KotViewer = {
    ...viewer,
    tenantId: activeOutletId,
    tenantLabel: captureLabel,
    actor: { ...viewer.actor, stationId: actorStationId, name: actorName },
  };

  const visible = orders.filter((o) => {
    if (filter === "all") return true;
    if (filter === "active") return o.status !== "completed";
    if (filter === "kitchen") return KITCHEN_STATUSES.has(o.status);
    if (filter === "outlet") return OUTLET_STATUSES.has(o.status);
    return true;
  });

  const FILTERS: Array<{ id: Filter; label: string }> = [
    { id: "active", label: "Active" },
    { id: "kitchen", label: "Kitchen" },
    { id: "outlet", label: "Outlet" },
    { id: "all", label: "All" },
  ];

  // "+ New KOT" needs a single outlet. In the combined view with several outlets
  // it's ambiguous, so we hide it and ask the user to pick an outlet first.
  const canCapture = !showingAll || outlets.length <= 1;

  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      {/* Header — stacks on mobile so the action buttons never overflow the
          screen; row with the title on wider viewports. */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Cake Order Tracking</p>
            <h1 className="truncate text-xl font-bold text-slate-900">{activeLabel}</h1>
          </div>
          {onExit && (
            <button onClick={onExit} title="Lock / switch outlet" className="shrink-0 rounded-lg px-2 py-2 text-slate-400 hover:bg-slate-100 sm:hidden">🔒</button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onExit && (
            <button onClick={onExit} title="Lock / switch outlet" className="hidden rounded-lg px-2 py-2 text-slate-400 hover:bg-slate-100 sm:inline-block">🔒</button>
          )}
          {viewer.canReport && (
            <KotButton variant="secondary" className="flex-1 sm:flex-none" onClick={() => setReporting(true)}>Report</KotButton>
          )}
          {viewer.canManage && (
            <KotButton variant="secondary" className="flex-1 sm:flex-none" onClick={() => setManaging(true)}>Manage</KotButton>
          )}
          {canCapture && (
            <KotButton className="flex-1 sm:flex-none" onClick={() => setCapturing(true)}>+ New KOT</KotButton>
          )}
        </div>
      </div>

      {/* Outlet switcher — collapsed to a single button by default (saves space
          on mobile); tapping it expands All Outlets + one pill per outlet. Only
          shown when the viewer covers more than one outlet. */}
      {outlets.length > 1 && (
        <div className="mb-4">
          {!switcherOpen ? (
            <button
              onClick={() => setSwitcherOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700"
            >
              <span>{showingAll ? "🗂️ All Outlets" : `🏪 ${nameById(scope)}`}</span>
              <span className="text-rose-400">▾</span>
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setScope(ALL); setSwitcherOpen(false); }}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                  showingAll ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-600 hover:bg-slate-50",
                )}
              >
                🗂️ All Outlets
              </button>
              {outlets.map((o) => (
                <button
                  key={o.id}
                  onClick={() => { setScope(o.id); setSwitcherOpen(false); }}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                    o.id === scope ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-600 hover:bg-slate-50",
                  )}
                >
                  🏪 {o.name}
                </button>
              ))}
              {onAddOutlet && (
                <button
                  onClick={onAddOutlet}
                  className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
                >
                  + Add outlet
                </button>
              )}
              <button
                onClick={() => setSwitcherOpen(false)}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-400 hover:bg-slate-50"
              >
                ▴ Collapse
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filter pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              filter === f.id ? "bg-rose-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><KotSpinner className="h-8 w-8" /></div>
      ) : visible.length === 0 ? (
        <KotEmpty
          icon="🎂"
          title={filter === "active" ? "No active orders" : "No orders here"}
          hint="Scan a KOT slip with “+ New KOT” to start tracking a cake order."
        />
      ) : (
        <OrderList orders={visible} onOpen={setOpenOrder} outletName={showingAll ? nameById : undefined} />
      )}

      {/* Order detail + status handoff */}
      {openOrder && (
        <OrderDetail
          order={openOrder}
          viewer={activeViewer}
          onClose={() => setOpenOrder(null)}
          onChanged={load}
          onDeleted={() => { setOpenOrder(null); load(); }}
        />
      )}

      {/* People Directory + station setup (managers only) */}
      {managing && (
        <KotAdmin clientId={viewer.clientId} onClose={() => setManaging(false)} />
      )}

      {/* Cross-outlet order report (managers/admins only) */}
      {reporting && (
        <KotReport
          clientId={viewer.clientId}
          outletName={nameById}
          viewer={activeViewer}
          onClose={() => setReporting(false)}
          onChanged={load}
        />
      )}

      {/* Capture → AI auto-fill → confirm. On save, refresh the list. */}
      {capturing && (
        <CaptureConfirm
          viewer={activeViewer}
          onCancel={() => setCapturing(false)}
          onDone={() => { setCapturing(false); load(); }}
        />
      )}

      {/* Pipeline legend — quiet reference of the 7 stages. */}
      <div className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
        {KOT_PIPELINE.map((s, i) => (
          <span key={s.id}>
            {i > 0 && <span className="mr-2">›</span>}
            {s.label}{s.requiresPhoto ? " 📷" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
