/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DeliverableDrawer — one deliverable: milestone path, the current milestone's
 * gating checklist, approval, move/close actions, details and activity.
 */
import React, { useEffect, useState } from "react";
import {
  X, Check, Lock, ChevronRight, Paperclip, Phone, MessageCircle, Undo2, Trophy, Ban,
  RotateCcw, Trash2, Pencil, ShieldCheck, Clock, Send, Loader2,
} from "lucide-react";
import type { User } from "../../types";
import * as P from "../../services/projectsService";

interface Props {
  project: P.Project;
  deliverable: P.Deliverable;
  users: User[];
  actor: P.Actor;
  canManage: boolean;
  onChanged: (d: P.Deliverable | null) => void;
  onClose: () => void;
}

const relTime = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export default function DeliverableDrawer({ project, deliverable: d, users, actor, canManage, onChanged, onClose }: Props) {
  const ms = project.milestones;
  const curIdx = Math.max(0, ms.findIndex(m => m.id === d.milestoneId));
  const [viewIdx, setViewIdx] = useState(curIdx);
  const viewM = ms[viewIdx];
  const isCurrent = viewIdx === curIdx && d.status === "open";
  const canEdit = canManage || d.ownerUserId === actor.id;
  const block = d.status === "open" ? P.advanceBlock(d, project) : null;
  const nextM = ms[curIdx + 1];
  const approval = d.approvals[ms[curIdx]?.id];

  const [busy, setBusy] = useState<string>("");
  const [err, setErr] = useState("");
  const [activity, setActivity] = useState<P.ActivityEntry[]>([]);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<null | "lost" | "delete">(null);
  const [reason, setReason] = useState("");
  const [decisionNote, setDecisionNote] = useState("");

  useEffect(() => { setViewIdx(curIdx); }, [d.milestoneId, d.status]);
  const loadActivity = () => P.getActivity(d.id).then(setActivity).catch(() => {});
  useEffect(() => { loadActivity(); }, [d.id, d.updatedAt]);

  const run = async (key: string, fn: () => Promise<P.Deliverable | null | void>) => {
    setBusy(key); setErr("");
    try {
      const next = await fn();
      if (next !== undefined) onChanged(next as P.Deliverable | null);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong.");
    } finally { setBusy(""); }
  };

  const answer = (itemId: string) => d.checklist[viewM?.id]?.[itemId];
  const setAnswer = (item: P.MilestoneChecklistItem, value: string | undefined, done: boolean) =>
    run(`ci-${item.id}`, () => P.setChecklistAnswer(d, viewM.id, item.id, { done, value, by: actor.name, at: new Date().toISOString() }));

  const owner = users.find(u => u.id === d.ownerUserId);
  const phoneDigits = d.contactPhone.replace(/[^\d+]/g, "");
  const doneCount = viewM ? viewM.checklist.filter(it => answer(it.id)?.done).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{project.itemLabel} · {project.name}</div>
              <h2 className="mt-0.5 truncate text-lg font-bold text-slate-900">{d.title}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                {d.value > 0 && <span className="font-semibold text-slate-800">{P.formatINR(d.value)}</span>}
                <span>Owner: {owner?.name || "Unassigned"}</span>
                {d.status === "won" && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">Closed · won</span>}
                {d.status === "lost" && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">Closed · lost</span>}
                {d.status === "open" && P.isStuck(d, project) && <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-600">Stuck {P.daysInMilestone(d)}d</span>}
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"><X className="h-5 w-5" /></button>
          </div>

          {/* Milestone path */}
          <div className="mt-4 flex gap-1 overflow-x-auto pb-1">
            {ms.map((m, i) => {
              const done = d.status === "won" || i < curIdx;
              const cur = i === curIdx && d.status === "open";
              return (
                <button key={m.id} onClick={() => setViewIdx(i)} title={m.name}
                  className={`group relative flex min-w-[104px] flex-1 items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold transition cursor-pointer
                    ${i === 0 ? "rounded-l-full" : ""} ${i === ms.length - 1 ? "rounded-r-full" : ""}
                    ${done ? "bg-emerald-500 text-white" : cur ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}
                    ${viewIdx === i ? "ring-2 ring-offset-1 ring-slate-900/70" : ""}`}>
                  {done && <Check className="h-3 w-3 shrink-0" />}
                  <span className="truncate">{m.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-5 px-5 py-4">
          {err && <div className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{err}</div>}

          {/* Checklist for the viewed milestone */}
          {viewM && (
            <section className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-900">{viewM.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {viewM.checklist.length ? `${doneCount} of ${viewM.checklist.length} done` : "No checklist for this milestone"}
                    {viewM.requiresApproval && " · needs approval"}
                    {isCurrent && ` · ${P.daysInMilestone(d)}d here (limit ${viewM.slaDays}d)`}
                  </div>
                </div>
                {!isCurrent && viewIdx > curIdx && d.status === "open" && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400"><Lock className="h-3 w-3" /> Locked</span>
                )}
              </div>

              <div className="mt-3 space-y-2">
                {viewM.checklist.map(it => {
                  const a = answer(it.id);
                  const editable = canEdit && isCurrent;
                  return (
                    <ChecklistRow key={it.id} item={it} answer={a} editable={editable} busy={busy === `ci-${it.id}`}
                      onSet={(value, done) => setAnswer(it, value, done)}
                      onUpload={async (file) => {
                        await run(`ci-${it.id}`, async () => {
                          const url = await P.uploadProjectFile(file, { clientId: project.clientId, projectId: project.id });
                          return P.setChecklistAnswer(d, viewM.id, it.id, { done: true, value: url, by: actor.name, at: new Date().toISOString() });
                        });
                      }} />
                  );
                })}
              </div>

              {/* Gate + actions, only on the current milestone */}
              {isCurrent && (
                <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                  {block?.kind === "checklist" && (
                    <p className="flex items-center gap-1.5 text-xs text-slate-500"><Lock className="h-3.5 w-3.5" />
                      {block.missing.length} required item{block.missing.length > 1 ? "s" : ""} left before this can move on.</p>
                  )}
                  {block?.kind === "approval" && (
                    <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                      <div className="flex items-center gap-1.5 font-semibold"><ShieldCheck className="h-3.5 w-3.5" />
                        {approval?.status === "pending" ? `Waiting for approval · requested by ${approval.requestedBy}`
                          : approval?.status === "rejected" ? `Sent back by ${approval.decidedBy}${approval.note ? ` — “${approval.note}”` : ""}`
                          : "Manager approval needed to move on"}
                      </div>
                      {canManage && approval?.status === "pending" && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <input value={decisionNote} onChange={e => setDecisionNote(e.target.value)} placeholder="Note (optional)"
                            className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs focus:outline-none" />
                          <button disabled={!!busy} onClick={() => run("approve", () => P.decideApproval(d, project, actor, true, decisionNote))}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer">Approve</button>
                          <button disabled={!!busy} onClick={() => run("reject", () => P.decideApproval(d, project, actor, false, decisionNote))}
                            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 cursor-pointer">Send back</button>
                        </div>
                      )}
                      {canEdit && approval?.status !== "pending" && (
                        <button disabled={!!busy} onClick={() => run("req", () => P.requestApproval(d, project, actor))}
                          className="mt-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50 cursor-pointer">
                          {busy === "req" ? "Requesting…" : approval?.status === "rejected" ? "Request approval again" : "Request approval"}
                        </button>
                      )}
                    </div>
                  )}
                  {!block && approval?.status === "approved" && ms[curIdx]?.requiresApproval && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" />
                      Approved by {approval.decidedBy}{approval.note ? ` — “${approval.note}”` : ""}</p>
                  )}
                  {canEdit && (
                    <button disabled={!!block || !!busy} onClick={() => run("adv", () => P.advanceDeliverable(d, project, actor))}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition cursor-pointer disabled:cursor-not-allowed
                        ${block ? "bg-slate-100 text-slate-400" : nextM ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200" : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200"}`}>
                      {busy === "adv" ? <Loader2 className="h-4 w-4 animate-spin" /> : nextM ? <ChevronRight className="h-4 w-4" /> : <Trophy className="h-4 w-4" />}
                      {nextM ? `Move to ${nextM.name}` : `Complete & close ${project.itemLabel.toLowerCase()}`}
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Secondary actions */}
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              {d.status === "open" && canManage && curIdx > 0 && (
                <SmallBtn onClick={() => run("back", () => P.moveBack(d, project, actor))} icon={<Undo2 className="h-3.5 w-3.5" />}>Move back</SmallBtn>
              )}
              {d.status === "open" && <SmallBtn onClick={() => { setReason(""); setConfirm("lost"); }} icon={<Ban className="h-3.5 w-3.5" />}>Mark lost</SmallBtn>}
              {d.status !== "open" && canManage && <SmallBtn onClick={() => run("reopen", () => P.reopen(d, actor))} icon={<RotateCcw className="h-3.5 w-3.5" />}>Reopen</SmallBtn>}
              <SmallBtn onClick={() => setEditing(v => !v)} icon={<Pencil className="h-3.5 w-3.5" />}>Edit details</SmallBtn>
              {canManage && <SmallBtn danger onClick={() => setConfirm("delete")} icon={<Trash2 className="h-3.5 w-3.5" />}>Delete</SmallBtn>}
            </div>
          )}

          {editing && (
            <DetailsForm d={d} users={users} project={project} canManage={canManage}
              onCancel={() => setEditing(false)}
              onSave={(patch) => run("edit", async () => { const n = await P.updateDeliverableDetails(d, patch); setEditing(false); return n; })} />
          )}

          {/* Contact */}
          {(d.contactName || d.contactPhone || d.notes) && !editing && (
            <section className="rounded-2xl bg-slate-50 p-4 text-sm">
              {d.contactName && <div className="font-semibold text-slate-800">{d.contactName}</div>}
              {d.contactPhone && (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-slate-600">{d.contactPhone}</span>
                  <a href={`tel:${phoneDigits}`} className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"><Phone className="h-3 w-3" /> Call</a>
                  <a href={`https://wa.me/${phoneDigits.replace(/^\+/, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-slate-200 hover:bg-emerald-50"><MessageCircle className="h-3 w-3" /> WhatsApp</a>
                </div>
              )}
              {d.notes && <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600">{d.notes}</p>}
            </section>
          )}

          {/* Activity */}
          <section>
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Activity</div>
            <form className="mb-3 flex gap-2" onSubmit={e => {
              e.preventDefault();
              if (!comment.trim()) return;
              const text = comment.trim();
              setComment("");
              run("comment", async () => { await P.addComment(d, actor, text); await loadActivity(); });
            }}>
              <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment or update…"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
              <button className="rounded-xl bg-slate-900 px-3 text-white hover:bg-slate-700 cursor-pointer"><Send className="h-4 w-4" /></button>
            </form>
            <ol className="relative space-y-3 border-l border-slate-200 pl-4">
              {activity.map(a => (
                <li key={a.id} className="relative">
                  <span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                    a.kind === "won" || a.kind === "approved" ? "bg-emerald-500" : a.kind === "lost" || a.kind === "rejected" ? "bg-red-500"
                    : a.kind === "comment" ? "bg-slate-400" : "bg-indigo-500"}`} />
                  <div className="text-xs text-slate-700"><span className="font-semibold">{a.userName || "Someone"}</span> {a.kind === "comment" ? "commented" : ""}</div>
                  {a.text && <div className={`text-sm ${a.kind === "comment" ? "mt-0.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-slate-800" : "text-slate-600"}`}>{a.text}</div>}
                  <div className="text-[10px] text-slate-400">{relTime(a.createdAt)}</div>
                </li>
              ))}
              {activity.length === 0 && <li className="text-xs text-slate-400">No activity yet.</li>}
            </ol>
          </section>
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" onClick={e => { e.stopPropagation(); setConfirm(null); }}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="text-base font-bold text-slate-900">{confirm === "lost" ? `Mark “${d.title}” as lost?` : `Delete “${d.title}”?`}</div>
            <p className="mt-1 text-sm text-slate-500">{confirm === "lost" ? "It leaves the pipeline. A manager can reopen it later." : "This removes it and its history permanently."}</p>
            {confirm === "lost" && (
              <input autoFocus value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (optional)"
                className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancel</button>
              <button onClick={() => {
                const kind = confirm; setConfirm(null);
                if (kind === "lost") run("lost", () => P.markLost(d, actor, reason.trim()));
                else run("del", async () => { await P.deleteDeliverable(d.id); onClose(); return null; });
              }} className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 cursor-pointer">
                {confirm === "lost" ? "Mark lost" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SmallBtn({ children, icon, onClick, danger }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer
      ${danger ? "border-red-200 text-red-600 hover:bg-red-50" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
      {icon}{children}
    </button>
  );
}

function ChecklistRow({ item, answer, editable, busy, onSet, onUpload }: {
  item: P.MilestoneChecklistItem; answer?: P.ChecklistAnswer; editable: boolean; busy: boolean;
  onSet: (value: string | undefined, done: boolean) => void; onUpload: (f: File) => void;
}) {
  const done = !!answer?.done;
  const [val, setVal] = useState(answer?.value || "");
  useEffect(() => { setVal(answer?.value || ""); }, [answer?.value]);
  const commit = () => {
    const v = val.trim();
    if (v === (answer?.value || "")) return;
    onSet(v || undefined, !!v);
  };
  const inputType = item.type === "number" || item.type === "amount" ? "number" : item.type === "date" ? "date" : "text";

  return (
    <div className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition ${done ? "bg-emerald-50/70" : "bg-slate-50"}`}>
      {item.type === "tick" ? (
        <button disabled={!editable || busy} onClick={() => onSet(undefined, !done)}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition cursor-pointer disabled:cursor-default
            ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white"}`}>
          {busy ? <Loader2 className="h-3 w-3 animate-spin text-slate-400" /> : done && <Check className="h-3.5 w-3.5" />}
        </button>
      ) : (
        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${done ? "bg-emerald-500 text-white" : "bg-white ring-2 ring-slate-300"}`}>
          {busy ? <Loader2 className="h-3 w-3 animate-spin text-slate-400" /> : done && <Check className="h-3 w-3" />}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm text-slate-800">
          {item.text || "Untitled item"}
          {item.required ? <span className="ml-1 text-red-500">*</span> : <span className="ml-1.5 text-[10px] font-medium text-slate-400">optional</span>}
        </div>
        {item.type === "file" ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {answer?.value && <a href={answer.value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"><Paperclip className="h-3 w-3" /> View file</a>}
            {editable && (
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100">
                <Paperclip className="h-3 w-3" /> {answer?.value ? "Replace" : "Attach photo / file"}
                <input type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
              </label>
            )}
          </div>
        ) : item.type !== "tick" && (
          editable ? (
            <input type={inputType} value={val} onChange={e => setVal(e.target.value)} onBlur={commit}
              onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              placeholder={item.type === "amount" ? "₹" : "Enter…"}
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-400 focus:outline-none" />
          ) : answer?.value ? (
            <div className="mt-0.5 text-sm font-semibold text-slate-700">{item.type === "amount" ? P.formatINR(Number(answer.value)) : answer.value}</div>
          ) : null
        )}
        {answer?.done && answer.by && <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400"><Clock className="h-2.5 w-2.5" /> {answer.by}{answer.at ? ` · ${new Date(answer.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}</div>}
      </div>
    </div>
  );
}

function DetailsForm({ d, users, project, canManage, onSave, onCancel }: {
  d: P.Deliverable; users: User[]; project: P.Project; canManage: boolean;
  onSave: (patch: Parameters<typeof P.updateDeliverableDetails>[1]) => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState(d.title);
  const [value, setValue] = useState(d.value ? String(d.value) : "");
  const [contactName, setContactName] = useState(d.contactName);
  const [contactPhone, setContactPhone] = useState(d.contactPhone);
  const [ownerUserId, setOwnerUserId] = useState(d.ownerUserId);
  const [notes, setNotes] = useState(d.notes);
  const members = users.filter(u => project.memberIds.includes(u.id) || u.id === d.ownerUserId);
  const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none";
  return (
    <form className="space-y-2.5 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4" onSubmit={e => {
      e.preventDefault();
      onSave({ title: title.trim() || d.title, value: Number(value) || 0, contactName, contactPhone, notes, ...(canManage ? { ownerUserId } : {}) });
    }}>
      <input className={input} value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" />
      <div className="grid grid-cols-2 gap-2">
        <input className={input} value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Contact name" />
        <input className={input} value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="Phone" inputMode="tel" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className={input} type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="Value ₹" />
        <select className={input} value={ownerUserId} disabled={!canManage} onChange={e => setOwnerUserId(e.target.value)}>
          {members.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      <textarea className={input} rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white cursor-pointer">Cancel</button>
        <button className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 cursor-pointer">Save</button>
      </div>
    </form>
  );
}
