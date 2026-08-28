/**
 * KotKiosk — the shared-tablet entry reached by the printed QR at an outlet.
 *
 * Flow: QR → /kot?c=<clientId> → pick outlet → enter access code → in.
 * The QR carries the address (client); the code is the secret, entered
 * separately. On success we remember the device (localStorage) so the code is
 * asked once per tablet; rotating the code in KOT admin invalidates it.
 *
 * This renders OUTSIDE Horae's authed shell (mounted by the /kot short-circuit in
 * App.tsx), so the floor never touches a Horae login.
 */
import { useEffect, useState } from "react";
import KotApp, { type KotViewer } from "./KotApp";
import {
  listOutlets, authenticateStation, revalidateStation, type KotOutlet,
} from "./services/kotStore";
import { KotButton, KotCard, KotSpinner, cn } from "./ui/primitives";

const SESSION_KEY = "kot_station_session";

interface StoredSession {
  stationId: string;
  tenantId: string;
  clientId: string;
  outletLabel: string;
  codeHash: string;
}

function loadSession(): StoredSession | null {
  try { const s = localStorage.getItem(SESSION_KEY); return s ? JSON.parse(s) : null; }
  catch { return null; }
}
function saveSession(s: StoredSession) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* private mode */ }
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

export default function KotKiosk() {
  const clientId = new URLSearchParams(window.location.search).get("c") || "";

  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [outlets, setOutlets] = useState<KotOutlet[]>([]);
  const [outletsLoaded, setOutletsLoaded] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Restore a remembered device (revalidate against current code + active flag).
  useEffect(() => {
    (async () => {
      const stored = loadSession();
      if (stored && await revalidateStation(stored.stationId, stored.codeHash)) {
        setSession(stored);
      } else if (stored) {
        clearSession();
      }
      setChecking(false);
    })();
  }, []);

  // Outlet list for the picker.
  useEffect(() => {
    if (!clientId) return;
    listOutlets(clientId)
      .then(setOutlets)
      .catch(() => setOutlets([]))
      .finally(() => setOutletsLoaded(true));
  }, [clientId]);

  useEffect(() => {
    if (!tenantId && outlets.length) setTenantId(outlets[0].id);
  }, [outlets, tenantId]);

  async function signIn() {
    if (!tenantId) { setError("Choose an outlet."); return; }
    setBusy(true); setError(null);
    try {
      const auth = await authenticateStation(tenantId, code.trim());
      if (!auth) { setError("Wrong or disabled code. Ask your manager."); setBusy(false); return; }
      const outletLabel = outlets.find((o) => o.id === tenantId)?.name || auth.label || "Outlet";
      const s: StoredSession = { stationId: auth.id, tenantId: auth.tenantId, clientId: auth.clientId, outletLabel, codeHash: auth.codeHash };
      saveSession(s);
      setSession(s);
      setCode("");
    } catch (e: any) {
      setError("Sign-in failed — " + String(e?.message || e));
      setBusy(false);
    }
  }

  function signOut() {
    clearSession();
    setSession(null);
    setCode("");
  }

  // ── Signed in → the app ───────────────────────────────────────────────────
  if (session) {
    const viewer: KotViewer = {
      clientId: session.clientId,
      mode: "kiosk",
      tenantId: session.tenantId,
      tenantLabel: session.outletLabel,
      canManage: false,
      actor: { stationId: session.stationId, name: session.outletLabel },
    };
    return <KotApp viewer={viewer} onExit={signOut} />;
  }

  if (checking) {
    return <Centered><KotSpinner className="h-8 w-8" /></Centered>;
  }

  if (!clientId) {
    return (
      <Centered>
        <KotCard className="max-w-sm p-6 text-center">
          <p className="text-3xl">🎂</p>
          <p className="mt-2 text-base font-bold text-slate-800">Invalid KOT link</p>
          <p className="mt-1 text-sm text-slate-500">Scan the QR code provided at your outlet to open cake-order tracking.</p>
        </KotCard>
      </Centered>
    );
  }

  // ── Sign-in card ──────────────────────────────────────────────────────────
  return (
    <Centered>
      <KotCard className="w-full max-w-sm p-6">
        <p className="text-center text-2xl">🎂</p>
        <h1 className="mt-1 text-center text-lg font-bold text-slate-900">Cake Order Tracking</h1>
        <p className="mb-4 text-center text-xs text-slate-500">Select your outlet and enter the access code.</p>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Outlet</span>
          <select className={inp} value={tenantId} onChange={(e) => setTenantId(e.target.value)} disabled={outlets.length === 0}>
            {outlets.length === 0 && <option value="">{outletsLoaded ? "No outlets for this link" : "Loading…"}</option>}
            {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Access code</span>
          <input
            className={inp}
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && signIn()}
            placeholder="Enter code"
            autoFocus
          />
        </label>

        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-600">{error}</p>}

        <KotButton className="w-full" disabled={busy} onClick={signIn}>
          {busy ? "Checking…" : "Open"}
        </KotButton>
        <p className="mt-3 text-center text-[11px] text-slate-400">This tablet will stay signed in until the code is rotated.</p>
      </KotCard>
    </Centered>
  );
}

const inp = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-400";

function Centered({ children }: { children: React.ReactNode }) {
  return <div className={cn("flex min-h-screen items-center justify-center bg-slate-50 p-4")}>{children}</div>;
}
