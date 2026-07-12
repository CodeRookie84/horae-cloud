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
  PARAM_COLORS, AUDIT_PARAMS, ICONS,
  SOP_DOC_INFO, SOP_CHAPTERS, SOP_GOVERNANCE,
} from "./maintenanceData";
import type { ClitRole, Capability } from "./clitRoles";

/** Editable-per-client SOP roster fields (person names only). */
export const SOP_ROSTER_ROLES = [
  "Document Owner / Project Lead",
  "Project Sponsor",
  "Maintenance Manager",
  "QC Lead",
];

/** Frequencies rendered as separate forms on a machine, in display order. */
export const FREQUENCIES = ["Daily", "Weekly", "Monthly"] as const;

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
  /** Floor this machine lives on (client-defined, may be blank for legacy rows). */
  floor?: string;
  /** In-floor location / zone (optional). */
  location?: string;
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
  /** ISO submission timestamp (created_at). */
  submittedAt?: string;
}

export interface HistoryRow {
  id: string;
  machineId: string;
  date: string;
  techName: string;
  items: { [idx: string]: string };
  frequency?: string;
  /** ISO submission timestamp (created_at). */
  submittedAt?: string;
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
  role: ClitRole;
  /** Capability booleans derived from the CLIT role (see clitRoles.ts). */
  caps: Record<Capability, boolean>;
  /** Convenience: caps.runChecklist — may toggle marks and submit rounds. */
  canSubmit: boolean;
  selectedMachine: string | null;
  checklistHistoryFilterDate: string;
  auditHistoryFilterDate: string;
  /** Currently selected floor filter (shown in the equipment header). */
  floorFilter?: string;
  /** Selected outlet name (for headers). */
  outletName?: string;
  /** Per-client editable SOP roster (person names). */
  sopRoster: Record<string, string>;
  /** Frequencies the technician re-opened for early re-check on the open machine. */
  reopened: string[];
  /** Translate a display string to the selected language (identity if Original). */
  tr: (text: string) => string;
}

// CLIT role / capability mapping now lives in clitRoles.ts and is resolved from
// the user's `clitRole` (not their operational staff role) in MaintenanceHub.

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

/** Reset windows (in days) after which a completed round becomes due again. */
const FREQ_WINDOW_DAYS: Record<string, number> = { Daily: 1, Weekly: 7, Monthly: 31 };

/** Most recent submitted round for a machine + frequency (from history). */
export function latestSubmission(history: HistoryRow[], machineId: string, freq: string): HistoryRow | null {
  let best: HistoryRow | null = null;
  for (const h of history) {
    if (h.machineId !== machineId || (h.frequency || "") !== freq) continue;
    const key = h.submittedAt || h.date || "";
    const bestKey = best ? (best.submittedAt || best.date || "") : "";
    if (!best || key > bestKey) best = h;
  }
  return best;
}

/**
 * Whether a machine's frequency round is currently "done" (submitted within its
 * reset window). Daily resets at the next facility-day (after midnight); Weekly
 * 7 days after submission; Monthly ~31 days. Returns the submission row too.
 */
export function frequencyStatus(history: HistoryRow[], machineId: string, freq: string): { done: boolean; row: HistoryRow | null } {
  const last = latestSubmission(history, machineId, freq);
  if (!last) return { done: false, row: null };
  if (freq === "Daily") return { done: last.date === getFacilityTodayString(), row: last };
  const t = last.submittedAt ? new Date(last.submittedAt).getTime() : new Date(last.date + "T00:00:00").getTime();
  const days = (Date.now() - t) / 864e5;
  return { done: days < (FREQ_WINDOW_DAYS[freq] || 1), row: last };
}

/** Human "next due" label for a completed round. */
export function nextDueLabel(freq: string, row: HistoryRow | null): string {
  if (freq === "Daily") return "tomorrow";
  if (!row) return "";
  const base = row.submittedAt ? new Date(row.submittedAt) : new Date(row.date + "T00:00:00");
  base.setDate(base.getDate() + (FREQ_WINDOW_DAYS[freq] || 7));
  return base.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short" });
}

