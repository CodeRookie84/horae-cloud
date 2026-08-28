/**
 * KotAdmin — the People Directory + station (QR + code) management.
 *
 * Lives INSIDE the KOT module (reached via KotApp's "Manage" button for
 * managers), NOT in Horae's ClientAdminPanel — so the whole feature, admin
 * included, stays a folder-delete away from removal (isolation contract).
 */
import { useEffect, useMemo, useState } from "react";
import type { KotParticipant, KotStation, KotTeam } from "../types";
import {
  listParticipants, listOutlets, listStations,
  createParticipant, updateParticipant, deleteParticipant,
  createStation, rotateStationCode, setStationActive,
  type KotOutlet,
} from "../services/kotStore";
import { KotButton, KotCard, KotSpinner, cn } from "../ui/primitives";

const TEAMS: KotTeam[] = ["Outlet", "Kitchen", "Management"];

export default function KotAdmin({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const [tab, setTab] = useState<"people" | "stations">("people");
  const [outlets, setOutlets] = useState<KotOutlet[]>([]);
  const [participants, setParticipants] = useState<KotParticipant[]>([]);
  const [stations, setStations] = useState<Array<KotStation & { tenantName?: string }>>([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    const [o, p, s] = await Promise.all([
      listOutlets(clientId), listParticipants(clientId), listStations(clientId),
    ]);
    setOutlets(o); setParticipants(p); setStations(s); setLoading(false);
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [clientId]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-lg font-bold text-slate-900">KOT setup</h2>
        <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">✕</button>
      </div>

      <div className="flex gap-2 border-b border-slate-100 px-4 py-2">
        {(["people", "stations"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("rounded-full px-3 py-1.5 text-sm font-medium capitalize",
              tab === t ? "bg-rose-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
            {t === "people" ? "People" : "Stations (QR)"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-lg">
          {loading ? (
            <div className="flex justify-center py-20"><KotSpinner className="h-8 w-8" /></div>
          ) : outlets.length === 0 ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
              No outlets found for this client. Add outlets in Horae's client admin first — KOT reuses them.
            </p>
          ) : tab === "people" ? (
            <PeoplePanel clientId={clientId} outlets={outlets} participants={participants} onChange={reload} />
          ) : (
            <StationsPanel clientId={clientId} outlets={outlets} stations={stations} onChange={reload} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── People ──────────────────────────────────────────────────────────────────

function PeoplePanel(
  { clientId, outlets, participants, onChange }:
  { clientId: string; outlets: KotOutlet[]; participants: KotParticipant[]; onChange: () => void },
) {
  const [editing, setEditing] = useState<KotParticipant | "new" | null>(null);
  const byTeam = useMemo(() => {
    const g: Record<string, KotParticipant[]> = { Outlet: [], Kitchen: [], Management: [] };
    for (const p of participants) (g[p.team] ||= []).push(p);
    return g;
  }, [participants]);
  const outletName = (id: string) => outlets.find((o) => o.id === id)?.name || id;

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <KotButton onClick={() => setEditing("new")}>+ Add person</KotButton>
      </div>

      {participants.length === 0 && (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">No people yet. Add the Outlet, Kitchen and Management staff who handle cake orders.</p>
      )}

      {TEAMS.map((team) => byTeam[team]?.length ? (
        <div key={team} className="mb-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{team}</p>
          <div className="space-y-2">
            {byTeam[team].map((p) => (
              <KotCard key={p.id} className="flex items-center justify-between p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{p.name}{!p.active && <span className="ml-2 text-xs text-slate-400">(inactive)</span>}</p>
                  <p className="truncate text-xs text-slate-500">{p.phone || "no phone"}</p>
                  <p className="truncate text-[11px] text-slate-400">
                    {p.outletIds.length === outlets.length ? "All outlets" : p.outletIds.map(outletName).join(", ") || "no outlet"}
                  </p>
                </div>
                <button className="text-sm font-semibold text-rose-600" onClick={() => setEditing(p)}>Edit</button>
              </KotCard>
            ))}
          </div>
        </div>
      ) : null)}

      {editing && (
        <ParticipantEditor
          clientId={clientId}
          outlets={outlets}
          participant={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChange(); }}
        />
      )}
    </div>
  );
}

function ParticipantEditor(
  { clientId, outlets, participant, onClose, onSaved }:
  { clientId: string; outlets: KotOutlet[]; participant: KotParticipant | null; onClose: () => void; onSaved: () => void },
) {
  const [name, setName] = useState(participant?.name ?? "");
  const [phone, setPhone] = useState(participant?.phone ?? "");
  const [team, setTeam] = useState<KotTeam>(participant?.team ?? "Outlet");
  const [active, setActive] = useState(participant?.active ?? true);
  const [outletIds, setOutletIds] = useState<Set<string>>(new Set(participant?.outletIds ?? []));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleOutlet(id: string) {
    setOutletIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function save() {
    if (!name.trim()) { setErr("Name is required."); return; }
    setBusy(true); setErr(null);
    try {
      const payload = { name: name.trim(), phone: phone.trim(), team, outletIds: Array.from(outletIds) };
      if (participant) await updateParticipant(participant.id, { ...payload, active });
      else await createParticipant({ clientId, ...payload });
      onSaved();
    } catch (e: any) {
      setErr("Save failed — " + String(e?.message || e)); setBusy(false);
    }
  }

  async function remove() {
    if (!participant) return;
    setBusy(true);
    try { await deleteParticipant(participant.id); onSaved(); }
    catch (e: any) { setErr("Delete failed — " + String(e?.message || e)); setBusy(false); }
  }

  return (
    <Modal title={participant ? "Edit person" : "Add person"} onClose={onClose}>
      {err && <p className="mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600">{err}</p>}
      <Labeled label="Name"><input className={inp} value={name} onChange={(e) => setName(e.target.value)} /></Labeled>
      <Labeled label="Phone (for WhatsApp reminders)"><input className={inp} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" /></Labeled>
      <Labeled label="Team">
        <div className="flex gap-2">
          {TEAMS.map((t) => (
            <button key={t} onClick={() => setTeam(t)}
              className={cn("flex-1 rounded-xl border px-3 py-2 text-sm", team === t ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-600")}>
              {t}
            </button>
          ))}
        </div>
      </Labeled>
      <Labeled label="Outlets covered">
        <div className="mb-1.5 flex gap-2 text-xs">
          <button className="text-rose-600" onClick={() => setOutletIds(new Set(outlets.map((o) => o.id)))}>All</button>
          <button className="text-slate-500" onClick={() => setOutletIds(new Set())}>None</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {outlets.map((o) => {
            const on = outletIds.has(o.id);
            return (
              <button key={o.id} onClick={() => toggleOutlet(o.id)}
                className={cn("rounded-full border px-2.5 py-1 text-xs", on ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-500")}>
                {on ? "✓ " : ""}{o.name}
              </button>
            );
          })}
        </div>
      </Labeled>
      {participant && (
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
        </label>
      )}
      <div className="mt-4 flex items-center justify-between">
        {participant ? (
          <button className="text-sm font-semibold text-red-600" disabled={busy} onClick={remove}>Delete</button>
        ) : <span />}
        <KotButton onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</KotButton>
      </div>
    </Modal>
  );
}

// ── Stations ──────────────────────────────────────────────────────────────────

function StationsPanel(
  { clientId, outlets, stations, onChange }:
  { clientId: string; outlets: KotOutlet[]; stations: Array<KotStation & { tenantName?: string }>; onChange: () => void },
) {
  const [adding, setAdding] = useState(false);

  async function rotate(s: KotStation) {
    const code = window.prompt(`New access code for "${s.label || s.tenantId}":`);
    if (!code) return;
    await rotateStationCode(s.id, code.trim());
    onChange();
  }

  return (
    <div>
      <p className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Each station is a shared tablet login for one outlet. Print its QR at the counter; staff enter the access code once per device. Rotate the code to revoke access.
      </p>
      <div className="mb-3 flex justify-end">
        <KotButton onClick={() => setAdding(true)}>+ Add station</KotButton>
      </div>

      {stations.length === 0 && (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">No stations yet.</p>
      )}
      <div className="space-y-2">
        {stations.map((s) => (
          <KotCard key={s.id} className="flex items-center justify-between p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">{s.label || "Station"}{!s.active && <span className="ml-2 text-xs text-slate-400">(disabled)</span>}</p>
              <p className="truncate text-xs text-slate-500">{s.tenantName || s.tenantId}</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="text-sm font-semibold text-rose-600" onClick={() => rotate(s)}>Rotate code</button>
              <button className="text-sm text-slate-500" onClick={async () => { await setStationActive(s.id, !s.active); onChange(); }}>
                {s.active ? "Disable" : "Enable"}
              </button>
            </div>
          </KotCard>
        ))}
      </div>

      {adding && (
        <StationEditor clientId={clientId} outlets={outlets} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); onChange(); }} />
      )}
    </div>
  );
}

function StationEditor(
  { clientId, outlets, onClose, onSaved }:
  { clientId: string; outlets: KotOutlet[]; onClose: () => void; onSaved: () => void },
) {
  const [tenantId, setTenantId] = useState(outlets[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!tenantId) { setErr("Pick an outlet."); return; }
    if (code.trim().length < 4) { setErr("Use a code of at least 4 characters."); return; }
    setBusy(true); setErr(null);
    try {
      await createStation({ clientId, tenantId, label: label.trim() || (outlets.find((o) => o.id === tenantId)?.name ?? "Station"), code: code.trim() });
      onSaved();
    } catch (e: any) { setErr("Save failed — " + String(e?.message || e)); setBusy(false); }
  }

  return (
    <Modal title="Add station" onClose={onClose}>
      {err && <p className="mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600">{err}</p>}
      <Labeled label="Outlet">
        <select className={inp} value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
          {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </Labeled>
      <Labeled label="Station label (optional)"><input className={inp} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. JP Nagar counter" /></Labeled>
      <Labeled label="Access code"><input className={inp} value={code} onChange={(e) => setCode(e.target.value)} placeholder="min 4 characters" /></Labeled>
      <div className="mt-4 flex justify-end">
        <KotButton onClick={save} disabled={busy}>{busy ? "Saving…" : "Create station"}</KotButton>
      </div>
    </Modal>
  );
}

// ── Shared bits ────────────────────────────────────────────────────────────────

const inp = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-400";

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
