/**
 * KotKiosk — the shared-tablet entry reached by the printed QR at an outlet.
 *
 * Flow: QR → /kot?c=<clientId> → pick outlet → enter access code → in.
 * The QR carries the address (client); the code is the secret, entered
 * separately. On success we remember the device (localStorage) so the code is
 * asked once per tablet; rotating the code in KOT admin invalidates it.
 *
 * A device can unlock SEVERAL outlets — each is asked for its code once, then
 * kept. The app then shows an "All Outlets" board plus one pill per unlocked
 * outlet, and "+ Add outlet" comes back here to unlock another. A separate
 * MANAGER passcode (client-level) signs the device in across every outlet with
 * the order Report + manage.
 *
 * This renders OUTSIDE Horae's authed shell (mounted by the /kot short-circuit in
 * App.tsx), so the floor never touches a Horae login.
 */
import { useEffect, useState } from "react";
import KotApp, { type KotViewer } from "./KotApp";
import {
  listStationOutlets, authenticateStation, revalidateStation,
  authenticateManager, revalidateManager, type KotOutlet,
} from "./services/kotStore";
import { KotButton, KotCard, KotSpinner, cn } from "./ui/primitives";

const SESSION_KEY = "kot_station_session";

interface StoredOutlet {
  stationId: string;
  tenantId: string;
  clientId: string;
  outletLabel: string;
  codeHash: string;
}
interface StoredManager { clientId: string; codeHash: string; }
interface KioskState { outlets: StoredOutlet[]; manager?: StoredManager | null; }

function loadState(): KioskState {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return { outlets: [], manager: null };
    const parsed = JSON.parse(raw);
    // Back-compat: the old shape was a single StoredOutlet object.
    if (parsed && parsed.stationId && parsed.tenantId) return { outlets: [parsed], manager: null };
    return { outlets: Array.isArray(parsed.outlets) ? parsed.outlets : [], manager: parsed.manager ?? null };
  } catch { return { outlets: [], manager: null }; }
}
function saveState(s: KioskState) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* private mode */ }
}
function clearState() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

