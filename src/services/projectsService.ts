/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * projectsService.ts — persistence + progress for the Projects module.
 *
 * Model: the client admin creates a project with ordered STEPS (stored as
 * `milestones`, each with a gating checklist + optional approval) and assigns
 * members. A project is one of two kinds:
 *   • checklist — EVERY member works through ALL the steps once: one
 *                 `project_deliverables` row per (project, member) is that
 *                 member's "run" (run_key = member id).
 *   • pipeline  — members add MANY items (leads, orders, candidates…, named by
 *                 `item_label`), each moving through the steps and ending Won
 *                 (last step completed) or Lost (with a reason). run_key NULL.
 * The admin (and the per-project managers they authorise) see every member's
 * runs/items and approve steps; members see only their own.
 *
 * Tables (migrations 20260924210446_projects.sql, 20260925221341_projects_steps_per_member.sql,
 * 20260926215120_projects_pipeline_type.sql),
 * all client-scoped:
 *   projects               — steps (+ checklists) as jsonb, member_ids, manager_ids
 *   project_deliverables   — checklist runs / pipeline items: current step, checklist answers, approvals
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

export type ProjectKind = "checklist" | "pipeline";

export interface Project {
  id: string;
  clientId: string;
  name: string;
  description: string;
  kind: ProjectKind;
  /** What a pipeline calls its items: "Lead", "Order", "Candidate"… */
  itemLabel: string;
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

/** A checklist member's run, or one pipeline item (lead / order / …). */
export interface Deliverable {
  id: string;
  projectId: string;
  clientId: string;
  title: string;
  ownerUserId: string;
  milestoneId: string;
  /** 'won' = every step completed; 'lost' = pipeline item closed with a reason. */
  status: "open" | "won" | "lost";
  contactName: string;
  contactPhone: string;
  value: number;
  source: string;
  notes: string;
  followUpAt?: string;
  lostReason?: string;
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
export interface ProjectTemplate {
  id: string; name: string; blurb: string; kind: ProjectKind;
  /** Pipeline item name. */
  itemLabel?: string;
  milestones: TplMilestone[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  // ── Pipelines: each member adds many items that move through the steps ──
  {
    id: "sales", name: "Sales pipeline", kind: "pipeline", itemLabel: "Deal",
    blurb: "Qualify, meet, propose, negotiate and close deals.",
    milestones: [
      { name: "Qualified", slaDays: 2, items: [["Need & budget confirmed", "tick"], ["Deal value (₹)", "amount", false]] },
      { name: "Contact made", slaDays: 3, items: [["First call / visit done", "tick"], ["Decision maker identified", "text", false]] },
      { name: "Meeting / demo", slaDays: 7, items: [["Meeting date", "date"], ["Meeting notes", "text", false]] },
      { name: "Proposal sent", slaDays: 5, items: [["Proposal / quotation", "file"]] },
      { name: "Negotiation", slaDays: 10, approval: true, items: [["Final price (₹)", "amount"], ["Terms agreed", "tick"]] },
      { name: "Closed", slaDays: 7, items: [["PO / signed confirmation", "file"], ["Advance received", "tick", false]] },
    ],
  },
  {
    id: "real-estate", name: "Real estate sales", kind: "pipeline", itemLabel: "Lead",
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
    id: "marketing", name: "Marketing / lead generation", kind: "pipeline", itemLabel: "Lead",
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
    id: "bulk-orders", name: "Bulk / catering orders", kind: "pipeline", itemLabel: "Order",
    blurb: "Enquiry, quote, advance, production, delivery and final payment.",
    milestones: [
      { name: "Enquiry", slaDays: 1, items: [["Event / delivery date", "date"], ["Quantity & items noted", "text"]] },
      { name: "Quote sent", slaDays: 2, items: [["Quotation", "file"], ["Quoted amount (₹)", "amount"]] },
      { name: "Advance received", slaDays: 3, approval: true, items: [["Advance amount (₹)", "amount"], ["Payment proof", "file"]] },
      { name: "In production", slaDays: 5, items: [["Order sheet shared with kitchen", "tick"], ["Packing photo", "file", false]] },
      { name: "Delivered", slaDays: 1, items: [["Delivery photo / signed challan", "file"]] },
      { name: "Fully paid", slaDays: 7, items: [["Balance received", "tick"], ["Invoice number", "text"]] },
    ],
  },
  {
    id: "hiring", name: "Hiring", kind: "pipeline", itemLabel: "Candidate",
    blurb: "Applications through screening, interview, offer and joining.",
    milestones: [
      { name: "Applied", slaDays: 2, items: [["CV / profile", "file", false], ["Position", "text"]] },
      { name: "Screening", slaDays: 3, items: [["Phone screen done", "tick"], ["Expected salary (₹)", "amount", false]] },
      { name: "Interview", slaDays: 7, items: [["Interview date", "date"], ["Interview feedback", "text"]] },
      { name: "Offer", slaDays: 5, approval: true, items: [["Offered salary (₹)", "amount"], ["Offer letter", "file"]] },
      { name: "Joined", slaDays: 14, items: [["Joining date", "date"], ["Documents collected", "tick"]] },
    ],
  },
  {
    id: "complaints", name: "Complaints / support", kind: "pipeline", itemLabel: "Ticket",
    blurb: "Log, assign, resolve and close customer complaints.",
    milestones: [
      { name: "New", slaDays: 1, items: [["Complaint details", "text"], ["Photo / proof", "file", false]] },
      { name: "In progress", slaDays: 2, items: [["Customer contacted", "tick"], ["Root cause", "text", false]] },
      { name: "Resolved", slaDays: 2, approval: true, items: [["Resolution given", "text"], ["Refund / replacement (₹)", "amount", false]] },
      { name: "Closed", slaDays: 3, items: [["Customer confirmed satisfied", "tick"]] },
    ],
  },
  {
    id: "content", name: "Content calendar", kind: "pipeline", itemLabel: "Post",
    blurb: "Ideas to draft, review, scheduling and publishing.",
    milestones: [
      { name: "Idea", slaDays: 3, items: [["Topic / brief", "text"]] },
      { name: "Draft", slaDays: 3, items: [["Draft / creative", "file"]] },
      { name: "Review", slaDays: 2, approval: true, items: [["Caption final", "text"]] },
      { name: "Scheduled", slaDays: 5, items: [["Publish date", "date"]] },
      { name: "Published", slaDays: 2, items: [["Post link / screenshot", "file"]] },
    ],
  },
  {
    id: "agency", name: "Agency deliverables", kind: "pipeline", itemLabel: "Deliverable",
    blurb: "Brief to draft, client review, delivery and billing.",
    milestones: [
      { name: "Brief received", slaDays: 2, items: [["Brief document", "file", false], ["Deadline agreed", "date"]] },
      { name: "In progress", slaDays: 5, items: [["Draft shared internally", "tick"]] },
      { name: "Client review", slaDays: 5, items: [["Sent to client", "tick"], ["Feedback noted", "text", false]] },
      { name: "Delivered", slaDays: 3, approval: true, items: [["Final files", "file"]] },
      { name: "Billed", slaDays: 7, items: [["Invoice number", "text"]] },
    ],
  },
  { id: "blank-pipeline", name: "Blank pipeline", kind: "pipeline", itemLabel: "Item",
    blurb: "Three simple stages — build your own pipeline.",
    milestones: [{ name: "New", items: [] }, { name: "In progress", items: [] }, { name: "Done", items: [] }],
  },

  // ── Checklists: every member works through all the steps once ──
  {
    id: "outlet-opening", name: "New outlet opening", kind: "checklist",
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
    id: "onboarding", name: "Staff onboarding", kind: "checklist",
    blurb: "Documents, induction, training and sign-off for a new joiner.",
    milestones: [
      { name: "Documents", slaDays: 3, items: [["ID proof", "file"], ["Address proof", "file"], ["Bank details submitted", "tick"]] },
      { name: "Induction", slaDays: 3, items: [["Induction attended", "tick"], ["Uniform issued", "tick", false]] },
      { name: "On-the-job training", slaDays: 14, items: [["Trainer's feedback", "text"]] },
      { name: "Sign-off", slaDays: 3, approval: true, items: [["Final assessment score", "number"]] },
    ],
  },
  {
    id: "campaign", name: "Marketing campaign", kind: "checklist",
    blurb: "Plan, create, publish and report on a campaign.",
    milestones: [
      { name: "Plan", slaDays: 3, items: [["Campaign brief", "text"], ["Budget (₹)", "amount"]] },
      { name: "Creatives", slaDays: 5, approval: true, items: [["Creative files", "file"]] },
      { name: "Published", slaDays: 3, items: [["Go-live date", "date"], ["Screenshot / link", "file"]] },
      { name: "Report", slaDays: 7, items: [["Leads / sales generated", "number"], ["Report", "file", false]] },
    ],
  },
  {
    id: "event-launch", name: "Event / product launch", kind: "checklist",
    blurb: "Plan, line up vendors, promote, run the day and review.",
    milestones: [
      { name: "Plan", slaDays: 5, items: [["Event date", "date"], ["Budget (₹)", "amount"], ["Plan document", "file", false]] },
      { name: "Vendors booked", slaDays: 7, approval: true, items: [["Vendor quotes", "file"], ["Venue confirmed", "tick"]] },
      { name: "Promotion", slaDays: 7, items: [["Invites / posts sent", "tick"], ["Creative", "file", false]] },
      { name: "Event day", slaDays: 2, items: [["Event photos", "file"], ["Attendance / footfall", "number"]] },
      { name: "Review", slaDays: 5, items: [["What went well / to improve", "text"], ["Final spend (₹)", "amount"]] },
    ],
  },
  {
    id: "audit-rollout", name: "Audit / compliance rollout", kind: "checklist",
    blurb: "Each member (or outlet) completes the same compliance steps.",
    milestones: [
      { name: "Self-assessment", slaDays: 3, items: [["Current checklist filled", "file"], ["Gaps found", "text"]] },
      { name: "Fixes done", slaDays: 10, items: [["Before / after photos", "file"], ["All gaps closed", "tick"]] },
      { name: "Records updated", slaDays: 5, items: [["Registers / logs up to date", "tick"], ["Certificates copy", "file", false]] },
      { name: "Audit sign-off", slaDays: 3, approval: true, items: [["Audit score", "number"], ["Auditor remarks", "text", false]] },
    ],
  },
  { id: "blank", name: "Blank checklist", kind: "checklist", blurb: "Three simple steps — build your own.",
    milestones: [
      { name: "Step 1", items: [] }, { name: "Step 2", items: [] }, { name: "Step 3", items: [] },
    ],
  },
];

/** Quick-pick reasons when a pipeline item is marked Lost. */
export const LOST_REASONS = ["Too expensive", "Not interested", "Went with a competitor", "No response", "Budget / timing", "Duplicate"];

export function milestonesFromTemplate(tpl: ProjectTemplate): Milestone[] {
  return tpl.milestones.map(m => ({
    id: newId("ms"),
    name: m.name,
    slaDays: m.slaDays ?? 7,
    requiresApproval: !!m.approval,
    checklist: m.items.map(([text, type, required]) => ({ id: newId("ci"), text, type, required: required !== false })),
  }));
}

// ─── Per-client templates ────────────────────────────────────────────────────
/** Blank templates are always offered — they're "build your own", not content. */
export const ALWAYS_AVAILABLE_TEMPLATES = ["blank-pipeline", "blank"];

/** A template the New-project dialog can offer: a built-in or the client's own. */
export interface TemplateOption {
  id: string; name: string; blurb: string; kind: ProjectKind; itemLabel?: string;
  /** true = the client's own saved template (can be deleted). */
  custom: boolean;
  /** A fresh copy of the steps with new ids — the template itself never changes. */
  build: () => Milestone[];
}

export interface SavedTemplate {
  id: string; clientId: string; name: string; blurb: string; kind: ProjectKind;
  itemLabel: string; milestones: Milestone[]; basedOn?: string; createdAt: string;
}

const mapSavedTemplate = (r: any): SavedTemplate => ({
  id: r.id, clientId: r.client_id, name: r.name, blurb: r.blurb || "",
  kind: r.kind === "pipeline" ? "pipeline" : "checklist", itemLabel: r.item_label || "Item",
  milestones: Array.isArray(r.milestones) ? r.milestones : [], basedOn: r.based_on || undefined,
  createdAt: r.created_at,
});

/** Re-key a saved step list so a new project never shares step/item ids with its template. */
const cloneMilestones = (ms: Milestone[]): Milestone[] =>
  ms.map(m => ({ ...m, id: newId("ms"), checklist: m.checklist.map(it => ({ ...it, id: newId("ci") })) }));

/**
 * Built-in template ids the super admin enabled for a client, or null when the
 * client has no access row yet (legacy client → every built-in template).
 */
export async function getTemplateAccess(clientId: string): Promise<string[] | null> {
  const { data, error } = await supabase.from("project_template_access").select("template_ids")
    .eq("client_id", clientId).maybeSingle();
  if (error) throw error;
  return data && Array.isArray(data.template_ids) ? data.template_ids : null;
}

export async function setTemplateAccess(clientId: string, templateIds: string[]): Promise<void> {
  const { error } = await supabase.from("project_template_access")
    .upsert({ client_id: clientId, template_ids: templateIds, updated_at: new Date().toISOString() }, { onConflict: "client_id" });
  if (error) throw error;
}

export async function getSavedTemplates(clientId: string): Promise<SavedTemplate[]> {
  const { data, error } = await supabase.from("project_templates").select("*")
    .eq("client_id", clientId).order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(mapSavedTemplate);
}

export async function saveTemplate(input: {
  clientId: string; name: string; blurb: string; kind: ProjectKind; itemLabel: string;
  milestones: Milestone[]; basedOn?: string; createdBy: string;
}): Promise<SavedTemplate> {
  const { data, error } = await supabase.from("project_templates").insert({
    id: newId("tpl"), client_id: input.clientId, name: input.name, blurb: input.blurb || null,
    kind: input.kind, item_label: input.itemLabel || "Item", milestones: input.milestones,
    based_on: input.basedOn || null, created_by: input.createdBy,
  }).select().single();
  if (error) throw error;
  return mapSavedTemplate(data);
}

export async function deleteSavedTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("project_templates").delete().eq("id", id);
  if (error) throw error;
}

/** What the New-project dialog offers: enabled built-ins, then the client's own. */
export function templateOptions(access: string[] | null, saved: SavedTemplate[]): TemplateOption[] {
  const builtIn = PROJECT_TEMPLATES
    .filter(t => access === null || access.includes(t.id) || ALWAYS_AVAILABLE_TEMPLATES.includes(t.id))
    .map<TemplateOption>(t => ({ id: t.id, name: t.name, blurb: t.blurb, kind: t.kind, itemLabel: t.itemLabel, custom: false, build: () => milestonesFromTemplate(t) }));
  const own = saved.map<TemplateOption>(t => ({
    id: t.id, name: t.name, blurb: t.blurb || `${t.milestones.length} steps · saved template`, kind: t.kind,
    itemLabel: t.itemLabel, custom: true, build: () => cloneMilestones(t.milestones),
  }));
  return [...builtIn, ...own];
}

export const newMilestone = (name = "New step"): Milestone =>
  ({ id: newId("ms"), name, slaDays: 7, requiresApproval: false, checklist: [] });
export const newChecklistItem = (): MilestoneChecklistItem =>
  ({ id: newId("ci"), text: "", type: "tick", required: true });

// ─── Mappers ─────────────────────────────────────────────────────────────────
const mapProject = (r: any): Project => ({
  id: r.id, clientId: r.client_id, name: r.name, description: r.description || "",
  kind: r.kind === "pipeline" ? "pipeline" : "checklist", itemLabel: r.item_label || "Item",
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
  contactName: r.contact_name || "", contactPhone: r.contact_phone || "",
  value: Number(r.value) || 0, source: r.source || "", notes: r.notes || "",
  followUpAt: r.follow_up_at || undefined, lostReason: r.lost_reason || undefined,
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
  clientId: string; name: string; description: string; color: string; kind: ProjectKind; itemLabel: string;
  milestones: Milestone[]; memberIds: string[]; managerIds: string[]; createdBy: string;
}): Promise<Project> {
  const row = {
    id: newId("prj"), client_id: input.clientId, name: input.name, description: input.description,
    kind: input.kind, item_label: input.itemLabel || "Item",
    color: input.color, milestones: input.milestones,
    member_ids: input.memberIds, manager_ids: input.managerIds, created_by: input.createdBy,
  };
  const { data, error } = await supabase.from("projects").insert(row).select().single();
  if (error) throw error;
  return mapProject(data);
}

export async function updateProject(id: string, patch: Partial<Pick<Project,
  "name" | "description" | "itemLabel" | "color" | "status" | "milestones" | "memberIds" | "managerIds">>): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.itemLabel !== undefined) row.item_label = patch.itemLabel;
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

/**
 * Take a member off a project. A checklist member's run (their progress and its
 * history) is deleted; a pipeline member's items are kept so the team's leads
 * aren't lost — managers still see them.
 */
export async function removeMember(project: Project, userId: string): Promise<void> {
  await updateProject(project.id, { memberIds: project.memberIds.filter(id => id !== userId) });
  if (project.kind === "checklist") {
    const { error } = await supabase.from("project_deliverables").delete()
      .eq("project_id", project.id).eq("run_key", userId);
    if (error) throw error;
  }
}

// ─── Member runs ─────────────────────────────────────────────────────────────
export async function getDeliverables(projectIds: string[]): Promise<Deliverable[]> {
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase.from("project_deliverables").select("*")
    .in("project_id", projectIds).order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(mapDeliverable);
}

/** The member's run for a checklist project (undefined until ensureMemberRuns creates it). */
export const runFor = (runs: Deliverable[], projectId: string, userId: string) =>
  runs.find(d => d.projectId === projectId && d.ownerUserId === userId);

/** A pipeline project's items, optionally only one member's. */
export const itemsOf = (runs: Deliverable[], projectId: string, ownerId?: string) =>
  runs.filter(d => d.projectId === projectId && (!ownerId || d.ownerUserId === ownerId));

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
    if (p.kind !== "checklist" || p.status !== "active" || !p.milestones.length) continue;
    const ids = opts.all(p) ? p.memberIds : p.memberIds.filter(id => id === opts.self);
    for (const uid of ids) {
      if (runFor(runs, p.id, uid)) continue;
      rows.push({
        id: newId("run"), project_id: p.id, client_id: p.clientId,
        title: users.find(u => u.id === uid)?.name || "Member", owner_user_id: uid, run_key: uid,
        milestone_id: p.milestones[0].id, created_by: opts.self,
      });
    }
  }
  if (!rows.length) return [];
  // ignoreDuplicates: two devices creating the same run at once is harmless —
  // the unique (project_id, run_key) index keeps exactly one.
  const { data, error } = await supabase.from("project_deliverables")
    .upsert(rows, { onConflict: "project_id,run_key", ignoreDuplicates: true }).select();
  if (error) throw error;
  return (data || []).map(mapDeliverable);
}

