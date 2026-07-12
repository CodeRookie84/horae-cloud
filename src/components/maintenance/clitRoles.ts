/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// CLIT role model for the Equipment Maintenance tab.
//
// CLIT roles are deliberately SEPARATE from a staff member's operational role in
// the global directory (a Supervisor, a Housekeeping Manager, or a dedicated
// maintenance person can all do CLIT work). Access + role are granted by a CLIT
// Admin from the Equipment Maintenance → Admin Console (not at onboarding).
// Client Admins are treated as CLIT Admins by default. What each role can see/do
// is driven by the capability matrix below — never scattered role-string checks.

export type ClitRole =
  | "technician"           // runs CLIT checklist rounds
  | "qc_executive"         // independent AM auditor
  | "qc_lead"              // audit + defect oversight + reports
  | "maintenance_manager"  // runs checklists, owns defects & equipment
  | "clit_admin";          // full access incl. equipment + granting CLIT access

export type Capability =
  | "runChecklist"    // toggle OK/Not-OK and submit checklist rounds
  | "runAudit"        // submit AM audits
  | "editDefects"     // manage the defect log
  | "manageEquipment" // add/delete machines, system reset
  | "viewReports"     // reports & analytics
  | "manageAccess";   // grant CLIT access + roles to staff, edit SOP roster

const MATRIX: Record<ClitRole, Capability[]> = {
  // Separation of duties: only Technician and Maintenance Manager run (submit)
  // the checklist. QC roles audit it; the CLIT Admin sets things up and grants
  // access but does not run rounds. Everyone with access can still VIEW equipment.
  technician:          ["runChecklist"],
  qc_executive:        ["runAudit", "viewReports"],
  qc_lead:             ["runAudit", "editDefects", "viewReports"],
  maintenance_manager: ["runChecklist", "editDefects", "manageEquipment", "viewReports"],
  clit_admin:          ["runAudit", "editDefects", "manageEquipment", "viewReports", "manageAccess"],
};

export const ALL_CLIT_ROLES: ClitRole[] = [
  "technician", "qc_executive", "qc_lead", "maintenance_manager", "clit_admin",
];

export const CLIT_ROLE_LABELS: Record<ClitRole, string> = {
  technician:          "Technician",
  qc_executive:        "QC Executive",
  qc_lead:             "QC Lead",
  maintenance_manager: "Maintenance Manager",
  clit_admin:          "CLIT Admin",
};

export const CLIT_ROLE_BLURB: Record<ClitRole, string> = {
  technician:          "Runs the CLIT checklist rounds on equipment.",
  qc_executive:        "Independent AM auditor — audits & reports (does not run checklists).",
  qc_lead:             "Oversees audits, defects and reports.",
  maintenance_manager: "Runs checklists, owns the defect log and equipment registry.",
  clit_admin:          "Full access, including equipment setup and granting CLIT access.",
};

const CAP_KEYS: Capability[] = [
  "runChecklist", "runAudit", "editDefects", "manageEquipment", "viewReports", "manageAccess",
];

/** True for staff roles that are Client/Super Admins (CLIT Admin by default). */
export function isClientAdminRole(staffRole?: string): boolean {
  return staffRole === "Admin" || staffRole === "Super Admin";
}

/**
 * The effective CLIT role for a user: an explicit clitRole wins; otherwise Client
 * Admins default to clit_admin, and everyone else to technician.
 */
export function effectiveClitRole(clitRole?: string | null, staffRole?: string): ClitRole {
  if (clitRole && (ALL_CLIT_ROLES as string[]).includes(clitRole)) return clitRole as ClitRole;
  if (isClientAdminRole(staffRole)) return "clit_admin";
  return "technician";
}

/** Whether the user should see the Equipment Maintenance tab at all. */
export function hasClitAccess(clitAccess?: boolean, staffRole?: string): boolean {
  return !!clitAccess || isClientAdminRole(staffRole);
}

/** Coerce a stored/free-text CLIT role to a known role (defaults to technician). */
export function normalizeClitRole(v?: string | null): ClitRole {
  if (v && (ALL_CLIT_ROLES as string[]).includes(v)) return v as ClitRole;
  return "technician";
}

export function can(role: ClitRole | undefined, cap: Capability): boolean {
  if (!role) return false;
  return MATRIX[role]?.includes(cap) ?? false;
}

/** Full capability booleans for a role — handy to pass into the render context. */
export function caps(role: ClitRole | undefined): Record<Capability, boolean> {
  const out = {} as Record<Capability, boolean>;
  for (const c of CAP_KEYS) out[c] = can(role, c);
  return out;
}
