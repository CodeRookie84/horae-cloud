/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// Training (admin view): upload a document, AI-draft a test (admin reviews/edits),
// target it to outlets/departments/roles, set the pass mark + retest policy, and
// track every staff member's score with a per-person "allow retest" override.

import React, { useMemo, useState } from "react";
import {
  GraduationCap, Plus, Upload, Sparkles, Trash2, Check, X, Users, BarChart3,
  Bell, Send, Download, Loader2, FileText, Pencil, Eye, EyeOff, ChevronDown, ClipboardList,
} from "lucide-react";
import { Training as TrainingT, TrainingAttempt, TrainingQuestion, User as AppUser, Tenant, Department, Role } from "../types";
import * as svc from "../services/trainingService";
import { trainingMatchesUser, trainingStatus } from "../services/trainingService";
import { store } from "../services/store";
import { extractDocText } from "../services/docExtract";

interface Props {
  trainings: TrainingT[];
  attempts: TrainingAttempt[];
  activeUser: AppUser;
  clientId: string;
  tenants: Tenant[];
  clientUsers: AppUser[];
  onChanged: () => Promise<void> | void;
}

const uid = () => `TR-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 46656).toString(36)}`;
const blankQ = (): TrainingQuestion => ({ id: `q-${Math.random().toString(36).slice(2, 8)}`, question: "", options: ["", "", "", ""], correctIndex: 0 });

