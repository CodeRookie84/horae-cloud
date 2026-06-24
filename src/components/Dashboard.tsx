/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dashboard — Patisserie Modern redesign.
 *
 * What changed from the previous version:
 *  - Replaced the empty header-only Team Talk/Tasks panels with content-preview
 *    cards (counts, latest item, micro-stats) so the dashboard feels useful at
 *    a glance instead of acting as a navigation stub.
 *  - Added a time-aware greeting hero with a soft "piped dots" watermark
 *    (single decorative moment, on-brand to the bakery context).
 *  - Promoted four "today at a glance" tiles up front: Open tasks, Assigned
 *    to me, Unread notices, Pending checklists. These surface information
 *    the previous layout buried behind icons.
 *
 * What did NOT change:
 *  - Component signature, props, derived state, callbacks, navigation events,
 *    localStorage keys — all preserved.
 *  - Bottom "Workspace Tools" collapsible strip behavior.
 *  - Trial-banner logic.
 */

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Megaphone,
  ClipboardCheck,
  CheckSquare,
  ChevronUp,
  ChevronDown,
  MessageSquare,
  Plus,
  MessageCircle,
  GraduationCap,
  Sparkles,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import {
  Tenant,
  User as AppUser,
  Notice,
  Checklist,
  Task,
  Role,
  Department,
  Quiz,
  QuizAttempt,
  isTargetMatched,
} from "../types";
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
  onAddTask: (title: string, description: string, priority: string, dueDate: string, assignedUserIds: string[]) => void;
  quizzes?: Quiz[];
  quizAttempts?: QuizAttempt[];
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
  quizzes: rawQuizzes = [],
  quizAttempts: rawQuizAttempts = [],
}: DashboardProps) {
  // ── State (unchanged from previous Dashboard) ──────────────────────────
  const [teamTalkUnread, setTeamTalkUnread] = React.useState(0);
  const [isToolsExpanded, setIsToolsExpanded] = React.useState(true);

  React.useEffect(() => {
    import("../services/chatService").then(({ getChannels }) => {
      getChannels(activeUser.tenantId, activeUser.id)
        .then((channels) => {
          const count = channels.reduce((acc, ch) => acc + (ch.unreadCount ?? 0), 0);
          setTeamTalkUnread(count);
        })
        .catch(console.error);
    });
  }, [activeUser.tenantId, activeUser.id]);

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

  const urgentCount = notices.filter((n) => n.isUrgent).length;
  const unreadNoticesCount = notices.filter((n) => !readNoticeIds.includes(n.id)).length;

  const totalCheckItems = checklists.reduce((acc, chk) => acc + chk.items.length, 0);
  const completedCheckItems = checklists.reduce(
    (acc, chk) => acc + chk.items.filter((i) => i.completed).length,
    0,
  );
  const checklistPercentage = totalCheckItems > 0
    ? Math.round((completedCheckItems / totalCheckItems) * 100)
    : 100;

  const unsubmittedChecklistsCount = checklists.filter((c) => c.items.some((i) => !i.completed)).length;

  const quizzes = rawQuizzes;
  const myQuizzes = quizzes.filter((q) => {
    const matchDept = isTargetMatched(q.department, activeUser.department, Department.ALL);
    const matchRole = isTargetMatched(q.role, activeUser.role, Role.ALL);
    const matchesTenant = q.tenantId === "ALL" || q.tenantId === activeUser.tenantId;
    return matchDept && matchRole && matchesTenant;
  });
  const myAttempts = rawQuizAttempts.filter((a) => a.userId === activeUser.id);
  const unattemptedQuizzes = myQuizzes.filter((q) => !myAttempts.some((a) => a.quizId === q.id));
  const unattemptedQuizzesCount = unattemptedQuizzes.length;

  const tasksFiltered = rawTasks;
  const activeTasks = tasksFiltered.filter((t) => t.status !== "Completed" && t.status !== "Closed");

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

  const isTrialActive = activeTenant.plan === "Free";
  let trialDaysLeft = 15;
  if (isTrialActive && activeTenant.createdAt) {
    const createdTime = new Date(activeTenant.createdAt).getTime();
    const elapsedMs = Date.now() - createdTime;
    const remainingMs = 15 * 24 * 60 * 60 * 1000 - elapsedMs;
    trialDaysLeft = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
  }

  // ── Presentation helpers ───────────────────────────────────────────────
  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 5 ? "Still awake" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const todayLabel = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const firstName = activeUser.name.split(" ")[0];

  // Latest notice (for action card preview)
  const latestNotice = [...notices]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  // Stat tile component
  const StatTile = ({
    label,
    value,
    sub,
    accent,
    icon,
    onClick,
  }: {
    label: string;
    value: number | string;
    sub: string;
    accent: "brand" | "accent" | "sage" | "rose";
    icon: React.ReactNode;
    onClick: () => void;
  }) => {
    const accentClasses: Record<string, { ring: string; text: string; bg: string }> = {
      brand: { ring: "ring-[var(--color-brand)]/10", text: "text-[var(--color-brand)]", bg: "bg-[var(--color-brand-tint)]" },
      accent: { ring: "ring-[var(--color-accent)]/10", text: "text-[var(--color-accent)]", bg: "bg-[var(--color-accent-tint)]" },
      sage: { ring: "ring-[var(--color-sage)]/20", text: "text-[#5C8567]", bg: "bg-[#EDF3EE]" },
      rose: { ring: "ring-[var(--color-rose)]/20", text: "text-[#A85F6A]", bg: "bg-[#FAEDEF]" },
    };
    const a = accentClasses[accent];
    return (
      <button
        onClick={onClick}
        className="group text-left bg-white rounded-2xl border border-[var(--color-line)] p-5 shadow-warm hover:shadow-warm-lg hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden"
      >
        <div className={`absolute -top-6 -right-6 w-28 h-28 rounded-full ${a.bg} opacity-70`} aria-hidden />
        <div className="relative flex items-start justify-between">
          <div className={`w-10 h-10 rounded-xl ${a.bg} ${a.text} flex items-center justify-center`}>
            {icon}
          </div>
          <ArrowUpRight className="w-4 h-4 text-[var(--color-ink-soft)] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="relative mt-4">
          <div className="font-display text-3xl font-semibold tracking-tight text-[var(--color-ink)] leading-none">
            {value}
          </div>
          <div className="mt-2 text-sm font-medium text-[var(--color-ink)]">{label}</div>
          <div className="text-xs text-[var(--color-ink-soft)] mt-0.5">{sub}</div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6 pb-28" id="dashboard-wrapper">
      <PWAInstallPrompt activeTab="dashboard" />

      {/* ── Trial banner (warm caramel) ───────────────────────────────── */}
      {isTrialActive && (
        <div className="rounded-2xl p-5 shadow-warm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left
                        bg-gradient-to-r from-[var(--color-accent)] to-[#C87F58] text-white">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-white/90" />
            <div>
              <div className="text-xs font-medium tracking-wide uppercase text-white/85">Free trial active</div>
              <p className="text-base font-semibold mt-0.5">
                {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} remaining on all premium features.
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

      {/* ── Hero greeting with piped-dots watermark ───────────────────── */}
      <section
        id="dashboard-hero"
        className="relative overflow-hidden rounded-3xl border border-[var(--color-line)] bg-white shadow-warm"
      >
        {/* Soft mulberry wash */}
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "linear-gradient(135deg, var(--color-brand-tint) 0%, #FFFFFF 55%, var(--color-accent-tint) 100%)",
          }}
          aria-hidden
        />
        {/* Piped-dots watermark in the corner — the one decorative moment */}
        <div className="absolute top-0 right-0 w-64 h-40 bg-piped-dots opacity-50 pointer-events-none" aria-hidden />

        <div className="relative px-6 sm:px-8 py-7 sm:py-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="text-xs font-medium tracking-[0.18em] uppercase text-[var(--color-brand)]">
              {todayLabel}
            </div>
            <h1 className="mt-2 font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--color-ink)] leading-tight">
              {greeting}, {firstName}.
            </h1>
            <p className="mt-2 text-sm sm:text-base text-[var(--color-ink-soft)] max-w-xl">
              {activeTasks.length === 0 && unreadNoticesCount === 0
                ? `A quiet board at ${activeTenant.name}. Good time to plan ahead.`
                : `You have ${pendingAssignedToMe.length} task${pendingAssignedToMe.length === 1 ? "" : "s"} on your plate${
                    unreadNoticesCount > 0 ? ` and ${unreadNoticesCount} unread notice${unreadNoticesCount === 1 ? "" : "s"}` : ""
                  } at ${activeTenant.name}.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onNavigate("team-talk")}
              className="inline-flex items-center gap-2 bg-[var(--color-brand)] hover:bg-[color-mix(in_srgb,var(--color-brand)_88%,var(--color-ink))] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-warm transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              Open Team Talk
              {teamTalkUnread > 0 && (
                <span className="ml-1 bg-white/20 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full">
                  {teamTalkUnread > 99 ? "99+" : teamTalkUnread}
                </span>
              )}
            </button>
            <button
              onClick={() => onNavigate("tasks")}
              className="inline-flex items-center gap-2 bg-white border border-[var(--color-line)] text-[var(--color-ink)] hover:bg-[var(--color-cream)] text-sm font-semibold px-4 py-2.5 rounded-xl shadow-warm transition-all cursor-pointer"
            >
              <CheckSquare className="w-4 h-4" />
              Tasks
            </button>
          </div>
        </div>
      </section>

      {/* ── Today at a glance — four stat tiles ───────────────────────── */}
      <section
        id="dashboard-stat-grid"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatTile
          label="Open tasks"
          value={activeTasks.length}
          sub={`${pendingAssignedToMe.length} assigned to you`}
          accent="brand"
          icon={<CheckSquare className="w-5 h-5" />}
          onClick={() => onNavigate("tasks")}
        />
        <StatTile
          label="Newly assigned"
          value={newlyAssignedToMeCount}
          sub="Waiting on your action"
          accent="accent"
          icon={<Plus className="w-5 h-5" />}
          onClick={() => onNavigate("tasks")}
        />
        <StatTile
          label="Unread notices"
          value={unreadNoticesCount}
          sub={urgentCount > 0 ? `${urgentCount} marked urgent` : "Nothing urgent"}
          accent={urgentCount > 0 ? "rose" : "sage"}
          icon={urgentCount > 0 ? <AlertTriangle className="w-5 h-5" /> : <Megaphone className="w-5 h-5" />}
          onClick={() => onNavigate("notices")}
        />
        <StatTile
          label="Checklists due"
          value={unsubmittedChecklistsCount}
          sub={`${checklistPercentage}% complete overall`}
          accent="sage"
          icon={<ClipboardCheck className="w-5 h-5" />}
          onClick={() => onNavigate("checklists")}
        />
      </section>

      {/* ── Two action cards: Team Talk preview + Tasks summary ───────── */}
      <section id="dashboard-action-cards" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Talk */}
        <div className="bg-white rounded-2xl border border-[var(--color-line)] shadow-warm overflow-hidden">
          <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-line)]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-brand-tint)] text-[var(--color-brand)] flex items-center justify-center">
                <MessageCircle className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-[var(--color-ink)]">Team Talk</h3>
                <p className="text-xs text-[var(--color-ink-soft)]">Channels, mentions and DMs</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate("team-talk")}
              className="text-white text-sm font-medium bg-[var(--color-brand)] hover:bg-[color-mix(in_srgb,var(--color-brand)_88%,var(--color-ink))] px-3.5 py-2 rounded-xl shadow-warm cursor-pointer transition-all"
            >
              Open &rarr;
            </button>
          </header>
          <div className="px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="font-display text-4xl font-semibold text-[var(--color-ink)] leading-none">
                {teamTalkUnread}
              </div>
              <div className="text-sm text-[var(--color-ink-soft)]">
                {teamTalkUnread === 0
                  ? "All caught up across your channels."
                  : `unread message${teamTalkUnread === 1 ? "" : "s"} waiting for you.`}
              </div>
            </div>
          </div>
        </div>

        {/* Tasks */}
        <div className="bg-white rounded-2xl border border-[var(--color-line)] shadow-warm overflow-hidden">
          <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-line)]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-accent-tint)] text-[var(--color-accent)] flex items-center justify-center">
                <CheckSquare className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-[var(--color-ink)]">Tasks</h3>
                <p className="text-xs text-[var(--color-ink-soft)]">Assigned, in progress, due</p>
              </div>
            </div>
            <div className="flex gap-2">
              {(activeUser.role === Role.ADMIN ||
                activeUser.role === Role.SUPER_ADMIN ||
                activeUser.role === Role.MANAGER ||
                activeUser.role === Role.SUPERVISOR) && (
                <button
                  onClick={() => {
                    onNavigate("tasks");
                    setTimeout(() => window.dispatchEvent(new CustomEvent("openTaskAssignModal")), 100);
                  }}
                  className="text-white text-sm font-medium bg-[var(--color-brand)] hover:bg-[color-mix(in_srgb,var(--color-brand)_88%,var(--color-ink))] px-3.5 py-2 rounded-xl shadow-warm cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Assign
                </button>
              )}
              <button
                onClick={() => onNavigate("tasks")}
                className="text-[var(--color-ink)] bg-white border border-[var(--color-line)] hover:bg-[var(--color-cream)] text-sm font-medium px-3.5 py-2 rounded-xl shadow-warm cursor-pointer transition-all"
              >
                Open &rarr;
              </button>
            </div>
          </header>
          <div className="px-6 py-5 grid grid-cols-3 gap-4">
            <div>
              <div className="font-display text-2xl font-semibold text-[var(--color-ink)]">
                {pendingAssignedToMe.length}
              </div>
              <div className="text-xs text-[var(--color-ink-soft)] mt-1">For you</div>
            </div>
            <div>
              <div className="font-display text-2xl font-semibold text-[var(--color-ink)]">
                {newlyAssignedToMeCount}
              </div>
              <div className="text-xs text-[var(--color-ink-soft)] mt-1">New</div>
            </div>
            <div>
              <div className="font-display text-2xl font-semibold text-[var(--color-ink)]">
                {totalUnreadChats}
              </div>
              <div className="text-xs text-[var(--color-ink-soft)] mt-1 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                Comments
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Latest notice preview (only when there is one) ────────────── */}
      {latestNotice && (
        <section className="bg-white rounded-2xl border border-[var(--color-line)] shadow-warm p-5 flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              latestNotice.isUrgent
                ? "bg-[#FAEDEF] text-[#A85F6A]"
                : "bg-[var(--color-accent-tint)] text-[var(--color-accent)]"
            }`}
          >
            <Megaphone className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold tracking-wide uppercase text-[var(--color-ink-soft)]">
                Latest notice
              </span>
              {latestNotice.isUrgent && (
                <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#FAEDEF] text-[#A85F6A]">
                  Urgent
                </span>
              )}
            </div>
            <h4 className="font-display text-lg font-semibold text-[var(--color-ink)] mt-1 truncate">
              {latestNotice.title}
            </h4>
            <p className="text-sm text-[var(--color-ink-soft)] mt-1 line-clamp-2">
              {latestNotice.content}
            </p>
          </div>
          <button
            onClick={() => onNavigate("notices")}
            className="self-center text-sm font-medium text-[var(--color-brand)] hover:text-[var(--color-ink)] px-3 py-2 rounded-xl hover:bg-[var(--color-cream)] cursor-pointer transition-all shrink-0"
          >
            Read &rarr;
          </button>
        </section>
      )}

      {/* ── Fixed workspace tools strip (unchanged behavior, restyled) ── */}
      <div className="fixed bottom-4 left-4 right-4 md:left-64 md:right-auto z-40 w-auto">
        <div className="bg-white/90 backdrop-blur-md border border-[var(--color-line)] shadow-warm-lg rounded-2xl overflow-hidden flex flex-col transition-all duration-300">
          <button
            onClick={() => setIsToolsExpanded(!isToolsExpanded)}
            className="flex items-center justify-between px-4 py-3 bg-[var(--color-cream)] hover:bg-[var(--color-cream-deep)] transition-colors w-full cursor-pointer"
          >
            <span className="text-xs font-bold text-[var(--color-ink)] tracking-wider uppercase">
              Workspace tools
            </span>
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
                className="grid grid-cols-3 gap-0 border-t border-[var(--color-line)] divide-x divide-[var(--color-line)]"
              >
                <button
                  onClick={() => onNavigate("notices")}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 hover:bg-[var(--color-cream)] transition-all relative cursor-pointer group"
                  title="Unopened notices"
                >
                  <div className="relative">
                    <Megaphone className="w-5 h-5 text-[var(--color-accent)] group-hover:scale-110 transition-transform" />
                    {unreadNoticesCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-[var(--color-brand)] text-white font-bold text-[10px] min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow animate-bounce">
                        {unreadNoticesCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-semibold text-[var(--color-ink)] leading-none">Notices</span>
                </button>

                <button
                  onClick={() => onNavigate("checklists")}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 hover:bg-[var(--color-cream)] transition-all relative cursor-pointer group"
                  title="Unsubmitted checklists"
                >
                  <div className="relative">
                    <ClipboardCheck className="w-5 h-5 text-[#5C8567] group-hover:scale-110 transition-transform" />
                    {unsubmittedChecklistsCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-[var(--color-brand)] text-white font-bold text-[10px] min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow animate-bounce">
                        {unsubmittedChecklistsCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-semibold text-[var(--color-ink)] leading-none">Checklists</span>
                </button>

                <button
                  onClick={() => onNavigate("quizzes")}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 hover:bg-[var(--color-cream)] transition-all relative cursor-pointer group"
                  title="Unattempted quizzes"
                >
                  <div className="relative">
                    <GraduationCap className="w-5 h-5 text-[var(--color-brand-soft)] group-hover:scale-110 transition-transform" />
                    {unattemptedQuizzesCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-[var(--color-brand)] text-white font-bold text-[10px] min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow animate-bounce">
                        {unattemptedQuizzesCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-semibold text-[var(--color-ink)] leading-none">Quizzes</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
