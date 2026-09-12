// [MSG] ───────────────────────────────────────────────────────────────────────
// Self-help WhatsApp TRANSLATION flow (`/msg`).
//
// An onboarded person (matched by phone against msg_participants of a msg-enabled
// client — a directory that is INDEPENDENT of Horae's staff `users` table) can
// translate text/voice between the 5 languages they picked:
//   /msg (or msg / ?msg)  → first time: pick your 5 languages; after that: the
//                           "input > outputs" prompt
//   e.g. "1 > 2 3"        → translate FROM language 1 INTO languages 2 and 3
//   then type or speak    → each output language comes back as its OWN clean
//                           standalone message (long-press → Copy / Forward), so
//                           it pastes straight into any WhatsApp group.
// Romanized input (e.g. Kannada typed in English letters) is transliterated to
// the selected input language's native script BEFORE translating. Output is
// always the target language's native script, never romanized.
//
// ISOLATION: this file is fully self-contained — its own Supabase client, its own
// WhatsApp send helpers, its own translate/transliterate calls (all keyless
// Google endpoints, duplicated, never imported from Horae). The single shared
// dependency is transcribeAudio (the shared AI helper), used only for voice.
// Anyone who isn't a msg participant falls straight through to normal Horae
// handling, so this keyword is invisible to everyone else. Remove MSG = delete
// this file + the `// [MSG]` seam in index.ts + the import.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { transcribeAudio } from "../_shared/ai.ts";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_WA_TOKEN     = Deno.env.get("META_WA_TOKEN")!;
const META_PHONE_NUM_ID = Deno.env.get("META_PHONE_NUMBER_ID")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

// ── Language catalogue ──────────────────────────────────────────────────────
// A curated slice of the Google Translate language list (ISO-639-1 codes as
// Google expects them — note Hebrew is "iw"). The user picks 5 of these on first
// use; the numbers below are only used to render the first-time picker.
interface Lang { code: string; name: string; native: string; }
const LANGS: Lang[] = [
  { code: "en",    name: "English",    native: "English" },
  { code: "hi",    name: "Hindi",      native: "हिन्दी" },
  { code: "kn",    name: "Kannada",    native: "ಕನ್ನಡ" },
  { code: "ta",    name: "Tamil",      native: "தமிழ்" },
  { code: "te",    name: "Telugu",     native: "తెలుగు" },
  { code: "ml",    name: "Malayalam",  native: "മലയാളം" },
  { code: "mr",    name: "Marathi",    native: "मराठी" },
  { code: "bn",    name: "Bengali",    native: "বাংলা" },
  { code: "gu",    name: "Gujarati",   native: "ગુજરાતી" },
  { code: "pa",    name: "Punjabi",    native: "ਪੰਜਾਬੀ" },
  { code: "or",    name: "Odia",       native: "ଓଡ଼ିଆ" },
  { code: "ur",    name: "Urdu",       native: "اردو" },
  { code: "ar",    name: "Arabic",     native: "العربية" },
  { code: "ne",    name: "Nepali",     native: "नेपाली" },
  { code: "si",    name: "Sinhala",    native: "සිංහල" },
  { code: "fa",    name: "Persian",    native: "فارسی" },
  { code: "zh-CN", name: "Chinese",    native: "中文" },
  { code: "ja",    name: "Japanese",   native: "日本語" },
  { code: "ko",    name: "Korean",     native: "한국어" },
  { code: "es",    name: "Spanish",    native: "Español" },
  { code: "fr",    name: "French",     native: "Français" },
  { code: "de",    name: "German",     native: "Deutsch" },
  { code: "pt",    name: "Portuguese", native: "Português" },
  { code: "ru",    name: "Russian",    native: "Русский" },
  { code: "it",    name: "Italian",    native: "Italiano" },
  { code: "tr",    name: "Turkish",    native: "Türkçe" },
  { code: "id",    name: "Indonesian", native: "Indonesia" },
  { code: "vi",    name: "Vietnamese", native: "Tiếng Việt" },
  { code: "th",    name: "Thai",       native: "ไทย" },
  { code: "sw",    name: "Swahili",    native: "Kiswahili" },
  { code: "nl",    name: "Dutch",      native: "Nederlands" },
  { code: "pl",    name: "Polish",     native: "Polski" },
  { code: "uk",    name: "Ukrainian",  native: "Українська" },
  { code: "iw",    name: "Hebrew",     native: "עברית" },
  { code: "el",    name: "Greek",      native: "Ελληνικά" },
];
const LANG_BY_CODE = new Map(LANGS.map((l) => [l.code, l]));
const langLabel = (code: string) => {
  const l = LANG_BY_CODE.get(code);
  return l ? `${l.native} (${l.name})` : code;
};

