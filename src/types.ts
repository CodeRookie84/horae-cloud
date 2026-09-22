/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Basic Horae multi-tenant types

export enum Department {
  ALL = "All Departments",
  KITCHEN = "Kitchen & Baking",
  PACKING = "Packing & Inventory",
  FRONT_DESK = "Front Desk & Sales",
  MANAGEMENT = "Management",
  OUTLET = "Outlet",
  STORE = "Store"
}

export enum Role {
  ALL = "All Roles",
  SUPER_ADMIN = "Super Admin",
  ADMIN = "Admin",
  MANAGER = "Manager",
  SUPERVISOR = "Supervisor",
  STAFF = "Staff",
  CHEF = "Chef / Lead Baker",
  BREAD_MAKER = "Baker",
  PACKER = "Packer",
  CASHIER = "Cashier"
}

export interface Client {
  id: string;
  name: string;
  logo: string;
  plan: "Free" | "Essential" | "Pro" | "Enterprise" | "Training" | "Assistant";
  createdAt: string;
  services?: string[];
  /** Training add-on — grants the Training feature on top of Essential/Pro. */
  trainingAddon?: boolean;
  /** Daily-digest kill switch. false = no morning/evening digest (push + WhatsApp)
   *  for any of this client's staff. Defaults to true (undefined = enabled). */
  digestEnabled?: boolean;
  /** ISO 639-1 codes this client's staff can translate into (chosen at onboarding). */
  languages?: string[];
  /** True for a time-limited sales-demo sandbox (see 20260825_demo_clients.sql). */
  isDemo?: boolean;
  /** ISO timestamp when a demo client's access stops. Only meaningful when isDemo. */
  demoExpiresAt?: string;
}

export interface Tenant {
  id: string;
  clientId: string;
  name: string;
  subdomain: string;
  logo: string;
  plan: "Free" | "Essential" | "Pro" | "Enterprise" | "Training" | "Assistant";
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role | string;
  department: Department | string;
  tenantId: string;
  avatar: string;
  isOnline?: boolean;
  /** WhatsApp number in international format e.g. +919876543210 */
  phoneNumber?: string;
  /** Whether staff has opted-in to receive WhatsApp notifications */
  whatsappOptedIn?: boolean;
  /** Firebase FCM push token for browser push notifications */
  fcmToken?: string;
  /** Last seen timestamp for anti-spam (skip if online recently) */
  lastSeenAt?: string;
  /** CLIT (Equipment Maintenance) access — off by default; gates the maintenance tab */
  clitAccess?: boolean;
  /** CLIT role (separate from the staff `role`): technician | qc_executive | qc_lead | maintenance_manager | clit_admin */
  clitRole?: string;
  /** Has this account completed its mandatory first-login password change? Server-side (not localStorage) so it survives a new device, cleared browser data, or iOS's aggressive storage-clearing for installed web apps. */
  pwdChanged?: boolean;
}

export interface Notice {
  id: string;
  tenantId: string;
  title: string;
  content: string;
  isUrgent: boolean;
  department: Department | string; // Notice targets this department
  role: Role | string;             // Notice targets this role within the department (or overall)
  createdAt: string;
  createdBy: {
    userId: string;
    name: string;
    role: string;
  };
  videoUrl?: string;
  subject?: string;
}

/** How a checklist item is answered. `tick` = ✓/NA (default, back-compatible with
 *  every existing checklist); `yes_no` = Yes/No (+ optional remark); `numeric` = a
 *  logged value checked against `target` (e.g. fridge temp 0–5 °C); `score` = a 1–5
 *  audit rating. */
export type ChecklistResponseType = "tick" | "yes_no" | "numeric" | "score";

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  completedBy?: {
    userId: string;
    name: string;
  } | null;
  completedAt?: string | null;
  // ── Food-safety / compliance extensions (all optional; absent ⇒ a plain tick item) ──
  responseType?: ChecklistResponseType;
  /** A critical non-conformance — failing it fails the whole run, regardless of score. */
  critical?: boolean;
  /** Pre-set fix surfaced when this item fails / scores low (QC "Action if Fail"). */
  correctiveAction?: string;
  /** Require a photo as evidence when completing this item. */
  requiresPhoto?: boolean;
  /** Pass range for a `numeric` item (e.g. { min: 0, max: 5, unit: "°C" }). */
  target?: { min?: number; max?: number; unit?: string };
}

export interface Checklist {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  department: Department | string; // Checklist targets this department
  role: Role | string;             // Checklist targets this role
  createdAt: string;
  createdBy: {
    userId: string;
    name: string;
    role: string;
  };
  items: ChecklistItem[];
  recurrence?: string;
  recurrenceDay?: string;
  translations?: Record<string, {
    title: string;
    description: string;
    items: Record<string, string>;
  }>;
  attachment?: string;
  customInputFields?: string[];
  sections?: {
    id: string;
    number: string;
    name: string;
    items: {
      id: string;
      text: string;
    }[];
  }[];
  type?: "single" | "yes_no";
  adminNotes?: string;
  submissions?: any[];
  groupId?: string;
  // ── Food-safety / compliance extensions ──
  /** Operational cadence for a compliance checklist (opening/closing shift, or a
   *  periodic audit). Distinct from the existing display `recurrence`. */
  frequency?: ChecklistFrequency;
  /** Template pack this checklist came from — used to gate content by plan
   *  (e.g. the Enterprise-only `fssai` pack). Absent ⇒ a hand-built checklist. */
  packId?: string;
  /** Who is responsible: module-local stations and/or specific staff — decoupled
   *  from the staff-directory `department`/`role` above (mirrors the KOT model).
   *  `notifyUserIds` are watchers (e.g. a manager/chef) who get an app push when
   *  this checklist is submitted and can see its submission status board — a
   *  narrow, per-checklist exception, not a role change. */
  assignment?: { stationIds?: string[]; userIds?: string[]; notifyUserIds?: string[] };
}

