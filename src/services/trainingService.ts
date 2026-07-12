/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// trainingService.ts — Supabase-backed persistence + Gemini question drafting for
// the Training feature. Documents live in the `training-docs` storage bucket;
// trainings + attempts in their own tables (migration 20260714_training.sql).

import { supabase } from "./supabaseClient";
import { GoogleGenAI } from "@google/genai";
import type { Training, TrainingAttempt, TrainingQuestion } from "../types";

const genai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });

// ── Mapping ──────────────────────────────────────────────────────────────────
function mapTraining(r: any): Training {
  return {
    id: r.id,
    clientId: r.client_id,
    tenantId: r.tenant_id,
    title: r.title,
    description: r.description || "",
    docUrl: r.doc_url || "",
    docName: r.doc_name || "",
    docType: r.doc_type || "",
    sourceNotes: r.source_notes || "",
    outlets: r.outlets || [],
    department: r.department,
    role: r.role,
    passPct: r.pass_pct ?? 70,
    allowRetest: !!r.allow_retest,
    maxAttempts: r.max_attempts ?? 0,
    shuffle: !!r.shuffle,
    dueDate: r.due_date || undefined,
    questions: r.questions || [],
    retestGrants: r.retest_grants || [],
    published: !!r.published,
    createdBy: r.created_by || "",
    createdByName: r.created_by_name || "",
    createdAt: r.created_at,
  };
}

function toRow(t: Training): any {
  return {
    id: t.id,
    client_id: t.clientId,
    tenant_id: t.tenantId,
    title: t.title,
    description: t.description,
    doc_url: t.docUrl || "",
    doc_name: t.docName || "",
    doc_type: t.docType || "",
    source_notes: t.sourceNotes || "",
    outlets: t.outlets || [],
    department: t.department,
    role: t.role,
    pass_pct: t.passPct,
    allow_retest: t.allowRetest,
    max_attempts: t.maxAttempts,
    shuffle: t.shuffle,
    due_date: t.dueDate || null,
    questions: t.questions,
    retest_grants: t.retestGrants || [],
    published: t.published,
    created_by: t.createdBy,
    created_by_name: t.createdByName,
  };
}

function mapAttempt(r: any): TrainingAttempt {
  return {
    id: r.id, trainingId: r.training_id, trainingTitle: r.training_title || "",
    userId: r.user_id, userName: r.user_name || "", userRole: r.user_role || "",
    department: r.department || "", tenantId: r.tenant_id || "",
    score: r.score, total: r.total, pct: r.pct, passed: !!r.passed,
    answers: r.answers || [], attemptNo: r.attempt_no ?? 1, submittedAt: r.submitted_at,
  };
}