// Languages whose native script Google Input Tools can produce from romanized
// (Latin-letter) input. If a selected input language isn't here, we skip
// transliteration and translate the text as typed (best-effort, never blocks).
const TRANSLIT_SUPPORTED = new Set([
  "hi", "kn", "ta", "te", "ml", "mr", "bn", "gu", "pa", "or", "ur", "ar", "ne", "si", "fa", "el", "ru",
]);

// Any slash-prefixed message is a Horae command (/rem, /task, /menu, …). If one
// arrives while a translation session is open, we hand it straight back to
// index.ts for normal routing instead of translating it — so `/rem` lists your
// reminders. A leading backslash is accepted too (an earlier build taught `\`).
// Plain text (no slash) is still translated as before.
const HORAE_COMMAND = /^\s*[\/\\]/;

interface MsgWho { participantId: string; clientId: string | null; name: string; languages: string[]; }
interface MsgSession { phone_last10: string; state: string; input_lang: string | null; output_langs: string[]; }

/** Passed in by index.ts when the phone matched a registered Horae staff user.
 *  Staff get the translator by default (like reminders), so a `staff` context
 *  makes the sender eligible even without an onboarded msg_participants row. */
interface StaffCtx { userId: string; name?: string | null; }

// ── Public entry points (the only things index.ts calls) ────────────────────

/** Free text from a phone. Handles the `/msg` keyword AND any text while an
 *  active translation session is open. Returns false (not handled) when the
 *  sender isn't a msg participant, or when there's neither the keyword nor an
 *  open session — so normal Horae routing takes over. */
export async function routeMsgText(text: string, fromPhone: string, staff?: StaffCtx): Promise<boolean> {
  const isKeyword = /^\s*[\/?\\]?msg\b/i.test(text);
  const last10 = digits10(fromPhone);
  if (!last10) return false;
  const session = await getSession(last10);
  if (!isKeyword && !session) return false; // not ours

  const who = await resolveMsgParticipant(fromPhone, staff);
  if (!who) return false; // neither an onboarded phone nor staff → let Horae handle it

  // A slash-prefixed Horae command (/rem, /task, /menu, …) ALWAYS breaks out of an
  // open translation session, so the user can jump straight to reminders / tasks /
  // the menu without first closing the translator. (Bug: after translating, typing
  // plain *rem* was swallowed as text to translate — transliterated to gibberish —
  // instead of listing reminders; a command now needs the / prefix.) Only when a
  // session is already open (the *msg* / *\msg* keyword is handled below); we close
  // the session first, then return false so index.ts routes the message through
  // normal Horae handling.
  if (session && !isKeyword && HORAE_COMMAND.test(text)) {
    await clearSession(last10);
    return false;
  }

  // A bare cancel/close verb ends the session cleanly, at any point. (/menu /
  // /cancel and any other /command already handed off above; the ✖ Done button
  // closes too. "done"/"menu" are left out here so they're translated normally.)
  if (/^\s*(cancel|stop|back|exit)\b/i.test(text)) {
    await clearSession(last10);
    await sendText(fromPhone, "✅ Translation closed. Send */menu* for options, or *msg* to translate again.");
    return true;
  }

  // Re-pick the 5 languages from anywhere: "msg langs" / "msg reset", or a bare
  // "langs" / "reset" while a session is open. This is the escape hatch for a user
  // who saved the wrong 5 — before this, the only route back to the picker was the
  // "Edit my 5" button, which appears only AFTER a completed translation.
  const afterKeyword = text.replace(/^\s*[\/?\\]?msg\b/i, "").trim();
  if (/^(langs?|languages?|re-?pick|reset)\s*$/i.test(afterKeyword)) {
    await startLangPick(fromPhone, who, last10);
    return true;
  }

  // The keyword always (re)starts: pick languages the first time, else the
  // input→outputs prompt (keeping the 5 they already chose).
  if (isKeyword || !session) {
    if (who.languages.length < 2) { await startLangPick(fromPhone, who, last10); return true; }
    await startSelection(fromPhone, who, last10);
    return true;
  }

  switch (session.state) {
    case "pick_langs":      await handleLangPick(fromPhone, who, last10, text); return true;
    case "await_selection": await handleSelection(fromPhone, who, last10, text); return true;
    case "await_content":   await handleContent(fromPhone, who, session, text); return true;
    default:                await startSelection(fromPhone, who, last10); return true;
  }
}