/** Machine status derived from submitted rounds + open defects (not live drafts). */
export function checkMachineStatus(ctx: MaintCtx, id: string): "green" | "yellow" | "red" | "gray" {
  if (ctx.defects.some(d => d.machineId === id && d.status !== "Closed")) return "red";
  const machine = ctx.MACHINES.find(m => m.id === id);
  const freqs = Array.from(new Set((machine?.checklist || ctx.CHECKLISTS[id] || []).map(i => i.freq || "Daily")));
  if (freqs.length === 0) return "gray";
  const done = freqs.filter(f => frequencyStatus(ctx.checklistHistory, id, f).done).length;
  if (done === 0) return "gray";
  if (done === freqs.length) return "green";
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

/** Combined Equipment tab: fleet status + machine grid, or a machine's forms. */
export function renderEquipment(ctx: MaintCtx): string {
  if (!ctx.selectedMachine) return renderEquipmentList(ctx);
  return renderMachineForms(ctx);
}

function renderEquipmentList(ctx: MaintCtx): string {
  const where = [ctx.outletName, ctx.floorFilter].filter(Boolean).join(" · ");
  const hint = ctx.canSubmit
    ? "Tap a machine to open its Daily, Weekly and Monthly checks and record the round."
    : "You can view live equipment status here. Running the checklist is done by the technician.";
  return `
    <div class="eyebrow">Equipment${where ? ` &middot; ${escHtml(where)}` : ""}</div>
    <h2 class="section-title">Equipment Status</h2>
    <p class="section-sub">${hint}</p>

    ${ctx.MACHINES.length === 0 ? `
      <div class="empty-state">No equipment set up for this outlet/floor yet.${ctx.caps.manageEquipment ? " Add machines from the Admin Console tab." : ""}</div>` : `
      <div class="machine-grid">
        ${ctx.MACHINES.map(mac => {
          const s = checkMachineStatus(ctx, mac.id);
          const label = s === "green" ? "All checks up to date"
            : s === "red" ? "Open defect"
            : s === "yellow" ? "Some checks due"
            : "Checks due";
          return `
            <button class="machine-card status-${s}" data-open-chk="${mac.id}">
              <span class="machine-icon">${getIcon(mac.icon, 30)}</span>
              <span class="machine-name">${escHtml(mac.name)}</span>
              <span class="machine-meta">${escHtml(mac.group)}${mac.floor ? ` &middot; ${escHtml(mac.floor)}` : ""}</span>
              <span class="machine-progress" style="color:var(--${s === 'gray' ? 'muted' : s});">${label}</span>
            </button>`;
        }).join("")}
      </div>`}
  `;
}

function statusPill(resp: string): string {
  if (resp === "ok") return `<span class="risk-chip risk-noncritical">OK</span>`;
  if (resp === "notok") return `<span class="risk-chip risk-critical">Not OK</span>`;
  return `<span class="muted-cell">—</span>`;
}

function renderMachineForms(ctx: MaintCtx): string {
  const mObj = ctx.MACHINES.find(m => m.id === ctx.selectedMachine)!;
  const parameters = ctx.CHECKLISTS[ctx.selectedMachine!] || [];
  const userResponses = ctx.checklists[ctx.selectedMachine!] || {};

  // Group checklist items by frequency, preserving original indices.
  const groups: Record<string, { item: ChecklistRow; idx: number }[]> = {};
  parameters.forEach((item, idx) => {
    const f = item.freq || "Daily";
    (groups[f] ||= []).push({ item, idx });
  });
  const orderedFreqs = [
    ...FREQUENCIES.filter(f => groups[f]),
    ...Object.keys(groups).filter(f => !(FREQUENCIES as readonly string[]).includes(f)),
  ];

  const techBlock = ctx.canSubmit
    ? `<div class="card" style="margin-bottom:20px;">
         <label class="field-label">Technician on record</label>
         <input type="text" class="field-input" id="techNameInput" value="${esc((userResponses as any)._tech || ctx.userName)}" placeholder="Enter technician name">
       </div>`
    : `<div class="kicker-box"><p>View-only. Checklist rounds are recorded by the technician.</p></div>`;

  const forms = orderedFreqs.map(freq => {
    const rows = groups[freq];
    const marked = rows.filter(r => (userResponses as any)[r.idx]).length;
    const status = frequencyStatus(ctx.checklistHistory, mObj.id, freq);
    const reopened = ctx.reopened.includes(freq);

    // Completed this cycle and not re-opened → show a done banner instead of the form.
    if (status.done && !reopened) {
      const row = status.row!;
      return `
        <div class="freq-card">
          <div class="freq-head">
            <h3>${escHtml(freq)} Checks</h3>
            <span class="freq-count" style="background:var(--green-light); color:var(--green);">Done this cycle</span>
          </div>
          <p class="body-text" style="margin:0;">
            <strong style="color:var(--green);">✓ Submitted</strong> ${formatDateTime(row.submittedAt) || row.date}
            ${row.techName ? ` &middot; by ${escHtml(row.techName)}` : ""} &middot; next due ${nextDueLabel(freq, row)}.
          </p>
          ${ctx.canSubmit ? `<div style="margin-top:12px;"><button class="btn-secondary" data-reopen-freq="${escHtml(freq)}">Re-check now</button></div>` : ""}
        </div>`;
    }

    return `
      <div class="freq-card">
        <div class="freq-head">
          <h3>${escHtml(freq)} Checks</h3>
          <span class="freq-count">${marked}/${rows.length} marked</span>
        </div>
        ${status.done ? `<p class="muted-cell" style="margin:-6px 0 12px; font-size:12.5px;">Already submitted this cycle — submitting again will record another round.</p>` : ""}
        <div class="chk-list">
          ${rows.map(({ item, idx }) => {
            const resp = (userResponses as any)[idx] || "";
            const std = item.std ? escHtml(ctx.tr(item.std)) : "";
            const method = item.method ? escHtml(ctx.tr(item.method)) : "";
            return `
              <div class="chk-item ${resp === "ok" ? "marked-ok" : resp === "notok" ? "marked-notok" : ""}">
                <div>
                  <div class="chk-item-title">${escHtml(ctx.tr(item.c))}</div>
                  <div class="chk-item-sub"><span class="param-chip param-${(PARAM_COLORS as any)[item.p]}">${item.p}</span>${std ? ` ${std}` : ""}</div>
                  ${method ? `<div class="chk-item-sub">${method}</div>` : ""}
                </div>
                ${ctx.canSubmit ? `
                  <div class="chk-actions">
                    <button class="chk-btn ok ${resp === "ok" ? "active" : ""}" data-chk-idx="${idx}" data-chk-val="ok">✓ OK</button>
                    <button class="chk-btn notok ${resp === "notok" ? "active" : ""}" data-chk-idx="${idx}" data-chk-val="notok">✕ Not OK</button>
                  </div>`
                : `<div>${statusPill(resp)}</div>`}
              </div>`;
          }).join("")}
        </div>
        ${ctx.canSubmit ? `
          <div style="margin-top:14px;">
            <button class="btn-primary" style="width:100%;" data-complete-freq="${escHtml(freq)}">Submit ${escHtml(freq)} round</button>
          </div>` : ""}
      </div>`;
  }).join("");

  return `
    <button class="back-btn" id="chkBackBtn">&larr; Back to equipment</button>
    <div class="eyebrow">${escHtml(mObj.group)}${mObj.floor ? ` &middot; ${escHtml(mObj.floor)}` : ""}</div>
    <h2 class="section-title">${escHtml(mObj.name)}</h2>
    <p class="section-sub">Marking an item “Not OK” automatically raises a line in the Defect Log. Submit each round (Daily / Weekly / Monthly) when its checks are done.</p>
    ${techBlock}
    ${forms || `<div class="empty-state">No checklist items configured for this machine.</div>`}
  `;
}

/** Frequency of the checklist item a defect came from (Daily/Weekly/Monthly). */
function defectFreq(ctx: MaintCtx, d: DefectRow): string {
  const rule = (ctx.CHECKLISTS[d.machineId] || [])[d.itemIdx];
  return rule?.freq || "Other";
}

export function renderDefects(ctx: MaintCtx): string {
  const logs = ctx.defects;
  const row = (d: DefectRow) => `
    <tr>
      <td class="mono" style="font-size:12px;">${d.id}</td>
      <td><strong>${escHtml(d.machineName)}</strong></td>
      <td class="muted-cell" style="font-size:12px;">${escHtml(d.component)}<br>${escHtml(d.desc)}</td>
      <td><span class="risk-chip risk-${d.criticality === "Critical" ? "critical" : "noncritical"}">${d.criticality}</span></td>
      <td><input type="text" class="inline-input df-update" data-df-id="${d.id}" data-df-field="action" value="${esc(d.action)}" placeholder="Define action path"></td>
      <td><input type="text" class="inline-input df-update" data-df-id="${d.id}" data-df-field="spares" value="${esc(d.spares)}" placeholder="Spares needed"></td>
      <td><input type="date" class="inline-input df-update" data-df-id="${d.id}" data-df-field="target" value="${d.target || ""}"></td>
      <td>
        <select class="inline-select df-update" data-df-id="${d.id}" data-df-field="status">
          <option value="Open" ${d.status === "Open" ? "selected" : ""}>Open Log</option>
          <option value="In Progress" ${d.status === "In Progress" ? "selected" : ""}>Processing</option>
          <option value="Closed" ${d.status === "Closed" ? "selected" : ""}>Closed Out</option>
        </select>
      </td>
    </tr>`;

  // Group defects by the frequency of the checklist item they came from.
  const order = ["Daily", "Weekly", "Monthly", "Other"];
  const grouped: Record<string, DefectRow[]> = {};
  logs.forEach(d => { const f = defectFreq(ctx, d); (grouped[f] ||= []).push(d); });
  const sections = order.filter(f => grouped[f]).concat(Object.keys(grouped).filter(f => !order.includes(f)));

  return `
    <div class="eyebrow">Defect Log</div>
    <h2 class="section-title">Defect Log</h2>
    <p class="section-sub">Every “Not OK” lands here automatically, grouped by its check frequency. Fill in the action, spares and target date; changes save as you type.</p>

    ${logs.length === 0 ? `
      <div class="empty-state">
        <p>No open defects.</p>
        <p class="muted-cell">Anything marked “Not OK” during a checklist round shows up here.</p>
      </div>` :
      sections.map(freq => `
        <div class="freq-head" style="margin:18px 0 10px;">
          <h3>${escHtml(freq)} checks</h3>
          <span class="freq-count">${grouped[freq].length} defect${grouped[freq].length === 1 ? "" : "s"}</span>
        </div>
        <div class="checklist-table-wrap" style="margin-bottom:8px;">
          <table class="checklist-table">
            <thead>
              <tr><th>ID</th><th>Machine</th><th>Issue</th><th>Risk</th><th>Action</th><th>Spares</th><th>Target Close</th><th>Status</th></tr>
            </thead>
            <tbody>${grouped[freq].map(row).join("")}</tbody>
          </table>
        </div>`).join("")}
  `;
}

export function renderAudit(ctx: MaintCtx): string {
  return `
    <div class="eyebrow">AM Audit</div>
    <h2 class="section-title">Autonomous Maintenance Audit</h2>
    <p class="section-sub">Independent spot-check on a machine. Score each parameter 1–5 and add a note; the total feeds the Reports tab.</p>

    <div class="grid-2">
      <div class="card">
        <label class="field-label">Machine</label>
        <select class="field-input" id="auditAssetSelect">
          ${ctx.MACHINES.map(m => `<option value="${m.id}">${escHtml(m.name)} [${escHtml(m.group)}]</option>`).join("")}
        </select>
      </div>
      <div class="card">
        <label class="field-label">Auditor</label>
        <input type="text" class="field-input" id="auditSignee" value="${esc(ctx.userName)}" readonly>
      </div>
    </div>

    <div class="chk-list">
      ${AUDIT_PARAMS.map((p: any, idx: number) => `
        <div class="chk-item">
          <div>
            <div class="chk-item-title">${escHtml(ctx.tr(p.name))}</div>
            <div class="chk-item-sub">${escHtml(ctx.tr(p.desc))}</div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1.4fr; gap:8px;">
            <div>
              <label class="field-label">Score</label>
              <select class="field-input audit-score-input" data-audit-row="${idx}">
                <option value="5">5 · Excellent</option>
                <option value="4">4 · Compliant</option>
                <option value="3">3 · Acceptable</option>
                <option value="2">2 · Action Needed</option>
                <option value="1">1 · Violation</option>
              </select>
            </div>
            <div>
              <label class="field-label">Note</label>
              <input type="text" class="field-input audit-remark-input" data-audit-row="${idx}" placeholder="Observation">
            </div>
          </div>
        </div>`).join("")}
    </div>

    <div style="margin-top:20px; text-align:right;">
      <button class="btn-primary" id="submitAuditBtn">Submit audit</button>
    </div>

    <div class="card" style="margin-top:40px;">
      <h3 style="font-size:15px; margin-bottom:12px;">Past audits</h3>
      <p class="muted-cell" style="font-size:12.5px; margin-bottom:12px;">Audits are a permanent record. Pick a date to review that day's audits.</p>
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
            ? `No audits were recorded on ${ctx.auditHistoryFilterDate}.`
            : "No audits recorded yet."}</p>`;
        }
        return `
        <div class="checklist-table-wrap">
          <table class="checklist-table">
            <thead>
              <tr><th>Date</th><th>Machine</th><th>Score</th><th>Auditor</th></tr>
            </thead>
            <tbody>
              ${filtered.map(au => `
                <tr>
                  <td class="mono">${formatDateTime(au.submittedAt) || au.date}</td>
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

export function renderSop(ctx: MaintCtx): string {
  const canEdit = ctx.caps.manageAccess;
  const roster = ctx.sopRoster || {};

  const rosterRows = SOP_ROSTER_ROLES.map(role => {
    const val = roster[role] || "";
    return `
      <tr>
        <td style="font-weight:600; width:260px;">${escHtml(role)}</td>
        <td>${canEdit
          ? `<input type="text" class="inline-input sop-roster-input" data-roster-key="${esc(role)}" value="${esc(val)}" placeholder="Enter name…">`
          : `<span class="${val ? "" : "muted-cell"}">${val ? escHtml(val) : "—"}</span>`}
        </td>
      </tr>`;
  }).join("");

  return `
    <div class="eyebrow">SOP &amp; Governance</div>
    <h2 class="section-title">SOP &amp; Governance Framework</h2>
    <p class="section-sub">Standard Operating Procedure for Autonomous Maintenance (CLIT) &mdash; a 5S / TPM framework for moving from reactive breakdowns to proactive care. Tap a section to expand it.</p>

    <div class="card">
      <h3 style="font-size:15px; margin-bottom:6px;">Project Roster</h3>
      <p class="muted-cell" style="font-size:12.5px; margin-bottom:12px;">${canEdit ? "Fill in the people responsible for this client. Saved automatically." : "People responsible for this client's CLIT programme."}</p>
      <div class="checklist-table-wrap">
        <table class="checklist-table"><tbody>${rosterRows}</tbody></table>
      </div>
    </div>

    <div class="checklist-table-wrap" style="margin:20px 0 24px;">
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

    <details class="accordion-item">
      <summary>
        <div class="acc-meta">
          <span class="acc-tag">Governance</span>
          <span>Roles, Grading &amp; Closure Targets</span>
        </div>
        <span class="acc-icon">+</span>
      </summary>
      <div class="accordion-body">${SOP_GOVERNANCE}</div>
    </details>
  `;
}

export function renderAnalytics(ctx: MaintCtx): string {
  const today = getFacilityTodayString();
  const m = computeGlobalMetrics(ctx);
  const openLogs = ctx.defects.filter(d => d.status !== "Closed");
  const criticalOpen = openLogs.filter(d => d.criticality === "Critical");
  const roundsToday = ctx.checklistHistory.filter(h => h.date === today).length;

  // Direct per-machine evaluation of the actual submitted entries.
  const FREQS = ["Daily", "Weekly", "Monthly"];
  const freqCell = (mac: Equipment, freq: string): string => {
    const has = (mac.checklist || []).some(i => (i.freq || "Daily") === freq);
    if (!has) return `<td class="center muted-cell">—</td>`;
    const st = frequencyStatus(ctx.checklistHistory, mac.id, freq);
    if (st.done && st.row) {
      return `<td class="center"><span class="risk-chip risk-noncritical">✓ ${formatDateTime(st.row.submittedAt) || st.row.date}</span></td>`;
    }
    return `<td class="center"><span class="risk-chip" style="background:var(--yellow-light); color:var(--yellow);">Due</span></td>`;
  };

  const machineRows = ctx.MACHINES.map(mac => {
    const openCount = openLogs.filter(d => d.machineId === mac.id).length;
    const lastAny = ctx.checklistHistory
      .filter(h => h.machineId === mac.id)
      .sort((a, b) => (b.submittedAt || b.date || "").localeCompare(a.submittedAt || a.date || ""))[0];
    return `
      <tr>
        <td><strong>${escHtml(mac.name)}</strong><div class="muted-cell" style="font-size:11px;">${escHtml(mac.group)}${mac.floor ? ` · ${escHtml(mac.floor)}` : ""}</div></td>
        ${FREQS.map(f => freqCell(mac, f)).join("")}
        <td class="center">${openCount > 0 ? `<span class="risk-chip risk-critical">${openCount}</span>` : "0"}</td>
        <td class="muted-cell">${lastAny ? `${formatDateTime(lastAny.submittedAt) || lastAny.date}${lastAny.techName ? ` · ${escHtml(lastAny.techName)}` : ""}` : "—"}</td>
      </tr>`;
  }).join("");

  const filteredHistory = (ctx.checklistHistoryFilterDate
    ? ctx.checklistHistory.filter(h => h.date === ctx.checklistHistoryFilterDate)
    : ctx.checklistHistory).slice(0, 200);

  return `
    <div class="eyebrow">Reports</div>
    <h2 class="section-title">Reports</h2>
    <p class="section-sub">Read straight from what technicians submitted — no guesswork. Each machine's Daily / Weekly / Monthly status, open defects, and the full round log.</p>

    <div class="grid-4" style="margin-bottom:28px;">
      <div class="metric-card tint-green"><div class="metric-num" style="color:var(--green)">${m.green}</div><div class="metric-label">Machines up to date</div></div>
      <div class="metric-card tint-yellow"><div class="metric-num" style="color:var(--yellow)">${m.yellow + m.gray}</div><div class="metric-label">Machines with checks due</div></div>
      <div class="metric-card tint-red"><div class="metric-num" style="color:var(--red)">${openLogs.length}</div><div class="metric-label">Open defects (${criticalOpen.length} critical)</div></div>
      <div class="metric-card tint-brand"><div class="metric-num" style="color:var(--amber-dark)">${roundsToday}</div><div class="metric-label">Rounds submitted today</div></div>
    </div>

    <div class="card">
      <h3 style="font-size:16px; margin-bottom:8px;">Machine status</h3>
      <p class="body-text" style="font-size:13px;">Each machine evaluated against its own submitted rounds. ✓ = done this cycle (with date &amp; time); “Due” = needs a round now.</p>
      ${ctx.MACHINES.length === 0 ? `<div class="empty-state">No equipment for this outlet/floor.</div>` : `
        <div class="checklist-table-wrap">
          <table class="checklist-table">
            <thead><tr><th>Machine</th><th class="center">Daily</th><th class="center">Weekly</th><th class="center">Monthly</th><th class="center">Open defects</th><th>Last submitted</th></tr></thead>
            <tbody>${machineRows}</tbody>
          </table>
        </div>`}
    </div>

    <div class="card">
      <h3 style="font-size:16px; margin-bottom:8px;">Round log</h3>
      <p class="body-text" style="font-size:13px;">Every submitted round with technician and exact date &amp; time. Pick a date to filter.</p>
      <div style="display:flex; gap:10px; align-items:end; margin-bottom:16px; flex-wrap:wrap;">
        <div><label class="field-label">Date</label><input type="date" class="field-input" id="checklistHistoryDateInput" value="${ctx.checklistHistoryFilterDate}"></div>
        <button class="btn-secondary" id="checklistHistoryShowAllBtn">Show All</button>
      </div>
      ${filteredHistory.length === 0 ? `
        <div class="empty-state">${ctx.checklistHistoryFilterDate
          ? `No rounds submitted on ${ctx.checklistHistoryFilterDate}.`
          : "No rounds submitted yet."}</div>` :
        (() => {
          const rowFor = (h: HistoryRow) => {
            const mach = ctx.MACHINES.find(mm => mm.id === h.machineId);
            const statuses = Object.values(h.items || {});
            const okCount = statuses.filter(s => s === "ok").length;
            const notOkCount = statuses.filter(s => s === "notok").length;
            return `
              <tr>
                <td class="mono">${formatDateTime(h.submittedAt) || h.date}</td>
                <td><strong>${escHtml(mach ? mach.name : h.machineId)}</strong></td>
                <td>${escHtml(h.techName || "—")}</td>
                <td><span class="risk-chip risk-noncritical">${okCount}</span></td>
                <td>${notOkCount > 0 ? `<span class="risk-chip risk-critical">${notOkCount}</span>` : "0"}</td>
              </tr>`;
          };
          const order = ["Daily", "Weekly", "Monthly", "Other"];
          const grouped: Record<string, HistoryRow[]> = {};
          filteredHistory.forEach(h => { const f = h.frequency || "Other"; (grouped[f] ||= []).push(h); });
          const sections = order.filter(f => grouped[f]).concat(Object.keys(grouped).filter(f => !order.includes(f)));
          return sections.map(freq => `
            <div class="freq-head" style="margin:14px 0 8px;">
              <h3 style="font-size:15px;">${escHtml(freq)} rounds</h3>
              <span class="freq-count">${grouped[freq].length}</span>
            </div>
            <div class="checklist-table-wrap" style="margin-bottom:8px;">
              <table class="checklist-table">
                <thead><tr><th>Date &amp; time</th><th>Machine</th><th>Technician</th><th>OK</th><th>Not OK</th></tr></thead>
                <tbody>${grouped[freq].map(rowFor).join("")}</tbody>
              </table>
            </div>`).join("");
        })()}
    </div>

    <div class="card">
      <h3 style="font-size:16px; margin-bottom:8px;">Export</h3>
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        <button class="btn-secondary" id="exportRoundsCsv">Export round log</button>
        <button class="btn-secondary" id="exportDefectsCsv">Export defect log</button>
        <button class="btn-secondary" id="exportAuditsCsv">Export audit log</button>
      </div>
    </div>
  `;
}

/** Facility-local "DD Mon, HH:MM" from an ISO timestamp (blank if unparseable). */
export function formatDateTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

/** CSV escape + download helper (client-side). */
export function buildCsv(ctx: MaintCtx, mode: "defects" | "audits" | "rounds"): { content: string; filename: string } {
  if (mode === "defects") {
    const content = "ID,Machine,Component,Issue,Risk,Status,Action,Spares,Target Close\n" +
      ctx.defects.map(d => `"${d.id}","${d.machineName}","${d.component}","${d.desc}","${d.criticality}","${d.status}","${d.action || ""}","${d.spares || ""}","${d.target || ""}"`).join("\n");
    return { content, filename: "defect_log.csv" };
  }
  if (mode === "rounds") {
    const nameById: Record<string, string> = {};
    ctx.MACHINES.forEach(mm => { nameById[mm.id] = mm.name; });
    const content = "Date & time,Machine,Round,Technician,OK,Not OK\n" +
      ctx.checklistHistory.map(h => {
        const st = Object.values(h.items || {});
        const ok = st.filter(s => s === "ok").length;
        const notok = st.filter(s => s === "notok").length;
        return `"${formatDateTime(h.submittedAt) || h.date}","${nameById[h.machineId] || h.machineId}","${h.frequency || ""}","${h.techName || ""}","${ok}","${notok}"`;
      }).join("\n");
    return { content, filename: "checklist_rounds.csv" };
  }
  const content = "Date & time,Machine,Total Score,Auditor\n" +
    ctx.audits.map(a => `"${formatDateTime(a.submittedAt) || a.date}","${a.machineName}","${a.totalScore}","${a.inspector}"`).join("\n");
  return { content, filename: "audit_log.csv" };
}

export function renderTab(ctx: MaintCtx, tab: string): string {
  switch (tab) {
    case "equipment": return renderEquipment(ctx);
    case "defects": return renderDefects(ctx);
    case "audit": return renderAudit(ctx);
    case "analytics": return renderAnalytics(ctx);
    case "sop": return renderSop(ctx);
    default: return renderEquipment(ctx);
  }
}
