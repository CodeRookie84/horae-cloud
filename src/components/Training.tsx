/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// Training (staff view): assigned courses → read the document → take the test
// (shuffled, multi-language via free translate) → score vs pass mark → review +
// certificate on pass. Mobile-first, themed to the Horae app palette.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  GraduationCap, ArrowLeft, FileText, Award, Clock, CheckCircle2, XCircle,
  Lock, RotateCcw, Languages, Printer, AlertTriangle, ExternalLink,
} from "lucide-react";
import { Training as TrainingT, TrainingAttempt, User as AppUser } from "../types";
import { trainingMatchesUser, trainingStatus } from "../services/trainingService";
import { translateText } from "../services/store";

interface Props {
  trainings: TrainingT[];
  attempts: TrainingAttempt[];
  activeUser: AppUser;
  onSubmit: (training: TrainingT, answers: number[], screenLeaves?: number) => Promise<TrainingAttempt>;
  onBack?: () => void;
}

const LANGS: { code: "en" | "hi" | "kn" | "ta"; label: string }[] = [
  { code: "en", label: "English" }, { code: "hi", label: "हिन्दी" },
  { code: "kn", label: "ಕನ್ನಡ" }, { code: "ta", label: "தமிழ்" },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export default function Training({ trainings, attempts, activeUser, onSubmit, onBack }: Props) {
  const [selected, setSelected] = useState<TrainingT | null>(null);

  const mine = useMemo(
    () => trainings.filter(t => t.published && t.questions.length > 0 &&
      trainingMatchesUser(t, { tenantId: activeUser.tenantId, department: String(activeUser.department), role: String(activeUser.role) })),
    [trainings, activeUser],
  );
  const myAttempts = useMemo(() => attempts.filter(a => a.userId === activeUser.id), [attempts, activeUser.id]);

  return (
    <div className="space-y-4" id="training-container">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer border border-slate-200 hover:border-slate-300 bg-white px-3 py-1.5 rounded-xl shadow-sm self-start">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm">
        <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <GraduationCap className="text-indigo-600 w-5 h-5" /> Training &amp; Certification
        </h2>
        <p className="text-slate-500 text-xs mt-1">Complete assigned courses and pass the assessment to get certified.</p>
      </div>

      {selected
        ? <TrainingRunner training={selected} activeUser={activeUser} attempts={myAttempts} onSubmit={onSubmit} onExit={() => setSelected(null)} />
        : <TrainingList mine={mine} myAttempts={myAttempts} userId={activeUser.id} onOpen={setSelected} />}
    </div>
  );
}

// ── List ──────────────────────────────────────────────────────────────────────
function TrainingList({ mine, myAttempts, userId, onOpen }: { mine: TrainingT[]; myAttempts: TrainingAttempt[]; userId: string; onOpen: (t: TrainingT) => void; }) {
  if (mine.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-200 text-center py-14">
        <GraduationCap className="mx-auto w-10 h-10 text-slate-300 mb-2" />
        <p className="text-sm font-bold text-slate-700">No trainings assigned</p>
        <p className="text-[11px] text-slate-400 mt-1">New courses assigned to your outlet, department or role will appear here.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {mine.map(t => {
        const st = trainingStatus(t, userId, myAttempts);
        const best = st.best;
        const overdue = t.dueDate && new Date(t.dueDate) < new Date() && st.status !== "passed";
        const badge =
          st.status === "passed" ? { c: "bg-emerald-50 text-emerald-700 border-emerald-100", t: `✓ Passed ${best?.pct}%` }
          : st.status === "can_retake" ? { c: "bg-amber-50 text-amber-700 border-amber-100", t: `Retake · best ${best?.pct ?? 0}%` }
          : st.status === "locked_failed" ? { c: "bg-rose-50 text-rose-700 border-rose-100", t: `Not passed ${best?.pct ?? 0}%` }
          : { c: "bg-indigo-50 text-indigo-700 border-indigo-100", t: "Not started" };
        return (
          <div key={t.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[9px] font-bold border px-1.5 py-0.5 rounded-full ${badge.c}`}>{badge.t}</span>
                {overdue && <span className="text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-100 px-1.5 py-0.5 rounded-full">Overdue</span>}
              </div>
              <h4 className="text-sm font-bold text-slate-850 leading-snug">{t.title}</h4>
              {t.description && <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{t.description}</p>}
            </div>
            <div className="pt-3 mt-2 border-t border-slate-50 flex items-center justify-between">
              <span className="text-[9px] text-slate-400 font-mono">
                {t.questions.length} Qs · pass {t.passPct}%{t.dueDate ? ` · due ${t.dueDate}` : ""}
              </span>
              <button onClick={() => onOpen(t)}
                className={`px-3.5 py-1.5 font-bold text-[10px] rounded-lg transition-colors cursor-pointer ${st.status === "passed" ? "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200" : "bg-indigo-600 hover:bg-indigo-700 text-white"}`}>
                {st.status === "passed" ? "View" : st.status === "not_started" ? "Start" : "Open"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Runner ──────────────────────────────────────────────────────────────────────
function TrainingRunner({ training, activeUser, attempts, onSubmit, onExit }: {
  training: TrainingT; activeUser: AppUser; attempts: TrainingAttempt[];
  onSubmit: Props["onSubmit"]; onExit: () => void;
}) {
  const st = trainingStatus(training, activeUser.id, attempts);
  const topRef = useRef<HTMLDivElement>(null);

  // Every past attempt on THIS course, newest first — shown to the staff
  // member so they can see how they did each time, not just their best.
  const myAttemptsForThisCourse = useMemo(
    () => attempts.filter(a => a.trainingId === training.id).sort((a, b) => b.attemptNo - a.attemptNo),
    [attempts, training.id],
  );

  // How many times the app was left/backgrounded during the CURRENT test
  // attempt — a soft deterrent + admin-visible signal, not an automatic fail.
  // Reset whenever a fresh attempt starts (Start/Retake test).
  const screenLeavesRef = useRef(0);

  // How many retakes remain, as human text — shown on the intro + result screens
  // when the user hasn't passed yet. `st` already accounts for admin grants and
  // recomputes after each submission (parent refreshes the attempts list).
  const granted = (training.retestGrants || []).includes(activeUser.id);
  const unlimited = training.maxAttempts === 0;
  const remaining = unlimited ? Infinity : Math.max(0, training.maxAttempts - st.attemptsUsed);
  const retakesLeftText =
    granted ? "1 retake remaining (granted by your admin)"
    : unlimited && training.allowRetest ? "Unlimited retakes remaining"
    : training.allowRetest && remaining > 0 ? `${remaining} retake${remaining === 1 ? "" : "s"} remaining`
    : "No retakes remaining — ask your admin to allow a retest";

  const [phase, setPhase] = useState<"intro" | "test" | "result">("intro");
  const [lang, setLang] = useState<"en" | "hi" | "kn" | "ta">("en");
  const [translated, setTranslated] = useState<Record<string, { q: string; options: string[] }>>({});
  const [translating, setTranslating] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({}); // origQIdx -> origOptIdx
  const [result, setResult] = useState<TrainingAttempt | null>(st.best && st.status === "passed" ? st.best : null);
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fixed shuffle order per run.
  const order = useMemo(() => {
    const idx = training.questions.map((_, i) => i);
    const qOrder = training.shuffle ? shuffle(idx) : idx;
    const optPerm: Record<number, number[]> = {};
    training.questions.forEach((q, i) => { const o = q.options.map((_, j) => j); optPerm[i] = training.shuffle ? shuffle(o) : o; });
    return { qOrder, optPerm };
  }, [training, phase]);

  // Count each time the tab/app goes to the background while the test is
  // actually in progress — not a hard rule, just tracked for the admin.
  useEffect(() => {
    if (phase !== "test") return;
    const onVis = () => { if (document.hidden) screenLeavesRef.current += 1; };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [phase]);

  const changeLang = async (code: "en" | "hi" | "kn" | "ta") => {
    setLang(code);
    if (code === "en" || translated[code]?.q) return; // 'en' shows source
    setTranslating(true);
    try {
      const map: Record<string, { q: string; options: string[] }> = {};
      // Translate per question (cached in a flat structure keyed by lang+qid).
      const out: Record<string, { q: string; options: string[] }> = {};
      for (const q of training.questions) {
        const [tq, ...topts] = await Promise.all([translateText(q.question, code), ...q.options.map(o => translateText(o, code))]);
        out[`${code}:${q.id}`] = { q: tq, options: topts };
      }
      setTranslated(prev => ({ ...prev, ...out }));
    } finally { setTranslating(false); }
  };

  const qText = (qid: string, fallbackQ: string, fallbackOpts: string[]) => {
    if (lang === "en") return { q: fallbackQ, options: fallbackOpts };
    return translated[`${lang}:${qid}`] || { q: fallbackQ, options: fallbackOpts };
  };

  const doSubmit = async () => {
    const unanswered = training.questions.filter((_, i) => answers[i] === undefined).length;
    if (unanswered > 0) { setErr(`Please answer all questions (${unanswered} left).`); return; }
    setErr(""); setSubmitting(true);
    try {
      const answersArr = training.questions.map((_, i) => answers[i]);
      const att = await onSubmit(training, answersArr, screenLeavesRef.current);
      setResult(att); setPhase("result");
    } finally { setSubmitting(false); }
  };

  // On reaching the result, jump back to the top so the score + retake are the
  // first thing seen (the submit button sits at the bottom of the question list).
  useEffect(() => {
    if (phase === "result") {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [phase]);

  return (
    <div ref={topRef} className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-md space-y-5">
      <button onClick={onExit} className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-xs font-semibold transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to courses
      </button>

      <div className="border-b border-slate-100 pb-4">
        <h3 className="text-lg font-bold text-slate-800">{training.title}</h3>
        {training.description && <p className="text-slate-500 text-xs mt-1 leading-relaxed">{training.description}</p>}
      </div>

      {/* INTRO / material + status */}
      {phase === "intro" && (
        <div className="space-y-5">
          {training.docUrl && <DocViewer url={training.docUrl} name={training.docName} type={training.docType} />}

          <div className="rounded-2xl border border-slate-100 p-4 bg-slate-50/40 flex flex-wrap items-center gap-3 justify-between">
            <div className="text-[11px] text-slate-600">
              <span className="font-bold">{training.questions.length}</span> questions · pass mark <span className="font-bold">{training.passPct}%</span>
              {training.maxAttempts > 0 && <> · up to <span className="font-bold">{training.maxAttempts}</span> attempts</>}
              {st.attemptsUsed > 0 && <> · used <span className="font-bold">{st.attemptsUsed}</span></>}
            </div>
            {st.status === "passed" ? (
              <button onClick={() => setPhase("result")} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer flex items-center gap-1.5"><Award className="w-4 h-4" /> View certificate</button>
            ) : st.canTake ? (
              <button onClick={() => { setAnswers({}); setResult(null); screenLeavesRef.current = 0; setPhase("test"); }} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer">
                {st.attemptsUsed > 0 ? "Retake test" : "Start test"}
              </button>
            ) : (
              <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1.5"><Lock className="w-4 h-4" /> Attempts used — ask your admin to allow a retest</span>
            )}
          </div>
          {st.last && st.status !== "passed" && (
            <div className="space-y-1">
              <p className="text-[11px] text-slate-500">Last attempt: <span className="font-bold">{st.last.pct}%</span> on {new Date(st.last.submittedAt).toLocaleDateString()}</p>
              <p className="text-[11px] font-semibold text-amber-700">{retakesLeftText}</p>
            </div>
          )}

          {/* Full attempt history — every attempt's score, not just the best
              or the latest. No hover needed (this is the primary mobile view). */}
          {myAttemptsForThisCourse.length > 0 && (
            <div className="rounded-2xl border border-slate-100 p-4 space-y-2">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Your attempt history</h4>
              <div className="space-y-1.5">
                {myAttemptsForThisCourse.map(a => (
                  <div key={a.id} className="flex items-center justify-between text-[11px] px-3 py-2 rounded-xl bg-slate-50/60">
                    <span className="text-slate-600">Attempt {a.attemptNo} · {new Date(a.submittedAt).toLocaleDateString()}</span>
                    <span className={`font-bold ${a.passed ? "text-emerald-700" : "text-rose-700"}`}>{a.pct}%{a.passed ? " ✓" : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TEST */}
      {phase === "test" && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 flex-wrap">
            <Languages className="w-4 h-4 text-slate-400" />
            {LANGS.map(l => (
              <button key={l.code} onClick={() => changeLang(l.code)} disabled={translating}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${lang === l.code ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                {l.label}
              </button>
            ))}
            {translating && <span className="text-[10px] text-slate-400 animate-pulse">Translating…</span>}
          </div>

          {err && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">{err}</div>}

          {order.qOrder.map((qi, displayIdx) => {
            const q = training.questions[qi];
            const view = qText(q.id, q.question, q.options);
            return (
              <div key={q.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/30 space-y-3">
                <p className="text-xs font-bold text-slate-850">{displayIdx + 1}. {view.q}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {order.optPerm[qi].map(origOpt => {
                    const isSel = answers[qi] === origOpt;
                    return (
                      <button key={origOpt} type="button" onClick={() => setAnswers(a => ({ ...a, [qi]: origOpt }))}
                        className={`p-3 rounded-xl border text-left text-[11px] transition-all flex items-center gap-2 cursor-pointer ${isSel ? "bg-indigo-600 border-indigo-600 text-white font-semibold" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                        <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] shrink-0 ${isSel ? "border-white bg-white text-indigo-600 font-bold" : "border-slate-300"}`}>{isSel ? "✓" : ""}</span>
                        <span>{view.options[origOpt]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 sticky bottom-0 bg-white py-3">
            <button onClick={() => setPhase("intro")} className="px-4 py-2 text-slate-500 hover:text-slate-800 text-xs font-semibold">Cancel</button>
            <button onClick={doSubmit} disabled={submitting} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer active:scale-95 disabled:opacity-60">
              {submitting ? "Submitting…" : "Submit test"}
            </button>
          </div>
        </div>
      )}

      {/* RESULT */}
      {phase === "result" && result && (
        <ResultView training={training} activeUser={activeUser} result={result}
          retakesLeftText={retakesLeftText}
          onRetake={st.canTake && !result.passed ? () => { setAnswers({}); screenLeavesRef.current = 0; setPhase("test"); } : undefined}
          onDone={onExit} />
      )}
    </div>
  );
}

function DocViewer({ url, name, type }: { url: string; name?: string; type?: string }) {
  const isPdf = /pdf/i.test(type || "") || /\.pdf(\?|$)/i.test(url);
  const isImg = /^image\//i.test(type || "") || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url);
  return (
    <div className="rounded-2xl border border-slate-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 truncate"><FileText className="w-4 h-4 text-indigo-500 shrink-0" />{name || "Training material"}</span>
        <a href={url} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 shrink-0">Open <ExternalLink className="w-3 h-3" /></a>
      </div>
      {isPdf ? <iframe src={url} title="material" className="w-full h-[55vh] bg-white" />
        : isImg ? <img src={url} alt={name || "material"} className="w-full max-h-[55vh] object-contain bg-white" />
        : <div className="p-6 text-center text-[11px] text-slate-500">This document opens in a new tab. <a href={url} target="_blank" rel="noreferrer" className="text-indigo-600 font-bold underline">Open the material</a> before taking the test.</div>}
    </div>
  );
}

function ResultView({ training, activeUser, result, retakesLeftText, onRetake, onDone }: {
  training: TrainingT; activeUser: AppUser; result: TrainingAttempt; retakesLeftText?: string; onRetake?: () => void; onDone: () => void;
}) {
  const passed = result.passed;
  return (
    <div className="space-y-6">
      <div className={`p-6 rounded-2xl text-center space-y-2 border ${passed ? "bg-emerald-50 border-emerald-150" : "bg-rose-50 border-rose-150"}`}>
        {passed ? <Award className="w-12 h-12 text-emerald-600 mx-auto" /> : <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />}
        <h4 className={`text-base font-bold ${passed ? "text-emerald-900" : "text-rose-900"}`}>{passed ? "Passed — you're certified!" : "Not passed yet"}</h4>
        <p className={`text-2xl font-extrabold ${passed ? "text-emerald-800" : "text-rose-800"}`}>{result.pct}%</p>
        <p className="text-[11px] font-mono font-semibold text-slate-500">{result.score} / {result.total} correct · pass mark {training.passPct}%</p>
        {!passed && retakesLeftText && (
          <p className="text-[11px] font-bold text-amber-700 pt-1">{retakesLeftText}</p>
        )}
      </div>

      {/* Actions at the top so the score + retake are visible without scrolling */}
      <div className="flex justify-center gap-2">
        {onRetake && <button onClick={onRetake} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer flex items-center gap-1.5"><RotateCcw className="w-4 h-4" /> Retake test</button>}
        <button onClick={onDone} className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-md cursor-pointer">Done</button>
      </div>

      {passed && <Certificate userName={activeUser.name} title={training.title} pct={result.pct} date={result.submittedAt} />}

      <div className="space-y-3">
        <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Review</h4>
        {training.questions.map((q, i) => {
          const ans = result.answers[i];
          const ok = ans === q.correctIndex;
          return (
            <div key={q.id} className="p-4 rounded-xl border border-slate-100 space-y-2">
              <p className="text-xs font-bold text-slate-850 flex items-start gap-1.5">
                {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />}
                {i + 1}. {q.question}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-5">
                {q.options.map((opt, oi) => {
                  let cls = "bg-slate-50 border-slate-100 text-slate-600";
                  if (oi === q.correctIndex) cls = "bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold";
                  else if (oi === ans) cls = "bg-rose-50 border-rose-200 text-rose-900 font-semibold";
                  return <div key={oi} className={`p-2 rounded-lg border text-[11px] ${cls}`}>{opt}</div>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Certificate({ userName, title, pct, date }: { userName: string; title: string; pct: number; date: string }) {
  const print = () => {
    const html = `<html><head><title>Certificate</title><style>
      body{font-family:Georgia,serif;padding:0;margin:0}
      .cert{margin:40px auto;max-width:800px;border:10px solid #6D5DD3;padding:48px;text-align:center}
      h1{color:#6D5DD3;font-size:34px;margin:0 0 8px} .name{font-size:30px;margin:18px 0;font-weight:bold}
      .muted{color:#555}</style></head><body><div class="cert">
      <div class="muted" style="letter-spacing:3px;text-transform:uppercase;font-size:13px">Certificate of Completion</div>
      <h1>Horae Training</h1><p class="muted">This certifies that</p><div class="name">${userName}</div>
      <p class="muted">has successfully completed</p><h2 style="margin:6px 0">${title}</h2>
      <p class="muted">with a score of <b>${pct}%</b> on ${new Date(date).toLocaleDateString()}</p>
      </div><script>window.onload=()=>window.print()</script></body></html>`;
    const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); }
  };
  return (
    <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 text-center">
      <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-500 font-bold">Certificate of Completion</p>
      <p className="text-lg font-bold text-slate-800 mt-1">{userName}</p>
      <p className="text-[11px] text-slate-500">completed <span className="font-semibold">{title}</span> · {pct}%</p>
      <button onClick={print} className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-xl shadow-sm cursor-pointer inline-flex items-center gap-1.5"><Printer className="w-4 h-4" /> Print / Save PDF</button>
    </div>
  );
}
