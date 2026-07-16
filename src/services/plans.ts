/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// plans.ts — single source of truth for subscription plans → feature entitlements.
//
// Feature access is DERIVED deterministically from a client's `plan` plus the
// `trainingAddon` flag (and, for the Free trial, its creation date). Keeping the
// mapping here — rather than a per-browser localStorage override — means a
// super-admin plan switch propagates to every user of that client immediately.

export type PlanId = "Free" | "Essential" | "Pro" | "Enterprise" | "Training";

/** Canonical feature keys used across the sidebar + tab gating. */
export type FeatureKey =
  | "tasks" | "teamtalk" | "notices" | "checklists"
  | "maintenance" | "training" | "quizzes" | "sops";

export const TRIAL_DAYS = 15;
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

/** Every feature — the active Free trial grants all of these. */
const ALL_FEATURES: FeatureKey[] = [
  "tasks", "teamtalk", "notices", "checklists", "maintenance", "training", "quizzes", "sops",
];

/** Base feature set per paid plan (before the Training add-on is applied). */
const PLAN_BASE: Record<Exclude<PlanId, "Free">, FeatureKey[]> = {
  Essential: ["tasks", "teamtalk"],
  Pro: ["tasks", "teamtalk", "checklists", "maintenance", "notices"],
  Enterprise: ["tasks", "teamtalk", "checklists", "maintenance", "notices", "training", "quizzes", "sops"],
  Training: ["training"],
};

export const PLAN_LABELS: Record<PlanId, string> = {
  Free: "Free Trial (15 days)",
  Essential: "Essential",
  Pro: "Pro",
  Enterprise: "Enterprise",
  Training: "Training",
};

/** Human labels for the feature keys — used by the admin plan preview. */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  tasks: "Task Manager",
  teamtalk: "Team Talk",
  notices: "Notice Board",
  checklists: "Checklists",
  maintenance: "Equipment Maintenance",
  training: "Training",
  quizzes: "Quizzes",
  sops: "SOPs",
};

/** Whether the Training add-on is meaningful for this plan (Essential/Pro only). */
export function trainingAddonApplies(plan: PlanId): boolean {
  return plan === "Essential" || plan === "Pro";
}

/** Is a Free-trial client still within its 15-day window? */
export function isTrialActive(createdAt?: string): boolean {
  const created = createdAt ? new Date(createdAt).getTime() : Date.now();
  return Date.now() - created <= TRIAL_MS;
}

/** Has a Free-trial client's 15-day window elapsed? */
export function isTrialExpired(plan: PlanId | string, createdAt?: string): boolean {
  return plan === "Free" && !isTrialActive(createdAt);
}

/**
 * The feature keys a client is entitled to. Free = all features while the trial
 * is active, none once it expires. Paid plans get their base set, plus `training`
 * when the Training add-on is on (Essential/Pro).
 */
export function planFeatures(
  plan: PlanId | string,
  opts: { trainingAddon?: boolean; createdAt?: string } = {},
): FeatureKey[] {
  if (plan === "Free") {
    return isTrialActive(opts.createdAt) ? [...ALL_FEATURES] : [];
  }
  const base = PLAN_BASE[plan as Exclude<PlanId, "Free">] || PLAN_BASE.Essential;
  if (opts.trainingAddon && trainingAddonApplies(plan as PlanId) && !base.includes("training")) {
    return [...base, "training"];
  }
  return [...base];
}