/** A voice note. Only meaningful while the session is awaiting content; then we
 *  transcribe it and translate exactly like typed text. */
export async function routeMsgAudio(mediaId: string, fromPhone: string, staff?: StaffCtx): Promise<boolean> {
  const last10 = digits10(fromPhone);
  if (!last10) return false;
  const session = await getSession(last10);
  if (!session || session.state !== "await_content") return false;
  const who = await resolveMsgParticipant(fromPhone, staff);
  if (!who) return false;

  // Pin transcription to the language they chose as INPUT, so Whisper doesn't
  // auto-detect the wrong one (which produced Arabic for a clearly-English note).
  const transcript = await transcribeVoice(mediaId, session.input_lang);
  if (!transcript) { await sendText(fromPhone, "🎙️ I couldn't read that voice note. Please type the text instead."); return true; }
  await handleContent(fromPhone, who, session, transcript);
  return true;
}

/** An interactive button/list reply whose id starts with "msg". Returns false if
 *  it isn't ours (or the sender isn't a participant) so index.ts keeps routing. */
export async function routeMsgInteractive(id: string, fromPhone: string, staff?: StaffCtx): Promise<boolean> {
  if (!id.startsWith("msg_")) return false;
  const last10 = digits10(fromPhone);
  if (!last10) return false;
  const who = await resolveMsgParticipant(fromPhone, staff);
  if (!who) return false;

  if (id === "msg_change") { await startSelection(fromPhone, who, last10); return true; }
  if (id === "msg_relangs"){ await startLangPick(fromPhone, who, last10); return true; }
  if (id === "msg_done")   { await clearSession(last10); await sendText(fromPhone, "✅ Translation closed. Send *msg* any time to translate again."); return true; }
  return true;
}

// ── Participant resolution ───────────────────────────────────────────────────

/** Decide whether a phone may use the translator, and load its language store.
 *  Two eligible populations (digits compared on the last 10, like KOT's resolver):
 *   1. ONBOARDED — an active msg_participants row (source='onboarded') an admin
 *      added in the Translate panel (extra NON-staff phones).
 *   2. STAFF — any registered Horae staff user (index.ts passes `staff`), who get
 *      the translator by default (like reminders). Their language store is a
 *      msg_participants row with source='staff', auto-created on first use and
 *      hidden from the admin panel.
 *  There is no per-client entitlement — translation is a default feature. */
