/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// Equipment Maintenance (CLIT Autonomous Maintenance) — the dashboard tab.
//
// CLIT work is CLIENT-scoped: a user with CLIT access services every outlet +
// floor under their client and filters here. Most tabs render HTML strings into a
// `.clit-scope` container with delegated native events; the Admin Console is a
// React panel (MaintenanceAdmin). What each CLIT role can see/do comes from the
// capability matrix in clitRoles.ts; Client Admins are CLIT Admins by default.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Wrench } from "lucide-react";
import { User as AppUser, Tenant } from "../../types";
import { CLIT_SCOPED_CSS, MAINT_TABS } from "./maintenanceTheme";
import { ClitRole, caps as roleCaps, effectiveClitRole } from "./clitRoles";
import {
  MaintCtx, Equipment, DefectRow, AuditRow, HistoryRow, ChecklistResponses,
  renderTab, buildCsv, deriveCriticality, getFacilityTodayString,
} from "./maintenanceEngine";
import MaintenanceAdmin from "./MaintenanceAdmin";
import * as svc from "../../services/maintenanceService";
import { AUDIT_PARAMS } from "./maintenanceData";
import { translateText } from "../../services/store";

type ChkLang = "original" | "kn" | "hi" | "ta";
const CLIT_LANGS: { c: ChkLang; l: string }[] = [
  { c: "original", l: "Original" }, { c: "kn", l: "ಕನ್ನಡ" }, { c: "hi", l: "हिंदी" }, { c: "ta", l: "தமிழ்" },
];

interface Props {
  activeUser: AppUser;
  activeTenant: Tenant;
  tenants: Tenant[];
  /** All staff of the active client — used by the Admin Console access manager. */
  clientUsers?: AppUser[];
  /** Grant/revoke CLIT access + role for a staff member (wired to the store). */
  onSetClitAccess?: (userId: string, access: boolean, role: string) => Promise<void>;
}