// ── Document upload ──────────────────────────────────────────────────────────
export async function uploadTrainingDoc(file: File): Promise<{ url: string; name: string; type: string }> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("training-docs").upload(path, file, {
    cacheControl: "3600", upsert: false, contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("training-docs").getPublicUrl(path);
  return { url: data.publicUrl, name: file.name, type: file.type || "" };
}

// ── AI question drafting (Groq primary, Gemini fallback) ─────────────────────
const GROQ_MODEL = "llama-3.3-70b-versatile";

/** Instruction shared by both providers (material is supplied separately). */
function questionInstruction(title: string, count: number): string {
  return (
    `You are creating an internal staff-training assessment titled "${title}". ` +
    `Based ONLY on the material provided, write ${count} clear multiple-choice questions that test understanding of the key points. ` +
    `Each question must have exactly 4 options with exactly one correct answer. Keep language simple for frontline staff. ` +
    `Return ONLY a valid JSON array, no markdown, no commentary, in this exact shape: ` +
    `[{"question":"...","options":["...","...","...","..."],"correctIndex":0}]`
  );
}

/** Extract the JSON array from a model reply and coerce to TrainingQuestion[]. */
function parseQuestionJson(text: string): TrainingQuestion[] {
  let t = (text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = t.indexOf("["), end = t.lastIndexOf("]");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  let raw: any[];
  try { raw = JSON.parse(t); }
  catch {
    console.error("[training] Could not parse AI response as JSON. Raw text:", text);
    throw new Error("The AI responded but not in the expected format. Try again, or add questions manually.");
  }
  return (raw || [])
    .filter(q => q && q.question && Array.isArray(q.options) && q.options.length >= 2)
    .map((q, i): TrainingQuestion => ({
      id: `q-${Date.now().toString(36)}-${i}`,
      question: String(q.question),
      options: q.options.slice(0, 6).map((o: any) => String(o)),
      correctIndex: Math.max(0, Math.min(Number(q.correctIndex) || 0, q.options.length - 1)),
    }));
}

/** Groq (free, no billing) — text only, so it works from the source notes. */
async function generateWithGroq(title: string, count: number, sourceText: string): Promise<TrainingQuestion[]> {
  const key = import.meta.env.VITE_GROQ_API_KEY;
  let resp: Response;
  try {
    resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.4,
        messages: [
          { role: "system", content: "You write clear multiple-choice staff-training questions and reply with ONLY a valid JSON array — no markdown, no commentary." },
          { role: "user", content: `${questionInstruction(title, count)}\n\nMaterial:\n${sourceText}` },
        ],
      }),
    });
  } catch (e: any) {
    console.error("[training] Groq request error:", e);
    throw new Error(`Couldn't reach Groq: ${e?.message || e}. Check your connection and VITE_GROQ_API_KEY.`);
  }
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    console.error("[training] Groq API error:", resp.status, body);
    throw new Error(`Groq request failed (${resp.status}). Check VITE_GROQ_API_KEY is valid. ${body.slice(0, 200)}`);
  }
  const data = await resp.json();
  return parseQuestionJson(data?.choices?.[0]?.message?.content || "");
}

/** Gemini fallback — reads PDFs/images natively; also works from notes. */
async function generateWithGemini(params: { title: string; docUrl?: string; docType?: string; sourceNotes?: string }, count: number, notes: string): Promise<TrainingQuestion[]> {
  const parts: any[] = [];
  if (params.docUrl && /pdf|image\//i.test(params.docType || "")) {
    const r = await fetch(params.docUrl);
    const buf = new Uint8Array(await r.arrayBuffer());
    let binary = ""; for (let i = 0; i < buf.byteLength; i++) binary += String.fromCharCode(buf[i]);
    parts.push({ inlineData: { mimeType: params.docType, data: btoa(binary) } });
  }
  if (notes) parts.push({ text: `Reference notes / key points:\n${notes}` });
  parts.push({ text: questionInstruction(params.title, count) });

  let response: any;
  try {
    response = await genai.models.generateContent({ model: "gemini-2.0-flash", contents: [{ role: "user", parts }] });
  } catch (e: any) {
    console.error("[training] Gemini generateContent failed:", e);
    throw new Error(`Gemini request failed: ${e?.message || e?.error?.message || String(e)}.`);
  }
  return parseQuestionJson(response.text || "");
}

/**
 * Draft multiple-choice questions. Uses Groq (free, text-based) when its key is
 * set and source notes are provided; otherwise falls back to Gemini (which can
 * read an uploaded PDF/image directly). The admin always reviews before publishing.
 */
