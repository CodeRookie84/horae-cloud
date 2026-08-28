/**
 * CaptureConfirm — the capture → AI auto-fill → confirm flow.
 *
 *   1. Scan the KOT slip (with retake).
 *   2. Upload it + run kot-extract (Claude vision) to pre-fill the form.
 *   3. Human confirms/edits EVERY field. Printed items + the all-important
 *      handwritten extra-remarks (editable text + optional cake-drawing photo).
 *   4. Save → creates the order, its items, default assignees, opening status.
 *
 * The slip photo is always retained as source of truth; extraction is a draft.
 */
import { useEffect, useMemo, useState } from "react";
import type { KotViewer } from "../KotApp";
import type { KotOrder, KotParticipant, KotFulfilment } from "../types";
import {
  uploadKotPhoto, extractKot, outletParticipants, createOrder, type KotExtraction,
} from "../services/kotStore";
import { KotButton, KotCard, KotSpinner, cn } from "../ui/primitives";
import { CameraCapture } from "../ui/CameraCapture";
import { formatMoney } from "../lib/format";

type Step = "capture" | "extracting" | "confirm";

interface ItemRow { id: string; name: string; qty: string; rate: string; amount: string; }
interface ExtraRow { id: string; text: string; drawingFile: File | null; drawingPreview: string | null; }

const uid = () => crypto.randomUUID();
const num = (s: string) => Number(String(s).replace(/[^0-9.]/g, "")) || 0;

/** ISO (any offset) → value for <input type="datetime-local"> in device local time. */
function isoToLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const localToIso = (local: string): string | null =>
  local ? new Date(local).toISOString() : null;

