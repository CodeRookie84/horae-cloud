/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * checklistCompliance.ts — the "Food Safety Checks" layer on top of the existing
 * Checklists module (Phase 1 data layer).
 *
 *  • CHECKLIST_PACKS: installable template libraries. The `operational` pack (the
 *    four confirmed starter templates) ships with the `checklists` feature (Pro +
 *    Enterprise). The `fssai` pack is Enterprise-only and provisioned during the
 *    consulting engagement — its templates are authored/validated with the
 *    consultant, so it's intentionally empty here.
 *  • installChecklistPack: seeds a pack's templates as `checklists` + typed
 *    `checklist_items` for one or more outlets.
 *  • Stations: module-local responsible identities (not the staff directory).
 *  • Runs: an immutable completion record written to `checklist_runs` (NOT into the
 *    checklists.description blob), with per-item results + evidence photo URLs.
 *
 * The admin's plain "create checklist" form is untouched; compliance content comes
 * from packs so we never squeeze typed items through the string-only createChecklist.
 */
import { supabase } from "./supabaseClient";
import type { PlanId } from "./plans";
import type {
  ChecklistResponseType,
  ChecklistFrequency,
  ChecklistStation,
  ChecklistRun,
  ChecklistItem,
  Checklist,
} from "../types";
import { compressImage } from "../kot/lib/image";

// ─── Pack / template shapes ──────────────────────────────────────────────────
export interface PackItem {
  text: string;
  responseType: ChecklistResponseType;
  critical?: boolean;
  correctiveAction?: string;
  requiresPhoto?: boolean;
  target?: { min?: number; max?: number; unit?: string };
}
export interface PackSection { name: string; items: PackItem[]; }
export interface PackTemplate {
  key: string;
  title: string;
  frequency: ChecklistFrequency;
  /** Suggested responsible station label, created on install if missing. */
  station: string;
  sections: PackSection[];
}
export interface ChecklistPack {
  id: string;
  label: string;
  /** Plans allowed to install this pack. */
  plans: PlanId[];
  templates: PackTemplate[];
}

const CHILLER = { min: 0, max: 5, unit: "°C" };