export async function generateQuestions(params: {
  title: string;
  docUrl?: string;
  docType?: string;
  sourceNotes?: string;
  count?: number;
}): Promise<TrainingQuestion[]> {
  const count = params.count || 8;
  const notes = (params.sourceNotes || "").trim();
  const hasGroq = !!import.meta.env.VITE_GROQ_API_KEY;
  const hasGemini = !!import.meta.env.VITE_GEMINI_API_KEY;
  const geminiReadableDoc = !!params.docUrl && /pdf|image\//i.test(params.docType || "");

  // Prefer Groq (free) whenever we have its key and some text to work from.
  if (hasGroq && notes) return generateWithGroq(params.title, count, notes);
  // Gemini can read the uploaded PDF/image directly, or work from notes.
  if (hasGemini && (geminiReadableDoc || notes)) return generateWithGemini(params, count, notes);
  // Groq key is set but there's no text for it.
  if (hasGroq && !notes) {
    throw new Error("Paste the training's key points into the notes box — Groq builds the test from text, not the uploaded file directly.");
  }
  throw new Error("No AI key configured. Add a free Groq key as VITE_GROQ_API_KEY (from console.groq.com) to .env.local and restart the dev server.");
}

/**
 * Parse bulk-pasted questions (same format as the Quiz builder): questions are
 * separated by a blank line or a line with `---`; the first line is the question,
 * each following line is an option, and the correct one is marked with a leading
 * `*` or a trailing `(correct)`. A leading "a)" / "b." label is stripped.
 */
export function parseQuestionsFromText(text: string): TrainingQuestion[] {
  const blocks = text.split(/(?:---\r?\n?|\r?\n\r?\n)/).map(b => b.trim()).filter(Boolean);
  const out: TrainingQuestion[] = [];
  blocks.forEach((block, bi) => {
    const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return; // need a question + at least one option
    const question = lines[0];
    const options: string[] = [];
    let correctIndex = 0;
    lines.slice(1).forEach((optLine, i) => {
      let v = optLine; let correct = false;
      if (v.startsWith("*")) { correct = true; v = v.slice(1).trim(); }
      if (v.toLowerCase().endsWith("(correct)")) { correct = true; v = v.slice(0, -9).trim(); }
      v = v.replace(/^[a-zA-Z][\)\.]\s*/, "");
      options.push(v);
      if (correct) correctIndex = i;
    });
    while (options.length < 2) options.push(`Option ${options.length + 1}`);
    out.push({ id: `q-${Date.now().toString(36)}-${bi}`, question, options, correctIndex });
  });
  return out;
}

// ── Trainings CRUD ───────────────────────────────────────────────────────────
export async function getTrainings(clientId: string): Promise<Training[]> {
  const { data } = await supabase
    .from("trainings")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  return (data || []).map(mapTraining);
}

export async function saveTraining(t: Training): Promise<void> {
  await supabase.from("trainings").upsert(toRow(t), { onConflict: "id" });
}

export async function deleteTraining(id: string): Promise<void> {
  await supabase.from("trainings").delete().eq("id", id);
  await supabase.from("training_attempts").delete().eq("training_id", id);
}

export async function setPublished(id: string, published: boolean): Promise<void> {
  await supabase.from("trainings").update({ published }).eq("id", id);
}

/** Grant (or revoke) one extra attempt for a specific staff member. */
export async function setRetestGrant(training: Training, userId: string, grant: boolean): Promise<string[]> {
  const set = new Set(training.retestGrants || []);
  if (grant) set.add(userId); else set.delete(userId);
  const next = Array.from(set);
  await supabase.from("trainings").update({ retest_grants: next }).eq("id", training.id);
  return next;
}

// ── Attempts ─────────────────────────────────────────────────────────────────
export async function getAttempts(clientTrainingIds: string[]): Promise<TrainingAttempt[]> {
  if (clientTrainingIds.length === 0) return [];
  const { data } = await supabase
    .from("training_attempts")
    .select("*")
    .in("training_id", clientTrainingIds)
    .order("submitted_at", { ascending: false });
  return (data || []).map(mapAttempt);
}

