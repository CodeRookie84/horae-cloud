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
  | "tasks" | "notices" | "checklists"
  | "maintenance" | "training" | "sops";

export const TRIAL_DAYS = 15;
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

/** Every feature — the active Free trial grants all of these. */
const ALL_FEATURES: FeatureKey[] = [
  "tasks", "notices", "checklists", "maintenance", "training", "sops",
];

/** Base feature set per paid plan (before the Training add-on is applied). */
const PLAN_BASE: Record<Exclude<PlanId, "Free">, FeatureKey[]> = {
  Essential: ["tasks"],
  Pro: ["tasks", "checklists", "maintenance", "notices"],
  Enterprise: ["tasks", "checklists", "maintenance", "notices", "training", "sops"],
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
  notices: "Notice Board",
  checklists: "Checklists",
  maintenance: "Equipment Maintenance",
  training: "Training",
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

/**
 * Is a demo client still inside its explicit window? Unlike the Free trial,
 * a demo's length is set per-client (default 7 days) and stored as an absolute
 * expiry, so we compare against that timestamp rather than a fixed span.
 */
export function isDemoActive(demoExpiresAt?: string): boolean {
  if (!demoExpiresAt) return false;
  const expires = new Date(demoExpiresAt).getTime();
  return Number.isFinite(expires) && Date.now() < expires;
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
  opts: { trainingAddon?: boolean; createdAt?: string; isDemo?: boolean; demoExpiresAt?: string } = {},
): FeatureKey[] {
  // A demo is an all-features sandbox while inside its window, nothing after —
  // independent of whatever `plan` label the row carries.
  if (opts.isDemo) {
    return isDemoActive(opts.demoExpiresAt) ? [...ALL_FEATURES] : [];
  }
  if (plan === "Free") {
    return isTrialActive(opts.createdAt) ? [...ALL_FEATURES] : [];
  }
  const base = PLAN_BASE[plan as Exclude<PlanId, "Free">] || PLAN_BASE.Essential;
  if (opts.trainingAddon && trainingAddonApplies(plan as PlanId) && !base.includes("training")) {
    return [...base, "training"];
  }
  return [...base];
}
