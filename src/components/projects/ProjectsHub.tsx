/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ProjectsHub — the Projects module. The client admin creates a project with
 * ordered steps and assigns members; every member works through ALL the steps
 * on their own, shown as a 0–100 half-circle gauge (one segment per step,
 * red → green).
 *
 * Views:
 *   • My progress — the member's own run (StepRun): uploads, updates, complete step.
 *   • Team        — admin + the project's authorised managers: every member's
 *                   progress, pending approvals, overdue steps; open anyone's run.
 *   • Settings    — client admin only: steps, members, managers.
 * Members see only their own progress.
 */
import React, { useEffect, useState } from "react";
import {
  ArrowLeft, Plus, FolderKanban, Loader2, ShieldCheck, AlertTriangle, X, Users, Settings2, User as UserIcon, Trophy,
} from "lucide-react";
import type { User } from "../../types";
import * as P from "../../services/projectsService";
import StepGauge from "./StepGauge";
import { StepRun, StepRunDrawer } from "./StepRun";
import ProjectSettings, { PROJECT_COLORS, UserPicker } from "./ProjectSettings";

interface Props {
  activeUser: User;
  clientId: string;
  clientUsers: User[];
  onBack?: () => void;
}

type Tab = "mine" | "team" | "settings";

export default function ProjectsHub({ activeUser, clientId, clientUsers, onBack }: Props) {
  const isAdmin = P.isProjectAdmin(activeUser);
  const actor: P.Actor = { id: activeUser.id, name: activeUser.name };

  const [projects, setProjects] = useState<P.Project[]>([]);
  const [runs, setRuns] = useState<P.Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");

  const [projectId, setProjectId] = useState<string>("");
  const [tab, setTab] = useState<Tab>("mine");
  const [openRunId, setOpenRunId] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const load = async () => {
    setLoadErr("");
    try {
      const ps = await P.getProjects(clientId);
      const rs = await P.getDeliverables(ps.map(p => p.id));
      // Every member needs a run; create any missing ones this user may write.
      const created = await P.ensureMemberRuns(ps, rs, clientUsers,
        { all: p => P.canManageProject(activeUser, p), self: activeUser.id }).catch(() => []);
      setProjects(ps); setRuns([...rs, ...created]);
    } catch (e: any) {
      setLoadErr(e?.message || "Could not load projects.");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [clientId]);

  const replaceRun = (d: P.Deliverable) => setRuns(rs => rs.map(x => x.id === d.id ? d : x));
  const userOf = (id: string) => clientUsers.find(u => u.id === id);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const visible = projects.filter(p => isAdmin || p.memberIds.includes(activeUser.id) || p.managerIds.includes(activeUser.id));
  const project = visible.find(p => p.id === projectId);

  // ── Project list ───────────────────────────────────────────────────────────
  if (!project) {
    const list = visible.filter(p => showArchived ? p.status === "archived" : p.status === "active");
    return (
      <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBack && <button onClick={onBack} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 cursor-pointer"><ArrowLeft className="h-5 w-5" /></button>}
            <div>
              <h1 className="text-xl font-bold text-slate-900">Projects</h1>
              <p className="text-xs text-slate-500">{isAdmin ? "Create step-by-step projects and track each member's progress." : "Your projects and the steps to complete."}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && projects.some(p => p.status === "archived") && (
              <button onClick={() => setShowArchived(v => !v)} className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 cursor-pointer">
                {showArchived ? "Show active" : "Show archived"}
              </button>
            )}
            {isAdmin && (
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
            <div className="mt-3 text-sm font-semibold text-slate-700">{isAdmin ? "No projects yet" : "You haven't been added to a project yet"}</div>
            <p className="mt-1 text-xs text-slate-500">{isAdmin ? "Pick a template or start blank, set the steps, and assign members." : "Your admin will add you when there's a project for you."}</p>
            {isAdmin && <button onClick={() => setShowCreate(true)} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 cursor-pointer">Create a project</button>}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map(p => {
              const isMember = p.memberIds.includes(activeUser.id);
              const manages = P.canManageProject(activeUser, p);
              const mine = P.runFor(runs, p.id, activeUser.id);
              const team = teamStats(p, runs);
              const myIdx = P.currentStepIndex(mine, p);
              return (
                <button key={p.id} onClick={() => { setProjectId(p.id); setTab(isMember ? "mine" : "team"); }}
                  className="group overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg cursor-pointer">
                  <div className={`h-2 bg-gradient-to-r ${PROJECT_COLORS[p.color] || PROJECT_COLORS.indigo}`} />
                  <div className="p-5">
                    <div className="truncate text-base font-bold text-slate-900">{p.name}</div>
                    <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{p.description || `${p.milestones.length} steps`}</div>
                    {isMember ? (
                      <div className="mt-3 flex items-center gap-3">
                        <StepGauge value={P.stepProgress(mine, p)} steps={p.milestones.length} size={110} compact />
                        <div className="min-w-0 text-xs">
                          <div className="font-semibold text-slate-800">
                            {mine?.status === "won" ? "All steps done" : `Step ${myIdx + 1} of ${p.milestones.length}`}
                          </div>
                          <div className="truncate text-slate-500">{mine?.status === "won" ? "Completed" : p.milestones[myIdx]?.name}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4">
                        <ProgressBar pct={team.avg} />
                        <div className="mt-1 text-[11px] text-slate-500">Team average {team.avg}%</div>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{p.memberIds.length} members</span>
                      {manages && <span><b className="text-emerald-600">{team.completed}</b> completed</span>}
                      {manages && team.pending > 0 && <span className="font-semibold text-amber-600">{team.pending} awaiting approval</span>}
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
            setShowCreate(false);
            await load();
            setProjectId(p.id); setTab("team");
          }} />
        )}
      </div>
    );
  }

  // ── One project ────────────────────────────────────────────────────────────
  const isMember = project.memberIds.includes(activeUser.id);
  const manages = P.canManageProject(activeUser, project);
  const tabs: { id: Tab; label: string; icon: React.ReactNode; show: boolean }[] = [
    { id: "mine", label: "My progress", icon: <UserIcon className="h-4 w-4" />, show: isMember },
    { id: "team", label: "Team", icon: <Users className="h-4 w-4" />, show: manages },
    { id: "settings", label: "Settings", icon: <Settings2 className="h-4 w-4" />, show: isAdmin },
  ];
  const activeTab = tabs.find(t => t.id === tab && t.show)?.id || tabs.find(t => t.show)?.id || "mine";
  const myRun = P.runFor(runs, project.id, activeUser.id);
  const openRun = runs.find(r => r.id === openRunId);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${PROJECT_COLORS[project.color] || PROJECT_COLORS.indigo} p-5 text-white shadow-lg`}>
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <button onClick={() => { setProjectId(""); setOpenRunId(""); }} className="rounded-xl bg-white/15 p-2 hover:bg-white/25 cursor-pointer"><ArrowLeft className="h-5 w-5" /></button>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/70">Project{project.status === "archived" ? " · archived" : ""} · {project.milestones.length} steps</div>
            <h1 className="truncate text-xl font-bold">{project.name}</h1>
            {project.description && <p className="mt-0.5 line-clamp-2 text-xs text-white/80">{project.description}</p>}
          </div>
        </div>
        {tabs.filter(t => t.show).length > 1 && (
          <div className="relative mt-4 flex gap-1 overflow-x-auto">
            {tabs.filter(t => t.show).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-semibold transition cursor-pointer ${activeTab === t.id ? "bg-white text-slate-900" : "text-white/80 hover:bg-white/15"}`}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeTab === "mine" && (myRun
        ? <StepRun project={project} run={myRun} owner={activeUser} actor={actor} canManage={manages} onChanged={replaceRun} />
        : <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            {project.milestones.length ? "Setting up your steps… refresh in a moment." : "This project has no steps yet."}
          </div>)}
      {activeTab === "team" && (
        <TeamView project={project} runs={runs} users={clientUsers} onOpen={setOpenRunId} />
      )}
      {activeTab === "settings" && (
        <ProjectSettings key={project.id + project.milestones.length} project={project} users={clientUsers} runs={runs} onSaved={load} />
      )}

      {openRun && (
        <StepRunDrawer project={project} run={openRun} owner={userOf(openRun.ownerUserId)} actor={actor}
          canManage={manages} onChanged={replaceRun} onClose={() => setOpenRunId("")} />
      )}
    </div>
  );
}

