/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * projectsService.ts — persistence + scoring for the Projects module
 * (milestone pipelines for outcome-paid roles: marketing, real estate, sales).
 *
 * Tables (migration supabase/migrations/20260924210446_projects.sql), all
 * client-scoped:
 *   projects               — pipeline; milestones (+ gating checklists) as jsonb
 *   project_deliverables   — items moving milestone → milestone
 *   project_activity       — append-only history per deliverable
 *   project_targets        — per-person count and/or ₹ value target per period
 *   project_daily_updates  — one status line per person per project per day
 *
 * Gating rule: a deliverable can leave a milestone only when every REQUIRED
 * checklist item of that milestone is done, and — if the milestone requires
 * approval — a manager has approved it. Leaving the LAST milestone closes the
 * deliverable as won.
 */
import { supabase } from "./supabaseClient";
import { compressImage } from "../kot/lib/image";

// ─── Types ───────────────────────────────────────────────────────────────────
export type ChecklistItemType = "tick" | "number" | "amount" | "text" | "date" | "file";

export interface MilestoneChecklistItem {
  id: string;
  text: string;
  type: ChecklistItemType;
  required: boolean;
}

export interface Milestone {
  id: string;
  name: string;
  /** Days a deliverable may sit here before it counts as stuck. */
  slaDays: number;
  requiresApproval: boolean;
  checklist: MilestoneChecklistItem[];
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  description: string;
  itemLabel: string;
  color: string;
  status: "active" | "archived";
  milestones: Milestone[];
  memberIds: string[];
  createdBy?: string;
  createdAt: string;
}

export interface ChecklistAnswer { done: boolean; value?: string; by?: string; at?: string }
export interface ApprovalState {
  status: "pending" | "approved" | "rejected";
  requestedBy?: string;
  decidedBy?: string;
  at?: string;
  note?: string;
}

