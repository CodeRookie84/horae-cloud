/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// Admin Console for the Equipment Maintenance tab — a real React panel (not an
// HTML string) so equipment add/edit/delete and staff CLIT-access management are
// robust. Rendered inside the `.clit-scope` container so the island CSS applies.

import React, { useMemo, useState } from "react";
import { User as AppUser } from "../../types";
import { ICON_KEYS, type DraftRow, type Equipment } from "./maintenanceEngine";
import { ALL_CLIT_ROLES, CLIT_ROLE_LABELS, CLIT_ROLE_BLURB, isClientAdminRole } from "./clitRoles";
import * as svc from "../../services/maintenanceService";

interface Props {
  tenantId: string;
  outletName: string;
  equipment: Equipment[];
  floorPrefill: string;
  canManageEquipment: boolean;
  canManageAccess: boolean;
  clientUsers: AppUser[];
  onReloadEquipment: () => void;
  onSetClitAccess: (userId: string, access: boolean, role: string) => Promise<void>;
}

const FREQ_OPTIONS = ["Daily", "Weekly", "Monthly"];
const NEW_CAT = "__new__";
const emptyRow = (): DraftRow => ({ c: "", p: "Clean", std: "", freq: "Daily", method: "" });

export default function MaintenanceAdmin({
  tenantId, outletName, equipment, floorPrefill, canManageEquipment, canManageAccess,
  clientUsers, onReloadEquipment, onSetClitAccess,
}: Props) {
  const categories = useMemo(
    () => Array.from(new Set(equipment.map(e => e.group).filter(Boolean))).sort(),
    [equipment],
  );

  // ── Add / edit machine form ──
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [icon, setIcon] = useState("oven");
  const [floor, setFloor] = useState(floorPrefill || "");
  const [location, setLocation] = useState("");
  const [rows, setRows] = useState<DraftRow[]>([emptyRow()]);
  const [busy, setBusy] = useState(false);

  const isNewCat = !categories.includes(group);
  const setRow = (i: number, patch: Partial<DraftRow>) =>
    setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const resetForm = () => {
    setEditingId(null); setName(""); setGroup(categories[0] || ""); setIcon("oven");
    setFloor(floorPrefill || ""); setLocation(""); setRows([emptyRow()]); setOpen(false);
  };

  const startAdd = () => {
    setEditingId(null); setName(""); setGroup(categories[0] || ""); setIcon("oven");
    setFloor(floorPrefill || ""); setLocation(""); setRows([emptyRow()]); setOpen(true);
  };

  const startEdit = (m: Equipment) => {
    setEditingId(m.id); setName(m.name); setGroup(m.group); setIcon(m.icon);
    setFloor(m.floor || ""); setLocation(m.location || "");
    setRows((m.checklist && m.checklist.length ? m.checklist : [emptyRow()]).map(r => ({ ...r })));
    setOpen(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async () => {
    // Only the component name is required; Target Standard + Method are optional.
    const checklist = rows.filter(r => r.c.trim());
    if (!name.trim() || !group.trim() || checklist.length === 0) {
      alert("Please add a machine name, a category, and at least one checklist row with a component.");
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        await svc.updateEquipment(editingId, { name: name.trim(), group: group.trim(), icon, floor: floor.trim(), location: location.trim(), checklist });
      } else {
        await svc.addEquipment(tenantId, name.trim(), group.trim(), icon, checklist, floor.trim(), location.trim());
      }
      resetForm();
      onReloadEquipment();
    } finally { setBusy(false); }
  };

  const deleteMachine = async (m: Equipment) => {
    if (!confirm(`Delete "${m.name}" and its in-progress checklist? This cannot be undone.`)) return;
    await svc.deleteEquipment(m.id);
    if (editingId === m.id) resetForm();
    onReloadEquipment();
  };

  const resetCache = async () => {
    if (!confirm(`Reset system cache for ${outletName}? This clears in-progress checklist marks and open defects. Audit history and submitted rounds are kept.`)) return;
    await svc.resetCache(tenantId);
    onReloadEquipment();
  };

  // ── Staff CLIT access ──
  const [query, setQuery] = useState("");
  // Staff who currently HAVE access (explicit grant, or Client Admins by default).
  const grantedUsers = useMemo(
    () => clientUsers
      .filter(u => u.clitAccess || isClientAdminRole(u.role as string))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [clientUsers],
  );
  // Directory search — only shows staff who DON'T yet have access, to grant them.
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const grantedIds = new Set(grantedUsers.map(u => u.id));
    return clientUsers
      .filter(u => !grantedIds.has(u.id))
      .filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.role || "").toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 20);
  }, [clientUsers, grantedUsers, query]);

  return (
    <div>
      <div className="eyebrow">Admin Console</div>
      <h2 className="section-title">Admin Console</h2>
      <p className="section-sub">Set up the equipment registry and decide who can use the CLIT programme.</p>

      {canManageEquipment && (
        <div className="admin-section">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <h3 style={{ fontSize: 17 }}>Equipment — {outletName}</h3>
            {!open && <button className="btn-secondary" onClick={startAdd}>+ Add machine</button>}
          </div>
          <p className="muted-cell" style={{ fontSize: 12.5, marginBottom: open ? 16 : 0 }}>
            Machines are per outlet. Tag a floor so technicians can filter to it. Only the component name is required per checklist row.
          </p>

          {open && (
            <div style={{ display: "grid", gap: 12, marginBottom: 12, border: "1px solid var(--line)", borderRadius: 12, padding: 16, background: "var(--cream)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <strong style={{ color: "var(--ink)" }}>{editingId ? "Edit machine" : "New machine"}</strong>
                <button className="back-btn" style={{ margin: 0 }} onClick={resetForm}>Cancel</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div><label className="field-label">Machine name</label><input className="field-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Bread Slicer" /></div>
                <div>
                  <label className="field-label">Category</label>
                  <select className="field-input" value={isNewCat ? NEW_CAT : group} onChange={e => setGroup(e.target.value === NEW_CAT ? "" : e.target.value)}>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value={NEW_CAT}>+ Add new category…</option>
                  </select>
                  {isNewCat && <input className="field-input" style={{ marginTop: 6 }} value={group} onChange={e => setGroup(e.target.value)} placeholder="New category name" />}
                </div>
                <div><label className="field-label">Icon</label>
                  <select className="field-input" value={icon} onChange={e => setIcon(e.target.value)}>
                    {ICON_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label className="field-label">Floor</label><input className="field-input" value={floor} onChange={e => setFloor(e.target.value)} placeholder="e.g. Ground Floor" /></div>
                <div><label className="field-label">Location / zone (optional)</label><input className="field-input" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Prep Area" /></div>
              </div>
              <div>
                <label className="field-label">Checklist items <span style={{ textTransform: "none", opacity: 0.7 }}>(Standard &amp; Method optional)</span></label>
                {rows.map((r, i) => (
                  <div className="draft-grid" key={i}>
                    <input className="field-input" value={r.c} onChange={e => setRow(i, { c: e.target.value })} placeholder="Component *" />
                    <select className="field-input" value={r.p} onChange={e => setRow(i, { p: e.target.value })}>
                      {["Clean", "Lubricate", "Inspect", "Tighten"].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <input className="field-input" value={r.std} onChange={e => setRow(i, { std: e.target.value })} placeholder="Target standard (optional)" />
                    <select className="field-input" value={r.freq} onChange={e => setRow(i, { freq: e.target.value })}>
                      {FREQ_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <input className="field-input" value={r.method} onChange={e => setRow(i, { method: e.target.value })} placeholder="Method (optional)" />
                    <button className="icon-btn" title="Remove row" disabled={rows.length <= 1} onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}>&times;</button>
                  </div>
                ))}
                <button className="back-btn" style={{ marginTop: 8 }} onClick={() => setRows(rs => [...rs, emptyRow()])}>+ Add checklist row</button>
              </div>
              <button className="btn-primary" style={{ width: "fit-content" }} disabled={busy} onClick={save}>{busy ? "Saving…" : editingId ? "Save changes" : "Create machine"}</button>
            </div>
          )}

          <div className="checklist-table-wrap" style={{ marginTop: 16 }}>
            <table className="checklist-table">
              <thead><tr><th>Machine</th><th>Category</th><th>Floor</th><th className="center">Items</th><th>Origin</th><th></th></tr></thead>
              <tbody>
                {equipment.length === 0 ? (
                  <tr><td colSpan={6} className="muted-cell">No machines yet.</td></tr>
                ) : equipment.map(m => (
                  <tr key={m.id}>
                    <td><strong>{m.name}</strong></td>
                    <td className="muted-cell">{m.group}</td>
                    <td className="muted-cell">{m.floor || "—"}</td>
                    <td className="center mono">{(m.checklist || []).length}</td>
                    <td className="muted-cell">{m.isCustom ? "Custom" : "Built-in"}</td>
                    <td className="center" style={{ whiteSpace: "nowrap" }}>
                      <button className="btn-secondary" style={{ padding: "6px 12px", fontSize: 11, marginRight: 6 }} onClick={() => startEdit(m)}>Edit</button>
                      <button className="btn-secondary" style={{ padding: "6px 12px", fontSize: 11, color: "var(--red)", borderColor: "var(--red)" }} onClick={() => deleteMachine(m)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
            <button className="btn-secondary" style={{ color: "var(--red)", borderColor: "var(--red)" }} onClick={resetCache}>Reset system cache</button>
            <p className="muted-cell" style={{ fontSize: 12, marginTop: 8 }}>Clears in-progress marks and open defects for this outlet. Audit history and submitted rounds are permanent.</p>
          </div>
        </div>
      )}

      {canManageAccess && (
        <div className="admin-section">
          <h3 style={{ fontSize: 17, marginBottom: 6 }}>CLIT Access</h3>
          <p className="muted-cell" style={{ fontSize: 12.5, marginBottom: 14 }}>
            Staff who can use the CLIT programme. Client Admins always have CLIT Admin access.
          </p>

          {/* Staff who currently have access */}
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
            With access ({grantedUsers.length})
          </div>
          {grantedUsers.length === 0 ? (
            <div className="empty-state">No staff have CLIT access yet. Search the directory below to grant it.</div>
          ) : grantedUsers.map(u => (
            <StaffAccessRow key={u.id} user={u} onSetClitAccess={onSetClitAccess} />
          ))}

          {/* Grant access to more staff from the client directory */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
              Add staff
            </div>
            <input className="field-input" style={{ marginBottom: 12 }} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search the client staff directory by name, email or role…" />
            {query.trim() === "" ? (
              <p className="muted-cell" style={{ fontSize: 12 }}>Search for an onboarded staff member, then grant them access and a role.</p>
            ) : searchResults.length === 0 ? (
              <div className="empty-state">No matching staff without access for “{query}”.</div>
            ) : searchResults.map(u => (
              <StaffAccessRow key={u.id} user={u} onSetClitAccess={onSetClitAccess} defaultOn />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StaffAccessRow({ user, onSetClitAccess, defaultOn }: { user: AppUser; onSetClitAccess: Props["onSetClitAccess"]; defaultOn?: boolean }) {
  const adminByDefault = isClientAdminRole(user.role as string);
  const [access, setAccess] = useState(!!user.clitAccess || adminByDefault || !!defaultOn);
  const [role, setRole] = useState<string>(user.clitRole || (adminByDefault ? "clit_admin" : "technician"));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty = access !== (!!user.clitAccess) || (access && role !== (user.clitRole || ""));

  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      await onSetClitAccess(user.id, access, role);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  };

  return (
    <div className="admin-row">
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 14 }}>{user.name}</div>
        <div className="muted-cell" style={{ fontSize: 11.5 }}>{user.email} · {user.role}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {adminByDefault && <span className="chip-role">Admin → CLIT Admin</span>}
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: adminByDefault ? "not-allowed" : "pointer", fontSize: 12, color: "var(--muted)" }}>
          <input type="checkbox" checked={access} disabled={adminByDefault} onChange={e => setAccess(e.target.checked)} style={{ accentColor: "var(--amber)", width: 16, height: 16 }} />
          Access
        </label>
        {access && !adminByDefault && (
          <select className="inline-select" style={{ width: "auto" }} value={role} onChange={e => setRole(e.target.value)}>
            {ALL_CLIT_ROLES.map(r => <option key={r} value={r} title={CLIT_ROLE_BLURB[r]}>{CLIT_ROLE_LABELS[r]}</option>)}
          </select>
        )}
        {!adminByDefault && (
          <button className="btn-primary" style={{ padding: "7px 14px", fontSize: 12, opacity: dirty ? 1 : 0.5 }} disabled={!dirty || saving} onClick={save}>
            {saving ? "…" : saved ? "Saved" : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}
