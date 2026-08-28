/**
 * OrderDetail — the full order view + the 7-stage status handoff.
 *
 * Advancing INTO `ready` or `collected` forces a photo (kitchen shows the
 * finished cake; outlet shows what it received) before the status can move.
 * Every hop is appended to the status timeline with the actor + time, so the
 * two teams can always see exactly where an order sits — and where it stalled.
 */
import { useEffect, useState } from "react";
import type { KotViewer } from "../KotApp";
import type { KotOrder, KotStatusEvent } from "../types";
import { listStatusEvents, recordStatus, uploadKotPhoto, getOrder } from "../services/kotStore";
import { statusDef, nextStatus, statusLabel, isFinal, type KotStatus } from "../status";
import { KotButton, KotCard, KotStatusBadge, KotStatusRail, cn } from "../ui/primitives";
import { CameraCapture } from "../ui/CameraCapture";
import { formatMoney, formatDeliveryAt, deliveryUrgency } from "../lib/format";

function eventTime(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

export default function OrderDetail(
  { order: initial, viewer, onClose, onChanged }:
  { order: KotOrder; viewer: KotViewer; onClose: () => void; onChanged: () => void },
) {
  const [order, setOrder] = useState<KotOrder>(initial);
  const [events, setEvents] = useState<KotStatusEvent[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);

  async function refresh() {
    const [o, ev] = await Promise.all([getOrder(order.id), listStatusEvents(order.id)]);
    if (o) setOrder(o);
    setEvents(ev);
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const urg = deliveryUrgency(order.deliveryAt);
  const cakes = order.items.filter((i) => !i.isExtraRemark);
  const extras = order.items.filter((i) => i.isExtraRemark);

  async function advance(to: KotStatus, photoUrl: string | null, note: string) {
    await recordStatus(order.id, order.tenantId, to, {
      photoUrl,
      note,
      actor: { stationId: viewer.actor.stationId, participantId: viewer.actor.participantId, name: viewer.actor.name },
    });
    await refresh();
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-slate-900">{order.customerName || "Unnamed customer"}</h2>
          <p className="truncate text-xs text-slate-500">#{order.invoiceNo || "no invoice"}</p>
        </div>
        <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-lg space-y-4">
          {/* Status + progress */}
          <KotCard className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <KotStatusBadge status={order.status} />
              <span className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
                urg.tone === "overdue" ? "bg-red-100 text-red-700" : urg.tone === "soon" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600",
              )}>{urg.label}</span>
            </div>
            <KotStatusRail status={order.status} />
            <AdvancePanel order={order} viewer={viewer} onAdvance={advance} />
          </KotCard>

          {/* Delivery / customer */}
          <KotCard className="p-4 text-sm">
            <Row k={order.fulfilment === "pickup" ? "Self pickup by" : "Deliver to"} v={formatDeliveryAt(order.deliveryAt)} />
            {order.customerPhone && <Row k="Phone" v={order.customerPhone} />}
            {order.fulfilment === "delivery" && order.customerAddress && <Row k="Address" v={order.customerAddress} />}
            <Row k="Bill" v={formatMoney(order.billTotal)} />
            {order.advancePaid > 0 && <Row k="Advance paid" v={formatMoney(order.advancePaid)} />}
            {order.balanceDue > 0 && <Row k="Balance due" v={<span className="font-semibold text-amber-700">{formatMoney(order.balanceDue)}</span>} />}
          </KotCard>

          {/* Cakes */}
          {cakes.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-bold text-slate-800">Items</h3>
              <KotCard className="divide-y divide-slate-100">
                {cakes.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-slate-700">{c.qty ? `${c.qty}× ` : ""}{c.name}</span>
                    {c.amount > 0 && <span className="text-slate-500">{formatMoney(c.amount)}</span>}
                  </div>
                ))}
              </KotCard>
            </div>
          )}

          {/* Custom notes — the handwritten personalisation */}
          <div>
            <h3 className="mb-2 text-sm font-bold text-rose-700">Custom notes {extras.length > 0 && `(${extras.length})`}</h3>
            {extras.length === 0 ? (
              <p className="text-xs text-slate-400">No custom notes on this order.</p>
            ) : (
              <div className="space-y-2">
                {extras.map((ex) => (
                  <KotCard key={ex.id} className="border-rose-200 p-3">
                    <p className="text-sm text-slate-800">{ex.remarkText || <span className="text-slate-400">No text</span>}</p>
                    {ex.drawingPhotoUrl && (
                      <img
                        src={ex.drawingPhotoUrl}
                        alt="Cake drawing"
                        onClick={() => setLightbox(ex.drawingPhotoUrl!)}
                        className="mt-2 h-28 w-28 cursor-zoom-in rounded-lg border border-slate-200 object-cover"
                      />
                    )}
                  </KotCard>
                ))}
              </div>
            )}
          </div>

          {/* The original slip */}
          {order.kotPhotoUrl && (
            <div>
              <h3 className="mb-2 text-sm font-bold text-slate-800">Original KOT slip</h3>
              <img
                src={order.kotPhotoUrl}
                alt="KOT slip"
                onClick={() => setLightbox(order.kotPhotoUrl!)}
                className="max-h-52 w-full cursor-zoom-in rounded-xl border border-slate-200 object-contain"
              />
            </div>
          )}

          {/* Timeline */}
          <div>
            <h3 className="mb-2 text-sm font-bold text-slate-800">Timeline</h3>
            <StatusTimeline events={events} onPhoto={setLightbox} />
          </div>
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}

