-- CLIT (Equipment Maintenance) access model + floor dimension.
-- Run in the Supabase SQL Editor / CLI after 20260706_maintenance.sql.
--
-- Two additive concerns:
--   1. Per-staff CLIT access + CLIT role, stored on the global staff directory
--      (users). CLIT access is DECOUPLED from a staff member's operational role
--      and from their home outlet: a technician flagged with clit_access can
--      service the CLIT checklists of EVERY outlet + floor under their client and
--      filters to the target outlet/floor on the Equipment Maintenance tab. Only
--      users with clit_access see that tab at all.
--   2. A floor / location dimension on equipment so a client's machines can be
--      differentiated outlet-wise (already via tenant_id) AND floor-wise.

-- 1. Staff CLIT access + role.
ALTER TABLE users ADD COLUMN IF NOT EXISTS clit_access BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS clit_role   TEXT;  -- null unless clit_access; one of
                                                              -- technician | qc_executive | qc_lead
                                                              -- | maintenance_manager | clit_admin

-- 2. Floor / in-floor location on the per-outlet equipment registry.
ALTER TABLE maintenance_equipment ADD COLUMN IF NOT EXISTS floor    TEXT NOT NULL DEFAULT '';
ALTER TABLE maintenance_equipment ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT '';

-- NOTE: CLIT role visibility is enforced in-app (capability matrix in
-- src/components/maintenance/clitRoles.ts), matching the permissive-RLS pattern
-- used by every other Horae feature table. Tightening to DB-level enforcement
-- would mean replacing the "Allow all" policies with client/role-aware ones.
