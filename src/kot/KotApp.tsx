/**
 * KotApp — the KOT module shell. Mounted two ways (both are [KOT] touchpoints in
 * Horae, added later):
 *   • kiosk  — the shared floor tablet reached via the QR + code route
 *   • manager — an icon inside Horae for linked managers/management
 * Both render the same screens; `viewer` says who is acting and which outlet.
 */
import { useCallback, useEffect, useState } from "react";
import type { KotOrder } from "./types";
import { listOrders, subscribeOrders, accessibleOutlets, type KotOutlet } from "./services/kotStore";
import { KOT_PIPELINE, type KotStatus } from "./status";
import { KotButton, KotSpinner, KotEmpty, cn } from "./ui/primitives";
import OrderList from "./screens/OrderList";
import CaptureConfirm from "./screens/CaptureConfirm";
import OrderDetail from "./screens/OrderDetail";
import KotAdmin from "./screens/KotAdmin";

export interface KotViewer {
  clientId: string;
  mode: "kiosk" | "manager";
  tenantId: string;        // active outlet
  tenantLabel: string;
  /** Managers/admins get the "Manage" (People + Stations) entry point. */
  canManage?: boolean;
  actor: { stationId?: string; userId?: string; participantId?: string; name?: string; phone?: string };
}

type Filter = "active" | "all" | "kitchen" | "outlet";

const KITCHEN_STATUSES = new Set<KotStatus>(["indent_created", "in_progress", "ready", "handed_over"]);
const OUTLET_STATUSES = new Set<KotStatus>(["order_received", "collected", "completed"]);

export default function KotApp({ viewer, onExit }: { viewer: KotViewer; onExit?: () => void }) {
  const [orders, setOrders] = useState<KotOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("active");
  const [capturing, setCapturing] = useState(false);
  const [openOrder, setOpenOrder] = useState<KotOrder | null>(null);
  const [managing, setManaging] = useState(false);

  // Cross-outlet: a signed-in manager/participant may cover several outlets. We
  // load the ones they can see and let them switch the active board. Kiosk mode
  // is bound to its station's single outlet, so it never switches.
  const [outlets, setOutlets] = useState<KotOutlet[]>([]);
  const [activeTenant, setActiveTenant] = useState(viewer.tenantId);

  useEffect(() => {
    if (viewer.mode !== "manager") return;
    accessibleOutlets(viewer.clientId, viewer.actor.userId, viewer.actor.phone, !!viewer.canManage)
      .then((os) => {
        setOutlets(os);
        setActiveTenant((cur) => (os.some((o) => o.id === cur) ? cur : os[0]?.id || cur));
      })
      .catch(() => { /* fall back to the single viewer.tenantId */ });
  }, [viewer.clientId, viewer.actor.userId, viewer.actor.phone, viewer.canManage, viewer.mode]);

  const load = useCallback(async () => {
    const rows = await listOrders({ clientId: viewer.clientId, tenantId: activeTenant });
    setOrders(rows);
    setLoading(false);
  }, [viewer.clientId, activeTenant]);

  useEffect(() => {
    setLoading(true);
    load();
    const unsub = subscribeOrders(activeTenant, load);
    return unsub;
  }, [load, activeTenant]);

  // Children act on the currently-selected outlet, not the login's home outlet.
  const activeLabel = outlets.find((o) => o.id === activeTenant)?.name || viewer.tenantLabel;
  const activeViewer: KotViewer = { ...viewer, tenantId: activeTenant, tenantLabel: activeLabel };

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Cake Order Tracking</p>
          <h1 className="text-xl font-bold text-slate-900">{activeLabel}</h1>
        </div>
        <div className="flex items-center gap-2">
          {onExit && (
            <button onClick={onExit} title="Lock / switch outlet" className="rounded-lg px-2 py-2 text-slate-400 hover:bg-slate-100">🔒</button>
          )}
          {viewer.canManage && (
            <KotButton variant="secondary" onClick={() => setManaging(true)}>Manage</KotButton>
          )}
          <KotButton onClick={() => setCapturing(true)}>+ New KOT</KotButton>
        </div>
      </div>

      {/* Outlet switcher — only when the user covers more than one outlet. */}
      {outlets.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {outlets.map((o) => (
            <button
              key={o.id}
              onClick={() => setActiveTenant(o.id)}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                o.id === activeTenant ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-600 hover:bg-slate-50",
              )}
            >
              🏪 {o.name}
            </button>
          ))}
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
        <OrderList orders={visible} onOpen={setOpenOrder} />
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
