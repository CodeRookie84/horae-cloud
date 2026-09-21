/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ChecklistRun.tsx — perform a Food-Safety / compliance checklist as a single
 * immutable "run". Renders each item by its responseType (tick / yes_no / numeric
 * / score), captures evidence photos and remarks, auto-surfaces the corrective
 * action when an item fails, computes compliance % + audit score, and writes the
 * run via submitChecklistRun. Used in place of the plain tick-and-submit flow for
 * any checklist that carries a compliance `packId` / `frequency`.
 */
import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Camera, Check, X, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import type { Checklist, ChecklistItem, ChecklistStation, ChecklistRunItem } from "../types";
import {
  getChecklistStations, submitChecklistRun, uploadChecklistPhoto, notifyChecklistSubmission,
} from "../services/checklistCompliance";

/** Audit items pass at 3/5 or above. */
const SCORE_PASS = 3;

interface Resp {
  tick?: "pass" | "na";
  yn?: "yes" | "no" | "na";
  value?: number;
  remark?: string;
  photoUrl?: string;
  uploading?: boolean;
}

export default function ChecklistRun({
  checklist, performer, clientId, onDone, onBack,
}: {
  checklist: Checklist;
  performer: { userId?: string; name: string };
  clientId?: string;
  onDone: () => void;
  onBack: () => void;
}) {
  const [stations, setStations] = useState<ChecklistStation[]>([]);
  const [stationId, setStationId] = useState<string>("");
  const [resp, setResp] = useState<Record<string, Resp>>({});
  const [startedAt] = useState<string>(() => new Date().toISOString());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  const itemsById = useMemo(() => {
    const m: Record<string, ChecklistItem> = {};
    (checklist.items || []).forEach((it) => { m[it.id] = it; });
    return m;
  }, [checklist.items]);

  // Group by sections when present; otherwise a single unnamed group.
  const groups = useMemo(() => {
    if (checklist.sections && checklist.sections.length) {
      return checklist.sections.map((s) => ({
        name: s.name,
        items: (s.items || []).map((si) => itemsById[si.id]).filter(Boolean) as ChecklistItem[],
      }));
    }
    return [{ name: "", items: (checklist.items || []) }];
  }, [checklist.sections, checklist.items, itemsById]);

  useEffect(() => {
    let alive = true;
    getChecklistStations([checklist.tenantId]).then((s) => {
      if (!alive) return;
      const active = s.filter((x) => x.active);
      setStations(active);
      const suggested = checklist.assignment?.stationIds?.find((id) => active.some((a) => a.id === id));
      if (suggested) setStationId(suggested);
    });
    return () => { alive = false; };
  }, [checklist.tenantId, checklist.assignment]);

  const set = (id: string, patch: Partial<Resp>) =>
    setResp((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  /** Evaluate one item → { answered, applicable, ok }. */
  const evalItem = (item: ChecklistItem, r: Resp | undefined) => {
    const rt = item.responseType || "tick";
    if (rt === "numeric") {
      const answered = typeof r?.value === "number" && !Number.isNaN(r.value);
      let ok = false;
      if (answered) {
        const { min, max } = item.target || {};
        ok = (min === undefined || r!.value! >= min) && (max === undefined || r!.value! <= max);
      }
      return { answered, applicable: true, ok };
    }
    if (rt === "score") {
      const answered = typeof r?.value === "number";
      return { answered, applicable: answered, ok: answered ? r!.value! >= SCORE_PASS : false };
    }
    if (rt === "yes_no") {
      const answered = !!r?.yn;
      if (r?.yn === "na") return { answered, applicable: false, ok: true };
      return { answered, applicable: true, ok: r?.yn === "yes" };
    }
    // tick
    const answered = !!r?.tick;
    if (r?.tick === "na") return { answered, applicable: false, ok: true };
    return { answered, applicable: true, ok: r?.tick === "pass" };
  };

  const allItems = groups.flatMap((g) => g.items);
  const evaluations = allItems.map((it) => ({ it, ...evalItem(it, resp[it.id]) }));
  const unanswered = evaluations.filter((e) => !e.answered);
  const missingPhoto = allItems.filter((it) => it.requiresPhoto && !resp[it.id]?.photoUrl);
  const applicable = evaluations.filter((e) => e.applicable);
  const passed = applicable.filter((e) => e.ok);
  const compliancePct = applicable.length ? Math.round((passed.length / applicable.length) * 100) : 100;
  const scoreVals = evaluations.filter((e) => (e.it.responseType === "score") && e.answered).map((e) => resp[e.it.id]!.value!);
  const auditScore = scoreVals.length ? +(scoreVals.reduce((a, b) => a + b, 0) / scoreVals.length).toFixed(1) : null;
  const criticalFailed = evaluations.some((e) => e.it.critical && e.applicable && !e.ok);

  const canSubmit = unanswered.length === 0 && missingPhoto.length === 0 && !submitting;

  const onPhoto = async (item: ChecklistItem, file: File) => {
    set(item.id, { uploading: true });
    try {
      const url = await uploadChecklistPhoto(file, { clientId, checklistId: checklist.id });
      set(item.id, { photoUrl: url, uploading: false });
    } catch (e: any) {
      set(item.id, { uploading: false });
      setError(e?.message || "Photo upload failed. Try again.");
    }
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true); setError("");
    try {
      const runItems: ChecklistRunItem[] = allItems.map((it) => {
        const r = resp[it.id] || {};
        const { ok } = evalItem(it, r);
        return {
          itemId: it.id,
          responseType: it.responseType || "tick",
          ok,
          value: r.value,
          remark: r.remark?.trim() || undefined,
          photoUrl: r.photoUrl,
          correctiveAction: !ok && it.correctiveAction ? it.correctiveAction : undefined,
        };
      });
      const run = await submitChecklistRun({
        checklistId: checklist.id,
        tenantId: checklist.tenantId,
        stationId: stationId || null,
        performer: { userId: performer.userId, stationId: stationId || undefined, name: performer.name },
        startedAt,
        completedAt: new Date().toISOString(),
        status: criticalFailed ? "failed" : "completed",
        score: auditScore,
        compliancePct,
        items: runItems,
      });
      notifyChecklistSubmission(
        checklist,
        { compliancePct, status: criticalFailed ? "failed" : "completed" },
        { userId: performer.userId, name: performer.name },
        run.id,
      ).catch(() => { /* best-effort — never blocks the run */ });
      onDone();
    } catch (e: any) {
      setError(e?.message || "Couldn't save the run. Please retry.");
      setSubmitting(false);
    }
  };

  const failed = (it: ChecklistItem) => {
    const e = evalItem(it, resp[it.id]);
    return e.answered && e.applicable && !e.ok;
  };

  return (
    <div className="space-y-5 pb-28 max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] transition-colors cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div>
        <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">{checklist.title}</h2>
        {checklist.frequency && (
          <span className="inline-block mt-1 text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-soft)] bg-[var(--color-cream-deep)] px-2 py-0.5 rounded-full">{checklist.frequency}</span>
        )}
      </div>

      {/* Who is performing */}
      <div className="bg-white rounded-2xl border border-[var(--color-line)] shadow-warm p-4 space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink-soft)]">Performed by</label>
        <div className="text-sm text-[var(--color-ink)]">{performer.name}</div>
        {stations.length > 0 && (
          <select
            value={stationId}
            onChange={(e) => setStationId(e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-[var(--color-cream)] border border-[var(--color-line)] rounded-xl text-sm text-[var(--color-ink)] focus:outline-none"
          >
            <option value="">No station</option>
            {stations.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        )}
      </div>

      {groups.map((g, gi) => (
        <div key={gi} className="space-y-2">
          {g.name && <div className="text-xs font-bold tracking-wider uppercase text-[var(--color-ink-soft)] px-1">{g.name}</div>}
          <div className="bg-white rounded-2xl border border-[var(--color-line)] shadow-warm divide-y divide-[var(--color-line)] overflow-hidden">
            {g.items.map((item) => {
              const r = resp[item.id] || {};
              const rt = item.responseType || "tick";
              const isFail = failed(item);
              return (
                <div key={item.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="flex-1 text-sm text-[var(--color-ink)]">
                      {item.text}
                      {item.critical && <span className="ml-1.5 text-[10px] font-bold text-rose-600 uppercase">critical</span>}
                    </span>
                  </div>

                  {/* Response control */}
                  {rt === "tick" && (
                    <div className="flex gap-2">
                      <Choice active={r.tick === "pass"} tone="pass" onClick={() => set(item.id, { tick: "pass" })}><Check className="w-3.5 h-3.5" /> Done</Choice>
                      <Choice active={r.tick === "na"} tone="na" onClick={() => set(item.id, { tick: "na" })}>N/A</Choice>
                    </div>
                  )}
                  {rt === "yes_no" && (
                    <div className="flex gap-2">
                      <Choice active={r.yn === "yes"} tone="pass" onClick={() => set(item.id, { yn: "yes" })}>Yes</Choice>
                      <Choice active={r.yn === "no"} tone="fail" onClick={() => set(item.id, { yn: "no" })}>No</Choice>
                      <Choice active={r.yn === "na"} tone="na" onClick={() => set(item.id, { yn: "na" })}>N/A</Choice>
                    </div>
                  )}
                  {rt === "numeric" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number" inputMode="decimal"
                        value={r.value ?? ""}
                        onChange={(e) => set(item.id, { value: e.target.value === "" ? undefined : Number(e.target.value) })}
                        className="w-28 px-3 py-2 bg-[var(--color-cream)] border border-[var(--color-line)] rounded-xl text-sm text-[var(--color-ink)] focus:outline-none"
                        placeholder="value"
                      />
                      <span className="text-xs text-[var(--color-ink-soft)]">
                        {item.target?.unit || ""} · pass {fmtRange(item.target)}
                      </span>
                    </div>
                  )}
                  {rt === "score" && (
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} type="button" onClick={() => set(item.id, { value: n })}
                          className={`w-8 h-8 rounded-lg text-sm font-bold border cursor-pointer transition-all ${r.value === n ? "bg-[var(--color-brand)] text-white border-[var(--color-brand)]" : "bg-[var(--color-cream)] text-[var(--color-ink-soft)] border-[var(--color-line)]"}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Evidence photo */}
                  {item.requiresPhoto && (
                    <label className={`inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer ${r.photoUrl ? "text-emerald-600" : "text-[var(--color-ink-soft)]"}`}>
                      {r.uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : r.photoUrl ? <CheckCircle2 className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                      {r.photoUrl ? "Photo attached — retake" : "Add photo (required)"}
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(item, f); e.currentTarget.value = ""; }} />
                    </label>
                  )}

                  {/* Corrective action shown on failure */}
                  {isFail && item.correctiveAction && (
                    <div className="flex items-start gap-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> <span>Action: {item.correctiveAction}</span>
                    </div>
                  )}

                  {/* Remark (optional; encouraged on fail) */}
                  {(rt === "yes_no" || isFail) && (
                    <input type="text" value={r.remark ?? ""} onChange={(e) => set(item.id, { remark: e.target.value })}
                      placeholder="Remark (optional)"
                      className="w-full px-3 py-1.5 bg-[var(--color-cream)] border border-[var(--color-line)] rounded-lg text-xs text-[var(--color-ink)] focus:outline-none" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {error && <div className="text-sm text-rose-600">{error}</div>}

      {/* Sticky submit bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-[var(--color-line)] px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="flex-1 text-xs text-[var(--color-ink-soft)]">
            <span className={`font-bold ${criticalFailed ? "text-rose-600" : "text-[var(--color-ink)]"}`}>{compliancePct}% compliant</span>
            {auditScore !== null && <> · score {auditScore}/5</>}
            {unanswered.length > 0 && <> · {unanswered.length} left</>}
            {missingPhoto.length > 0 && <> · {missingPhoto.length} photo(s) needed</>}
          </div>
          <button onClick={submit} disabled={!canSubmit}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-white text-sm font-bold bg-[var(--color-brand)] hover:bg-[color-mix(in_srgb,var(--color-brand)_88%,var(--color-ink))] shadow-warm cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Submit run
          </button>
        </div>
      </div>
    </div>
  );
}

function Choice({ active, tone, onClick, children }: { active: boolean; tone: "pass" | "fail" | "na"; onClick: () => void; children: React.ReactNode }) {
  const activeCls = tone === "pass" ? "bg-emerald-500 text-white border-emerald-500"
    : tone === "fail" ? "bg-rose-500 text-white border-rose-500"
    : "bg-[var(--color-ink-soft)] text-white border-[var(--color-ink-soft)]";
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold border rounded-lg cursor-pointer transition-all ${active ? activeCls : "bg-[var(--color-cream)] text-[var(--color-ink-soft)] border-[var(--color-line)]"}`}>
      {children}
    </button>
  );
}

function fmtRange(t?: { min?: number; max?: number; unit?: string }): string {
  if (!t) return "—";
  const u = t.unit || "";
  if (t.min !== undefined && t.max !== undefined) return `${t.min}–${t.max}${u}`;
  if (t.min !== undefined) return `≥ ${t.min}${u}`;
  if (t.max !== undefined) return `≤ ${t.max}${u}`;
  return "—";
}