// ─── The confirmed Tier-1 "Operational / QC" pack ────────────────────────────
const OPERATIONAL_PACK: ChecklistPack = {
  id: "operational",
  label: "Operational & QC (starter)",
  plans: ["Pro", "Enterprise"],
  templates: [
    {
      key: "kitchen-closing",
      title: "Kitchen — Closing",
      frequency: "closing",
      station: "Kitchen — Closing",
      sections: [
        {
          name: "Storage & labelling",
          items: [
            { text: "Fridge containers lidded & labelled", responseType: "tick", critical: true },
            { text: "Garlic/aromatics in food-grade containers (not plastic bags)", responseType: "tick" },
            { text: "Rice & grains in sealed food-grade bins", responseType: "tick" },
            { text: "Bulk transfers (maida/sugar/rava/icing sugar) carry MFG + EXP from original pack", responseType: "tick", critical: true },
            { text: "Banquet advance-prep labelled with prep time", responseType: "tick" },
          ],
        },
        {
          name: "Temperature & freshness",
          items: [
            { text: "Buffet hot-hold temp at service point", responseType: "numeric", target: { min: 63, unit: "°C" }, requiresPhoto: true },
            { text: "No expired products in use (condiments, dairy, flavourings)", responseType: "tick", critical: true },
            { text: "Peeled vegetables covered & refrigerated", responseType: "tick" },
            { text: "No spoiled produce mixed with fresh", responseType: "tick", critical: true },
          ],
        },
        {
          name: "Segregation, cleaning & pest",
          items: [
            { text: "RTE and raw foods segregated in all fridges", responseType: "tick", critical: true },
            { text: "No pest activity observed", responseType: "tick", critical: true },
            { text: "Dustbins covered/lidded; floor free of debris", responseType: "tick" },
            { text: "Fridge interiors, fans & coils cleaned", responseType: "tick" },
            { text: "Fridges & counters clean and maintained", responseType: "tick" },
          ],
        },
        {
          name: "Equipment",
          items: [
            { text: "Appliances (ACs, refrigerators) fully functional", responseType: "yes_no" },
          ],
        },
      ],
    },
    {
      key: "kitchen-opening",
      title: "Kitchen — Opening",
      frequency: "opening",
      station: "Kitchen — Opening",
      sections: [
        {
          name: "Dairy & cold chain",
          items: [
            { text: "No expired curd/milk/paneer/cream (checked vs date stamps)", responseType: "tick", critical: true },
            { text: "Dairy stored in cold chain", responseType: "numeric", target: CHILLER, requiresPhoto: true },
            { text: "Opened dairy dated & used within safe window", responseType: "tick" },
          ],
        },
        {
          name: "Personal hygiene",
          items: [
            { text: "Nails trimmed/clean, no polish/false nails", responseType: "tick" },
            { text: "No rings/watches/bracelets/jewellery", responseType: "tick" },
            { text: "Hair covered with clean cap/hairnet", responseType: "tick" },
            { text: "Clean apron/uniform; changed when soiled", responseType: "tick" },
            { text: "Clean-shaven & well groomed", responseType: "tick" },
            { text: "No smoking/spitting/tobacco/eating in food area", responseType: "tick", critical: true },
            { text: "Staff with illness/wounds/infection kept away from food", responseType: "tick", critical: true },
            { text: "Hands washed (start / after washroom / after raw food)", responseType: "tick", critical: true },
          ],
        },
        {
          name: "Tools",
          items: [
            { text: "Chopping boards colour-coded & food-grade", responseType: "tick" },
          ],
        },
      ],
    },
    {
      key: "counter-opening",
      title: "Counter — Opening (Food Safety Inspection)",
      frequency: "opening",
      station: "Counter — Opening",
      sections: [
        {
          name: "License & documentation",
          items: [
            { text: "FSSAI licence displayed at a visible location", responseType: "yes_no", critical: true },
            { text: "Medical fitness / health certificates current for handlers", responseType: "yes_no", critical: true },
          ],
        },
        {
          name: "Date labelling",
          items: [
            { text: "Packed/branded items show legible MFG + EXP", responseType: "yes_no" },
            { text: "Near-expiry items placed at front (FIFO)", responseType: "yes_no" },
            { text: "No expired ingredients in active storage", responseType: "yes_no", critical: true },
            { text: "Display products have name boards & labelling", responseType: "yes_no" },
            { text: "FIFO followed at counter", responseType: "yes_no" },
          ],
        },
        {
          name: "Refrigeration & hygiene",
          items: [
            { text: "Fridge temp recorded, in range", responseType: "numeric", target: CHILLER, requiresPhoto: true },
            { text: "Fridges & counters visibly clean", responseType: "yes_no" },
            { text: "No signs of pest activity", responseType: "yes_no", critical: true },
            { text: "Utensils/crates/boxes in designated zones", responseType: "yes_no" },
            { text: "Appliances (ACs, refrigerators) fully functional", responseType: "yes_no" },
          ],
        },
        {
          name: "Personal hygiene",
          items: [
            { text: "Nails trimmed/clean & hair covered", responseType: "yes_no" },
            { text: "No jewellery while handling food", responseType: "yes_no" },
            { text: "Clean apron/uniform", responseType: "yes_no" },
            { text: "No smoking/spitting/tobacco/eating", responseType: "yes_no", critical: true },
            { text: "Staff with illness/wounds kept away from food", responseType: "yes_no", critical: true },
            { text: "Hands washed (start / after washroom / after raw food)", responseType: "yes_no", critical: true },
            { text: "Clean-shaven & well groomed", responseType: "yes_no" },
          ],
        },
      ],
    },
    {
      key: "qc-audit",
      title: "QC Audit",
      frequency: "audit",
      station: "QC Lead",
      sections: [
        {
          name: "Part 1 — Expiry & labelling",
          items: [
            { text: "No expired products anywhere (fridges/shelves/hot counter)", responseType: "score", critical: true, correctiveAction: "Remove & quarantine" },
            { text: "Near-expiry items at front (FIFO)", responseType: "score", correctiveAction: "Reposition immediately" },
            { text: "All items show MFG & EXP clearly", responseType: "score", correctiveAction: "Label or quarantine" },
            { text: "Day-indicating stickers on cakes, pastries, gudbud, etc.", responseType: "score", correctiveAction: "Apply date label immediately" },
            { text: "Sponges wrapped in clingwrap & labelled", responseType: "score", correctiveAction: "Wrap & label immediately" },
            { text: "MFG/EXP applied on containers stored in fridge", responseType: "score", correctiveAction: "Apply date label immediately" },
          ],
        },
        {
          name: "Part 2 — Fridge & cold storage hygiene",
          items: [
            { text: "Food containers tightly covered/sealed", responseType: "score", correctiveAction: "Cover immediately" },
            { text: "Raw eggs on bottom shelves, separate from RTE", responseType: "score", critical: true, correctiveAction: "Segregate immediately" },
            { text: "No spoiled produce alongside fresh stock", responseType: "score", critical: true, correctiveAction: "Remove & discard" },
            { text: "Refrigerator temperature within range", responseType: "score", correctiveAction: "Report to Maintenance", requiresPhoto: true },
            { text: "Fridges & counters clean incl. fan", responseType: "score", correctiveAction: "Clean before operations" },
            { text: "Work-area appliances fully functional", responseType: "score", correctiveAction: "Report to Maintenance" },
          ],
        },
        {
          name: "Part 3 — Storage & material handling",
          items: [
            { text: "Garlic in airtight containers, never plastic bags", responseType: "score", correctiveAction: "Transfer to airtight container" },
            { text: "Vegetable crates washed & cleaned", responseType: "score", correctiveAction: "Wash & clean immediately" },
            { text: "Wooden rolling pins not in use", responseType: "score", correctiveAction: "Replace immediately" },
          ],
        },
        {
          name: "Part 4 — Workplace, pest & equipment",
          items: [
            { text: "No signs of pest activity (droppings, cockroaches, mouse shelters)", responseType: "score", critical: true, correctiveAction: "Alert QC Lead immediately" },
            { text: "Waste segregation done correctly", responseType: "score", correctiveAction: "Segregate waste immediately" },
            { text: "Dustbins covered & closed during operations", responseType: "score", correctiveAction: "Close/replace lid immediately" },
            { text: "Stoves & tank fryer visibly clean", responseType: "score", correctiveAction: "Clean before & after operations" },
            { text: "All equipment visibly clean", responseType: "score", correctiveAction: "Clean before operations" },
          ],
        },
      ],
    },
  ],
};

