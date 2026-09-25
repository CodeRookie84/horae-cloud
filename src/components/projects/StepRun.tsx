/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StepRun — one member's run through a project's steps: the 0–100 step gauge,
 * then the steps in order. The current step holds its required uploads/entries,
 * approval, step updates (text + optional file) and "Complete step". Done steps
 * open read-only; later steps are locked. Rendered inline for the member
 * ("My progress") and inside a drawer when a manager opens someone's run.
 */
import React, { useEffect, useState } from "react";
import {
  X, Check, Lock, Paperclip, ShieldCheck, Clock, Send, Loader2, ChevronDown, Trophy, Undo2, AlertTriangle,
} from "lucide-react";
import type { User } from "../../types";
import * as P from "../../services/projectsService";
import StepGauge from "./StepGauge";

interface Props {
  project: P.Project;
  run: P.Deliverable;
  owner?: User;
  actor: P.Actor;
  /** Admin / authorised manager: approve, send back, reopen. */
  canManage: boolean;
  onChanged: (d: P.Deliverable) => void;
}

const relTime = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};
const shortDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";

export function StepRun({ project, run: d, owner, actor, canManage, onChanged }: Props) {
  const ms = project.milestones;
  const curIdx = P.currentStepIndex(d, project);
  const complete = d.status === "won";
  const canEdit = canManage || d.ownerUserId === actor.id;
  const pct = P.stepProgress(d, project);
  const overdue = P.isOverdue(d, project);

  const [openIdx, setOpenIdx] = useState<number>(Math.min(curIdx, ms.length - 1));
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [activity, setActivity] = useState<P.ActivityEntry[]>([]);

  useEffect(() => { setOpenIdx(Math.min(curIdx, ms.length - 1)); }, [d.id, curIdx]);
  const loadActivity = () => P.getActivity(d.id).then(setActivity).catch(() => {});
  useEffect(() => { loadActivity(); }, [d.id, d.updatedAt]);

  const run = async (key: string, fn: () => Promise<P.Deliverable | void>) => {
    setBusy(key); setErr("");
    try {
      const next = await fn();
      if (next) onChanged(next);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong.");
    } finally { setBusy(""); }
  };

  // When a step completes, the old step's "done" timestamp is the activity entry.
  const completedAt = (mid: string) => activity.find(a => a.milestoneId === mid && (a.kind === "moved" || a.kind === "won"))?.createdAt;

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex justify-center">
          <StepGauge value={pct} steps={ms.length}
            caption={complete ? "All steps completed" : `Step ${curIdx + 1} of ${ms.length} · ${ms[curIdx]?.name || ""}`} />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs">
          {complete && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700"><Trophy className="h-3.5 w-3.5" /> Completed {shortDate(d.closedAt)}</span>}
          {overdue && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-600"><AlertTriangle className="h-3.5 w-3.5" /> {P.daysInMilestone(d)} days on this step (limit {ms[curIdx]?.slaDays}d)</span>}
          {!complete && !overdue && ms[curIdx] && <span className="text-slate-400">{P.daysInMilestone(d)}d on this step · limit {ms[curIdx].slaDays}d</span>}
        </div>
        {canManage && (complete || curIdx > 0) && (
          <div className="mt-3 flex justify-center">
            <button disabled={!!busy} onClick={() => run("back", () => P.moveBack(d, project, actor))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
              <Undo2 className="h-3.5 w-3.5" /> {complete ? "Reopen last step" : "Send back one step"}
            </button>
          </div>
        )}
      </section>

      {err && <div className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{err}</div>}

      <ol className="space-y-3">
        {ms.map((m, i) => {
          const done = i < curIdx;
          const current = i === curIdx && !complete;
          const locked = i > curIdx;
          const open = openIdx === i && !locked;
          const items = m.checklist.length;
          const doneItems = m.checklist.filter(it => d.checklist[m.id]?.[it.id]?.done).length;
          return (
            <li key={m.id} className={`overflow-hidden rounded-2xl border bg-white transition ${current ? "border-indigo-300 shadow-sm shadow-indigo-100" : "border-slate-200"}`}>
              <button type="button" disabled={locked} onClick={() => setOpenIdx(open ? -1 : i)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left cursor-pointer disabled:cursor-default">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold
                  ${done ? "bg-emerald-500 text-white" : current ? "text-white" : "bg-slate-100 text-slate-400"}`}
                  style={current ? { background: P.progressColor(pct) } : undefined}>
                  {done ? <Check className="h-4 w-4" /> : locked ? <Lock className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-sm font-bold ${locked ? "text-slate-400" : "text-slate-900"}`}>{m.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {done ? `Done${completedAt(m.id) ? ` · ${shortDate(completedAt(m.id))}` : ""}`
                      : current ? (items ? `${doneItems} of ${items} items done` : "In progress")
                      : `${items} item${items === 1 ? "" : "s"}`}
                    {m.requiresApproval && " · needs approval"}
                  </div>
                </div>
                {current && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">Current</span>}
                {!locked && <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />}
              </button>

              {open && (
                <div className="space-y-4 border-t border-slate-100 px-4 py-4">
                  {m.checklist.length > 0 && (
                    <div className="space-y-2">
                      {m.checklist.map(it => (
                        <ChecklistRow key={it.id} item={it} answer={d.checklist[m.id]?.[it.id]} editable={canEdit && current}
                          busy={busy === `ci-${it.id}`}
                          onSet={(value, isDone) => run(`ci-${it.id}`, () =>
                            P.setChecklistAnswer(d, m.id, it.id, { done: isDone, value, by: actor.name, at: new Date().toISOString() }))}
                          onUpload={(file) => run(`ci-${it.id}`, async () => {
                            const url = await P.uploadProjectFile(file, { clientId: project.clientId, projectId: project.id });
                            return P.setChecklistAnswer(d, m.id, it.id, { done: true, value: url, by: actor.name, at: new Date().toISOString() });
                          })} />
                      ))}
                    </div>
                  )}

                  {current && <StepGate project={project} run={d} actor={actor} canEdit={canEdit} canManage={canManage}
                    busy={busy} onRun={run} isLast={i === ms.length - 1} />}

                  <StepUpdates entries={activity.filter(a => a.milestoneId === m.id)}
                    canPost={canEdit && (current || canManage)}
                    onPost={async (text, file) => {
                      await run("upd", async () => {
                        const url = file ? await P.uploadProjectFile(file, { clientId: project.clientId, projectId: project.id }) : undefined;
                        await P.addStepUpdate(d, m.id, actor, text, url);
                        await loadActivity();
                      });
                    }} busy={busy === "upd"} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Approval + "Complete step" for the current step. */
function StepGate({ project, run: d, actor, canEdit, canManage, busy, onRun, isLast }: {
  project: P.Project; run: P.Deliverable; actor: P.Actor; canEdit: boolean; canManage: boolean; busy: string; isLast: boolean;
  onRun: (key: string, fn: () => Promise<P.Deliverable | void>) => void;
}) {
  const m = project.milestones.find(x => x.id === d.milestoneId);
  const block = P.advanceBlock(d, project);
  const approval = m ? d.approvals[m.id] : undefined;
  const [note, setNote] = useState("");
  if (!m) return null;

  return (
    <div className="space-y-3 rounded-2xl bg-slate-50 p-3">
      {block?.kind === "checklist" && (
        <p className="flex items-center gap-1.5 text-xs text-slate-500"><Lock className="h-3.5 w-3.5" />
          {block.missing.length} required item{block.missing.length > 1 ? "s" : ""} left before this step can be completed.</p>
      )}
      {block?.kind === "approval" && (
        <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <div className="flex items-center gap-1.5 font-semibold"><ShieldCheck className="h-3.5 w-3.5" />
            {approval?.status === "pending" ? `Waiting for approval · requested by ${approval.requestedBy}`
              : approval?.status === "rejected" ? `Sent back by ${approval.decidedBy}${approval.note ? ` — “${approval.note}”` : ""}`
              : "This step needs approval before it can be completed"}
          </div>
          {canManage && approval?.status === "pending" && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)"
                className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs focus:outline-none" />
              <button disabled={!!busy} onClick={() => onRun("approve", () => P.decideApproval(d, project, actor, true, note))}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer">Approve</button>
              <button disabled={!!busy} onClick={() => onRun("reject", () => P.decideApproval(d, project, actor, false, note))}
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 cursor-pointer">Send back</button>
            </div>
          )}
          {canEdit && approval?.status !== "pending" && (
            <button disabled={!!busy} onClick={() => onRun("req", () => P.requestApproval(d, project, actor))}
              className="mt-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50 cursor-pointer">
              {busy === "req" ? "Requesting…" : approval?.status === "rejected" ? "Request approval again" : "Request approval"}
            </button>
          )}
        </div>
      )}
      {!block && approval?.status === "approved" && m.requiresApproval && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" />
          Approved by {approval.decidedBy}{approval.note ? ` — “${approval.note}”` : ""}</p>
      )}
      {canEdit && (
        <button disabled={!!block || !!busy} onClick={() => onRun("adv", () => P.advanceDeliverable(d, project, actor))}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition cursor-pointer disabled:cursor-not-allowed
            ${block ? "bg-slate-200 text-slate-400" : isLast ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}>
          {busy === "adv" ? <Loader2 className="h-4 w-4 animate-spin" /> : isLast ? <Trophy className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          {isLast ? "Complete final step" : "Complete step"}
        </button>
      )}
    </div>
  );
}

/** Step-scoped updates: free text + optional photo/file, plus the step's history. */
function StepUpdates({ entries, canPost, onPost, busy }: {
  entries: P.ActivityEntry[]; canPost: boolean; busy: boolean; onPost: (text: string, file?: File) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  if (!canPost && entries.length === 0) return null;
  return (
    <div>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Updates</div>
      {canPost && (
        <form className="mb-3 space-y-2" onSubmit={async e => {
          e.preventDefault();
          if (!text.trim() && !file) return;
          await onPost(text.trim() || (file ? "Attached a file" : ""), file || undefined);
          setText(""); setFile(null);
        }}>
          <div className="flex gap-2">
            <input value={text} onChange={e => setText(e.target.value)} placeholder="Add an update…"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none" />
            <label title="Attach photo / file" className="flex cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-2.5 text-slate-500 hover:bg-slate-50">
              <Paperclip className="h-4 w-4" />
              <input type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" className="hidden"
                onChange={e => { setFile(e.target.files?.[0] || null); e.target.value = ""; }} />
            </label>
            <button disabled={busy || (!text.trim() && !file)} className="rounded-xl bg-slate-900 px-3 text-white hover:bg-slate-700 disabled:opacity-40 cursor-pointer">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          {file && (
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Paperclip className="h-3 w-3" /><span className="truncate">{file.name}</span>
              <button type="button" onClick={() => setFile(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="h-3 w-3" /></button>
            </div>
          )}
        </form>
      )}
      <ol className="relative space-y-3 border-l border-slate-200 pl-4">
        {entries.map(a => (
          <li key={a.id} className="relative">
            <span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
              a.kind === "won" || a.kind === "approved" || a.kind === "moved" ? "bg-emerald-500" : a.kind === "rejected" || a.kind === "sent_back" ? "bg-red-500"
              : a.kind === "comment" ? "bg-slate-400" : "bg-indigo-500"}`} />
            <div className="text-xs text-slate-700"><span className="font-semibold">{a.userName || "Someone"}</span> <span className="text-slate-400">· {relTime(a.createdAt)}</span></div>
            {a.text && <div className={`text-sm ${a.kind === "comment" ? "mt-0.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-slate-800" : "text-slate-600"}`}>{a.text}</div>}
            {a.fileUrl && (
              /\.(jpe?g|png|webp|gif)(\?|$)/i.test(a.fileUrl)
                ? <a href={a.fileUrl} target="_blank" rel="noreferrer"><img src={a.fileUrl} alt="" className="mt-1.5 max-h-40 rounded-lg ring-1 ring-slate-200" /></a>
                : <a href={a.fileUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"><Paperclip className="h-3 w-3" /> View file</a>
            )}
          </li>
        ))}
        {entries.length === 0 && <li className="text-xs text-slate-400">No updates on this step yet.</li>}
      </ol>
    </div>
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
  const isImage = answer?.value && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(answer.value);

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
            {answer?.value && (isImage
              ? <a href={answer.value} target="_blank" rel="noreferrer"><img src={answer.value} alt="" className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200" /></a>
              : <a href={answer.value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"><Paperclip className="h-3 w-3" /> View file</a>)}
            {editable && (
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100">
                <Paperclip className="h-3 w-3" /> {answer?.value ? "Replace" : "Upload photo / file"}
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
        {answer?.done && answer.by && <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400"><Clock className="h-2.5 w-2.5" /> {answer.by}{answer.at ? ` · ${shortDate(answer.at)}` : ""}</div>}
      </div>
    </div>
  );
}

/** A manager opening someone's run. */
export function StepRunDrawer({ onClose, ...props }: Props & { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto bg-slate-50 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            {props.owner && <img src={props.owner.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />}
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{props.project.name}</div>
              <h2 className="truncate text-lg font-bold text-slate-900">{props.owner?.name || props.run.title}</h2>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4"><StepRun {...props} /></div>
      </div>
    </div>
  );
}
