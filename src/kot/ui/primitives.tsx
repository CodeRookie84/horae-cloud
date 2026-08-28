/**
 * KOT UI primitives — intentionally duplicated so the module borrows nothing
 * visual from Horae (isolation contract). Plain Tailwind utilities only; no
 * import from src/components. KOT's accent is rose/pink to read as its own app.
 */
import type { ReactNode, ButtonHTMLAttributes } from "react";
import { KOT_PIPELINE, statusDef, type KotStatus } from "../status";

/** Tiny classnames joiner (avoids importing Horae's helper). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300",
  secondary: "bg-white text-rose-700 border border-rose-200 hover:bg-rose-50",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export function KotButton(
  { variant = "primary", className, children, ...rest }:
  { variant?: Variant } & ButtonHTMLAttributes<HTMLButtonElement>,
) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-70",
        VARIANTS[variant], className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function KotCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}

export function KotSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("h-5 w-5 animate-spin rounded-full border-2 border-rose-200 border-t-rose-600", className)} />
  );
}

export function KotEmpty({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      {icon && <div className="text-4xl opacity-70">{icon}</div>}
      <p className="text-base font-semibold text-slate-700">{title}</p>
      {hint && <p className="max-w-xs text-sm text-slate-500">{hint}</p>}
    </div>
  );
}

/** Colour per pipeline step — a soft ramp from received (slate) to done (green). */
const STATUS_TONE: Record<KotStatus, string> = {
  order_received: "bg-slate-100 text-slate-700",
  indent_created: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  ready: "bg-violet-100 text-violet-700",
  handed_over: "bg-indigo-100 text-indigo-700",
  collected: "bg-teal-100 text-teal-700",
  completed: "bg-green-100 text-green-700",
};

export function KotStatusBadge({ status }: { status: KotStatus }) {
  const def = statusDef(status);
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_TONE[status])}>
      {def?.requiresPhoto && <span aria-hidden>📷</span>}
      {def?.label ?? status}
    </span>
  );
}

/** Compact 7-dot progress rail showing where an order sits in the pipeline. */
export function KotStatusRail({ status }: { status: KotStatus }) {
  const current = statusDef(status)?.step ?? 0;
  return (
    <div className="flex items-center gap-1">
      {KOT_PIPELINE.map((s) => (
        <span
          key={s.id}
          title={s.label}
          className={cn(
            "h-1.5 w-5 rounded-full",
            s.step < current ? "bg-rose-400" : s.step === current ? "bg-rose-600" : "bg-slate-200",
          )}
        />
      ))}
    </div>
  );
}
