/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * appModules.ts — single source of truth for the app's feature "modules"
 * (the things that live as tabs in the sidebar). The launcher home grid and
 * the mobile bottom-nav both build off this so they always agree with the
 * plan/role gating, instead of each re-deriving which tabs a user can see.
 */
import type { ComponentType } from 'react';
import {
  Layers, Megaphone, ClipboardCheck, MessageSquare,
  GraduationCap, BookOpen, FileText, Wrench, ShieldCheck,
} from 'lucide-react';

export interface AppModule {
  /** Matches the `activeTab` string used in App.tsx routing */
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Tailwind classes for the launcher tile's icon chip (bg + fg) */
  accent: string;
  /** Unread/attention count shown as a badge, if any */
  badge?: number;
}

export interface ModuleGateContext {
  features: string[];
  role: string;
  clitAccess: boolean;
  /** Whether the Dashboard tab surfaces anything for this plan */
  dashboardMeaningful: boolean;
  /** Per-module badge counts keyed by module id (e.g. { 'tasks': 3 }) */
  badges?: Record<string, number>;
}

const isAdmin = (role: string) => role === 'Admin' || role === 'Super Admin';

/**
 * Returns the ordered list of modules a given user can actually open, already
 * gated by plan features and role. Order matches the sidebar's grouping.
 */
export function getAppModules(ctx: ModuleGateContext): AppModule[] {
  const { features, role, clitAccess, dashboardMeaningful, badges = {} } = ctx;
  const has = (k: string) => features.includes(k);
  const mods: AppModule[] = [];

  const push = (m: AppModule) => mods.push({ ...m, badge: badges[m.id] || undefined });

  if (dashboardMeaningful) push({ id: 'dashboard', label: 'Dashboard', icon: Layers, accent: 'bg-blue-100 text-blue-600' });
  if (has('notices')) push({ id: 'notices', label: 'Notices', icon: Megaphone, accent: 'bg-amber-100 text-amber-600' });
  if (has('checklists')) push({ id: 'checklists', label: 'Checklists', icon: ClipboardCheck, accent: 'bg-emerald-100 text-emerald-600' });
  if (has('tasks')) push({ id: 'tasks', label: 'Tasks', icon: MessageSquare, accent: 'bg-indigo-100 text-indigo-600' });
  if (has('maintenance') && (clitAccess || isAdmin(role))) push({ id: 'maintenance', label: 'Maintenance', icon: Wrench, accent: 'bg-slate-200 text-slate-700' });
  if (has('training')) push({ id: 'training', label: 'Training', icon: GraduationCap, accent: 'bg-violet-100 text-violet-600' });
  if (has('sops')) push({ id: 'sops', label: 'SOPs', icon: FileText, accent: 'bg-teal-100 text-teal-600' });

  if (role === 'Admin') push({ id: 'admin-panel', label: 'Admin Panel', icon: ShieldCheck, accent: 'bg-[#C5A880]/20 text-[#9c7d4e]' });

  return mods;
}

/**
 * The 3 most operationally-relevant modules for the mobile bottom bar (plus a
 * Home button added by the nav component itself). Prefers Tasks / Notices /
 * Checklists, falling back to whatever else the plan grants so the bar is never
 * sparse.
 */
export function getBottomNavModules(all: AppModule[]): AppModule[] {
  const preferred = ['tasks', 'notices', 'checklists', 'training'];
  const byId = new Map(all.map(m => [m.id, m]));
  const picked: AppModule[] = [];
  for (const id of preferred) {
    const m = byId.get(id);
    if (m) picked.push(m);
    if (picked.length >= 3) break;
  }
  return picked;
}
