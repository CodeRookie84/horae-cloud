/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TeamTalkChannelSidebar.tsx — Left panel: channel list with unread badges, create button,
 * and a dedicated Direct Chats section with close capability.
 */

import React, { useState } from 'react';
import {
  MessageCircle, Hash, ChevronDown, ChevronRight, Search, Plus, Trash2, Megaphone, Building2, Users, BellRing, AtSign, MessageSquarePlus, X, UserPlus, CheckCircle2
} from 'lucide-react';
import type { ChatChannel } from '../types';
import type { User as AppUser, TeamTalkMessage } from '../types';
import { Role } from '../types';

interface ChannelSidebarProps {
  channels: ChatChannel[];
  activeChannelId: string | null;
  onSelectChannel: (channel: ChatChannel) => void;
  onCreateChannel: () => void;
  currentUser: AppUser;
  onSearch: () => void;
  onDeleteChannel?: (channel: ChatChannel) => void;
  activeThreads?: TeamTalkMessage[];
  unreadThreads?: TeamTalkMessage[];
  onOpenThread?: (msg: TeamTalkMessage) => void;
  onDeleteThread?: (threadId: string) => void;
  onCloseThread?: (threadId: string) => void;
  /** Unread @mentions across all channels — used for per-row badges and the summary popover */
  mentionMessages?: TeamTalkMessage[];
  /** Called when a specific mention is clicked (from a row badge or the summary popover) */
  onOpenMention?: (msg: TeamTalkMessage) => void;
  /** IDs of DM channels that the user has "closed" — hidden from sidebar */
  closedDMChannelIds?: string[];
  /** Called when user clicks × on a DM channel to close it */
  onCloseDM?: (channelId: string) => void;
  /** Called when user clicks the + button to start a new direct chat */
  onStartDirectChat?: () => void;
  /** All tenant users — used for displaying DM partner name */
  allUsers?: AppUser[];
  /** Called when user reopens a previously-closed DM from the "Closed Direct Chats" section */
  onReopenDM?: (channelId: string) => void;
}

function getChannelIcon(type: ChatChannel['type']) {
  switch (type) {
    case 'announcement': return Megaphone;
    case 'outlet': return Building2;
    case 'department': return Users;
    case 'dm': return MessageCircle;
    case 'channel': return Users;
    case 'context': return Hash;
    default: return Hash;
  }
}