// ── Advance control ─────────────────────────────────────────────────────────────

function AdvancePanel(
  { order, viewer, onAdvance }:
  { order: KotOrder; viewer: KotViewer; onAdvance: (to: KotStatus, photoUrl: string | null, note: string) => Promise<void>; },
) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (isFinal(order.status)) {
    return <p className="mt-4 rounded-xl bg-green-50 px-3 py-2 text-center text-sm font-semibold text-green-700">Order completed ✓</p>;
  }
  const to = nextStatus(order.status)!;
  const def = statusDef(to);

  async function go(photoUrl: string | null) {
    setBusy(true);
    setErr(null);
    try {
      await onAdvance(to, photoUrl, note.trim());
      setNote("");
    } catch (e: any) {
      setErr("Could not update — " + String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function goWithPhoto(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const url = await uploadKotPhoto(file, `status/${order.id}`);
      await onAdvance(to, url, note.trim());
      setNote("");
    } catch (e: any) {
      setErr("Photo/update failed — " + String(e?.message || e));
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className="text-slate-400">Next:</span>
        <span className={cn("rounded-full px-2 py-0.5 font-semibold",
          def.owner === "Kitchen" ? "bg-blue-100 text-blue-700" : "bg-teal-100 text-teal-700")}>
          {def.owner} action
        </span>
      </div>
      {err && <p className="mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600">{err}</p>}

      {def.requiresPhoto ? (
        <>
          <p className="mb-2 text-xs text-slate-500">
            A photo is required to mark <b>{def.label}</b>.
          </p>
          <CameraCapture
            compact
            busy={busy}
            ctaLabel={`Photo → ${def.label}`}
            confirmLabel={`Mark ${def.label}`}
            onCapture={goWithPhoto}
          />
        </>
      ) : (
        <KotButton className="w-full" disabled={busy} onClick={() => go(null)}>
          {busy ? "Updating…" : `Mark: ${def.label}`}
        </KotButton>
      )}
    </div>
  );
}

// ── Bits ─────────────────────────────────────────────────────────────────────

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <span className="text-slate-500">{k}</span>
      <span className="text-right text-slate-800">{v}</span>
    </div>
  );
}

function StatusTimeline({ events, onPhoto }: { events: KotStatusEvent[]; onPhoto: (url: string) => void }) {
  if (events.length === 0) return <p className="text-xs text-slate-400">No status changes yet.</p>;
  return (
    <ol className="relative space-y-4 border-l-2 border-slate-100 pl-4">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[1.30rem] top-1 h-3 w-3 rounded-full border-2 border-white bg-rose-500" />
          <p className="text-sm font-semibold text-slate-800">{statusLabel(e.status)}</p>
          <p className="text-xs text-slate-400">
            {eventTime(e.createdAt)}{e.actorName ? ` · ${e.actorName}` : ""}
          </p>
          {e.note && <p className="mt-0.5 text-xs text-slate-600">“{e.note}”</p>}
          {e.photoUrl && (
            <img
              src={e.photoUrl}
              alt={statusLabel(e.status)}
              onClick={() => onPhoto(e.photoUrl!)}
              className="mt-1.5 h-20 w-20 cursor-zoom-in rounded-lg border border-slate-200 object-cover"
            />
          )}
        </li>
      ))}
    </ol>
  );
}
