/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ProjectSettings — admin/manager editor for a project: milestones (rename,
 * reorder, time limit, approval, gating checklist), members, and this month's
 * targets (count and/or ₹ value per person).
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
  deliverables: P.Deliverable[];
  targets: P.Target[];
  onSaved: () => void;
}

export default function ProjectSettings({ project, users, deliverables, targets, onSaved }: Props) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [itemLabel, setItemLabel] = useState(project.itemLabel);
  const [color, setColor] = useState(project.color);
  const [milestones, setMilestones] = useState<P.Milestone[]>(project.milestones);
  const [memberIds, setMemberIds] = useState<string[]>(project.memberIds);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const period = P.currentMonthPeriod();
  const monthLabel = new Date(`${period.start}T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const tgtFor = (uid: string) => targets.find(t => t.projectId === project.id && t.userId === uid && t.periodStart === period.start);
  const [tgtDraft, setTgtDraft] = useState<Record<string, { count: string; value: string }>>(() =>
    Object.fromEntries(project.memberIds.map(uid => {
      const t = tgtFor(uid);
      return [uid, { count: t?.targetCount ? String(t.targetCount) : "", value: t?.targetValue ? String(t.targetValue) : "" }];
    })));

  const inUse = (mid: string) => deliverables.some(d => d.projectId === project.id && d.milestoneId === mid && d.status === "open");

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
      await P.updateProject(project.id, { name: name.trim() || project.name, description, itemLabel: itemLabel.trim() || "Deliverable", color, milestones: cleaned, memberIds });
      for (const uid of memberIds) {
        const dft = tgtDraft[uid]; if (!dft) continue;
        const c = dft.count ? Math.round(Number(dft.count)) : null;
        const v = dft.value ? Number(dft.value) : null;
        const cur = tgtFor(uid);
        if ((cur?.targetCount ?? null) !== c || (cur?.targetValue ?? null) !== v) await P.upsertTarget(project, uid, period, c, v);
      }
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
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1"><span className="text-xs font-semibold text-slate-500">Name</span>
            <input className={input} value={name} onChange={e => setName(e.target.value)} /></label>
          <label className="space-y-1"><span className="text-xs font-semibold text-slate-500">Call each item a…</span>
            <input className={input} value={itemLabel} onChange={e => setItemLabel(e.target.value)} placeholder="Deliverable, Lead, Deal…" /></label>
        </div>
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
            <h3 className="text-sm font-bold text-slate-900">Milestones</h3>
            <p className="text-xs text-slate-500">Required checklist items must be done before a {itemLabel.toLowerCase() || "deliverable"} can move to the next milestone.</p>
          </div>
          <button onClick={() => setMilestones(ms => [...ms, P.newMilestone(`Milestone ${ms.length + 1}`)])}
            className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 cursor-pointer"><Plus className="h-3.5 w-3.5" /> Add milestone</button>
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
                  <IconBtn disabled={milestones.length <= 1 || inUse(m.id)} title={inUse(m.id) ? "Open items are at this milestone — move them first" : "Remove"}
                    onClick={() => setMilestones(ms => ms.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                </div>
              </div>

              <div className="mt-2 space-y-1.5 pl-9">
                {m.checklist.map((it, k) => (
                  <div key={it.id} className="flex flex-wrap items-center gap-1.5">
                    <input className="min-w-[140px] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-400"
                      placeholder="Checklist item, e.g. Site visit photo" value={it.text} onChange={e => patchItem(i, k, { text: e.target.value })} />
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
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"><Plus className="h-3 w-3" /> Add checklist item</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Members + targets */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-bold text-slate-900">Team & targets · {monthLabel}</h3>
        <p className="text-xs text-slate-500">Tick who works this project. Set a count target, a ₹ value target, or both.</p>
        <div className="mt-3 divide-y divide-slate-100">
          {users.map(u => {
            const on = memberIds.includes(u.id);
            const dft = tgtDraft[u.id] || { count: "", value: "" };
            return (
              <div key={u.id} className="flex flex-wrap items-center gap-3 py-2">
                <label className="flex min-w-[180px] flex-1 cursor-pointer items-center gap-2">
                  <input type="checkbox" className="accent-indigo-600 h-4 w-4" checked={on}
                    onChange={e => setMemberIds(ids => e.target.checked ? [...ids, u.id] : ids.filter(x => x !== u.id))} />
                  <img src={u.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                  <span className="text-sm font-medium text-slate-800">{u.name}</span>
                  <span className="text-[11px] text-slate-400">{u.role}</span>
                </label>
                {on && (
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} placeholder={`# ${itemLabel.toLowerCase()}s`} value={dft.count}
                      onChange={e => setTgtDraft(t => ({ ...t, [u.id]: { ...dft, count: e.target.value } }))}
                      className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-400" />
                    <input type="number" min={0} placeholder="₹ value" value={dft.value}
                      onChange={e => setTgtDraft(t => ({ ...t, [u.id]: { ...dft, value: e.target.value } }))}
                      className="w-32 rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-400" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
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

function IconBtn({ children, onClick, disabled, title }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick}
      className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed">
      {children}
    </button>
  );
}
