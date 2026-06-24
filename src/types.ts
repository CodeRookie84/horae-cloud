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
  plan: "Free" | "Essential" | "Pro" | "Enterprise";
  createdAt: string;
  services?: string[];
}

export interface Tenant {
  id: string;
  clientId: string;
  name: string;
  subdomain: string;
  logo: string;
  plan: "Free" | "Essential" | "Pro" | "Enterprise";
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

// ─────────────────────────────────────────────────────────────
// Team Talk — Context-first structured chat system
// ─────────────────────────────────────────────────────────────

export type ChatChannelType = 'announcement' | 'department' | 'outlet' | 'context' | 'dm' | 'channel' | 'room';
export type ChatMessageType = 'text' | 'voice' | 'image' | 'system';
export type ChatSpaceType = 'outlet' | 'department' | 'cross_functional' | 'management';

export interface ChatSpace {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  type: ChatSpaceType;
  isArchived: boolean;
  createdAt: string;
}

export interface ChatChannelAutoRule {
  id: string;
  channelId: string;
  role?: string;
  department?: string;
  createdAt: string;
}

export interface ChatChannel {
  id: string;
  tenantId: string;
  spaceId?: string;
  name: string;
  description?: string;
  type: ChatChannelType;
  contextType?: 'task' | 'notice' | 'checklist';
  contextId?: string;
  createdBy: string;
  isArchived: boolean;
  createdAt: string;
  // Pinned message
  pinnedMessageId?: string;
  pinnedAt?: string;
  pinnedBy?: string;
  // Computed client-side
  unreadCount?: number;
  lastMessage?: TeamTalkMessage;
  pinnedMessage?: TeamTalkMessage;
}

export interface ChatMember {
  channelId: string;
  userId: string;
  role: 'admin' | 'member';
  lastReadAt?: string;
  isMuted: boolean;
  joinedAt: string;
}

export interface TeamTalkMessage {
  id: string;
  channelId: string;
  /** UUID of the root message that started this thread (null = root message) */
  threadId?: string;
  /** Status of the thread if this is a root message */
  threadStatus?: 'open' | 'active' | 'resolved' | 'private' | string;
  /** Title of the elevated thread */
  threadTitle?: string;
  /** Mentioned users for notifications or private thread access */
  mentionedUserIds?: string[];
  /** Count of unread replies for the current user (used in notifications) */
  unreadReplyCount?: number;
  /** UUID of the direct parent being replied to */
  parentId?: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  senderAvatar?: string;
  content?: string;
  messageType: ChatMessageType;
  // Voice
  voiceUrl?: string;
  voiceDurationSec?: number;
  voiceTranscript?: string;
  // Language
  detectedLanguage?: string;
  translations?: Record<string, string>;  // { "en": "...", "ta": "..." }
  // Mentions — list of user IDs tagged with @
  // Escalations
  escalationRole?: string;
  escalationStatus?: 'pending' | 'resolved' | 'ignored';
  // Integrations
  linkedTaskId?: string;
  linkedChecklistId?: string;
  linkedNoticeId?: string;
  isBranched: boolean;
  branchTaskId?: string;  // Task created FROM this message (Fork+Link)
  // Reactions { "👍": ["uid1", "uid2"] }
  reactions: Record<string, string[]>;
  // Meta
  isEdited: boolean;
  isDeleted: boolean;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  // Computed client-side
  replyCount?: number;
}

export interface ChatMention {
  id: string;
  messageId: string;
  channelId: string;
  tenantId: string;
  mentionedUserId: string;
  mentionedByUserId: string;
  isRead: boolean;
  createdAt: string;
}

export interface ChatReadReceipt {
  messageId: string;
  userId: string;
  readAt: string;
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
  assignedUserIds?: string[]; // Multiple assignees list
  createdByUserId: string;
  createdAt: string;
  chat: ChatMessage[];
  reminderSentAt?: string;
  translations?: Record<string, string>;
  photos?: string[];
  linkedChannelId?: string;
  linkedMessageId?: string;
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

export interface QuizQuestion {
  id: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
}

export interface Quiz {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  department: Department | string;
  role: Role | string;
  createdAt: string;
  createdBy: {
    userId: string;
    name: string;
    role: string;
  };
  questions: QuizQuestion[];
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  quizTitle: string;
  userId: string;
  userName: string;
  userRole: string;
  score: number;
  totalQuestions: number;
  answers: number[]; // Index of selected option for each question
  completedAt: string;
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

