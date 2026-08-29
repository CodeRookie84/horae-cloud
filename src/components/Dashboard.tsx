/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dashboard — Patisserie Modern redesign.
 *
 * Layout: trial banner, greeting hero (greeting + date only), Tasks action
 * card, and the fixed Workspace Tools strip.
 */

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Megaphone,
  ClipboardCheck,
  CheckSquare,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Plus,
  GraduationCap,
  Sparkles,
  Award,
} from "lucide-react";
import {
  Tenant,
  User as AppUser,
  Notice,
  Checklist,
  Task,
  Role,
  Department,
  Training as TrainingT,
  TrainingAttempt,
  isTargetMatched,
} from "../types";
import { trainingMatchesUser, trainingStatus } from "../services/trainingService";
import PWAInstallPrompt from "./PWAInstallPrompt";

interface DashboardProps {
  activeTenant: Tenant;
  activeUser: AppUser;
  tenants: Tenant[];
  notices: Notice[];
  checklists: Checklist[];
  tasks: Task[];
  tenantUsers: AppUser[];
  onSubmitChecklist: (chkId: string, itemStates: { [itemId: string]: boolean }) => void;
  onNavigate: (tab: string) => void;
  onAddTask: (title: string, description: string, priority: string, dueDate: string, assignedUserIds: string[], ccUserIds?: string[]) => void;
  trainings?: TrainingT[];
  trainingAttempts?: TrainingAttempt[];
  /** Feature keys the client's plan grants — gates which dashboard sections show. */
  features?: string[];
  /** Demo sandbox flags — drive the banner's copy + countdown when set. */
  isDemo?: boolean;
  demoExpiresAt?: string;
}