export async function submitAttempt(
  training: Training,
  user: { id: string; name: string; role: string; department: string; tenantId: string },
  answers: number[],
): Promise<TrainingAttempt> {
  let score = 0;
  training.questions.forEach((q, i) => { if (answers[i] === q.correctIndex) score++; });
  const total = training.questions.length || 1;
  const pct = Math.round((score / total) * 100);
  const passed = pct >= training.passPct;

  const { data: prior } = await supabase
    .from("training_attempts")
    .select("id")
    .eq("training_id", training.id)
    .eq("user_id", user.id);
  const attemptNo = (prior?.length || 0) + 1;

  const row = {
    id: `TA-${Date.now().toString(36).toUpperCase()}`,
    training_id: training.id, training_title: training.title,
    user_id: user.id, user_name: user.name, user_role: user.role,
    department: user.department, tenant_id: user.tenantId,
    score, total, pct, passed, answers, attempt_no: attemptNo,
  };
  await supabase.from("training_attempts").insert(row);

  // Consume a one-time retest grant if it enabled this attempt.
  if ((training.retestGrants || []).includes(user.id)) {
    await setRetestGrant(training, user.id, false);
  }

  return mapAttempt({ ...row, submitted_at: new Date().toISOString() });
}

// ── Targeting + eligibility (pure) ───────────────────────────────────────────
import { isTargetMatched, Department, Role } from "../types";

/** Whether a training is assigned to this user (outlet + department + role). */
export function trainingMatchesUser(
  t: Training,
  user: { tenantId: string; department: string; role: string },
): boolean {
  const outletOk = !t.outlets || t.outlets.length === 0 || t.outlets.includes(user.tenantId);
  const deptOk = isTargetMatched(String(t.department), user.department, Department.ALL);
  const roleOk = isTargetMatched(String(t.role), user.role, Role.ALL);
  return outletOk && deptOk && roleOk;
}

export type TrainingUserStatus =
  | "not_started" | "passed" | "can_retake" | "locked_failed";

export function trainingStatus(
  t: Training,
  userId: string,
  allAttempts: TrainingAttempt[],
): { status: TrainingUserStatus; attemptsUsed: number; best?: TrainingAttempt; last?: TrainingAttempt; canTake: boolean } {
  const mine = allAttempts
    .filter(a => a.trainingId === t.id && a.userId === userId)
    .sort((a, b) => a.attemptNo - b.attemptNo);
  const attemptsUsed = mine.length;
  const passed = mine.some(a => a.passed);
  const best = mine.reduce<TrainingAttempt | undefined>((b, a) => (!b || a.pct > b.pct ? a : b), undefined);
  const last = mine[mine.length - 1];

  if (passed) return { status: "passed", attemptsUsed, best, last, canTake: false };
  if (attemptsUsed === 0) return { status: "not_started", attemptsUsed, best, last, canTake: true };

  const granted = (t.retestGrants || []).includes(userId);
  const underMax = t.maxAttempts === 0 || attemptsUsed < t.maxAttempts;
  const canRetake = granted || (t.allowRetest && underMax);
  return { status: canRetake ? "can_retake" : "locked_failed", attemptsUsed, best, last, canTake: canRetake };
}

// ── Reminders (push + WhatsApp via notify-dispatcher, + in-app fallback) ──────
export async function sendTrainingReminder(
  trainingId: string, title: string, userIds: string[], tenantId: string, dueDate?: string,
): Promise<void> {
  if (!userIds.length) return;
  // In-app notifications (always work, even if push/WA aren't configured).
  const rows = userIds.map(uid => ({
    id: `NT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    tenant_id: tenantId,
    title: "Training due",
    message: `Please complete "${title}"${dueDate ? ` by ${dueDate}` : ""}.`,
    category: "training",
    department: "All Departments",
    role: "All Roles",
    target_user_id: uid,
  }));
  await supabase.from("notifications").insert(rows).then(() => {}, () => {});

  // Push + WhatsApp via the edge function (kind: "training").
  await supabase.functions.invoke("notify-dispatcher", {
    body: { type: "URGENT_PUSH", kind: "training", record: { id: trainingId, title }, userIds, tenantId },
  }).catch(() => {});
}