export interface Deliverable {
  id: string;
  projectId: string;
  clientId: string;
  title: string;
  contactName: string;
  contactPhone: string;
  value: number;
  ownerUserId: string;
  milestoneId: string;
  status: "open" | "won" | "lost";
  checklist: Record<string, Record<string, ChecklistAnswer>>;
  approvals: Record<string, ApprovalState>;
  notes: string;
  milestoneEnteredAt: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEntry {
  id: string;
  deliverableId: string;
  userId?: string;
  userName?: string;
  kind: string;
  text?: string;
  createdAt: string;
}

export interface Target {
  id: string;
  projectId: string;
  userId: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  targetCount: number | null;
  targetValue: number | null;
}

export interface DailyUpdate {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  day: string;
  text: string;
  createdAt: string;
}

export interface Actor { id: string; name: string }

const newId = (p: string) => `${p}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
export const todayStr = () => new Date().toLocaleDateString("en-CA");

// ─── Templates ───────────────────────────────────────────────────────────────
type TplMilestone = { name: string; slaDays?: number; approval?: boolean; items: [string, ChecklistItemType, boolean?][] };
export interface ProjectTemplate { id: string; name: string; blurb: string; itemLabel: string; milestones: TplMilestone[] }

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "real-estate", name: "Real estate sales", itemLabel: "Lead",
    blurb: "Enquiry to site visit, booking, agreement and commission invoice.",
    milestones: [
      { name: "New lead", slaDays: 1, items: [["Client name & phone captured", "tick"], ["Budget (₹)", "amount"], ["Lead source", "text", false]] },
      { name: "Contacted", slaDays: 3, items: [["First call done", "tick"], ["Requirement noted", "text"]] },
      { name: "Site visit", slaDays: 7, items: [["Visit date", "date"], ["Site visit photo", "file"], ["Client feedback", "text", false]] },
      { name: "Negotiation", slaDays: 10, items: [["Offer price (₹)", "amount"], ["Payment plan shared", "tick"]] },
      { name: "Booking", slaDays: 7, approval: true, items: [["Booking amount (₹)", "amount"], ["Booking receipt", "file"]] },
      { name: "Agreement", slaDays: 15, items: [["Signed agreement", "file"], ["KYC documents collected", "tick"]] },
      { name: "Invoice & commission", slaDays: 7, approval: true, items: [["Invoice number", "text"], ["Invoice copy", "file"]] },
    ],
  },
  {
    id: "marketing", name: "Marketing / lead generation", itemLabel: "Lead",
    blurb: "Qualify leads, send proposals, win and invoice.",
    milestones: [
      { name: "Lead captured", slaDays: 1, items: [["Contact details verified", "tick"], ["Source / campaign", "text", false]] },
      { name: "Qualified", slaDays: 3, items: [["Need & budget confirmed", "tick"], ["Estimated value (₹)", "amount"]] },
      { name: "Proposal sent", slaDays: 5, items: [["Proposal document", "file"], ["Follow-up call done", "tick"]] },
      { name: "Won", slaDays: 5, approval: true, items: [["Signed PO / confirmation", "file"], ["Final value (₹)", "amount"]] },
      { name: "Invoiced", slaDays: 7, items: [["Invoice number", "text"], ["Payment received", "tick", false]] },
    ],
  },
  {
    id: "agency", name: "Agency deliverables", itemLabel: "Deliverable",
    blurb: "Brief to draft, client review, delivery and billing.",
    milestones: [
      { name: "Brief received", slaDays: 2, items: [["Brief document", "file", false], ["Deadline agreed", "date"]] },
      { name: "In progress", slaDays: 5, items: [["Draft shared internally", "tick"]] },
      { name: "Client review", slaDays: 5, items: [["Sent to client", "tick"], ["Feedback noted", "text", false]] },
      { name: "Delivered", slaDays: 3, approval: true, items: [["Final files", "file"]] },
      { name: "Billed", slaDays: 7, items: [["Invoice number", "text"]] },
    ],
  },
  { id: "blank", name: "Blank", itemLabel: "Deliverable", blurb: "Start with three simple milestones and build your own.",
    milestones: [
      { name: "Step 1", items: [] }, { name: "Step 2", items: [] }, { name: "Completed", items: [] },
    ],
  },
];

export function milestonesFromTemplate(tpl: ProjectTemplate): Milestone[] {
  return tpl.milestones.map(m => ({
    id: newId("ms"),
    name: m.name,
    slaDays: m.slaDays ?? 7,
    requiresApproval: !!m.approval,
    checklist: m.items.map(([text, type, required]) => ({ id: newId("ci"), text, type, required: required !== false })),
  }));
}

export const newMilestone = (name = "New milestone"): Milestone =>
  ({ id: newId("ms"), name, slaDays: 7, requiresApproval: false, checklist: [] });
export const newChecklistItem = (): MilestoneChecklistItem =>
  ({ id: newId("ci"), text: "", type: "tick", required: true });

// ─── Mappers ─────────────────────────────────────────────────────────────────
const mapProject = (r: any): Project => ({
  id: r.id, clientId: r.client_id, name: r.name, description: r.description || "",
  itemLabel: r.item_label || "Deliverable", color: r.color || "indigo",
  status: r.status === "archived" ? "archived" : "active",
  milestones: Array.isArray(r.milestones) ? r.milestones : [],
  memberIds: Array.isArray(r.member_ids) ? r.member_ids : [],
  createdBy: r.created_by || undefined, createdAt: r.created_at,
});

const mapDeliverable = (r: any): Deliverable => ({
  id: r.id, projectId: r.project_id, clientId: r.client_id, title: r.title,
  contactName: r.contact_name || "", contactPhone: r.contact_phone || "",
  value: Number(r.value) || 0, ownerUserId: r.owner_user_id || "",
  milestoneId: r.milestone_id || "", status: r.status || "open",
  checklist: r.checklist || {}, approvals: r.approvals || {}, notes: r.notes || "",
  milestoneEnteredAt: r.milestone_entered_at, closedAt: r.closed_at || undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

const mapTarget = (r: any): Target => ({
  id: r.id, projectId: r.project_id, userId: r.user_id,
  periodStart: r.period_start, periodEnd: r.period_end,
  targetCount: r.target_count ?? null, targetValue: r.target_value == null ? null : Number(r.target_value),
});

const mapUpdate = (r: any): DailyUpdate => ({
  id: r.id, projectId: r.project_id, userId: r.user_id, userName: r.user_name || "",
  day: r.day, text: r.text, createdAt: r.created_at,
});

// ─── Projects ────────────────────────────────────────────────────────────────
export async function getProjects(clientId: string): Promise<Project[]> {
  const { data, error } = await supabase.from("projects").select("*")
    .eq("client_id", clientId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapProject);
}

export async function createProject(input: {
  clientId: string; name: string; description: string; itemLabel: string; color: string;
  milestones: Milestone[]; memberIds: string[]; createdBy: string;
}): Promise<Project> {
  const row = {
    id: newId("prj"), client_id: input.clientId, name: input.name, description: input.description,
    item_label: input.itemLabel || "Deliverable", color: input.color, milestones: input.milestones,
    member_ids: input.memberIds, created_by: input.createdBy,
  };
  const { data, error } = await supabase.from("projects").insert(row).select().single();
  if (error) throw error;
  return mapProject(data);
}

export async function updateProject(id: string, patch: Partial<Pick<Project,
  "name" | "description" | "itemLabel" | "color" | "status" | "milestones" | "memberIds">>): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.itemLabel !== undefined) row.item_label = patch.itemLabel;
  if (patch.color !== undefined) row.color = patch.color;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.milestones !== undefined) row.milestones = patch.milestones;
  if (patch.memberIds !== undefined) row.member_ids = patch.memberIds;
  const { error } = await supabase.from("projects").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

// ─── Deliverables ────────────────────────────────────────────────────────────
export async function getDeliverables(projectIds: string[]): Promise<Deliverable[]> {
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase.from("project_deliverables").select("*")
    .in("project_id", projectIds).order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapDeliverable);
}

async function logActivity(d: Pick<Deliverable, "id" | "projectId" | "clientId">, actor: Actor, kind: string, text?: string) {
  await supabase.from("project_activity").insert({
    id: newId("act"), deliverable_id: d.id, project_id: d.projectId, client_id: d.clientId,
    user_id: actor.id, user_name: actor.name, kind, text: text || null,
  });
}

export async function createDeliverable(project: Project, input: {
  title: string; contactName: string; contactPhone: string; value: number; ownerUserId: string; notes: string;
}, actor: Actor): Promise<Deliverable> {
  const row = {
    id: newId("dlv"), project_id: project.id, client_id: project.clientId, title: input.title,
    contact_name: input.contactName || null, contact_phone: input.contactPhone || null,
    value: input.value || 0, owner_user_id: input.ownerUserId, notes: input.notes || null,
    milestone_id: project.milestones[0]?.id || null, created_by: actor.id,
  };
  const { data, error } = await supabase.from("project_deliverables").insert(row).select().single();
  if (error) throw error;
  const d = mapDeliverable(data);
  await logActivity(d, actor, "created", `Created at “${project.milestones[0]?.name || "start"}”`);
  return d;
}

async function patchDeliverable(id: string, row: Record<string, unknown>): Promise<Deliverable> {
  const { data, error } = await supabase.from("project_deliverables")
    .update({ ...row, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) throw error;
  return mapDeliverable(data);
}

export async function updateDeliverableDetails(d: Deliverable, patch: {
  title?: string; contactName?: string; contactPhone?: string; value?: number; ownerUserId?: string; notes?: string;
}): Promise<Deliverable> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.contactName !== undefined) row.contact_name = patch.contactName;
  if (patch.contactPhone !== undefined) row.contact_phone = patch.contactPhone;
  if (patch.value !== undefined) row.value = patch.value;
  if (patch.ownerUserId !== undefined) row.owner_user_id = patch.ownerUserId;
  if (patch.notes !== undefined) row.notes = patch.notes;
  return patchDeliverable(d.id, row);
}

export async function setChecklistAnswer(d: Deliverable, milestoneId: string, itemId: string,
  answer: ChecklistAnswer): Promise<Deliverable> {
  const checklist = { ...d.checklist, [milestoneId]: { ...(d.checklist[milestoneId] || {}), [itemId]: answer } };
  return patchDeliverable(d.id, { checklist });
}

/** Required items of a milestone still missing for this deliverable. */
export function missingRequired(d: Deliverable, m: Milestone): MilestoneChecklistItem[] {
  const answers = d.checklist[m.id] || {};
  return m.checklist.filter(it => it.required && !answers[it.id]?.done);
}

export type AdvanceBlock = { kind: "checklist"; missing: MilestoneChecklistItem[] } | { kind: "approval"; state?: ApprovalState } | null;

/** Why this deliverable cannot leave its current milestone yet (null = free to advance). */
export function advanceBlock(d: Deliverable, project: Project): AdvanceBlock {
  const m = project.milestones.find(x => x.id === d.milestoneId);
  if (!m) return null;
  const missing = missingRequired(d, m);
  if (missing.length) return { kind: "checklist", missing };
  if (m.requiresApproval && d.approvals[m.id]?.status !== "approved") return { kind: "approval", state: d.approvals[m.id] };
  return null;
}

export async function requestApproval(d: Deliverable, project: Project, actor: Actor): Promise<Deliverable> {
  const m = project.milestones.find(x => x.id === d.milestoneId);
  if (!m) return d;
  const approvals = { ...d.approvals, [m.id]: { status: "pending" as const, requestedBy: actor.name, at: new Date().toISOString() } };
  const next = await patchDeliverable(d.id, { approvals });
  await logActivity(d, actor, "approval_requested", `Requested approval for “${m.name}”`);
  return next;
}

export async function decideApproval(d: Deliverable, project: Project, actor: Actor, approve: boolean, note: string): Promise<Deliverable> {
  const m = project.milestones.find(x => x.id === d.milestoneId);
  if (!m) return d;
  const prev = d.approvals[m.id] || {} as ApprovalState;
  const approvals = { ...d.approvals, [m.id]: { ...prev, status: approve ? "approved" as const : "rejected" as const, decidedBy: actor.name, at: new Date().toISOString(), note } };
  const next = await patchDeliverable(d.id, { approvals });
  await logActivity(d, actor, approve ? "approved" : "rejected", `${approve ? "Approved" : "Sent back"} “${m.name}”${note ? ` — ${note}` : ""}`);
  return next;
}

/** Move to the next milestone (or close as won from the last one). Enforces the gate. */
export async function advanceDeliverable(d: Deliverable, project: Project, actor: Actor): Promise<Deliverable> {
  const block = advanceBlock(d, project);
  if (block) throw new Error(block.kind === "checklist" ? "Complete the required checklist first." : "This milestone needs approval first.");
  const idx = project.milestones.findIndex(x => x.id === d.milestoneId);
  const cur = project.milestones[idx];
  const nextM = project.milestones[idx + 1];
  const now = new Date().toISOString();
  if (!nextM) {
    const next = await patchDeliverable(d.id, { status: "won", closed_at: now });
    await logActivity(d, actor, "won", `Completed “${cur?.name || "final milestone"}” — closed`);
    return next;
  }
  const next = await patchDeliverable(d.id, { milestone_id: nextM.id, milestone_entered_at: now });
  await logActivity(d, actor, "moved", `${cur?.name || "?"} → ${nextM.name}`);
  return next;
}

/** Managers can step a deliverable back one milestone (e.g. a deal fell back to negotiation). */
export async function moveBack(d: Deliverable, project: Project, actor: Actor): Promise<Deliverable> {
  const idx = project.milestones.findIndex(x => x.id === d.milestoneId);
  const prevM = project.milestones[idx - 1];
  if (!prevM) return d;
  const next = await patchDeliverable(d.id, { milestone_id: prevM.id, milestone_entered_at: new Date().toISOString() });
  await logActivity(d, actor, "moved", `${project.milestones[idx]?.name} → ${prevM.name} (moved back)`);
  return next;
}

export async function markLost(d: Deliverable, actor: Actor, reason: string): Promise<Deliverable> {
  const next = await patchDeliverable(d.id, { status: "lost", closed_at: new Date().toISOString() });
  await logActivity(d, actor, "lost", reason ? `Closed as lost — ${reason}` : "Closed as lost");
  return next;
}

export async function reopen(d: Deliverable, actor: Actor): Promise<Deliverable> {
  const next = await patchDeliverable(d.id, { status: "open", closed_at: null, milestone_entered_at: new Date().toISOString() });
  await logActivity(d, actor, "reopened", "Reopened");
  return next;
}

export async function deleteDeliverable(id: string): Promise<void> {
  const { error } = await supabase.from("project_deliverables").delete().eq("id", id);
  if (error) throw error;
}

export async function getActivity(deliverableId: string): Promise<ActivityEntry[]> {
  const { data, error } = await supabase.from("project_activity").select("*")
    .eq("deliverable_id", deliverableId).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data || []).map((r: any) => ({
    id: r.id, deliverableId: r.deliverable_id, userId: r.user_id, userName: r.user_name,
    kind: r.kind, text: r.text, createdAt: r.created_at,
  }));
}

export async function addComment(d: Deliverable, actor: Actor, text: string): Promise<void> {
  await logActivity(d, actor, "comment", text);
}

// ─── Evidence files ──────────────────────────────────────────────────────────
export async function uploadProjectFile(file: File, opts: { clientId: string; projectId: string }): Promise<string> {
  const isImage = file.type.startsWith("image/");
  const blob: Blob = isImage ? await compressImage(file, { maxDim: 1600, quality: 0.75 }) : file;
  const type = blob.type || file.type || "application/octet-stream";
  const ext = (file.name.split(".").pop() || type.split("/")[1] || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${opts.clientId}/${opts.projectId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("project-files").upload(path, blob, { upsert: false, contentType: type });
  if (error) throw error;
  return supabase.storage.from("project-files").getPublicUrl(path).data.publicUrl;
}

// ─── Targets ─────────────────────────────────────────────────────────────────
export function currentMonthPeriod(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: start.toLocaleDateString("en-CA"), end: end.toLocaleDateString("en-CA") };
}

export async function getTargets(projectIds: string[]): Promise<Target[]> {
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase.from("project_targets").select("*").in("project_id", projectIds);
  if (error) throw error;
  return (data || []).map(mapTarget);
}

export async function upsertTarget(project: Project, userId: string, period: { start: string; end: string },
  targetCount: number | null, targetValue: number | null): Promise<void> {
  const { error } = await supabase.from("project_targets").upsert({
    id: newId("tgt"), project_id: project.id, client_id: project.clientId, user_id: userId,
    period_start: period.start, period_end: period.end, target_count: targetCount, target_value: targetValue,
  }, { onConflict: "project_id,user_id,period_start" });
  if (error) throw error;
}

// ─── Daily updates ───────────────────────────────────────────────────────────
export async function getDailyUpdates(projectIds: string[], sinceDay: string): Promise<DailyUpdate[]> {
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase.from("project_daily_updates").select("*")
    .in("project_id", projectIds).gte("day", sinceDay).order("day", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapUpdate);
}

export async function saveDailyUpdate(project: Project, actor: Actor, text: string): Promise<void> {
  const { error } = await supabase.from("project_daily_updates").upsert({
    id: newId("upd"), project_id: project.id, client_id: project.clientId, user_id: actor.id,
    user_name: actor.name, day: todayStr(), text,
  }, { onConflict: "project_id,user_id,day" });
  if (error) throw error;
}

// ─── Score (300–900, CIBIL-style) ────────────────────────────────────────────
export interface ScoreLevel { level: 1 | 2 | 3 | 4; label: string; color: string }
export const SCORE_LEVELS: (ScoreLevel & { min: number })[] = [
  { level: 4, label: "Excellent", color: "#16a34a", min: 750 },
  { level: 3, label: "Good", color: "#65a30d", min: 650 },
  { level: 2, label: "Fair", color: "#f59e0b", min: 550 },
  { level: 1, label: "Needs attention", color: "#dc2626", min: 300 },
];
export const levelFor = (score: number): ScoreLevel => SCORE_LEVELS.find(l => score >= l.min) || SCORE_LEVELS[3];

export interface ScoreFactor { tone: "good" | "bad" | "info"; text: string }
export interface PerformanceScore {
  score: number;
  level: ScoreLevel;
  /** 0–1 components */
  attainment: number | null;
  consistency: number;
  freshness: number;
  /** Fraction of the target period already elapsed — "where you should be". */
  elapsed: number;
  wonCount: number;
  wonValue: number;
  openCount: number;
  stuckCount: number;
  targetCount: number | null;
  targetValue: number | null;
  /** Count / value credited so far, with partial credit for in-flight deliverables. */
  creditedCount: number;
  creditedValue: number;
  factors: ScoreFactor[];
}

const dayMs = 86400000;
const parseDay = (s: string) => new Date(`${s}T00:00:00`);

/** Working days (Mon–Sat) from start to min(end, today), inclusive. */
function workingDays(start: string, end: string): string[] {
  const out: string[] = [];
  const last = Math.min(parseDay(end).getTime(), parseDay(todayStr()).getTime());
  for (let t = parseDay(start).getTime(); t <= last; t += dayMs) {
    const d = new Date(t);
    if (d.getDay() !== 0) out.push(d.toLocaleDateString("en-CA"));
  }
  return out;
}

/** How far through the pipeline a deliverable is (won = 1, lost = 0). */
export function progressFraction(d: Deliverable, project: Project): number {
  if (d.status === "won") return 1;
  if (d.status === "lost") return 0;
  const n = project.milestones.length;
  const idx = project.milestones.findIndex(m => m.id === d.milestoneId);
  return n > 0 && idx >= 0 ? idx / n : 0;
}

export function daysInMilestone(d: Deliverable): number {
  return Math.floor((Date.now() - new Date(d.milestoneEnteredAt).getTime()) / dayMs);
}

export function isStuck(d: Deliverable, project: Project): boolean {
  if (d.status !== "open") return false;
  const m = project.milestones.find(x => x.id === d.milestoneId);
  return daysInMilestone(d) > (m?.slaDays ?? 7);
}

/**
 * The score = 300 + 600 × (60% target attainment + 20% daily-update consistency
 * + 20% freshness). Attainment gives partial credit to in-flight deliverables by
 * how far along they are; a deliverable counts toward the period if it was won
 * in the period or is still open. With no target set, attainment drops out and
 * the other two are re-weighted.
 */
export function computeScore(opts: {
  project: Project; userId: string; deliverables: Deliverable[]; updates: DailyUpdate[];
  target?: Target; period: { start: string; end: string };
}): PerformanceScore {
  const { project, userId, period, target } = opts;
  const pStart = parseDay(period.start).getTime();
  const pEnd = parseDay(period.end).getTime() + dayMs;
  const mine = opts.deliverables.filter(d => d.projectId === project.id && d.ownerUserId === userId);
  const inPeriod = mine.filter(d => d.status === "open"
    || (d.status === "won" && d.closedAt && new Date(d.closedAt).getTime() >= pStart && new Date(d.closedAt).getTime() < pEnd));
  const won = inPeriod.filter(d => d.status === "won");
  const open = inPeriod.filter(d => d.status === "open");
  const stuck = open.filter(d => isStuck(d, project));

  const creditedCount = inPeriod.reduce((s, d) => s + progressFraction(d, project), 0);
  const creditedValue = inPeriod.reduce((s, d) => s + d.value * progressFraction(d, project), 0);
  const tc = target?.targetCount || null;
  const tv = target?.targetValue || null;
  const parts: number[] = [];
  if (tc) parts.push(Math.min(1, creditedCount / tc));
  if (tv) parts.push(Math.min(1, creditedValue / tv));
  const attainment = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;

  const days = workingDays(period.start, period.end);
  const updatedDays = new Set(opts.updates.filter(u => u.projectId === project.id && u.userId === userId).map(u => u.day));
  const consistency = days.length ? days.filter(d => updatedDays.has(d)).length / days.length : 1;
  const freshness = open.length ? 1 - stuck.length / open.length : 1;

  const raw = attainment === null ? 0.5 * consistency + 0.5 * freshness : 0.6 * attainment + 0.2 * consistency + 0.2 * freshness;
  const score = Math.round(300 + 600 * raw);

  const total = pEnd - pStart;
  const elapsed = Math.max(0, Math.min(1, (Date.now() - pStart) / total));

  const factors: ScoreFactor[] = [];
  const label = project.itemLabel.toLowerCase();
  if (attainment === null) factors.push({ tone: "info", text: "No target set for this month yet — score is based on updates and freshness only." });
  else if (attainment + 0.05 >= elapsed) factors.push({ tone: "good", text: `On track — ${Math.round(attainment * 100)}% of target with ${Math.round(elapsed * 100)}% of the month gone.` });
  else factors.push({ tone: "bad", text: `Behind pace — ${Math.round(attainment * 100)}% of target with ${Math.round(elapsed * 100)}% of the month gone.` });
  if (stuck.length) factors.push({ tone: "bad", text: `${stuck.length} ${label}${stuck.length > 1 ? "s" : ""} stuck past the milestone time limit.` });
  else if (open.length) factors.push({ tone: "good", text: `All ${open.length} open ${label}${open.length > 1 ? "s are" : " is"} moving on time.` });
  const missed = days.length - days.filter(d => updatedDays.has(d)).length;
  if (days.length && missed > 0) factors.push({ tone: missed > 2 ? "bad" : "info", text: `Daily update missed on ${missed} of ${days.length} working day${days.length > 1 ? "s" : ""}.` });
  else if (days.length) factors.push({ tone: "good", text: "Daily update posted every working day." });
  if (won.length) factors.push({ tone: "good", text: `${won.length} closed this month${won.reduce((s, d) => s + d.value, 0) ? ` · ${formatINR(won.reduce((s, d) => s + d.value, 0))}` : ""}.` });

  return {
    score, level: levelFor(score), attainment, consistency, freshness, elapsed,
    wonCount: won.length, wonValue: won.reduce((s, d) => s + d.value, 0),
    openCount: open.length, stuckCount: stuck.length,
    targetCount: tc, targetValue: tv, creditedCount, creditedValue, factors,
  };
}

export function formatINR(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(n % 1e7 === 0 ? 0 : 2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(n % 1e5 === 0 ? 0 : 1)} L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