// Enterprise-only, consulting-provisioned. Templates authored/validated with the
// food-safety consultant, so intentionally empty until that content lands.
const FSSAI_PACK: ChecklistPack = {
  id: "fssai",
  label: "Complete FSSAI formats (Enterprise)",
  plans: ["Enterprise"],
  templates: [],
};

export const CHECKLIST_PACKS: ChecklistPack[] = [OPERATIONAL_PACK, FSSAI_PACK];

/** Packs a plan may install. (Feature access to the module itself is gated
 *  separately by the `checklists` FeatureKey in plans.ts.) */
export function packsForPlan(plan: PlanId | string): ChecklistPack[] {
  return CHECKLIST_PACKS.filter((p) => (p.plans as string[]).includes(plan));
}
export function getPack(packId: string): ChecklistPack | undefined {
  return CHECKLIST_PACKS.find((p) => p.id === packId);
}

// ─── Install a pack (seed checklists + typed items) ──────────────────────────
export interface InstallPackResult {
  installed: number;
  /** (tenant, template) pairs that already existed — not re-inserted. */
  skipped: number;
}

/** Admin-only. Seeds a pack's templates as `checklists` + typed `checklist_items`
 *  for one or more outlets, optionally scoped to specific staff (assignment).
 *  Idempotent per (tenant, template): a template already installed for an
 *  outlet is skipped rather than duplicated — safe to click repeatedly. */
