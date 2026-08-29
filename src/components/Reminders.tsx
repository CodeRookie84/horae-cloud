/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reminders.tsx — a lightweight personal notes/reminders view. Pull-only: nothing
 * is ever pushed (no notifications), so it adds zero messaging cost. Staff add
 * reminders here or from WhatsApp ("me <note> - <time>") and check them anytime.
 */
import React, { useEffect, useState } from "react";
import { ArrowLeft, Plus, Check, Trash2, Clock, RefreshCw } from "lucide-react";
import { store } from "../services/store";
import { Reminder } from "../types";

export default function Reminders({ onBack }: { onBack?: () => void }) {
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [when, setWhen] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await store.getReminders()); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      await store.addReminder(text.trim(), when ? new Date(when).toISOString() : undefined);
      setText(""); setWhen("");
      await load();
    } finally { setSaving(false); }
  };
  const markDone = async (id: string) => { await store.completeReminder(id); await load(); };
  const remove   = async (id: string) => { await store.deleteReminder(id); await load(); };

  const pending = items.filter(r => r.status === "pending");
  const doneItems = items.filter(r => r.status === "done").slice(0, 20);

  const fmt = (iso?: string) => iso
    ? new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;
  const overdue = (iso?: string) => !!iso && new Date(iso).getTime() < Date.now();

  return (
    <div className="space-y-5 pb-10 max-w-2xl mx-auto">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] transition-colors cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      )}

      <div>
        <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Reminders</h2>
        <p className="text-sm text-[var(--color-ink-soft)] mt-1">
          Your personal notes. Add one here, or from WhatsApp — send <span className="font-mono bg-[var(--color-cream-deep)] px-1.5 py-0.5 rounded">me &lt;note&gt; - &lt;time&gt;</span>. Nothing is pushed; check them whenever you like.
        </p>
      </div>

      {/* Add form */}
      <form onSubmit={add} className="bg-white rounded-2xl border border-[var(--color-line)] shadow-warm p-4 space-y-3">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What do you want to remember?"
          className="w-full px-3.5 py-2.5 bg-[var(--color-cream)] border border-[var(--color-line)] rounded-xl text-sm text-[var(--color-ink)] placeholder-[var(--color-ink-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30"
        />
        <div className="flex flex-col sm:flex-row gap-2">
          <label className="flex-1 flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
            <Clock className="w-4 h-4 shrink-0" />
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="flex-1 px-3 py-2 bg-[var(--color-cream)] border border-[var(--color-line)] rounded-xl text-sm text-[var(--color-ink)] focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={!text.trim() || saving}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-bold bg-[var(--color-brand)] hover:bg-[color-mix(in_srgb,var(--color-brand)_88%,var(--color-ink))] shadow-warm cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
        <p className="text-[11px] text-[var(--color-ink-soft)]">The time is optional — it's just for your reference, not an alert.</p>
      </form>

      {loading ? (
        <div className="flex items-center justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-[var(--color-brand)]" /></div>
      ) : (
        <>
          {/* Pending */}
          <div className="space-y-2">
            <span className="text-xs font-bold tracking-wider uppercase text-[var(--color-ink-soft)] px-1">To remember ({pending.length})</span>
            {pending.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-ink-soft)]">
                Nothing pending. 🎉
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[var(--color-line)] shadow-warm divide-y divide-[var(--color-line)] overflow-hidden">
                {pending.map(r => (
                  <div key={r.id} className="flex items-start gap-3 px-4 py-3">
                    <button onClick={() => markDone(r.id)} title="Mark done" className="mt-0.5 w-6 h-6 rounded-full border-2 border-[var(--color-line)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-tint)] flex items-center justify-center shrink-0 cursor-pointer transition-all">
                      <Check className="w-3.5 h-3.5 text-[var(--color-accent)] opacity-0 hover:opacity-100" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[var(--color-ink)] break-words">{r.text}</div>
                      {r.remindAt && (
                        <div className={`text-xs mt-0.5 flex items-center gap-1 ${overdue(r.remindAt) ? "text-rose-600 font-semibold" : "text-[var(--color-ink-soft)]"}`}>
                          <Clock className="w-3 h-3" /> {fmt(r.remindAt)}{overdue(r.remindAt) ? " · passed" : ""}
                        </div>
                      )}
                    </div>
                    <button onClick={() => remove(r.id)} title="Delete" className="text-[var(--color-ink-soft)] hover:text-rose-500 shrink-0 cursor-pointer p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Done */}
          {doneItems.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold tracking-wider uppercase text-[var(--color-ink-soft)] px-1">Done</span>
              <div className="bg-white rounded-2xl border border-[var(--color-line)] divide-y divide-[var(--color-line)] overflow-hidden">
                {doneItems.map(r => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Check className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
                    <span className="flex-1 min-w-0 text-sm text-[var(--color-ink-soft)] line-through break-words">{r.text}</span>
                    <button onClick={() => remove(r.id)} title="Delete" className="text-[var(--color-ink-soft)] hover:text-rose-500 shrink-0 cursor-pointer p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
