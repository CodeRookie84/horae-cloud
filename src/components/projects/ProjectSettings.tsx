/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ProjectSettings — client-admin editor for a project: steps (rename,
 * reorder, time limit, approval, required uploads/entries), members (each works
 * through every step) and managers (can see everyone's progress and approve).
 * The steps can be saved as a new template; the project can be deleted.
 */
import React, { useState } from "react";
import { ArrowUp, ArrowDown, Plus, Trash2, ShieldCheck, Save, Loader2, Archive, ArchiveRestore, BookmarkPlus } from "lucide-react";
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
  /** Asks for confirmation, then deletes the project. */
  onDelete: () => void;
  /** Saves the given steps as a new template for this client. */
  onSaveTemplate: (name: string, milestones: P.Milestone[], itemLabel: string) => Promise<unknown>;
}

export default function ProjectSettings({ project, users, runs, onSaved, onDelete, onSaveTemplate }: Props) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [itemLabel, setItemLabel] = useState(project.itemLabel);
  const isPipeline = project.kind === "pipeline";
  const [color, setColor] = useState(project.color);
  const [milestones, setMilestones] = useState<P.Milestone[]>(project.milestones);
  const [memberIds, setMemberIds] = useState<string[]>(project.memberIds);
  const [managerIds, setManagerIds] = useState<string[]>(project.managerIds);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [tplName, setTplName] = useState("");
  const [tplBusy, setTplBusy] = useState(false);
  const [tplMsg, setTplMsg] = useState("");

  const cleanSteps = () => milestones.map(m => ({ ...m, name: m.name.trim() || "Untitled", checklist: m.checklist.filter(it => it.text.trim()) }));

  const saveAsTemplate = async () => {
    if (!tplName.trim()) { setTplMsg("Name the new template."); return; }
    setTplBusy(true); setTplMsg("");
    try {
      await onSaveTemplate(tplName.trim(), cleanSteps(), itemLabel.trim() || project.itemLabel);
      setTplMsg(`Saved as template “${tplName.trim()}” — pick it next time you create a project.`); setTplName("");
    } catch (e: any) { setTplMsg(e?.message || "Could not save the template."); }
    finally { setTplBusy(false); }
  };

  const inUse = (mid: string) => runs.some(d => d.projectId === project.id && d.milestoneId === mid && d.status === "open");

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      const cleaned = cleanSteps();
      await P.updateProject(project.id, { name: name.trim() || project.name, description, color, ...(isPipeline ? { itemLabel: itemLabel.trim() || project.itemLabel } : {}), milestones: cleaned, memberIds, managerIds });
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
        {isPipeline && (
          <label className="mt-3 block space-y-1"><span className="text-xs font-semibold text-slate-500">What each item is called</span>
            <input className={input} value={itemLabel} onChange={e => setItemLabel(e.target.value)} placeholder="Lead, Order, Candidate…" /></label>
        )}
        <p className="mt-3 text-[11px] text-slate-400">Type: <b className="text-slate-600">{isPipeline ? "Pipeline" : "Checklist"}</b> — {isPipeline ? "members add many items that move through the steps." : "every member works through all the steps once."}</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Colour</span>
          {Object.entries(PROJECT_COLORS).map(([k, g]) => (
            <button key={k} onClick={() => setColor(k)} className={`h-6 w-6 rounded-full bg-gradient-to-br ${g} cursor-pointer ${color === k ? "ring-2 ring-offset-2 ring-slate-900" : ""}`} />
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <StepsEditor milestones={milestones} onChange={setMilestones} inUse={inUse} kind={project.kind} />
        <div className="mt-4 rounded-xl bg-slate-50 p-3">
          <div className="text-xs font-semibold text-slate-600">Save these steps as a new template</div>
          <div className="mt-1.5 flex gap-2">
            <input className={input} value={tplName} onChange={e => setTplName(e.target.value)} placeholder={`e.g. ${project.name} steps`} />
            <button type="button" onClick={saveAsTemplate} disabled={tplBusy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60 cursor-pointer">
              {tplBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookmarkPlus className="h-3.5 w-3.5" />} Save as template
            </button>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">{tplMsg || "Reuse this set of steps for future projects. The template you started from stays unchanged."}</p>
        </div>
      </section>

      {/* Members */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-bold text-slate-900">Members</h3>
        <p className="text-xs text-slate-500">{isPipeline ? "Each member adds and works their own items and sees only their own." : "Each member gets their own copy of the steps and sees only their own progress."} To take someone off and clear their progress, use the remove button on the Team tab.</p>
        <UserPicker users={users} selected={memberIds} onChange={setMemberIds} />
      </section>

      {/* Managers */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-bold text-slate-900">Managers</h3>
        <p className="text-xs text-slate-500">Can see every member's {isPipeline ? "items, assign them" : "progress"} and approve steps. Client admins always can.</p>
        <UserPicker users={users.filter(u => !P.isProjectAdmin(u))} selected={managerIds} onChange={setManagerIds} />
      </section>

      <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <div className="flex items-center gap-1">
          <button onClick={async () => { await P.updateProject(project.id, { status: project.status === "archived" ? "active" : "archived" }); onSaved(); }}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">
            {project.status === "archived" ? <><ArchiveRestore className="h-4 w-4" /> Restore</> : <><Archive className="h-4 w-4" /> Archive</>}
          </button>
          <button onClick={onDelete}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
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

/** Ordered steps with their required uploads/entries — used by Settings and New project. */
export function StepsEditor({ milestones, onChange, inUse = () => false, kind = "checklist" }: {
  milestones: P.Milestone[]; onChange: React.Dispatch<React.SetStateAction<P.Milestone[]>>; inUse?: (mid: string) => boolean; kind?: P.ProjectKind;
}) {
  const setMilestones = onChange;
  const patchM = (i: number, patch: Partial<P.Milestone>) => setMilestones(ms => ms.map((m, j) => j === i ? { ...m, ...patch } : m));
  const move = (i: number, dir: -1 | 1) => setMilestones(ms => {
    const j = i + dir; if (j < 0 || j >= ms.length) return ms;
    const next = [...ms]; [next[i], next[j]] = [next[j], next[i]]; return next;
  });
  const patchItem = (i: number, k: number, patch: Partial<P.MilestoneChecklistItem>) =>
    patchM(i, { checklist: milestones[i].checklist.map((it, j) => j === k ? { ...it, ...patch } : it) });

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Steps</h3>
          <p className="text-xs text-slate-500">{kind === "pipeline" ? "Every item moves through these in order; completing the last step marks it Won." : "Every member works through these in order."} Required items must be done before a step can be completed.</p>
        </div>
        <button type="button" onClick={() => setMilestones(ms => [...ms, P.newMilestone(`Step ${ms.length + 1}`)])}
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
                <IconBtn disabled={milestones.length <= 1 || inUse(m.id)} title={inUse(m.id) ? "Open items are on this step — move them first" : "Remove"}
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
              <button type="button" onClick={() => patchM(i, { checklist: [...m.checklist, P.newChecklistItem()] })}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"><Plus className="h-3 w-3" /> Add item</button>
            </div>
          </div>
        ))}
      </div>
    </>
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
