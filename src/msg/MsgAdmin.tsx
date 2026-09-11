/**
 * MsgAdmin — the backend management surface for the WhatsApp `/msg` translation
 * feature. Reached via the "Translate" launcher icon (admins of msg-enabled
 * clients only). Lives INSIDE the MSG module, NOT in Horae's ClientAdminPanel, so
 * the whole feature stays a folder-delete away from removal (isolation contract,
 * mirrors src/kot/screens/KotAdmin.tsx).
 *
 * Onboarded people are a phone-based directory that is INDEPENDENT of Horae's
 * staff `users` table — adding someone here does not create or touch a login.
 * Each person picks their own 5 languages on first `/msg` use; the admin can view
 * or override that set here (or reset it so the person re-picks).
 */
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

// Duplicated for isolation (kept in sync with the same list in msg.ts).
interface Lang { code: string; name: string; native: string; }
const LANGS: Lang[] = [
  { code: "en", name: "English", native: "English" }, { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ" }, { code: "ta", name: "Tamil", native: "தமிழ்" },
  { code: "te", name: "Telugu", native: "తెలుగు" }, { code: "ml", name: "Malayalam", native: "മലയാളം" },
  { code: "mr", name: "Marathi", native: "मराठी" }, { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી" }, { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "or", name: "Odia", native: "ଓଡ଼ିଆ" }, { code: "ur", name: "Urdu", native: "اردو" },
  { code: "ar", name: "Arabic", native: "العربية" }, { code: "ne", name: "Nepali", native: "नेपाली" },
  { code: "si", name: "Sinhala", native: "සිංහල" }, { code: "fa", name: "Persian", native: "فارسی" },
  { code: "zh-CN", name: "Chinese", native: "中文" }, { code: "ja", name: "Japanese", native: "日本語" },
  { code: "ko", name: "Korean", native: "한국어" }, { code: "es", name: "Spanish", native: "Español" },
  { code: "fr", name: "French", native: "Français" }, { code: "de", name: "German", native: "Deutsch" },
  { code: "pt", name: "Portuguese", native: "Português" }, { code: "ru", name: "Russian", native: "Русский" },
  { code: "it", name: "Italian", native: "Italiano" }, { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "id", name: "Indonesian", native: "Indonesia" }, { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
  { code: "th", name: "Thai", native: "ไทย" }, { code: "sw", name: "Swahili", native: "Kiswahili" },
  { code: "nl", name: "Dutch", native: "Nederlands" }, { code: "pl", name: "Polish", native: "Polski" },
  { code: "uk", name: "Ukrainian", native: "Українська" }, { code: "iw", name: "Hebrew", native: "עברית" },
  { code: "el", name: "Greek", native: "Ελληνικά" },
];
const LANG_BY_CODE = new Map(LANGS.map((l) => [l.code, l]));
const langLabel = (c: string) => { const l = LANG_BY_CODE.get(c); return l ? `${l.native} (${l.name})` : c; };

interface MsgParticipant { id: string; name: string; phone: string; languages: string[]; active: boolean; }

function cn(...parts: Array<string | false | null | undefined>): string { return parts.filter(Boolean).join(" "); }
const inp = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400";

export default function MsgAdmin({ clientId }: { clientId: string }) {
  const [participants, setParticipants] = useState<MsgParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MsgParticipant | "new" | null>(null);

  async function reload() {
    // Only the admin-onboarded external directory — staff rows (source='staff',
    // auto-created for Horae users) are managed automatically and never shown here.
    const { data } = await supabase.from("msg_participants")
      .select("id, name, phone, languages, active")
      .eq("client_id", clientId).eq("source", "onboarded").order("created_at");
    setParticipants((data || []).map((p: any) => ({ ...p, languages: Array.isArray(p.languages) ? p.languages : [] })));
    setLoading(false);
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [clientId]);

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xl">🌐</span>
        <h2 className="text-lg font-bold text-slate-900">Translate — WhatsApp setup</h2>
      </div>
      <p className="mb-4 rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
        All Horae staff already have the <b>/msg</b> WhatsApp translator by default — you don't add
        them here. Use this list only to give it to <b>extra phone numbers outside your staff</b>
        (adding someone here does not create a Horae login). Everyone picks their own 5 languages
        the first time they send <b>msg</b>; you can view or reset a person's set below.
      </p>

      <div className="mb-3 flex justify-end">
        <button onClick={() => setEditing("new")}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
          + Add person
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
      ) : participants.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">No one added yet.</p>
      ) : (
        <div className="space-y-2">
          {participants.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {p.name || "(no name)"}{!p.active && <span className="ml-2 text-xs text-slate-400">(inactive)</span>}
                </p>
                <p className="truncate text-xs text-slate-500">{p.phone || "no phone"}</p>
                <p className="truncate text-[11px] text-slate-400">
                  {p.languages.length ? p.languages.map(langLabel).join(", ") : "languages not set yet"}
                </p>
              </div>
              <button className="shrink-0 text-sm font-semibold text-indigo-600" onClick={() => setEditing(p)}>Edit</button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ParticipantEditor
          clientId={clientId}
          participant={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}

function ParticipantEditor(
  { clientId, participant, onClose, onSaved }:
  { clientId: string; participant: MsgParticipant | null; onClose: () => void; onSaved: () => void },
) {
  const [name, setName] = useState(participant?.name ?? "");
  const [phone, setPhone] = useState(participant?.phone ?? "");
  const [active, setActive] = useState(participant?.active ?? true);
  const [langs, setLangs] = useState<Set<string>>(new Set(participant?.languages ?? []));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleLang(code: string) {
    setLangs((s) => {
      const n = new Set(s);
      if (n.has(code)) n.delete(code);
      else if (n.size < 5) n.add(code);
      return n;
    });
  }

  async function save() {
    if (!phone.replace(/\D/g, "")) { setErr("A phone number is required."); return; }
    setBusy(true); setErr(null);
    const languages = Array.from(langs);
    try {
      if (participant) {
        await supabase.from("msg_participants")
          .update({ name: name.trim(), phone: phone.trim(), languages, active }).eq("id", participant.id);
      } else {
        await supabase.from("msg_participants").insert([{
          id: (crypto as any).randomUUID?.() || `msg-${Date.now()}`,
          client_id: clientId, source: "onboarded", name: name.trim(), phone: phone.trim(), languages, active: true,
        }]);
      }
      onSaved();
    } catch (e: any) { setErr("Save failed — " + String(e?.message || e)); setBusy(false); }
  }

  async function remove() {
    if (!participant) return;
    setBusy(true);
    try { await supabase.from("msg_participants").delete().eq("id", participant.id); onSaved(); }
    catch (e: any) { setErr("Delete failed — " + String(e?.message || e)); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">{participant ? "Edit person" : "Add person"}</h3>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">✕</button>
        </div>

        {err && <p className="mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600">{err}</p>}

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Name (optional)</span>
          <input className={inp} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">WhatsApp phone</span>
          <input className={inp} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" />
        </label>

        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Languages ({langs.size}/5)</span>
            <button className="text-xs text-slate-500" onClick={() => setLangs(new Set())}>Reset</button>
          </div>
          <p className="mb-1.5 text-[11px] text-slate-400">
            Leave empty to let the person pick their own 5 on first use. Pick up to 5 to preset them.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {LANGS.map((l) => {
              const on = langs.has(l.code);
              const disabled = !on && langs.size >= 5;
              return (
                <button key={l.code} onClick={() => toggleLang(l.code)} disabled={disabled}
                  className={cn("rounded-full border px-2.5 py-1 text-xs",
                    on ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                       : disabled ? "border-slate-100 text-slate-300"
                       : "border-slate-200 text-slate-500")}>
                  {on ? "✓ " : ""}{l.native}
                </button>
              );
            })}
          </div>
        </div>

        {participant && (
          <label className="mt-1 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
          </label>
        )}

        <div className="mt-4 flex items-center justify-between">
          {participant ? (
            <button className="text-sm font-semibold text-red-600" disabled={busy} onClick={remove}>Delete</button>
          ) : <span />}
          <button onClick={save} disabled={busy}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-70">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
