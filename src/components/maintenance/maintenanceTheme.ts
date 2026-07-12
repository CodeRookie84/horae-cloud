/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// Hand-written companion to the generated maintenanceData.ts:
//   - MAINT_TABS: sub-tab config. Each tab declares the Capability it requires
//     (null = visible to anyone with CLIT access); MaintenanceHub filters with the
//     capability matrix in clitRoles.ts. The Admin Console tab is rendered as a
//     React panel (MaintenanceAdmin), not from an HTML string.
//   - CLIT_SCOPED_CSS: the island's stylesheet, every selector prefixed with
//     `.clit-scope` so it can't leak into the rest of Horae. Skinned to the Horae
//     app theme — Inter body, Fraunces display headings, JetBrains Mono, pastel
//     violet/mint brand palette, bright cards + high-contrast text.

import type { Capability } from "./clitRoles";

export const MAINT_TABS: { id: string; label: string; requires: Capability | null }[] = [
  { id: "equipment",   label: "Equipment",   requires: null },
  { id: "defects",     label: "Defect Log",  requires: "editDefects" },
  { id: "audit",       label: "AM Audit",    requires: "runAudit" },
  { id: "analytics",   label: "Reports",     requires: "viewReports" },
  { id: "sop",         label: "SOP",         requires: null },
  { id: "adminPanel",  label: "Admin Console", requires: "manageEquipment" },
];

