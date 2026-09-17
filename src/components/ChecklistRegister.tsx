/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ChecklistRegister.tsx — the inspection-ready register. Reads immutable
 * checklist_runs for the chosen outlet(s) and date range and renders a printable
 * record: each run's compliance %, audit score, performer/station, per-item
 * results with evidence photos, and any corrective actions raised. "Print" →
 * window.print() (a PDF via the browser's print dialog).
 */
import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Printer, Loader2, ChevronDown, ChevronRight, Camera, AlertTriangle } from "lucide-react";
import type { Checklist, Tenant, ChecklistRun, ChecklistStation } from "../types";
import { getChecklistRuns, getChecklistStations } from "../services/checklistCompliance";

const daysAgoISO = (n: number) => {
  const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0, 0, 0, 0);
  return d.toISOString();
};
const fmtDateTime = (iso?: string) => iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
const forDateInput = (iso: string) => iso.slice(0, 10);

export default function ChecklistRegister({
  tenants, clientId, checklists, onBack,
}: {
  tenants: Tenant[];
  clientId?: string;
  checklists: Checklist[];
  onBack: () => void;
}) {
  const [tenantId, setTenantId] = useState<string>("ALL");
  const [from, setFrom] = useState<string>(() => daysAgoISO(30));
  const [to, setTo] = useState<string>(() => new Date().toISOString());
  const [runs, setRuns] = useState<ChecklistRun[]>([]);
  const [stations, setStations] = useState<ChecklistStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const tenantIds = useMemo(() => tenantId === "ALL" ? tenants.map((t) => t.id) : [tenantId], [tenantId, tenants]);

  // itemId → text, and checklistId → title, from the loaded checklists.
  const itemText = useMemo(() => {
    const m: Record<string, string> = {};
    checklists.forEach((c) => (c.items || []).forEach((it) => { m[it.id] = it.text; }));
    return m;
  }, [checklists]);
  const titleById = useMemo(() => {
    const m: Record<string, string> = {};
    checklists.forEach((c) => { m[c.id] = c.title; });
    return m;
  }, [checklists]);
  const stationLabel = useMemo(() => {
    const m: Record<string, string> = {};
    stations.forEach((s) => { m[s.id] = s.label; });
    return m;
  }, [stations]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      getChecklistRuns({ tenantIds, from, to, limit: 500 }),
      getChecklistStations(tenantIds),
    ]).then(([r, s]) => {
      if (!alive) return;
      setRuns(r); setStations(s); setLoading(false);
    });
    return () => { alive = false; };
  }, [tenantIds, from, to]);

  const tenantName = (id: string) => tenants.find((t) => t.id === id)?.name || id;

  return (
    <div className="space-y-4" id="checklist-register">
      <div className="flex items-center justify-between print:hidden">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer border border-slate-200 hover:border-slate-300 bg-white px-3 py-1.5 rounded-xl shadow-xs">
          <ArrowLeft className="w-4 h-4" /> Back to Checklists
        </button>
        <button onClick={() => window.print()} className="flex items-center gap-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-xl cursor-pointer">
          <Printer className="w-4 h-4" /> Print / PDF
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex flex-wrap items-center gap-3 print:hidden">
        <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer">
          <option value="ALL">All Outlets</option>
          {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">From
          <input type="date" value={forDateInput(from)} onChange={(e) => setFrom(new Date(e.target.value).toISOString())} className="bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg" />
        </label>
        <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">To
          <input type="date" value={forDateInput(to)} onChange={(e) => { const d = new Date(e.target.value); d.setHours(23, 59, 59); setTo(d.toISOString()); }} className="bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg" />
        </label>
      </div>

      {/* Print header */}
      <div className="hidden print:block">
        <h1 className="text-lg font-bold">Food Safety Register — {tenantId === "ALL" ? "All Outlets" : tenantName(tenantId)}</h1>
        <p className="text-xs text-slate-600">{forDateInput(from)} to {forDateInput(to)}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : runs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 text-center py-16 text-sm text-slate-500">
          No checklist runs recorded in this period.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-100 overflow-hidden">
          {runs.map((run) => {
            const isOpen = !!open[run.id];
            const failedItems = run.items.filter((i) => i.ok === false);
            return (
              <div key={run.id}>
                <button onClick={() => setOpen((p) => ({ ...p, [run.id]: !p[run.id] }))} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 cursor-pointer">
                  {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{titleById[run.checklistId] || "Checklist"}</p>
                    <p className="text-[11px] text-slate-500">
                      {fmtDateTime(run.completedAt)} · {run.performer.name}
                      {run.stationId && stationLabel[run.stationId] ? ` · ${stationLabel[run.stationId]}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-sm font-bold ${run.status === "failed" ? "text-rose-600" : "text-emerald-600"}`}>{run.compliancePct ?? 0}%</span>
                    {run.score != null && <span className="block text-[11px] text-slate-500">score {run.score}/5</span>}
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${run.status === "failed" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{run.status}</span>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-1.5">
                    {failedItems.length > 0 && (
                      <div className="mb-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 space-y-1">
                        <p className="text-[11px] font-bold uppercase text-rose-700">Corrective actions</p>
                        {failedItems.map((i) => (
                          <div key={i.itemId} className="flex items-start gap-1.5 text-xs text-rose-800">
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>{itemText[i.itemId] || i.itemId}{i.correctiveAction ? ` — ${i.correctiveAction}` : ""}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {run.items.map((i) => (
                      <div key={i.itemId} className="flex items-center gap-2 text-xs">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${i.ok === false ? "bg-rose-500" : "bg-emerald-500"}`} />
                        <span className="flex-1 text-slate-700">{itemText[i.itemId] || i.itemId}</span>
                        {i.value != null && <span className="text-slate-500">{i.value}</span>}
                        {i.remark && <span className="text-slate-400 italic truncate max-w-[40%]">“{i.remark}”</span>}
                        {i.photoUrl && (
                          <a href={i.photoUrl} target="_blank" rel="noreferrer" className="text-indigo-600 inline-flex items-center gap-0.5 print:hidden"><Camera className="w-3.5 h-3.5" /></a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
