/**
 * Supabase Edge Function: ai-draft
 *
 * Drafts multiple-choice training questions using Groq (free, text) or Gemini
 * (reads PDFs/images). Runs SERVER-SIDE so the AI keys are Supabase secrets
 * (GROQ_API_KEY / GEMINI_API_KEY) and never ship in the browser bundle.
 *
 * Auth: caller JWT verified; only Admin / Super Admin (who create trainings) may
 * draft. The admin always reviews the questions before publishing.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GROQ_API_KEY   = Deno.env.get("GROQ_API_KEY") || "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

function questionInstruction(title: string, count: number): string {
  return (
    `You are creating an internal staff-training assessment titled "${title}". ` +
    `Based ONLY on the material provided, write ${count} clear multiple-choice questions that test understanding of the key points. ` +
    `Each question must have exactly 4 options with exactly one correct answer. Keep language simple for frontline staff. ` +
    `Return ONLY a valid JSON array, no markdown, no commentary, in this exact shape: ` +
    `[{"question":"...","options":["...","...","...","..."],"correctIndex":0}]`
  );
}

function parseQuestionJson(text: string) {
  let t = (text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = t.indexOf("["), end = t.lastIndexOf("]");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  let raw: any[];
  try { raw = JSON.parse(t); } catch { throw new Error("The AI responded but not in the expected format. Try again, or add questions manually."); }
  return (raw || [])
    .filter((q) => q && q.question && Array.isArray(q.options) && q.options.length >= 2)
    .map((q: any, i: number) => ({
      id: `q-${Date.now().toString(36)}-${i}`,
      question: String(q.question),
      options: q.options.slice(0, 6).map((o: any) => String(o)),
      correctIndex: Math.max(0, Math.min(Number(q.correctIndex) || 0, q.options.length - 1)),
    }));
}

async function generateWithGroq(title: string, count: number, sourceText: string) {
  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL, temperature: 0.4,
      messages: [
        { role: "system", content: "You write clear multiple-choice staff-training questions and reply with ONLY a valid JSON array — no markdown, no commentary." },
        { role: "user", content: `${questionInstruction(title, count)}\n\nMaterial:\n${sourceText}` },
      ],
    }),
  });
  if (!resp.ok) throw new Error(`Groq request failed (${resp.status}). ${(await resp.text().catch(() => "")).slice(0, 200)}`);
  const data = await resp.json();
  return parseQuestionJson(data?.choices?.[0]?.message?.content || "");
}

async function generateWithGemini(params: { title: string; docUrl?: string; docType?: string }, count: number, notes: string) {
  const parts: any[] = [];
  if (params.docUrl && /pdf|image\//i.test(params.docType || "")) {
    const r = await fetch(params.docUrl);
    const buf = new Uint8Array(await r.arrayBuffer());
    let binary = ""; for (let i = 0; i < buf.byteLength; i++) binary += String.fromCharCode(buf[i]);
    parts.push({ inline_data: { mime_type: params.docType, data: btoa(binary) } });
  }
  if (notes) parts.push({ text: `Reference notes / key points:\n${notes}` });
  parts.push({ text: questionInstruction(params.title, count) });

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts }] }) },
  );
  if (!resp.ok) throw new Error(`Gemini request failed (${resp.status}). ${(await resp.text().catch(() => "")).slice(0, 200)}`);
  const data = await resp.json();
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("");
  return parseQuestionJson(text);
}

async function callerIsAdmin(jwt: string): Promise<boolean> {
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data?.user) return false;
  const { data: profile } = await admin.from("users").select("role").eq("auth_id", data.user.id).single();
  return !!profile && (profile.role === "Admin" || profile.role === "Super Admin");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
  if (!jwt || !(await callerIsAdmin(jwt))) return json({ error: "Not authorized" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const title = String(body.title || "Training");
  const count = Number(body.count) || 8;
  const notes = String(body.sourceNotes || "").trim();
  const docUrl = body.docUrl as string | undefined;
  const docType = body.docType as string | undefined;
  const hasGroq = !!GROQ_API_KEY;
  const hasGemini = !!GEMINI_API_KEY;
  const geminiReadableDoc = !!docUrl && /pdf|image\//i.test(docType || "");

  try {
    let questions;
    if (hasGroq && notes) questions = await generateWithGroq(title, count, notes);
    else if (hasGemini && (geminiReadableDoc || notes)) questions = await generateWithGemini({ title, docUrl, docType }, count, notes);
    else if (hasGroq && !notes) return json({ error: "Paste the training's key points into the notes box — Groq builds the test from text, not the uploaded file directly." }, 400);
    else return json({ error: "No AI provider is configured on the server." }, 500);
    return json({ questions });
  } catch (e: any) {
    console.error("[ai-draft] error:", e);
    return json({ error: String(e?.message || e) }, 500);
  }
});