export default function MaintenanceHub({ activeUser, activeTenant, tenants, clientUsers = [], onSetClitAccess }: Props) {
  const role: ClitRole = useMemo(
    () => effectiveClitRole(activeUser.clitRole, activeUser.role as string),
    [activeUser.clitRole, activeUser.role],
  );
  const capMap = useMemo(() => roleCaps(role), [role]);
  const visibleTabs = useMemo(
    () => MAINT_TABS.filter(t => t.requires === null || capMap[t.requires]),
    [capMap],
  );

  const outlets = tenants && tenants.length > 0 ? tenants : [activeTenant];
  const [selectedOutletId, setSelectedOutletId] = useState<string>(activeTenant.id);
  const tenantId = selectedOutletId;
  const selectedOutlet = outlets.find(o => o.id === selectedOutletId) || activeTenant;
  const clientId = activeTenant.clientId;

  // ── Data + UI state ────────────────────────────────────────────────────────
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [checklists, setChecklists] = useState<Record<string, ChecklistResponses>>({});
  const [defects, setDefects] = useState<DefectRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [sopRoster, setSopRoster] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [activeSubTab, setActiveSubTab] = useState<string>(visibleTabs[0]?.id || "equipment");
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
  const [reopened, setReopened] = useState<string[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<string>("");
  const [chkLang, setChkLang] = useState<ChkLang>("original");
  const [trCache, setTrCache] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState(false);
  const [checklistHistoryFilterDate, setChecklistHistoryFilterDate] = useState<string>(getFacilityTodayString());
  const [auditHistoryFilterDate, setAuditHistoryFilterDate] = useState<string>(getFacilityTodayString());

  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Keep the active sub-tab valid if the role's visible tabs change.
  useEffect(() => {
    if (!visibleTabs.some(t => t.id === activeSubTab)) {
      setActiveSubTab(visibleTabs[0]?.id || "equipment");
    }
  }, [visibleTabs, activeSubTab]);

  // ── Load / reload (for the SELECTED outlet) ─────────────────────────────────
  const reload = useCallback(async () => {
    const eq = await svc.getEquipment(tenantId);
    const nameById: Record<string, string> = {};
    eq.forEach(e => { nameById[e.id] = e.name; });
    const [states, defs, auds, hist] = await Promise.all([
      svc.getChecklistStates(tenantId, nameById),
      svc.getDefects(tenantId),
      svc.getAudits(tenantId),
      svc.getHistory(tenantId),
    ]);
    setEquipment(eq);
    setChecklists(states);
    setDefects(defs);
    setAudits(auds);
    setHistory(hist);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { setLoading(true); setSelectedMachine(null); reload(); }, [reload]);
  // Re-opened frequencies are per-open-machine — reset when the machine changes.
  useEffect(() => { setReopened([]); }, [selectedMachine]);

  // SOP roster is per client — load once.
  useEffect(() => { if (clientId) svc.getSopRoster(clientId).then(setSopRoster); }, [clientId]);

  // Cross-device sync: refresh on focus/visibility + a light interval, but skip
  // while the user is typing into one of our fields so we don't clobber input.
  useEffect(() => {
    const isEditing = () => {
      const el = document.activeElement as HTMLElement | null;
      return !!el && !!bodyRef.current && bodyRef.current.contains(el) &&
        /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
    };
    const tick = () => { if (!isEditing()) reload(); };
    const onVis = () => { if (document.visibilityState === "visible") tick(); };
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", onVis);
    const interval = setInterval(tick, 15000);
    return () => {
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(interval);
    };
  }, [reload]);

  // Floors available in this outlet (derived from its equipment).
  const floors = useMemo(
    () => Array.from(new Set(equipment.map(e => e.floor || "").filter(Boolean))).sort(),
    [equipment],
  );
  const visibleEquipment = useMemo(
    () => (selectedFloor ? equipment.filter(e => (e.floor || "") === selectedFloor) : equipment),
    [equipment, selectedFloor],
  );

  // ── Google-translate for checklist / audit text (like Checklist Routines) ────
  const tr = useCallback(
    (text: string) => (chkLang === "original" || !text ? text : (trCache[`${chkLang}:${text}`] ?? text)),
    [chkLang, trCache],
  );
  useEffect(() => {
    if (chkLang === "original") return;
    const strings = new Set<string>();
    if (activeSubTab === "equipment" && selectedMachine) {
      const m = equipment.find(e => e.id === selectedMachine);
      (m?.checklist || []).forEach(it => { [it.c, it.std, it.method].forEach(s => { if (s && s.trim()) strings.add(s); }); });
    }
    if (activeSubTab === "audit") {
      (AUDIT_PARAMS as any[]).forEach(p => { strings.add(p.name); strings.add(p.desc); });
    }
    const missing = Array.from(strings).filter(s => !(`${chkLang}:${s}` in trCache));
    if (missing.length === 0) return;
    let cancelled = false;
    setTranslating(true);
    Promise.all(missing.map(async s => [s, await translateText(s, chkLang)] as const))
      .then(pairs => {
        if (cancelled) return;
        setTrCache(prev => { const next = { ...prev }; pairs.forEach(([s, t]) => { next[`${chkLang}:${s}`] = t; }); return next; });
      })
      .finally(() => { if (!cancelled) setTranslating(false); });
    return () => { cancelled = true; };
    // trCache intentionally omitted — closure value is correct for the current switch.
  }, [chkLang, selectedMachine, activeSubTab, equipment]);

  // ── Build the render context ────────────────────────────────────────────────
  const ctx: MaintCtx = useMemo(() => {
    const CHECKLISTS: Record<string, any> = {};
    equipment.forEach(e => { CHECKLISTS[e.id] = e.checklist; });
    return {
      MACHINES: visibleEquipment,
      CHECKLISTS,
      checklists,
      defects,
      audits,
      checklistHistory: history,
      userName: activeUser.name,
      role,
      caps: capMap,
      canSubmit: capMap.runChecklist,
      selectedMachine,
      checklistHistoryFilterDate,
      auditHistoryFilterDate,
      floorFilter: selectedFloor,
      outletName: selectedOutlet.name,
      sopRoster,
      reopened,
      tr,
    };
  }, [equipment, visibleEquipment, checklists, defects, audits, history, activeUser.name, role, capMap,
      selectedMachine, checklistHistoryFilterDate, auditHistoryFilterDate, selectedFloor, selectedOutlet.name, sopRoster, reopened, tr]);

  const latestRef = useRef({ ctx, tenantId, clientId });
  latestRef.current = { ctx, tenantId, clientId };

  const bodyHtml = useMemo(() => renderTab(ctx, activeSubTab), [ctx, activeSubTab]);

  // ── Delegated actions ───────────────────────────────────────────────────────
  const download = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("href", url); a.setAttribute("download", filename);
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleToggle = useCallback(async (equipId: string, idx: number, val: string) => {
    const { tenantId: tid } = latestRef.current;
    const eq = latestRef.current.ctx.MACHINES.find(m => m.id === equipId);
    if (!eq) return;
    setChecklists(prev => {
      const cur = { ...(prev[equipId] || {}) } as ChecklistResponses;
      const existing = (cur as any)[idx];
      const next = existing === val ? null : val;
      if (next === null) delete (cur as any)[idx];
      else (cur as any)[idx] = next;
      const responses: Record<string, string> = {};
      Object.keys(cur).forEach(k => { if (k !== "_tech") responses[k] = (cur as any)[k]; });
      const techName = (cur as any)._tech || activeUser.name;
      svc.setChecklistMark(tid, equipId, responses, techName).then(async () => {
        const rule = eq.checklist[idx];
        if (next === "notok" && rule) {
          await svc.createDefect(tid, equipId, eq.name, idx, rule.c, rule.std, deriveCriticality(rule.p, rule.c));
        } else {
          await svc.resolveDefectForItem(tid, equipId, idx);
        }
        svc.getDefects(tid).then(setDefects);
      });
      return { ...prev, [equipId]: cur };
    });
  }, [activeUser.name]);

  const handleClick = useCallback((e: Event) => {
    const target = e.target as HTMLElement;
    const el = target.closest("[data-open-chk],[data-chk-val],[data-complete-freq],[data-reopen-freq],#chkBackBtn,#submitAuditBtn,#exportRoundsCsv,#exportDefectsCsv,#exportAuditsCsv,#auditHistoryShowAllBtn,#checklistHistoryShowAllBtn") as HTMLElement | null;
    if (!el) return;
    const { ctx: c, tenantId: tid } = latestRef.current;

    if (el.hasAttribute("data-open-chk")) { setSelectedMachine(el.getAttribute("data-open-chk")); return; }
    if (el.id === "chkBackBtn") { setSelectedMachine(null); return; }
    if (el.hasAttribute("data-reopen-freq")) { const f = el.getAttribute("data-reopen-freq")!; setReopened(prev => prev.includes(f) ? prev : [...prev, f]); return; }

    if (el.hasAttribute("data-chk-val")) {
      const idx = parseInt(el.getAttribute("data-chk-idx") || "0", 10);
      const val = el.getAttribute("data-chk-val")!;
      if (c.selectedMachine) handleToggle(c.selectedMachine, idx, val);
      return;
    }

    if (el.hasAttribute("data-complete-freq")) {
      const freq = el.getAttribute("data-complete-freq")!;
      const mId = c.selectedMachine;
      if (!mId) return;
      const machine = c.MACHINES.find(m => m.id === mId);
      const checklist = machine?.checklist || [];
      const cur = c.checklists[mId] || {};
      const freqIdx = new Set<string>();
      checklist.forEach((it, idx) => { if ((it.freq || "Daily") === freq) freqIdx.add(String(idx)); });
      const archiveItems: Record<string, string> = {};
      const remaining: Record<string, string> = {};
      Object.keys(cur).forEach(k => {
        if (k === "_tech") return;
        if (freqIdx.has(k)) archiveItems[k] = (cur as any)[k];
        else remaining[k] = (cur as any)[k];
      });
      if (Object.keys(archiveItems).length === 0) { alert(`Mark at least one ${freq} item before submitting.`); return; }
      const techName = (cur as any)._tech || activeUser.name;
      setReopened(prev => prev.filter(f => f !== freq));
      svc.completeFrequencyRound(tid, mId, machine?.name || mId, archiveItems, remaining, techName, freq).then(reload);
      return;
    }

    if (el.id === "submitAuditBtn") {
      const root = bodyRef.current!;
      const sel = root.querySelector("#auditAssetSelect") as HTMLSelectElement;
      const chosenId = sel.value;
      const eq = c.MACHINES.find(m => m.id === chosenId);
      const scores: number[] = [];
      const remarks: string[] = [];
      root.querySelectorAll(".audit-score-input").forEach(s => scores.push(parseInt((s as HTMLSelectElement).value, 10)));
      root.querySelectorAll(".audit-remark-input").forEach(s => remarks.push((s as HTMLInputElement).value));
      svc.submitAudit(tid, chosenId, eq?.name || chosenId, activeUser.name, scores, remarks)
        .then(total => { alert(`Audit saved. Total score: ${total} / 25`); reload(); });
      return;
    }

    if (el.id === "exportRoundsCsv") { const { content, filename } = buildCsv(c, "rounds"); download(content, filename); return; }
    if (el.id === "exportDefectsCsv") { const { content, filename } = buildCsv(c, "defects"); download(content, filename); return; }
    if (el.id === "exportAuditsCsv") { const { content, filename } = buildCsv(c, "audits"); download(content, filename); return; }
    if (el.id === "checklistHistoryShowAllBtn") { setChecklistHistoryFilterDate(""); return; }
    if (el.id === "auditHistoryShowAllBtn") { setAuditHistoryFilterDate(""); return; }
  }, [handleToggle, reload, activeUser.name]);

  const handleChange = useCallback((e: Event) => {
    const el = e.target as HTMLElement;
    const { ctx: c, tenantId: tid, clientId: cid } = latestRef.current;

    if (el.id === "techNameInput" && c.selectedMachine) {
      const mId = c.selectedMachine;
      const value = (el as HTMLInputElement).value;
      setChecklists(prev => {
        const cur = { ...(prev[mId] || {}) } as ChecklistResponses;
        (cur as any)._tech = value;
        const responses: Record<string, string> = {};
        Object.keys(cur).forEach(k => { if (k !== "_tech") responses[k] = (cur as any)[k]; });
        svc.setChecklistMark(tid, mId, responses, value);
        return { ...prev, [mId]: cur };
      });
      return;
    }

    if (el.classList.contains("sop-roster-input")) {
      const key = el.getAttribute("data-roster-key")!;
      const value = (el as HTMLInputElement).value;
      setSopRoster(prev => {
        const next = { ...prev, [key]: value };
        if (cid) svc.setSopRoster(cid, next);
        return next;
      });
      return;
    }

    if (el.classList.contains("df-update")) {
      const dfId = el.getAttribute("data-df-id")!;
      const field = el.getAttribute("data-df-field")!;
      const value = (el as HTMLInputElement).value;
      svc.updateDefectField(dfId, field, value).then(() => {
        setDefects(prev => prev.map(d => d.id === dfId ? { ...d, [field]: value } : d));
      });
      return;
    }

    if (el.id === "checklistHistoryDateInput") { setChecklistHistoryFilterDate((el as HTMLInputElement).value); return; }
    if (el.id === "auditHistoryDateInput") { setAuditHistoryFilterDate((el as HTMLInputElement).value); return; }
  }, []);

  useEffect(() => {
    const node = bodyRef.current;
    if (!node) return;
    node.addEventListener("click", handleClick);
    node.addEventListener("change", handleChange);
    return () => {
      node.removeEventListener("click", handleClick);
      node.removeEventListener("change", handleChange);
    };
  }, [handleClick, handleChange, activeSubTab]);

  const selectTab = (id: string) => { setActiveSubTab(id); setSelectedMachine(null); };
  const onOutletChange = (id: string) => { setSelectedOutletId(id); setSelectedFloor(""); setSelectedMachine(null); };
  const onFloorChange = (f: string) => { setSelectedFloor(f); setSelectedMachine(null); };

  const isAdminTab = activeSubTab === "adminPanel";

  return (
    <div className="clit-scope" style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{CLIT_SCOPED_CSS}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ width: 34, height: 34, border: "2px solid var(--amber)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--amber)", flexShrink: 0 }}>
          <Wrench className="w-4 h-4" />
        </div>
        <div>
          <h1 style={{ fontSize: 18 }}>CLIT Autonomous Maintenance</h1>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted)", fontFamily: "'JetBrains Mono', monospace" }}>
            {selectedOutlet.name} &middot; Clean · Lubricate · Inspect · Tighten
          </p>
        </div>
      </div>

      <div className="clit-filterbar">
        <div className="clit-filter-field">
          <label>Outlet</label>
          <select value={selectedOutletId} onChange={e => onOutletChange(e.target.value)}>
            {outlets.map(o => (
              <option key={o.id} value={o.id}>{o.logo ? `${o.logo} ` : ""}{o.name}</option>
            ))}
          </select>
        </div>
        <div className="clit-filter-field">
          <label>Floor</label>
          <select value={selectedFloor} onChange={e => onFloorChange(e.target.value)} disabled={floors.length === 0}>
            <option value="">{floors.length === 0 ? "No floors tagged yet" : "All floors"}</option>
            {floors.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      <div className="clit-tabnav">
        {visibleTabs.map((t, i) => (
          <button
            key={t.id}
            className={`tab-btn ${activeSubTab === t.id ? "active" : ""}`}
            onClick={() => selectTab(t.id)}
          >
            <span className="num">0{i + 1}</span>{t.label}
          </button>
        ))}
      </div>

      {!loading && !isAdminTab && ((activeSubTab === "equipment" && selectedMachine) || activeSubTab === "audit") && (
        <div className="clit-langbar">
          <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "'JetBrains Mono', monospace" }}>View in:</span>
          {CLIT_LANGS.map(x => (
            <button key={x.c} className={`lang-btn ${chkLang === x.c ? "active" : ""}`} disabled={translating} onClick={() => setChkLang(x.c)}>{x.l}</button>
          ))}
          {translating && <span style={{ fontSize: 10, color: "var(--muted)" }}>Translating…</span>}
        </div>
      )}

      {loading ? (
        <div className="empty-state">Loading outlet maintenance data…</div>
      ) : isAdminTab ? (
        <MaintenanceAdmin
          tenantId={tenantId}
          outletName={selectedOutlet.name}
          equipment={equipment}
          floorPrefill={selectedFloor}
          canManageEquipment={capMap.manageEquipment}
          canManageAccess={capMap.manageAccess}
          clientUsers={clientUsers}
          onReloadEquipment={reload}
          onSetClitAccess={onSetClitAccess || (async () => {})}
        />
      ) : (
        <div ref={bodyRef} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      )}
    </div>
  );
}
