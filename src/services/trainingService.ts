/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// trainingService.ts — Supabase-backed persistence + Gemini question drafting for
// the Training feature. Documents live in the `training-docs` storage bucket;
// trainings + attempts in their own tables (migration 20260714_training.sql).

import { supabase } from "./supabaseClient";
import type { Training, TrainingAttempt, TrainingQuestion } from "../types";

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
    screenLeaves: r.screen_leaves ?? 0,
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

// ── AI question drafting ─────────────────────────────────────────────────────
/**
 * Draft multiple-choice questions via the `ai-draft` edge function. The Groq/
 * Gemini keys now live as server-side Supabase secrets (never in the browser
 * bundle); the function verifies the caller is an Admin/Super Admin, picks the
 * provider, and returns ready-to-review questions. The admin always reviews
 * before publishing.
 */
export async function generateQuestions(params: {
  title: string;
  docUrl?: string;
  docType?: string;
  sourceNotes?: string;
  count?: number;
}): Promise<TrainingQuestion[]> {
  const { data, error } = await supabase.functions.invoke('ai-draft', {
    body: {
      title: params.title,
      count: params.count || 8,
      sourceNotes: params.sourceNotes || "",
      docUrl: params.docUrl,
      docType: params.docType,
    },
  });
  if (error) {
    let msg = error.message;
    try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch {}
    throw new Error(msg || "Couldn't draft questions. Please try again.");
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return (((data as any)?.questions) || []) as TrainingQuestion[];
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
  screenLeaves: number = 0,
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
    screen_leaves: Math.max(0, screenLeaves),
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