export async function installChecklistPack(
  packId: string,
  tenantIds: string[],
  createdBy: { userId: string; name: string; role: string },
  assign?: { userIds?: string[]; notifyUserIds?: string[] },
): Promise<InstallPackResult> {
  const pack = getPack(packId);
  if (!pack || pack.templates.length === 0 || tenantIds.length === 0) return { installed: 0, skipped: 0 };

  // Idempotency guard: don't re-install a (tenant, template) pair that's
  // already present — this is what made repeated "+ Templates" clicks pile up
  // duplicate copies of the whole pack.
  const { data: existingRows } = await supabase
    .from("checklists")
    .select("tenant_id, description")
    .in("tenant_id", tenantIds);
  const alreadyInstalled = new Set<string>();
  (existingRows || []).forEach((r: any) => {
    try {
      if (r.description && r.description.startsWith("{")) {
        const obj = JSON.parse(r.description);
        if (obj.packId === packId && obj.templateKey) {
          alreadyInstalled.add(`${r.tenant_id}::${obj.templateKey}`);
        }
      }
    } catch { /* ignore malformed rows */ }
  });

  const checklistRows: any[] = [];
  const itemRows: any[] = [];
  const stationRows: any[] = [];
  let skipped = 0;

  for (const tId of tenantIds) {
    for (const tpl of pack.templates) {
      if (alreadyInstalled.has(`${tId}::${tpl.key}`)) { skipped++; continue; }

      const flat = tpl.sections.flatMap((s) => s.items);
      const checklistId = `checklist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const stationId = `cstn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      stationRows.push({ id: stationId, tenant_id: tId, label: tpl.station, active: true });

      checklistRows.push({
        id: checklistId,
        tenant_id: tId,
        title: tpl.title,
        description: JSON.stringify({
          desc: "",
          recurrence: "One-time",
          recurrenceDay: "",
          attachment: "",
          customInputFields: [],
          sections: tpl.sections.map((s, i) => ({
            id: `sec-${i}`,
            number: `${i + 1}`,
            name: s.name,
            items: s.items.map((it) => ({ id: "", text: it.text })),
          })),
          type: "single",
          adminNotes: "",
          groupId: `group-${checklistId}`,
          // compliance meta
          frequency: tpl.frequency,
          packId: pack.id,
          templateKey: tpl.key,
          assignment: {
            stationIds: [stationId],
            userIds: assign?.userIds || [],
            notifyUserIds: assign?.notifyUserIds || [],
          },
        }),
        department: "All Departments",
        role: "All Roles",
        created_at: new Date().toISOString(),
        created_by_user_id: createdBy.userId,
        created_by_name: createdBy.name,
        created_by_role: createdBy.role,
      });

      flat.forEach((it, index) => {
        itemRows.push({
          id: `item-${checklistId}-${index}`,
          checklist_id: checklistId,
          text: it.text,
          completed: false,
          response_type: it.responseType,
          critical: !!it.critical,
          corrective_action: it.correctiveAction ?? null,
          requires_photo: !!it.requiresPhoto,
          target: it.target ?? null,
        });
      });
    }
  }

  if (stationRows.length) await supabase.from("checklist_stations").insert(stationRows);
  if (checklistRows.length) await supabase.from("checklists").insert(checklistRows);
  if (itemRows.length) await supabase.from("checklist_items").insert(itemRows);
  return { installed: checklistRows.length, skipped };
}

// ─── Stations ────────────────────────────────────────────────────────────────
export async function getChecklistStations(tenantIds: string[]): Promise<ChecklistStation[]> {
  if (!tenantIds.length) return [];
  const { data } = await supabase
    .from("checklist_stations")
    .select("*")
    .in("tenant_id", tenantIds)
    .order("label", { ascending: true });
  return (data || []).map((r: any) => ({
    id: r.id, tenantId: r.tenant_id, clientId: r.client_id ?? undefined,
    label: r.label, active: r.active, createdAt: r.created_at,
  }));
}