function ChannelItem({
  channel,
  isActive,
  onClick,
  onDelete,
  onClose,
  onReopen,
  activeThreads = [],
  onOpenThread,
  onDeleteThread,
  onCloseThread,
  canDeleteThread,
  mentionCount = 0,
  onMentionClick,
}: {
  channel: ChatChannel;
  isActive: boolean;
  onClick: () => void;
  onDelete?: () => void;
  onClose?: () => void;
  onReopen?: () => void;
  activeThreads?: TeamTalkMessage[];
  onOpenThread?: (msg: TeamTalkMessage) => void;
  onDeleteThread?: (threadId: string) => void;
  onCloseThread?: (threadId: string) => void;
  canDeleteThread?: boolean;
  /** Count of unread @mentions for this channel — shown as a separate badge from the unread count */
  mentionCount?: number;
  /** Called when the mention badge itself is clicked, to jump straight to that mention */
  onMentionClick?: () => void;
}) {
  const Icon = getChannelIcon(channel.type);
  const unread = channel.unreadCount ?? 0;
  const [hovered, setHovered] = useState(false);
  // Threads live nested under their chat, closed by default — the chat row only
  // shows a total count; the arrow expands to the per-thread breakdown already
  // shown below (each thread keeps its own separate unread badge).
  const [threadsExpanded, setThreadsExpanded] = useState(false);
  const totalThreadUnread = activeThreads.reduce((acc, t) => acc + (t.unreadReplyCount ?? 0), 0);
  const hasTrailingAction = Boolean(onClose || onReopen || (onDelete && channel.type !== 'dm' && channel.name !== 'general' && channel.name !== 'announcements'));

  return (
    <>
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        id={`channel-btn-${channel.id}`}
        onClick={onClick}
        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[15px] font-medium transition-all cursor-pointer group ${hasTrailingAction && activeThreads.length > 0 ? 'pr-14' : hasTrailingAction ? 'pr-8' : activeThreads.length > 0 ? 'pr-8' : ''} ${
          isActive
            ? 'bg-indigo-50 text-indigo-900 shadow-sm ring-1 ring-indigo-500/30 font-bold'
            : 'text-slate-600 hover:text-[#162D4E] hover:bg-white/50'
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-[#162D4E]'}`} />
        <span className="flex-1 truncate text-left">
          {channel.name}
        </span>
        {/* Mention badge — distinct color/shape from the unread count so the two never get confused */}
        {mentionCount > 0 && !hovered && (
          <span
            onClick={e => { e.stopPropagation(); onMentionClick?.(); }}
            className="shrink-0 flex items-center gap-0.5 bg-amber-100 text-amber-700 text-[11px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[18px] text-center cursor-pointer hover:bg-amber-200"
            title={`${mentionCount} unread mention${mentionCount > 1 ? 's' : ''} — click to view`}
          >
            <AtSign className="w-2.5 h-2.5" />
            {mentionCount > 9 ? '9+' : mentionCount}
          </span>
        )}
        {/* Unread badge */}
        {unread > 0 && !hovered && (
          <span className="shrink-0 bg-rose-500 text-white text-[11px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Threads toggle — closed by default; shows the total, expands to the per-thread breakdown below */}
      {activeThreads.length > 0 && onOpenThread && (
        <button
          onClick={e => { e.stopPropagation(); setThreadsExpanded(v => !v); }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1 py-0.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer z-10"
          title={`${activeThreads.length} thread${activeThreads.length > 1 ? 's' : ''}${totalThreadUnread > 0 ? ` — ${totalThreadUnread} unread repl${totalThreadUnread > 1 ? 'ies' : 'y'}` : ''}`}
          style={hasTrailingAction ? { right: '1.75rem' } : undefined}
        >
          {totalThreadUnread > 0 && (
            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-extrabold px-1 py-0.5 rounded-full min-w-[16px] text-center">
              {totalThreadUnread > 99 ? '99+' : totalThreadUnread}
            </span>
          )}
          {threadsExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      )}

      {/* Close DM button — always visible alongside the chat name, not just on hover */}
      {onClose && (
        <button
          onClick={e => { e.stopPropagation(); onClose(); }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer z-10"
          title="Move to Closed chats"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Reopen DM button — shown in the Closed Direct Chats section */}
      {onReopen && (
        <button
          onClick={e => { e.stopPropagation(); onReopen(); }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer z-10"
          title="Reopen chat"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Delete channel button (hover, non-core channels, non-DM) */}
      {onDelete && hovered && channel.type !== 'dm' && channel.name !== 'general' && channel.name !== 'announcements' && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer z-10"
          title="Delete channel"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>

    {/* Active Threads Nested — closed by default, toggled via the arrow in the row above */}
    {activeThreads.length > 0 && onOpenThread && threadsExpanded && (
      <div className="pl-6 pr-2 py-1 space-y-1 relative before:content-[''] before:absolute before:left-4 before:top-0 before:bottom-3 before:w-px before:bg-slate-200">
        {activeThreads.map(thread => (
          <div key={thread.id} className="relative group/thread-wrapper">
            <button
              onClick={(e) => { e.stopPropagation(); onOpenThread(thread); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-pointer text-slate-600 hover:text-indigo-700 hover:bg-indigo-50/50 group/thread relative before:content-[''] before:absolute before:-left-2 before:top-1/2 before:w-2 before:h-px before:bg-slate-200 pr-6"
            >
              <MessageCircle className="w-3.5 h-3.5 text-indigo-400 group-hover/thread:text-indigo-600 shrink-0" />
              <span className="flex-1 truncate text-left">
                {thread.threadTitle || "Active Thread"}
              </span>
              {/* Unread-reply badge — distinct from the channel-level unread pill so threads read as their own thing */}
              {!!thread.unreadReplyCount && (
                <span className="shrink-0 border border-indigo-300 text-indigo-600 text-[10px] font-extrabold px-1 py-0.5 rounded-full min-w-[16px] text-center">
                  {thread.unreadReplyCount > 99 ? '99+' : thread.unreadReplyCount}
                </span>
              )}
            </button>
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover/thread-wrapper:opacity-100 transition-all">
              {onCloseThread && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCloseThread(thread.id); }}
                  className="p-1 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 rounded transition-all cursor-pointer"
                  title="Close thread"
                >
                  <CheckCircle2 className="w-3 h-3" />
                </button>
              )}
              {canDeleteThread && onDeleteThread && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteThread(thread.id); }}
                  className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-all cursor-pointer"
                  title="Delete thread"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
    </>
  );
}

export default function TeamTalkChannelSidebar({
  channels,
  activeChannelId,
  onSelectChannel,
  onCreateChannel,
  currentUser,
  onSearch,
  onDeleteChannel,
  activeThreads = [],
  unreadThreads = [],
  onOpenThread,
  mentionMessages = [],
  onOpenMention,
  closedDMChannelIds = [],
  onCloseDM,
  onStartDirectChat,
  allUsers = [],
  onDeleteThread,
  onCloseThread,
  onReopenDM,
}: ChannelSidebarProps) {
  const canManageChannels = currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER || currentUser.role === Role.SUPER_ADMIN;
  // Channel create/delete/add-member is client-admin only (Manager/Supervisor cannot)
  const isClientAdmin = currentUser.role === Role.ADMIN || currentUser.role === Role.SUPER_ADMIN;

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matchesQuery = (c: ChatChannel) => !q || c.name.toLowerCase().includes(q);

  // Visible DM channels (not closed)
  const visibleDMChannels = channels.filter(c => c.type === 'dm' && !closedDMChannelIds.includes(c.id) && matchesQuery(c));
  // Closed DM channels — shown in their own section at the bottom of the sidebar
  const closedDMChannels = channels.filter(c => c.type === 'dm' && closedDMChannelIds.includes(c.id) && matchesQuery(c));
  // Group and Channel channels
  const groupChannelsList = channels.filter(c => (c.type === 'channel' || c.type === 'department') && matchesQuery(c));
  const otherChannelsList = channels.filter(c => c.type !== 'dm' && c.type !== 'channel' && c.type !== 'department' && matchesQuery(c));

  // Split each category into unread and read
  const dmUnread = visibleDMChannels.filter(c => (c.unreadCount ?? 0) > 0);
  const dmRead = visibleDMChannels.filter(c => (c.unreadCount ?? 0) === 0);
  const groupsUnread = groupChannelsList.filter(c => (c.unreadCount ?? 0) > 0);
  const groupsRead = groupChannelsList.filter(c => (c.unreadCount ?? 0) === 0);
  const channelsUnread = otherChannelsList.filter(c => (c.unreadCount ?? 0) > 0);
  const channelsRead = otherChannelsList.filter(c => (c.unreadCount ?? 0) === 0);

  const hasUnreadSection = dmUnread.length > 0 || groupsUnread.length > 0 || channelsUnread.length > 0;
  const hasReadSection = dmRead.length > 0 || groupsRead.length > 0 || channelsRead.length > 0;
  const hasNoChannels = visibleDMChannels.length === 0 && groupChannelsList.length === 0 && otherChannelsList.length === 0;

  // Group unread mentions by channel — most recent first — for per-row badges and the summary popover
  const mentionsByChannel = new Map<string, TeamTalkMessage[]>();
  mentionMessages.forEach(m => {
    const list = mentionsByChannel.get(m.channelId) ?? [];
    list.push(m);
    mentionsByChannel.set(m.channelId, list);
  });
  const channelNameById = new Map(channels.map(c => [c.id, c.name]));

  const [summaryOpen, setSummaryOpen] = useState(false);

  // Reusable sub-section: a collapsible mini-header + list
  function SubSection({
    label, icon: Icon, channels: items, bgClass, iconClass, badgeClass, onAdd, onAddTitle,
    onClose, onReopen, onDelete, onDeleteThread, onCloseThread,
    alwaysShow = false
  }: {
    label: string; icon: React.ElementType; channels: ChatChannel[];
    bgClass: string; iconClass: string; badgeClass: string;
    onAdd?: () => void; onAddTitle?: string;
    onClose?: (id: string) => void; onReopen?: (id: string) => void; onDelete?: (ch: ChatChannel) => void;
    onDeleteThread?: (threadId: string) => void;
    onCloseThread?: (threadId: string) => void;
    alwaysShow?: boolean;
  }) {
    const [collapsed, setCollapsed] = useState(false);
    const sectionUnread = items.reduce((s, ch) => s + (ch.unreadCount || 0), 0);
    if (items.length === 0 && !alwaysShow) return null;
    return (
      <div className="space-y-0.5">
        <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg ${bgClass}`}>
          <button onClick={() => setCollapsed(v => !v)} className="flex-1 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider cursor-pointer text-left">
            {collapsed ? <ChevronRight className={`w-3 h-3 ${iconClass}`} /> : <ChevronDown className={`w-3 h-3 ${iconClass}`} />}
            <span className="flex-1">{label}</span>
            {sectionUnread > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-extrabold ${badgeClass}`}>{sectionUnread}</span>
            )}
          </button>
          {onAdd && (
            <button onClick={onAdd} className={`p-1.5 rounded-md hover:bg-white/50 transition-colors cursor-pointer ${iconClass}`} title={onAddTitle}>
              <UserPlus className="w-4 h-4" />
            </button>
          )}
        </div>
        {!collapsed && (
          <div className="space-y-0.5 pl-1">
            {items.length === 0 && alwaysShow && (
              <div className="px-3 py-4 text-center text-slate-400 text-[13px] font-medium italic">
                No {label.toLowerCase()} available.
              </div>
            )}
            {items.map(ch => {
              const chThreadsMap = new Map<string, TeamTalkMessage>();
              activeThreads?.filter(t => t.channelId === ch.id).forEach(t => chThreadsMap.set(t.id, t));
              unreadThreads?.filter(t => t.channelId === ch.id).forEach(t => chThreadsMap.set(t.id, t));
              // Closing (hiding) a DM from your own sidebar is personal/local — any participant can do it.
              const canCloseDM = Boolean(onClose);
              const chMentions = mentionsByChannel.get(ch.id) ?? [];

              return (
                <ChannelItem
                  key={ch.id}
                  channel={ch}
                  isActive={ch.id === activeChannelId}
                  onClick={() => onSelectChannel(ch)}
                  onClose={canCloseDM ? () => onClose(ch.id) : undefined}
                  onReopen={onReopen ? () => onReopen(ch.id) : undefined}
                  onDelete={onDelete ? () => onDelete(ch) : undefined}
                  activeThreads={Array.from(chThreadsMap.values())}
                  onOpenThread={onOpenThread}
                  onDeleteThread={onDeleteThread}
                  onCloseThread={onCloseThread}
                  canDeleteThread={canManageChannels || ch.createdBy === currentUser.id}
                  mentionCount={chMentions.length}
                  onMentionClick={chMentions[0] && onOpenMention ? () => onOpenMention(chMentions[0]) : undefined}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className="w-full md:w-56 lg:w-64 shrink-0 bg-white flex flex-col border-r border-slate-200/60" id="team-talk-sidebar">
      {/* Header */}
      <div className="p-3 border-b border-slate-100 bg-white relative z-10">
        {searchOpen ? (
          <div className="flex items-stretch gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search channels & chats..."
                className="w-full pl-8 pr-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-[14px] text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
            <button
              onClick={() => { setSearchOpen(false); setQuery(''); }}
              className="shrink-0 flex items-center justify-center p-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-500 rounded-xl transition-colors cursor-pointer"
              title="Close search"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl px-3 py-2 text-slate-500 hover:text-slate-700 transition-all cursor-pointer"
            title="Search channels..."
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[13px] font-medium">Search channels & chats...</span>
          </button>
        )}
      </div>

      {/* Channel list */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-3" id="channel-list">

        {/* Mentions summary — a jump shortcut into the same rows below, not a separate inbox.
            Threads are intentionally excluded: they already live under their own chat row
            (collapsed by default, with a total + per-thread counts), so listing them here too
            would just be the same numbers shown twice. */}
        {mentionMessages.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setSummaryOpen(v => !v)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-bold transition-all cursor-pointer ${
                summaryOpen ? 'bg-amber-100 text-amber-800' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              <BellRing className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1 text-left truncate">
                {mentionMessages.length} mention{mentionMessages.length > 1 ? 's' : ''}
              </span>
              {summaryOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
            </button>

            {summaryOpen && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 max-h-72 overflow-y-auto py-1">
                {mentionMessages.map(m => (
                  <button
                    key={`mention-${m.id}`}
                    onClick={() => { onOpenMention?.(m); setSummaryOpen(false); }}
                    className="w-full flex items-start gap-2 px-3 py-2 hover:bg-amber-50 text-left cursor-pointer"
                  >
                    <AtSign className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-slate-700 truncate">{channelNameById.get(m.channelId) || 'Chat'}</p>
                      <p className="text-[12px] text-slate-500 truncate">{m.senderName}: {m.content || 'Voice message'}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {hasNoChannels && (
          <div className="px-4 py-3 text-center text-slate-500 bg-slate-50 rounded-xl mb-4 border border-slate-100">
            <p className="text-[14px] font-medium">{q ? `No matches for "${query}".` : 'No channels found.'}</p>
            {!q && <p className="text-[12px] mt-1 text-slate-400">Use the + buttons to create new spaces.</p>}
          </div>
        )}

        <>
            {/* ═══ UNREAD GROUP ═══ */}
            {hasUnreadSection && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 px-1 pt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></div>
                  <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Unread</span>
                </div>
                <SubSection
                  label="Direct Chats" icon={MessageCircle} channels={dmUnread}
                  bgClass="bg-sky-50 text-sky-800" iconClass="text-sky-500" badgeClass="bg-sky-200 text-sky-900"
                  onAdd={onStartDirectChat} onAddTitle="Start direct chat"
                  onClose={onCloseDM}
                  onDeleteThread={onDeleteThread}
                  onCloseThread={onCloseThread}
                />
                <SubSection
                  label="Channels" icon={Users} channels={groupsUnread}
                  bgClass="bg-emerald-50 text-emerald-800" iconClass="text-emerald-500" badgeClass="bg-emerald-200 text-emerald-900"
                  onAdd={isClientAdmin ? onCreateChannel : undefined} onAddTitle="Add member"
                  onDelete={isClientAdmin ? onDeleteChannel : undefined}
                  onDeleteThread={onDeleteThread}
                  onCloseThread={onCloseThread}
                />
                <SubSection
                  label="Rooms" icon={Hash} channels={channelsUnread}
                  bgClass="bg-violet-50 text-violet-800" iconClass="text-violet-500" badgeClass="bg-violet-200 text-violet-900"
                  onDelete={isClientAdmin ? onDeleteChannel : undefined}
                  onDeleteThread={onDeleteThread}
                  onCloseThread={onCloseThread}
                />
              </div>
            )}

            {/* ═══ READ GROUP ═══ */}
            {(hasReadSection || hasNoChannels) && (
              <div className="space-y-1.5 mt-4">
                <div className="flex items-center gap-1.5 px-1 pt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0"></div>
                  <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Everything Else</span>
                </div>
                <SubSection
                  label="Direct Messages" icon={MessageCircle} channels={dmRead}
                  bgClass="bg-sky-50/60 text-sky-700" iconClass="text-sky-400" badgeClass="bg-sky-100 text-sky-800"
                  onAdd={onStartDirectChat} onAddTitle="Start direct chat"
                  onClose={onCloseDM}
                  onDeleteThread={onDeleteThread}
                  onCloseThread={onCloseThread}
                  alwaysShow={true}
                />
                <SubSection
                  label="Channels" icon={Users} channels={groupsRead}
                  bgClass="bg-emerald-50/60 text-emerald-700" iconClass="text-emerald-400" badgeClass="bg-emerald-100 text-emerald-800"
                  onAdd={isClientAdmin ? onCreateChannel : undefined} onAddTitle="Add member"
                  onDelete={isClientAdmin ? onDeleteChannel : undefined}
                  onDeleteThread={onDeleteThread}
                  onCloseThread={onCloseThread}
                  alwaysShow={true}
                />
                <SubSection
                  label="Rooms" icon={Hash} channels={channelsRead}
                  bgClass="bg-violet-50/60 text-violet-700" iconClass="text-violet-400" badgeClass="bg-violet-100 text-violet-800"
                  onDelete={isClientAdmin ? onDeleteChannel : undefined}
                  onDeleteThread={onDeleteThread}
                  onCloseThread={onCloseThread}
                  alwaysShow={true}
                />
              </div>
            )}

            {/* ═══ CLOSED DIRECT CHATS — always last ═══ */}
            {closedDMChannels.length > 0 && (
              <div className="space-y-1.5 mt-4">
                <div className="flex items-center gap-1.5 px-1 pt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0"></div>
                  <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Closed Direct Chats</span>
                </div>
                <SubSection
                  label="Closed Direct Chats" icon={MessageCircle} channels={closedDMChannels}
                  bgClass="bg-slate-100 text-slate-600" iconClass="text-slate-400" badgeClass="bg-slate-200 text-slate-700"
                  onReopen={onReopenDM}
                  alwaysShow={true}
                />
              </div>
            )}
          </>
      </nav>

      {/* Current user footer */}
      <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-3 relative z-10">
        {currentUser.avatar ? (
          <img src={currentUser.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-sm" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#162D4E] to-[#1E3A5F] shadow-sm flex items-center justify-center text-white text-[13px] font-bold">
            {currentUser.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-slate-700 truncate leading-none">{currentUser.name}</p>
          <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">{currentUser.role}</p>
        </div>
        <div className="flex h-2.5 w-2.5 relative shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-sm" />
        </div>
      </div>
    </aside>
  );
}