async function resolveMsgParticipant(fromPhone: string, staff?: StaffCtx): Promise<MsgWho | null> {
  const last10 = digits10(fromPhone);
  if (!last10) return null;

  const { data: parts } = await supabase
    .from("msg_participants").select("id, client_id, source, name, phone, languages").eq("active", true);
  const candidates = (parts || []).filter((p: any) =>
    String(p.phone || "").replace(/\D/g, "").endsWith(last10));
  const asWho = (r: any): MsgWho => ({
    participantId: r.id, clientId: r.client_id ?? null, name: r.name ?? "",
    languages: Array.isArray(r.languages) ? r.languages.filter((c: any) => typeof c === "string") : [],
  });

  // 1. An admin-onboarded external phone wins if present.
  const onboarded = candidates.find((c: any) => c.source !== "staff");
  if (onboarded) return asWho(onboarded);

  // 2. Staff: reuse an existing staff row, else auto-provision one (languages
  //    empty → they pick their 5 on first use, exactly like an onboarded user).
  if (staff?.userId) {
    const existing = candidates.find((c: any) => c.source === "staff");
    if (existing) return asWho(existing);
    const id = (globalThis.crypto as any)?.randomUUID?.() || `msg-${Date.now()}`;
    const row = { id, client_id: null, source: "staff", name: staff.name || "", phone: last10, languages: [] as string[], active: true };
    await supabase.from("msg_participants").insert([row]);
    return asWho(row);
  }

  return null;
}

// ── Screens / flow steps ─────────────────────────────────────────────────────

/** First-time (or "change languages"): show the full catalogue and ask for 5 numbers. */
async function startLangPick(fromPhone: string, who: MsgWho, last10: string) {
  await upsertSession(last10, who, { state: "pick_langs", input_lang: null, output_langs: [] });
  const first = (who.name || "there").split(" ")[0];
  const list = LANGS.map((l, i) => `${i + 1}. ${l.native} (${l.name})`).join("\n");
  await sendText(
    fromPhone,
    `🌐 *Translate* — hi ${first}!\n\nPick the *5 languages* you'll translate between. ` +
    `Reply with 5 numbers, e.g. *2 3 4 6 20*\n\n${list}`,
  );
}

/** Parse the 5 numbers, save the codes, then move to the input→outputs prompt. */
async function handleLangPick(fromPhone: string, who: MsgWho, last10: string, text: string) {
  const picks = parseNumbers(text).filter((n) => n >= 1 && n <= LANGS.length);
  const uniq = [...new Set(picks)].slice(0, 5);
  if (uniq.length < 2) {
    await sendText(fromPhone, `Please reply with 2–5 numbers from the list, e.g. *2 3 4 6 20*.`);
    return;
  }
  const codes = uniq.map((n) => LANGS[n - 1].code);
  await supabase.from("msg_participants").update({ languages: codes }).eq("id", who.participantId);
  who.languages = codes;
  await sendText(fromPhone, `✅ Saved your languages: ${codes.map(langLabel).join(", ")}.`);
  await startSelection(fromPhone, who, last10);
}

/** Show the user's chosen 5 numbered, and ask for "input > outputs". */
async function startSelection(fromPhone: string, who: MsgWho, last10: string) {
  await upsertSession(last10, who, { state: "await_selection", input_lang: null, output_langs: [] });
  const list = who.languages.map((c, i) => `${i + 1}. ${langLabel(c)}`).join("\n");
  await sendText(
    fromPhone,
    `🌐 *Which languages?*\n\n${list}\n\nReply *input > outputs*\n` +
    `e.g. *1 > 3 4*  (from ${langLabel(who.languages[0])} into languages 3 and 4)`,
  );
}

/** Parse the "input > outputs" selection, validate, store input_lang +
 *  output_langs, ask for content. Accepts every shape below (spaces optional,
 *  commas or spaces between the output numbers):
 *    1 > 3 4   ·   1 > 3,4   ·   1>3,4   ·   1 to 3 4   ·   1 to 3,4   ·   1to3,4
 *  and the arrow "1 → 3 4". Numbers left of the separator = input; right = outputs. */