// ─── Team view ─────────────────────────────────────────────────────────────
function teamStats(p: P.Project, runs: P.Deliverable[]) {
  const rs = p.memberIds.map(id => P.runFor(runs, p.id, id)).filter(Boolean) as P.Deliverable[];
  const pcts = p.memberIds.map(id => P.stepProgress(P.runFor(runs, p.id, id), p));
  return {
    avg: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0,
    completed: rs.filter(r => r.status === "won").length,
    pending: rs.filter(r => r.status === "open" && r.approvals[r.milestoneId]?.status === "pending").length,
    overdue: rs.filter(r => P.isOverdue(r, p)).length,
  };
}

function TeamView({ project, runs, users, onOpen }: {
  project: P.Project; runs: P.Deliverable[]; users: User[]; onOpen: (runId: string) => void;
}) {
  const s = teamStats(project, runs);
  const rows = project.memberIds.map(id => {
    const run = P.runFor(runs, project.id, id);
    return { u: users.find(x => x.id === id), run, pct: P.stepProgress(run, project) };
  }).filter(r => r.u && r.run) as { u: User; run: P.Deliverable; pct: number }[];
  // Needs-action first (awaiting approval, then overdue), then least progress.
  const rank = (r: typeof rows[number]) =>
    r.run.status === "open" && r.run.approvals[r.run.milestoneId]?.status === "pending" ? 0 : P.isOverdue(r.run, project) ? 1 : 2;
  rows.sort((a, b) => rank(a) - rank(b) || a.pct - b.pct);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Team average" value={`${s.avg}%`} color={P.progressColor(s.avg)} />
        <Stat label="Completed" value={`${s.completed}/${project.memberIds.length}`} />
        <Stat label="Awaiting approval" value={String(s.pending)} color={s.pending ? "#d97706" : undefined} />
        <Stat label="Overdue" value={String(s.overdue)} color={s.overdue ? "#dc2626" : undefined} />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-2 sm:p-3">
        {rows.length === 0 && <p className="p-4 text-sm text-slate-500">No members yet{project.memberIds.length ? "." : " — add them in Settings."}</p>}
        <ul className="divide-y divide-slate-100">
          {rows.map(({ u, run, pct }) => {
            const idx = P.currentStepIndex(run, project);
            const pending = run.status === "open" && run.approvals[run.milestoneId]?.status === "pending";
            const overdue = P.isOverdue(run, project);
            return (
              <li key={u.id}>
                <button onClick={() => onOpen(run.id)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left hover:bg-slate-50 cursor-pointer">
                  <img src={u.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-slate-800">{u.name}</span>
                      {pending && <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"><ShieldCheck className="h-3 w-3" /> Approve</span>}
                      {overdue && <span className="inline-flex items-center gap-0.5 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600"><AlertTriangle className="h-3 w-3" /> Overdue</span>}
                      {run.status === "won" && <Trophy className="h-3.5 w-3.5 text-emerald-500" />}
                    </div>
                    <div className="truncate text-[11px] text-slate-500">
                      {run.status === "won" ? "All steps completed" : `Step ${idx + 1} of ${project.milestones.length} · ${project.milestones[idx]?.name || ""}`}
                    </div>
                    <div className="mt-1.5"><ProgressBar pct={pct} steps={project.milestones.length} /></div>
                  </div>
                  <span className="w-12 shrink-0 text-right text-sm font-bold tabular-nums" style={{ color: P.progressColor(pct) }}>{pct}%</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** Thin bar version of the gauge, with step dividers. */
function ProgressBar({ pct, steps = 0 }: { pct: number; steps?: number }) {
  return (
    <div className="relative h-2 overflow-hidden rounded-full bg-slate-100">
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: P.progressColor(pct), transition: "width 600ms" }} />
      {Array.from({ length: Math.max(0, steps - 1) }, (_, i) => (
        <div key={i} className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `${((i + 1) / steps) * 100}%` }} />
      ))}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
      <div className="text-xl font-bold tabular-nums" style={{ color: color || "#0f172a" }}>{value}</div>
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
    </div>
  );
}

// ─── Create project ────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-3xl" onClick={e => e.stopPropagation()}>
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
  onCreate: (input: { name: string; description: string; color: string; milestones: P.Milestone[]; memberIds: string[]; managerIds: string[] }) => Promise<void>;
}) {
  const [tplId, setTplId] = useState(P.PROJECT_TEMPLATES[0].id);
  const tpl = P.PROJECT_TEMPLATES.find(t => t.id === tplId)!;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("indigo");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [managerIds, setManagerIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  return (
    <Modal title="New project" onClose={onClose}>
      <form className="space-y-5" onSubmit={async e => {
        e.preventDefault();
        if (!name.trim()) { setErr("Give the project a name."); return; }
        if (!memberIds.length) { setErr("Assign at least one member."); return; }
        setBusy(true); setErr("");
        try {
          await onCreate({ name: name.trim(), description: description.trim(), color,
            milestones: P.milestonesFromTemplate(tpl), memberIds, managerIds });
        } catch (e: any) { setErr(e?.message || "Could not create the project."); setBusy(false); }
      }}>
        {err && <div className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{err}</div>}
        <div>
          <div className="mb-2 text-xs font-semibold text-slate-500">Start from a template</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {P.PROJECT_TEMPLATES.map(t => (
              <button type="button" key={t.id} onClick={() => setTplId(t.id)}
                className={`rounded-2xl border p-3 text-left transition cursor-pointer ${tplId === t.id ? "border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500" : "border-slate-200 hover:border-slate-300"}`}>
                <div className="text-sm font-bold text-slate-900">{t.name}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">{t.blurb}</div>
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
            {tpl.milestones.map((m, i) => (
              <React.Fragment key={i}>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{i + 1}. {m.name}</span>
                {i < tpl.milestones.length - 1 && <span className="text-slate-300">→</span>}
              </React.Fragment>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">You can rename, reorder and add steps and required uploads afterwards in Settings.</p>
        </div>

        <label className="block space-y-1"><span className="text-xs font-semibold text-slate-500">Project name</span>
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Whitefield outlet opening" autoFocus /></label>
        <label className="block space-y-1"><span className="text-xs font-semibold text-slate-500">Description (optional)</span>
          <input className={inputCls} value={description} onChange={e => setDescription(e.target.value)} /></label>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Colour</span>
          {Object.entries(PROJECT_COLORS).map(([k, g]) => (
            <button type="button" key={k} onClick={() => setColor(k)} className={`h-6 w-6 rounded-full bg-gradient-to-br ${g} cursor-pointer ${color === k ? "ring-2 ring-offset-2 ring-slate-900" : ""}`} />
          ))}
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-500">Members — each works through all the steps</div>
          <UserPicker users={users} selected={memberIds} onChange={setMemberIds} />
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500">Managers (optional) — can see everyone's progress and approve steps</div>
          <UserPicker users={users.filter(u => !P.isProjectAdmin(u))} selected={managerIds} onChange={setManagerIds} />
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

function MigrationHint({ message }: { message: string }) {
  const missing = /relation .*projects.* does not exist|Could not find the table|manager_ids/i.test(message);
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {missing ? "Projects isn't set up on the database yet — the projects migrations need to be applied." : message}
    </div>
  );
}
