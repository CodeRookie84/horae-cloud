/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reminders.tsx — personal reminders + meetings, managed from the app. Both
 * WhatsApp keywords ("/note"/"rem" and "meet") write into the same `reminders`
 * table (kind = 'reminder' | 'meeting'); this screen is the in-app counterpart
 * for reviewing and decluttering that list once entries pile up, instead of
 * only being able to see them via WhatsApp or the database. Pull-only:
 * nothing here is ever pushed (no notifications), zero messaging cost.
 */
import React, { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Pencil, Check, X, RefreshCw } from "lucide-react";
import { store } from "../services/store";
import { Reminder } from "../types";

const toLocalInput = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmt = (iso?: string) => iso
  ? new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
  : "—";
const overdue = (iso?: string) => !!iso && new Date(iso).getTime() < Date.now();

export default function Reminders({ onBack }: { onBack?: () => void }) {
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  // Also doubles as the add-form's default kind — whichever list you're
  // looking at is what a new entry gets added as.
  const [activeKind, setActiveKind] = useState<"reminder" | "meeting">("reminder");

  const [text, setText] = useState("");
  const [when, setWhen] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editWhen, setEditWhen] = useState("");
  const [editSaving, setEditSaving] = useState(false);

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
      await store.addReminder(text.trim(), when ? new Date(when).toISOString() : undefined, activeKind);
      setText(""); setWhen("");
      await load();
    } finally { setSaving(false); }
  };

  const startEdit = (r: Reminder) => {
    setEditingId(r.id);
    setEditText(r.text);
    setEditWhen(toLocalInput(r.remindAt));
  };
  const cancelEdit = () => setEditingId(null);
  const saveEdit = async (id: string) => {
    if (!editText.trim()) return;
    setEditSaving(true);
    try {
      await store.updateReminder(id, {
        text: editText.trim(),
        remindAt: editWhen ? new Date(editWhen).toISOString() : null,
      });
      setEditingId(null);
      await load();
    } finally { setEditSaving(false); }
  };

  const remove = async (id: string) => {
    await store.deleteReminder(id);
    await load();
  };

  // Pending only — handled ones are decluttered by removing them, not by a
  // separate done/hidden state this screen has to track. Scoped to whichever
  // kind is toggled at the top — reminders and meetings never mix in one list.
  const pending = items
    .filter(r => r.status === "pending" && (r.kind || "reminder") === activeKind)
    .sort((a, b) => {
      if (a.remindAt && b.remindAt) return new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime();
      if (a.remindAt) return -1;
      if (b.remindAt) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <div className="space-y-5 pb-10 max-w-3xl mx-auto">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] transition-colors cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      )}

      <div>
        <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Reminders &amp; Meetings</h2>
        <p className="text-sm text-[var(--color-ink-soft)] mt-1">
          Add one here, or from WhatsApp — <span className="font-mono bg-[var(--color-cream-deep)] px-1.5 py-0.5 rounded">/note &lt;what&gt; # &lt;time&gt;</span> or <span className="font-mono bg-[var(--color-cream-deep)] px-1.5 py-0.5 rounded">meet &lt;what&gt; # &lt;time&gt;</span>. Nothing is pushed; manage the list here whenever it needs a clean-up.
        </p>
      </div>

      {/* Reminders / Meetings toggle — filters the list below AND sets what
          the add form creates. */}
      <div className="flex rounded-xl border border-[var(--color-line)] overflow-hidden w-fit">
        {(["reminder", "meeting"] as const).map((k) => (
          <button
            key={k} type="button" onClick={() => setActiveKind(k)}
            className={`px-4 py-2 text-sm font-bold capitalize cursor-pointer transition-colors ${
              activeKind === k ? "bg-[var(--color-brand)] text-white" : "bg-white text-[var(--color-ink-soft)] hover:bg-[var(--color-cream)]"
            }`}
          >
            {k}s
          </button>
        ))}
      </div>

      {/* Add form */}
      <form onSubmit={add} className="bg-white rounded-2xl border border-[var(--color-line)] shadow-warm p-4 space-y-3">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={activeKind === "meeting" ? "What's the meeting about?" : "What do you want to remember?"}
          className="w-full px-3.5 py-2.5 bg-[var(--color-cream)] border border-[var(--color-line)] rounded-xl text-sm text-[var(--color-ink)] placeholder-[var(--color-ink-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30"
        />
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="flex-1 px-3 py-2 bg-[var(--color-cream)] border border-[var(--color-line)] rounded-xl text-sm text-[var(--color-ink)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!text.trim() || saving}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-bold bg-[var(--color-brand)] hover:bg-[color-mix(in_srgb,var(--color-brand)_88%,var(--color-ink))] shadow-warm cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" /> Add {activeKind === "meeting" ? "Meeting" : "Reminder"}
          </button>
        </div>
        <p className="text-[11px] text-[var(--color-ink-soft)]">The time is optional — it's just for your reference, not an alert.</p>
      </form>

      {loading ? (
        <div className="flex items-center justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-[var(--color-brand)]" /></div>
      ) : pending.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-ink-soft)]">
          {activeKind === "meeting" ? "No meetings pending." : "Nothing pending."} 🎉
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[var(--color-line)] shadow-warm overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[520px]">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-[10px] uppercase font-bold text-[var(--color-ink-soft)] tracking-wider">
                <th className="py-2.5 px-4">{activeKind === "meeting" ? "Meeting" : "Reminder"}</th>
                <th className="py-2.5 px-4">Date &amp; Time</th>
                <th className="py-2.5 px-4 text-right sticky right-0 bg-white">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm text-[var(--color-ink)]">
              {pending.map((r) => {
                const isEditing = editingId === r.id;
                return (
                  <tr key={r.id} className="border-b border-[var(--color-line)] last:border-0 hover:bg-[var(--color-cream)]/40 group">
                    <td className="py-2.5 px-4 align-top">
                      {isEditing ? (
                        <input
                          type="text" value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus
                          className="w-full px-2.5 py-1.5 bg-[var(--color-cream)] border border-[var(--color-line)] rounded-lg text-sm focus:outline-none"
                        />
                      ) : (
                        <span className="break-words">{r.text}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 align-top whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="datetime-local" value={editWhen} onChange={(e) => setEditWhen(e.target.value)}
                          className="px-2.5 py-1.5 bg-[var(--color-cream)] border border-[var(--color-line)] rounded-lg text-sm focus:outline-none"
                        />
                      ) : (
                        <span className={overdue(r.remindAt) ? "text-rose-600 font-semibold" : "text-[var(--color-ink-soft)]"}>
                          {fmt(r.remindAt)}{overdue(r.remindAt) ? " · passed" : ""}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 align-top sticky right-0 bg-white group-hover:bg-[var(--color-cream)]/40">
                      <div className="flex items-center gap-1 justify-end">
                        {isEditing ? (
                          <>
                            <button onClick={() => saveEdit(r.id)} disabled={!editText.trim() || editSaving} title="Save" className="p-1 text-emerald-600 hover:text-emerald-700 disabled:opacity-50 cursor-pointer">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={cancelEdit} title="Cancel" className="p-1 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] cursor-pointer">
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(r)} title="Edit" className="p-1 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] cursor-pointer">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => remove(r.id)} title="Remove" className="p-1 text-[var(--color-ink-soft)] hover:text-rose-500 cursor-pointer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