async function handleSelection(fromPhone: string, who: MsgWho, last10: string, text: string) {
  const n = who.languages.length;
  // Normalise any separator — ">", "→", or the word "to" (even with no spaces,
  // e.g. "1to3") — to a single ">". Digits never contain letters, so replacing
  // every "to" is safe. parseNumbers then ignores the commas/spaces around the
  // numbers.
  const norm = text.replace(/→/g, ">").replace(/to/gi, ">");
  let inputIdx: number; let outIdxs: number[];
  if (norm.includes(">")) {
    const parts = norm.split(">");
    inputIdx = parseNumbers(parts[0])[0];               // first number before the 1st ">"
    outIdxs = parseNumbers(parts.slice(1).join(" "));   // everything after it
  } else {
    // No separator (e.g. "1 3 4") → first number is the input, the rest outputs.
    const all = parseNumbers(norm);
    inputIdx = all[0];
    outIdxs = all.slice(1);
  }
  const valid = (x: number) => Number.isInteger(x) && x >= 1 && x <= n;
  outIdxs = [...new Set(outIdxs.filter(valid))];
  if (!valid(inputIdx) || outIdxs.length === 0) {
    await sendText(fromPhone, `Reply like *1 > 3 4* — one input number (1–${n}), then one or more output numbers.`);
    return;
  }
  const inputLang = who.languages[inputIdx - 1];
  const outputLangs = outIdxs.map((i) => who.languages[i - 1]);
  await upsertSession(last10, who, { state: "await_content", input_lang: inputLang, output_langs: outputLangs });
  await sendText(
    fromPhone,
    `✍️ *${langLabel(inputLang)} → ${outputLangs.map(langLabel).join(", ")}*\n\n` +
    `Now send the text — or a voice note — you want translated. ` +
    `You can type in English letters (I'll read it as ${langLabel(inputLang)}).`,
  );
}

/** The heart of it: transliterate (if needed) → translate to each output → send
 *  each translation as its own clean, standalone (copy/forward-ready) message. */
async function handleContent(fromPhone: string, _who: MsgWho, session: MsgSession, content: string) {
  const inputLang = session.input_lang || "en";
  const outputLangs = session.output_langs || [];
  const raw = (content || "").trim();
  if (!raw) { await sendText(fromPhone, "That looked empty — send the text or a voice note to translate."); return; }
  if (!outputLangs.length) { await sendText(fromPhone, "No output language set. Send *msg* to choose again."); return; }

  // 1. If the text is in Latin letters but the input language uses another
  //    script, transliterate Latin → native first (e.g. romanized Kannada).
  let source = raw;
  if (!hasNonLatin(raw) && inputLang !== "en" && TRANSLIT_SUPPORTED.has(inputLang)) {
    const native = await transliterate(raw, inputLang);
    if (native) source = native;
  }

  // 2. Translate to each output language (identity when out === input). A null
  //    result means every Google endpoint failed (throttled) — collect those so
  //    we can tell the user rather than passing the untranslated text off as a
  //    "translation".
  const results: Array<{ lang: string; text: string }> = [];
  const failed: string[] = [];
  for (const out of outputLangs) {
    if (out === inputLang) { results.push({ lang: out, text: source }); continue; }
    const t = await translate(source, out, inputLang);
    if (t == null) { failed.push(out); continue; }
    results.push({ lang: out, text: t });
  }

  // 3. ONE standalone message per language — the body is the translation ONLY, so
  //    a long-press → Copy / Forward grabs exactly the text to paste into any
  //    WhatsApp group. (WhatsApp has no "copy" button; a clean standalone message
  //    is the copy/forward unit.) No header — it would just be noise above them.
  for (const r of results) {
    await sendText(fromPhone, r.text);
  }
  if (failed.length) {
    await sendText(
      fromPhone,
      `⚠️ Couldn't translate into ${failed.map(langLabel).join(", ")} just now ` +
      `(translation service is busy). Please send the text again in a moment.`,
    );
  }

  // 4. Offer next actions. Session stays in await_content, so they can simply send
  //    more text/voice to translate again with the SAME languages.
  await sendButtons(fromPhone, "Send more text to translate again, or:", [
    { id: "msg_change", title: "🔁 Change languages" },
    { id: "msg_done", title: "✖ Done" },
  ]);
}

