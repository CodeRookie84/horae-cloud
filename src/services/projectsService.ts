/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * projectsService.ts — persistence + progress for the Projects module.
 *
 * Model: the client admin creates a project with ordered STEPS (stored as
 * `milestones`, each with a gating checklist + optional approval) and assigns
 * members. EVERY member works through ALL the steps on their own — one
 * `project_deliverables` row per (project, member) is that member's "run".
 * The admin (and the per-project managers they authorise) see every member's
 * run and approve steps; members see only their own.
 *
 * Tables (migrations 20260924210446_projects.sql + 20260925221341_projects_steps_per_member.sql),
 * all client-scoped:
 *   projects               — steps (+ checklists) as jsonb, member_ids, manager_ids
 *   project_deliverables   — one run per member: current step, checklist answers, approvals
 *   project_activity       — append-only history per run; step-scoped updates (+ file)
 *
 * Gating rule: a run can leave a step only when every REQUIRED checklist item of
 * that step is done and — if the step requires approval — a manager approved it.
 * Completing the LAST step marks the run complete (status 'won').
 */
import { supabase } from "./supabaseClient";
import { compressImage } from "../kot/lib/image";
import { Role, type User } from "../types";

// ─── Types ───────────────────────────────────────────────────────────────────
export type ChecklistItemType = "tick" | "number" | "amount" | "text" | "date" | "file";

export interface MilestoneChecklistItem {
  id: string;
  text: string;
  type: ChecklistItemType;
  required: boolean;
}

