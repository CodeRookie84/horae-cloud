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
  plan: "Free" | "Essential" | "Pro" | "Enterprise" | "Training";
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
  plan: "Free" | "Essential" | "Pro" | "Enterprise" | "Training";
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

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  completedBy?: {
    userId: string;
    name: string;
  } | null;
  completedAt?: string | null;
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

