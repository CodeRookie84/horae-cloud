/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// Equipment Maintenance (CLIT Autonomous Maintenance) — the dashboard tab.
//
// A self-contained React "island" that ports the standalone CLIT tool into
// Horae: it loads per-outlet state from Supabase (maintenanceService), renders
// the active sub-tab's HTML (maintenanceEngine.renderTab) into a `.clit-scope`
// container, and drives all interactivity through delegated native event
// listeners keyed on the same `data-*` attributes the original tool used. Light
// polling + focus/visibility refresh keeps outlets in sync across devices.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Wrench } from "lucide-react";
import { User as AppUser, Tenant } from "../../types";
import { CLIT_SCOPED_CSS, MAINT_TABS, MaintRole } from "./maintenanceTheme";
import {
  MaintCtx, DraftRow, Equipment, DefectRow, AuditRow, HistoryRow, ChecklistResponses,
  maintRole, renderTab, buildCsv, deriveCriticality, getFacilityTodayString,
} from "./maintenanceEngine";
import * as svc from "../../services/maintenanceService";

interface Props {
  activeUser: AppUser;
  activeTenant: Tenant;
  tenants: Tenant[];
}

export default function MaintenanceHub({ activeUser, activeTenant }: Props) {
  const tenantId = activeTenant.id;
  const role: MaintRole = maintRole(activeUser.role as string);
  const visibleTabs = useMemo(() => MAINT_TABS.filter(t => t.roles.includes(role)), [role]);

  // ── Data + UI state ────────────────────────────────────────────────────────
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [checklists, setChecklists] = useState<Record<string, ChecklistResponses>>({});
  const [defects, setDefects] = useState<DefectRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeSubTab, setActiveSubTab] = useState<string>(visibleTabs[0]?.id || "templates");
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
  const [machineAdminOpen, setMachineAdminOpen] = useState(false);
  const [checklistHistoryFilterDate, setChecklistHistoryFilterDate] = useState<string>(getFacilityTodayString());
  const [auditHistoryFilterDate, setAuditHistoryFilterDate] = useState<string>(getFacilityTodayString());

  // Machine-add draft is a mutable ref (like the original) so typing into its
  // fields never triggers a re-render / focus loss; structural changes bump tick.
  const draftRef = useRef<DraftRow[]>([{ c: "", p: "Clean", std: "", freq: "Daily", method: "" }]);
  const [tick, setTick] = useState(0);
  const forceRender = useCallback(() => setTick(t => t + 1), []);

  const bodyRef = useRef<HTMLDivElement | null>(null);

  // ── Load / reload ──────────────────────────────────────────────────────────
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

  useEffect(() => { setLoading(true); reload(); }, [reload]);

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

  // ── Build the render context ────────────────────────────────────────────────
  const ctx: MaintCtx = useMemo(() => {
    const CHECKLISTS: Record<string, any> = {};
    equipment.forEach(e => { CHECKLISTS[e.id] = e.checklist; });
    return {
      MACHINES: equipment,
      CHECKLISTS,
      checklists,
      defects,
      audits,
      checklistHistory: history,
      userName: activeUser.name,
      role,
      selectedMachine,
      machineAdminOpen,
      newMachineDraft: draftRef.current,
      checklistHistoryFilterDate,
      auditHistoryFilterDate,
    };
    // `tick` forces a rebuild when the (mutable) machine-add draft rows change.
  }, [equipment, checklists, defects, audits, history, activeUser.name, role,
      selectedMachine, machineAdminOpen, checklistHistoryFilterDate, auditHistoryFilterDate, tick]);

  // Keep the latest ctx + tenant available to the (stable) native listeners.
  const latestRef = useRef({ ctx, tenantId });
  latestRef.current = { ctx, tenantId };

  const bodyHtml = useMemo(() => renderTab(ctx, activeSubTab), [ctx, activeSubTab]);

  // ── Delegated actions (attached once to the body container) ─────────────────
  const download = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("href", url);
    a.setAttribute("download", filename);
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
      // Persist state + create/resolve defect (fire-and-forget; poll reconciles).
      svc.setChecklistMark(tid, equipId, responses, techName).then(async () => {
        const rule = eq.checklist[idx];
        if (next === "notok" && rule) {
          await svc.createDefect(tid, equipId, eq.name, idx, rule.c, rule.std,
            deriveCriticality(rule.p, rule.c));
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
    const el = target.closest("[data-open-chk],[data-chk-val],[data-remove-draft-row],[data-delete-machine],#chkBackBtn,#completeRoundBtn,#submitAuditBtn,#exportDefectsCsv,#exportAuditsCsv,#toggleMachineAdminBtn,#addChecklistRowBtn,#createMachineBtn,#purgeDataBtn,#auditHistoryShowAllBtn,#checklistHistoryShowAllBtn") as HTMLElement | null;
    if (!el) return;
    const { ctx: c, tenantId: tid } = latestRef.current;

    if (el.hasAttribute("data-open-chk")) { setSelectedMachine(el.getAttribute("data-open-chk")); return; }
    if (el.id === "chkBackBtn") { setSelectedMachine(null); return; }

    if (el.hasAttribute("data-chk-val")) {
      const idx = parseInt(el.getAttribute("data-chk-idx") || "0", 10);
      const val = el.getAttribute("data-chk-val")!;
      if (c.selectedMachine) handleToggle(c.selectedMachine, idx, val);
      return;
    }

    if (el.id === "completeRoundBtn") {
      const mId = c.selectedMachine;
      if (!mId) return;
      const eq = c.MACHINES.find(m => m.id === mId);
      const cur = c.checklists[mId] || {};
      const responses: Record<string, string> = {};
      Object.keys(cur).forEach(k => { if (k !== "_tech") responses[k] = (cur as any)[k]; });
      svc.completeRound(tid, mId, eq?.name || mId, responses, (cur as any)._tech || activeUser.name)
        .then(() => { setSelectedMachine(null); reload(); });
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
        .then(total => { alert(`Audit transaction finalized successfully. Total Score: ${total} / 25`); reload(); });
      return;
    }

    if (el.id === "exportDefectsCsv") { const { content, filename } = buildCsv(c, "defects"); download(content, filename); return; }
    if (el.id === "exportAuditsCsv") { const { content, filename } = buildCsv(c, "audits"); download(content, filename); return; }
    if (el.id === "checklistHistoryShowAllBtn") { setChecklistHistoryFilterDate(""); return; }
    if (el.id === "auditHistoryShowAllBtn") { setAuditHistoryFilterDate(""); return; }

    // ── Machine admin ──
    if (el.id === "toggleMachineAdminBtn") {
      setMachineAdminOpen(open => {
        const next = !open;
        if (next) draftRef.current = [{ c: "", p: "Clean", std: "", freq: "Daily", method: "" }];
        return next;
      });
      return;
    }
    if (el.id === "addChecklistRowBtn") {
      draftRef.current = [...draftRef.current, { c: "", p: "Clean", std: "", freq: "Daily", method: "" }];
      forceRender();
      return;
    }
    if (el.hasAttribute("data-remove-draft-row")) {
      const i = parseInt(el.getAttribute("data-remove-draft-row") || "0", 10);
      if (draftRef.current.length > 1) draftRef.current = draftRef.current.filter((_, j) => j !== i);
      forceRender();
      return;
    }
    if (el.id === "createMachineBtn") {
      const root = bodyRef.current!;
      const name = ((root.querySelector("#newMachName") as HTMLInputElement)?.value || "").trim();
      const group = ((root.querySelector("#newMachGroup") as HTMLInputElement)?.value || "").trim();
      const icon = (root.querySelector("#newMachIcon") as HTMLSelectElement)?.value || "oven";
      const checklist = draftRef.current.filter(r => r.c.trim() && r.std.trim());
      if (!name || !group || checklist.length === 0) {
        alert("Please provide a machine name, category, and at least one complete checklist row (component + target standard).");
        return;
      }
      svc.addEquipment(tid, name, group, icon, checklist).then(() => {
        draftRef.current = [{ c: "", p: "Clean", std: "", freq: "Daily", method: "" }];
        setMachineAdminOpen(false);
        reload();
      });
      return;
    }
    if (el.hasAttribute("data-delete-machine")) {
      e.stopPropagation();
      const id = el.getAttribute("data-delete-machine")!;
      const mach = c.MACHINES.find(m => m.id === id);
      if (!confirm(`Delete "${mach ? mach.name : id}" and its in-progress checklist? This cannot be undone.`)) return;
      svc.deleteEquipment(id).then(reload);
      return;
    }
    if (el.id === "purgeDataBtn") {
      if (!confirm("Reset System Cache for this outlet? This wipes in-progress checklist marks and the open Defect Log. Audit history and the Checklist History archive are preserved.")) return;
      svc.resetCache(tid).then(reload);
      return;
    }
  }, [handleToggle, reload, activeUser.name, forceRender]);

  const handleChange = useCallback((e: Event) => {
    const el = e.target as HTMLElement;
    const { ctx: c, tenantId: tid } = latestRef.current;

    // Draft field edits — mutate the ref silently (no re-render, no focus loss).
    const draftClass = ["chk-draft-c", "chk-draft-p", "chk-draft-std", "chk-draft-freq", "chk-draft-method"]
      .find(cls => el.classList.contains(cls));
    if (draftClass) {
      const i = parseInt(el.getAttribute("data-row") || "0", 10);
      const row = draftRef.current[i];
      if (row) {
        const key = draftClass.replace("chk-draft-", "") as keyof DraftRow;
        (row as any)[key] = (el as HTMLInputElement).value;
      }
      return;
    }

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
  }, [handleClick, handleChange]);

  // Switching sub-tabs always returns to the machine list.
  const selectTab = (id: string) => { setActiveSubTab(id); setSelectedMachine(null); setMachineAdminOpen(false); };

  return (
    <div className="clit-scope" style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{CLIT_SCOPED_CSS}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ width: 34, height: 34, border: "2px solid var(--amber)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--amber)", flexShrink: 0 }}>
          <Wrench className="w-4 h-4" />
        </div>
        <div>
          <h1 style={{ fontSize: 17 }}>CLIT Autonomous Maintenance</h1>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted)", fontFamily: "'IBM Plex Mono', monospace" }}>
            {activeTenant.name} &middot; Clean · Lubricate · Inspect · Tighten
          </p>
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

      {loading ? (
        <div className="empty-state">Loading outlet maintenance data…</div>
      ) : (
        <div ref={bodyRef} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      )}
    </div>
  );
}
