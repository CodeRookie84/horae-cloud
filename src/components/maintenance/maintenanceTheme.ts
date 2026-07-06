/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// Hand-written companion to the generated maintenanceData.ts:
//   - MAINT_TABS: internal sub-tab config (mirrors the original tool's ALL_TABS,
//     mapped to the three maintenance roles derived in maintenanceEngine).
//   - CLIT_SCOPED_CSS: the original tool's stylesheet, every selector prefixed
//     with `.clit-scope` so it can't leak into the rest of Horae. Injected once
//     by MaintenanceHub. Keeps the original warm cream/amber field palette — a
//     self-contained ops area, like Team Talk has its own look.

export type MaintRole = "technician" | "manager" | "admin";

export const MAINT_TABS: { id: string; label: string; roles: MaintRole[] }[] = [
  { id: "intro",       label: "Overview",            roles: ["manager", "admin"] },
  { id: "templates",   label: "CLIT Checklist",      roles: ["technician", "manager", "admin"] },
  { id: "defects",     label: "Defect Log",          roles: ["manager", "admin"] },
  { id: "audit",       label: "AM Audit",            roles: ["manager", "admin"] },
  { id: "governance",  label: "Governance",          roles: ["technician", "manager", "admin"] },
  { id: "analytics",   label: "Reports & Analytics", roles: ["manager", "admin"] },
  { id: "sop",         label: "SOP Framework",       roles: ["technician", "manager", "admin"] },
  { id: "adminPanel",  label: "Admin Console",       roles: ["admin"] },
];

export const CLIT_SCOPED_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
.clit-scope{
  --ink:#1A1816; --cream:#FAF6EE; --amber:#C8732E; --amber-dark:#9A5520;
  --green:#3A5A47; --green-light:#E9F0EA; --red:#A3342E; --red-light:#F7E6E4;
  --yellow:#C9A227; --yellow-light:#FBF3DC; --line:#E3DBC9; --paper:#FFFFFF; --muted:#7A7164;
  background:var(--cream); color:var(--ink); font-family:'Inter',sans-serif;
  -webkit-font-smoothing:antialiased; border:1px solid var(--line); border-radius:4px;
  padding:28px 26px 40px; min-height:60vh;
}
.clit-scope h1,.clit-scope h2,.clit-scope h3,.clit-scope h4{font-family:'Oswald',sans-serif;text-transform:uppercase;letter-spacing:0.02em;margin:0;}
.clit-scope .mono{font-family:'IBM Plex Mono',monospace;}
.clit-scope a{color:var(--amber-dark);}

/* tab nav */
.clit-scope .clit-tabnav{display:flex;flex-wrap:wrap;gap:2px;border-bottom:1px solid var(--line);margin-bottom:28px;overflow-x:auto;}
.clit-scope .tab-btn{appearance:none;border:none;background:none;cursor:pointer;font-family:'Oswald';font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:var(--muted);padding:12px 16px 10px;border-bottom:3px solid transparent;white-space:nowrap;transition:color .15s,border-color .15s;}
.clit-scope .tab-btn .num{font-family:'IBM Plex Mono';font-size:10px;margin-right:6px;opacity:0.6;}
.clit-scope .tab-btn:hover{color:var(--ink);}
.clit-scope .tab-btn.active{color:var(--ink);border-bottom-color:var(--amber);}