export default function Dashboard({
  activeTenant,
  activeUser,
  tenants = [],
  notices: rawNotices,
  checklists: rawChecklists,
  tasks: rawTasks,
  tenantUsers = [],
  onSubmitChecklist,
  onNavigate,
  onAddTask,
  trainings: rawTrainings = [],
  trainingAttempts: rawTrainingAttempts = [],
  features = [],
  isDemo = false,
  demoExpiresAt,
}: DashboardProps) {
  const has = (key: string) => features.includes(key);
  // ── State (unchanged from previous Dashboard) ──────────────────────────
  const [isToolsExpanded, setIsToolsExpanded] = React.useState(true);

  const [localChecked, setLocalChecked] = React.useState<{ [itemId: string]: boolean }>(() => {
    const init: { [itemId: string]: boolean } = {};
    rawChecklists.forEach((c) => {
      c.items.forEach((i) => {
        init[i.id] = i.completed;
      });
    });
    return init;
  });

  React.useEffect(() => {
    setLocalChecked((prev) => {
      const next = { ...prev };
      rawChecklists.forEach((c) => {
        c.items.forEach((i) => {
          if (next[i.id] === undefined) next[i.id] = i.completed;
        });
      });
      return next;
    });
  }, [rawChecklists]);

  const [readNoticeIds, setReadNoticeIds] = React.useState<string[]>(() => {
    try {
      const val = localStorage.getItem(`horae_read_notices_${activeUser.id}`);
      return val ? JSON.parse(val) : [];
    } catch {
      return [];
    }
  });

  // ── Derived metrics (unchanged) ────────────────────────────────────────
  const notices = rawNotices;
  const checklists = rawChecklists;
  const tasks = rawTasks.filter((t) => t.status !== "Closed");

  const unreadNoticesCount = notices.filter((n) => !readNoticeIds.includes(n.id)).length;

  const unsubmittedChecklistsCount = checklists.filter((c) => c.items.some((i) => !i.completed)).length;

  // Pending training assessments assigned to this user (published + targeted + not yet passed).
  const pendingTrainingCount = rawTrainings.filter((t) =>
    t.published && (t.questions?.length || 0) > 0 &&
    trainingMatchesUser(t, { tenantId: activeUser.tenantId, department: String(activeUser.department), role: String(activeUser.role) }) &&
    trainingStatus(t, activeUser.id, rawTrainingAttempts).status !== "passed",
  ).length;

  const tasksFiltered = rawTasks;
  const assignedToMe = tasksFiltered.filter(
    (t) =>
      (t.assignedUserIds && t.assignedUserIds.includes(activeUser.id)) ||
      t.assignedUserId === activeUser.id,
  );
  const pendingAssignedToMe = assignedToMe.filter(
    (t) => t.status !== "Completed" && t.status !== "Closed",
  );

  const newlyAssignedToMeCount = tasks.filter(
    (t) =>
      t.status === "Assigned" &&
      (t.assignedUserIds?.includes(activeUser.id) || t.assignedUserId === activeUser.id),
  ).length;

  const totalUnreadChats = tasksFiltered
    .filter((t) => {
      if (t.status === "Closed") return false;
      const isAssignee =
        t.assignedUserId === activeUser.id ||
        (t.assignedUserIds && t.assignedUserIds.includes(activeUser.id));
      const isCreator = t.createdByUserId === activeUser.id;
      return isAssignee || isCreator;
    })
    .reduce((sum, t) => {
      const key = `horae_task_chat_read_${activeUser.id}_${t.id}`;
      const readCountStr = localStorage.getItem(key);
      const readCount = readCountStr ? parseInt(readCountStr, 10) : 0;
      const unread = Math.max(0, t.chat.length - readCount);
      return sum + unread;
    }, 0);

  // A demo drives the banner off its explicit expiry; a real Free trial off the
  // fixed 15-day window from creation.
  const isTrialActive = isDemo || activeTenant.plan === "Free";
  let trialDaysLeft = 15;
  if (isDemo) {
    const remainingMs = demoExpiresAt ? new Date(demoExpiresAt).getTime() - Date.now() : 0;
    trialDaysLeft = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
  } else if (isTrialActive && activeTenant.createdAt) {
    const createdTime = new Date(activeTenant.createdAt).getTime();
    const elapsedMs = Date.now() - createdTime;
    const remainingMs = 15 * 24 * 60 * 60 * 1000 - elapsedMs;
    trialDaysLeft = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
  }

  // ── Presentation helpers ───────────────────────────────────────────────
  const now = new Date();
  const todayLabel = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // ── "Today's Briefing" — the in-app digest the /digest deep link lands on.
  // Mirrors the WhatsApp/push digest, but free and always available in the app.
  const firstName = activeUser.name.split(" ")[0];
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const todayStr = now.toLocaleDateString("en-CA"); // yyyy-mm-dd, matches due_date
  const myTasks = rawTasks.filter(
    (t) =>
      t.assignedUserId === activeUser.id ||
      t.assignedUserIds?.includes(activeUser.id) ||
      t.ccUserIds?.includes(activeUser.id),
  );
  const myPendingTasks = myTasks.filter((t) => t.status !== "Completed" && t.status !== "Closed");
  const overdueCount = myPendingTasks.filter((t) => (t.dueDate || "").slice(0, 10) < todayStr).length;

  const briefing = [
    // Notices first, highlighted — management uses these for important updates.
    has("notices") && unreadNoticesCount > 0 && {
      key: "notices", Icon: Megaphone, count: unreadNoticesCount,
      tint: "#fff", color: "#B45309",
      title: `${unreadNoticesCount} unread notice${unreadNoticesCount === 1 ? "" : "s"}`, sub: "Important — tap to read", alert: false, highlight: true, target: "notices",
    },
    has("tasks") && myPendingTasks.length > 0 && {
      key: "tasks", Icon: CheckSquare, count: myPendingTasks.length,
      tint: "var(--color-accent-tint)", color: "color-mix(in srgb, var(--color-accent) 78%, var(--color-ink))",
      title: `${myPendingTasks.length} task${myPendingTasks.length === 1 ? "" : "s"} open`,
      sub: overdueCount > 0 ? `${overdueCount} overdue — do this first` : (newlyAssignedToMeCount > 0 ? `${newlyAssignedToMeCount} newly assigned` : "You're on track"),
      alert: overdueCount > 0, highlight: false, target: "tasks",
    },
    has("tasks") && totalUnreadChats > 0 && {
      key: "chats", Icon: MessageSquare, count: totalUnreadChats,
      tint: "color-mix(in srgb, var(--color-rose) 16%, white)", color: "color-mix(in srgb, var(--color-rose) 62%, var(--color-ink))",
      title: `${totalUnreadChats} new comment${totalUnreadChats === 1 ? "" : "s"}`, sub: "On your tasks", alert: false, highlight: false, target: "tasks",
    },
    has("checklists") && unsubmittedChecklistsCount > 0 && {
      key: "checklists", Icon: ClipboardCheck, count: unsubmittedChecklistsCount,
      tint: "color-mix(in srgb, #5C8567 16%, white)", color: "#5C8567",
      title: `${unsubmittedChecklistsCount} checklist${unsubmittedChecklistsCount === 1 ? "" : "s"} pending`, sub: "Complete before end of day", alert: false, highlight: false, target: "checklists",
    },
    has("training") && pendingTrainingCount > 0 && {
      key: "training", Icon: Award, count: pendingTrainingCount,
      tint: "var(--color-brand-tint)", color: "var(--color-brand)",
      title: `${pendingTrainingCount} training pending`, sub: "Assigned to you", alert: false, highlight: false, target: "training",
    },
  ].filter(Boolean) as { key: string; Icon: any; count: number; tint: string; color: string; title: string; sub: string; alert: boolean; highlight: boolean; target: string }[];

  const canAssign =
    activeUser.role === Role.ADMIN || activeUser.role === Role.SUPER_ADMIN ||
    activeUser.role === Role.MANAGER || activeUser.role === Role.SUPERVISOR;

  // Workspace-tools strip — only the tools the client's plan grants.
  const tools = [
    has("notices")    && { key: "notices",    label: "Notices",             Icon: Megaphone,      color: "var(--color-accent)",     count: unreadNoticesCount,        target: "notices" },
    has("checklists") && { key: "checklists", label: "Checklists",          Icon: ClipboardCheck, color: "#5C8567",                 count: unsubmittedChecklistsCount, target: "checklists" },
    has("training")   && { key: "training",   label: "Training Assessment", Icon: Award,          color: "var(--color-brand)",      count: pendingTrainingCount,      target: "training" },
  ].filter(Boolean) as { key: string; label: string; Icon: any; color: string; count: number; target: string }[];

  return (
    <div className="space-y-6 pb-8" id="dashboard-wrapper">
      <PWAInstallPrompt activeTab="dashboard" />

      {/* ── Trial banner (warm caramel) ───────────────────────────────── */}
      {isTrialActive && (
        <div className="rounded-2xl p-5 shadow-warm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left
                        bg-gradient-to-r from-[var(--color-accent)] to-[#C87F58] text-white">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-white/90" />
            <div>
              <div className="text-xs font-medium tracking-wide uppercase text-white/85">{isDemo ? "Demo workspace" : "Free trial active"}</div>
              <p className="text-base font-semibold mt-0.5">
                {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} remaining{isDemo ? " in your demo." : " on all premium features."}
              </p>
            </div>
          </div>
          {activeUser.role === Role.ADMIN && (
            <button
              onClick={() => onNavigate("admin-panel")}
              className="bg-white text-[#A56947] font-semibold text-sm px-4 py-2 rounded-xl transition-all shadow-warm cursor-pointer self-start sm:self-auto active:scale-95 hover:bg-white/95"
            >
              Upgrade subscription
            </button>
          )}
        </div>
      )}

      {/* ── Today's Briefing — date + greeting + digest + Assign, right up top.
             (Was below a hero card; the hero's date now sits in this header.) ── */}
      <section id="dashboard-briefing" className="bg-white rounded-2xl border border-[var(--color-line)] shadow-warm overflow-hidden">
        <header
          className="px-5 sm:px-6 py-4 border-b border-[var(--color-line)] relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, var(--color-brand-tint) 0%, #FFFFFF 62%, var(--color-accent-tint) 100%)" }}
        >
          <div className="absolute top-0 right-0 w-48 h-28 bg-piped-dots opacity-40 pointer-events-none" aria-hidden />
          <div className="relative">
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[var(--color-brand)] mb-2">{todayLabel}</div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Sparkles className="w-4.5 h-4.5 text-[var(--color-brand)] shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-semibold text-[var(--color-ink)] leading-tight truncate">{greeting}, {firstName}</h3>
                  <p className="text-xs text-[var(--color-ink-soft)] mt-0.5">
                    {briefing.length > 0 ? "Here's what needs you today." : "Nothing pending — you're all caught up."}
                  </p>
                </div>
              </div>
              {briefing.length === 0 && <span className="text-xl shrink-0" aria-hidden>🎉</span>}
            </div>
          </div>
        </header>

        {briefing.length > 0 && (
          <div className="px-5 sm:px-6 pt-3.5 pb-1.5 bg-[var(--color-cream)]/60">
            <span className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-[var(--color-ink-soft)]">Needs your attention</span>
          </div>
        )}

        {briefing.length > 0 && (
          <div className="divide-y divide-[var(--color-line)]">
            {briefing.map(({ key, Icon, count, tint, color, title, sub, alert, highlight, target }) => (
              <button
                key={key}
                onClick={() => onNavigate(target)}
                className="w-full flex items-center gap-3.5 px-5 sm:px-6 py-3.5 text-left transition-colors cursor-pointer hover:bg-[var(--color-cream)]"
                style={alert ? {
                  background: "linear-gradient(90deg, color-mix(in srgb, var(--color-rose) 16%, white) 0%, color-mix(in srgb, var(--color-rose) 5%, white) 70%)",
                  borderLeft: "3px solid color-mix(in srgb, var(--color-rose) 65%, var(--color-ink))",
                } : highlight ? {
                  background: "linear-gradient(90deg, #FEF3C7 0%, #FFFBEB 72%)",
                  borderLeft: "3px solid #D97706",
                } : undefined}
              >
                <div
                  className="w-10 h-10 rounded-[13px] flex items-center justify-center shrink-0"
                  style={{ backgroundColor: alert || highlight ? "#fff" : tint, color, boxShadow: alert ? "0 6px 14px -8px color-mix(in srgb, var(--color-rose) 55%, transparent)" : highlight ? "0 6px 14px -8px rgba(217,119,6,.45)" : undefined }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-[var(--color-ink)] truncate">{title}</div>
                    {highlight && <span className="shrink-0 text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded bg-amber-500 text-white">Important</span>}
                  </div>
                  <div
                    className={`text-xs mt-0.5 truncate ${alert || highlight ? "font-semibold" : "text-[var(--color-ink-soft)]"}`}
                    style={alert ? { color: "color-mix(in srgb, var(--color-rose) 62%, var(--color-ink))" } : highlight ? { color: "#B45309" } : undefined}
                  >{sub}</div>
                </div>
                {alert ? (
                  <span className="shrink-0 min-w-[26px] h-[26px] px-2 rounded-[9px] flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: "color-mix(in srgb, var(--color-rose) 66%, var(--color-ink))" }}>{count}</span>
                ) : highlight ? (
                  <span className="shrink-0 min-w-[26px] h-[26px] px-2 rounded-[9px] flex items-center justify-center text-sm font-bold text-white bg-amber-600">{count}</span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-[var(--color-ink-soft)] shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}

        {canAssign && has("tasks") && (
          <div className="p-4 border-t border-[var(--color-line)]">
            <button
              onClick={() => { sessionStorage.setItem('horae_open_assign', '1'); onNavigate("tasks"); }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-bold bg-[var(--color-brand)] hover:bg-[color-mix(in_srgb,var(--color-brand)_88%,var(--color-ink))] shadow-warm cursor-pointer transition-all active:scale-[.99]"
            >
              <Plus className="w-4.5 h-4.5" /> Assign a task
            </button>
          </div>
        )}
      </section>

      {/* ── Workspace tools — now BELOW the briefing (the top strip is removed). ── */}
      {tools.length > 0 && (
        <section id="dashboard-tools" className="bg-white rounded-2xl border border-[var(--color-line)] shadow-warm overflow-hidden">
          <button
            onClick={() => setIsToolsExpanded(!isToolsExpanded)}
            className="flex items-center justify-between px-5 sm:px-6 py-3.5 bg-[var(--color-cream)] hover:bg-[var(--color-cream-deep)] transition-colors w-full cursor-pointer"
          >
            <span className="text-xs font-bold text-[var(--color-ink)] tracking-wider uppercase">Workspace tools</span>
            {isToolsExpanded ? (
              <ChevronDown className="w-4 h-4 text-[var(--color-ink-soft)]" />
            ) : (
              <ChevronUp className="w-4 h-4 text-[var(--color-ink-soft)]" />
            )}
          </button>
          <AnimatePresence>
            {isToolsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="grid gap-0 border-t border-[var(--color-line)] divide-x divide-[var(--color-line)]"
                style={{ gridTemplateColumns: `repeat(${tools.length}, minmax(0, 1fr))` }}
              >
                {tools.map(({ key, label, Icon, color, count, target }) => (
                  <button
                    key={key}
                    onClick={() => onNavigate(target)}
                    className="flex flex-col items-center justify-center gap-1.5 py-4 hover:bg-[var(--color-cream)] transition-all relative cursor-pointer group"
                    title={label}
                  >
                    <div className="relative">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm"
                        style={{ backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${color} 22%, white) 0%, color-mix(in srgb, ${color} 8%, white) 100%)` }}
                      >
                        <Icon className="w-5 h-5" style={{ color }} />
                      </div>
                      {count > 0 && (
                        <span className="absolute -top-2 -right-2 bg-[var(--color-brand)] text-white font-bold text-[10px] min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow animate-bounce">
                          {count}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-[var(--color-ink)] leading-none text-center px-1">{label}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

    </div>
  );
}