// ── Keyless Google helpers (duplicated for isolation) ────────────────────────

/** Translate `text` into `target`, from `source` (falls back to auto-detect).
 *  Keyless Google endpoints, no key. The free buckets are frequently rate-limited
 *  (HTTP 429) from datacenter IPs like Supabase's — a bare fetch with no browser
 *  User-Agent gets throttled hardest — so we send a browser UA and try several
 *  clients/hosts in order. Returns `null` (NOT the original text) when every one
 *  fails, so the caller can tell the user it couldn't translate instead of echoing
 *  the untranslated input back as if it were the translation. */
async function translate(text: string, target: string, source?: string): Promise<string | null> {
  if (!text.trim() || !target) return text;
  const esl = encodeURIComponent(source || "auto");
  const tl = encodeURIComponent(target);
  const q = encodeURIComponent(text);
  // A real browser UA — datacenter default UAs are the ones Google 429s first.
  const headers = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" };

  // Several keyless endpoints across two hosts / quotas. translate_a/single returns
  // the rich shape [[["translated",…],…],…]; dict-chrome-ex returns ["s1","s2",…].
  const singleHosts = ["translate.googleapis.com", "clients5.google.com"];
  const attempts: Array<() => Promise<string>> = [];
  for (const client of ["gtx", "at"]) {
    for (const host of singleHosts) {
      attempts.push(async () => {
        const res = await fetch(`https://${host}/translate_a/single?client=${client}&dt=t&sl=${esl}&tl=${tl}&q=${q}`, { headers });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        return (data?.[0] || []).map((item: any) => item?.[0] || "").join("");
      });
    }
  }
  attempts.push(async () => {
    const res = await fetch(`https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${esl}&tl=${tl}&q=${q}`, { headers });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    return Array.isArray(data) ? data.map((s: any) => (typeof s === "string" ? s : Array.isArray(s) ? s[0] : "")).join("") : "";
  });

  // Up to 3 passes over every endpoint, with a short backoff between passes — the
  // free buckets throttle (429) intermittently, so a brief wait + retry usually
  // gets through. We run in the background (after Meta's 200), so this is safe.
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let lastErr: unknown = null;
  for (let pass = 0; pass < 3; pass++) {
    for (const attempt of attempts) {
      try { const out = await attempt(); if (out) return out; } catch (e) { lastErr = e; }
    }
    if (pass < 2) await sleep(500 * (pass + 1));
  }
  console.error("[msg.translate] all endpoints failed after retries:", lastErr);
  return null;
}

/** Transliterate romanized (Latin) `text` into `lang`'s native script via the
 *  keyless Google Input Tools endpoint. Word-by-word, then rejoined. Returns ""
 *  on failure so the caller can fall back to the text as typed. */
async function transliterate(text: string, lang: string): Promise<string> {
  try {
    const words = text.split(/(\s+)/); // keep the whitespace tokens
    const out: string[] = [];
    for (const w of words) {
      if (!/\S/.test(w) || !/[a-zA-Z]/.test(w)) { out.push(w); continue; }
      const url = `https://inputtools.google.com/request?text=${encodeURIComponent(w)}&itc=${encodeURIComponent(lang)}-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8`;
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" } });
      if (!res.ok) { out.push(w); continue; }
      const data = await res.json().catch(() => null);
      // Shape: ["SUCCESS", [ [ "<input>", ["<transliterated>", ...], [], {} ] ] ]
      const cand = data?.[0] === "SUCCESS" ? data?.[1]?.[0]?.[1]?.[0] : null;
      out.push(typeof cand === "string" && cand ? cand : w);
    }
    return out.join("");
  } catch (e) {
    console.error("[msg.transliterate] failed:", e);
    return "";
  }
}