export const CLIT_SCOPED_CSS = `
.clit-scope{
  --ink:#1C1640; --ink-soft:#4A4470; --cream:#FBFAFF; --amber:#8B7CF6; --amber-dark:#6D5DD3;
  --brand-tint:#EFEBFE; --green:#0F9D77; --green-light:#E4F8F0; --red:#D6425F; --red-light:#FCE7EC;
  --yellow:#B9812A; --yellow-light:#FBF2DC; --line:#E5E0F4; --paper:#FFFFFF; --muted:#5A5478;
  --radius:16px; --radius-sm:12px; --radius-xs:10px;
  --shadow:0 1px 2px rgba(139,124,246,.10), 0 10px 28px -14px rgba(139,124,246,.30);
  background:var(--cream); color:var(--ink);
  font-family:'Inter', ui-sans-serif, system-ui, sans-serif;
  -webkit-font-smoothing:antialiased; border:1px solid var(--line); border-radius:var(--radius);
  padding:28px 26px 40px; min-height:60vh;
}
.clit-scope h1,.clit-scope h2,.clit-scope h3,.clit-scope h4{
  font-family:'Fraunces', ui-serif, Georgia, serif; font-weight:600; letter-spacing:-0.01em; margin:0; color:var(--ink);
}
.clit-scope .mono{font-family:'JetBrains Mono', ui-monospace, monospace;}
.clit-scope a{color:var(--amber-dark);}

/* tab nav */
.clit-scope .clit-tabnav{display:flex;flex-wrap:wrap;gap:2px;border-bottom:1px solid var(--line);margin-bottom:28px;overflow-x:auto;}
.clit-scope .tab-btn{appearance:none;border:none;background:none;cursor:pointer;font-family:'Inter',sans-serif;font-weight:600;font-size:13.5px;letter-spacing:0.01em;color:var(--muted);padding:12px 16px 10px;border-bottom:2.5px solid transparent;white-space:nowrap;transition:color .15s,border-color .15s;}
.clit-scope .tab-btn .num{font-family:'JetBrains Mono';font-size:10px;margin-right:6px;opacity:0.55;}
.clit-scope .tab-btn:hover{color:var(--ink);}
.clit-scope .tab-btn.active{color:var(--amber-dark);border-bottom-color:var(--amber);}

.clit-scope .eyebrow{font-family:'JetBrains Mono';font-size:11px;letter-spacing:0.06em;color:var(--amber-dark);text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:8px;}
.clit-scope .eyebrow::before{content:'';width:18px;height:2px;background:var(--amber);display:inline-block;border-radius:2px;}
.clit-scope .section-title{font-size:28px;margin-bottom:6px;color:var(--ink);}
.clit-scope .section-sub{font-size:15px;color:var(--ink-soft);max-width:700px;line-height:1.6;margin-bottom:28px;}
.clit-scope .card{background:var(--paper);border:1px solid var(--line);border-radius:var(--radius);padding:22px;margin-bottom:20px;box-shadow:var(--shadow);}
.clit-scope .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
.clit-scope .grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;}
.clit-scope .grid-4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:16px;}
@media(max-width:760px){.clit-scope .grid-2,.clit-scope .grid-3,.clit-scope .grid-4{grid-template-columns:1fr 1fr;}}
@media(max-width:480px){.clit-scope .grid-2,.clit-scope .grid-3,.clit-scope .grid-4{grid-template-columns:1fr;}}
.clit-scope p.body-text{font-size:14.5px;line-height:1.7;color:var(--ink-soft);margin:0 0 16px;}
.clit-scope ul.bullets{margin:0 0 16px;padding-left:20px;}
.clit-scope ul.bullets li{font-size:14px;line-height:1.7;color:var(--ink-soft);margin-bottom:6px;}
.clit-scope ul.bullets li::marker{color:var(--amber);}
.clit-scope ul.bullets li strong{color:var(--ink);}
.clit-scope .kicker-box{border-left:3px solid var(--amber);background:var(--brand-tint);padding:16px 20px;margin:20px 0;border-radius:var(--radius-sm);}
.clit-scope .kicker-box p{margin:0;font-size:14px;line-height:1.6;color:#463F73;}
.clit-scope .kicker-box strong{color:var(--amber-dark);}

/* metrics */
.clit-scope .metric-card{background:var(--paper);border:1px solid var(--line);border-radius:var(--radius);padding:20px;text-align:center;box-shadow:var(--shadow);}
.clit-scope .metric-card.tint-green{background:var(--green-light);border-color:#BDEBD9;}
.clit-scope .metric-card.tint-yellow{background:var(--yellow-light);border-color:#F0DCA6;}
.clit-scope .metric-card.tint-red{background:var(--red-light);border-color:#F5C6D0;}
.clit-scope .metric-card.tint-brand{background:var(--brand-tint);border-color:#D8CFF8;}
.clit-scope .metric-num{font-family:'Fraunces';font-size:36px;font-weight:600;line-height:1;}
.clit-scope .metric-label{font-size:12.5px;color:var(--ink-soft);margin-top:8px;font-weight:500;}

.clit-scope .status-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;}
.clit-scope .status-tag{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:12px;border-radius:var(--radius-sm);border:1px solid var(--line);}
.clit-scope .status-tag .status-name{font-size:12.5px;font-weight:600;line-height:1.3;}
.clit-scope .status-gray{background:#F1EEFA;border-color:#E5E0F4;}.clit-scope .status-gray .status-name{color:#6A6390;}
.clit-scope .status-green{background:var(--green-light);border-color:#BDEBD9;}.clit-scope .status-green .status-name{color:var(--green);}
.clit-scope .status-yellow{background:var(--yellow-light);border-color:#F0DCA6;}.clit-scope .status-yellow .status-name{color:var(--yellow);}
.clit-scope .status-red{background:var(--red-light);border-color:#F5C6D0;}.clit-scope .status-red .status-name{color:var(--red);}

/* machine cards — bright, theme-tinted */
.clit-scope .machine-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;}
.clit-scope .machine-card{background:linear-gradient(180deg,#FFFFFF 0%,var(--brand-tint) 180%);border:1px solid var(--line);border-radius:var(--radius);padding:18px;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:7px;border-top:4px solid var(--amber);appearance:none;font-family:inherit;width:100%;box-shadow:var(--shadow);transition:border-color .15s, box-shadow .15s, transform .15s;}
.clit-scope .machine-card:hover{box-shadow:0 8px 22px -8px rgba(139,124,246,.42);transform:translateY(-2px);}
.clit-scope .machine-card.status-green{border-top-color:var(--green);}
.clit-scope .machine-card.status-yellow{border-top-color:var(--yellow);}
.clit-scope .machine-card.status-red{border-top-color:var(--red);}
.clit-scope .machine-card.status-gray{border-top-color:#C9C1E8;}
.clit-scope .machine-icon{color:var(--amber-dark);}
.clit-scope .machine-name{font-family:'Fraunces';font-weight:600;font-size:16.5px;letter-spacing:-0.01em;color:var(--ink);}
.clit-scope .machine-meta{font-size:11.5px;color:var(--muted);font-family:'JetBrains Mono';}
.clit-scope .machine-progress{font-size:12px;color:var(--amber-dark);font-weight:600;margin-top:2px;}

/* tappable checkpoint cards (technician checklist + QC audit) */
.clit-scope .chk-list{display:flex;flex-direction:column;gap:10px;}
.clit-scope .chk-item{background:var(--paper);border:1px solid var(--line);border-radius:var(--radius-sm);padding:14px 16px;display:flex;flex-direction:column;gap:12px;box-shadow:var(--shadow);transition:border-color .12s, background .12s;}
.clit-scope .chk-item.marked-ok{border-color:#BDEBD9;background:var(--green-light);}
.clit-scope .chk-item.marked-notok{border-color:#F5C6D0;background:var(--red-light);}
.clit-scope .chk-item-title{font-family:'Inter';font-weight:700;font-size:14.5px;color:var(--ink);line-height:1.35;}
.clit-scope .chk-item-sub{font-size:12.5px;color:var(--ink-soft);margin-top:3px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.clit-scope .chk-actions{display:flex;gap:10px;}
.clit-scope .chk-btn{flex:1;appearance:none;border:1.5px solid var(--line);background:var(--paper);border-radius:10px;padding:13px;font-family:'Inter';font-weight:700;font-size:14px;cursor:pointer;transition:all .12s;}
.clit-scope .chk-btn.ok{color:var(--green);}
.clit-scope .chk-btn.ok:hover{border-color:var(--green);}
.clit-scope .chk-btn.ok.active{background:var(--green);border-color:var(--green);color:#fff;}
.clit-scope .chk-btn.notok{color:var(--red);}
.clit-scope .chk-btn.notok:hover{border-color:var(--red);}
.clit-scope .chk-btn.notok.active{background:var(--red);border-color:var(--red);color:#fff;}

/* language bar (React chrome) */
.clit-scope .clit-langbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:16px;}
.clit-scope .lang-btn{appearance:none;border:1px solid var(--line);background:var(--paper);border-radius:8px;padding:6px 11px;font-size:11.5px;font-weight:700;color:var(--muted);cursor:pointer;transition:all .12s;}
.clit-scope .lang-btn:hover{border-color:var(--amber);}
.clit-scope .lang-btn.active{background:var(--amber);border-color:var(--amber);color:#fff;}
.clit-scope .lang-btn:disabled{opacity:.5;cursor:not-allowed;}

/* frequency forms */
.clit-scope .freq-card{background:var(--paper);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);padding:20px;margin-bottom:18px;}
.clit-scope .freq-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
.clit-scope .freq-head h3{font-size:18px;color:var(--ink);}
.clit-scope .freq-count{font-family:'JetBrains Mono';font-size:11.5px;color:var(--amber-dark);background:var(--brand-tint);padding:4px 10px;border-radius:999px;}

/* tables */
.clit-scope .checklist-table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:var(--radius);background:var(--paper);}
.clit-scope .checklist-table{width:100%;border-collapse:collapse;background:var(--paper);min-width:640px;}
.clit-scope .checklist-table th{background:var(--brand-tint);color:var(--amber-dark);font-family:'Inter';font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;text-align:left;padding:12px;border-bottom:1px solid var(--line);}
.clit-scope .checklist-table td{padding:11px 12px;border-bottom:1px solid var(--line);font-size:13.5px;vertical-align:middle;color:var(--ink);}
.clit-scope .checklist-table tr:last-child td{border-bottom:none;}
.clit-scope .checklist-table td strong{color:var(--ink);}
.clit-scope .muted-cell{color:var(--ink-soft);font-size:13px;}
.clit-scope .center{text-align:center;}
.clit-scope .param-chip{display:inline-block;font-family:'JetBrains Mono';font-size:11px;padding:3px 8px;border-radius:6px;font-weight:600;}
.clit-scope .param-blue{background:#E1ECFB;color:#245399;}
.clit-scope .param-amber{background:#EDE7FE;color:#6D5DD3;}
.clit-scope .param-green{background:var(--green-light);color:var(--green);}
.clit-scope .param-red{background:var(--red-light);color:var(--red);}
.clit-scope .status-toggle{display:flex;gap:6px;}
.clit-scope .toggle-btn{appearance:none;border:1px solid var(--line);background:var(--paper);font-family:'JetBrains Mono';font-size:11px;padding:7px 12px;border-radius:8px;cursor:pointer;color:var(--muted);font-weight:600;transition:all .12s;}
.clit-scope .toggle-btn:hover{border-color:var(--amber);}
.clit-scope .toggle-btn.ok.active{background:var(--green);border-color:var(--green);color:#fff;}
.clit-scope .toggle-btn.notok.active{background:var(--red);border-color:var(--red);color:#fff;}
.clit-scope .field-label{font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:var(--muted);display:block;margin-bottom:8px;font-family:'JetBrains Mono';}
.clit-scope .field-input{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:var(--radius-xs);font-family:'Inter';font-size:14px;background:var(--paper);color:var(--ink);}
.clit-scope .field-input:focus{outline:2px solid var(--amber);outline-offset:1px;}
.clit-scope .inline-input,.clit-scope .inline-select{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-family:'Inter';font-size:12.5px;background:var(--paper);color:var(--ink);}
.clit-scope .inline-input:focus,.clit-scope .inline-select:focus{outline:2px solid var(--amber);outline-offset:1px;}
.clit-scope .risk-chip{display:inline-block;font-size:11px;font-family:'JetBrains Mono';padding:3px 9px;border-radius:6px;font-weight:600;}
.clit-scope .risk-critical{background:var(--red-light);color:var(--red);}
.clit-scope .risk-noncritical{background:var(--green-light);color:var(--green);}
.clit-scope .btn-primary{background:var(--amber);color:#fff;border:none;padding:10px 18px;font-family:'Inter';font-weight:600;font-size:13px;letter-spacing:0.01em;border-radius:var(--radius-xs);cursor:pointer;transition:background .15s, box-shadow .15s;box-shadow:0 4px 12px -4px rgba(139,124,246,.5);}
.clit-scope .btn-primary:hover{background:var(--amber-dark);}
.clit-scope .btn-secondary{background:var(--paper);color:var(--ink);border:1px solid var(--line);padding:10px 18px;font-family:'Inter';font-weight:600;font-size:13px;border-radius:var(--radius-xs);cursor:pointer;transition:all .15s;}
.clit-scope .btn-secondary:hover{background:var(--brand-tint);border-color:var(--amber);}
.clit-scope .empty-state{border:1px dashed var(--line);border-radius:var(--radius);padding:44px 24px;text-align:center;color:var(--muted);background:var(--paper);}
.clit-scope .back-btn{appearance:none;border:none;background:none;cursor:pointer;font-family:'JetBrains Mono';font-size:12px;color:var(--amber-dark);padding:0;margin-bottom:18px;font-weight:600;}
.clit-scope .back-btn:hover{text-decoration:underline;}

/* grading + accordion (SOP) */
.clit-scope .grading-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;}
@media(max-width:760px){.clit-scope .grading-grid{grid-template-columns:1fr 1fr;}}
.clit-scope .grading-cell{border:1px solid var(--line);border-radius:var(--radius-sm);padding:12px 10px;text-align:center;background:var(--brand-tint);}
.clit-scope .grading-score{font-family:'Fraunces';font-weight:600;font-size:22px;color:var(--amber-dark);}
.clit-scope .grading-label{font-size:12px;font-weight:700;margin:4px 0 6px;color:var(--ink);}
.clit-scope .grading-desc{font-size:11px;color:var(--muted);line-height:1.4;}
.clit-scope .role-points{padding-left:16px;margin:0;}
.clit-scope .role-points li{font-size:13px;line-height:1.6;margin-bottom:8px;color:var(--ink-soft);}
.clit-scope .role-points li strong{color:var(--ink);}
.clit-scope h4{font-size:16px;margin:18px 0 8px;color:var(--ink);}
.clit-scope .accordion-item{border:1px solid var(--line);border-radius:var(--radius-sm);margin-bottom:10px;background:var(--paper);overflow:hidden;box-shadow:var(--shadow);}
.clit-scope .accordion-item summary{cursor:pointer;list-style:none;padding:15px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-family:'Fraunces';font-weight:600;font-size:15px;letter-spacing:-0.01em;color:var(--ink);}
.clit-scope .accordion-item summary::-webkit-details-marker{display:none;}
.clit-scope .accordion-item summary .acc-meta{display:flex;flex-direction:column;gap:2px;}
.clit-scope .accordion-item summary .acc-tag{font-family:'JetBrains Mono';font-size:10px;color:var(--amber-dark);text-transform:uppercase;letter-spacing:0.05em;}
.clit-scope .accordion-item summary .acc-icon{flex-shrink:0;width:26px;height:26px;border:1px solid var(--line);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono';font-size:16px;color:var(--amber-dark);transition:transform .18s ease;}
.clit-scope .accordion-item[open] summary .acc-icon{transform:rotate(45deg);background:var(--amber);color:#fff;border-color:var(--amber);}
.clit-scope .accordion-item[open] summary{border-bottom:1px solid var(--line);background:var(--brand-tint);}
.clit-scope .accordion-body{padding:18px;}
.clit-scope .accordion-body p{color:var(--ink-soft);line-height:1.65;font-size:14px;}

/* outlet + floor filter bar (React chrome in MaintenanceHub) */
.clit-scope .clit-filterbar{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end;margin-bottom:24px;padding:16px 18px;background:var(--paper);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);}
.clit-scope .clit-filter-field{display:flex;flex-direction:column;gap:6px;min-width:180px;}
.clit-scope .clit-filter-field label{font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted);font-family:'JetBrains Mono';}
.clit-scope .clit-filter-field select{padding:9px 11px;border:1px solid var(--line);border-radius:var(--radius-xs);font-family:'Inter';font-size:13.5px;font-weight:500;background:var(--cream);color:var(--ink);cursor:pointer;}
.clit-scope .clit-filter-field select:focus{outline:2px solid var(--amber);outline-offset:1px;}

/* React admin console */
.clit-scope .admin-section{background:var(--paper);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);padding:22px;margin-bottom:20px;}
.clit-scope .admin-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--line);}
.clit-scope .admin-row:last-child{border-bottom:none;}
.clit-scope .draft-grid{display:grid;grid-template-columns:2fr 1fr 2fr 1fr 1.4fr auto;gap:8px;margin-bottom:8px;align-items:center;}
@media(max-width:640px){.clit-scope .draft-grid{grid-template-columns:1fr;}}
.clit-scope .icon-btn{width:30px;height:30px;border-radius:8px;border:1px solid var(--red);background:#fff;color:var(--red);cursor:pointer;font-size:15px;line-height:1;display:flex;align-items:center;justify-content:center;}
.clit-scope .icon-btn:disabled{opacity:.4;cursor:not-allowed;}
.clit-scope .chip-role{font-family:'JetBrains Mono';font-size:10.5px;padding:3px 8px;border-radius:999px;background:var(--brand-tint);color:var(--amber-dark);font-weight:600;}
`;
