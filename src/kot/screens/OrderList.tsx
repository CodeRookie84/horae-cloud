/** Outlet/kitchen order list — presentational. Data comes from KotApp. */
import type { KotOrder } from "../types";
import { KotCard, KotStatusBadge, KotStatusRail, cn } from "../ui/primitives";
import { formatMoney, formatDeliveryAt, deliveryUrgency } from "../lib/format";

function OrderCard(
  { order, onOpen, outletName }:
  { order: KotOrder; onOpen: (o: KotOrder) => void; outletName?: (id: string) => string },
) {
  const urg = deliveryUrgency(order.deliveryAt);
  const extras = order.items.filter((i) => i.isExtraRemark);
  const cakes = order.items.filter((i) => !i.isExtraRemark);
  const urgTone =
    urg.tone === "overdue" ? "bg-red-100 text-red-700"
    : urg.tone === "soon" ? "bg-amber-100 text-amber-700"
    : "bg-slate-100 text-slate-600";

  return (
    <button onClick={() => onOpen(order)} className="w-full text-left">
      <KotCard className="p-4 transition-shadow hover:shadow-md">
        {outletName && (
          <p className="mb-1.5 inline-block rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
            🏪 {outletName(order.tenantId)}
          </p>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-800">
              {order.customerName || "Unnamed customer"}
            </p>
            <p className="truncate text-xs text-slate-500">
              #{order.invoiceNo || "no invoice"} · {order.fulfilment === "pickup" ? "Self pickup" : "Delivery"}
            </p>
          </div>
          <KotStatusBadge status={order.status} />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {cakes.slice(0, 3).map((c) => (
            <span key={c.id} className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700">
              {c.qty ? `${c.qty}× ` : ""}{c.name}
            </span>
          ))}
          {cakes.length > 3 && (
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-500">+{cakes.length - 3}</span>
          )}
          {extras.length > 0 && (
            <span className="rounded-lg bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
              ✎ {extras.length} custom note{extras.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Status rail on its own row, then urgency + delivery time on one line
            so the date never wraps into a tall column on narrow cards. */}
        <div className="mt-3 space-y-2">
          <KotStatusRail status={order.status} />
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 font-semibold", urgTone)}>{urg.label}</span>
            <span className="whitespace-nowrap text-right text-slate-500">{formatDeliveryAt(order.deliveryAt)}</span>
          </div>
        </div>

        {order.balanceDue > 0 && (
          <p className="mt-2 text-xs font-medium text-amber-700">
            Balance due {formatMoney(order.balanceDue)}
          </p>
        )}
      </KotCard>
    </button>
  );
}

export default function OrderList(
  { orders, onOpen, outletName }:
  { orders: KotOrder[]; onOpen: (o: KotOrder) => void; outletName?: (id: string) => string },
) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {orders.map((o) => <OrderCard key={o.id} order={o} onOpen={onOpen} outletName={outletName} />)}
    </div>
  );
}