/** True when text has characters beyond the Latin blocks — i.e. already native
 *  script, so no transliteration is needed.  -ɏ = ASCII + Latin-1 + Latin Ext-A/B. */
function hasNonLatin(text: string): boolean {
  return /[^ -ɏ]/.test(text);
}

/** Download a WhatsApp voice note and transcribe it (Groq Whisper, shared helper).
 *  `language` (the session's input language) pins Whisper so it doesn't auto-detect
 *  the wrong one. */
async function transcribeVoice(mediaId: string, language?: string | null): Promise<string> {
  try {
    const metaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, { headers: { "Authorization": `Bearer ${META_WA_TOKEN}` } });
    if (!metaRes.ok) return "";
    const meta = await metaRes.json();
    const mediaUrl: string = meta?.url;
    const mime: string = meta?.mime_type || "audio/ogg";
    if (!mediaUrl) return "";
    const fileRes = await fetch(mediaUrl, { headers: { "Authorization": `Bearer ${META_WA_TOKEN}` } });
    if (!fileRes.ok) return "";
    const bytes = new Uint8Array(await fileRes.arrayBuffer());
    return await transcribeAudio(bytes, mime.split(";")[0], "voice.ogg", language);
  } catch (e) {
    console.error("[msg.transcribeVoice] error:", e);
    return "";
  }
}

// ── Session store ────────────────────────────────────────────────────────────

const digits10 = (phone: string) => {
  const d = (phone || "").replace(/\D/g, "").slice(-10);
  return d.length === 10 ? d : "";
};

async function getSession(last10: string): Promise<MsgSession | null> {
  const { data } = await supabase.from("msg_sessions")
    .select("phone_last10, state, input_lang, output_langs")
    .eq("phone_last10", last10).gt("expires_at", new Date().toISOString()).limit(1);
  const r = data?.[0];
  if (!r) return null;
  return { ...r, output_langs: Array.isArray(r.output_langs) ? r.output_langs : [] } as MsgSession;
}

async function upsertSession(last10: string, who: MsgWho, fields: { state: string; input_lang: string | null; output_langs: string[] }) {
  const now = new Date();
  await supabase.from("msg_sessions").upsert({
    phone_last10: last10,
    participant_id: who.participantId,
    client_id: who.clientId,
    updated_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 3600_000).toISOString(),
    ...fields,
  }, { onConflict: "phone_last10" });
}

async function clearSession(last10: string) {
  await supabase.from("msg_sessions").delete().eq("phone_last10", last10);
}

/** Extract the numbers from a free-text reply, in order. */
function parseNumbers(s: string): number[] {
  return (String(s).match(/\d+/g) || []).map((x) => parseInt(x, 10));
}

// ── WhatsApp send (duplicated, minimal — isolation) ──────────────────────────

async function sendText(to: string, body: string): Promise<void> {
  // preview_url:false — a raw translation should never sprout a link-preview card.
  await waSend({ type: "text", text: { body: body.slice(0, 4096), preview_url: false }, to: to.replace(/\D/g, "") });
}

async function sendButtons(to: string, body: string, buttons: { id: string; title: string }[]): Promise<void> {
  await waSend({
    type: "interactive",
    to: to.replace(/\D/g, ""),
    interactive: {
      type: "button",
      body: { text: body.slice(0, 1024) },
      action: { buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })) },
    },
  });
}

async function waSend(partial: Record<string, any>): Promise<void> {
  const res = await fetch(`https://graph.facebook.com/v19.0/${META_PHONE_NUM_ID}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${META_WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...partial }),
  });
  if (!res.ok) console.error(`[msg] send failed ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
}