async function patchDeliverable(id: string, row: Record<string, unknown>): Promise<Deliverable> {
  const { data, error } = await supabase.from("project_deliverables")
    .update({ ...row, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) throw error;
  return mapDeliverable(data);
}

// ─── Pipeline items ──────────────────────────────────────────────────────────
export interface ItemFields {
  title: string; contactName: string; contactPhone: string; value: number;
  source: string; notes: string; followUpAt?: string;
}

const itemRow = (f: Partial<ItemFields>) => {
  const row: Record<string, unknown> = {};
  if (f.title !== undefined) row.title = f.title;
  if (f.contactName !== undefined) row.contact_name = f.contactName || null;
  if (f.contactPhone !== undefined) row.contact_phone = f.contactPhone || null;
  if (f.value !== undefined) row.value = f.value || 0;
  if (f.source !== undefined) row.source = f.source || null;
  if (f.notes !== undefined) row.notes = f.notes || null;
  if (f.followUpAt !== undefined) row.follow_up_at = f.followUpAt || null;
  return row;
};

export async function createItem(project: Project, ownerId: string, f: ItemFields, actor: Actor): Promise<Deliverable> {
  const { data, error } = await supabase.from("project_deliverables").insert({
    id: newId("itm"), project_id: project.id, client_id: project.clientId,
    owner_user_id: ownerId, milestone_id: project.milestones[0]?.id || null, created_by: actor.id,
    ...itemRow(f),
  }).select().single();
  if (error) throw error;
  const d = mapDeliverable(data);
  await logActivity(d, actor, "created", `Added ${project.itemLabel.toLowerCase()} “${f.title}”`, { milestoneId: d.milestoneId });
  return d;
}

export async function updateItem(d: Deliverable, f: Partial<ItemFields> & { ownerUserId?: string }): Promise<Deliverable> {
  const row = itemRow(f);
  if (f.ownerUserId !== undefined) row.owner_user_id = f.ownerUserId;
  return patchDeliverable(d.id, row);
}

export async function markLost(d: Deliverable, reason: string, actor: Actor): Promise<Deliverable> {
  const next = await patchDeliverable(d.id, { status: "lost", lost_reason: reason || null, closed_at: new Date().toISOString() });
  await logActivity(d, actor, "lost", `Marked lost${reason ? ` — ${reason}` : ""}`, { milestoneId: d.milestoneId });
  return next;
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from("project_deliverables").delete().eq("id", id);
  if (error) throw error;
}

const phoneKey = (p: string) => p.replace(/\D/g, "").slice(-10);

/** Another item in this project with the same phone number (last 10 digits). */
export function findDuplicatePhone(runs: Deliverable[], projectId: string, phone: string, exceptId?: string): Deliverable | undefined {
  const key = phoneKey(phone);
  if (key.length < 10) return undefined;
  return runs.find(d => d.projectId === projectId && d.id !== exceptId && phoneKey(d.contactPhone) === key);
}

/** Follow-up state of an open item relative to today (device-local day). */
export function followUpState(d: Deliverable): "none" | "overdue" | "today" | "later" {
  if (d.status !== "open" || !d.followUpAt) return "none";
  const f = new Date(d.followUpAt);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86400000);
  return f < start ? "overdue" : f < end ? "today" : "later";
}