export type ChecklistFrequency =
  | "opening" | "closing" | "shift" | "daily" | "weekly" | "monthly" | "audit";

/** A responsible identity for a checklist, defined inside the module (not the staff
 *  directory) — e.g. "Kitchen — Closing", "Counter — Opening". Mirrors kot_stations:
 *  a shared, optionally PIN-protected identity a completed run is attributed to. */
export interface ChecklistStation {
  id: string;
  tenantId: string;
  clientId?: string;
  label: string;
  active: boolean;
  createdAt?: string;
}

/** One item's result within a run. Shape follows the item's `responseType`. */
export interface ChecklistRunItem {
  itemId: string;
  responseType?: ChecklistResponseType;
  /** Pass/fail after evaluation (numeric vs target, score threshold, yes/no, tick). */
  ok?: boolean;
  /** Logged value for a `numeric` item, or the 1–5 rating for a `score` item. */
  value?: number;
  remark?: string;
  photoUrl?: string;
  /** Copied from the item when it failed, so the register shows the fix inline. */
  correctiveAction?: string;
}

/** A single completion of a checklist — the immutable, inspection-ready record. */
export interface ChecklistRun {
  id: string;
  checklistId: string;
  tenantId: string;
  /** The station this run was performed under, if any. */
  stationId?: string | null;
  performer: { userId?: string; stationId?: string; name: string };
  startedAt?: string | null;
  completedAt: string;
  status: "completed" | "failed";
  /** Mean of `score`-type item ratings (audits), if the checklist has any. */
  score?: number | null;
  /** Share of applicable items that passed, 0–100. */
  compliancePct?: number | null;
  items: ChecklistRunItem[];
  createdAt?: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  senderName: string;
  senderRole: string;
  message: string;
  timestamp: string;
}

export interface Task {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  status: "Assigned" | "In Progress" | "Pending" | "On Hold" | "Completed" | "Closed";
  priority: "Low" | "Medium" | "High" | "Critical" | string;
  dueDate: string;
  assignedUserId: string; // The primary assignee in the database
  assignedUserIds?: string[]; // Primary assignees — they get the WhatsApp ping
  ccUserIds?: string[]; // CC / keep-informed users — in-app + daily digest only, no WhatsApp
  createdByUserId: string;
  createdAt: string;
  chat: ChatMessage[];
  translations?: Record<string, string>;
  photos?: string[];
}

export interface Reminder {
  id: string;
  userId: string;
  tenantId?: string;
  text: string;
  remindAt?: string;   // optional ISO "when" (display/sort only — never pushed)
  status: "pending" | "done";
  createdAt: string;
  /** Same table backs WhatsApp "rem" (reminder) and "meet" (meeting) — absent ⇒ reminder. */
  kind?: "reminder" | "meeting";
}

export interface OperationalNotification {
  id: string;
  tenantId: string;
  title: string;
  message: string;
  category: "notice" | "checklist" | "task" | "system";
  department: Department | string;
  role: Role | string;
  createdAt: string;
  targetUserId?: string; // Optional direct target
}

export interface SOP {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  category: string;
  department: Department | string;
  role: Role | string;
  content: string; // Markdown or text content
  fileUrl?: string; // Optional attachment name/url
  createdAt: string;
  createdBy: {
    userId: string;
    name: string;
    role: string;
  };
}

export interface SOPReadStatus {
  id: string;
  sopId: string;
  sopTitle: string;
  userId: string;
  userName: string;
  userRole: string;
  readAt: string;
}

/** Per-user WhatsApp delivery/read/reply engagement, for the Reports tab. */
export interface WhatsAppEngagementRow {
  userId: string;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  repliedCount: number;
  lastReadAt?: string;
}

// ─────────────────────────────────────────────────────────────
// Training — upload a document, attach an (AI-drafted, admin-reviewed) test,
// target it to outlets/departments/roles, and track staff scores.
// ─────────────────────────────────────────────────────────────

export interface TrainingQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface Training {
  id: string;
  clientId: string;
  tenantId: string;
  title: string;
  description: string;
  docUrl?: string;
  docName?: string;
  docType?: string;
  sourceNotes?: string;
  /** Target tenant ids; empty = all outlets of the client. */
  outlets: string[];
  department: Department | string;
  role: Role | string;
  passPct: number;
  allowRetest: boolean;
  maxAttempts: number;   // 0 = unlimited
  shuffle: boolean;
  dueDate?: string;
  questions: TrainingQuestion[];
  retestGrants: string[];
  published: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface TrainingAttempt {
  id: string;
  trainingId: string;
  trainingTitle: string;
  userId: string;
  userName: string;
  userRole: string;
  department: string;
  tenantId: string;
  score: number;
  total: number;
  pct: number;
  passed: boolean;
  answers: number[];
  attemptNo: number;
  submittedAt: string;
  /** How many times the staff member left/backgrounded the app during this attempt — an admin-visible signal, not an automatic fail. */
  screenLeaves: number;
}

export function isTargetMatched(
  targetStr: string,
  userVal: string,
  allVal: string
): boolean {
  if (!targetStr) return false;
  if (targetStr === allVal || targetStr === "ALL") return true;
  // If it's a JSON array
  if (targetStr.startsWith("[")) {
    try {
      const arr = JSON.parse(targetStr);
      return arr.includes(allVal) || arr.includes("ALL") || arr.includes(userVal);
    } catch (e) {}
  }
  // If it's comma-separated
  const items = targetStr.split(",").map(i => i.trim());
  return items.includes(allVal) || items.includes("ALL") || items.includes(userVal);
}