.clit-scope .eyebrow{font-family:'IBM Plex Mono';font-size:11px;letter-spacing:0.08em;color:var(--amber-dark);text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:8px;}
.clit-scope .eyebrow::before{content:'';width:18px;height:2px;background:var(--amber);display:inline-block;}
.clit-scope .section-title{font-size:28px;margin-bottom:6px;}
.clit-scope .section-sub{font-size:15px;color:var(--muted);max-width:680px;line-height:1.6;margin-bottom:28px;}
.clit-scope .card{background:var(--paper);border:1px solid var(--line);border-radius:3px;padding:22px;margin-bottom:20px;}
.clit-scope .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
.clit-scope .grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;}
.clit-scope .grid-4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:20px;}
@media(max-width:760px){.clit-scope .grid-2,.clit-scope .grid-3,.clit-scope .grid-4{grid-template-columns:1fr;}}
.clit-scope p.body-text{font-size:14.5px;line-height:1.7;color:#3a352d;margin:0 0 16px;}
.clit-scope ul.bullets{margin:0 0 16px;padding-left:20px;}
.clit-scope ul.bullets li{font-size:14px;line-height:1.7;color:#3a352d;margin-bottom:6px;}
.clit-scope ul.bullets li::marker{color:var(--amber);}
.clit-scope .kicker-box{border-left:3px solid var(--amber);background:#FFF9EF;padding:16px 20px;margin:20px 0;}
.clit-scope .kicker-box p{margin:0;font-size:14px;line-height:1.6;color:#5c4622;}
.clit-scope .kicker-box strong{color:var(--amber-dark);}

/* metrics + status */
.clit-scope .metric-card{background:var(--paper);border:1px solid var(--line);border-radius:3px;padding:18px 20px;text-align:center;}
.clit-scope .metric-num{font-family:'Oswald';font-size:34px;font-weight:600;line-height:1;}
.clit-scope .metric-label{font-size:12px;color:var(--muted);margin-top:6px;text-transform:uppercase;letter-spacing:0.04em;}
.clit-scope .status-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;}
.clit-scope .status-tag{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:12px;border-radius:3px;border:1px solid var(--line);}
.clit-scope .status-tag .status-name{font-size:12.5px;font-weight:600;line-height:1.3;}
.clit-scope .status-gray{background:#F3F0E8;color:#8a8275;border-color:#E3DBC9;}.clit-scope .status-gray .status-name{color:#6b6457;}
.clit-scope .status-green{background:var(--green-light);color:var(--green);border-color:#C9DCCD;}.clit-scope .status-green .status-name{color:var(--green);}
.clit-scope .status-yellow{background:var(--yellow-light);color:var(--yellow);border-color:#EFD98F;}.clit-scope .status-yellow .status-name{color:#8a6d11;}
.clit-scope .status-red{background:var(--red-light);color:var(--red);border-color:#E7BBB7;}.clit-scope .status-red .status-name{color:var(--red);}

/* machine cards */
.clit-scope .machine-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;}
.clit-scope .machine-card{background:var(--paper);border:1px solid var(--line);border-radius:3px;padding:18px;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:8px;border-top:4px solid #c9c2b3;appearance:none;font-family:inherit;}
.clit-scope .machine-card:hover{border-color:var(--amber);box-shadow:0 2px 8px rgba(0,0,0,0.06);}
.clit-scope .machine-card.status-green{border-top-color:var(--green);}
.clit-scope .machine-card.status-yellow{border-top-color:var(--yellow);}
.clit-scope .machine-card.status-red{border-top-color:var(--red);}
.clit-scope .machine-icon{color:var(--amber-dark);}
.clit-scope .machine-name{font-family:'Oswald';font-size:15px;text-transform:uppercase;letter-spacing:0.01em;}
.clit-scope .machine-meta{font-size:11.5px;color:var(--muted);font-family:'IBM Plex Mono';}

/* tables */
.clit-scope .checklist-table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:3px;}
.clit-scope .checklist-table{width:100%;border-collapse:collapse;background:var(--paper);min-width:720px;}
.clit-scope .checklist-table th{background:var(--ink);color:var(--cream);font-family:'Oswald';font-size:11px;text-transform:uppercase;letter-spacing:0.04em;text-align:left;padding:10px 12px;}
.clit-scope .checklist-table td{padding:11px 12px;border-bottom:1px solid var(--line);font-size:13.5px;vertical-align:middle;}
.clit-scope .checklist-table tr:last-child td{border-bottom:none;}
.clit-scope .muted-cell{color:#5c5648;font-size:13px;}
.clit-scope .center{text-align:center;}
.clit-scope .param-chip{display:inline-block;font-family:'IBM Plex Mono';font-size:11px;padding:3px 8px;border-radius:2px;font-weight:500;}
.clit-scope .param-blue{background:#E1EBF5;color:#2A547F;}
.clit-scope .param-amber{background:#F6E7D2;color:#8a5a13;}
.clit-scope .param-green{background:var(--green-light);color:var(--green);}
.clit-scope .param-red{background:var(--red-light);color:var(--red);}
.clit-scope .status-toggle{display:flex;gap:6px;}
.clit-scope .toggle-btn{appearance:none;border:1px solid var(--line);background:var(--paper);font-family:'IBM Plex Mono';font-size:11px;padding:6px 10px;border-radius:2px;cursor:pointer;color:var(--muted);transition:all .12s;}
.clit-scope .toggle-btn.ok.active{background:var(--green);border-color:var(--green);color:#fff;}
.clit-scope .toggle-btn.notok.active{background:var(--red);border-color:var(--red);color:#fff;}
.clit-scope .field-label{font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:var(--muted);display:block;margin-bottom:8px;font-family:'IBM Plex Mono';}
.clit-scope .field-input{width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:2px;font-family:'Inter';font-size:14px;background:var(--paper);color:var(--ink);}
.clit-scope .field-input:focus{outline:2px solid var(--amber);outline-offset:1px;}
.clit-scope .inline-input,.clit-scope .inline-select{width:100%;padding:6px 8px;border:1px solid var(--line);border-radius:2px;font-family:'Inter';font-size:12.5px;background:var(--paper);color:var(--ink);}
.clit-scope .risk-chip{display:inline-block;font-size:11px;font-family:'IBM Plex Mono';padding:3px 9px;border-radius:2px;font-weight:600;}
.clit-scope .risk-critical{background:var(--red-light);color:var(--red);}
.clit-scope .risk-noncritical{background:var(--green-light);color:var(--green);}
.clit-scope .btn-primary{background:var(--amber);color:#fff;border:none;padding:10px 16px;font-family:'Oswald';text-transform:uppercase;font-size:13px;letter-spacing:0.03em;border-radius:2px;cursor:pointer;}
.clit-scope .btn-primary:hover{background:var(--amber-dark);}
.clit-scope .btn-secondary{background:var(--cream);color:var(--ink);border:1px solid var(--line);padding:10px 16px;font-family:'Oswald';text-transform:uppercase;font-size:13px;border-radius:2px;cursor:pointer;}
.clit-scope .btn-secondary:hover{background:#f0e9dc;}
.clit-scope .empty-state{border:1px dashed var(--line);border-radius:3px;padding:44px 24px;text-align:center;color:var(--muted);}
.clit-scope .back-btn{appearance:none;border:none;background:none;cursor:pointer;font-family:'IBM Plex Mono';font-size:12px;color:var(--amber-dark);padding:0;margin-bottom:18px;}
.clit-scope .back-btn:hover{text-decoration:underline;}

/* grading + accordion (governance / SOP) */
.clit-scope .grading-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;}
@media(max-width:760px){.clit-scope .grading-grid{grid-template-columns:1fr 1fr;}}
.clit-scope .grading-cell{border:1px solid var(--line);border-radius:3px;padding:12px 10px;text-align:center;}
.clit-scope .grading-score{font-family:'Oswald';font-size:20px;color:var(--amber-dark);}
.clit-scope .grading-label{font-size:12px;font-weight:600;margin:4px 0 6px;}
.clit-scope .grading-desc{font-size:11px;color:var(--muted);line-height:1.4;}
.clit-scope .audit-total{font-size:26px;font-weight:600;color:var(--amber-dark);}
.clit-scope .role-points{padding-left:16px;margin:0;}
.clit-scope .role-points li{font-size:12.5px;line-height:1.55;margin-bottom:7px;}
.clit-scope h4{font-size:15px;margin:18px 0 8px;color:var(--ink);}
.clit-scope .accordion-item{border:1px solid var(--line);border-radius:3px;margin-bottom:10px;background:var(--paper);overflow:hidden;}
.clit-scope .accordion-item summary{cursor:pointer;list-style:none;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-family:'Oswald';font-size:14px;letter-spacing:0.02em;text-transform:uppercase;color:var(--ink);}
.clit-scope .accordion-item summary::-webkit-details-marker{display:none;}
.clit-scope .accordion-item summary .acc-meta{display:flex;flex-direction:column;gap:2px;}
.clit-scope .accordion-item summary .acc-tag{font-family:'IBM Plex Mono';font-size:10px;color:var(--amber-dark);text-transform:uppercase;letter-spacing:0.05em;}
.clit-scope .accordion-item summary .acc-icon{flex-shrink:0;width:26px;height:26px;border:1px solid var(--line);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Mono';font-size:16px;color:var(--amber-dark);transition:transform .18s ease;}
.clit-scope .accordion-item[open] summary .acc-icon{transform:rotate(45deg);background:var(--amber);color:#fff;border-color:var(--amber);}
.clit-scope .accordion-item[open] summary{border-bottom:1px solid var(--line);}
.clit-scope .accordion-body{padding:16px;}
.clit-scope .checklist-draft-row{display:grid;gap:8px;margin-bottom:8px;}
@media(max-width:640px){.clit-scope .checklist-draft-row{grid-template-columns:1fr !important;}}
`;