/**
 * 0–100 pipeline progress: the average step progress of the items still in
 * play — won counts 100, open counts how far along its steps it is, lost is
 * left out (it no longer moves).
 */
export function pipelineProgress(items: Deliverable[], project: Project): number {
  const live = items.filter(d => d.status !== "lost");
  if (!live.length) return 0;
  return Math.round(live.reduce((a, d) => a + stepProgress(d, project), 0) / live.length);
}

/** Pipeline numbers for a set of items. Conversion = won / (won + lost). */
export function pipelineStats(items: Deliverable[]) {
  const won = items.filter(d => d.status === "won");
  const lost = items.filter(d => d.status === "lost").length;
  const open = items.filter(d => d.status === "open");
  return {
    total: items.length, open: open.length, won: won.length, lost,
    conversion: won.length + lost ? Math.round((won.length / (won.length + lost)) * 100) : 0,
    wonValue: won.reduce((a, d) => a + d.value, 0),
    openValue: open.reduce((a, d) => a + d.value, 0),
    followUpsDue: open.filter(d => { const f = followUpState(d); return f === "overdue" || f === "today"; }).length,
    pending: open.filter(d => d.approvals[d.milestoneId]?.status === "pending").length,
  };
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
    const next = await patchDeliverable(d.id, { status: "open", closed_at: null, lost_reason: null, milestone_entered_at: now });
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