/** One step of a project (named "milestone" in the schema). */
export interface Milestone {
  id: string;
  name: string;
  /** Days a member may sit on this step before it counts as overdue. */
  slaDays: number;
  requiresApproval: boolean;
  checklist: MilestoneChecklistItem[];
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  description: string;
  color: string;
  status: "active" | "archived";
  milestones: Milestone[];
  memberIds: string[];
  /** Users the admin authorised to see everyone's progress and approve steps. */
  managerIds: string[];
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

/** One member's run through a project's steps. */
export interface Deliverable {
  id: string;
  projectId: string;
  clientId: string;
  title: string;
  ownerUserId: string;
  milestoneId: string;
  /** 'won' = every step completed. */
  status: "open" | "won" | "lost";
  checklist: Record<string, Record<string, ChecklistAnswer>>;
  approvals: Record<string, ApprovalState>;
  milestoneEnteredAt: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEntry {
  id: string;
  deliverableId: string;
  milestoneId?: string;
  userId?: string;
  userName?: string;
  kind: string;
  text?: string;
  fileUrl?: string;
  createdAt: string;
}

export interface Actor { id: string; name: string }

const newId = (p: string) => `${p}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

// ─── Permissions ─────────────────────────────────────────────────────────────
/** Only the client admin (and super admin) create and edit projects. */
export const isProjectAdmin = (u: Pick<User, "role">) => [Role.ADMIN, Role.SUPER_ADMIN].includes(u.role as Role);
/** Admin, or a manager this project's admin authorised: sees everyone + approves. */
export const canManageProject = (u: Pick<User, "id" | "role">, p: Project) => isProjectAdmin(u) || p.managerIds.includes(u.id);

// ─── Templates ───────────────────────────────────────────────────────────────
type TplMilestone = { name: string; slaDays?: number; approval?: boolean; items: [string, ChecklistItemType, boolean?][] };
export interface ProjectTemplate { id: string; name: string; blurb: string; milestones: TplMilestone[] }

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "outlet-opening", name: "New outlet opening",
    blurb: "Site, licences, interiors, hiring and launch.",
    milestones: [
      { name: "Site finalised", slaDays: 7, items: [["Site photos", "file"], ["Rent agreement signed", "file"]] },
      { name: "Licences", slaDays: 15, approval: true, items: [["FSSAI licence copy", "file"], ["Trade licence copy", "file"], ["Licence number", "text"]] },
      { name: "Interiors & equipment", slaDays: 21, items: [["Interior progress photo", "file"], ["Equipment installed", "tick"]] },
      { name: "Staff hired & trained", slaDays: 10, items: [["Staff count", "number"], ["Training completed", "tick"]] },
      { name: "Launch", slaDays: 3, approval: true, items: [["Launch date", "date"], ["Launch day photo", "file"]] },
    ],
  },
  {
    id: "onboarding", name: "Staff onboarding",
    blurb: "Documents, induction, training and sign-off for a new joiner.",
    milestones: [
      { name: "Documents", slaDays: 3, items: [["ID proof", "file"], ["Address proof", "file"], ["Bank details submitted", "tick"]] },
      { name: "Induction", slaDays: 3, items: [["Induction attended", "tick"], ["Uniform issued", "tick", false]] },
      { name: "On-the-job training", slaDays: 14, items: [["Trainer's feedback", "text"]] },
      { name: "Sign-off", slaDays: 3, approval: true, items: [["Final assessment score", "number"]] },
    ],
  },
  {
    id: "campaign", name: "Marketing campaign",
    blurb: "Plan, create, publish and report on a campaign.",
    milestones: [
      { name: "Plan", slaDays: 3, items: [["Campaign brief", "text"], ["Budget (₹)", "amount"]] },
      { name: "Creatives", slaDays: 5, approval: true, items: [["Creative files", "file"]] },
      { name: "Published", slaDays: 3, items: [["Go-live date", "date"], ["Screenshot / link", "file"]] },
      { name: "Report", slaDays: 7, items: [["Leads / sales generated", "number"], ["Report", "file", false]] },
    ],
  },
  { id: "blank", name: "Blank", blurb: "Start with three simple steps and build your own.",
    milestones: [
      { name: "Step 1", items: [] }, { name: "Step 2", items: [] }, { name: "Step 3", items: [] },
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

export const newMilestone = (name = "New step"): Milestone =>
  ({ id: newId("ms"), name, slaDays: 7, requiresApproval: false, checklist: [] });
export const newChecklistItem = (): MilestoneChecklistItem =>
  ({ id: newId("ci"), text: "", type: "tick", required: true });

// ─── Mappers ─────────────────────────────────────────────────────────────────
const mapProject = (r: any): Project => ({
  id: r.id, clientId: r.client_id, name: r.name, description: r.description || "",
  color: r.color || "indigo",
  status: r.status === "archived" ? "archived" : "active",
  milestones: Array.isArray(r.milestones) ? r.milestones : [],
  memberIds: Array.isArray(r.member_ids) ? r.member_ids : [],
  managerIds: Array.isArray(r.manager_ids) ? r.manager_ids : [],
  createdBy: r.created_by || undefined, createdAt: r.created_at,
});

const mapDeliverable = (r: any): Deliverable => ({
  id: r.id, projectId: r.project_id, clientId: r.client_id, title: r.title,
  ownerUserId: r.owner_user_id || "",
  milestoneId: r.milestone_id || "", status: r.status || "open",
  checklist: r.checklist || {}, approvals: r.approvals || {},
  milestoneEnteredAt: r.milestone_entered_at, closedAt: r.closed_at || undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

// ─── Projects ────────────────────────────────────────────────────────────────
export async function getProjects(clientId: string): Promise<Project[]> {
  const { data, error } = await supabase.from("projects").select("*")
    .eq("client_id", clientId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapProject);
}

export async function createProject(input: {
  clientId: string; name: string; description: string; color: string;
  milestones: Milestone[]; memberIds: string[]; managerIds: string[]; createdBy: string;
}): Promise<Project> {
  const row = {
    id: newId("prj"), client_id: input.clientId, name: input.name, description: input.description,
    color: input.color, milestones: input.milestones,
    member_ids: input.memberIds, manager_ids: input.managerIds, created_by: input.createdBy,
  };
  const { data, error } = await supabase.from("projects").insert(row).select().single();
  if (error) throw error;
  return mapProject(data);
}

export async function updateProject(id: string, patch: Partial<Pick<Project,
  "name" | "description" | "color" | "status" | "milestones" | "memberIds" | "managerIds">>): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.color !== undefined) row.color = patch.color;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.milestones !== undefined) row.milestones = patch.milestones;
  if (patch.memberIds !== undefined) row.member_ids = patch.memberIds;
  if (patch.managerIds !== undefined) row.manager_ids = patch.managerIds;
  const { error } = await supabase.from("projects").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

// ─── Member runs ─────────────────────────────────────────────────────────────
export async function getDeliverables(projectIds: string[]): Promise<Deliverable[]> {
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase.from("project_deliverables").select("*")
    .in("project_id", projectIds).order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(mapDeliverable);
}

/** The member's run for a project (undefined until ensureMemberRuns creates it). */
export const runFor = (runs: Deliverable[], projectId: string, userId: string) =>
  runs.find(d => d.projectId === projectId && d.ownerUserId === userId);

async function logActivity(d: Pick<Deliverable, "id" | "projectId" | "clientId">, actor: Actor, kind: string,
  text?: string, extra: { milestoneId?: string; fileUrl?: string } = {}) {
  await supabase.from("project_activity").insert({
    id: newId("act"), deliverable_id: d.id, project_id: d.projectId, client_id: d.clientId,
    user_id: actor.id, user_name: actor.name, kind, text: text || null,
    milestone_id: extra.milestoneId || null, file_url: extra.fileUrl || null,
  });
}

/**
 * Create the missing run for every member of `projects` (a member added later, or
 * a project created before runs existed). Only creates runs the caller may write:
 * all members' when `all`, otherwise just `self`'s. Returns the newly created runs.
 */
export async function ensureMemberRuns(projects: Project[], runs: Deliverable[], users: User[],
  opts: { all: (p: Project) => boolean; self: string }): Promise<Deliverable[]> {
  const rows: Record<string, unknown>[] = [];
  for (const p of projects) {
    if (p.status !== "active" || !p.milestones.length) continue;
    const ids = opts.all(p) ? p.memberIds : p.memberIds.filter(id => id === opts.self);
    for (const uid of ids) {
      if (runFor(runs, p.id, uid)) continue;
      rows.push({
        id: newId("run"), project_id: p.id, client_id: p.clientId,
        title: users.find(u => u.id === uid)?.name || "Member", owner_user_id: uid,
        milestone_id: p.milestones[0].id, created_by: opts.self,
      });
    }
  }
  if (!rows.length) return [];
  // ignoreDuplicates: two devices creating the same run at once is harmless —
  // the unique (project_id, owner_user_id) index keeps exactly one.
  const { data, error } = await supabase.from("project_deliverables")
    .upsert(rows, { onConflict: "project_id,owner_user_id", ignoreDuplicates: true }).select();
  if (error) throw error;
  return (data || []).map(mapDeliverable);
}

async function patchDeliverable(id: string, row: Record<string, unknown>): Promise<Deliverable> {
  const { data, error } = await supabase.from("project_deliverables")
    .update({ ...row, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) throw error;
  return mapDeliverable(data);
}

export async function setChecklistAnswer(d: Deliverable, milestoneId: string, itemId: string,
  answer: ChecklistAnswer): Promise<Deliverable> {
  const checklist = { ...d.checklist, [milestoneId]: { ...(d.checklist[milestoneId] || {}), [itemId]: answer } };
  return patchDeliverable(d.id, { checklist });
}

/** Required items of a step still missing for this run. */
export function missingRequired(d: Deliverable, m: Milestone): MilestoneChecklistItem[] {
  const answers = d.checklist[m.id] || {};
  return m.checklist.filter(it => it.required && !answers[it.id]?.done);
}

export type AdvanceBlock = { kind: "checklist"; missing: MilestoneChecklistItem[] } | { kind: "approval"; state?: ApprovalState } | null;

/** Why this run cannot complete its current step yet (null = free to complete). */
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
  await logActivity(d, actor, "approval_requested", `Requested approval for “${m.name}”`, { milestoneId: m.id });
  return next;
}

export async function decideApproval(d: Deliverable, project: Project, actor: Actor, approve: boolean, note: string): Promise<Deliverable> {
  const m = project.milestones.find(x => x.id === d.milestoneId);
  if (!m) return d;
  const prev = d.approvals[m.id] || {} as ApprovalState;
  const approvals = { ...d.approvals, [m.id]: { ...prev, status: approve ? "approved" as const : "rejected" as const, decidedBy: actor.name, at: new Date().toISOString(), note } };
  const next = await patchDeliverable(d.id, { approvals });
  await logActivity(d, actor, approve ? "approved" : "rejected", `${approve ? "Approved" : "Sent back"} “${m.name}”${note ? ` — ${note}` : ""}`, { milestoneId: m.id });
  return next;
}

/** Complete the current step and move on (or finish the project from the last step). Enforces the gate. */
export async function advanceDeliverable(d: Deliverable, project: Project, actor: Actor): Promise<Deliverable> {
  const block = advanceBlock(d, project);
  if (block) throw new Error(block.kind === "checklist" ? "Complete the required items first." : "This step needs approval first.");
  const idx = project.milestones.findIndex(x => x.id === d.milestoneId);
  const cur = project.milestones[idx];
  const nextM = project.milestones[idx + 1];
  const now = new Date().toISOString();
  if (!nextM) {
    const next = await patchDeliverable(d.id, { status: "won", closed_at: now });
    await logActivity(d, actor, "won", `Completed “${cur?.name || "final step"}” — all steps done`, { milestoneId: cur?.id });
    return next;
  }
  const next = await patchDeliverable(d.id, { milestone_id: nextM.id, milestone_entered_at: now });
  await logActivity(d, actor, "moved", `Completed “${cur?.name || "?"}” → now on “${nextM.name}”`, { milestoneId: cur?.id });
  return next;
}

/** Managers can send a run back one step (or reopen a completed one at its last step). */
export async function moveBack(d: Deliverable, project: Project, actor: Actor): Promise<Deliverable> {
  const now = new Date().toISOString();
  if (d.status !== "open") {
    const next = await patchDeliverable(d.id, { status: "open", closed_at: null, milestone_entered_at: now });
    await logActivity(d, actor, "reopened", "Reopened", { milestoneId: d.milestoneId });
    return next;
  }
  const idx = project.milestones.findIndex(x => x.id === d.milestoneId);
  const prevM = project.milestones[idx - 1];
  if (!prevM) return d;
  const next = await patchDeliverable(d.id, { milestone_id: prevM.id, milestone_entered_at: now });
  await logActivity(d, actor, "sent_back", `Sent back to “${prevM.name}”`, { milestoneId: prevM.id });
  return next;
}

export async function getActivity(deliverableId: string): Promise<ActivityEntry[]> {
  const { data, error } = await supabase.from("project_activity").select("*")
    .eq("deliverable_id", deliverableId).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return (data || []).map((r: any) => ({
    id: r.id, deliverableId: r.deliverable_id, milestoneId: r.milestone_id || undefined,
    userId: r.user_id, userName: r.user_name, kind: r.kind, text: r.text || undefined,
    fileUrl: r.file_url || undefined, createdAt: r.created_at,
  }));
}

/** A free-form update on a step, optionally with a photo/file. */
export async function addStepUpdate(d: Deliverable, milestoneId: string, actor: Actor, text: string, fileUrl?: string): Promise<void> {
  await logActivity(d, actor, "comment", text, { milestoneId, fileUrl });
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

// ─── Progress (0–100) ────────────────────────────────────────────────────────
const dayMs = 86400000;

/**
 * 0–100 progress through the steps. Each step is an equal share; the current
 * step earns partial credit for its checklist items done (capped just short of
 * the step boundary — only completing the step crosses it). Complete = 100.
 */
export function stepProgress(d: Deliverable | undefined, project: Project): number {
  const n = project.milestones.length;
  if (!d || n === 0) return 0;
  if (d.status === "won") return 100;
  const idx = Math.max(0, project.milestones.findIndex(m => m.id === d.milestoneId));
  const m = project.milestones[idx];
  const items = m?.checklist.length || 0;
  const done = items ? m.checklist.filter(it => d.checklist[m.id]?.[it.id]?.done).length : 0;
  const partial = items ? Math.min(0.9, done / items) : 0;
  return Math.round(((idx + partial) / n) * 100);
}

/** Index of the run's current step (steps.length when complete). */
export function currentStepIndex(d: Deliverable | undefined, project: Project): number {
  if (!d) return 0;
  if (d.status === "won") return project.milestones.length;
  return Math.max(0, project.milestones.findIndex(m => m.id === d.milestoneId));
}

export function daysInMilestone(d: Deliverable): number {
  return Math.floor((Date.now() - new Date(d.milestoneEnteredAt).getTime()) / dayMs);
}

/** On the current step longer than its time limit. */
export function isOverdue(d: Deliverable, project: Project): boolean {
  if (d.status !== "open") return false;
  const m = project.milestones.find(x => x.id === d.milestoneId);
  return daysInMilestone(d) > (m?.slaDays ?? 7);
}

/** Red (0) → amber → green (100) for a 0–100 value. */
export const progressColor = (pct: number) => `hsl(${Math.round(Math.max(0, Math.min(100, pct)) * 1.2)} 72% 42%)`;

export function formatINR(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(n % 1e7 === 0 ? 0 : 2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(n % 1e5 === 0 ? 0 : 1)} L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
