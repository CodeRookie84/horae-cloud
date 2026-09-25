/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ProjectSettings — client-admin editor for a project: steps (rename,
 * reorder, time limit, approval, required uploads/entries), members (each works
 * through every step) and managers (can see everyone's progress and approve).
 */
import React, { useState } from "react";
import { ArrowUp, ArrowDown, Plus, Trash2, ShieldCheck, Save, Loader2, Archive, ArchiveRestore } from "lucide-react";
import type { User } from "../../types";
import * as P from "../../services/projectsService";

const TYPE_LABELS: Record<P.ChecklistItemType, string> = {
  tick: "Tick", number: "Number", amount: "Amount ₹", text: "Text", date: "Date", file: "Photo / file",
};
export const PROJECT_COLORS: Record<string, string> = {
  indigo: "from-indigo-500 to-violet-500", emerald: "from-emerald-500 to-teal-500",
  amber: "from-amber-500 to-orange-500", rose: "from-rose-500 to-pink-500",
  sky: "from-sky-500 to-cyan-500", slate: "from-slate-600 to-slate-800",
};

interface Props {
  project: P.Project;
  users: User[];
  runs: P.Deliverable[];
  onSaved: () => void;
}

export default function ProjectSettings({ project, users, runs, onSaved }: Props) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [color, setColor] = useState(project.color);
  const [milestones, setMilestones] = useState<P.Milestone[]>(project.milestones);
  const [memberIds, setMemberIds] = useState<string[]>(project.memberIds);
  const [managerIds, setManagerIds] = useState<string[]>(project.managerIds);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const inUse = (mid: string) => runs.some(d => d.projectId === project.id && d.milestoneId === mid && d.status === "open");

  const patchM = (i: number, patch: Partial<P.Milestone>) => setMilestones(ms => ms.map((m, j) => j === i ? { ...m, ...patch } : m));
  const move = (i: number, dir: -1 | 1) => setMilestones(ms => {
    const j = i + dir; if (j < 0 || j >= ms.length) return ms;
    const next = [...ms]; [next[i], next[j]] = [next[j], next[i]]; return next;
  });
  const patchItem = (i: number, k: number, patch: Partial<P.MilestoneChecklistItem>) =>
    patchM(i, { checklist: milestones[i].checklist.map((it, j) => j === k ? { ...it, ...patch } : it) });

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      const cleaned = milestones.map(m => ({ ...m, name: m.name.trim() || "Untitled", checklist: m.checklist.filter(it => it.text.trim()) }));
      await P.updateProject(project.id, { name: name.trim() || project.name, description, color, milestones: cleaned, memberIds, managerIds });
      setMsg("Saved.");
      onSaved();
    } catch (e: any) {
      setMsg(e?.message || "Could not save.");
    } finally { setSaving(false); }
  };

  const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none";

  return (
    <div className="space-y-6">
      {/* Basics */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-bold text-slate-900">Project</h3>
        <label className="mt-3 block space-y-1"><span className="text-xs font-semibold text-slate-500">Name</span>
          <input className={input} value={name} onChange={e => setName(e.target.value)} /></label>
        <label className="mt-3 block space-y-1"><span className="text-xs font-semibold text-slate-500">Description</span>
          <textarea className={input} rows={2} value={description} onChange={e => setDescription(e.target.value)} /></label>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Colour</span>
          {Object.entries(PROJECT_COLORS).map(([k, g]) => (
            <button key={k} onClick={() => setColor(k)} className={`h-6 w-6 rounded-full bg-gradient-to-br ${g} cursor-pointer ${color === k ? "ring-2 ring-offset-2 ring-slate-900" : ""}`} />
          ))}
        </div>
      </section>

      {/* Milestones */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Steps</h3>
            <p className="text-xs text-slate-500">Every member works through these in order. Required items must be done before a step can be completed.</p>
          </div>
          <button onClick={() => setMilestones(ms => [...ms, P.newMilestone(`Step ${ms.length + 1}`)])}
            className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 cursor-pointer"><Plus className="h-3.5 w-3.5" /> Add step</button>
        </div>

        <div className="mt-4 space-y-3">
          {milestones.map((m, i) => (
            <div key={m.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{i + 1}</span>
                <input className="min-w-[160px] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold focus:outline-none focus:border-indigo-400"
                  value={m.name} onChange={e => patchM(i, { name: e.target.value })} />
                <label className="flex items-center gap-1 text-xs text-slate-600">Limit
                  <input type="number" min={1} className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none"
                    value={m.slaDays} onChange={e => patchM(i, { slaDays: Math.max(1, Number(e.target.value) || 1) })} />d</label>
                <label className={`flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${m.requiresApproval ? "bg-amber-100 text-amber-800" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>
                  <input type="checkbox" className="hidden" checked={m.requiresApproval} onChange={e => patchM(i, { requiresApproval: e.target.checked })} />
                  <ShieldCheck className="h-3.5 w-3.5" /> Approval
                </label>
                <div className="flex items-center">
                  <IconBtn disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></IconBtn>
                  <IconBtn disabled={i === milestones.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></IconBtn>
                  <IconBtn disabled={milestones.length <= 1 || inUse(m.id)} title={inUse(m.id) ? "Members are on this step — move them first" : "Remove"}
                    onClick={() => setMilestones(ms => ms.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                </div>
              </div>

              <div className="mt-2 space-y-1.5 pl-9">
                {m.checklist.map((it, k) => (
                  <div key={it.id} className="flex flex-wrap items-center gap-1.5">
                    <input className="min-w-[140px] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-400"
                      placeholder="Required item, e.g. Site photo" value={it.text} onChange={e => patchItem(i, k, { text: e.target.value })} />
                    <select className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none" value={it.type}
                      onChange={e => patchItem(i, k, { type: e.target.value as P.ChecklistItemType })}>
                      {Object.entries(TYPE_LABELS).map(([k2, l]) => <option key={k2} value={k2}>{l}</option>)}
                    </select>
                    <label className="flex items-center gap-1 text-[11px] text-slate-600">
                      <input type="checkbox" checked={it.required} onChange={e => patchItem(i, k, { required: e.target.checked })} className="accent-indigo-600" /> Required
                    </label>
                    <IconBtn onClick={() => patchM(i, { checklist: m.checklist.filter((_, j) => j !== k) })}><Trash2 className="h-3 w-3" /></IconBtn>
                  </div>
                ))}
                <button onClick={() => patchM(i, { checklist: [...m.checklist, P.newChecklistItem()] })}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"><Plus className="h-3 w-3" /> Add item</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Members */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-bold text-slate-900">Members</h3>
        <p className="text-xs text-slate-500">Each member gets their own copy of the steps and sees only their own progress.</p>
        <UserPicker users={users} selected={memberIds} onChange={setMemberIds} />
      </section>

      {/* Managers */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-bold text-slate-900">Managers</h3>
        <p className="text-xs text-slate-500">Can see every member's progress and approve steps. Client admins always can.</p>
        <UserPicker users={users.filter(u => !P.isProjectAdmin(u))} selected={managerIds} onChange={setManagerIds} />
      </section>

      <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <button onClick={async () => { await P.updateProject(project.id, { status: project.status === "archived" ? "active" : "archived" }); onSaved(); }}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">
          {project.status === "archived" ? <><ArchiveRestore className="h-4 w-4" /> Restore project</> : <><Archive className="h-4 w-4" /> Archive project</>}
        </button>
        <div className="flex items-center gap-3">
          {msg && <span className="text-xs font-medium text-slate-500">{msg}</span>}
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 cursor-pointer">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

export function UserPicker({ users, selected, onChange }: { users: User[]; selected: string[]; onChange: (ids: string[]) => void }) {
  return (
    <div className="mt-3 max-h-60 space-y-1 overflow-y-auto rounded-2xl border border-slate-200 p-2">
      {users.map(u => (
        <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
          <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={selected.includes(u.id)}
            onChange={e => onChange(e.target.checked ? [...selected, u.id] : selected.filter(x => x !== u.id))} />
          <img src={u.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
          <span className="text-sm text-slate-800">{u.name}</span>
          <span className="text-[11px] text-slate-400">{u.role}</span>
        </label>
      ))}
      {users.length === 0 && <div className="px-2 py-1.5 text-xs text-slate-400">No one to add.</div>}
    </div>
  );
}

function IconBtn({ children, onClick, disabled, title }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick}
      className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed">
      {children}
    </button>
  );
}
