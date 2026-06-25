/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TeamTalkMemberPicker.tsx — Typeahead, multi-select member picker.
 * Type a name/department/role/outlet and pick matching suggestions instead
 * of scrolling a full checkbox list. Selecting a group (department/role/outlet)
 * expands to every matching user; selections render as removable chips.
 */
import React, { useMemo, useState } from 'react';
import { Search, X, Users, Building2, Tag } from 'lucide-react';
import type { User as AppUser, Tenant } from '../types';

export interface MemberPickerSelection {
  outlets: string[];
  depts: string[];
  roles: string[];
  individuals: string[];
}

const EMPTY_SELECTION: MemberPickerSelection = { outlets: [], depts: [], roles: [], individuals: [] };

interface TeamTalkMemberPickerProps {
  /** Full pool of users eligible to be added — already excludes existing members */
  candidates: AppUser[];
  /** Outlets available for group-select (omit to hide the Outlets group, e.g. inside a single-outlet context) */
  tenants?: Tenant[];
  value: MemberPickerSelection;
  onChange: (selection: MemberPickerSelection) => void;
}

function resolveMemberIds(selection: MemberPickerSelection, candidates: AppUser[], tenants: Tenant[]): string[] {
  const result = new Set<string>();
  if (selection.outlets.length > 0) {
    candidates.forEach(u => selection.outlets.includes(u.tenantId) && result.add(u.id));
  }
  if (selection.depts.length > 0) {
    candidates.forEach(u => selection.depts.includes(u.department) && result.add(u.id));
  }
  if (selection.roles.length > 0) {
    candidates.forEach(u => selection.roles.includes(u.role) && result.add(u.id));
  }
  selection.individuals.forEach(id => result.add(id));
  return Array.from(result);
}

export { resolveMemberIds, EMPTY_SELECTION };

