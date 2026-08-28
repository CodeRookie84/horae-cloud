/** Small formatting helpers, local to KOT (no Horae import). */

export function formatMoney(n: number): string {
  const v = Number(n || 0);
  return "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/** "Tue 18 Aug, 1:00 PM" — or "—" when no delivery time is set. */
export function formatDeliveryAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    weekday: "short", day: "2-digit", month: "short",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

/** Relative urgency label for the delivery, e.g. "in 3h", "tomorrow", "overdue". */
export function deliveryUrgency(iso: string | null): { label: string; tone: "ok" | "soon" | "overdue" } {
  if (!iso) return { label: "no time set", tone: "ok" };
  const d = new Date(iso).getTime();
  if (isNaN(d)) return { label: "no time set", tone: "ok" };
  const ms = d - Date.now();
  const hrs = ms / 3_600_000;
  if (ms < 0) return { label: "overdue", tone: "overdue" };
  if (hrs <= 2) return { label: `in ${Math.max(1, Math.round(hrs))}h`, tone: "soon" };
  if (hrs <= 24) return { label: "today", tone: "soon" };
  if (hrs <= 48) return { label: "tomorrow", tone: "ok" };
  return { label: `in ${Math.round(hrs / 24)}d`, tone: "ok" };
}