export async function createChecklistStation(
  label: string, tenantId: string, clientId?: string,
): Promise<ChecklistStation> {
  const id = `cstn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const row = { id, tenant_id: tenantId, client_id: clientId ?? null, label, active: true };
  const { error } = await supabase.from("checklist_stations").insert([row]);
  if (error) throw error;
  return { id, tenantId, clientId, label, active: true };
}

export async function setChecklistStationActive(stationId: string, active: boolean): Promise<void> {
  await supabase.from("checklist_stations").update({ active }).eq("id", stationId);
}

// ─── Runs (the inspection-ready register) ────────────────────────────────────
export async function submitChecklistRun(
  input: Omit<ChecklistRun, "id" | "createdAt">,
): Promise<ChecklistRun> {
  const id = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const row = {
    id,
    checklist_id: input.checklistId,
    tenant_id: input.tenantId,
    station_id: input.stationId ?? null,
    performer_user_id: input.performer.userId ?? null,
    performer_name: input.performer.name,
    started_at: input.startedAt ?? null,
    completed_at: input.completedAt,
    status: input.status,
    score: input.score ?? null,
    compliance_pct: input.compliancePct ?? null,
    items: input.items,
  };
  const { error } = await supabase.from("checklist_runs").insert([row]);
  if (error) throw error;
  return { ...input, id };
}

export async function getChecklistRuns(opts: {
  checklistId?: string;
  tenantIds?: string[];
  from?: string;
  to?: string;
  limit?: number;
}): Promise<ChecklistRun[]> {
  let q = supabase.from("checklist_runs").select("*");
  if (opts.checklistId) q = q.eq("checklist_id", opts.checklistId);
  if (opts.tenantIds?.length) q = q.in("tenant_id", opts.tenantIds);
  if (opts.from) q = q.gte("completed_at", opts.from);
  if (opts.to) q = q.lte("completed_at", opts.to);
  q = q.order("completed_at", { ascending: false }).limit(opts.limit ?? 200);
  const { data } = await q;
  return (data || []).map((r: any) => ({
    id: r.id,
    checklistId: r.checklist_id,
    tenantId: r.tenant_id,
    stationId: r.station_id,
    performer: { userId: r.performer_user_id ?? undefined, name: r.performer_name },
    startedAt: r.started_at,
    completedAt: r.completed_at,
    status: r.status,
    score: r.score,
    compliancePct: r.compliance_pct,
    items: Array.isArray(r.items) ? r.items : [],
    createdAt: r.created_at,
  }));
}

// ─── Evidence photos ─────────────────────────────────────────────────────────
export async function uploadChecklistPhoto(
  file: Blob, opts: { clientId?: string; checklistId: string },
): Promise<string> {
  const blob = await compressImage(file, { maxDim: 1280, quality: 0.7 });
  const type = blob.type || "image/jpeg";
  const ext = type.split("/")[1]?.split("+")[0] || "jpg";
  const path = `${opts.clientId || "x"}/${opts.checklistId}/${crypto.randomUUID()}.${ext}`;
  const upload = supabase.storage.from("checklist-photos").upload(path, blob, {
    upsert: false, contentType: type, cacheControl: "3600",
  });
  const timeout = new Promise<never>((_, rej) =>
    setTimeout(() => rej(new Error("Upload timed out — check the connection and retry.")), 60_000));
  const { error } = (await Promise.race([upload, timeout])) as Awaited<typeof upload>;
  if (error) throw error;
  return supabase.storage.from("checklist-photos").getPublicUrl(path).data.publicUrl;
}

// ─── Custom checklists built by a client admin (paste-a-block + inline tags) ──
// The admin form keeps the "one checkpoint per line" paste technique; a line may
// carry inline tags to set its type/flags (default = tick):
//   @yesno · @score · @num(0-5°C) / @num(>=63°C) · @photo · @critical · @fix(text)
// e.g.  Fridge temp @num(0-5°C) @photo        No expired stock @critical
export interface ParsedLine {
  text: string;
  responseType: ChecklistResponseType;
  critical?: boolean;
  requiresPhoto?: boolean;
  target?: { min?: number; max?: number; unit?: string };
  correctiveAction?: string;
}

function parseTarget(s: string): { min?: number; max?: number; unit?: string } {
  const t = s.trim();
  const unitM = t.match(/[^\d\s.\-–<>=≥≤]+$/);
  const unit = unitM ? unitM[0].trim() : undefined;
  const range = t.match(/(-?\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (range) return { min: +range[1], max: +range[2], unit };
  const n = t.match(/-?\d+(?:\.\d+)?/);
  const num = n ? +n[0] : undefined;
  if (/[<≤]/.test(t)) return { max: num, unit };
  if (/[>≥]/.test(t)) return { min: num, unit };
  if (num !== undefined) return { min: num, unit };
  return { unit };
}

export function parseChecklistLine(raw: string): ParsedLine {
  let text = raw;
  let responseType: ChecklistResponseType = "tick";
  let critical: boolean | undefined;
  let requiresPhoto: boolean | undefined;
  let target: { min?: number; max?: number; unit?: string } | undefined;
  let correctiveAction: string | undefined;

  const fix = text.match(/@fix\(([^)]*)\)/i);
  if (fix) { correctiveAction = fix[1].trim() || undefined; text = text.replace(fix[0], ""); }
  const num = text.match(/@num\(([^)]*)\)/i);
  if (num) { responseType = "numeric"; target = parseTarget(num[1]); text = text.replace(num[0], ""); }
  if (/@score\b/i.test(text)) { responseType = "score"; text = text.replace(/@score\b/i, ""); }
  if (/@yesno\b/i.test(text)) { if (responseType === "tick") responseType = "yes_no"; text = text.replace(/@yesno\b/i, ""); }
  if (/@photo\b/i.test(text)) { requiresPhoto = true; text = text.replace(/@photo\b/i, ""); }
  if (/@critical\b/i.test(text)) { critical = true; text = text.replace(/@critical\b/i, ""); }

  text = text.replace(/\s{2,}/g, " ").trim();
  return {
    text, responseType,
    ...(critical ? { critical } : {}),
    ...(requiresPhoto ? { requiresPhoto } : {}),
    ...(target ? { target } : {}),
    ...(correctiveAction ? { correctiveAction } : {}),
  };
}

/** Turn a stored item back into an editable tagged line (for the edit form). */
export function serializeChecklistItem(it: ChecklistItem): string {
  let s = it.text;
  const rt = it.responseType || "tick";
  if (rt === "numeric" && it.target) {
    const { min, max, unit = "" } = it.target;
    const tag = (min !== undefined && max !== undefined) ? `${min}-${max}${unit}`
      : (min !== undefined) ? `>=${min}${unit}` : (max !== undefined) ? `<=${max}${unit}` : unit;
    s += ` @num(${tag})`;
  } else if (rt === "score") { s += " @score"; }
  else if (rt === "yes_no") { s += " @yesno"; }
  if (it.requiresPhoto) s += " @photo";
  if (it.critical) s += " @critical";
  if (it.correctiveAction) s += ` @fix(${it.correctiveAction})`;
  return s;
}

async function createStationsFor(labels: string[] | undefined, tenantId: string, clientId?: string): Promise<string[]> {
  const clean = (labels || []).map((l) => l.trim()).filter(Boolean);
  if (!clean.length) return [];
  const rows = clean.map((label) => ({
    id: `cstn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tenant_id: tenantId, client_id: clientId ?? null, label, active: true,
  }));
  const { error } = await supabase.from("checklist_stations").insert(rows);
  if (error) throw error;
  return rows.map((r) => r.id);
}