export default function CaptureConfirm(
  { viewer, onDone, onCancel }: { viewer: KotViewer; onDone: (o: KotOrder) => void; onCancel: () => void },
) {
  const [step, setStep] = useState<Step>("capture");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [slipUrl, setSlipUrl] = useState<string | null>(null);
  const [lowConf, setLowConf] = useState<Set<string>>(new Set());

  // Form fields
  const [invoiceNo, setInvoiceNo] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [deliveryLocal, setDeliveryLocal] = useState("");
  const [fulfilment, setFulfilment] = useState<KotFulfilment>("delivery");
  const [billTotal, setBillTotal] = useState("0");
  const [advancePaid, setAdvancePaid] = useState("0");
  const [balanceDue, setBalanceDue] = useState("0");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [extras, setExtras] = useState<ExtraRow[]>([]);

  // Assignees (default = everyone in the outlet's groups)
  const [participants, setParticipants] = useState<KotParticipant[]>([]);
  const [assignees, setAssignees] = useState<Set<string>>(new Set());

  useEffect(() => {
    outletParticipants(viewer.clientId, viewer.tenantId).then((ps) => {
      setParticipants(ps);
      setAssignees(new Set(ps.map((p) => p.id)));
    });
  }, [viewer.clientId, viewer.tenantId]);

  // Keep balance in step with bill − advance until the user edits it directly.
  const [balanceTouched, setBalanceTouched] = useState(false);
  useEffect(() => {
    if (!balanceTouched) setBalanceDue(String(Math.max(0, num(billTotal) - num(advancePaid))));
  }, [billTotal, advancePaid, balanceTouched]);

  function applyExtraction(x: KotExtraction) {
    setInvoiceNo(x.invoiceNo || "");
    setOrderDate(x.orderDate || "");
    setCustomerName(x.customerName || "");
    setCustomerPhone(x.customerPhone || "");
    setCustomerAddress(x.customerAddress || "");
    setDeliveryLocal(isoToLocal(x.deliveryAt));
    setFulfilment(x.fulfilment === "pickup" ? "pickup" : "delivery");
    setBillTotal(String(x.billTotal ?? 0));
    setAdvancePaid(String(x.advancePaid ?? 0));
    setBalanceDue(String(x.balanceDue ?? 0));
    setBalanceTouched(true);
    setItems((x.items || []).map((it) => ({
      id: uid(), name: it.name || "", qty: String(it.qty ?? ""), rate: String(it.rate ?? ""), amount: String(it.amount ?? ""),
    })));
    setExtras((x.extraRemarks || []).map((r) => ({
      id: uid(), text: r.text || "", drawingFile: null, drawingPreview: null,
    })));
    setLowConf(new Set(x.lowConfidenceFields || []));
  }

  async function handleSlip(file: File) {
    setError(null);
    setStep("extracting");
    try {
      const url = await uploadKotPhoto(file, `slips/${viewer.tenantId}`);
      setSlipUrl(url);
      try {
        const x = await extractKot(url);
        applyExtraction(x);
      } catch (e) {
        // Extraction failed — still let them fill the form by hand over the photo.
        setError("Auto-fill couldn't read the slip. Please enter the details manually.");
      }
      setStep("confirm");
    } catch (e) {
      setError("Photo upload failed. Check the connection and retake.");
      setStep("capture");
    }
  }

  const flagged = (field: string) => lowConf.has(field);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      // Upload any cake-drawing photos first.
      const extraItems = await Promise.all(extras.map(async (ex, i) => {
        let drawingUrl: string | null = null;
        if (ex.drawingFile) drawingUrl = await uploadKotPhoto(ex.drawingFile, `drawings/${viewer.tenantId}`);
        return {
          name: "Custom note", qty: 0, rate: 0, amount: 0,
          isExtraRemark: true, remarkText: ex.text, drawingPhotoUrl: drawingUrl, sortOrder: 1000 + i,
        };
      }));

      const printedItems = items.map((it, i) => ({
        name: it.name, qty: num(it.qty), rate: num(it.rate), amount: num(it.amount),
        isExtraRemark: false, remarkText: "", drawingPhotoUrl: null, sortOrder: i,
      }));

      const order = await createOrder({
        clientId: viewer.clientId,
        tenantId: viewer.tenantId,
        invoiceNo,
        orderDate,
        customerName,
        customerPhone,
        customerAddress,
        deliveryAt: localToIso(deliveryLocal),
        fulfilment,
        billTotal: num(billTotal),
        advancePaid: num(advancePaid),
        balanceDue: num(balanceDue),
        kotPhotoUrl: slipUrl,
        extracted: { lowConfidenceFields: Array.from(lowConf) },
        items: [...printedItems, ...extraItems],
        assigneeIds: Array.from(assignees),
        actor: { stationId: viewer.actor.stationId, userId: viewer.actor.userId, participantId: viewer.actor.participantId, name: viewer.actor.name },
      });
      onDone(order);
    } catch (e: any) {
      const msg = String(e?.message || e);
      setError(
        msg.includes("uq_kot_orders_invoice") || msg.includes("duplicate")
          ? "This invoice number already has an order — it may have been scanned already."
          : "Could not save the order. " + msg,
      );
      setSaving(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (step === "capture") {
    return (
      <Shell title="Scan the KOT" onCancel={onCancel}>
        {error && <ErrorNote>{error}</ErrorNote>}
        <CameraCapture
          onCapture={handleSlip}
          ctaLabel="Scan the KOT slip"
          confirmLabel="Use this photo"
          hint="Lay the slip flat and fill the frame — handwritten notes must be legible."
        />
      </Shell>
    );
  }

  if (step === "extracting") {
    return (
      <Shell title="Reading the slip…" onCancel={onCancel}>
        <div className="flex flex-col items-center gap-3 py-16">
          <KotSpinner className="h-8 w-8" />
          <p className="text-sm text-slate-500">Auto-filling the order from the photo…</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Confirm the order" onCancel={onCancel}>
      {error && <ErrorNote>{error}</ErrorNote>}
      {lowConf.size > 0 && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Fields highlighted amber were hard to read — please double-check them.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Invoice #" flag={flagged("invoiceNo")}>
          <input className={inp} value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
        </Field>
        <Field label="Order date" flag={flagged("orderDate")}>
          <input className={inp} value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
        </Field>
        <Field label="Customer name" flag={flagged("customerName")}>
          <input className={inp} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </Field>
        <Field label="Customer phone" flag={flagged("customerPhone")}>
          <input className={inp} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
        </Field>
      </div>

      <div className="mt-3">
        <Field label="Delivery / pickup type">
          <div className="flex gap-2">
            {(["delivery", "pickup"] as KotFulfilment[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFulfilment(f)}
                className={cn(
                  "flex-1 rounded-xl border px-3 py-2 text-sm font-medium capitalize",
                  fulfilment === f ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-600",
                )}
              >
                {f === "pickup" ? "Self pickup" : "Delivery"}
              </button>
            ))}
          </div>
        </Field>
      </div>

      {fulfilment === "delivery" && (
        <div className="mt-3">
          <Field label="Delivery address" flag={flagged("customerAddress")}>
            <textarea className={inp} rows={2} value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
          </Field>
        </div>
      )}

      <div className="mt-3">
        <Field label="Delivery date & time" flag={flagged("deliveryAt")}>
          <input type="datetime-local" className={inp} value={deliveryLocal} onChange={(e) => setDeliveryLocal(e.target.value)} />
        </Field>
      </div>

      {/* Money */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Field label="Bill total"><input className={inp} inputMode="decimal" value={billTotal} onChange={(e) => setBillTotal(e.target.value)} /></Field>
        <Field label="Advance paid"><input className={inp} inputMode="decimal" value={advancePaid} onChange={(e) => setAdvancePaid(e.target.value)} /></Field>
        <Field label="Balance due">
          <input className={inp} inputMode="decimal" value={balanceDue}
            onChange={(e) => { setBalanceTouched(true); setBalanceDue(e.target.value); }} />
        </Field>
      </div>

      {/* Printed items */}
      <SectionHeading title="Items" onAdd={() => setItems((r) => [...r, { id: uid(), name: "", qty: "", rate: "", amount: "" }])} />
      <div className="flex flex-col gap-2">
        {items.map((it) => (
          <div key={it.id} className="grid grid-cols-[1fr_3rem_4rem_4.5rem_1.5rem] items-center gap-2">
            <input className={inpSm} placeholder="Cake / item" value={it.name}
              onChange={(e) => setItems((r) => r.map((x) => x.id === it.id ? { ...x, name: e.target.value } : x))} />
            <input className={inpSm} placeholder="Qty" value={it.qty}
              onChange={(e) => setItems((r) => r.map((x) => x.id === it.id ? { ...x, qty: e.target.value } : x))} />
            <input className={inpSm} placeholder="Rate" value={it.rate}
              onChange={(e) => setItems((r) => r.map((x) => x.id === it.id ? { ...x, rate: e.target.value } : x))} />
            <input className={inpSm} placeholder="Amount" value={it.amount}
              onChange={(e) => setItems((r) => r.map((x) => x.id === it.id ? { ...x, amount: e.target.value } : x))} />
            <button className="text-slate-400 hover:text-red-500" onClick={() => setItems((r) => r.filter((x) => x.id !== it.id))}>✕</button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-slate-400">No items — add the cakes from the slip.</p>}
      </div>

      {/* Extra remarks — the handwritten personalisation */}
      <SectionHeading
        title="Custom notes (handwritten)"
        accent
        onAdd={() => setExtras((r) => [...r, { id: uid(), text: "", drawingFile: null, drawingPreview: null }])}
      />
      <p className="-mt-1 mb-2 text-xs text-slate-500">
        The customer's personalisation the kitchen must not miss. Edit the text and attach the cake drawing if there is one.
      </p>
      <div className="flex flex-col gap-3">
        {extras.map((ex) => (
          <KotCard key={ex.id} className="border-rose-200 p-3">
            <div className="flex items-start gap-2">
              <textarea
                className={cn(inp, "flex-1")}
                rows={2}
                placeholder="e.g. 'Happy Birthday Naresh — cake base full white'"
                value={ex.text}
                onChange={(e) => setExtras((r) => r.map((x) => x.id === ex.id ? { ...x, text: e.target.value } : x))}
              />
              <button className="mt-1 text-slate-400 hover:text-red-500" onClick={() => setExtras((r) => r.filter((x) => x.id !== ex.id))}>✕</button>
            </div>
            <div className="mt-2">
              {ex.drawingPreview ? (
                <div className="flex items-center gap-3">
                  <img src={ex.drawingPreview} alt="Cake drawing" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
                  <KotButton variant="ghost" onClick={() => setExtras((r) => r.map((x) => x.id === ex.id ? { ...x, drawingFile: null, drawingPreview: null } : x))}>
                    Remove drawing
                  </KotButton>
                </div>
              ) : (
                <CameraCapture
                  compact
                  ctaLabel="Attach cake drawing"
                  confirmLabel="Use drawing"
                  onCapture={(file) =>
                    setExtras((r) => r.map((x) => x.id === ex.id ? { ...x, drawingFile: file, drawingPreview: URL.createObjectURL(file) } : x))
                  }
                />
              )}
            </div>
          </KotCard>
        ))}
        {extras.length === 0 && <p className="text-xs text-slate-400">No custom notes captured — add any pen-written instruction from the slip.</p>}
      </div>

      {/* Assignees */}
      <SectionHeading title="Notify" />
      <p className="-mt-1 mb-2 text-xs text-slate-500">Pre-filled from this outlet's team. Untick anyone who shouldn't be notified.</p>
      <AssigneePicker participants={participants} selected={assignees} onToggle={(id) =>
        setAssignees((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; })
      } />

      {/* Save */}
      <div className="sticky bottom-0 -mx-4 mt-6 flex items-center justify-between gap-3 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur">
        <span className="text-sm text-slate-500">Balance {formatMoney(num(balanceDue))}</span>
        <KotButton onClick={save} disabled={saving} className="min-w-40">
          {saving ? "Saving…" : "Save order"}
        </KotButton>
      </div>
    </Shell>
  );
}

// ── Small building blocks ───────────────────────────────────────────────────────

const inp = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-400";
const inpSm = "w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-rose-400";

function Shell({ title, onCancel, children }: { title: string; onCancel: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <button onClick={onCancel} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-lg">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, flag, children }: { label: string; flag?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={cn("mb-1 block text-xs font-semibold", flag ? "text-amber-600" : "text-slate-500")}>
        {label}{flag && " ⚠"}
      </span>
      <div className={flag ? "rounded-xl ring-2 ring-amber-200" : ""}>{children}</div>
    </label>
  );
}

function SectionHeading({ title, onAdd, accent }: { title: string; onAdd?: () => void; accent?: boolean }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between">
      <h3 className={cn("text-sm font-bold", accent ? "text-rose-700" : "text-slate-800")}>{title}</h3>
      {onAdd && <button onClick={onAdd} className="text-sm font-semibold text-rose-600 hover:text-rose-700">+ Add</button>}
    </div>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{children}</p>;
}

function AssigneePicker(
  { participants, selected, onToggle }:
  { participants: KotParticipant[]; selected: Set<string>; onToggle: (id: string) => void },
) {
  const groups = useMemo(() => {
    const g: Record<string, KotParticipant[]> = { Outlet: [], Kitchen: [], Management: [] };
    for (const p of participants) (g[p.team] ||= []).push(p);
    return g;
  }, [participants]);

  if (participants.length === 0) {
    return <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">No people set up for this outlet yet — add them in KOT admin.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {(["Outlet", "Kitchen", "Management"] as const).map((team) => groups[team]?.length ? (
        <div key={team}>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{team}</p>
          <div className="flex flex-wrap gap-2">
            {groups[team].map((p) => {
              const on = selected.has(p.id);
              return (
                <button key={p.id} onClick={() => onToggle(p.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm",
                    on ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-500",
                  )}>
                  {on ? "✓ " : ""}{p.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null)}
    </div>
  );
}