export default function KotKiosk() {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get("c") || "";
  // Optional outlet hint from a per-outlet QR (…/kot?c=<client>&t=<tenant>) — it
  // just pre-selects the picker; the access code is still required.
  const tenantHint = params.get("t") || "";

  const [checking, setChecking] = useState(true);
  const [state, setState] = useState<KioskState>({ outlets: [], manager: null });
  const [outlets, setOutlets] = useState<KotOutlet[]>([]);
  const [outletsLoaded, setOutletsLoaded] = useState(false);

  // Sign-in card state.
  const [signingIn, setSigningIn] = useState(false); // shown when adding another outlet from inside the app
  const [managerMode, setManagerMode] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signedIn = state.outlets.length > 0 || !!state.manager;

  // Restore the remembered device: revalidate each outlet (active + code not
  // rotated) and the manager passcode, dropping anything that's been revoked.
  useEffect(() => {
    (async () => {
      const stored = loadState();
      const outletsOk: StoredOutlet[] = [];
      for (const o of stored.outlets) {
        if (await revalidateStation(o.stationId, o.codeHash)) outletsOk.push(o);
      }
      let manager = stored.manager || null;
      if (manager && !(await revalidateManager(manager.clientId, manager.codeHash))) manager = null;
      const next = { outlets: outletsOk, manager };
      setState(next);
      saveState(next);
      // If this QR points at a specific outlet the device hasn't unlocked yet,
      // open the add-outlet sign-in for THAT outlet — instead of silently showing
      // an already-unlocked one. (Managers already see every outlet, so skip.)
      if (
        tenantHint && !manager && next.outlets.length > 0 &&
        !next.outlets.some((o) => o.tenantId === tenantHint)
      ) {
        setSigningIn(true);
      }
      setChecking(false);
    })();
  }, []);

  // Outlet list for the picker.
  useEffect(() => {
    if (!clientId) return;
    listStationOutlets(clientId)
      .then(setOutlets)
      .catch(() => setOutlets([]))
      .finally(() => setOutletsLoaded(true));
  }, [clientId]);

  useEffect(() => {
    if (!tenantId && outlets.length) {
      const hinted = tenantHint && outlets.some((o) => o.id === tenantHint) ? tenantHint : outlets[0].id;
      setTenantId(hinted);
    }
  }, [outlets, tenantId, tenantHint]);

  async function addOutlet() {
    if (!tenantId) { setError("Choose an outlet."); return; }
    setBusy(true); setError(null);
    try {
      const auth = await authenticateStation(tenantId, code.trim());
      if (!auth) { setError("Wrong or disabled code. Ask your manager."); setBusy(false); return; }
      const outletLabel = outlets.find((o) => o.id === tenantId)?.name || auth.label || "Outlet";
      const entry: StoredOutlet = { stationId: auth.id, tenantId: auth.tenantId, clientId: auth.clientId, outletLabel, codeHash: auth.codeHash };
      // Replace any prior unlock of the same outlet (e.g. after a code rotation).
      const next: KioskState = {
        ...state,
        outlets: [...state.outlets.filter((o) => o.tenantId !== entry.tenantId), entry],
      };
      setState(next); saveState(next);
      setCode(""); setSigningIn(false); setBusy(false);
    } catch (e: any) {
      setError("Sign-in failed — " + String(e?.message || e));
      setBusy(false);
    }
  }

  async function signInManager() {
    setBusy(true); setError(null);
    try {
      const codeHash = await authenticateManager(clientId, code.trim());
      if (!codeHash) { setError("Wrong manager passcode, or none set yet."); setBusy(false); return; }
      const next: KioskState = { ...state, manager: { clientId, codeHash } };
      setState(next); saveState(next);
      setCode(""); setSigningIn(false); setManagerMode(false); setBusy(false);
    } catch (e: any) {
      setError("Sign-in failed — " + String(e?.message || e));
      setBusy(false);
    }
  }

  function signOut() {
    clearState();
    setState({ outlets: [], manager: null });
    setCode(""); setSigningIn(false); setManagerMode(false);
  }

  // ── Signed in → the app ───────────────────────────────────────────────────
  // The sign-in card also shows mid-session when "+ Add outlet" is tapped.
  if (signedIn && !signingIn) {
    let viewer: KotViewer;
    if (state.manager) {
      // Manager passcode: every outlet, Report + manage, read across the client.
      viewer = {
        clientId,
        mode: "kiosk",
        tenantId: outlets[0]?.id || "",
        tenantLabel: "All Outlets",
        canManage: true,
        canDelete: true,
        canReport: true,
        coveredOutlets: outlets,
        seesAllClient: true,
        actor: { name: "Manager" },
      };
    } else {
      const covered: KotOutlet[] = state.outlets.map((o) => ({ id: o.tenantId, name: o.outletLabel }));
      const stationByTenant = Object.fromEntries(state.outlets.map((o) => [o.tenantId, o.stationId]));
      viewer = {
        clientId: state.outlets[0].clientId,
        mode: "kiosk",
        tenantId: state.outlets[0].tenantId,
        tenantLabel: state.outlets[0].outletLabel,
        canManage: false,
        coveredOutlets: covered,
        seesAllClient: false,
        stationByTenant,
        actor: { stationId: state.outlets[0].stationId, name: state.outlets[0].outletLabel },
      };
    }
    return (
      <KotApp
        viewer={viewer}
        onExit={signOut}
        onAddOutlet={state.manager ? undefined : () => { setSigningIn(true); setManagerMode(false); setCode(""); setError(null); }}
      />
    );
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

  const alreadyUnlocked = new Set(state.outlets.map((o) => o.tenantId));

  // ── Sign-in card ──────────────────────────────────────────────────────────
  return (
    <Centered>
      <KotCard className="w-full max-w-sm p-6">
        <p className="text-center text-2xl">🎂</p>
        <h1 className="mt-1 text-center text-lg font-bold text-slate-900">Cake Order Tracking</h1>
        <p className="mb-4 text-center text-xs text-slate-500">
          {managerMode
            ? "Enter the manager passcode for cross-outlet access."
            : signingIn ? "Add another outlet — select it and enter its code." : "Select your outlet and enter the access code."}
        </p>

        {!managerMode && (
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Outlet</span>
            <select className={inp} value={tenantId} onChange={(e) => setTenantId(e.target.value)} disabled={outlets.length === 0}>
              {outlets.length === 0 && <option value="">{outletsLoaded ? "No station set up yet — ask your manager" : "Loading…"}</option>}
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.name}{alreadyUnlocked.has(o.id) ? " ✓ added" : ""}</option>
              ))}
            </select>
          </label>
        )}

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">{managerMode ? "Manager passcode" : "Access code"}</span>
          <input
            className={inp}
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (managerMode ? signInManager() : addOutlet())}
            placeholder={managerMode ? "Manager passcode" : "Enter code"}
            autoFocus
          />
        </label>

        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-600">{error}</p>}

        <KotButton className="w-full" disabled={busy} onClick={managerMode ? signInManager : addOutlet}>
          {busy ? "Checking…" : managerMode ? "Sign in as manager" : signingIn ? "Add outlet" : "Open"}
        </KotButton>

        {/* Toggle between outlet sign-in and manager passcode. */}
        <button
          onClick={() => { setManagerMode((m) => !m); setCode(""); setError(null); }}
          className="mt-3 block w-full text-center text-xs font-semibold text-rose-600 hover:underline"
        >
          {managerMode ? "← Outlet sign-in" : "Manager passcode →"}
        </button>

        {/* Let the user back out of "add outlet" without losing the session. */}
        {signingIn && signedIn && (
          <button onClick={() => { setSigningIn(false); setManagerMode(false); setCode(""); setError(null); }}
            className="mt-2 block w-full text-center text-xs text-slate-500 hover:underline">
            Back to orders
          </button>
        )}

        <p className="mt-3 text-center text-[11px] text-slate-400">This tablet stays signed in until the code is rotated.</p>
      </KotCard>
    </Centered>
  );
}

const inp = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-400";

function Centered({ children }: { children: React.ReactNode }) {
  return <div className={cn("flex min-h-screen items-center justify-center bg-slate-50 p-4")}>{children}</div>;
}
