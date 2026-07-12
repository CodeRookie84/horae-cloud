/**
 * maintenanceService.ts — Supabase-backed persistence for the Equipment
 * Maintenance (CLIT) tab. Replaces the original standalone tool's /api Node
 * backend. Everything is scoped per outlet (tenant_id), following the same
 * pattern as swotService.ts.
 *
 * Tables (migration supabase/migrations/20260706_maintenance.sql):
 *   maintenance_equipment          — per-outlet machine registry (built-in + custom)
 *   maintenance_checklist_state    — current in-progress CLIT marks (reset-able)
 *   maintenance_checklist_history  — archived completed rounds (permanent)
 *   maintenance_defects            — defect log
 *   maintenance_audits             — AM audit submissions (permanent)
 */
import { supabase } from "./supabaseClient";
import { BASE_MACHINES, BASE_CHECKLISTS } from "../components/maintenance/maintenanceData";
import {
  getFacilityTodayString, generateDefectId,
  type Equipment, type DefectRow, type AuditRow, type HistoryRow, type ChecklistResponses,
} from "../components/maintenance/maintenanceEngine";

// Composite id keeps a base machine unique per outlet (same code across outlets).
const eqId = (tenantId: string, code: string) => `${tenantId}__${code}`;

// ── Equipment ────────────────────────────────────────────────────────────────
function mapEquip(r: any): Equipment {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    group: r.group_name,
    icon: r.icon,
    checklist: r.checklist || [],
    isCustom: !!r.is_custom,
    sortOrder: r.sort_order ?? 0,
    floor: r.floor || "",
    location: r.location || "",
  };
}

/** Equipment for an outlet. Lazily seeds the 15 built-in machines on first use. */
export async function getEquipment(tenantId: string): Promise<Equipment[]> {
  const { data } = await supabase
    .from("maintenance_equipment")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true });

  if (data && data.length > 0) return data.map(mapEquip);

  // Seed built-ins for this outlet (idempotent — ignore duplicates on race).
  const rows = BASE_MACHINES.map((m: any, i: number) => ({
    id: eqId(tenantId, m.id),
    tenant_id: tenantId,
    name: m.name,
    group_name: m.group,
    icon: m.icon,
    checklist: (BASE_CHECKLISTS as any)[m.id] || [],
    sort_order: i,
    is_custom: false,
  }));
  await supabase.from("maintenance_equipment").upsert(rows, { onConflict: "id", ignoreDuplicates: true });

  const { data: seeded } = await supabase
    .from("maintenance_equipment")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true });
  return (seeded || []).map(mapEquip);
}

export async function addEquipment(
  tenantId: string,
  name: string,
  group: string,
  icon: string,
  checklist: { c: string; p: string; std: string; freq: string; method: string }[],
  floor = "",
  location = "",
): Promise<void> {
  const code = `custom-${Date.now().toString(36)}`;
  await supabase.from("maintenance_equipment").insert({
    id: eqId(tenantId, code),
    tenant_id: tenantId,
    name, group_name: group, icon,
    checklist,
    sort_order: 999,
    is_custom: true,
    floor, location,
  });
}

export async function updateEquipment(
  equipmentId: string,
  patch: {
    name: string; group: string; icon: string; floor: string; location: string;
    checklist: { c: string; p: string; std: string; freq: string; method: string }[];
  },
): Promise<void> {
  await supabase.from("maintenance_equipment").update({
    name: patch.name,
    group_name: patch.group,
    icon: patch.icon,
    floor: patch.floor,
    location: patch.location,
    checklist: patch.checklist,
  }).eq("id", equipmentId);
}

export async function deleteEquipment(equipmentId: string): Promise<void> {
  await supabase.from("maintenance_equipment").delete().eq("id", equipmentId);
  // Clean up its in-progress state; defects/audits/history are kept as record.
  await supabase.from("maintenance_checklist_state").delete().eq("equipment_id", equipmentId);
}

