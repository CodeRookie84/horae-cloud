/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TeamTalkPriority.tsx — "Priority people" (VIP) feature UI.
 *   • PriorityStrip     — pinned roster of the user's up-to-3 priority people,
 *                         with a gold unread indicator, sitting atop the sidebar.
 *   • PriorityManagerModal — star-toggle picker to choose the 3 (max enforced).
 *
 * Storage + push live server-side (chat_priority_users); this file is purely
 * presentational and reuses the same slate/ink/gold palette as the rest of
 * Team Talk — no architectural change.
 */
import React, { useMemo, useState } from 'react';
import { Star, Settings2, X, Search, Check } from 'lucide-react';
import { motion } from 'motion/react';
import type { User as AppUser } from '../types';
import { MAX_PRIORITY_USERS } from '../services/chatService';

const GOLD = '#C5A880';

function Avatar({ user, size = 40 }: { user: AppUser; size?: number }) {
  const dim = { width: size, height: size };
  return user.avatar ? (
    <img
      src={user.avatar.split('#')[0]}
      alt=""
      className="rounded-full object-cover border border-slate-200"
      style={dim}
    />
  ) : (
    <div
      className="rounded-full bg-gradient-to-br from-[#162D4E] to-slate-700 flex items-center justify-center text-white font-bold"
      style={{ ...dim, fontSize: size * 0.36 }}
    >
      {user.name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Priority Strip (Template A) ──────────────────────────────────────────────
export function PriorityStrip({
  priorityUsers,
  unreadBySender,
  onOpenUser,
  onManage,
}: {
  priorityUsers: AppUser[];
  /** { [userId]: unread count from that priority person } */
  unreadBySender: Record<string, number>;
  onOpenUser: (user: AppUser) => void;
  onManage: () => void;
}) {
  return (
    <div className="rounded-xl bg-amber-50/70 border border-amber-100 px-2.5 py-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-amber-700">
          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
          Priority people
        </span>
        <button
          onClick={onManage}
          className="p-1 rounded-md text-amber-600 hover:bg-amber-100 transition-colors cursor-pointer"
          title="Manage priority people"
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {priorityUsers.length === 0 ? (
        <button
          onClick={onManage}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-semibold text-amber-700 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
        >
          <Star className="w-3.5 h-3.5" />
          Add up to {MAX_PRIORITY_USERS} people you can’t miss
        </button>
      ) : (
        <div className="flex items-start gap-3 px-0.5">
          {priorityUsers.map(u => {
            const unread = unreadBySender[u.id] ?? 0;
            return (
              <button
                key={u.id}
                onClick={() => onOpenUser(u)}
                className="flex flex-col items-center gap-1 group cursor-pointer min-w-0"
                title={unread > 0 ? `${u.name} — ${unread} new` : u.name}
              >
                <span className="relative shrink-0">
                  <span
                    className="block rounded-full transition-transform group-hover:scale-105"
                    style={unread > 0 ? { boxShadow: `0 0 0 2px ${GOLD}` } : undefined}
                  >
                    <Avatar user={u} size={38} />
                  </span>
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-extrabold flex items-center justify-center border border-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-slate-600 font-medium truncate max-w-[52px]">
                  {u.name.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Priority Manager Modal (the picker) ──────────────────────────────────────
export function PriorityManagerModal({
  allUsers,
  currentUserId,
  initialSelectedIds,
  onClose,
  onSave,
}: {
  allUsers: AppUser[];
  currentUserId: string;
  initialSelectedIds: string[];
  onClose: () => void;
  onSave: (ids: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>(initialSelectedIds.slice(0, MAX_PRIORITY_USERS));
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);

  const candidates = useMemo(() => {
    const query = q.trim().toLowerCase();
    return allUsers
      .filter(u => u.id !== currentUserId && (!query || u.name.toLowerCase().includes(query)))
      .sort((a, b) => {
        // Selected first, then alphabetical — so the current picks stay visible.
        const aSel = selected.includes(a.id) ? 0 : 1;
        const bSel = selected.includes(b.id) ? 0 : 1;
        return aSel - bSel || a.name.localeCompare(b.name);
      });
  }, [allUsers, currentUserId, q, selected]);

  const atLimit = selected.length >= MAX_PRIORITY_USERS;

  const toggle = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= MAX_PRIORITY_USERS) return prev; // enforce max
      return [...prev, id];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(selected);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
      >
        <div className="p-5 border-b border-slate-100 bg-amber-50/60 shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
              <div>
                <h3 className="text-[17px] font-bold text-slate-800">Priority people</h3>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Messages from these {MAX_PRIORITY_USERS} break through so you don’t miss them.
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-amber-100 rounded-full text-slate-400 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search teammates..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-[14px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>
          <p className="text-[12px] font-semibold text-amber-700 mt-2">
            {selected.length} of {MAX_PRIORITY_USERS} selected{atLimit ? ' — unstar someone to add another' : ''}
          </p>
        </div>

        <div className="p-3 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="text-center text-[14px] text-slate-400 py-8">No teammates found</p>
          ) : (
            <div className="space-y-0.5">
              {candidates.map(u => {
                const isSel = selected.includes(u.id);
                const disabled = !isSel && atLimit;
                return (
                  <button
                    key={u.id}
                    onClick={() => toggle(u.id)}
                    disabled={disabled}
                    className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                      isSel ? 'bg-amber-50' : disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50'
                    }`}
                  >
                    <Avatar user={u} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-slate-800 truncate">{u.name}</p>
                      <p className="text-[12px] text-slate-400 truncate">{u.role}{u.department ? ` · ${u.department}` : ''}</p>
                    </div>
                    <Star
                      className={`w-5 h-5 shrink-0 transition-colors ${isSel ? 'fill-amber-500 text-amber-500' : 'text-slate-300'}`}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-[14px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-[#162D4E] text-white rounded-xl text-[14px] font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {saving ? 'Saving...' : (<><Check className="w-4 h-4" /> Save</>)}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
