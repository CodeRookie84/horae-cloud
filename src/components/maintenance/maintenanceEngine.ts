/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// Pure logic + HTML renderers for the Equipment Maintenance (CLIT) tab.
//
// These are ported near-verbatim from the standalone tool's template functions
// (clit_autonomous_maintenance.html), adapted to take an explicit MaintCtx
// instead of reading module globals (MACHINES / CHECKLISTS / APP_STATE). The
// renderers return HTML strings that MaintenanceHub injects into a `.clit-scope`
// container; all interactivity is handled by delegated events in the Hub, keyed
// on the same `data-*` attributes the original used.

import {
  PARAM_COLORS, AUDIT_PARAMS, GRADING, ICONS,
  SOP_DOC_INFO, SOP_CHAPTERS, GOVERNANCE_HTML,
} from "./maintenanceData";
import type { MaintRole } from "./maintenanceTheme";

// ── Types ────────────────────────────────────────────────────────────────
export interface ChecklistRow { c: string; p: string; std: string; freq: string; method: string; }

export interface Equipment {
  id: string;
  tenantId: string;
  name: string;
  group: string;
  icon: string;
  checklist: ChecklistRow[];
  isCustom?: boolean;
  sortOrder?: number;
}

/** Per-equipment in-progress marks — mirrors the original APP_STATE.checklists. */
export type ChecklistResponses = { [idx: string]: "ok" | "notok" } & { _tech?: string };

export interface DefectRow {
  id: string;
  machineId: string;
  machineName: string;
  itemIdx: number;
  component: string;
  desc: string;
  criticality: "Critical" | "Non-Critical";
  status: "Open" | "In Progress" | "Closed";
  action: string;
  spares: string;
  target: string;
  date: string;
}

export interface AuditRow {
  id: string;
  machineId: string;
  machineName: string;
  date: string;
  inspector: string;
  totalScore: number;
  scores?: number[];
  remarks?: string[];
}

export interface HistoryRow {
  id: string;
  machineId: string;
  date: string;
  techName: string;
  items: { [idx: string]: string };
}

export interface DraftRow { c: string; p: string; std: string; freq: string; method: string; }

export interface MaintCtx {
  MACHINES: Equipment[];
  /** id → checklist rulebook (from equipment.checklist). */
  CHECKLISTS: Record<string, ChecklistRow[]>;
  /** id → in-progress responses (APP_STATE.checklists shape). */
  checklists: Record<string, ChecklistResponses>;
  defects: DefectRow[];
  audits: AuditRow[];
  checklistHistory: HistoryRow[];
  userName: string;
  role: MaintRole;
  selectedMachine: string | null;
  machineAdminOpen: boolean;
  newMachineDraft: DraftRow[];
  checklistHistoryFilterDate: string;
  auditHistoryFilterDate: string;
}

// ── Role mapping (Horae Role string → internal maintenance role) ────────────
export function maintRole(role: string): MaintRole {
  if (role === "Super Admin" || role === "Admin") return "admin";
  if (role === "Manager" || role === "Supervisor") return "manager";
  return "technician";
}

