/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TeamTalk.tsx — Context-First Communication Layer for Horae
 * v2: 3-tab staff view (My Day | My Outlet | Directory) +
 *     Manager view with outlet switcher + channel sidebar
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, MessageCircle, Sun, Building2, Users, Hash,
  Megaphone, MessageSquare, X, Search, Plus,
  Bell, CheckSquare, GitBranch, UserCheck, ChevronDown, ChevronUp,
  Users2, Pin, Trash2, GitPullRequest, UserPlus, CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { ChatChannel, TeamTalkMessage } from '../types';
import type { User as AppUser } from '../types';
import { Role } from '../types';
import * as chatService from '../services/chatService';
import { supabase } from '../services/supabaseClient';
import { store } from '../services/store';
import TeamTalkChannelSidebar from './TeamTalkChannelSidebar';
import TeamTalkMessageBubble from './TeamTalkMessageBubble';
import TeamTalkInput from './TeamTalkInput';
import TeamTalkPinnedBanner from './TeamTalkPinnedBanner';
import TeamTalkQuickReport from './TeamTalkQuickReport';
import TeamTalkInbox from './TeamTalkInbox';

// ─── Types ────────────────────────────────────────────────────
type TalkTab = 'my-day' | 'my-outlet' | 'directory';

interface TeamTalkProps {
  activeUser: AppUser;
  tenantId: string;
  allTenantUsers: AppUser[];
  tasks?: import('../types').Task[];
  onCreateTask?: (title: string, description: string, channelId: string, msgId: string, assigneeIds: string[]) => Promise<string | undefined>;
  onBack?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────
function isManagerOrAbove(role: string) {
  return [Role.ADMIN, Role.MANAGER, Role.SUPER_ADMIN, 'Admin', 'Manager', 'Super Admin'].includes(role as any);
}

/** Map department to the keyword used in channel names */
function deptChannelKeyword(department: string): string {
  const d = department.toLowerCase();
  if (d.includes('kitchen') || d.includes('bak')) return 'kitchen';
  if (d.includes('pack') || d.includes('inventory')) return 'packing';
  if (d.includes('front') || d.includes('sales') || d.includes('desk') || d.includes('cashier')) return 'floor';
  if (d.includes('management') || d.includes('manage')) return 'managers';
  return 'general';
}

/** Render message content with @[Name](id) mentions highlighted */
export function renderMentionContent(
  content: string,
  currentUserId: string
): React.ReactNode {
  const parts = content.split(/(@\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    const m = part.match(/^@\[([^\]]+)\]\(([^)]+)\)$/);
    if (m) {
      const isMe = m[2] === currentUserId;
      return (
        <mark
          key={i}
          className={`rounded px-1.5 py-0.5 mx-0.5 font-medium not-italic transition-colors ${
            isMe ? 'bg-indigo-100/80 text-indigo-700' : 'bg-slate-100 text-slate-700'
          }`}
        >
          {m[1]}
        </mark>
      );
    }
    return part;
  });
}