// ── Checklist state (in-progress draft marks) ───────────────────────────────
/**
 * Returns { [equipmentId]: responses } — the current in-progress toggles that
 * haven't been submitted yet. Drafts left from an earlier facility-day are
 * cleared (deleted), so the checklist starts blank each new day. Completed rounds
 * live in history (recorded only on an explicit submit), never here.
 * `equipNameById` is unused now but kept for signature stability.
 */
export async function getChecklistStates(
  tenantId: string,
  _equipNameById: Record<string, string>,
): Promise<Record<string, ChecklistResponses>> {
  const { data } = await supabase
    .from("maintenance_checklist_state")
    .select("*")
    .eq("tenant_id", tenantId);

  const today = getFacilityTodayString();
  const out: Record<string, ChecklistResponses> = {};
  const staleIds: string[] = [];

  for (const row of data || []) {
    const rowDay = row.updated_at
      ? new Date(row.updated_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
      : today;
    if (rowDay < today) {
      staleIds.push(row.equipment_id);   // yesterday's un-submitted draft → clear
      continue;
    }
    const r: ChecklistResponses = { ...(row.responses || {}) };
    if (row.tech_name) (r as any)._tech = row.tech_name;
    out[row.equipment_id] = r;
  }

  if (staleIds.length > 0) {
    await supabase.from("maintenance_checklist_state").delete().in("equipment_id", staleIds);
  }
  return out;
}

/** Upsert a single OK/NotOK mark (or clear it) plus the technician name. */
export async function setChecklistMark(
  tenantId: string,
  equipmentId: string,
  responses: { [idx: string]: string },
  techName: string,
): Promise<void> {
  await supabase.from("maintenance_checklist_state").upsert({
    equipment_id: equipmentId,
    tenant_id: tenantId,
    responses,
    tech_name: techName,
    updated_at: new Date().toISOString(),
  }, { onConflict: "equipment_id" });
}

/**
 * Archive one frequency's round (Daily / Weekly / Monthly) to history with the
 * exact submission time (created_at), then clear just those items from the
 * in-progress state — leaving other frequencies' marks intact. If nothing else
 * remains for the machine, the state row is removed.
 */
export async function completeFrequencyRound(
  tenantId: string,
  equipmentId: string,
  equipmentName: string,
  archiveItems: { [idx: string]: string },   // only this frequency's marks
  remainingResponses: { [idx: string]: string }, // marks to keep in-progress
  techName: string,
  frequency: string,
): Promise<void> {
  if (Object.keys(archiveItems).length > 0) {
    await supabase.from("maintenance_checklist_history").insert({
      id: `HIST-${equipmentId}-${getFacilityTodayString()}-${Date.now().toString(36)}`,
      tenant_id: tenantId,
      equipment_id: equipmentId,
      equipment_name: equipmentName,
      date: getFacilityTodayString(),
      tech_name: techName || "",
      items: archiveItems,
      frequency,
    });
  }
  if (Object.keys(remainingResponses).length > 0) {
    await supabase.from("maintenance_checklist_state").upsert({
      equipment_id: equipmentId,
      tenant_id: tenantId,
      responses: remainingResponses,
      tech_name: techName || "",
      updated_at: new Date().toISOString(),
    }, { onConflict: "equipment_id" });
  } else {
    await supabase.from("maintenance_checklist_state").delete().eq("equipment_id", equipmentId);
  }
}

// ── Defects ──────────────────────────────────────────────────────────────────
function mapDefect(r: any): DefectRow {
  return {
    id: r.id, machineId: r.equipment_id, machineName: r.equipment_name,
    itemIdx: r.item_idx, component: r.component, desc: r.description,
    criticality: r.criticality, status: r.status,
    action: r.action || "", spares: r.spares || "", target: r.target || "", date: r.date,
  };
}

export async function getDefects(tenantId: string): Promise<DefectRow[]> {
  const { data } = await supabase
    .from("maintenance_defects")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  return (data || []).map(mapDefect);
}

/** Create a defect for a failed item, unless an open one already exists for it. */
export async function createDefect(
  tenantId: string,
  equipmentId: string,
  equipmentName: string,
  itemIdx: number,
  component: string,
  standard: string,
  criticality: "Critical" | "Non-Critical",
): Promise<void> {
  const { data: dup } = await supabase
    .from("maintenance_defects")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("equipment_id", equipmentId)
    .eq("item_idx", itemIdx)
    .neq("status", "Closed")
    .limit(1);
  if (dup && dup.length > 0) return;

  await supabase.from("maintenance_defects").insert({
    id: generateDefectId(),
    tenant_id: tenantId,
    equipment_id: equipmentId,
    equipment_name: equipmentName,
    item_idx: itemIdx,
    component,
    description: standard.trim() ? `Failed standard: ${standard}` : `Failed check: ${component}`,
    criticality,
    status: "Open",
    action: "", spares: "", target: null,
    date: new Date().toISOString().slice(0, 10),
  });
}

/** Resolve (close) the open defect for a checklist item when it's un-flagged. */
export async function resolveDefectForItem(
  tenantId: string, equipmentId: string, itemIdx: number,
): Promise<void> {
  await supabase.from("maintenance_defects")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("equipment_id", equipmentId)
    .eq("item_idx", itemIdx)
    .eq("status", "Open");
}

export async function updateDefectField(id: string, field: string, value: string): Promise<void> {
  const col = ({ action: "action", spares: "spares", target: "target", status: "status" } as Record<string, string>)[field];
  if (!col) return;
  await supabase.from("maintenance_defects")
    .update({ [col]: value || null, updated_at: new Date().toISOString() })
    .eq("id", id);
}

// ── Audits ───────────────────────────────────────────────────────────────────
function mapAudit(r: any): AuditRow {
  return {
    id: r.id, machineId: r.equipment_id, machineName: r.equipment_name,
    date: r.date, inspector: r.inspector, totalScore: r.total_score,
    scores: r.scores || [], remarks: r.remarks || [],
    submittedAt: r.created_at || "",
  };
}

export async function getAudits(tenantId: string): Promise<AuditRow[]> {
  const { data } = await supabase
    .from("maintenance_audits")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  return (data || []).map(mapAudit);
}

export async function submitAudit(
  tenantId: string,
  equipmentId: string,
  equipmentName: string,
  inspector: string,
  scores: number[],
  remarks: string[],
): Promise<number> {
  const total = scores.reduce((a, b) => a + b, 0);
  await supabase.from("maintenance_audits").insert({
    id: `AUD-${Date.now().toString(36).toUpperCase()}`,
    tenant_id: tenantId,
    equipment_id: equipmentId,
    equipment_name: equipmentName,
    date: new Date().toISOString().slice(0, 10),
    inspector,
    total_score: total,
    scores,
    remarks,
  });
  return total;
}

// ── History ──────────────────────────────────────────────────────────────────
export async function getHistory(tenantId: string): Promise<HistoryRow[]> {
  const { data } = await supabase
    .from("maintenance_checklist_history")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(500);
  return (data || []).map((r: any): HistoryRow => ({
    id: r.id, machineId: r.equipment_id, date: r.date, techName: r.tech_name || "", items: r.items || {},
    frequency: r.frequency || "", submittedAt: r.created_at || "",
  }));
}

// ── SOP roster (per client — editable person names for the SOP framework) ─────
export async function getSopRoster(clientId: string): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("maintenance_sop_meta")
    .select("roster")
    .eq("client_id", clientId)
    .maybeSingle();
  return (data?.roster as Record<string, string>) || {};
}

export async function setSopRoster(clientId: string, roster: Record<string, string>): Promise<void> {
  await supabase.from("maintenance_sop_meta").upsert({
    client_id: clientId,
    roster,
    updated_at: new Date().toISOString(),
  }, { onConflict: "client_id" });
}

// ── System reset (this outlet only) ──────────────────────────────────────────
/** Wipes in-progress checklist marks + open defects. Keeps audits & history. */
export async function resetCache(tenantId: string): Promise<void> {
  await supabase.from("maintenance_checklist_state").delete().eq("tenant_id", tenantId);
  await supabase.from("maintenance_defects").delete().eq("tenant_id", tenantId).neq("status", "Closed");
}
