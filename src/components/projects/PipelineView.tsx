/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PipelineView — the "pipeline" kind of project: members add many items
 * (leads, orders, candidates…) that each move through the project's steps and
 * end Won (last step completed) or Lost (with a reason).
 *
 *   • PipelineView  — stats, filters, Board (a column per step + Won/Lost) or List.
 *   • PipelineTeam  — per-member numbers (open, follow-ups due, won, conversion).
 *   • AddItemModal  — quick capture: name, contact, phone (duplicate check), value,
 *                     source, next follow-up, owner (managers can assign).
 *   • ItemDrawer    — item details + follow-up, Mark lost / Reopen / Delete, and
 *                     the item's own StepRun (gauge, required items, approvals).
 * Moving an item forward always goes through the step gate in StepRun, so there
 * is deliberately no drag-and-drop between columns.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  Plus, Search, LayoutGrid, List, Phone, MessageCircle, CalendarClock, AlertTriangle, ShieldCheck, Trophy,
  XCircle, X, Loader2, Save, Undo2, Trash2, IndianRupee, UserMinus,
} from "lucide-react";
import type { User } from "../../types";
import * as P from "../../services/projectsService";
import { StepRun } from "./StepRun";
import StepGauge from "./StepGauge";

type Filter = "open" | "due" | "won" | "lost" | "all";

const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

const plural = (label: string) => (/s$/i.test(label) ? label : `${label}s`);

/** ISO → value for <input type="datetime-local"> (device-local). */
const toLocalInput = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : "");

const followUpLabel = (d: P.Deliverable) => {
  const s = P.followUpState(d);
  if (s === "none" || !d.followUpAt) return null;
  const f = new Date(d.followUpAt);
  const time = f.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  if (s === "overdue") {
    const days = Math.max(1, Math.round((Date.now() - f.getTime()) / 86400000));
    return { text: `Follow-up overdue ${days}d`, cls: "bg-red-50 text-red-600" };
  }
  if (s === "today") return { text: `Follow up today ${time}`, cls: "bg-amber-100 text-amber-800" };
  return { text: `Follow up ${f.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`, cls: "bg-slate-100 text-slate-600" };
};

const waLink = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  const full = digits.length === 10 ? `91${digits}` : digits;
  return full.length >= 11 ? `https://wa.me/${full}` : "";
};

