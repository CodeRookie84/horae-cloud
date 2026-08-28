/**
 * KOT status pipeline — the single source of truth for the 7 stages an order
 * moves through, who owns each hop, and which stages require a photo.
 *
 * The flow is a strict linear handoff between the Outlet team and the Kitchen
 * team; recording each transition (in kot_status_events) is what lets everyone
 * see exactly where an order is stuck.
 */

export type KotStatus =
  | "order_received"       // Outlet  — KOT scanned & confirmed
  | "indent_created"       // Kitchen — kitchen raises its indent
  | "in_progress"          // Kitchen — cake being made
  | "ready"                // Kitchen — done (PHOTO required)
  | "handed_over"          // Kitchen — handed to outlet/rider
  | "collected"            // Outlet  — received back at outlet (PHOTO required)
  | "completed";           // Outlet  — delivered/picked up, closed

export type KotTeam = "Outlet" | "Kitchen" | "Management";

export interface KotStatusDef {
  id: KotStatus;
  label: string;
  /** Which team performs THIS transition. */
  owner: KotTeam;
  /** Camera capture is mandatory to advance into this status. */
  requiresPhoto: boolean;
  /** Position in the linear pipeline (0-based). */
  step: number;
}

/** Ordered pipeline. Order here defines progression and UI sequence. */
export const KOT_PIPELINE: KotStatusDef[] = [
  { id: "order_received", label: "Order received",         owner: "Outlet",  requiresPhoto: false, step: 0 },
  { id: "indent_created", label: "Indent created by kitchen", owner: "Kitchen", requiresPhoto: false, step: 1 },
  { id: "in_progress",    label: "Order in progress",      owner: "Kitchen", requiresPhoto: false, step: 2 },
  { id: "ready",          label: "Ready marked by kitchen", owner: "Kitchen", requiresPhoto: true,  step: 3 },
  { id: "handed_over",    label: "Handed over by kitchen", owner: "Kitchen", requiresPhoto: false, step: 4 },
  { id: "collected",      label: "Collected by outlet",    owner: "Outlet",  requiresPhoto: true,  step: 5 },
  { id: "completed",      label: "Order completed",        owner: "Outlet",  requiresPhoto: false, step: 6 },
];

const BY_ID: Record<KotStatus, KotStatusDef> =
  Object.fromEntries(KOT_PIPELINE.map((s) => [s.id, s])) as Record<KotStatus, KotStatusDef>;

export function statusDef(id: KotStatus): KotStatusDef {
  return BY_ID[id];
}

export function statusLabel(id: KotStatus): string {
  return BY_ID[id]?.label ?? id;
}

/** The next status in the pipeline, or null if already completed. */
export function nextStatus(id: KotStatus): KotStatus | null {
  const def = BY_ID[id];
  if (!def) return null;
  return KOT_PIPELINE[def.step + 1]?.id ?? null;
}

export function isFinal(id: KotStatus): boolean {
  return id === "completed";
}

/** Whether advancing INTO `id` needs a photo (ready, collected). */
export function statusRequiresPhoto(id: KotStatus): boolean {
  return !!BY_ID[id]?.requiresPhoto;
}