export default function TeamTalkMemberPicker({ candidates, tenants = [], value, onChange }: TeamTalkMemberPickerProps) {
  const [query, setQuery] = useState('');

  const allDepts = useMemo(() => Array.from(new Set(candidates.map(u => u.department).filter(Boolean))), [candidates]);
  const allRoles = useMemo(() => Array.from(new Set(candidates.map(u => u.role).filter(Boolean))), [candidates]);

  const q = query.trim().toLowerCase();

  const matchedOutlets = q ? tenants.filter(t => t.name.toLowerCase().includes(q) && !value.outlets.includes(t.id)).slice(0, 5) : [];
  const matchedDepts = q ? allDepts.filter(d => d.toLowerCase().includes(q) && !value.depts.includes(d)).slice(0, 5) : [];
  const matchedRoles = q ? allRoles.filter(r => r.toLowerCase().includes(q) && !value.roles.includes(r)).slice(0, 5) : [];
  const matchedIndividuals = q
    ? candidates.filter(u => u.name.toLowerCase().includes(q) && !value.individuals.includes(u.id)).slice(0, 6)
    : [];

  const hasSuggestions = matchedOutlets.length + matchedDepts.length + matchedRoles.length + matchedIndividuals.length > 0;

  const memberIds = resolveMemberIds(value, candidates, tenants);

  function addOutlet(id: string) {
    onChange({ ...value, outlets: [...value.outlets, id] });
    setQuery('');
  }
  function addDept(d: string) {
    onChange({ ...value, depts: [...value.depts, d] });
    setQuery('');
  }
  function addRole(r: string) {
    onChange({ ...value, roles: [...value.roles, r] });
    setQuery('');
  }
  function addIndividual(id: string) {
    onChange({ ...value, individuals: [...value.individuals, id] });
    setQuery('');
  }
  function removeOutlet(id: string) { onChange({ ...value, outlets: value.outlets.filter(o => o !== id) }); }
  function removeDept(d: string) { onChange({ ...value, depts: value.depts.filter(x => x !== d) }); }
  function removeRole(r: string) { onChange({ ...value, roles: value.roles.filter(x => x !== r) }); }
  function removeIndividual(id: string) { onChange({ ...value, individuals: value.individuals.filter(x => x !== id) }); }

  const hasAnySelection = value.outlets.length + value.depts.length + value.roles.length + value.individuals.length > 0;

  return (
    <div className="space-y-3">
      {/* Selected chips */}
      {hasAnySelection && (
        <div className="flex flex-wrap gap-1.5">
          {value.outlets.map(id => {
            const t = tenants.find(x => x.id === id);
            return (
              <span key={`o-${id}`} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold">
                <Building2 className="w-3 h-3" /> {t?.name || 'Outlet'}
                <button onClick={() => removeOutlet(id)} className="p-0.5 hover:bg-amber-200 rounded-full cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            );
          })}
          {value.depts.map(d => (
            <span key={`d-${d}`} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
              <Tag className="w-3 h-3" /> {d}
              <button onClick={() => removeDept(d)} className="p-0.5 hover:bg-emerald-200 rounded-full cursor-pointer"><X className="w-3 h-3" /></button>
            </span>
          ))}
          {value.roles.map(r => (
            <span key={`r-${r}`} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full bg-violet-100 text-violet-800 text-[11px] font-semibold">
              <Tag className="w-3 h-3" /> {r}
              <button onClick={() => removeRole(r)} className="p-0.5 hover:bg-violet-200 rounded-full cursor-pointer"><X className="w-3 h-3" /></button>
            </span>
          ))}
          {value.individuals.map(id => {
            const u = candidates.find(x => x.id === id);
            return (
              <span key={`i-${id}`} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                <Users className="w-3 h-3" /> {u?.name || 'User'}
                <button onClick={() => removeIndividual(id)} className="p-0.5 hover:bg-slate-200 rounded-full cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            );
          })}
        </div>
      )}

      {/* Typeahead input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Type a name, department, role or outlet..."
          className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#162D4E]/20"
        />
      </div>

      {/* Suggestions */}
      {q && (
        <div className="border border-slate-100 rounded-xl bg-white shadow-sm max-h-56 overflow-y-auto divide-y divide-slate-50">
          {!hasSuggestions && (
            <p className="text-center text-[11px] text-slate-400 p-3">No matches for "{query}"</p>
          )}
          {matchedOutlets.length > 0 && (
            <div className="p-2">
              <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wider px-1 mb-1">Outlets</p>
              {matchedOutlets.map(t => (
                <button key={t.id} onClick={() => addOutlet(t.id)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-amber-50 text-left cursor-pointer">
                  <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-[12px] text-slate-700 font-medium flex-1 truncate">{t.name}</span>
                </button>
              ))}
            </div>
          )}
          {matchedDepts.length > 0 && (
            <div className="p-2">
              <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider px-1 mb-1">Departments</p>
              {matchedDepts.map(d => (
                <button key={d} onClick={() => addDept(d)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-emerald-50 text-left cursor-pointer">
                  <Tag className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="text-[12px] text-slate-700 font-medium flex-1 truncate">{d}</span>
                  <span className="text-[10px] text-slate-400">{candidates.filter(u => u.department === d).length}</span>
                </button>
              ))}
            </div>
          )}
          {matchedRoles.length > 0 && (
            <div className="p-2">
              <p className="text-[9px] font-bold text-violet-600 uppercase tracking-wider px-1 mb-1">Roles</p>
              {matchedRoles.map(r => (
                <button key={r} onClick={() => addRole(r)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-violet-50 text-left cursor-pointer">
                  <Tag className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                  <span className="text-[12px] text-slate-700 font-medium flex-1 truncate">{r}</span>
                  <span className="text-[10px] text-slate-400">{candidates.filter(u => u.role === r).length}</span>
                </button>
              ))}
            </div>
          )}
          {matchedIndividuals.length > 0 && (
            <div className="p-2">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider px-1 mb-1">Individuals</p>
              {matchedIndividuals.map(u => (
                <button key={u.id} onClick={() => addIndividual(u.id)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left cursor-pointer">
                  <div className="w-6 h-6 rounded-full bg-[#162D4E]/10 flex items-center justify-center text-[10px] font-bold text-[#162D4E] shrink-0">{u.name.charAt(0)}</div>
                  <div className="min-w-0">
                    <p className="text-[12px] text-slate-700 font-semibold truncate">{u.name}</p>
                    <p className="text-[9px] text-slate-400 truncate">{u.role} · {u.department}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={`rounded-xl p-3 flex items-center gap-3 ${memberIds.length > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
        <Users className={`w-4 h-4 shrink-0 ${memberIds.length > 0 ? 'text-emerald-600' : 'text-amber-500'}`} />
        <p className={`text-[12px] font-bold ${memberIds.length > 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
          {memberIds.length > 0 ? `${memberIds.length} staff selected` : 'No members selected yet'}
        </p>
      </div>
    </div>
  );
}