// ── Small utilities ─────────────────────────────────────────────────────────
export function esc(v: any): string {
  return String(v ?? "").replace(/"/g, "&quot;");
}
export function escHtml(v: any): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
export function getIcon(name: string, size = 24): string {
  const code = (ICONS as Record<string, string>)[name] || (ICONS as Record<string, string>).oven;
  return code.replace("<svg ", `<svg width="${size}" height="${size}" `);
}
export const ICON_KEYS = [
  "mixer", "oven", "kettle", "rotary", "chamber", "spiral", "sheeter",
  "freezer1", "chiller1", "chiller2", "chiller3", "chiller4", "fryer", "mixer-small",
];

/** Facility-local (Asia/Kolkata) YYYY-MM-DD — matches the original's date convention. */
export function getFacilityTodayString(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function generateDefectId(): string {
  return `DEF-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 36).toString(36).toUpperCase()}`;
}

/** Critical if an Inspect item on a safety-relevant component fails. Verbatim rule. */
export function deriveCriticality(param: string, component: string): "Critical" | "Non-Critical" {
  return (param === "Inspect" && /seal|safety|burner|heating|probe/i.test(component))
    ? "Critical" : "Non-Critical";
}

export function checkMachineStatus(ctx: MaintCtx, id: string): "green" | "yellow" | "red" | "gray" {
  const current = ctx.checklists[id] || {};
  const dataList = Object.keys(current).filter(k => k !== "_tech").map(k => (current as any)[k]).filter(Boolean);
  if (dataList.some(v => v === "notok")) return "red";
  if (dataList.length === 0) return "gray";
  const ruleBookLength = (ctx.CHECKLISTS[id] || []).length;
  if (dataList.filter(v => v === "ok").length === ruleBookLength) return "green";
  return "yellow";
}

export function computeGlobalMetrics(ctx: MaintCtx) {
  let g = 0, y = 0, r = 0, gr = 0;
  ctx.MACHINES.forEach(m => {
    const stat = checkMachineStatus(ctx, m.id);
    if (stat === "green") g++;
    else if (stat === "yellow") y++;
    else if (stat === "red") r++;
    else gr++;
  });
  return { green: g, yellow: y, red: r, gray: gr };
}

// ── Renderers (return HTML strings) ─────────────────────────────────────────

export function renderIntro(ctx: MaintCtx): string {
  const m = computeGlobalMetrics(ctx);
  return `
    <div class="eyebrow">Section 1 &middot; Active Ecosystem</div>
    <h2 class="section-title">Plant Overview &amp; Diagnostics</h2>
    <p class="section-sub">Real-time control tower across all processing lines. The registry below lists every machine at this outlet and its current status at a glance &mdash; checklist entry itself is performed by Technicians on the CLIT Checklist tab.</p>

    <div class="grid-3" style="margin-bottom:32px;">
      <div class="metric-card"><div class="metric-num" style="color:var(--green)">${m.green}</div><div class="metric-label">Operational (Green)</div></div>
      <div class="metric-card"><div class="metric-num" style="color:var(--yellow)">${m.yellow}</div><div class="metric-label">Testing In Progress</div></div>
      <div class="metric-card"><div class="metric-num" style="color:var(--red)">${m.red}</div><div class="metric-label">Action Items Flagged</div></div>
    </div>

    <div class="card">
      <h3 style="font-size:16px; margin-bottom:14px;">Plant Machinery Registry</h3>
      <div class="status-grid">
        ${ctx.MACHINES.map(mach => {
          const s = checkMachineStatus(ctx, mach.id);
          return `
            <div class="status-tag status-${s}" style="cursor:default;">
              <span>${getIcon(mach.icon, 20)}</span>
              <span class="status-name">${escHtml(mach.name)}</span>
            </div>`;
        }).join("")}
      </div>
    </div>
  `;
}

function renderMachineAdminPanel(ctx: MaintCtx): string {
  return `
    <div class="card" style="margin-bottom:20px; border:1px solid var(--amber);">
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <h3 style="font-size:15px; margin:0;">Manage Machinery <span style="opacity:.6; font-weight:400;">(Admin only)</span></h3>
        <button id="toggleMachineAdminBtn" class="back-btn" style="margin:0;">${ctx.machineAdminOpen ? "Close" : "+ Add Machine"}</button>
      </div>
      ${ctx.machineAdminOpen ? `
        <div style="margin-top:16px; display:grid; gap:12px;">
          <div class="form-grid-3" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
            <div><label class="field-label">Machine Name</label><input type="text" class="field-input" id="newMachName" placeholder="e.g. Bread Slicer"></div>
            <div><label class="field-label">Category / Group</label><input type="text" class="field-input" id="newMachGroup" placeholder="e.g. Cutting"></div>
            <div><label class="field-label">Icon</label>
              <select class="field-input" id="newMachIcon">${ICON_KEYS.map(k => `<option value="${k}">${k}</option>`).join("")}</select>
            </div>
          </div>
          <div>
            <label class="field-label">Checklist Items</label>
            <div id="newMachChecklistRows" style="display:grid; gap:8px;">
              ${ctx.newMachineDraft.map((row, i) => `
                <div class="checklist-draft-row" style="display:grid; grid-template-columns:2fr 1fr 2fr 1fr 1.5fr auto; gap:8px;">
                  <input type="text" class="field-input chk-draft-c" data-row="${i}" placeholder="Component" value="${esc(row.c)}">
                  <select class="field-input chk-draft-p" data-row="${i}">
                    ${["Clean", "Lubricate", "Inspect", "Tighten"].map(p => `<option value="${p}" ${row.p === p ? "selected" : ""}>${p}</option>`).join("")}
                  </select>
                  <input type="text" class="field-input chk-draft-std" data-row="${i}" placeholder="Target standard" value="${esc(row.std)}">
                  <select class="field-input chk-draft-freq" data-row="${i}">
                    ${["Daily", "Weekly"].map(f => `<option value="${f}" ${row.freq === f ? "selected" : ""}>${f}</option>`).join("")}
                  </select>
                  <input type="text" class="field-input chk-draft-method" data-row="${i}" placeholder="Method" value="${esc(row.method)}">
                  <button class="machine-delete-btn" data-remove-draft-row="${i}" title="Remove row" ${ctx.newMachineDraft.length <= 1 ? "disabled" : ""} style="width:28px; height:28px; border-radius:50%; border:1px solid var(--red); background:#fff; color:var(--red); cursor:pointer;">&times;</button>
                </div>`).join("")}
            </div>
            <button id="addChecklistRowBtn" class="back-btn" style="margin-top:8px;">+ Add checklist row</button>
          </div>
          <button id="createMachineBtn" class="btn-primary" style="width:fit-content;">Create Machine</button>
        </div>
      ` : ""}
    </div>`;
}

export function renderChecklists(ctx: MaintCtx): string {
  if (!ctx.selectedMachine) {
    return `
      <div class="eyebrow">Section 2 &middot; Execution Point</div>
      <h2 class="section-title">Asset Inspection Templates</h2>
      <p class="section-sub">Select active station machinery to trigger field collection checklist.</p>
      ${ctx.role === "admin" ? renderMachineAdminPanel(ctx) : ""}
      <div class="machine-grid">
        ${ctx.MACHINES.map(m => {
          const s = checkMachineStatus(ctx, m.id);
          const total = (ctx.CHECKLISTS[m.id] || []).length;
          const finished = Object.keys(ctx.checklists[m.id] || {}).filter(k => k !== "_tech" && (ctx.checklists[m.id] as any)[k]).length;
          return `
            <div class="machine-card-wrap" style="position:relative;">
              ${ctx.role === "admin" ? `<button class="machine-delete-btn" data-delete-machine="${m.id}" title="Delete machine" style="position:absolute; top:6px; right:6px; z-index:2; width:22px; height:22px; border-radius:50%; border:1px solid var(--red); background:#fff; color:var(--red); font-size:13px; line-height:1; cursor:pointer;">&times;</button>` : ""}
              <button class="machine-card status-${s}" data-open-chk="${m.id}">
                <span class="machine-icon">${getIcon(m.icon, 30)}</span>
                <span class="machine-name">${escHtml(m.name)}</span>
                <span class="machine-meta">${escHtml(m.group)} &middot; ${finished}/${total} Checked</span>
              </button>
            </div>`;
        }).join("")}
      </div>`;
  }

  const mObj = ctx.MACHINES.find(m => m.id === ctx.selectedMachine)!;
  const parameters = ctx.CHECKLISTS[ctx.selectedMachine] || [];
  const userResponses = ctx.checklists[ctx.selectedMachine] || {};

  return `
    <button class="back-btn" id="chkBackBtn">&larr; Return to asset listing</button>
    <div class="eyebrow">${escHtml(mObj.group)} &middot; Inspection Matrix</div>
    <h2 class="section-title">${escHtml(mObj.name)}</h2>
    <p class="section-sub">Perform physical inspection. Marking an entry as "Not OK" automatically opens a line-item inside the defect log.</p>

    <div class="card" style="margin-bottom:20px;">
      <label class="field-label">Technician Name on Record</label>
      <input type="text" class="field-input" id="techNameInput" value="${esc((userResponses as any)._tech || ctx.userName)}" placeholder="Enter technician name">
    </div>

    <div class="checklist-table-wrap">
      <table class="checklist-table">
        <thead>
          <tr>
            <th>Component Focus</th>
            <th>Type</th>
            <th>Target Standard</th>
            <th>Interval</th>
            <th>Method Verification</th>
            <th style="width:140px;">Status Input</th>
          </tr>
        </thead>
        <tbody>
          ${parameters.map((item, idx) => {
            const resp = (userResponses as any)[idx] || "";
            return `
              <tr>
                <td><strong>${escHtml(item.c)}</strong></td>
                <td><span class="param-chip param-${(PARAM_COLORS as any)[item.p]}">${item.p}</span></td>
                <td class="muted-cell">${escHtml(item.std)}</td>
                <td class="mono center">${item.freq}</td>
                <td class="muted-cell">${escHtml(item.method)}</td>
                <td>
                  <div class="status-toggle">
                    <button class="toggle-btn ok ${resp === "ok" ? "active" : ""}" data-chk-idx="${idx}" data-chk-val="ok">OK</button>
                    <button class="toggle-btn notok ${resp === "notok" ? "active" : ""}" data-chk-idx="${idx}" data-chk-val="notok">Not OK</button>
                  </div>
                </td>
              </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
    <div style="margin-top:18px; text-align:right;">
      <button class="btn-secondary" id="completeRoundBtn">Complete &amp; Archive Round</button>
    </div>
  `;
}

export function renderDefects(ctx: MaintCtx): string {
  const logs = ctx.defects;
  return `
    <div class="eyebrow">Section 3 &middot; Corrective Infrastructure</div>
    <h2 class="section-title">Centralized Maintenance Logs</h2>
    <p class="section-sub">Systemic tracking of line exceptions. Fields save automatically to the shared store on change events.</p>

    ${logs.length === 0 ? `
      <div class="empty-state">
        <p>No recorded exceptions found inside the cluster tracker.</p>
        <p class="muted-cell">All failures flagged during field checklist validation populate this database automatically.</p>
      </div>` : `
      <div class="checklist-table-wrap">
        <table class="checklist-table">
          <thead>
            <tr>
              <th>ID</th><th>Asset</th><th>Exception Description</th><th>Risk Classification</th>
              <th>Remedial Plan</th><th>Required Spares</th><th>Target Close</th><th>Workflow Phase</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(d => `
              <tr>
                <td class="mono" style="font-size:12px;">${d.id}</td>
                <td><strong>${escHtml(d.machineName)}</strong></td>
                <td class="muted-cell" style="font-size:12px;">${escHtml(d.component)}<br>${escHtml(d.desc)}</td>
                <td><span class="risk-chip risk-${d.criticality === "Critical" ? "critical" : "noncritical"}">${d.criticality}</span></td>
                <td><input type="text" class="inline-input df-update" data-df-id="${d.id}" data-df-field="action" value="${esc(d.action)}" placeholder="Define action path"></td>
                <td><input type="text" class="inline-input df-update" data-df-id="${d.id}" data-df-field="spares" value="${esc(d.spares)}" placeholder="Spares inventory requirements"></td>
                <td><input type="date" class="inline-input df-update" data-df-id="${d.id}" data-df-field="target" value="${d.target || ""}"></td>
                <td>
                  <select class="inline-select df-update" data-df-id="${d.id}" data-df-field="status">
                    <option value="Open" ${d.status === "Open" ? "selected" : ""}>Open Log</option>
                    <option value="In Progress" ${d.status === "In Progress" ? "selected" : ""}>Processing</option>
                    <option value="Closed" ${d.status === "Closed" ? "selected" : ""}>Closed Out</option>
                  </select>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`}
  `;
}

export function renderAudit(ctx: MaintCtx): string {
  return `
    <div class="eyebrow">Section 4 &middot; Quality Verification</div>
    <h2 class="section-title">Quality Assurance Spot-Audits</h2>
    <p class="section-sub">Independent validation protocol. Submit machine review parameters to track scores against core operations.</p>

    <div class="grid-2">
      <div class="card">
        <label class="field-label">Target Asset Valuation</label>
        <select class="field-input" id="auditAssetSelect">
          ${ctx.MACHINES.map(m => `<option value="${m.id}">${escHtml(m.name)} [${escHtml(m.group)}]</option>`).join("")}
        </select>
      </div>
      <div class="card">
        <label class="field-label">Auditor Signature Context</label>
        <input type="text" class="field-input" id="auditSignee" value="${esc(ctx.userName)}" readonly>
      </div>
    </div>

    <div class="checklist-table-wrap">
      <table class="checklist-table">
        <thead>
          <tr>
            <th style="width:30%;">Metric Vector</th>
            <th style="width:45%;">Evaluation Standard Target</th>
            <th style="width:10%;">Score Matrix</th>
            <th style="width:15%;">Notes Field</th>
          </tr>
        </thead>
        <tbody>
          ${AUDIT_PARAMS.map((p: any, idx: number) => `
            <tr>
              <td><strong>${escHtml(p.name)}</strong></td>
              <td class="muted-cell" style="font-size:12px;">${escHtml(p.desc)}</td>
              <td>
                <select class="inline-select audit-score-input" data-audit-row="${idx}">
                  <option value="5">5 [Excellent]</option>
                  <option value="4">4 [Compliant]</option>
                  <option value="3">3 [Acceptable]</option>
                  <option value="2">2 [Action Needed]</option>
                  <option value="1">1 [Violation Failure]</option>
                </select>
              </td>
              <td><input type="text" class="inline-input audit-remark-input" data-audit-row="${idx}" placeholder="Observation text"></td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>

    <div style="margin-top:20px; text-align:right;">
      <button class="btn-primary" id="submitAuditBtn">Commit Form Log to Storage</button>
    </div>

    <div class="card" style="margin-top:40px;">
      <h3 style="font-size:14px; margin-bottom:12px;">Historical Review Audit Submissions</h3>
      <p class="muted-cell" style="font-size:12px; margin-bottom:12px;">Audit submissions are a permanent record &mdash; never cleared by Reset System Cache. Select a date to review that day's submissions.</p>
      <div style="display:flex; gap:10px; align-items:end; margin-bottom:16px; flex-wrap:wrap;">
        <div><label class="field-label">Date</label><input type="date" class="field-input" id="auditHistoryDateInput" value="${ctx.auditHistoryFilterDate}"></div>
        <button class="btn-secondary" id="auditHistoryShowAllBtn">Show All</button>
      </div>
      ${(() => {
        const filtered = ctx.auditHistoryFilterDate
          ? ctx.audits.filter(au => au.date === ctx.auditHistoryFilterDate)
          : ctx.audits;
        if (filtered.length === 0) {
          return `<p class="muted-cell" style="font-size:13px;">${ctx.auditHistoryFilterDate
            ? `No audit submissions were recorded on ${ctx.auditHistoryFilterDate}.`
            : "No archived audit metrics logged inside data store."}</p>`;
        }
        return `
        <div class="checklist-table-wrap">
          <table class="checklist-table">
            <thead>
              <tr><th>Execution Date</th><th>Target Asset</th><th>Accumulated Metric</th><th>Auditor Reference</th></tr>
            </thead>
            <tbody>
              ${filtered.map(au => `
                <tr>
                  <td class="mono">${au.date}</td>
                  <td><strong>${escHtml(au.machineName)}</strong></td>
                  <td class="mono"><strong>${au.totalScore} / 25</strong></td>
                  <td>${escHtml(au.inspector)}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>`;
      })()}
    </div>
  `;
}

export function renderGovernance(): string {
  return GOVERNANCE_HTML;
}

export function renderSop(): string {
  return `
    <div class="eyebrow">Governing Document &middot; All Roles</div>
    <h2 class="section-title">SOP &amp; Governance Framework</h2>
    <p class="section-sub">Standard Operating Procedure for Autonomous Maintenance (CLIT) Implementation &mdash; a 5S- and TPM-driven framework for the reactive-to-proactive maintenance transition. Tap a chapter heading below to reveal its content.</p>

    <div class="checklist-table-wrap" style="margin-bottom:24px;">
      <table class="checklist-table">
        <tbody>
          ${SOP_DOC_INFO.map(([k, v]: any) => `<tr><td style="font-weight:600; width:260px;">${escHtml(k)}</td><td class="muted-cell">${escHtml(v)}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>

    ${SOP_CHAPTERS.map((c: any, i: number) => `
      <details class="accordion-item" ${i === 0 ? "open" : ""}>
        <summary>
          <div class="acc-meta">
            <span class="acc-tag">${c.tag}</span>
            <span>${escHtml(c.title)}</span>
          </div>
          <span class="acc-icon">+</span>
        </summary>
        <div class="accordion-body">${c.body}</div>
      </details>`).join("")}

    <div class="kicker-box">
      <p><strong>Scope:</strong> Konanakunte Cross Central Bakery and all distributed outlet kitchens (Jayanagar 4T Block, BTM Layout, HSR Layout, Sarjapur, Whitefield, Kundapura). Target audience: Maintenance Manager, QC Executives, Operations Team.</p>
    </div>
  `;
}

export function renderAnalytics(ctx: MaintCtx): string {
  const m = computeGlobalMetrics(ctx);
  const totalAssets = ctx.MACHINES.length || 1;
  const compliancePercentage = Math.round((m.green / totalAssets) * 100);

  const now = Date.now();
  const openLogs = ctx.defects.filter(d => d.status !== "Closed");
  const criticalOpen = openLogs.filter(d => d.criticality === "Critical");
  const nonCriticalOpen = openLogs.filter(d => d.criticality !== "Critical");

  const criticalOverdue = criticalOpen.filter(d => (now - new Date(d.date).getTime()) / 36e5 > 48).length;
  const nonCriticalOverdue = nonCriticalOpen.filter(d => (now - new Date(d.date).getTime()) / 36e5 > (7 * 24)).length;

  let averageAudit = "N/A";
  let worstGroup = "&mdash;";
  if (ctx.audits.length > 0) {
    const combined = ctx.audits.reduce((acc, curr) => acc + curr.totalScore, 0);
    averageAudit = (combined / ctx.audits.length).toFixed(1) + " / 25";
    const groupTotals: Record<string, { sum: number; count: number }> = {};
    ctx.audits.forEach(au => {
      const mach = ctx.MACHINES.find(mm => mm.id === au.machineId);
      const grp = mach ? mach.group : "Unclassified";
      if (!groupTotals[grp]) groupTotals[grp] = { sum: 0, count: 0 };
      groupTotals[grp].sum += au.totalScore;
      groupTotals[grp].count += 1;
    });
    let lowestAvg = Infinity;
    Object.entries(groupTotals).forEach(([grp, v]) => {
      const avg = v.sum / v.count;
      if (avg < lowestAvg) { lowestAvg = avg; worstGroup = grp; }
    });
  }

  const filteredHistory = ctx.checklistHistoryFilterDate
    ? ctx.checklistHistory.filter(h => h.date === ctx.checklistHistoryFilterDate)
    : ctx.checklistHistory;

  return `
    <div class="eyebrow">Section 5 &middot; Decision Frameworks</div>
    <h2 class="section-title">Aggregated Analytics Dashboard</h2>
    <p class="section-sub">Dynamic performance metrics compiled from internal device registers.</p>

    <div class="grid-4" style="margin-bottom:30px;">
      <div class="metric-card"><div class="metric-num" style="color:var(--amber)">${compliancePercentage}%</div><div class="metric-label">CLIT Compliance Today</div></div>
      <div class="metric-card"><div class="metric-num" style="color:var(--red)">${criticalOpen.length}</div><div class="metric-label">Open Critical Defects</div></div>
      <div class="metric-card"><div class="metric-num" style="color:var(--yellow)">${nonCriticalOpen.length}</div><div class="metric-label">Open Non-Critical Defects</div></div>
      <div class="metric-card"><div class="metric-num" style="color:var(--green)">${averageAudit}</div><div class="metric-label">Composite Audit Mean</div></div>
    </div>

    <div class="grid-2" style="margin-bottom:20px;">
      <div class="card">
        <h3 style="font-size:15px; margin-bottom:10px;">Defect Health Tracker</h3>
        <ul class="bullets">
          <li><strong>${openLogs.length}</strong> total open defects across the floor</li>
          <li><strong>${criticalOverdue}</strong> critical defects have exceeded the 48-hour closure target</li>
          <li><strong>${nonCriticalOverdue}</strong> non-critical defects have exceeded the 7-day closure target</li>
        </ul>
      </div>
      <div class="card">
        <h3 style="font-size:15px; margin-bottom:10px;">Audit Performance Index</h3>
        <ul class="bullets">
          <li>Average audit score: <strong>${averageAudit}</strong></li>
          <li>Worst-performing asset group: <strong>${worstGroup}</strong></li>
          <li>Total audits on record: <strong>${ctx.audits.length}</strong></li>
        </ul>
      </div>
    </div>

    <div class="card">
      <h3 style="font-size:16px; margin-bottom:14px;">Checklist History</h3>
      <p class="body-text" style="font-size:13px;">Each machine's checklist clears back to blank at the start of a new day &mdash; every completed round is preserved here first, so no record is ever silently lost. Select a date to review that day's rounds.</p>
      <div style="display:flex; gap:10px; align-items:end; margin-bottom:16px; flex-wrap:wrap;">
        <div><label class="field-label">Date</label><input type="date" class="field-input" id="checklistHistoryDateInput" value="${ctx.checklistHistoryFilterDate}"></div>
        <button class="btn-secondary" id="checklistHistoryShowAllBtn">Show All</button>
      </div>
      ${filteredHistory.length === 0 ? `
        <div class="empty-state">${ctx.checklistHistoryFilterDate
          ? `No checklist entries were recorded on ${ctx.checklistHistoryFilterDate}.`
          : "No completed checklist rounds archived yet."}</div>` : `
        <div class="checklist-table-wrap">
          <table class="checklist-table">
            <thead>
              <tr><th>Date</th><th>Machine</th><th>Technician</th><th>OK</th><th>Not OK</th></tr>
            </thead>
            <tbody>
              ${filteredHistory.slice(0, 200).map(h => {
                const mach = ctx.MACHINES.find(mm => mm.id === h.machineId);
                const statuses = Object.values(h.items || {});
                const okCount = statuses.filter(s => s === "ok").length;
                const notOkCount = statuses.filter(s => s === "notok").length;
                return `
                  <tr>
                    <td class="mono">${h.date}</td>
                    <td><strong>${escHtml(mach ? mach.name : h.machineId)}</strong></td>
                    <td>${escHtml(h.techName || "—")}</td>
                    <td><span class="risk-chip risk-noncritical">${okCount}</span></td>
                    <td>${notOkCount > 0 ? `<span class="risk-chip risk-critical">${notOkCount}</span>` : "0"}</td>
                  </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>`}
    </div>

    <div class="card">
      <h3 style="font-size:16px; margin-bottom:14px;">Data Extraction Portal</h3>
      <p class="body-text" style="font-size:13px;">Convert local state records into raw file formats for review outside the system shell.</p>
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        <button class="btn-secondary" id="exportDefectsCsv">Export Defect Log to CSV</button>
        <button class="btn-secondary" id="exportAuditsCsv">Export Audit Log to CSV</button>
      </div>
    </div>
  `;
}

export function renderAdminPanel(ctx: MaintCtx): string {
  return `
    <div class="eyebrow">Section 6 &middot; Central Configuration</div>
    <h2 class="section-title">Admin Management Console</h2>
    <p class="section-sub">Machinery and state-initialization actions for this outlet. User accounts &amp; roles are managed from Horae's Admin Panel.</p>

    ${renderMachineAdminPanel(ctx)}

    <div class="card">
      <h3 style="font-size:16px; margin-bottom:14px;">Machinery Registry (${ctx.MACHINES.length})</h3>
      <div class="checklist-table-wrap">
        <table class="checklist-table">
          <thead><tr><th>Asset</th><th>Group</th><th>Checklist Items</th><th>Origin</th><th></th></tr></thead>
          <tbody>
            ${ctx.MACHINES.map(m => `
              <tr>
                <td><strong>${escHtml(m.name)}</strong></td>
                <td class="muted-cell">${escHtml(m.group)}</td>
                <td class="center mono">${(ctx.CHECKLISTS[m.id] || []).length}</td>
                <td class="muted-cell">${m.isCustom ? "Custom" : "Built-in"}</td>
                <td class="center"><button class="btn-secondary" data-delete-machine="${m.id}" style="padding:6px 10px; font-size:11px; color:var(--red); border-color:var(--red);">Delete</button></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="border-top:3px solid var(--red);">
      <h3 style="font-size:16px; margin-bottom:14px; color:var(--red);">System Maintenance Functions</h3>
      <p class="body-text" style="font-size:13px;">Reset System Cache wipes in-progress checklist marks and the open Defect Log only, for this outlet. Audit submissions and the Checklist History archive are permanent records and are never affected.</p>
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        <button class="btn-primary" style="background:var(--red);" id="purgeDataBtn">Reset System Cache</button>
      </div>
    </div>
  `;
}

/** CSV escape + download helper (client-side, mirrors triggerCsvDownload). */
export function buildCsv(ctx: MaintCtx, mode: "defects" | "audits"): { content: string; filename: string } {
  if (mode === "defects") {
    const content = "ID,Asset,Component,Issue,Risk,Status,Action,Spares,Target Close\n" +
      ctx.defects.map(d => `"${d.id}","${d.machineName}","${d.component}","${d.desc}","${d.criticality}","${d.status}","${d.action || ""}","${d.spares || ""}","${d.target || ""}"`).join("\n");
    return { content, filename: "Defect_Master_Log.csv" };
  }
  const content = "Date,Asset,Total Score,Auditor\n" +
    ctx.audits.map(a => `"${a.date}","${a.machineName}","${a.totalScore}","${a.inspector}"`).join("\n");
  return { content, filename: "QA_Compliance_Audits.csv" };
}

export function renderTab(ctx: MaintCtx, tab: string): string {
  switch (tab) {
    case "intro": return renderIntro(ctx);
    case "templates": return renderChecklists(ctx);
    case "defects": return renderDefects(ctx);
    case "audit": return renderAudit(ctx);
    case "governance": return renderGovernance();
    case "analytics": return renderAnalytics(ctx);
    case "sop": return renderSop();
    case "adminPanel": return renderAdminPanel(ctx);
    default: return renderIntro(ctx);
  }
}
