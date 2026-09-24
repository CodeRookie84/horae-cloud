/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ProjectsHub — the Projects module: project list → one project with Board
 * (deliverables by milestone), My score (CIBIL-style gauge + daily update),
 * Team (leaderboard + funnel) and Settings (milestones, checklists, targets).
 *
 * Visibility: Admin / Super Admin / Manager see every project and deliverable
 * and can approve; everyone else sees projects they're a member of and only
 * their own deliverables.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Plus, FolderKanban, Search, Loader2, ShieldCheck, AlertTriangle, CheckCircle2,
  Info, X, Trophy, Users, Gauge, Settings2, LayoutGrid, Check, Pencil,
} from "lucide-react";
import { Role, type User } from "../../types";
import * as P from "../../services/projectsService";
import ScoreGauge from "./ScoreGauge";
import DeliverableDrawer from "./DeliverableDrawer";
import ProjectSettings, { PROJECT_COLORS } from "./ProjectSettings";

interface Props {
  activeUser: User;
  clientId: string;
  clientUsers: User[];
  onBack?: () => void;
}

type Tab = "board" | "score" | "team" | "settings";

export default function ProjectsHub({ activeUser, clientId, clientUsers, onBack }: Props) {
  const canManage = [Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER].includes(activeUser.role as Role);
  const actor: P.Actor = { id: activeUser.id, name: activeUser.name };
  const period = useMemo(() => P.currentMonthPeriod(), []);

  const [projects, setProjects] = useState<P.Project[]>([]);
  const [deliverables, setDeliverables] = useState<P.Deliverable[]>([]);
  const [targets, setTargets] = useState<P.Target[]>([]);
  const [updates, setUpdates] = useState<P.DailyUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");

  const [projectId, setProjectId] = useState<string>("");
  const [tab, setTab] = useState<Tab>("board");
  const [openId, setOpenId] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const load = async () => {
    setLoadErr("");
    try {
      const ps = await P.getProjects(clientId);
      const ids = ps.map(p => p.id);
      const [ds, ts, us] = await Promise.all([P.getDeliverables(ids), P.getTargets(ids), P.getDailyUpdates(ids, period.start)]);
      setProjects(ps); setDeliverables(ds); setTargets(ts); setUpdates(us);
    } catch (e: any) {
      setLoadErr(e?.message || "Could not load projects.");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [clientId]);

  const visibleProjects = projects.filter(p => canManage || p.memberIds.includes(activeUser.id));
  const project = projects.find(p => p.id === projectId);
  const visibleDeliverables = (pid: string) =>
    deliverables.filter(d => d.projectId === pid && (canManage || d.ownerUserId === activeUser.id));
  const openDeliverable = deliverables.find(d => d.id === openId);

  const replaceDeliverable = (d: P.Deliverable | null) => {
    if (!d) { setDeliverables(ds => ds.filter(x => x.id !== openId)); return; }
    setDeliverables(ds => ds.some(x => x.id === d.id) ? ds.map(x => x.id === d.id ? d : x) : [d, ...ds]);
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  // ── Project list ───────────────────────────────────────────────────────────
  if (!project) {
    const list = visibleProjects.filter(p => showArchived ? p.status === "archived" : p.status === "active");
    return (
      <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBack && <button onClick={onBack} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 cursor-pointer"><ArrowLeft className="h-5 w-5" /></button>}
            <div>
              <h1 className="text-xl font-bold text-slate-900">Projects</h1>
              <p className="text-xs text-slate-500">Track every deliverable from first step to invoice, with targets and scores.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canManage && projects.some(p => p.status === "archived") && (
              <button onClick={() => setShowArchived(v => !v)} className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 cursor-pointer">
                {showArchived ? "Show active" : "Show archived"}
              </button>
            )}
            {canManage && (
              <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700 cursor-pointer">
                <Plus className="h-4 w-4" /> New project
              </button>
            )}
          </div>
        </div>

        {loadErr && <MigrationHint message={loadErr} />}

        {list.length === 0 && !loadErr ? (
          <div className="rounded-3xl border-2 border-dashed border-slate-200 p-10 text-center">
            <FolderKanban className="mx-auto h-10 w-10 text-slate-300" />
            <div className="mt-3 text-sm font-semibold text-slate-700">{canManage ? "No projects yet" : "You haven't been added to a project yet"}</div>
            <p className="mt-1 text-xs text-slate-500">{canManage ? "Start from a template — real estate, marketing, agency — and customise the milestones." : "Ask your manager to add you."}</p>
            {canManage && <button onClick={() => setShowCreate(true)} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 cursor-pointer">Create a project</button>}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map(p => {
              const ds = visibleDeliverables(p.id);
              const open = ds.filter(d => d.status === "open");
              const won = ds.filter(d => d.status === "won");
              const isMember = p.memberIds.includes(activeUser.id);
              const my = isMember ? P.computeScore({ project: p, userId: activeUser.id, deliverables, updates, period,
                target: targets.find(t => t.projectId === p.id && t.userId === activeUser.id && t.periodStart === period.start) }) : null;
              return (
                <button key={p.id} onClick={() => { setProjectId(p.id); setTab(isMember || !canManage ? "board" : "team"); }}
                  className="group overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg cursor-pointer">
                  <div className={`h-2 bg-gradient-to-r ${PROJECT_COLORS[p.color] || PROJECT_COLORS.indigo}`} />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-base font-bold text-slate-900">{p.name}</div>
                        <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{p.description || `${p.milestones.length} milestones`}</div>
                      </div>
                      {my && <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums" style={{ background: `${my.level.color}1a`, color: my.level.color }}>{my.score}</span>}
                    </div>
                    <FunnelStrip project={p} deliverables={open} />
                    <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                      <span><b className="text-slate-800">{open.length}</b> open</span>
                      <span><b className="text-emerald-600">{won.length}</b> closed</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{p.memberIds.length}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {showCreate && (
          <CreateProjectModal users={clientUsers} onClose={() => setShowCreate(false)} onCreate={async (input) => {
            const p = await P.createProject({ ...input, clientId, createdBy: activeUser.id });
            if (input.targets.count || input.targets.value) {
              for (const uid of input.memberIds) await P.upsertTarget(p, uid, period, input.targets.count, input.targets.value);
            }
            setShowCreate(false);
            await load();
            setProjectId(p.id); setTab("board");
          }} />
        )}
      </div>
    );
  }

  // ── One project ────────────────────────────────────────────────────────────
  const isMember = project.memberIds.includes(activeUser.id);
  const tabs: { id: Tab; label: string; icon: React.ReactNode; show: boolean }[] = [
    { id: "board", label: "Board", icon: <LayoutGrid className="h-4 w-4" />, show: true },
    { id: "score", label: canManage && !isMember ? "Scores" : "My score", icon: <Gauge className="h-4 w-4" />, show: true },
    { id: "team", label: "Team", icon: <Users className="h-4 w-4" />, show: canManage },
    { id: "settings", label: "Settings", icon: <Settings2 className="h-4 w-4" />, show: canManage },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${PROJECT_COLORS[project.color] || PROJECT_COLORS.indigo} p-5 text-white shadow-lg`}>
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => { setProjectId(""); setOpenId(""); }} className="rounded-xl bg-white/15 p-2 hover:bg-white/25 cursor-pointer"><ArrowLeft className="h-5 w-5" /></button>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-white/70">Project{project.status === "archived" ? " · archived" : ""}</div>
              <h1 className="text-xl font-bold">{project.name}</h1>
            </div>
          </div>
          {tab === "board" && (canManage || isMember) && project.status === "active" && (
            <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow hover:bg-white/90 cursor-pointer">
              <Plus className="h-4 w-4" /> New {project.itemLabel.toLowerCase()}
            </button>
          )}
        </div>
        <div className="relative mt-4 flex gap-1 overflow-x-auto">
          {tabs.filter(t => t.show).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-semibold transition cursor-pointer ${tab === t.id ? "bg-white text-slate-900" : "text-white/80 hover:bg-white/15"}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "board" && (
        <Board project={project} deliverables={visibleDeliverables(project.id)} users={clientUsers} canManage={canManage}
          activeUserId={activeUser.id} onOpen={setOpenId} />
      )}
      {tab === "score" && (
        <ScoreView project={project} users={clientUsers} deliverables={deliverables} targets={targets} updates={updates}
          period={period} activeUser={activeUser} canManage={canManage} isMember={isMember} actor={actor}
          onUpdateSaved={load} />
      )}
      {tab === "team" && canManage && (
        <TeamView project={project} users={clientUsers} deliverables={deliverables} targets={targets} updates={updates} period={period} />
      )}
      {tab === "settings" && canManage && (
        <ProjectSettings key={project.id + project.milestones.length} project={project} users={clientUsers}
          deliverables={deliverables} targets={targets} onSaved={load} />
      )}

      {openDeliverable && (
        <DeliverableDrawer project={project} deliverable={openDeliverable} users={clientUsers} actor={actor}
          canManage={canManage} onChanged={replaceDeliverable} onClose={() => setOpenId("")} />
      )}
      {showNew && (
        <NewDeliverableModal project={project} users={clientUsers} canManage={canManage} activeUserId={activeUser.id}
          onClose={() => setShowNew(false)}
          onCreate={async (input) => {
            const d = await P.createDeliverable(project, input, actor);
            replaceDeliverable(d);
            setShowNew(false);
            setOpenId(d.id);
          }} />
      )}
    </div>
  );
}

// ─── Board ─────────────────────────────────────────────────────────────────
function Board({ project, deliverables, users, canManage, activeUserId, onOpen }: {
  project: P.Project; deliverables: P.Deliverable[]; users: User[]; canManage: boolean; activeUserId: string; onOpen: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const filtered = deliverables.filter(d =>
    (!mine || d.ownerUserId === activeUserId) &&
    (!q || `${d.title} ${d.contactName} ${d.contactPhone}`.toLowerCase().includes(q.toLowerCase())));
  const open = filtered.filter(d => d.status === "open");
  const closed = filtered.filter(d => d.status !== "open");
  const userOf = (id: string) => users.find(u => u.id === id);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${project.itemLabel.toLowerCase()}s`}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-400 focus:outline-none" />
        </div>
        {canManage && (
          <div className="flex rounded-xl bg-slate-100 p-0.5 text-xs font-semibold">
            <button onClick={() => setMine(false)} className={`rounded-lg px-3 py-1.5 cursor-pointer ${!mine ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>Everyone</button>
            <button onClick={() => setMine(true)} className={`rounded-lg px-3 py-1.5 cursor-pointer ${mine ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>Mine</button>
          </div>
        )}
        <button onClick={() => setShowClosed(v => !v)} className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 cursor-pointer">
          {showClosed ? "Hide" : "Show"} closed ({closed.length})
        </button>
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
        {project.milestones.map((m, i) => {
          const col = open.filter(d => d.milestoneId === m.id);
          const value = col.reduce((s, d) => s + d.value, 0);
          return (
            <div key={m.id} className="flex w-72 shrink-0 flex-col rounded-2xl bg-slate-100/70 p-2">
              <div className="flex items-center justify-between px-2 pb-2 pt-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">{i + 1}</span>
                  <span className="truncate text-sm font-bold text-slate-800">{m.name}</span>
                  {m.requiresApproval && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">{col.length}</span>
              </div>
              {value > 0 && <div className="-mt-1 px-2 pb-2 text-[11px] font-medium text-slate-500">{P.formatINR(value)}</div>}
              <div className="flex flex-col gap-2">
                {col.map(d => <DeliverableCard key={d.id} d={d} m={m} project={project} owner={userOf(d.ownerUserId)} onOpen={() => onOpen(d.id)} />)}
                {col.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 py-6 text-center text-[11px] text-slate-400">Nothing here</div>}
              </div>
            </div>
          );
        })}
        {showClosed && (
          <div className="flex w-72 shrink-0 flex-col rounded-2xl bg-emerald-50/60 p-2">
            <div className="px-2 pb-2 pt-1 text-sm font-bold text-slate-800">Closed</div>
            <div className="flex flex-col gap-2">
              {closed.map(d => (
                <button key={d.id} onClick={() => onOpen(d.id)} className="rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-200/70 hover:ring-indigo-300 cursor-pointer">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-800">{d.title}</span>
                    {d.status === "won" ? <Trophy className="h-4 w-4 shrink-0 text-emerald-500" /> : <X className="h-4 w-4 shrink-0 text-slate-400" />}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">{d.status === "won" ? "Won" : "Lost"}{d.value ? ` · ${P.formatINR(d.value)}` : ""} · {userOf(d.ownerUserId)?.name || "—"}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DeliverableCard({ d, m, project, owner, onOpen }: { d: P.Deliverable; m: P.Milestone; project: P.Project; owner?: User; onOpen: () => void }) {
  const total = m.checklist.length;
  const done = m.checklist.filter(it => d.checklist[m.id]?.[it.id]?.done).length;
  const pct = total ? done / total : 1;
  const stuck = P.isStuck(d, project);
  const days = P.daysInMilestone(d);
  const approval = d.approvals[m.id]?.status;
  const ready = !P.advanceBlock(d, project);
  const C = 2 * Math.PI * 9;
  return (
    <button onClick={onOpen} className={`rounded-xl bg-white p-3 text-left shadow-sm ring-1 transition hover:shadow-md cursor-pointer ${stuck ? "ring-red-200" : "ring-slate-200/70 hover:ring-indigo-300"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{d.title}</div>
          {d.contactName && <div className="truncate text-[11px] text-slate-500">{d.contactName}</div>}
        </div>
        <svg width="24" height="24" viewBox="0 0 24 24" className="shrink-0 -rotate-90" aria-label={`${done} of ${total} checklist items`}>
          <circle cx="12" cy="12" r="9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
          <circle cx="12" cy="12" r="9" fill="none" stroke={pct >= 1 ? "#10b981" : "#6366f1"} strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${C * pct} ${C}`} />
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {d.value > 0 && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">{P.formatINR(d.value)}</span>}
        {approval === "pending" && <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">Awaiting approval</span>}
        {approval === "rejected" && <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">Sent back</span>}
        {ready && d.status === "open" && <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Ready to move</span>}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {owner && <img src={owner.avatar} alt="" className="h-5 w-5 rounded-full object-cover" />}
          <span className="max-w-[120px] truncate text-[11px] text-slate-500">{owner?.name || "Unassigned"}</span>
        </div>
        <span className={`text-[11px] font-semibold ${stuck ? "text-red-600" : "text-slate-400"}`}>{days}d{stuck ? " · stuck" : ""}</span>
      </div>
    </button>
  );
}

function FunnelStrip({ project, deliverables }: { project: P.Project; deliverables: P.Deliverable[] }) {
  const n = deliverables.length;
  const palette = ["#c7d2fe", "#a5b4fc", "#818cf8", "#6366f1", "#4f46e5", "#4338ca", "#3730a3", "#312e81"];
  return (
    <div className="mt-4">
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
        {n > 0 && project.milestones.map((m, i) => {
          const c = deliverables.filter(d => d.milestoneId === m.id).length;
          return c ? <div key={m.id} title={`${m.name}: ${c}`} style={{ width: `${(c / n) * 100}%`, background: palette[Math.min(i, palette.length - 1)] }} /> : null;
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{project.milestones[0]?.name}</span><span>{project.milestones[project.milestones.length - 1]?.name}</span>
      </div>
    </div>
  );
}

// ─── Score view ────────────────────────────────────────────────────────────
function ScoreView({ project, users, deliverables, targets, updates, period, activeUser, canManage, isMember, actor, onUpdateSaved }: {
  project: P.Project; users: User[]; deliverables: P.Deliverable[]; targets: P.Target[]; updates: P.DailyUpdate[];
  period: { start: string; end: string }; activeUser: User; canManage: boolean; isMember: boolean; actor: P.Actor; onUpdateSaved: () => Promise<void> | void;
}) {
  const members = users.filter(u => project.memberIds.includes(u.id));
  const [userId, setUserId] = useState(isMember ? activeUser.id : members[0]?.id || "");
  const viewing = users.find(u => u.id === userId);
  const own = userId === activeUser.id;
  const today = P.todayStr();
  const todayUpd = updates.find(u => u.projectId === project.id && u.userId === userId && u.day === today);
  const [text, setText] = useState(todayUpd?.text || "");
  const [editingUpd, setEditingUpd] = useState(!todayUpd);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setText(todayUpd?.text || ""); setEditingUpd(!todayUpd); }, [userId, todayUpd?.id, todayUpd?.text]);

  if (!viewing) {
    return <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Add team members in Settings to see scores.</div>;
  }
  const target = targets.find(t => t.projectId === project.id && t.userId === userId && t.periodStart === period.start);
  const s = P.computeScore({ project, userId, deliverables, updates, target, period });
  const monthLabel = new Date(`${period.start}T00:00:00`).toLocaleDateString("en-IN", { month: "long" });
  const recent = updates.filter(u => u.projectId === project.id && u.userId === userId).slice(0, 7);
  const label = project.itemLabel.toLowerCase();

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-bold text-slate-900">{own ? "Your performance score" : `${viewing.name}'s score`}</div>
            {canManage && members.length > 1 && (
              <select value={userId} onChange={e => setUserId(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold focus:outline-none">
                {members.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
          </div>
          <div className="mt-2 flex justify-center"><ScoreGauge score={s.score} caption={`${monthLabel} · updates live`} /></div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Target" value={s.attainment === null ? "—" : `${Math.round(s.attainment * 100)}%`} weight="60%" />
            <Stat label="Daily updates" value={`${Math.round(s.consistency * 100)}%`} weight="20%" />
            <Stat label="On time" value={`${Math.round(s.freshness * 100)}%`} weight="20%" />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="text-sm font-bold text-slate-900">What's shaping the score</div>
          <ul className="mt-3 space-y-2">
            {s.factors.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {f.tone === "good" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  : f.tone === "bad" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  : <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
                <span className="text-slate-700">{f.text}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="text-sm font-bold text-slate-900">{monthLabel} target</div>
          {s.targetCount === null && s.targetValue === null ? (
            <p className="mt-2 text-sm text-slate-500">No target set yet{canManage ? " — add one in Settings." : "."}</p>
          ) : (
            <div className="mt-3 space-y-4">
              {s.targetCount !== null && (
                <TargetBar label={`${label}s`} done={s.wonCount} credited={s.creditedCount} target={s.targetCount} elapsed={s.elapsed} fmt={n => String(Math.round(n * 10) / 10)} />
              )}
              {s.targetValue !== null && (
                <TargetBar label="value" done={s.wonValue} credited={s.creditedValue} target={s.targetValue} elapsed={s.elapsed} fmt={P.formatINR} />
              )}
              <p className="text-[11px] text-slate-400">Dark bar = closed. Light bar = partial credit for {label}s still moving through milestones. The marker shows where you should be today.</p>
            </div>
          )}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Open" value={String(s.openCount)} />
            <Stat label="Closed" value={String(s.wonCount)} />
            <Stat label="Stuck" value={String(s.stuckCount)} bad={s.stuckCount > 0} />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-slate-900">Daily update</div>
            <span className="text-[11px] text-slate-400">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</span>
          </div>
          {own ? (
            editingUpd ? (
              <form className="mt-3 space-y-2" onSubmit={async e => {
                e.preventDefault(); if (!text.trim()) return;
                setSaving(true);
                try { await P.saveDailyUpdate(project, actor, text.trim()); await onUpdateSaved(); setEditingUpd(false); } finally { setSaving(false); }
              }}>
                <textarea rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="e.g. 14 calls, 2 site visits booked for Saturday, 1 proposal sent"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
                <button disabled={saving || !text.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Post update
                </button>
              </form>
            ) : (
              <div className="mt-3 flex items-start justify-between gap-3 rounded-xl bg-emerald-50 px-3 py-2.5">
                <div className="flex items-start gap-2 text-sm text-emerald-900"><Check className="mt-0.5 h-4 w-4 shrink-0" />{todayUpd?.text}</div>
                <button onClick={() => setEditingUpd(true)} className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100 cursor-pointer"><Pencil className="h-3.5 w-3.5" /></button>
              </div>
            )
          ) : (
            <p className="mt-2 text-sm text-slate-500">{todayUpd ? todayUpd.text : "No update posted today."}</p>
          )}
          {recent.filter(u => u.day !== today).length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-slate-100 pt-3">
              {recent.filter(u => u.day !== today).map(u => (
                <li key={u.id} className="flex gap-3 text-sm">
                  <span className="w-14 shrink-0 text-[11px] font-semibold text-slate-400">{new Date(`${u.day}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  <span className="text-slate-700">{u.text}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, weight, bad }: { label: string; value: string; weight?: string; bad?: boolean }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-2 py-2.5">
      <div className={`text-lg font-bold tabular-nums ${bad ? "text-red-600" : "text-slate-900"}`}>{value}</div>
      <div className="text-[11px] font-medium text-slate-500">{label}{weight && <span className="text-slate-400"> · {weight}</span>}</div>
    </div>
  );
}

function TargetBar({ label, done, credited, target, elapsed, fmt }: {
  label: string; done: number; credited: number; target: number; elapsed: number; fmt: (n: number) => string;
}) {
  const pDone = Math.min(1, done / target);
  const pCred = Math.min(1, credited / target);
  // Inline colours: index.css re-skins several bg-* utilities with brand gradients.
  const tone = pCred + 0.05 >= elapsed ? "#16a34a" : pCred >= elapsed * 0.6 ? "#f59e0b" : "#dc2626";
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-semibold capitalize text-slate-700">{label}</span>
        <span className="text-slate-500"><b className="text-slate-900">{fmt(done)}</b> closed of {fmt(target)}</span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
        <div className="absolute inset-y-0 left-0 opacity-30" style={{ width: `${pCred * 100}%`, background: tone }} />
        <div className="absolute inset-y-0 left-0" style={{ width: `${pDone * 100}%`, background: tone, transition: "width 600ms" }} />
        <div className="absolute inset-y-0 w-0.5 bg-slate-900" style={{ left: `${elapsed * 100}%` }} title="Where you should be today" />
      </div>
    </div>
  );
}

// ─── Team view ─────────────────────────────────────────────────────────────
function TeamView({ project, users, deliverables, targets, updates, period }: {
  project: P.Project; users: User[]; deliverables: P.Deliverable[]; targets: P.Target[]; updates: P.DailyUpdate[]; period: { start: string; end: string };
}) {
  const today = P.todayStr();
  const rows = users.filter(u => project.memberIds.includes(u.id)).map(u => ({
    u,
    s: P.computeScore({ project, userId: u.id, deliverables, updates, period,
      target: targets.find(t => t.projectId === project.id && t.userId === u.id && t.periodStart === period.start) }),
    updatedToday: updates.some(x => x.projectId === project.id && x.userId === u.id && x.day === today),
  })).sort((a, b) => b.s.score - a.s.score);

  const pd = deliverables.filter(d => d.projectId === project.id);
  const reached = project.milestones.map((m, i) => pd.filter(d => d.status === "won"
    || (project.milestones.findIndex(x => x.id === d.milestoneId) >= i && d.status === "open")).length);
  const max = Math.max(1, reached[0] || 0, ...reached);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="text-sm font-bold text-slate-900">Leaderboard</div>
        {rows.length === 0 && <p className="mt-2 text-sm text-slate-500">No members yet — add them in Settings.</p>}
        <ol className="mt-3 divide-y divide-slate-100">
          {rows.map(({ u, s, updatedToday }, i) => (
            <li key={u.id} className="flex items-center gap-3 py-2.5">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{i + 1}</span>
              <img src={u.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-800">{u.name}</div>
                <div className="text-[11px] text-slate-500">
                  {s.wonCount} closed{s.wonValue ? ` · ${P.formatINR(s.wonValue)}` : ""} · {s.openCount} open
                  {s.stuckCount > 0 && <span className="text-red-500"> · {s.stuckCount} stuck</span>}
                </div>
              </div>
              <span title={updatedToday ? "Posted today's update" : "No update today"}
                className={`h-2 w-2 shrink-0 rounded-full ${updatedToday ? "bg-emerald-500" : "bg-slate-300"}`} />
              <div className="w-24 shrink-0">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${((s.score - 300) / 600) * 100}%`, background: s.level.color }} />
                </div>
              </div>
              <span className="w-10 shrink-0 text-right text-sm font-bold tabular-nums" style={{ color: s.level.color }}>{s.score}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="text-sm font-bold text-slate-900">Funnel</div>
        <p className="text-[11px] text-slate-500">How many {project.itemLabel.toLowerCase()}s reached each milestone.</p>
        <div className="mt-4 space-y-2">
          {project.milestones.map((m, i) => (
            <div key={m.id}>
              <div className="mb-0.5 flex justify-between text-xs">
                <span className="font-medium text-slate-700">{m.name}</span>
                <span className="text-slate-500">{reached[i]}{i > 0 && reached[i - 1] ? ` · ${Math.round((reached[i] / reached[i - 1]) * 100)}%` : ""}</span>
              </div>
              <div className="h-5 rounded-lg bg-slate-50">
                <div className="h-full rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${(reached[i] / max) * 100}%`, minWidth: reached[i] ? 6 : 0 }} />
              </div>
            </div>
          ))}
          <div className="flex justify-between pt-1 text-xs font-semibold text-emerald-700">
            <span>Closed (won)</span><span>{pd.filter(d => d.status === "won").length}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Modals ────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`} onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 cursor-pointer"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none";

function CreateProjectModal({ users, onClose, onCreate }: {
  users: User[]; onClose: () => void;
  onCreate: (input: { name: string; description: string; itemLabel: string; color: string; milestones: P.Milestone[]; memberIds: string[]; targets: { count: number | null; value: number | null } }) => Promise<void>;
}) {
  const [tplId, setTplId] = useState(P.PROJECT_TEMPLATES[0].id);
  const tpl = P.PROJECT_TEMPLATES.find(t => t.id === tplId)!;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [itemLabel, setItemLabel] = useState(tpl.itemLabel);
  const [color, setColor] = useState("indigo");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [tCount, setTCount] = useState("");
  const [tValue, setTValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  return (
    <Modal title="New project" onClose={onClose} wide>
      <form className="space-y-5" onSubmit={async e => {
        e.preventDefault();
        if (!name.trim()) { setErr("Give the project a name."); return; }
        setBusy(true); setErr("");
        try {
          await onCreate({ name: name.trim(), description: description.trim(), itemLabel: itemLabel.trim() || "Deliverable", color,
            milestones: P.milestonesFromTemplate(tpl), memberIds,
            targets: { count: tCount ? Math.round(Number(tCount)) : null, value: tValue ? Number(tValue) : null } });
        } catch (e: any) { setErr(e?.message || "Could not create the project."); setBusy(false); }
      }}>
        {err && <div className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{err}</div>}
        <div>
          <div className="mb-2 text-xs font-semibold text-slate-500">Start from a template</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {P.PROJECT_TEMPLATES.map(t => (
              <button type="button" key={t.id} onClick={() => { setTplId(t.id); setItemLabel(t.itemLabel); }}
                className={`rounded-2xl border p-3 text-left transition cursor-pointer ${tplId === t.id ? "border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500" : "border-slate-200 hover:border-slate-300"}`}>
                <div className="text-sm font-bold text-slate-900">{t.name}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">{t.blurb}</div>
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
            {tpl.milestones.map((m, i) => (
              <React.Fragment key={i}>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{m.name}</span>
                {i < tpl.milestones.length - 1 && <span className="text-slate-300">→</span>}
              </React.Fragment>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">You can rename, reorder and add milestones and checklists afterwards in Settings.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1"><span className="text-xs font-semibold text-slate-500">Project name</span>
            <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Whitefield Villas — Q4" autoFocus /></label>
          <label className="space-y-1"><span className="text-xs font-semibold text-slate-500">Call each item a…</span>
            <input className={inputCls} value={itemLabel} onChange={e => setItemLabel(e.target.value)} placeholder="Deliverable, Lead, Deal…" /></label>
        </div>
        <label className="block space-y-1"><span className="text-xs font-semibold text-slate-500">Description (optional)</span>
          <input className={inputCls} value={description} onChange={e => setDescription(e.target.value)} /></label>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Colour</span>
          {Object.entries(PROJECT_COLORS).map(([k, g]) => (
            <button type="button" key={k} onClick={() => setColor(k)} className={`h-6 w-6 rounded-full bg-gradient-to-br ${g} cursor-pointer ${color === k ? "ring-2 ring-offset-2 ring-slate-900" : ""}`} />
          ))}
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold text-slate-500">Team members</div>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-2xl border border-slate-200 p-2">
            {users.map(u => (
              <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={memberIds.includes(u.id)}
                  onChange={e => setMemberIds(ids => e.target.checked ? [...ids, u.id] : ids.filter(x => x !== u.id))} />
                <img src={u.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                <span className="text-sm text-slate-800">{u.name}</span>
                <span className="text-[11px] text-slate-400">{u.role}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold text-slate-500">Monthly target per member (optional — fine-tune per person in Settings)</div>
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} type="number" min={0} value={tCount} onChange={e => setTCount(e.target.value)} placeholder={`# of ${itemLabel.toLowerCase() || "item"}s`} />
            <input className={inputCls} type="number" min={0} value={tValue} onChange={e => setTValue(e.target.value)} placeholder="₹ value" />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancel</button>
          <button disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 cursor-pointer">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create project
          </button>
        </div>
      </form>
    </Modal>
  );
}

function NewDeliverableModal({ project, users, canManage, activeUserId, onClose, onCreate }: {
  project: P.Project; users: User[]; canManage: boolean; activeUserId: string; onClose: () => void;
  onCreate: (input: { title: string; contactName: string; contactPhone: string; value: number; ownerUserId: string; notes: string }) => Promise<void>;
}) {
  const members = users.filter(u => project.memberIds.includes(u.id));
  const [title, setTitle] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [value, setValue] = useState("");
  const [ownerUserId, setOwnerUserId] = useState(project.memberIds.includes(activeUserId) ? activeUserId : members[0]?.id || activeUserId);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const label = project.itemLabel;

  return (
    <Modal title={`New ${label.toLowerCase()}`} onClose={onClose}>
      <form className="space-y-3" onSubmit={async e => {
        e.preventDefault();
        if (!title.trim()) { setErr("Add a title."); return; }
        setBusy(true); setErr("");
        try { await onCreate({ title: title.trim(), contactName: contactName.trim(), contactPhone: contactPhone.trim(), value: Number(value) || 0, ownerUserId, notes: notes.trim() }); }
        catch (e: any) { setErr(e?.message || "Could not save."); setBusy(false); }
      }}>
        {err && <div className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{err}</div>}
        <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} placeholder={`${label} title, e.g. 3BHK enquiry — Mr. Rao`} autoFocus />
        <div className="grid grid-cols-2 gap-2">
          <input className={inputCls} value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Contact name" />
          <input className={inputCls} value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="Phone" inputMode="tel" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className={inputCls} type="number" min={0} value={value} onChange={e => setValue(e.target.value)} placeholder="Expected value ₹" />
          <select className={inputCls} value={ownerUserId} disabled={!canManage} onChange={e => setOwnerUserId(e.target.value)}>
            {(members.length ? members : users.filter(u => u.id === activeUserId)).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <textarea className={inputCls} rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" />
        <p className="text-[11px] text-slate-400">Starts at “{project.milestones[0]?.name}”.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancel</button>
          <button disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 cursor-pointer">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Add {label.toLowerCase()}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MigrationHint({ message }: { message: string }) {
  const missing = /relation .*projects.* does not exist|Could not find the table/i.test(message);
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {missing ? "Projects isn't set up on the database yet — the projects migration needs to be applied." : message}
    </div>
  );
}