export interface CustomChecklistInput {
  id?: string;                 // present ⇒ update this checklist in place
  title: string;
  desc?: string;
  tenantIds: string[];         // create: 1..n outlets; update: [the checklist's tenant]
  sections: { number: string; name: string; lines: string[] }[];
  frequency: ChecklistFrequency;
  stationIds?: string[];       // existing stations (single-outlet only)
  newStationLabels?: string[];
  userIds?: string[];
  /** Watchers (managers/chefs) notified on every submission — see Checklist.assignment. */
  notifyUserIds?: string[];
  customInputFields?: string[];
  recurrence?: string;
  recurrenceDay?: string;
  createdBy: { userId: string; name: string; role: string };
  clientId?: string;
}

/** Create (per outlet) or update a client's own compliance checklist — typed items
 *  from the tagged paste, station + individual assignment, no dept/role targeting. */
export async function saveCustomComplianceChecklist(input: CustomChecklistInput): Promise<void> {
  const parsedSections = input.sections.map((s, i) => ({
    id: `sec-${i}`, number: s.number, name: s.name,
    items: s.lines.map((l) => parseChecklistLine(l)).filter((p) => p.text),
  }));
  const flat = parsedSections.flatMap((s) => s.items);

  const buildDesc = (checklistId: string, stationIds: string[]) => JSON.stringify({
    desc: input.desc || "",
    recurrence: input.recurrence || "One-time",
    recurrenceDay: input.recurrenceDay || "",
    attachment: "",
    customInputFields: input.customInputFields || [],
    sections: parsedSections.map((s) => ({ id: s.id, number: s.number, name: s.name, items: s.items.map((it) => ({ id: "", text: it.text })) })),
    type: "single",
    adminNotes: "",
    groupId: `group-${checklistId}`,
    frequency: input.frequency,
    packId: "custom",
    assignment: { stationIds, userIds: input.userIds || [], notifyUserIds: input.notifyUserIds || [] },
  });

  const itemRows = (checklistId: string) => flat.map((it, idx) => ({
    id: `item-${checklistId}-${idx}`, checklist_id: checklistId, text: it.text, completed: false,
    response_type: it.responseType, critical: !!it.critical,
    corrective_action: it.correctiveAction ?? null, requires_photo: !!it.requiresPhoto, target: it.target ?? null,
  }));

  if (input.id) {
    const tId = input.tenantIds[0];
    const newIds = await createStationsFor(input.newStationLabels, tId, input.clientId);
    const stationIds = [...(input.stationIds || []), ...newIds];
    await supabase.from("checklists").update({ title: input.title, description: buildDesc(input.id, stationIds) }).eq("id", input.id);
    await supabase.from("checklist_items").delete().eq("checklist_id", input.id);
    if (flat.length) await supabase.from("checklist_items").insert(itemRows(input.id));
    return;
  }

  for (const tId of input.tenantIds) {
    const checklistId = `checklist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newIds = await createStationsFor(input.newStationLabels, tId, input.clientId);
    const stationIds = [...(input.tenantIds.length === 1 ? (input.stationIds || []) : []), ...newIds];
    await supabase.from("checklists").insert([{
      id: checklistId, tenant_id: tId, title: input.title, description: buildDesc(checklistId, stationIds),
      department: "All Departments", role: "All Roles", created_at: new Date().toISOString(),
      created_by_user_id: input.createdBy.userId, created_by_name: input.createdBy.name, created_by_role: input.createdBy.role,
    }]);
    if (flat.length) await supabase.from("checklist_items").insert(itemRows(checklistId));
  }
}

// ─── Recurrence windows ───────────────────────────────────────────────────────
/** Whether `iso` falls inside the checklist's current display cycle for its
 *  `recurrence` (Daily resets at midnight, Weekly at the week boundary, Custom
 *  is a rolling 3 days, One-time/anything else stays "done" forever once hit).
 *  Shared by store.getChecklists (per-user completed state) and the submission
 *  status board (per-assignee submitted/pending state) so both agree. */
export function isWithinRecurrenceWindow(recurrence: string | undefined, iso: string | undefined | null): boolean {
  if (!iso) return false;
  const when = new Date(iso);
  const today = new Date();
  if (recurrence === "Daily") {
    return when.toISOString().split("T")[0] === today.toISOString().split("T")[0];
  }
  if (recurrence === "Weekly") {
    const sundayOf = (d: Date) => {
      const c = new Date(d.getTime());
      c.setDate(c.getDate() - c.getDay());
      return c.toISOString().split("T")[0];
    };
    return sundayOf(when) === sundayOf(today);
  }
  if (recurrence === "Custom") {
    const diffDays = Math.ceil(Math.abs(today.getTime() - when.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays < 3;
  }
  return true; // One-time — done once, shown done forever.
}

// ─── Submission notifications (watchers) ─────────────────────────────────────
/** Pings a checklist's tagged watchers (assignment.notifyUserIds) when it's
 *  submitted — an in-app bell plus an app push via notify-dispatcher. Never
 *  WhatsApp: this is a "someone submitted" ping, not an assignment, so it
 *  stays on the free channels. Best-effort — a failure here must never block
 *  the run itself, so callers should fire-and-forget this. */
export async function notifyChecklistSubmission(
  checklist: Pick<Checklist, "id" | "title" | "tenantId" | "assignment">,
  outcome: { compliancePct?: number | null; status?: string },
  submitter: { userId?: string; name: string },
  runId: string,
): Promise<void> {
  const watcherIds = (checklist.assignment?.notifyUserIds || []).filter((id) => id && id !== submitter.userId);
  if (!watcherIds.length) return;

  const statusTxt = outcome.status === "failed" ? "needs attention" : `${outcome.compliancePct ?? 100}% compliant`;
  const title = `Checklist submitted: ${checklist.title}`;
  const message = `${submitter.name} submitted — ${statusTxt}`;

  try {
    await supabase.from("notifications").insert(
      watcherIds.map((uid) => ({
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        tenant_id: checklist.tenantId,
        title, message,
        category: "checklist",
        department: "All Departments",
        role: "All Roles",
        created_at: new Date().toISOString(),
        target_user_id: uid,
      }))
    );
  } catch { /* best-effort in-app bell */ }

  supabase.functions.invoke("notify-dispatcher", {
    body: {
      type: "CHECKLIST_SUBMITTED",
      record: { id: checklist.id, title: checklist.title },
      userIds: watcherIds,
      tenantId: checklist.tenantId,
      runId,
      submitterName: submitter.name,
      compliancePct: outcome.compliancePct,
      status: outcome.status,
    },
  }).catch(() => { /* best-effort push */ });
}