export default function TrainingAdmin({ trainings, attempts, activeUser, clientId, tenants, clientUsers, onChanged }: Props) {
  const [editing, setEditing] = useState<TrainingT | null>(null);
  const [scoresFor, setScoresFor] = useState<TrainingT | null>(null);
  const [showAppraisal, setShowAppraisal] = useState(false);

  const newTraining = (): TrainingT => ({
    id: uid(), clientId, tenantId: activeUser.tenantId, title: "", description: "",
    docUrl: "", docName: "", docType: "", sourceNotes: "",
    outlets: [], department: Department.ALL, role: Role.ALL,
    passPct: 70, allowRetest: true, maxAttempts: 3, shuffle: true, dueDate: "",
    questions: [], retestGrants: [], published: false,
    createdBy: activeUser.id, createdByName: activeUser.name, createdAt: new Date().toISOString(),
  });

  if (editing) return <TrainingEditor training={editing} tenants={tenants} clientUsers={clientUsers} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await onChanged(); }} />;
  if (scoresFor) return <ScoresView training={scoresFor} attempts={attempts} clientUsers={clientUsers} tenants={tenants} onBack={() => setScoresFor(null)} onChanged={onChanged} />;
  if (showAppraisal) return <AppraisalView trainings={trainings} attempts={attempts} clientUsers={clientUsers} tenants={tenants} onBack={() => setShowAppraisal(false)} />;

  return (
    <div className="space-y-4 text-left">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><GraduationCap className="w-4.5 h-4.5 text-indigo-600" /> Training Courses</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Upload material, generate a test, and track staff certification.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAppraisal(true)} className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer">
            <BarChart3 className="w-4 h-4" /> Appraisal report
          </button>
          <button onClick={() => setEditing(newTraining())} className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer">
            <Plus className="w-4 h-4" /> New training
          </button>
        </div>
      </div>

      {trainings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 text-center py-12">
          <GraduationCap className="mx-auto w-10 h-10 text-slate-300 mb-2" />
          <p className="text-xs font-bold text-slate-700">No trainings yet</p>
          <p className="text-[10px] text-slate-400 mt-1">Create your first course to assign staff training.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trainings.map(t => {
            const att = attempts.filter(a => a.trainingId === t.id);
            const passers = new Set(att.filter(a => a.passed).map(a => a.userId)).size;
            const takers = new Set(att.map(a => a.userId)).size;
            const target = clientUsers.filter(u => trainingMatchesUser(t, { tenantId: u.tenantId, department: String(u.department), role: String(u.role) })).length;
            return (
              <div key={t.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className={`text-[9px] font-bold border px-1.5 py-0.5 rounded-full ${t.published ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-50 text-slate-500 border-slate-200"}`}>{t.published ? "Published" : "Draft"}</span>
                      <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded-full">{t.questions.length} Qs · {t.passPct}%</span>
                      {t.dueDate && <span className="text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded-full">due {t.dueDate}</span>}
                    </div>
                    <h4 className="text-sm font-bold text-slate-850 truncate">{t.title || "Untitled"}</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {t.outlets.length === 0 ? "All outlets" : `${t.outlets.length} outlet(s)`} · {String(t.department)} · {String(t.role)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[10px] text-slate-500 border-t border-slate-50 pt-2">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {target} assigned</span>
                  <span className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-500" /> {passers} passed</span>
                  <span>{takers} attempted</span>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button onClick={() => setScoresFor(t)} className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold rounded-lg cursor-pointer flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> Scores</button>
                  <button onClick={() => setEditing(t)} className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold rounded-lg cursor-pointer flex items-center gap-1"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                  <button onClick={async () => { await svc.setPublished(t.id, !t.published); await onChanged(); }} className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold rounded-lg cursor-pointer flex items-center gap-1">
                    {t.published ? <><EyeOff className="w-3.5 h-3.5" /> Unpublish</> : <><Eye className="w-3.5 h-3.5" /> Publish</>}
                  </button>
                  <button onClick={async () => {
                    const targetIds = clientUsers.filter(u => trainingMatchesUser(t, { tenantId: u.tenantId, department: String(u.department), role: String(u.role) }))
                      .filter(u => !attempts.some(a => a.trainingId === t.id && a.userId === u.id && a.passed)).map(u => u.id);
                    if (!targetIds.length) { alert("Everyone assigned has already passed 🎉"); return; }
                    await svc.sendTrainingReminder(t.id, t.title, targetIds, activeUser.tenantId, t.dueDate);
                    alert(`Reminder sent to ${targetIds.length} staff who haven't passed yet.`);
                  }} className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-100 text-[10px] font-bold rounded-lg cursor-pointer flex items-center gap-1"><Bell className="w-3.5 h-3.5" /> Remind</button>
                  <button onClick={async () => { if (confirm(`Delete "${t.title}" and all its attempts?`)) { await svc.deleteTraining(t.id); await onChanged(); } }} className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 text-[10px] font-bold rounded-lg cursor-pointer flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Editor ──────────────────────────────────────────────────────────────────────
function TrainingEditor({ training, tenants, clientUsers, onClose, onSaved }: {
  training: TrainingT; tenants: Tenant[]; clientUsers: AppUser[]; onClose: () => void; onSaved: () => void;
}) {
  const [t, setT] = useState<TrainingT>({ ...training });
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const set = (patch: Partial<TrainingT>) => setT(prev => ({ ...prev, ...patch }));

  const addBulk = () => {
    const parsed = svc.parseQuestionsFromText(bulkText);
    if (parsed.length === 0) { setErr("Couldn't read any questions — check the format (blank line between questions, * before the correct answer)."); return; }
    set({ questions: [...t.questions, ...parsed] });
    setBulkText(""); setShowBulk(false); setErr("");
  };

  // Departments & roles come from the SAME sources onboarding uses: staff already
  // onboarded for this client + the custom roles/departments defined at onboarding.
  const depts = useMemo(() => {
    const s = new Set<string>();
    clientUsers.forEach(u => { const d = String(u.department || "").trim(); if (d) s.add(d); });
    store.getCustomDepts().forEach(d => { if (d && d.trim()) s.add(d.trim()); });
    return Array.from(s).sort();
  }, [clientUsers]);
  const roles = useMemo(() => {
    const s = new Set<string>();
    clientUsers.forEach(u => { const r = String(u.role || "").trim(); if (r) s.add(r); });
    store.getCustomRoles().forEach(r => { if (r && r.trim()) s.add(r.trim()); });
    return Array.from(s).sort();
  }, [clientUsers]);

  const onUpload = async (file?: File | null) => {
    if (!file) return;
    setUploading(true); setErr("");
    try {
      const r = await svc.uploadTrainingDoc(file);
      const patch: Partial<TrainingT> = { docUrl: r.url, docName: r.name, docType: r.type };
      // Auto-extract text from PPTX/DOCX (in the browser) to prefill the notes box.
      try {
        const text = await extractDocText(file);
        if (text && !t.sourceNotes?.trim()) patch.sourceNotes = text.slice(0, 12000);
      } catch (ex) { console.error("[training] doc text extraction failed", ex); }
      set(patch);
    }
    catch (e: any) { setErr(e?.message || "Upload failed."); }
    finally { setUploading(false); }
  };

  const onGenerate = async () => {
    if (!t.title.trim()) { setErr("Add a title first."); return; }
    setGenerating(true); setErr("");
    try {
      const qs = await svc.generateQuestions({ title: t.title, docUrl: t.docUrl, docType: t.docType, sourceNotes: t.sourceNotes, count: 8 });
      if (qs.length === 0) { setErr("No questions came back — try again or add them manually."); }
      else set({ questions: [...t.questions, ...qs] });
    } catch (e: any) {
      console.error("[training] AI generation error:", e);
      setErr(e?.message || String(e) || "Generation failed.");
    }
    finally { setGenerating(false); }
  };

  const setQ = (i: number, patch: Partial<TrainingQuestion>) => set({ questions: t.questions.map((q, j) => j === i ? { ...q, ...patch } : q) });
  const setOpt = (qi: number, oi: number, val: string) => setQ(qi, { options: t.questions[qi].options.map((o, j) => j === oi ? val : o) });

  const save = async (publish: boolean) => {
    if (!t.title.trim()) { setErr("A title is required."); return; }
    const clean = t.questions.filter(q => q.question.trim() && q.options.filter(o => o.trim()).length >= 2);
    if (publish && clean.length === 0) { setErr("Add at least one complete question before publishing."); return; }
    setSaving(true); setErr("");
    try {
      await svc.saveTraining({ ...t, questions: clean, published: publish || t.published });
      onSaved();
    } catch (e: any) { setErr(e?.message || "Save failed."); }
    finally { setSaving(false); }
  };

  const toggleOutlet = (id: string) => set({ outlets: t.outlets.includes(id) ? t.outlets.filter(x => x !== id) : [...t.outlets, id] });

  // Departments & roles support "All / pick specific" like outlets. Stored as a
  // comma-separated list (isTargetMatched handles that) or the "All …" sentinel.
  const parseSel = (v: string, allVal: string): string[] => {
    const s = String(v || "").trim();
    if (!s || s === allVal || s === "ALL") return [];
    return s.split(",").map(x => x.trim()).filter(Boolean);
  };
  const deptSel = parseSel(String(t.department), Department.ALL);
  const roleSel = parseSel(String(t.role), Role.ALL);
  const toggleDept = (d: string) => { const n = deptSel.includes(d) ? deptSel.filter(x => x !== d) : [...deptSel, d]; set({ department: n.length ? n.join(",") : Department.ALL }); };
  const toggleRole = (r: string) => { const n = roleSel.includes(r) ? roleSel.filter(x => x !== r) : [...roleSel, r]; set({ role: n.length ? n.join(",") : Role.ALL }); };

  return (
    <div className="space-y-4 text-left">
      <button onClick={onClose} className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1"><X className="w-4 h-4" /> Close editor</button>

      {err && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">{err}</div>}

      {/* Basics */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800">Course details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><label className="lbl">Title</label><input className="inp" value={t.title} onChange={e => set({ title: e.target.value })} placeholder="e.g. Ownership & Accountability Culture" /></div>
          <div className="sm:col-span-2"><label className="lbl">Description</label><textarea className="inp" rows={2} value={t.description} onChange={e => set({ description: e.target.value })} placeholder="Short summary shown to staff" /></div>
        </div>

        <div>
          <label className="lbl">Training material (PPT / PDF / Word / image)</label>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-pointer flex items-center gap-1.5">
              <Upload className="w-4 h-4" /> {uploading ? "Uploading…" : "Upload file"}
              <input type="file" className="hidden" accept=".pdf,.ppt,.pptx,.doc,.docx,image/*" onChange={e => onUpload(e.target.files?.[0])} />
            </label>
            {t.docUrl && <span className="text-[11px] text-slate-600 flex items-center gap-1 truncate"><FileText className="w-4 h-4 text-indigo-500" />{t.docName}</span>}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">Upload a <b>PPT or Word</b> file and its text is pulled into the notes box automatically (in your browser — the file isn't sent anywhere for this). Edit if needed, then Generate. PDFs/images are read directly when a Gemini key is set.</p>
          <textarea className="inp mt-2" rows={3} value={t.sourceNotes} onChange={e => set({ sourceNotes: e.target.value })} placeholder="Optional: paste key points / summary for the AI to generate questions from" />
        </div>
      </div>

      {/* Questions */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-bold text-slate-800">Test questions <span className="text-slate-400 font-normal">({t.questions.length})</span></h3>
          <div className="flex gap-2 flex-wrap">
            <button onClick={onGenerate} disabled={generating} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg cursor-pointer flex items-center gap-1.5 disabled:opacity-60">
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} {generating ? "Drafting…" : "Generate with AI"}
            </button>
            <button onClick={() => setShowBulk(s => !s)} className={`px-3 py-1.5 text-[11px] font-bold rounded-lg cursor-pointer flex items-center gap-1 border ${showBulk ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"}`}><ClipboardList className="w-3.5 h-3.5" /> Paste questions</button>
            <button onClick={() => set({ questions: [...t.questions, blankQ()] })} className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-bold rounded-lg cursor-pointer flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add one</button>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 -mt-2">Paste a batch of questions, generate with AI, or add them one at a time. Review and mark the correct answer before publishing.</p>

        {showBulk && (
          <div className="rounded-xl border border-indigo-150 bg-indigo-50/40 p-4 space-y-3">
            <div className="text-[11px] text-slate-700 font-bold">Paste your questions in this format:</div>
            <pre className="text-[10.5px] leading-relaxed bg-white border border-slate-200 rounded-lg p-3 overflow-x-auto text-slate-600 whitespace-pre">{`What does taking ownership mean?
*Taking responsibility for your tasks and their outcomes
Blaming others when something goes wrong
Only doing what you are told
Waiting for your manager to fix problems

A colleague makes a mistake. What is the accountable response?
Ignore it, it is not your problem
*Help fix it and flag it so it does not repeat
Tell everyone whose fault it was
Wait for the manager to notice`}</pre>
            <ul className="text-[10.5px] text-slate-500 list-disc pl-4 space-y-0.5">
              <li>Leave a <b>blank line</b> between questions (or a line with <code>---</code>).</li>
              <li>First line = the question. Each line after = an option.</li>
              <li>Put a <b><code>*</code></b> in front of the <b>correct</b> option (or end it with <code>(correct)</code>).</li>
              <li>Optional <code>a)</code> / <code>b.</code> labels are removed automatically.</li>
            </ul>
            <textarea className="inp font-mono text-[11px]" rows={8} value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder="Paste your questions here…" />
            <div className="flex gap-2">
              <button onClick={addBulk} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg cursor-pointer">Add these questions</button>
              <button onClick={() => { setBulkText(""); setShowBulk(false); }} className="px-3 py-2 text-slate-500 hover:text-slate-800 text-[11px] font-bold">Cancel</button>
            </div>
          </div>
        )}

        {t.questions.length === 0 && <div className="text-center py-8 text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-xl">No questions yet. Generate with AI or add manually.</div>}

        <div className="space-y-4">
          {t.questions.map((q, qi) => (
            <div key={q.id} className="p-4 rounded-xl border border-slate-150 bg-slate-50/40 space-y-2.5">
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-bold text-slate-400 mt-2.5">{qi + 1}.</span>
                <textarea className="inp flex-1" rows={2} value={q.question} onChange={e => setQ(qi, { question: e.target.value })} placeholder="Question" />
                <button onClick={() => set({ questions: t.questions.filter((_, j) => j !== qi) })} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg mt-1"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-5">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <button onClick={() => setQ(qi, { correctIndex: oi })} title="Mark correct" className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${q.correctIndex === oi ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 text-transparent hover:border-emerald-400"}`}><Check className="w-3 h-3" /></button>
                    <input className="inp py-1.5" value={opt} onChange={e => setOpt(qi, oi, e.target.value)} placeholder={`Option ${oi + 1}`} />
                    {q.options.length > 2 && <button onClick={() => setQ(qi, { options: q.options.filter((_, j) => j !== oi), correctIndex: Math.min(q.correctIndex, q.options.length - 2) })} className="text-slate-300 hover:text-rose-500"><X className="w-3.5 h-3.5" /></button>}
                  </div>
                ))}
              </div>
              {q.options.length < 6 && <button onClick={() => setQ(qi, { options: [...q.options, ""] })} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 pl-5">+ Add option</button>}
            </div>
          ))}
        </div>
      </div>

      {/* Targeting + policy */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800">Who can access &amp; rules</h3>
        <div>
          <label className="lbl">Outlets</label>
          <label className="flex items-center gap-2 text-xs text-slate-600 mb-2 cursor-pointer">
            <input type="checkbox" checked={t.outlets.length === 0} onChange={e => set({ outlets: e.target.checked ? [] : tenants.map(x => x.id) })} className="accent-indigo-600 w-4 h-4" /> All outlets
          </label>
          {t.outlets.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {tenants.map(o => (
                <label key={o.id} className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer border border-slate-150 rounded-lg px-2 py-1.5">
                  <input type="checkbox" checked={t.outlets.includes(o.id)} onChange={() => toggleOutlet(o.id)} className="accent-indigo-600" /> {o.logo} {o.name}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="lbl">Departments</label>
            <label className="flex items-center gap-2 text-xs text-slate-600 mb-2 cursor-pointer">
              <input type="checkbox" checked={deptSel.length === 0} onChange={e => set({ department: e.target.checked ? Department.ALL : depts.join(",") })} className="accent-indigo-600 w-4 h-4" /> All departments
            </label>
            {deptSel.length > 0 && (
              <div className="space-y-1.5">
                {depts.length === 0 && <p className="text-[10px] text-slate-400">No departments onboarded yet.</p>}
                {depts.map(d => (
                  <label key={d} className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer border border-slate-150 rounded-lg px-2 py-1.5">
                    <input type="checkbox" checked={deptSel.includes(d)} onChange={() => toggleDept(d)} className="accent-indigo-600" /> {d}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="lbl">Roles</label>
            <label className="flex items-center gap-2 text-xs text-slate-600 mb-2 cursor-pointer">
              <input type="checkbox" checked={roleSel.length === 0} onChange={e => set({ role: e.target.checked ? Role.ALL : roles.join(",") })} className="accent-indigo-600 w-4 h-4" /> All roles
            </label>
            {roleSel.length > 0 && (
              <div className="space-y-1.5">
                {roles.length === 0 && <p className="text-[10px] text-slate-400">No roles onboarded yet.</p>}
                {roles.map(r => (
                  <label key={r} className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer border border-slate-150 rounded-lg px-2 py-1.5">
                    <input type="checkbox" checked={roleSel.includes(r)} onChange={() => toggleRole(r)} className="accent-indigo-600" /> {r}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><label className="lbl">Pass mark %</label><input type="number" min={1} max={100} className="inp" value={t.passPct} onChange={e => set({ passPct: Math.max(1, Math.min(100, Number(e.target.value) || 70)) })} /></div>
          <div><label className="lbl">Max attempts</label><input type="number" min={0} className="inp" value={t.maxAttempts} onChange={e => set({ maxAttempts: Math.max(0, Number(e.target.value) || 0) })} /><span className="text-[9px] text-slate-400">0 = unlimited</span></div>
          <div><label className="lbl">Due date</label><input type="date" className="inp" value={t.dueDate || ""} onChange={e => set({ dueDate: e.target.value })} /></div>
          <div className="flex flex-col gap-1.5 justify-end pb-1">
            <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer"><input type="checkbox" checked={t.allowRetest} onChange={e => set({ allowRetest: e.target.checked })} className="accent-indigo-600 w-4 h-4" /> Allow retest on fail</label>
            <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer"><input type="checkbox" checked={t.shuffle} onChange={e => set({ shuffle: e.target.checked })} className="accent-indigo-600 w-4 h-4" /> Shuffle questions</label>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 sticky bottom-0 bg-gradient-to-t from-white via-white to-transparent py-3">
        <button onClick={() => save(false)} disabled={saving} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-60">Save draft</button>
        <button onClick={() => save(true)} disabled={saving} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-60">{saving ? "Saving…" : "Save & publish"}</button>
      </div>

      <style>{`.lbl{display:block;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}
      .inp{width:100%;font-size:12.5px;padding:8px 11px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;outline:none}
      .inp:focus{border-color:#6366f1}`}</style>
    </div>
  );
}

// ── Scores dashboard ──────────────────────────────────────────────────────────
function ScoresView({ training, attempts, clientUsers, tenants, onBack, onChanged }: {
  training: TrainingT; attempts: TrainingAttempt[]; clientUsers: AppUser[]; tenants: Tenant[]; onBack: () => void; onChanged: () => Promise<void> | void;
}) {
  const [outletFilter, setOutletFilter] = useState("ALL");
  const tenantName = (id: string) => tenants.find(x => x.id === id)?.name || id;

  const assigned = useMemo(() => clientUsers.filter(u =>
    trainingMatchesUser(training, { tenantId: u.tenantId, department: String(u.department), role: String(u.role) }) &&
    (outletFilter === "ALL" || u.tenantId === outletFilter)
  ), [clientUsers, training, outletFilter]);

  const rows = assigned.map(u => {
    const mine = attempts.filter(a => a.trainingId === training.id && a.userId === u.id).sort((a, b) => b.attemptNo - a.attemptNo);
    const best = mine.reduce<TrainingAttempt | undefined>((b, a) => (!b || a.pct > b.pct ? a : b), undefined);
    const passed = mine.some(a => a.passed);
    const granted = training.retestGrants.includes(u.id);
    return { u, mine, best, passed, attempts: mine.length, granted };
  });

  const done = rows.filter(r => r.attempts > 0).length;
  const passedCount = rows.filter(r => r.passed).length;
  const avg = (() => { const b = rows.map(r => r.best?.pct).filter((x): x is number => x != null); return b.length ? Math.round(b.reduce((s, x) => s + x, 0) / b.length) : 0; })();

  const exportCsv = () => {
    const header = "Name,Outlet,Role,Attempts,Best %,Status,Last submitted\n";
    const body = rows.map(r => `"${r.u.name}","${tenantName(r.u.tenantId)}","${r.u.role}","${r.attempts}","${r.best?.pct ?? ""}","${r.passed ? "Passed" : r.attempts ? "Failed" : "Not started"}","${r.mine[0] ? new Date(r.mine[0].submittedAt).toLocaleString() : ""}"`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${training.title.replace(/\W+/g, "_")}_scores.csv`; a.click();
  };

  return (
    <div className="space-y-4 text-left">
      <button onClick={onBack} className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1"><X className="w-4 h-4" /> Back to trainings</button>
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div><h3 className="text-sm font-bold text-slate-800">{training.title} — Scores</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{passedCount}/{assigned.length} passed · {done} attempted · avg best {avg}%</p></div>
          <div className="flex items-center gap-2">
            <select className="text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl" value={outletFilter} onChange={e => setOutletFilter(e.target.value)}>
              <option value="ALL">All outlets</option>
              {(training.outlets.length ? tenants.filter(x => training.outlets.includes(x.id)) : tenants).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <button onClick={exportCsv} className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-xl cursor-pointer flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> CSV</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[640px]">
          <thead><tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3 font-bold">Staff</th><th className="px-4 py-3 font-bold">Outlet</th>
            <th className="px-4 py-3 font-bold text-center">Attempts</th><th className="px-4 py-3 font-bold text-center">Best</th>
            <th className="px-4 py-3 font-bold text-center">Status</th><th className="px-4 py-3 font-bold text-right">Retest</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[11px] text-slate-400">No staff assigned.</td></tr>}
            {rows.map(r => (
              <tr key={r.u.id} className="border-b border-slate-50 last:border-0 text-xs">
                <td className="px-4 py-3"><div className="font-bold text-slate-800">{r.u.name}</div><div className="text-[10px] text-slate-400">{r.u.role}</div></td>
                <td className="px-4 py-3 text-slate-500">{tenantName(r.u.tenantId)}</td>
                <td className="px-4 py-3 text-center font-mono">{r.attempts}</td>
                <td
                  className={`px-4 py-3 text-center font-bold font-mono ${r.mine.length > 0 ? "cursor-help border-b border-dotted border-slate-300 w-fit mx-auto" : ""}`}
                  title={r.mine.length > 0 ? r.mine.map(a => `Attempt ${a.attemptNo}: ${a.pct}% — ${new Date(a.submittedAt).toLocaleDateString()}`).join("\n") : undefined}
                >
                  {r.best ? `${r.best.pct}%` : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  {r.passed ? <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full">Passed</span>
                    : r.attempts ? <span className="text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-full">Failed</span>
                    : <span className="text-[9px] font-bold bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full">Not started</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  {!r.passed && r.attempts > 0 && (
                    <button onClick={async () => { await svc.setRetestGrant(training, r.u.id, !r.granted); await onChanged(); }}
                      className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg cursor-pointer border ${r.granted ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50"}`}>
                      {r.granted ? "Retest allowed ✓" : "Allow retest"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Appraisal report (per-employee across ALL published trainings) ─────────────
function AppraisalView({ trainings, attempts, clientUsers, tenants, onBack }: {
  trainings: TrainingT[]; attempts: TrainingAttempt[]; clientUsers: AppUser[]; tenants: Tenant[]; onBack: () => void;
}) {
  const [outletFilter, setOutletFilter] = useState("ALL");
  const tenantName = (id: string) => tenants.find(x => x.id === id)?.name || id;
  const courses = useMemo(() => trainings.filter(t => t.published && (t.questions?.length || 0) > 0), [trainings]);

  const staff = useMemo(() => clientUsers
    .filter(u => outletFilter === "ALL" || u.tenantId === outletFilter)
    .sort((a, b) => a.name.localeCompare(b.name)), [clientUsers, outletFilter]);

  const rows = useMemo(() => staff.map(u => {
    const assigned = courses.filter(t => trainingMatchesUser(t, { tenantId: u.tenantId, department: String(u.department), role: String(u.role) }));
    const perCourse = assigned.map(t => {
      const st = trainingStatus(t, u.id, attempts);
      return { id: t.id, status: st.status, best: st.best?.pct, attempts: st.attemptsUsed };
    });
    const passed = perCourse.filter(c => c.status === "passed").length;
    const bests = perCourse.map(c => c.best).filter((x): x is number => x != null);
    const avg = bests.length ? Math.round(bests.reduce((s, x) => s + x, 0) / bests.length) : null;
    const completion = assigned.length ? Math.round((passed / assigned.length) * 100) : 0;
    return { u, assigned: assigned.length, passed, pending: assigned.length - passed, avg, completion, perCourse };
  }).filter(r => r.assigned > 0), [staff, courses, attempts]);

  const exportCsv = () => {
    const header = ["Name", "Outlet", "Role", "Assigned", "Passed", "Pending", "Avg best %", "Completion %", ...courses.map(c => c.title.replace(/"/g, "'"))];
    const lines = [header.map(h => `"${h}"`).join(",")];
    for (const r of rows) {
      const byId: Record<string, any> = {}; r.perCourse.forEach(c => { byId[c.id] = c; });
      const perCells = courses.map(c => {
        const pc = byId[c.id];
        if (!pc) return `""`;
        const v = pc.status === "passed" ? `Pass ${pc.best ?? ""}%` : pc.status === "not_started" ? "Not started" : `Fail ${pc.best ?? ""}%`;
        return `"${v.trim()}"`;
      });
      lines.push([`"${r.u.name}"`, `"${tenantName(r.u.tenantId)}"`, `"${r.u.role}"`, r.assigned, r.passed, r.pending, r.avg ?? "", r.completion, ...perCells].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "training_appraisal.csv"; a.click();
  };

  return (
    <div className="space-y-4 text-left">
      <button onClick={onBack} className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1"><X className="w-4 h-4" /> Back to trainings</button>
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Training Appraisal Report</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Each staff member's certification across all {courses.length} published training{courses.length === 1 ? "" : "s"} — for performance reviews.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl" value={outletFilter} onChange={e => setOutletFilter(e.target.value)}>
            <option value="ALL">All outlets</option>
            {tenants.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button onClick={exportCsv} className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-xl cursor-pointer flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> CSV</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[720px]">
          <thead><tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3 font-bold">Staff</th><th className="px-4 py-3 font-bold">Outlet</th>
            <th className="px-4 py-3 font-bold text-center">Assigned</th><th className="px-4 py-3 font-bold text-center">Passed</th>
            <th className="px-4 py-3 font-bold text-center">Pending</th><th className="px-4 py-3 font-bold text-center">Avg best</th>
            <th className="px-4 py-3 font-bold text-center">Completion</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-[11px] text-slate-400">No staff assigned to any published training yet.</td></tr>}
            {rows.map(r => (
              <tr key={r.u.id} className="border-b border-slate-50 last:border-0 text-xs">
                <td className="px-4 py-3"><div className="font-bold text-slate-800">{r.u.name}</div><div className="text-[10px] text-slate-400">{r.u.role}</div></td>
                <td className="px-4 py-3 text-slate-500">{tenantName(r.u.tenantId)}</td>
                <td className="px-4 py-3 text-center font-mono">{r.assigned}</td>
                <td className="px-4 py-3 text-center font-mono font-bold text-emerald-600">{r.passed}</td>
                <td className="px-4 py-3 text-center font-mono font-bold text-amber-600">{r.pending}</td>
                <td className="px-4 py-3 text-center font-bold font-mono">{r.avg != null ? `${r.avg}%` : "—"}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center gap-2 justify-center">
                    <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${r.completion}%` }} /></div>
                    <span className="font-mono text-[10px] text-slate-500">{r.completion}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-400">Per-course detail (pass/fail and score for every training) is included in the CSV export.</p>
    </div>
  );
}
