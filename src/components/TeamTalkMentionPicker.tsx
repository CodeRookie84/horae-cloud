/**
 * TeamTalkMentionPicker.tsx — v2
 * Floating dropdown for @ — shows ROLE GROUPS first, then individuals.
 * Selecting a role group notifies all users with that role.
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { Users, UserCheck, User } from 'lucide-react';
import type { User as AppUser } from '../types';

// ── Role group definitions ─────────────────────────────────────
export interface MentionGroup {
  type: 'group';
  id: string;           // e.g. "role:Manager"  or  "dept:Kitchen & Baking"  or  "all"
  name: string;         // display name e.g. "All Managers"
  emoji: string;
  count: number;
}

type MentionItem = MentionGroup | (AppUser & { type: 'user' });

function buildRoleGroups(allUsers: AppUser[], currentUserId: string): MentionGroup[] {
  const others = allUsers.filter(u => u.id !== currentUserId);

  // Collect unique roles that have > 0 users
  const roleMap: Record<string, number> = {};
  for (const u of others) {
    if (u.role) roleMap[u.role] = (roleMap[u.role] || 0) + 1;
  }

  const groups: MentionGroup[] = [];

  // All staff shortcut
  if (others.length > 1) {
    groups.push({ type: 'group', id: 'all', name: 'All Staff', emoji: '📢', count: others.length });
  }

  // Priority roles shown first
  const priorityRoles = ['Admin', 'Manager', 'Super Admin', 'Supervisor', 'Operations', 'HR'];
  for (const role of priorityRoles) {
    const count = roleMap[role];
    if (count && count > 0) {
      groups.push({ type: 'group', id: `role:${role}`, name: `All ${role}s`, emoji: '👔', count });
      delete roleMap[role]; // remove so we don't show twice
    }
  }

  // Remaining roles
  for (const [role, count] of Object.entries(roleMap)) {
    if (count > 1) { // only show groups with 2+ members
      groups.push({ type: 'group', id: `role:${role}`, name: `All ${role}s`, emoji: '👥', count });
    }
  }

  return groups;
}

interface MentionPickerProps {
  query: string;
  allUsers: AppUser[];
  currentUserId: string;
  onSelectUser: (user: AppUser) => void;
  onSelectGroup: (group: MentionGroup) => void;
  onClose: () => void;
}

export default function TeamTalkMentionPicker({
  query, allUsers, currentUserId, onSelectUser, onSelectGroup, onClose,
}: MentionPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const q = query.toLowerCase();

  const groups = useMemo(() => buildRoleGroups(allUsers, currentUserId), [allUsers, currentUserId]);
  const filteredGroups = groups.filter(g => q === '' || g.name.toLowerCase().includes(q) || g.id.toLowerCase().includes(q));
  const filteredUsers = allUsers
    .filter(u => u.id !== currentUserId && (q === '' || u.name.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q)))
    .slice(0, 5);

  if (filteredGroups.length === 0 && filteredUsers.length === 0) return null;

  return (
    <div
      ref={ref}
      id="mention-picker"
      className="absolute bottom-full left-0 mb-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-80 flex flex-col"
    >
      <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Mention someone</p>
      </div>

      <div className="overflow-y-auto flex-1">
        {/* Role / Team Groups */}
        {filteredGroups.length > 0 && (
          <div>
            <p className="px-3 pt-2 pb-1 text-[9px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1">
              <Users className="w-2.5 h-2.5" /> Teams & Roles
            </p>
            {filteredGroups.slice(0, 4).map(group => (
              <button
                key={group.id}
                id={`mention-group-${group.id.replace(':', '-')}`}
                onMouseDown={e => { e.preventDefault(); onSelectGroup(group); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-indigo-50 transition-colors cursor-pointer text-left"
              >
                <div className="w-7 h-7 rounded-xl bg-indigo-100 flex items-center justify-center text-sm shrink-0">
                  {group.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-slate-800 leading-tight">{group.name}</p>
                  <p className="text-[10px] text-indigo-400">{group.count} people will be notified</p>
                </div>
                <span className="text-[9px] bg-indigo-100 text-indigo-600 font-bold px-1.5 py-0.5 rounded-full shrink-0">
                  group
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Individual users */}
        {filteredUsers.length > 0 && (
          <div>
            <p className="px-3 pt-2 pb-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <User className="w-2.5 h-2.5" /> People
            </p>
            {filteredUsers.map(user => (
              <button
                key={user.id}
                id={`mention-user-${user.id}`}
                onMouseDown={e => { e.preventDefault(); onSelectUser(user); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 transition-colors cursor-pointer text-left"
              >
                {user.avatar ? (
                  <img
                    src={user.avatar.split('#')[0]}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-100"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#162D4E] to-slate-700 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-slate-800 truncate leading-tight">{user.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{user.role} · {user.department}</p>
                </div>
                {user.isOnline && <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