// ─── Convert to Task Modal ────────────────────────────────────
function ConvertToTaskModal({
  message, onClose, onConvert, allUsers, currentUserId
}: {
  message: TeamTalkMessage;
  onClose: () => void;
  onConvert: (title: string, description: string, assigneeIds: string[]) => Promise<void>;
  allUsers: AppUser[];
  currentUserId: string;
}) {
  const [title, setTitle] = useState(message.content?.slice(0, 60) || 'New Task from Team Talk');
  const [description, setDescription] = useState(message.content || '');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([currentUserId]);
  const [converting, setConverting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (assigneeIds.length === 0) return; // Basic validation
    setConverting(true);
    await onConvert(title, description, assigneeIds);
    setConverting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-emerald-500" />
            <h3 className="text-base font-bold text-slate-800">Convert to Task</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <p className="text-[11px] text-slate-500 mb-4">
          The original thread stays in the channel. A system message will link to the new task.
        </p>
        <div className="bg-[#162D4E]/5 border border-[#162D4E]/20 rounded-xl p-3 mb-4">
          <p className="text-[10px] font-bold text-[#162D4E] uppercase tracking-wide mb-1 flex items-center gap-1">
            <MessageCircle className="w-3 h-3" /> Original message
          </p>
          <p className="text-[12px] text-slate-600 leading-relaxed line-clamp-3">
            {message.messageType === 'voice' ? '🎤 Voice message' : message.content}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Task Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#162D4E]/20"
              required
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Context / Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#162D4E]/20 resize-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-2">Assign To (Multiple allowed)</label>
            <div className="max-h-32 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl p-2 space-y-1">
              {[...allUsers].sort((a, b) => a.id === currentUserId ? -1 : 1).map(u => (
                <label key={u.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assigneeIds.includes(u.id)}
                    onChange={(e) => {
                      if (e.target.checked) setAssigneeIds([...assigneeIds, u.id]);
                      else setAssigneeIds(assigneeIds.filter(id => id !== u.id));
                    }}
                    className="w-3.5 h-3.5 text-[#162D4E] rounded border-slate-300"
                  />
                  <span className="text-[12px] text-slate-700">
                    {u.id === currentUserId ? 'Me (Self-assign)' : `${u.name} ${u.role ? `(${u.role})` : ''}`}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
            <button
              type="submit"
              disabled={converting || assigneeIds.length === 0 || !title.trim()}
              className={`flex-1 py-2.5 rounded-xl text-[12px] font-bold text-white shadow-xs transition-all ${converting || assigneeIds.length === 0 ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'}`}
            >
              {converting ? 'Creating...' : 'Create Task ✅'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}



// ─── Manage Channel Members Modal ──────────────────────────────
function ManageChannelMembersModal({
  channel, allUsers, currentMembers, currentUser, onClose, onSave,
}: {
  channel: ChatChannel;
  allUsers: AppUser[];
  currentMembers: AppUser[];
  currentUser: AppUser;
  onClose: () => void;
  onSave: (userIds: string[]) => Promise<void>;
}) {
  const [viewMode, setViewMode] = useState<'view' | 'add'>('view');
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedIndividuals, setSelectedIndividuals] = useState<string[]>([]);

  const allDepts = Array.from(new Set(allUsers.map(u => u.department).filter(Boolean)));
  const allRoles = Array.from(new Set(allUsers.map(u => u.role).filter(Boolean)));

  const currentMemberIds = currentMembers.map(u => u.id);
  const nonMembers = allUsers.filter(u => !currentMemberIds.includes(u.id));

  const previewMembers: AppUser[] = (() => {
    let result = new Set<AppUser>();
    if (selectedDepts.length > 0) nonMembers.forEach(u => selectedDepts.includes(u.department) && result.add(u));
    if (selectedRoles.length > 0) nonMembers.forEach(u => selectedRoles.includes(u.role) && result.add(u));
    if (selectedIndividuals.length > 0) nonMembers.forEach(u => selectedIndividuals.includes(u.id) && result.add(u));
    return Array.from(result);
  })();

  const canManage = currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER || currentUser.role === Role.SUPER_ADMIN || (channel.type === 'dm' && channel.createdBy === currentUser.id);

  const handleSave = async () => {
    setSaving(true);
    const newMemberIds = previewMembers.map(u => u.id);
    await onSave([...currentMemberIds, ...newMemberIds]);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
      >
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div>
            <h3 className="text-[15px] font-bold text-slate-800">
              {viewMode === 'view' ? 'Chat Members' : 'Add Members'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{channel.name ? `#${channel.name}` : 'Direct Message'}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          {viewMode === 'view' ? (
            <div className="space-y-4">
              {canManage && (
                <button
                  onClick={() => setViewMode('add')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-[12px] font-bold transition-colors cursor-pointer border border-indigo-200"
                >
                  <UserPlus className="w-4 h-4" />
                  Add New Members
                </button>
              )}
              <div className="space-y-1">
                {currentMembers.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 border border-transparent">
                    <img src={u.avatar} alt="" className="w-8 h-8 rounded-full object-cover shadow-sm" />
                    <div>
                      <span className="text-[13px] font-semibold text-slate-800 block">{u.name}</span>
                      <span className="text-[11px] text-slate-500 block">{u.role}</span>
                    </div>
                    {canManage && u.id !== currentUser.id && (
                      <button
                        onClick={async () => {
                          setSaving(true);
                          await onSave(currentMemberIds.filter(id => id !== u.id));
                          setSaving(false);
                        }}
                        className="ml-auto p-1.5 hover:bg-rose-100 text-slate-300 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                        title="Remove member"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search staff by name..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#162D4E]/20"
                />
              </div>

              <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-1">
                {searchText === '' && allDepts.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Departments</h4>
                    <div className="space-y-1 bg-slate-50 rounded-xl border border-slate-100 p-2">
                      {allDepts.map(dept => (
                        <label key={dept} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                          <input type="checkbox" checked={selectedDepts.includes(dept)} onChange={() => setSelectedDepts(p => p.includes(dept) ? p.filter(d => d !== dept) : [...p, dept])} className="w-4 h-4 accent-[#162D4E] cursor-pointer" />
                          <span className="text-[12px] text-slate-700 font-medium flex-1 truncate">{dept}</span>
                          <span className="text-[10px] text-slate-400">{nonMembers.filter(u => u.department === dept).length}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                
                {searchText === '' && allRoles.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Roles</h4>
                    <div className="space-y-1 bg-slate-50 rounded-xl border border-slate-100 p-2">
                      {allRoles.map(role => (
                        <label key={role} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                          <input type="checkbox" checked={selectedRoles.includes(role)} onChange={() => setSelectedRoles(p => p.includes(role) ? p.filter(r => r !== role) : [...p, role])} className="w-4 h-4 accent-[#162D4E] cursor-pointer" />
                          <span className="text-[12px] text-slate-700 font-medium flex-1 truncate">{role}</span>
                          <span className="text-[10px] text-slate-400">{nonMembers.filter(u => u.role === role).length}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Individuals</h4>
                  <div className="space-y-0.5 bg-slate-50 rounded-xl border border-slate-100 p-2">
                    {nonMembers.filter(u => u.name.toLowerCase().includes(searchText.toLowerCase())).map(user => (
                      <label key={user.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                        <input type="checkbox" checked={selectedIndividuals.includes(user.id)} onChange={() => setSelectedIndividuals(p => p.includes(user.id) ? p.filter(i => i !== user.id) : [...p, user.id])} className="w-4 h-4 accent-[#162D4E] cursor-pointer" />
                        <img src={user.avatar} alt="" className="w-6 h-6 rounded-md object-cover shadow-sm" />
                        <div className="min-w-0">
                          <p className="text-[12px] text-slate-700 font-semibold truncate">{user.name}</p>
                          <p className="text-[9px] text-slate-400 truncate">{user.role}</p>
                        </div>
                      </label>
                    ))}
                    {nonMembers.length === 0 && <p className="text-center text-[11px] text-slate-400 p-2">All users are already in this chat.</p>}
                  </div>
                </div>
              </div>

              <div className={`rounded-xl p-3 flex items-center gap-3 ${previewMembers.length > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                <UserCheck className={`w-4 h-4 shrink-0 ${previewMembers.length > 0 ? 'text-emerald-600' : 'text-amber-500'}`} />
                <div>
                  <p className={`text-[12px] font-bold ${previewMembers.length > 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {previewMembers.length > 0 ? `${previewMembers.length} staff will be added` : 'No new members selected'}
                  </p>
                  {previewMembers.length > 0 && (
                    <p className="text-[10px] text-emerald-600">
                      {previewMembers.slice(0, 4).map(u => u.name.split(' ')[0]).join(', ')}{previewMembers.length > 4 ? ` +${previewMembers.length - 4} more` : ''}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => setViewMode('view')} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">← Back</button>
                <button type="button" onClick={handleSave} disabled={saving || previewMembers.length === 0} className="flex-1 py-2.5 bg-[#162D4E] text-white rounded-xl text-[12px] font-bold cursor-pointer disabled:opacity-50">
                  {saving ? 'Saving...' : `Add Members ✓`}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
// ─── Create Channel Modal ─────────────────────────────────────
function CreateChannelModal({
  onClose, onCreate, allUsers, currentUserId,
}: {
  onClose: () => void;
  onCreate: (name: string, type: ChatChannel['type'], description: string, memberIds: string[]) => Promise<void>;
  allUsers: AppUser[];
  currentUserId: string;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [searchText, setSearchText] = useState('');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedIndividuals, setSelectedIndividuals] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const allDepts = Array.from(new Set([
    ...allUsers.map(u => u.department),
    ...store.getCustomDepts()
  ].filter(Boolean)));
  const allRoles = Array.from(new Set([
    ...allUsers.map(u => u.role),
    ...store.getCustomRoles()
  ].filter(Boolean)));

  const previewMembers: AppUser[] = (() => {
    let result = new Set<AppUser>();
    if (selectedDepts.length > 0) allUsers.forEach(u => selectedDepts.includes(u.department) && result.add(u));
    if (selectedRoles.length > 0) allUsers.forEach(u => selectedRoles.includes(u.role) && result.add(u));
    if (selectedIndividuals.length > 0) allUsers.forEach(u => selectedIndividuals.includes(u.id) && result.add(u));
    return Array.from(result);
  })();

  const handleCreate = async () => {
    if (!slug) return;
    setCreating(true);
    const ids = Array.from(new Set([currentUserId, ...previewMembers.map(u => u.id)]));
    await onCreate(displayName, 'channel', description, ids);
    setCreating(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Create Channel</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Step {step} of 2</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="flex gap-1 px-6 pt-3">
          <div className={`flex-1 h-1.5 rounded-full ${step >= 1 ? 'bg-[#162D4E]' : 'bg-slate-100'}`} />
          <div className={`flex-1 h-1.5 rounded-full ${step >= 2 ? 'bg-[#162D4E]' : 'bg-slate-100'}`} />
        </div>

        <div className="px-6 py-4">
          {step === 1 && (
            <form onSubmit={e => { e.preventDefault(); setStep(2); }} className="space-y-4">

              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Channel Name *</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => {
                    setDisplayName(e.target.value);
                    setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
                  }}
                  placeholder="e.g. Summer Promo Planning"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#162D4E]/20"
                  required
                />
                {slug && <p className="text-[10px] text-slate-400 mt-1">ID: <span className="font-mono text-slate-600">#{slug}</span></p>}
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Purpose</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What is this channel for?"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#162D4E]/20"
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="submit" disabled={!slug} className="flex-1 py-2.5 bg-[#162D4E] text-white rounded-xl text-[12px] font-bold cursor-pointer disabled:opacity-50">Next →</button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search staff by name..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#162D4E]/20"
                />
              </div>

              <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-1">
                {searchText === '' && allDepts.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Departments</h4>
                    <div className="space-y-1 bg-slate-50 rounded-xl border border-slate-100 p-2">
                      {allDepts.map(dept => (
                        <label key={dept} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                          <input type="checkbox" checked={selectedDepts.includes(dept)} onChange={() => setSelectedDepts(p => p.includes(dept) ? p.filter(d => d !== dept) : [...p, dept])} className="w-4 h-4 accent-[#162D4E] cursor-pointer" />
                          <span className="text-[12px] text-slate-700 font-medium flex-1 truncate">{dept}</span>
                          <span className="text-[10px] text-slate-400">{allUsers.filter(u => u.department === dept).length}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                
                {searchText === '' && allRoles.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Roles</h4>
                    <div className="space-y-1 bg-slate-50 rounded-xl border border-slate-100 p-2">
                      {allRoles.map(role => (
                        <label key={role} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                          <input type="checkbox" checked={selectedRoles.includes(role)} onChange={() => setSelectedRoles(p => p.includes(role) ? p.filter(r => r !== role) : [...p, role])} className="w-4 h-4 accent-[#162D4E] cursor-pointer" />
                          <span className="text-[12px] text-slate-700 font-medium flex-1 truncate">{role}</span>
                          <span className="text-[10px] text-slate-400">{allUsers.filter(u => u.role === role).length}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Individuals</h4>
                  <div className="space-y-0.5 bg-slate-50 rounded-xl border border-slate-100 p-2">
                    {allUsers.filter(u => u.name.toLowerCase().includes(searchText.toLowerCase())).map(user => (
                      <label key={user.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                        <input type="checkbox" checked={selectedIndividuals.includes(user.id)} onChange={() => setSelectedIndividuals(p => p.includes(user.id) ? p.filter(i => i !== user.id) : [...p, user.id])} className="w-4 h-4 accent-[#162D4E] cursor-pointer" />
                        <div className="w-6 h-6 rounded-full bg-[#162D4E]/10 flex items-center justify-center text-[10px] font-bold text-[#162D4E] shrink-0">{user.name.charAt(0)}</div>
                        <div className="min-w-0">
                          <p className="text-[12px] text-slate-700 font-semibold truncate">{user.name}</p>
                          <p className="text-[9px] text-slate-400 truncate">{user.role}</p>
                        </div>
                      </label>
                    ))}
                    {allUsers.length === 0 && <p className="text-center text-[11px] text-slate-400 p-2">No users found.</p>}
                  </div>
                </div>
              </div>

              <div className={`rounded-xl p-3 flex items-center gap-3 ${previewMembers.length > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                <UserCheck className={`w-4 h-4 shrink-0 ${previewMembers.length > 0 ? 'text-emerald-600' : 'text-amber-500'}`} />
                <div>
                  <p className={`text-[12px] font-bold ${previewMembers.length > 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {previewMembers.length > 0 ? `${previewMembers.length} staff will be added` : 'No members selected'}
                  </p>
                  {previewMembers.length > 0 && (
                    <p className="text-[10px] text-emerald-600">
                      {previewMembers.slice(0, 4).map(u => u.name.split(' ')[0]).join(', ')}{previewMembers.length > 4 ? ` +${previewMembers.length - 4} more` : ''}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(1)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">← Back</button>
                <button type="button" onClick={handleCreate} disabled={creating || previewMembers.length === 0} className="flex-1 py-2.5 bg-[#162D4E] text-white rounded-xl text-[12px] font-bold cursor-pointer disabled:opacity-50">
                  {creating ? 'Creating...' : `Create #${slug} ✓`}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Message List ─────────────────────────────────────────────
function MessageList({
  messages, currentUser, replyCounts, onReplyInThread, onStartThread, onConvertToTask, onDelete, onPin, isLoading, canPin, highlightId, threadParticipantMap, currentUserId,
}: {
  messages: TeamTalkMessage[];
  currentUser: AppUser;
  replyCounts: Record<string, number>;
  onReplyInThread: (msg: TeamTalkMessage) => void;
  onStartThread?: (msg: TeamTalkMessage) => void;
  onConvertToTask: (msg: TeamTalkMessage) => void;
  onDelete: (id: string) => void;
  onPin?: (id: string) => void;
  isLoading: boolean;
  canPin?: boolean;
  highlightId?: string;
  /** Map of messageId -> participantUserIds for thread privacy filtering */
  threadParticipantMap?: Record<string, string[]>;
  currentUserId?: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const scrolledHighlightRef = useRef<string | null>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);
  
  useEffect(() => {
    if (!highlightId) {
      scrolledHighlightRef.current = null;
      return;
    }
    if (highlightRef.current && scrolledHighlightRef.current !== highlightId) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      scrolledHighlightRef.current = highlightId;
    }
  }, [highlightId, messages]);

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#162D4E]/20 border-t-[#162D4E] rounded-full animate-spin" />
    </div>
  );

  if (messages.length === 0) return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <h3 className="text-sm font-bold text-slate-600 mb-1">No messages yet</h3>
      <p className="text-[12px] text-slate-400">Be the first to say something!</p>
    </div>
  );

  let lastDate = '';
  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 pb-32 space-y-0.5" id="message-list">
      {messages.map((msg, i) => {
        const dateStr = new Date(msg.createdAt).toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });
        const showDateSep = dateStr !== lastDate;
        if (showDateSep) lastDate = dateStr;

        const prev = messages[i - 1];
        const showAvatar = !prev || prev.senderId !== msg.senderId ||
          (new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime()) > 5 * 60 * 1000;

        // Client-side thread privacy: hide thread replies from non-participants
        const participantIds = threadParticipantMap?.[msg.id];
        // If message has a threadId (it's a reply), check if current user is a participant
        if (msg.threadId && participantIds && currentUserId && !participantIds.includes(currentUserId)) {
          return null; // hide thread reply from non-participant
        }

        return (
          <React.Fragment key={msg.id}>
            {showDateSep && (
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-[10px] font-semibold text-slate-400 px-2">{dateStr}</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
            )}
            <div ref={msg.id === highlightId ? highlightRef : undefined}>
              <TeamTalkMessageBubble
                message={msg}
                currentUser={currentUser}
                replyCount={replyCounts[msg.id] ?? 0}
                onReplyInThread={onReplyInThread}
                onStartThread={onStartThread}
                onConvertToTask={onConvertToTask}
                onDelete={onDelete}
                onPin={canPin ? onPin : undefined}
                showAvatar={showAvatar}
                isHighlighted={msg.id === highlightId}
                threadParticipantIds={threadParticipantMap?.[msg.id]}
                currentUserId={currentUserId}
              />
            </div>
          </React.Fragment>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

// ─── Thread Panel ─────────────────────────────────────────────
function ThreadPanel({
  rootMessage, replies, currentUser, allUsers, isManager,
  onSendReply, onSendVoiceReply, onClose, onConvertToTask, onDelete, onPin,
  canPin, onActivateThread, onRenameThread, onCloseThread, threadTitle,
}: {
  rootMessage: TeamTalkMessage;
  replies: TeamTalkMessage[];
  currentUser: AppUser;
  allUsers: AppUser[];
  isManager: boolean;
  onSendReply: (text: string, mentionedIds?: string[]) => Promise<void>;
  onSendVoiceReply: (blob: Blob, durationSec: number) => Promise<void>;
  onClose: () => void;
  onConvertToTask: (msg: TeamTalkMessage) => void;
  onDelete: (id: string) => void;
  onPin?: (id: string) => void;
  canPin?: boolean;
  onActivateThread?: (threadId: string, title: string) => void;
  onRenameThread?: (threadId: string, title: string) => void;
  onCloseThread?: (threadId: string) => void;
  threadTitle?: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [replies.length]);

  const isActive = rootMessage.threadStatus === 'active';
  const isClosed = rootMessage.threadStatus === 'resolved';

  const [editingTitle, setEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const currentTitle = threadTitle || rootMessage.threadTitle || (rootMessage.content ? (rootMessage.content.length > 20 ? rootMessage.content.substring(0, 20) + '...' : rootMessage.content) : 'Thread');

  return (
    <div className="w-full h-full bg-blue-50 flex flex-col" id="thread-panel">
      {/* Thread header */}
      <div className="px-4 py-3 border-b border-indigo-100/50">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
            <MessageSquare className="w-4 h-4 text-[#162D4E] shrink-0" />
            {editingTitle ? (
              <form onSubmit={e => {
                e.preventDefault();
                if (newTitle.trim() && onRenameThread) onRenameThread(rootMessage.id, newTitle.trim());
                setEditingTitle(false);
              }} className="flex-1 min-w-0">
                <input
                  autoFocus
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onBlur={() => {
                    if (newTitle.trim() && onRenameThread) onRenameThread(rootMessage.id, newTitle.trim());
                    setEditingTitle(false);
                  }}
                  className="w-full text-[12px] font-bold text-slate-800 bg-white border border-indigo-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </form>
            ) : (
              <h3 
                className={`text-[12px] font-bold text-slate-800 truncate cursor-pointer hover:text-indigo-600 transition-colors ${onRenameThread ? '' : 'pointer-events-none'}`}
                onClick={() => {
                  if (onRenameThread) {
                    setNewTitle(currentTitle);
                    setEditingTitle(true);
                  }
                }}
                title={onRenameThread ? "Click to rename" : ""}
              >
                {currentTitle}
              </h3>
            )}
            <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded-full shrink-0">{replies.length}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 cursor-pointer shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Thread status badge */}
        {isActive && (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Active Thread
          </span>
        )}
        {isClosed && (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
            Closed
          </span>
        )}
      </div>

      {/* Original message */}
      <div className="px-3 py-3 border-b border-indigo-100/50 bg-blue-50/50">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Original</p>
        <TeamTalkMessageBubble
          message={rootMessage}
          currentUser={currentUser}
          replyCount={0}
          onReplyInThread={() => {}}
          onConvertToTask={onConvertToTask}
          onDelete={onDelete}
          onPin={canPin ? onPin : undefined}
          showAvatar
          isThreadView
        />
        {/* Action buttons — any participant can act */}
        <div className="flex gap-2 mt-2">
          {!isActive && !isClosed && onActivateThread && (
            <button
              onClick={() => {
                const t = rootMessage.threadTitle || threadTitle;
                if (t) {
                  onActivateThread(rootMessage.id, t);
                } else {
                  const entered = prompt('Give this thread a short title to make it active:');
                  if (entered) onActivateThread(rootMessage.id, entered);
                }
              }}
              className="flex-1 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg border border-indigo-200 transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <Bell className="w-3 h-3" />
              Make Active
            </button>
          )}
        </div>
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {replies.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-[11px] text-slate-400">No replies yet — start the conversation!</p>
          </div>
        ) : replies.map((reply, i) => {
          const showAvatar = i === 0 || replies[i - 1].senderId !== reply.senderId;
          return (
            <TeamTalkMessageBubble
              key={reply.id}
              message={reply}
              currentUser={currentUser}
              replyCount={0}
              onReplyInThread={() => {}}
              onConvertToTask={onConvertToTask}
              onDelete={onDelete}
              showAvatar={showAvatar}
              isThreadView
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      <TeamTalkInput
        onSendText={onSendReply}
        onSendVoice={onSendVoiceReply}
        allUsers={allUsers}
        currentUser={currentUser}
        isManager={isManager}
        placeholder="Reply in thread..."
        replyingTo={null}
      />
    </div>
  );
}

// ─── Directory View ───────────────────────────────────────────
function DirectoryView({ users, currentUserId, onDM }: {
  users: AppUser[];
  currentUserId: string;
  onDM: (user: AppUser) => void;
}) {
  const [q, setQ] = useState('');
  const filtered = users
    .filter(u => u.id !== currentUserId && u.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1;
      if (b.isOnline && !a.isOnline) return 1;
      return a.name.localeCompare(b.name);
    });

  const roleOrder = ['Super Admin', 'Admin', 'Manager', 'Supervisor', 'Chef / Lead Baker', 'Baker', 'Packer', 'Cashier', 'Staff'];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search teammates..."
            className="w-full pl-9 pr-3 py-2 bg-slate-100 rounded-xl text-[12px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#162D4E]/20"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-[12px] text-slate-400">No teammates found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(user => (
              <button
                key={user.id}
                onClick={() => onDM(user)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left cursor-pointer"
              >
                <div className="relative shrink-0">
                  {user.avatar ? (
                    <img src={user.avatar.split('#')[0]} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-100" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#162D4E] to-slate-700 flex items-center justify-center text-white text-[12px] font-bold">
                      {user.name.charAt(0)}
                    </div>
                  )}
                  {user.isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-slate-800 truncate">{user.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{user.role} · {user.department}</p>
                </div>
                <MessageCircle className="w-4 h-4 text-slate-300 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}



// ─── Delete Channel Confirmation ──────────────────────────────
function DeleteChannelConfirm({
  channel, onClose, onConfirm,
}: {
  channel: ChatChannel;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Delete Channel</h3>
            <p className="text-[11px] text-slate-500">#{channel.name}</p>
          </div>
        </div>
        <p className="text-[12px] text-slate-600 mb-5">
          This will archive the channel and all its messages. Staff won't be able to see or post in it anymore. <strong>This cannot be undone.</strong>
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
          <button
            onClick={async () => { setDeleting(true); await onConfirm(); setDeleting(false); onClose(); }}
            disabled={deleting}
            className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[12px] font-bold cursor-pointer disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Yes, Delete'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function TeamTalk({
  activeUser,
  tenantId,
  allTenantUsers,
  tasks = [],
  onCreateTask,
  onBack,
}: TeamTalkProps) {
  const userIsManager = isManagerOrAbove(activeUser.role);

  // ── Channel state ──────────────────────────────────────────
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
  const [channelMembers, setChannelMembers] = useState<AppUser[]>([]);
  const [showMobileSidebar, setShowMobileSidebar] = useState(!activeChannel);

  const loadChannelMembers = async (channelId: string) => {
    const memberIds = await chatService.getChannelMemberIds(channelId);
    const members = allTenantUsers.filter(u => memberIds.includes(u.id));
    setChannelMembers(members);
  };

  useEffect(() => {
    if (!activeChannel) {
      setShowMobileSidebar(true);
    } else {
      loadChannelMembers(activeChannel.id);
    }
  }, [activeChannel]);



  const [messages, setMessages] = useState<TeamTalkMessage[]>([]);
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // ── Escalations ──────────────────────────────────────────────
  
  const [escalatedMessages, setEscalatedMessages] = useState<TeamTalkMessage[]>([]);

  // ── Thread ─────────────────────────────────────────────────
  const [threadRoot, setThreadRoot] = useState<TeamTalkMessage | null>(null);
  const [threadReplies, setThreadReplies] = useState<TeamTalkMessage[]>([]);
  /** Participants of the currently-open thread (filtered view) */
  const [threadParticipantIds, setThreadParticipantIds] = useState<string[]>([]);


  // ── Pinned ─────────────────────────────────────────────────
  const [pinnedMessage, setPinnedMessage] = useState<TeamTalkMessage | null>(null);
  const [pinnedDismissed, setPinnedDismissed] = useState(false);
  const [highlightMsgId, setHighlightMsgId] = useState<string | undefined>();

  // ── Mentions ───────────────────────────────────────────────
  const [mentionMessages, setMentionMessages] = useState<TeamTalkMessage[]>([]);
  const [mentionCount, setMentionCount] = useState(0);

  // Active & Unread threads
  const [activeThreads, setActiveThreads] = useState<TeamTalkMessage[]>([]);
  const [allThreads, setAllThreads] = useState<TeamTalkMessage[]>([]);
  const [unreadThreads, setUnreadThreads] = useState<TeamTalkMessage[]>([]);

  // ── Tabs (staff view) ──────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TalkTab>('my-day');

  // ── Modals ─────────────────────────────────────────────────
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showManageMembers, setShowManageMembers] = useState(false);
  const [convertingMessage, setConvertingMessage] = useState<TeamTalkMessage | null>(null);
  const [showQuickReport, setShowQuickReport] = useState(false);
  const [deletingChannel, setDeletingChannel] = useState<ChatChannel | null>(null);
  const [showGlobalInbox, setShowGlobalInbox] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  // ── Direct Chat ─────────────────────────────────────────────
  /** IDs of DM channels the user has explicitly "closed" — moved from sidebar to Inbox */
  const [closedDMChannelIds, setClosedDMChannelIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(`horae_closed_dms_${activeUser.id}`);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [editingChannelName, setEditingChannelName] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const realtimeUnsubRef = useRef<(() => void) | null>(null);
  const mentionUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const handlePopState = () => {
      if (threadRoot) {
         setThreadRoot(null);
         return;
      }
      if (showGlobalInbox) {
         setShowGlobalInbox(false);
         return;
      }
      if (window.innerWidth < 768 && !showMobileSidebar) {
        setShowMobileSidebar(true);
        setShowGlobalInbox(false);
        setTimeout(() => setActiveChannel(null), 300);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showMobileSidebar, showGlobalInbox, threadRoot]);

  useEffect(() => {
    const handleOpenQuickView = () => {
      setShowGlobalInbox(true);
      if (window.innerWidth < 768) {
        setShowMobileSidebar(false);
        window.history.pushState({ modal: 'teamtalk-globalinbox' }, '', window.location.href);
      }
    };
    window.addEventListener('openQuickView', handleOpenQuickView);
    return () => window.removeEventListener('openQuickView', handleOpenQuickView);
  }, []);

  // ── Load channels ──────────────────────────────────────────
  const handleSaveMembers = async (userIds: string[]) => {
    if (!activeChannel) return;
    const currentMemberIds = channelMembers.map(u => u.id);
    const toAdd = userIds.filter(id => !currentMemberIds.includes(id));
    const toRemove = currentMemberIds.filter(id => !userIds.includes(id));

    if (toAdd.length > 0) {
      await chatService.addMembers(activeChannel.id, toAdd);
    }
    if (toRemove.length > 0) {
      await chatService.removeMembers(activeChannel.id, toRemove);
    }
    await loadChannelMembers(activeChannel.id);
    setShowManageMembers(false);
  };

  const loadChannels = useCallback(async () => {
    setLoadingChannels(true);
    try {
      let raw = userIsManager
        ? await chatService.getAllChannels(tenantId, activeUser.id)
        : await chatService.getChannels(tenantId, activeUser.id);

      if (raw.length === 0) {
        await chatService.seedDefaultChannels(tenantId, activeUser.id, allTenantUsers);
        raw = userIsManager
          ? await chatService.getAllChannels(tenantId, activeUser.id)
          : await chatService.getChannels(tenantId, activeUser.id);
      }

      setChannels(raw);

      // Default to first non-announcement channel on desktop if none selected
      if (window.innerWidth >= 768) {
        const first = raw.find(c => c.type !== 'announcement') || raw[0] || null;
        setActiveChannel(prev => prev ? raw.find(c => c.id === prev.id) || prev : first);
      }
    } catch (e) { console.error('loadChannels:', e); }
    finally { setLoadingChannels(false); }
  }, [tenantId, activeUser.id, activeUser.department, userIsManager, allTenantUsers]);



  useEffect(() => {
    loadChannels();
    
    // Real-time Sync for Staff addition/removal & new Outlet Channels
    const unsub = chatService.subscribeToChannelsList(tenantId, activeUser.id, () => {
      loadChannels();
    });

    return () => { unsub(); };
  }, [loadChannels, tenantId, activeUser.id]);

  // ── Load mentions for "My Day" ─────────────────────────────
  const loadMentions = useCallback(async () => {
    const msgs = await chatService.getMentions(activeUser.id, tenantId);
    setMentionMessages(msgs);
    setMentionCount(msgs.length);
  }, [activeUser.id, tenantId]);

  useEffect(() => {
    loadMentions();
    // Subscribe to realtime mention updates
    const unsub = chatService.subscribeToMentions(activeUser.id, tenantId, loadMentions);
    mentionUnsubRef.current = unsub;
    return () => { unsub(); };
  }, [loadMentions]);

  // ── Load Active Threads ────────────────────────────────────
  const loadActiveThreads = useCallback(async () => {
    const [threads, unread, allT] = await Promise.all([
      chatService.getActiveThreads(tenantId, activeUser.id, userIsManager),
      chatService.getUnreadThreads(tenantId, activeUser.id),
      chatService.getAllThreads(tenantId, 50)
    ]);
    setActiveThreads(threads);
    setUnreadThreads(unread);
    setAllThreads(allT);
  }, [tenantId, activeUser.id, userIsManager]);

  useEffect(() => {
    loadActiveThreads();
  }, [loadActiveThreads]);

  // ── Load messages for the current tab's channel ────────────
  const loadMessages = useCallback(async (channel: ChatChannel) => {
    setLoadingMessages(true);
    setMessages([]);
    if (realtimeUnsubRef.current) { realtimeUnsubRef.current(); realtimeUnsubRef.current = null; }

    try {
      const msgs = await chatService.getMessages(channel.id, 80);
      setMessages(msgs);

      const rootIds = msgs.filter(m => !m.threadId && m.messageType !== 'system').map(m => m.id);
      const counts = await chatService.getReplyCountsBatch(rootIds);
      setReplyCounts(counts);

      await chatService.markChannelRead(channel.id, activeUser.id);
      await chatService.markMentionsRead(activeUser.id, channel.id);
      setMentionMessages(prev => {
        const remaining = prev.filter(m => m.channelId !== channel.id);
        setMentionCount(remaining.length);
        return remaining;
      });

      // Load pinned message
      const pinned = await chatService.getPinnedMessage(channel.id);
      setPinnedMessage(pinned);
      setPinnedDismissed(false);

      // Realtime subscription
      const unsub = chatService.subscribeToChannel(channel.id, (newMsg) => {
        if (!newMsg.threadId) {
          setMessages(prev => {
            const ex = prev.find(m => m.id === newMsg.id);
            return ex ? prev.map(m => m.id === newMsg.id ? newMsg : m) : [...prev, newMsg];
          });
        } else {
          setMessages(prev => prev.map(m => m.id === newMsg.id ? newMsg : m));
        }

        if (newMsg.threadId) {
          setReplyCounts(prev => ({ ...prev, [newMsg.threadId]: (prev[newMsg.threadId] || 0) + 1 }));
          setThreadRoot(root => {
            if (root?.id === newMsg.threadId) {
              setThreadReplies(rp => {
                const ex = rp.find(r => r.id === newMsg.id);
                return ex ? rp.map(r => r.id === newMsg.id ? newMsg : r) : [...rp, newMsg];
              });
            }
            return root;
          });
        }
      });
      realtimeUnsubRef.current = unsub;
    } catch (e) { console.error('loadMessages:', e); }
    finally { setLoadingMessages(false); }
  }, [activeUser.id]);

  // Reload messages when activeChannel changes
  useEffect(() => {
    if (activeChannel) {
      loadMessages(activeChannel);
    }
  }, [activeChannel?.id]);

  const loadEscalated = useCallback(async () => {
    if (!userIsManager) return;
    const msgs = await chatService.getEscalatedMessages(tenantId, activeUser.role);
    setEscalatedMessages(msgs);
  }, [tenantId, activeUser.role, userIsManager]);

  useEffect(() => {
    loadEscalated();
  }, [loadEscalated]);

  useEffect(() => () => {
    realtimeUnsubRef.current?.();
    mentionUnsubRef.current?.();
  }, []);

  // ── Handlers ───────────────────────────────────────────────
  const handleSendText = useCallback(async (text: string, mentionedUserIds?: string[], escalationRole?: string) => {
    if (!activeChannel) return;
    
    if (mentionedUserIds && mentionedUserIds.length > 0) {
      await chatService.sendMessageWithMentions({
        channelId: activeChannel.id, tenantId,
        senderId: activeUser.id, senderName: activeUser.name,
        senderRole: activeUser.role, senderAvatar: activeUser.avatar,
        content: text, mentionedUserIds,
      } as any);
    } else {
      await chatService.sendMessage({
        channelId: activeChannel.id, tenantId,
        senderId: activeUser.id, senderName: activeUser.name,
        senderRole: activeUser.role, senderAvatar: activeUser.avatar,
        content: text,
      });
    }
  }, [activeChannel, tenantId, activeUser]);

  const handleSendVoice = useCallback(async (blob: Blob, durationSec: number, escalationRole?: string) => {
    if (!activeChannel) return;
    
    await chatService.sendVoiceMessage({
      channelId: activeChannel.id, tenantId,
      senderId: activeUser.id, senderName: activeUser.name,
      senderRole: activeUser.role, senderAvatar: activeUser.avatar,
      audioBlob: blob, durationSec,
    } as any);
  }, [activeChannel, tenantId, activeUser]);

  const handleOpenThread = useCallback(async (msg: TeamTalkMessage) => {
    setThreadRoot(msg);
    window.history.pushState({ modal: 'teamtalk-thread' }, '', window.location.href);
    const [replies, participants] = await Promise.all([
      chatService.getThreadReplies(msg.id),
      chatService.getThreadParticipants(msg.id),
    ]);
    setThreadReplies(replies);
    setThreadParticipantIds(participants.length > 0 ? participants : []);
    
    // Mark thread as read
    await chatService.markThreadRead(msg.id, activeUser.id);
    setUnreadThreads(prev => prev.filter(t => t.id !== msg.id));
  }, [activeUser.id]);

  const handleNavigateToThread = useCallback(async (msg: TeamTalkMessage) => {
    const ch = channels.find(c => c.id === msg.channelId);
    if (ch) {
      const isSameChannel = activeChannel?.id === ch.id;
      setActiveChannel(ch);
      setShowGlobalInbox(false);
      setShowMobileSidebar(false);
      
      if (isSameChannel) {
        handleOpenThread(msg);
        setHighlightMsgId(undefined);
        setTimeout(() => {
          setHighlightMsgId(msg.id);
        }, 50);
      } else {
        setTimeout(() => {
          handleOpenThread(msg);
          setHighlightMsgId(msg.id);
        }, 500);
      }
    }
  }, [channels, activeChannel, handleOpenThread]);

  const handleNavigateToMention = useCallback(async (msg: TeamTalkMessage) => {
    const ch = channels.find(c => c.id === msg.channelId);
    if (ch) {
      const isSameChannel = activeChannel?.id === ch.id;
      setActiveChannel(ch);
      setShowGlobalInbox(false);
      setShowMobileSidebar(false);
      
      const doHighlight = () => {
        setHighlightMsgId(undefined);
        setTimeout(() => setHighlightMsgId(msg.id), 50);
      };

      if (isSameChannel) {
        doHighlight();
      } else {
        setTimeout(doHighlight, 500);
      }
      
      // If it's a thread reply, try to open the parent thread sidebar as well
      if (msg.threadId) {
        import('../services/chatService').then(({ getPinnedMessage }) => {
          // Just a hacky way to fetch the root message using supabase directly or chatService
          // We don't have a direct getMessage in chatService, so we'll just let it highlight in main view.
        });
      }
    }
  }, [channels, activeChannel]);

  const handleStartTemporaryThread = useCallback(async () => {
    if (!activeChannel) return;
    const newThreadMsg = await chatService.sendMessage({
      channelId: activeChannel.id, tenantId,
      senderId: activeUser.id, senderName: activeUser.name,
      senderRole: activeUser.role, senderAvatar: activeUser.avatar,
      content: "🎯 Thread Started",
      threadStatus: 'open',
      messageType: 'system'
    });
    if (newThreadMsg) {
      setMessages(prev => [...prev, newThreadMsg]);
      handleOpenThread(newThreadMsg);
    }
  }, [activeChannel, tenantId, activeUser, handleOpenThread]);

  /** Make thread active — appears in sidebar */
  const handleActivateThread = useCallback(async (threadId: string, title: string) => {
    await chatService.updateThreadStatus(threadId, 'active', title);
    setThreadRoot(prev => prev ? { ...prev, threadStatus: 'active', threadTitle: title } : null);
    setMessages(prev => prev.map(m => m.id === threadId ? { ...m, threadStatus: 'active', threadTitle: title } : m));
    // Refresh active threads in sidebar
    const updated = await chatService.getActiveThreads(tenantId, activeUser.id, userIsManager);
    setActiveThreads(updated);
  }, [tenantId, activeUser.id, userIsManager]);

  /** Rename thread inline */
  const handleRenameThread = useCallback(async (threadId: string, title: string) => {
    const status = threadRoot?.threadStatus || 'open';
    await chatService.updateThreadStatus(threadId, status as 'open' | 'active' | 'resolved', title);
    setThreadRoot(prev => prev ? { ...prev, threadTitle: title } : null);
    setMessages(prev => prev.map(m => m.id === threadId ? { ...m, threadTitle: title } : m));
    const updated = await chatService.getActiveThreads(tenantId, activeUser.id, userIsManager);
    setActiveThreads(updated);
  }, [threadRoot?.threadStatus, tenantId, activeUser.id, userIsManager]);

  /** Close thread — remove from sidebar */
  const handleCloseThread = useCallback(async (threadId: string) => {
    await chatService.closeThread(threadId);
    // Post summary to parent channel
    if (activeChannel) {
      await chatService.sendSystemMessage(
        activeChannel.id, tenantId,
        `✅ Thread "${threadRoot?.threadTitle || 'Thread'}" closed by ${activeUser.name}. ${threadReplies.length} replies.`
      );
    }
    setThreadRoot(prev => prev ? { ...prev, threadStatus: 'resolved' } : null);
    setMessages(prev => prev.map(m => m.id === threadId ? { ...m, threadStatus: 'resolved' } : m));
    const updated = await chatService.getActiveThreads(tenantId, activeUser.id, userIsManager);
    setActiveThreads(updated);
    setUnreadThreads(prev => prev.filter(t => t.id !== threadId));
  }, [activeChannel, tenantId, activeUser, threadRoot, threadReplies.length, userIsManager]);

  const handleSendReply = useCallback(async (text: string, mentionedUserIds?: string[]) => {
    if (!activeChannel || !threadRoot) return;
    if (mentionedUserIds?.length) {
      await chatService.sendMessageWithMentions({
        channelId: activeChannel.id, tenantId,
        senderId: activeUser.id, senderName: activeUser.name,
        senderRole: activeUser.role, senderAvatar: activeUser.avatar,
        content: text, mentionedUserIds, threadId: threadRoot.id, parentId: threadRoot.id,
      });
    } else {
      await chatService.sendMessage({
        channelId: activeChannel.id, tenantId,
        senderId: activeUser.id, senderName: activeUser.name,
        senderRole: activeUser.role, senderAvatar: activeUser.avatar,
        content: text, threadId: threadRoot.id, parentId: threadRoot.id,
      });
    }
  }, [activeChannel, threadRoot, tenantId, activeUser]);

  const handleSendVoiceReply = useCallback(async (blob: Blob, durationSec: number) => {
    if (!activeChannel || !threadRoot) return;
    await chatService.sendVoiceMessage({
      channelId: activeChannel.id, tenantId,
      senderId: activeUser.id, senderName: activeUser.name,
      senderRole: activeUser.role, senderAvatar: activeUser.avatar,
      audioBlob: blob, durationSec, threadId: threadRoot.id,
    });
  }, [activeChannel, threadRoot, tenantId, activeUser]);

  const handleDelete = useCallback(async (msgId: string) => {
    const msg = messages.find(m => m.id === msgId);
    await chatService.deleteMessage(msgId);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeleted: true, content: '[Message deleted]' } : m));
    if (msg && msg.threadId && !msg.isDeleted) {
      setReplyCounts(prev => ({ ...prev, [msg.threadId]: Math.max(0, (prev[msg.threadId] || 0) - 1) }));
    }
  }, [messages]);

  const handlePin = useCallback(async (msgId: string) => {
    if (!activeChannel || !userIsManager) return;
    await chatService.pinMessage(activeChannel.id, msgId, activeUser.id);
    const pinned = await chatService.getPinnedMessage(activeChannel.id);
    setPinnedMessage(pinned);
    setPinnedDismissed(false);
  }, [activeChannel, userIsManager, activeUser.id]);

  const handleUnpin = useCallback(async () => {
    if (!activeChannel) return;
    await chatService.unpinMessage(activeChannel.id);
    setPinnedMessage(null);
  }, [activeChannel]);

  const handleConvertToTask = useCallback(async (title: string, description: string, assigneeIds: string[]) => {
    if (!activeChannel || !convertingMessage || !onCreateTask) return;
    const taskId = await onCreateTask(title, description, activeChannel.id, convertingMessage.id, assigneeIds);
    if (taskId) {
      await chatService.markMessageBranched(convertingMessage.id, activeChannel.id, tenantId, taskId, title, convertingMessage.threadId);
      setMessages(prev => prev.map(m => m.id === convertingMessage.id ? { ...m, isBranched: true, branchTaskId: taskId } : m));
    }
  }, [activeChannel, convertingMessage, onCreateTask, tenantId]);

  const handleQuickReport = useCallback(async (params: {
    category: string; description: string; assigneeId: string; assigneeName: string;
  }) => {
    if (!activeChannel) return;
    // Create a task via the parent callback
    if (onCreateTask) {
      const title = `[${params.category}] ${params.description.slice(0, 60)}`;
      await onCreateTask(title, params.description, activeChannel.id, '', [params.assigneeId]);
    }
    // Post system message in the channel
    await chatService.sendSystemMessage(
      activeChannel.id, tenantId,
      `🚨 Issue reported by ${activeUser.name}: ${params.category} — "${params.description.slice(0, 80)}". Assigned to ${params.assigneeName}.`
    );
  }, [activeChannel, tenantId, activeUser, onCreateTask]);

  const handleCreateChannel = useCallback(async (
    displayName: string, type: ChatChannel['type'], description: string, memberIds: string[]
  ) => {
    const ch = await chatService.createChannel(tenantId, displayName, type, activeUser.id, description);
    if (ch) {
      await chatService.addMembers(ch.id, memberIds);
      await loadChannels();
      setActiveChannel(ch);
    }
  }, [tenantId, activeUser.id, loadChannels]);

  const handleDeleteChannel = useCallback(async () => {
    if (!deletingChannel) return;
    await chatService.deleteChannel(deletingChannel.id);
    setDeletingChannel(null);
    await loadChannels();
    setActiveChannel(null);
  }, [deletingChannel, loadChannels]);

  const handleDMUser = useCallback(async (user: AppUser) => {
    const dmName = [activeUser.name, user.name].sort().join('-');
    const existing = channels.find(c => c.type === 'dm' && (c.name.includes(user.id) || c.description?.includes(user.id)));
    if (existing) {
      setActiveChannel(existing);
      return;
    }
    const ch = await chatService.createChannel(tenantId, dmName, 'dm', activeUser.id, `DM: ${activeUser.name} & ${user.name}`);
    if (ch) {
      await chatService.addMembers(ch.id, [activeUser.id, user.id]);
      await loadChannels();
      setActiveChannel(ch);
    }
  }, [channels, activeUser, tenantId, userIsManager, loadChannels]);

  /** Close a DM — persist to localStorage and hide from sidebar (moves to Inbox) */
  const handleCloseDM = useCallback((channelId: string) => {
    setClosedDMChannelIds(prev => {
      const next = [...prev, channelId];
      localStorage.setItem(`horae_closed_dms_${activeUser.id}`, JSON.stringify(next));
      return next;
    });
    // If it was the active channel, deselect
    if (activeChannel?.id === channelId) {
      setActiveChannel(null);
      setShowGlobalInbox(true);
    }
  }, [activeUser.id, activeChannel]);

  /** Re-open a previously closed DM by channel ID */
  const handleReopenClosedDM = useCallback((channelId: string) => {
    setClosedDMChannelIds(prev => {
      const next = prev.filter(id => id !== channelId);
      localStorage.setItem(`horae_closed_dms_${activeUser.id}`, JSON.stringify(next));
      return next;
    });
    const ch = channels.find(c => c.id === channelId);
    if (ch) {
      setActiveChannel(ch);
      setShowGlobalInbox(false);
    }
  }, [activeUser.id, channels]);

  /** Create an instant untitled direct chat */
  const handleCreateInstantDM = useCallback(async () => {
    const dmName = `Untitled Chat`;
    const ch = await chatService.createChannel(tenantId, dmName, 'dm', activeUser.id, `New Direct Chat`);
    if (ch) {
      await chatService.addMembers(ch.id, [activeUser.id]);
      await loadChannels();
      setActiveChannel(ch);
      setShowGlobalInbox(false);
      setShowMobileSidebar(false);
    }
  }, [tenantId, activeUser, loadChannels]);

  const handleRenameChannel = useCallback(async () => {
    if (!activeChannel || !newChannelName.trim()) return;
    await chatService.updateChannel(activeChannel.id, { name: newChannelName.trim() });
    await loadChannels();
    setActiveChannel(prev => prev ? { ...prev, name: newChannelName.trim() } : prev);
    setEditingChannelName(false);
  }, [activeChannel, newChannelName, loadChannels]);

  // ── Announcement channel for manager ──────────────────────
  const handleCommand = useCallback(async (cmdId: string) => {
    if (cmdId === 'announce' && userIsManager) {
      const ann = channels.find(c => c.type === 'announcement');
      if (ann) setActiveChannel(ann);
    }
  }, [channels, userIsManager]);

  const isAnnouncementReadOnly = activeChannel?.type === 'announcement' && !userIsManager;

  // ── Channel type icon ──────────────────────────────────────
  function ChannelIcon({ type }: { type: ChatChannel['type'] }) {
    switch (type) {
      case 'announcement': return <Megaphone className="w-3.5 h-3.5 text-[#C5A880]" />;
      case 'outlet': return <Building2 className="w-3.5 h-3.5 text-[#C5A880]" />;
      case 'dm': return <MessageCircle className="w-3.5 h-3.5 text-[#C5A880]" />;
      default: return <Hash className="w-3.5 h-3.5 text-[#C5A880]" />;
    }
  }

  const visibleMessages = React.useMemo(() => {
    return messages.filter(m => {
      let isPrivate = false;

      // If they were mentioned directly
      if (m.mentionedUserIds?.includes(activeUser.id)) {
        isPrivate = true;
      }

      // Hide closed/resolved threads from main channel view
      if (m.threadStatus === 'closed' || m.threadStatus === 'resolved') {
        if (searchQuery) return true;
        return false;
      }

      return true;
    });
  }, [messages, activeUser.id, searchQuery]);

  // When search criteria changes, reset search index
  useEffect(() => {
    setCurrentSearchIndex(0);
  }, [searchQuery]);

  const searchResults = React.useMemo(() => {
    if (!searchQuery) return [];
    
    return visibleMessages.filter(m => {
      const query = searchQuery.toLowerCase();
      const contentMatch = m.content?.toLowerCase().includes(query) || false;
      const senderMatch = m.senderName.toLowerCase().includes(query) || false;
      const mentionMatch = query.startsWith('@') && m.senderName.toLowerCase().includes(query.slice(1).trim());
      return contentMatch || senderMatch || mentionMatch;
    }).map(m => m.id);
  }, [visibleMessages, searchQuery]);

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-white overflow-hidden" id="team-talk-container">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)] shrink-0">
        {(!activeChannel && !showGlobalInbox) && (
          <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-[#162D4E] to-[#1E3A5F] rounded-lg flex items-center justify-center shadow-sm">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-[13px] font-extrabold text-[#162D4E] leading-none">Team Talk</h1>
            <p className="text-[9px] text-slate-500 font-medium">by Horae</p>
          </div>
        </div>
        <div className="flex-1" />
        {/* Unread mention badge */}
        {mentionCount > 0 && (
          <div className="flex items-center gap-1 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            <Bell className="w-3 h-3" />
            {mentionCount} mention{mentionCount > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Overlay */}
        <AnimatePresence>
          {showMobileSidebar && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileSidebar(false)}
              className="md:hidden absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
            />
          )}
        </AnimatePresence>

        {/* ── CHANNEL SIDEBAR ───────────────── */}
        <div 
          className={`shrink-0 flex md:static absolute inset-y-0 left-0 z-50 transform transition-transform duration-300 w-full max-w-none md:w-auto md:max-w-none md:translate-x-0 ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full shadow-2xl md:shadow-none'}`}
        >
          {loadingChannels ? (
            <div className="w-full md:w-56 lg:w-64 bg-indigo-50/40 backdrop-blur-md flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-slate-200 border-t-[#C5A880] rounded-full animate-spin" />
            </div>
          ) : (
            <TeamTalkChannelSidebar
              channels={channels}
              currentUser={activeUser}
              activeChannelId={activeChannel?.id ?? null}
              onSelectChannel={ch => { 
                setActiveChannel(ch);  setThreadRoot(null); setShowGlobalInbox(false);
                if (window.innerWidth < 768) {
                  window.history.pushState({ modal: 'teamtalk-channel' }, '', window.location.href);
                }
                setShowMobileSidebar(false);
              }}
              onCreateChannel={() => { setShowCreateChannel(true); setShowMobileSidebar(false); }}
              onSearch={() => {}}
              onDeleteChannel={ch => setDeletingChannel(ch)}
              activeThreads={activeThreads}
              unreadThreads={unreadThreads}
              onOpenInbox={() => {
                setShowGlobalInbox(true);
                setShowMobileSidebar(false);
              }}
              unreadMentionCount={mentionCount}
              isInboxActive={showGlobalInbox}
              closedDMChannelIds={closedDMChannelIds}
              onCloseDM={handleCloseDM}
              onStartDirectChat={handleCreateInstantDM}
              allUsers={allTenantUsers}
              onOpenThread={handleNavigateToThread}
              onDeleteThread={handleDelete}
            />
          )}
        </div>

        {/* ── CENTER: message area ──────────────────────── */}
        <div className="flex-1 flex-col min-w-0 bg-white flex">
          {/* Main Content Area */}
          {showGlobalInbox ? (
            <TeamTalkInbox
              mentionMessages={mentionMessages}
              activeThreads={allThreads}
              unreadThreads={unreadThreads}
              currentUserId={activeUser.id}
              onMenuClick={() => setShowMobileSidebar(true)}
              onBack={() => {
                setShowGlobalInbox(false);
                if (window.innerWidth < 768) {
                  setShowMobileSidebar(true);
                }
              }}
              onOpenThread={handleNavigateToThread}
              onOpenMention={handleNavigateToMention}
              closedDMChannels={channels.filter(c => c.type === 'dm' && closedDMChannelIds.includes(c.id))}
              onReopenDM={handleReopenClosedDM}
            />
          ) : !activeChannel ? (
            <div className="flex-1 flex items-center justify-center bg-white/50 backdrop-blur-sm">
              <div className="text-center">
                <Hash className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-700">No channel selected</h3>
                <p className="text-[11px] text-slate-500 mt-1 max-w-[200px] mx-auto">Select a channel from the sidebar or create a new one to start chatting.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Channel header */}
              <div className="flex items-center gap-3 px-4 py-2.5 bg-white/50 backdrop-blur-md border-b border-white/60 shadow-sm shrink-0">
                {/* Mobile Drawer Menu Button */}
                <button 
                  onClick={() => {
                    if (window.innerWidth < 768) {
                      window.history.back();
                    } else {
                      setShowMobileSidebar(true);
                      setActiveChannel(null);
                    }
                  }} 
                  className="md:hidden p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 mr-1 shrink-0 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
                </button>
              <ChannelIcon type={activeChannel!.type} />
              <div className="min-w-0 flex-1 flex items-center gap-2">
                {editingChannelName ? (
                  <form onSubmit={e => { e.preventDefault(); handleRenameChannel(); }} className="flex-1 flex items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={newChannelName}
                      onChange={e => setNewChannelName(e.target.value)}
                      onBlur={handleRenameChannel}
                      className="text-[13px] font-bold text-slate-800 bg-white border border-indigo-200 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[200px]"
                    />
                  </form>
                ) : (
                  <div className="flex flex-col min-w-0">
                    <h2 
                      className={`text-[13px] font-bold text-slate-800 truncate ${
                        (activeChannel?.type === 'dm' || activeUser.role === Role.ADMIN || activeUser.role === Role.MANAGER || activeUser.role === Role.SUPER_ADMIN || activeChannel?.createdBy === activeUser.id)
                          ? 'cursor-pointer hover:text-indigo-600 transition-colors' 
                          : ''
                      }`}
                      onClick={() => {
                        if (activeChannel?.type === 'dm' || activeUser.role === Role.ADMIN || activeUser.role === Role.MANAGER || activeUser.role === Role.SUPER_ADMIN || activeChannel?.createdBy === activeUser.id) {
                          setNewChannelName(activeChannel!.name);
                          setEditingChannelName(true);
                        }
                      }}
                      title={(activeChannel?.type === 'dm' || activeUser.role === Role.ADMIN || activeUser.role === Role.MANAGER || activeUser.role === Role.SUPER_ADMIN || activeChannel?.createdBy === activeUser.id) ? "Click to rename" : ""}
                    >
                      {activeChannel!.name}
                    </h2>
                    {activeChannel?.description && <p className="text-[10px] text-slate-400 truncate">{activeChannel.description}</p>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                {/* View members button */}
                <button
                  onClick={() => setShowManageMembers(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-[11px] font-semibold border border-slate-200 transition-colors cursor-pointer mr-1"
                  title="View members"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Members</span>
                </button>

                {/* Search Messages */}
                <div className="flex items-center gap-1 mr-2">
                  <div className="relative hidden sm:block">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search messages..."
                      className="w-40 pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all focus:w-56"
                    />
                  </div>
                  {searchResults.length > 0 && (
                    <div className="hidden sm:flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                      <span className="text-[10px] font-medium text-indigo-600">
                        {Math.min(currentSearchIndex + 1, searchResults.length)}/{searchResults.length}
                      </span>
                      <button 
                        onClick={() => setCurrentSearchIndex(prev => prev > 0 ? prev - 1 : searchResults.length - 1)}
                        className="p-0.5 hover:bg-indigo-200 rounded cursor-pointer text-indigo-700 transition-colors"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={() => setCurrentSearchIndex(prev => prev < searchResults.length - 1 ? prev + 1 : 0)}
                        className="p-0.5 hover:bg-indigo-200 rounded cursor-pointer text-indigo-700 transition-colors"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>


                {(isManagerOrAbove(activeUser.role) || (activeChannel?.type === 'dm' && activeChannel?.createdBy === activeUser.id)) && (
                  <>
                    <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 cursor-pointer" title="Search">
                      <Search className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingChannel(activeChannel!)}
                      className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="Delete chat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          {/* Pinned banner */}
          {pinnedMessage && !pinnedDismissed && activeChannel && (
            <TeamTalkPinnedBanner
              message={pinnedMessage}
              onDismiss={() => setPinnedDismissed(true)}
              onJump={() => setHighlightMsgId(pinnedMessage.id)}
              canUnpin={userIsManager}
              onUnpin={handleUnpin}
            />
          )}

          {/* ── MESSAGE AREA ── */}
          <MessageList
                messages={visibleMessages}
                currentUser={activeUser}
                replyCounts={replyCounts}
                onReplyInThread={handleOpenThread}
                onStartThread={handleOpenThread}
                onConvertToTask={setConvertingMessage}
                onDelete={handleDelete}
                onPin={handlePin}
                isLoading={loadingMessages}
                canPin={userIsManager}
                highlightId={searchResults.length > 0 ? searchResults[Math.min(currentSearchIndex, searchResults.length - 1)] : highlightMsgId}
                threadParticipantMap={threadParticipantIds.reduce((acc, uid) => {
                  if (threadRoot) acc[threadRoot.id] = threadParticipantIds;
                  return acc;
                }, {} as Record<string, string[]>)}
                currentUserId={activeUser.id}
              />

            {/* Input */}
            <TeamTalkInput
              onSendText={handleSendText}
              onSendVoice={handleSendVoice}
              onCommand={handleCommand}
              allUsers={allTenantUsers}
              channelMembers={channelMembers}
              currentUser={activeUser}
              isManager={userIsManager}
              disabled={isAnnouncementReadOnly}
              placeholder={
                isAnnouncementReadOnly
                  ? 'Only managers can post in announcements'
                  : `Message ${activeChannel?.type === 'dm' ? activeChannel.name : `#${activeChannel?.name || '...'}`}`
              }
            />
            </>
          )}
        </div>

        {/* Thread panel */}
        <AnimatePresence>
          {threadRoot && (
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-2 md:inset-auto md:static z-50 bg-blue-50 flex flex-col border border-indigo-100 rounded-2xl shadow-xl shrink-0 md:w-[320px] md:my-4 md:mr-4 md:h-[calc(100%-2rem)] overflow-hidden"
            >
              <ThreadPanel
                rootMessage={threadRoot}
                replies={threadReplies}
                currentUser={activeUser}
                allUsers={allTenantUsers}
                isManager={userIsManager}
                onSendReply={handleSendReply}
                onSendVoiceReply={handleSendVoiceReply}
                onClose={() => { setThreadRoot(null); setThreadReplies([]); setThreadParticipantIds([]); }}
                onConvertToTask={setConvertingMessage}
                onDelete={handleDelete}
                onPin={handlePin}
                canPin={userIsManager}
                threadTitle={threadRoot.threadTitle}
                onActivateThread={handleActivateThread}
                onRenameThread={handleRenameThread}
                onCloseThread={handleCloseThread}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showManageMembers && activeChannel && (
        <ManageChannelMembersModal
          channel={activeChannel}
          allUsers={allTenantUsers}
          currentMembers={channelMembers}
          currentUser={activeUser}
          onClose={() => setShowManageMembers(false)}
          onSave={handleSaveMembers}
        />
      )}



      {showCreateChannel && (
        <CreateChannelModal
            key="create-ch"
            onClose={() => setShowCreateChannel(false)}
            onCreate={handleCreateChannel}
            allUsers={allTenantUsers}
            currentUserId={activeUser.id}
          />
        )}
        {convertingMessage && (
          <ConvertToTaskModal
            key="convert-task"
            message={convertingMessage}
            onClose={() => setConvertingMessage(null)}
            onConvert={handleConvertToTask}
            allUsers={allTenantUsers}
            currentUserId={activeUser.id}
          />
        )}
        {showQuickReport && (
          <TeamTalkQuickReport
            key="quick-report"
            currentUser={activeUser}
            teammates={allTenantUsers}
            onClose={() => setShowQuickReport(false)}
            onSubmit={async params => { await handleQuickReport(params); setShowQuickReport(false); }}
          />
        )}
        {deletingChannel && (
          <DeleteChannelConfirm
            key="delete-ch"
            channel={deletingChannel}
            onClose={() => setDeletingChannel(null)}
            onConfirm={handleDeleteChannel}
          />
        )}

      </AnimatePresence>
    </div>
  );
}