// ─── Board / list ────────────────────────────────────────────────────────────
export function PipelineView({ project, items, users, showOwners, canAdd, onOpen, onAdd, ownerFilter, onOwnerFilter }: {
  project: P.Project;
  items: P.Deliverable[];
  users: User[];
  /** Team view: show each item's owner and allow filtering by member. */
  showOwners: boolean;
  canAdd: boolean;
  onOpen: (id: string) => void;
  onAdd: () => void;
  ownerFilter?: string;
  onOwnerFilter?: (id: string) => void;
}) {
  const label = project.itemLabel;
  const [filter, setFilter] = useState<Filter>("open");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"board" | "list">(() => (lsGet("horae.pipeline.view") === "list" ? "list" : "board"));
  useEffect(() => { lsSet("horae.pipeline.view", view); }, [view]);

  const scoped = ownerFilter ? items.filter(d => d.ownerUserId === ownerFilter) : items;
  const stats = P.pipelineStats(scoped);
  const progress = P.pipelineProgress(scoped, project);
  const owner = ownerFilter ? users.find(u => u.id === ownerFilter) : undefined;
  const needle = q.trim().toLowerCase();
  const shown = scoped.filter(d => {
    if (filter === "open" && d.status !== "open") return false;
    if (filter === "won" && d.status !== "won") return false;
    if (filter === "lost" && d.status !== "lost") return false;
    if (filter === "due") { const f = P.followUpState(d); if (f !== "overdue" && f !== "today") return false; }
    if (!needle) return true;
    return [d.title, d.contactName, d.contactPhone, d.source].some(x => x.toLowerCase().includes(needle));
  });
  const userOf = (id: string) => users.find(u => u.id === id);

  const chips: { id: Filter; label: string; n: number }[] = [
    { id: "open", label: "Open", n: stats.open },
    { id: "due", label: "Follow-up due", n: stats.followUpsDue },
    { id: "won", label: "Won", n: stats.won },
    { id: "lost", label: "Lost", n: stats.lost },
    { id: "all", label: "All", n: stats.total },
  ];

  return (
    <div className="space-y-4">
      {scoped.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex justify-center">
            <StepGauge value={progress} steps={project.milestones.length}
              caption={`Average progress of ${owner ? `${owner.name}'s` : showOwners ? "all" : "your"} ${stats.open + stats.won} active ${plural(label).toLowerCase()}`} />
          </div>
          <StageStrip project={project} items={scoped} />
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={`Open ${plural(label).toLowerCase()}`} value={String(stats.open)} sub={stats.openValue ? P.formatINR(stats.openValue) : undefined} />
        <Stat label="Follow-ups due" value={String(stats.followUpsDue)} color={stats.followUpsDue ? "#d97706" : undefined} />
        <Stat label="Won" value={String(stats.won)} sub={stats.wonValue ? P.formatINR(stats.wonValue) : undefined} color={stats.won ? "#059669" : undefined} />
        <Stat label="Conversion" value={`${stats.conversion}%`} sub={`${stats.won} won · ${stats.lost} lost`} color={P.progressColor(stats.conversion)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[160px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${plural(label).toLowerCase()}, name or phone`}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-400 focus:outline-none" />
        </div>
        {showOwners && onOwnerFilter && (
          <select value={ownerFilter || ""} onChange={e => onOwnerFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none">
            <option value="">Everyone</option>
            {project.memberIds.map(id => userOf(id)).filter(Boolean).map(u => <option key={u!.id} value={u!.id}>{u!.name}</option>)}
          </select>
        )}
        <div className="flex rounded-xl border border-slate-200 bg-white p-0.5">
          <button onClick={() => setView("board")} title="Board" className={`rounded-lg p-1.5 cursor-pointer ${view === "board" ? "bg-slate-900 text-white" : "text-slate-500"}`}><LayoutGrid className="h-4 w-4" /></button>
          <button onClick={() => setView("list")} title="List" className={`rounded-lg p-1.5 cursor-pointer ${view === "list" ? "bg-slate-900 text-white" : "text-slate-500"}`}><List className="h-4 w-4" /></button>
        </div>
        {canAdd && (
          <button onClick={onAdd} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 cursor-pointer">
            <Plus className="h-4 w-4" /> Add {label.toLowerCase()}
          </button>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto">
        {chips.map(c => (
          <button key={c.id} onClick={() => setFilter(c.id)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${filter === c.id ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
            {c.label} <span className="opacity-60">{c.n}</span>
          </button>
        ))}
      </div>

      {scoped.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 p-10 text-center">
          <div className="text-sm font-semibold text-slate-700">No {plural(label).toLowerCase()} yet</div>
          <p className="mt-1 text-xs text-slate-500">
            {canAdd ? `Add your first ${label.toLowerCase()} — it starts at “${project.milestones[0]?.name || "step 1"}”.` : `Members add ${plural(label).toLowerCase()} here.`}
          </p>
          {canAdd && <button onClick={onAdd} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 cursor-pointer">Add {label.toLowerCase()}</button>}
        </div>
      ) : view === "board" ? (
        <Board project={project} items={shown} showOwners={showOwners} userOf={userOf} onOpen={onOpen} />
      ) : (
        <ListView project={project} items={shown} showOwners={showOwners} userOf={userOf} onOpen={onOpen} />
      )}
    </div>
  );
}

function Board({ project, items, showOwners, userOf, onOpen }: {
  project: P.Project; items: P.Deliverable[]; showOwners: boolean; userOf: (id: string) => User | undefined; onOpen: (id: string) => void;
}) {
  const cols: { key: string; name: string; tone: string; items: P.Deliverable[] }[] = project.milestones.map(m => ({
    key: m.id, name: m.name, tone: "text-slate-700",
    items: items.filter(d => d.status === "open" && d.milestoneId === m.id),
  }));
  // Open items whose step was deleted in Settings land in the first column.
  const known = new Set(project.milestones.map(m => m.id));
  if (cols[0]) cols[0].items.push(...items.filter(d => d.status === "open" && !known.has(d.milestoneId)));
  const won = items.filter(d => d.status === "won");
  const lost = items.filter(d => d.status === "lost");
  if (won.length) cols.push({ key: "won", name: "Won", tone: "text-emerald-700", items: won });
  if (lost.length) cols.push({ key: "lost", name: "Lost", tone: "text-red-600", items: lost });
  for (const c of cols) c.items.sort(byUrgency);

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="flex gap-3">
        {cols.map(c => (
          <div key={c.key} className="w-64 shrink-0 rounded-2xl bg-slate-100/70 p-2">
            <div className="flex items-center justify-between px-1.5 pb-2 pt-1">
              <span className={`truncate text-xs font-bold uppercase tracking-wider ${c.tone}`}>{c.name}</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">{c.items.length}</span>
            </div>
            <div className="space-y-2">
              {c.items.map(d => <ItemCard key={d.id} project={project} d={d} owner={showOwners ? userOf(d.ownerUserId) : undefined} onOpen={onOpen} />)}
              {c.items.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-center text-[11px] text-slate-400">Empty</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListView({ project, items, showOwners, userOf, onOpen }: {
  project: P.Project; items: P.Deliverable[]; showOwners: boolean; userOf: (id: string) => User | undefined; onOpen: (id: string) => void;
}) {
  const sorted = [...items].sort(byUrgency);
  if (!sorted.length) return <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">Nothing matches this filter.</p>;
  return (
    <div className="space-y-2">
      {sorted.map(d => <ItemCard key={d.id} project={project} d={d} owner={showOwners ? userOf(d.ownerUserId) : undefined} onOpen={onOpen} wide />)}
    </div>
  );
}

/** How many open items sit on each step, under the gauge. */
function StageStrip({ project, items }: { project: P.Project; items: P.Deliverable[] }) {
  const n = project.milestones.length;
  return (
    <div className="mt-3 flex gap-1 overflow-x-auto">
      {project.milestones.map((m, i) => {
        const count = items.filter(d => d.status === "open" && d.milestoneId === m.id).length;
        const pct = Math.round(((i + 0.5) / n) * 100);
        return (
          <div key={m.id} className="min-w-[64px] flex-1 rounded-xl bg-slate-50 px-1.5 py-1.5 text-center">
            <div className="text-base font-bold tabular-nums" style={{ color: count ? P.progressColor(pct) : "#cbd5e1" }}>{count}</div>
            <div className="truncate text-[10px] text-slate-500" title={m.name}>{m.name}</div>
          </div>
        );
      })}
    </div>
  );
}

/** Awaiting approval → follow-up overdue → due today → step overdue → newest. */
function byUrgency(a: P.Deliverable, b: P.Deliverable) {
  const rank = (d: P.Deliverable) => {
    if (d.status !== "open") return 9;
    if (d.approvals[d.milestoneId]?.status === "pending") return 0;
    const f = P.followUpState(d);
    return f === "overdue" ? 1 : f === "today" ? 2 : 5;
  };
  return rank(a) - rank(b) || (a.followUpAt || "9").localeCompare(b.followUpAt || "9") || b.updatedAt.localeCompare(a.updatedAt);
}

function ItemCard({ project, d, owner, onOpen, wide }: {
  project: P.Project; d: P.Deliverable; owner?: User; onOpen: (id: string) => void; wide?: boolean;
}) {
  const pct = P.stepProgress(d, project);
  const idx = P.currentStepIndex(d, project);
  const fu = followUpLabel(d);
  const pending = d.status === "open" && d.approvals[d.milestoneId]?.status === "pending";
  const stuck = P.isOverdue(d, project);
  return (
    <button onClick={() => onOpen(d.id)}
      className="block w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-indigo-300 hover:shadow cursor-pointer">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900">{d.title}</div>
          {(d.contactName || d.contactPhone) && (
            <div className="truncate text-[11px] text-slate-500">{[d.contactName, d.contactPhone].filter(Boolean).join(" · ")}</div>
          )}
        </div>
        {owner && <img src={owner.avatar} alt={owner.name} title={owner.name} className="h-6 w-6 shrink-0 rounded-full object-cover" />}
      </div>
      {wide && (
        <div className="mt-1 text-[11px] text-slate-500">
          {d.status === "won" ? "Won" : d.status === "lost" ? `Lost${d.lostReason ? ` · ${d.lostReason}` : ""}` : `${project.milestones[idx]?.name || ""} · step ${idx + 1} of ${project.milestones.length}`}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {d.value > 0 && <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">{P.formatINR(d.value)}</span>}
        {pending && <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"><ShieldCheck className="h-3 w-3" /> Approval</span>}
        {fu && <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${fu.cls}`}><CalendarClock className="h-3 w-3" /> {fu.text}</span>}
        {stuck && <span className="inline-flex items-center gap-0.5 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600"><AlertTriangle className="h-3 w-3" /> {P.daysInMilestone(d)}d on step</span>}
        {d.status === "won" && <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700"><Trophy className="h-3 w-3" /> Won</span>}
        {d.status === "lost" && !wide && <span className="inline-flex items-center gap-0.5 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600"><XCircle className="h-3 w-3" /> {d.lostReason || "Lost"}</span>}
      </div>
      {d.status === "open" && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 3)}%`, background: P.progressColor(pct) }} />
          </div>
          <span className="w-8 text-right text-[10px] font-bold tabular-nums" style={{ color: P.progressColor(pct) }}>{pct}%</span>
        </div>
      )}
    </button>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
      <div className="text-xl font-bold tabular-nums" style={{ color: color || "#0f172a" }}>{value}</div>
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      {sub && <div className="mt-0.5 text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}

// ─── Team numbers ────────────────────────────────────────────────────────────
export function PipelineTeam({ project, items, users, selected, onSelect, onRemove }: {
  project: P.Project; items: P.Deliverable[]; users: User[]; selected?: string; onSelect: (id: string) => void;
  /** Client admin only: take a member off the project. */
  onRemove?: (u: User) => void;
}) {
  const rows = project.memberIds.map(id => {
    const mine = items.filter(d => d.ownerUserId === id);
    return { u: users.find(x => x.id === id), s: P.pipelineStats(mine), pct: P.pipelineProgress(mine, project) };
  }).filter(r => r.u) as { u: User; s: ReturnType<typeof P.pipelineStats>; pct: number }[];
  rows.sort((a, b) => b.s.won - a.s.won || b.s.open - a.s.open);
  if (!rows.length) return null;
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="px-4 py-2.5">Member</th>
              <th className="px-2 py-2.5">Progress</th>
              <th className="px-2 py-2.5 text-right">Open</th>
              <th className="px-2 py-2.5 text-right">Due</th>
              <th className="px-2 py-2.5 text-right">Won</th>
              <th className="px-2 py-2.5 text-right">Lost</th>
              <th className="px-2 py-2.5 text-right">Conv.</th>
              <th className="px-4 py-2.5 text-right">Won ₹</th>
              {onRemove && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ u, s, pct }) => (
              <tr key={u.id} onClick={() => onSelect(selected === u.id ? "" : u.id)}
                className={`cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50 ${selected === u.id ? "bg-indigo-50/60" : ""}`}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <img src={u.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                    <span className="truncate font-semibold text-slate-800">{u.name}</span>
                    {s.pending > 0 && <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">{s.pending} to approve</span>}
                  </div>
                </td>
                <td className="px-2 py-2.5">
                  <div className="flex min-w-[90px] items-center gap-1.5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: P.progressColor(pct) }} />
                    </div>
                    <span className="w-8 text-right text-[11px] font-bold tabular-nums" style={{ color: P.progressColor(pct) }}>{pct}%</span>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">{s.open}</td>
                <td className={`px-2 py-2.5 text-right tabular-nums ${s.followUpsDue ? "font-semibold text-amber-600" : "text-slate-400"}`}>{s.followUpsDue}</td>
                <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-emerald-600">{s.won}</td>
                <td className="px-2 py-2.5 text-right tabular-nums text-slate-500">{s.lost}</td>
                <td className="px-2 py-2.5 text-right font-semibold tabular-nums" style={{ color: s.won + s.lost ? P.progressColor(s.conversion) : "#94a3b8" }}>{s.won + s.lost ? `${s.conversion}%` : "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{s.wonValue ? P.formatINR(s.wonValue) : "—"}</td>
                {onRemove && (
                  <td className="pr-3">
                    <button title="Remove from project" onClick={e => { e.stopPropagation(); onRemove(u); }}
                      className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600 cursor-pointer"><UserMinus className="h-4 w-4" /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">Tap a member to see only their {plural(project.itemLabel).toLowerCase()}. Conversion = won ÷ (won + lost).</p>
    </section>
  );
}

// ─── Add item ────────────────────────────────────────────────────────────────
const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none";

export function AddItemModal({ project, users, allItems, canAssign, defaultOwner, onClose, onCreate }: {
  project: P.Project; users: User[]; allItems: P.Deliverable[]; canAssign: boolean; defaultOwner: string;
  onClose: () => void; onCreate: (ownerId: string, f: P.ItemFields) => Promise<void>;
}) {
  const label = project.itemLabel;
  const members = project.memberIds.map(id => users.find(u => u.id === id)).filter(Boolean) as User[];
  const [f, setF] = useState<P.ItemFields>({ title: "", contactName: "", contactPhone: "", value: 0, source: "", notes: "", followUpAt: "" });
  const [owner, setOwner] = useState(project.memberIds.includes(defaultOwner) ? defaultOwner : members[0]?.id || defaultOwner);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const dup = useMemo(() => P.findDuplicatePhone(allItems, project.id, f.contactPhone), [allItems, project.id, f.contactPhone]);
  const set = (patch: Partial<P.ItemFields>) => setF(x => ({ ...x, ...patch }));

  return (
    <Sheet title={`Add ${label.toLowerCase()}`} onClose={onClose}>
      <form className="space-y-3" onSubmit={async e => {
        e.preventDefault();
        const title = f.title.trim() || f.contactName.trim();
        if (!title) { setErr(`Give the ${label.toLowerCase()} a name.`); return; }
        setBusy(true); setErr("");
        try { await onCreate(owner, { ...f, title, contactName: f.contactName.trim(), contactPhone: f.contactPhone.trim(), source: f.source.trim(), notes: f.notes.trim() }); }
        catch (e: any) { setErr(e?.message || "Could not save."); setBusy(false); }
      }}>
        {err && <div className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{err}</div>}
        <Field label={`${label} name`}><input className={inputCls} value={f.title} onChange={e => set({ title: e.target.value })} autoFocus
          placeholder={label === "Lead" || label === "Deal" ? "e.g. 3BHK – Whitefield / Sharma family" : `e.g. New ${label.toLowerCase()}`} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Contact name"><input className={inputCls} value={f.contactName} onChange={e => set({ contactName: e.target.value })} /></Field>
          <Field label="Phone"><input className={inputCls} inputMode="tel" value={f.contactPhone} onChange={e => set({ contactPhone: e.target.value })} /></Field>
        </div>
        {dup && (
          <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
            This number is already on “{dup.title}”{dup.ownerUserId ? ` (${users.find(u => u.id === dup.ownerUserId)?.name || "someone"})` : ""}. You can still add it.
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Value ₹ (optional)"><input className={inputCls} type="number" min={0} value={f.value || ""} onChange={e => set({ value: Number(e.target.value) || 0 })} /></Field>
          <Field label="Source (optional)"><input className={inputCls} value={f.source} onChange={e => set({ source: e.target.value })} placeholder="Walk-in, referral, Instagram…" list="pipeline-sources" /></Field>
        </div>
        <SourceList />
        <Field label="Next follow-up (optional)"><input className={inputCls} type="datetime-local" value={toLocalInput(f.followUpAt)} onChange={e => set({ followUpAt: fromLocalInput(e.target.value) })} /></Field>
        {canAssign && members.length > 0 && (
          <Field label="Owner">
            <select className={inputCls} value={owner} onChange={e => setOwner(e.target.value)}>
              {members.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Notes (optional)"><textarea className={inputCls} rows={2} value={f.notes} onChange={e => set({ notes: e.target.value })} /></Field>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancel</button>
          <button disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 cursor-pointer">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Add {label.toLowerCase()}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

// ─── Item drawer ─────────────────────────────────────────────────────────────
export function ItemDrawer({ project, item: d, users, allItems, actor, canManage, onChanged, onDeleted, onClose }: {
  project: P.Project; item: P.Deliverable; users: User[]; allItems: P.Deliverable[]; actor: P.Actor; canManage: boolean;
  onChanged: (d: P.Deliverable) => void; onDeleted: (id: string) => void; onClose: () => void;
}) {
  const isOwner = d.ownerUserId === actor.id;
  const canEdit = canManage || isOwner;
  const owner = users.find(u => u.id === d.ownerUserId);
  const members = project.memberIds.map(id => users.find(u => u.id === id)).filter(Boolean) as User[];

  const fromItem = () => ({ title: d.title, contactName: d.contactName, contactPhone: d.contactPhone, value: d.value, source: d.source, notes: d.notes, followUpAt: d.followUpAt || "" });
  const [f, setF] = useState<P.ItemFields>(fromItem);
  const [ownerId, setOwnerId] = useState(d.ownerUserId);
  useEffect(() => { setF(fromItem()); setOwnerId(d.ownerUserId); }, [d.id, d.updatedAt]);
  const dirty = JSON.stringify(f) !== JSON.stringify(fromItem()) || ownerId !== d.ownerUserId;

  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [losing, setLosing] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dup = P.findDuplicatePhone(allItems, project.id, f.contactPhone, d.id);
  const wa = waLink(f.contactPhone);

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setErr("");
    try { await fn(); } catch (e: any) { setErr(e?.message || "Something went wrong."); } finally { setBusy(""); }
  };
  const set = (patch: Partial<P.ItemFields>) => setF(x => ({ ...x, ...patch }));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto bg-slate-50 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{project.name} · {project.itemLabel}</div>
            <h2 className="truncate text-lg font-bold text-slate-900">{d.title}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 p-4">
          {err && <div className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{err}</div>}

          {d.status === "lost" && (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
              <span className="flex items-center gap-1.5 font-semibold"><XCircle className="h-4 w-4" /> Lost{d.lostReason ? ` — ${d.lostReason}` : ""}</span>
              {canEdit && (
                <button disabled={!!busy} onClick={() => act("reopen", async () => onChanged(await P.moveBack(d, project, actor)))}
                  className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-100 cursor-pointer">
                  <Undo2 className="h-3.5 w-3.5" /> Reopen
                </button>
              )}
            </div>
          )}

          {/* Details */}
          <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              {f.contactPhone && <a href={`tel:${f.contactPhone}`} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"><Phone className="h-3.5 w-3.5" /> Call</a>}
              {wa && <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>}
              {owner && <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-500"><img src={owner.avatar} alt="" className="h-5 w-5 rounded-full object-cover" />{owner.name}</span>}
            </div>
            <Field label={`${project.itemLabel} name`}><input className={inputCls} disabled={!canEdit} value={f.title} onChange={e => set({ title: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Contact name"><input className={inputCls} disabled={!canEdit} value={f.contactName} onChange={e => set({ contactName: e.target.value })} /></Field>
              <Field label="Phone"><input className={inputCls} disabled={!canEdit} inputMode="tel" value={f.contactPhone} onChange={e => set({ contactPhone: e.target.value })} /></Field>
            </div>
            {dup && <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">Same number as “{dup.title}”.</div>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Value ₹"><div className="relative"><IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input className={`${inputCls} pl-8`} disabled={!canEdit} type="number" min={0} value={f.value || ""} onChange={e => set({ value: Number(e.target.value) || 0 })} /></div></Field>
              <Field label="Source"><input className={inputCls} disabled={!canEdit} value={f.source} onChange={e => set({ source: e.target.value })} list="pipeline-sources" /></Field>
            </div>
            <Field label="Next follow-up">
              <div className="flex gap-2">
                <input className={inputCls} disabled={!canEdit || d.status !== "open"} type="datetime-local" value={toLocalInput(f.followUpAt)} onChange={e => set({ followUpAt: fromLocalInput(e.target.value) })} />
                {canEdit && f.followUpAt && d.status === "open" && <button type="button" onClick={() => set({ followUpAt: "" })} className="shrink-0 rounded-xl px-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 cursor-pointer">Clear</button>}
              </div>
              {d.status === "open" && !f.followUpAt && <p className="mt-1 text-[11px] text-amber-600">No next follow-up set — every open {project.itemLabel.toLowerCase()} should have one.</p>}
            </Field>
            {canManage && members.length > 1 && (
              <Field label="Owner">
                <select className={inputCls} value={ownerId} onChange={e => setOwnerId(e.target.value)}>
                  {members.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </Field>
            )}
            <SourceList />
            <Field label="Notes"><textarea className={inputCls} disabled={!canEdit} rows={2} value={f.notes} onChange={e => set({ notes: e.target.value })} /></Field>
            {canEdit && dirty && (
              <div className="flex justify-end">
                <button disabled={!!busy} onClick={() => act("save", async () => {
                  onChanged(await P.updateItem(d, { ...f, title: f.title.trim() || d.title, ...(ownerId !== d.ownerUserId ? { ownerUserId: ownerId } : {}) }));
                })} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 cursor-pointer">
                  {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save details
                </button>
              </div>
            )}
          </section>

          {/* Steps */}
          <StepRun project={project} run={d} owner={owner} actor={actor} canManage={canManage} onChanged={onChanged} />

          {/* Close out */}
          {canEdit && (
            <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
              {d.status === "open" && (losing ? (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-500">Why was it lost?</div>
                  <div className="flex flex-wrap gap-1.5">
                    {P.LOST_REASONS.map(r => (
                      <button key={r} type="button" onClick={() => setReason(r)}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold cursor-pointer ${reason === r ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{r}</button>
                    ))}
                  </div>
                  <input className={inputCls} value={reason} onChange={e => setReason(e.target.value)} placeholder="Or type a reason" />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => { setLosing(false); setReason(""); }} className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancel</button>
                    <button disabled={!!busy || !reason.trim()} onClick={() => act("lost", async () => { onChanged(await P.markLost(d, reason.trim(), actor)); setLosing(false); })}
                      className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer">Mark lost</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setLosing(true)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50 cursor-pointer">
                  <XCircle className="h-4 w-4" /> Mark as lost
                </button>
              ))}
              {canManage && (
                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-[11px] text-slate-400">Deleting removes the {project.itemLabel.toLowerCase()} and its history.</span>
                  <button disabled={!!busy} onClick={() => confirmDelete
                    ? act("del", async () => { await P.deleteItem(d.id); onDeleted(d.id); })
                    : setConfirmDelete(true)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold cursor-pointer ${confirmDelete ? "bg-red-600 text-white hover:bg-red-700" : "text-slate-500 hover:bg-slate-100"}`}>
                    <Trash2 className="h-3.5 w-3.5" /> {confirmDelete ? "Tap again to delete" : "Delete"}
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Bits ────────────────────────────────────────────────────────────────────
const SOURCES = ["Walk-in", "Phone call", "WhatsApp", "Referral", "Instagram", "Facebook", "Website", "Google", "Broker / partner"];
function SourceList() {
  return <datalist id="pipeline-sources">{SOURCES.map(s => <option key={s} value={s} />)}</datalist>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-xs font-semibold text-slate-500">{label}</span>{children}</label>;
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 cursor-pointer"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
