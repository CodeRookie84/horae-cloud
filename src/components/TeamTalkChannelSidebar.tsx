/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TeamTalkChannelSidebar.tsx — Left panel: channel list with unread badges, create button,
 * and a dedicated Direct Chats section with close capability.
 */

import React, { useState } from 'react';
import {
  MessageCircle, Hash, ChevronDown, ChevronRight, Search, Plus, Trash2, Megaphone, Building2, Users, BellRing, Inbox, MessageSquarePlus, X, UserPlus, CheckCircle2
} from 'lucide-react';
import type { ChatChannel } from '../types';
import type { User as AppUser } from '../types';
import { Role } from '../types';

interface ChannelGroup {
  label: string;
  icon: React.ElementType;
  channels: ChatChannel[];
}

interface ChannelSidebarProps {
  channels: ChatChannel[];
  activeChannelId: string | null;
  onSelectChannel: (channel: ChatChannel) => void;
  onCreateChannel: () => void;
  currentUser: AppUser;
  onSearch: () => void;
  onDeleteChannel?: (channel: ChatChannel) => void;
  activeThreads?: import('../types').TeamTalkMessage[];
  unreadThreads?: import('../types').TeamTalkMessage[];
  onOpenThread?: (msg: import('../types').TeamTalkMessage) => void;
  onDeleteThread?: (threadId: string) => void;
  onCloseThread?: (threadId: string) => void;
  onOpenInbox?: () => void;
  unreadMentionCount?: number;
  isInboxActive?: boolean;
  /** IDs of DM channels that the user has "closed" — hidden from sidebar */
  closedDMChannelIds?: string[];
  /** Called when user clicks × on a DM channel to close it */
  onCloseDM?: (channelId: string) => void;
  /** Called when user clicks the + button to start a new direct chat */
  onStartDirectChat?: () => void;
  /** All tenant users — used for displaying DM partner name */
  allUsers?: AppUser[];
}

const TYPE_ORDER: ChatChannel['type'][] = ['announcement', 'outlet', 'department', 'channel', 'dm', 'context'];

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

function groupChannels(channels: ChatChannel[], closedDMChannelIds: string[]): ChannelGroup[] {
  const sortByActivity = (a: ChatChannel, b: ChatChannel) => {
    const timeA = a.lastMessage?.createdAt || a.createdAt;
    const timeB = b.lastMessage?.createdAt || b.createdAt;
    return new Date(timeB).getTime() - new Date(timeA).getTime();
  };

  const visibleChannels = channels.filter(c => !(c.type === 'dm' && closedDMChannelIds.includes(c.id)));
  
  // Combine unread and read, but sort unread first, then by activity
  const sortUnreadFirst = (list: ChatChannel[]) => {
    const unread = list.filter(c => (c.unreadCount ?? 0) > 0).sort(sortByActivity);
    const read = list.filter(c => (c.unreadCount ?? 0) === 0).sort(sortByActivity);
    return [...unread, ...read];
  };

  const groups: ChannelGroup[] = [
    { label: 'Channels', icon: Users, channels: sortUnreadFirst(visibleChannels.filter(c => c.type === 'channel' || c.type === 'department')) },
    { label: 'Rooms', icon: Hash, channels: sortUnreadFirst(visibleChannels.filter(c => c.type !== 'dm' && c.type !== 'channel' && c.type !== 'department')) },
  ];
  return groups.filter(g => g.channels.length > 0);
}

function ChannelItem({
  channel,
  isActive,
  onClick,
  onDelete,
  onClose,
  activeThreads = [],
  onOpenThread,
  onDeleteThread,
  onCloseThread,
  canDeleteThread,
}: {
  channel: ChatChannel;
  isActive: boolean;
  onClick: () => void;
  onDelete?: () => void;
  onClose?: () => void;
  activeThreads?: import('../types').TeamTalkMessage[];
  onOpenThread?: (msg: import('../types').TeamTalkMessage) => void;
  onDeleteThread?: (threadId: string) => void;
  onCloseThread?: (threadId: string) => void;
  canDeleteThread?: boolean;
}) {
  const Icon = getChannelIcon(channel.type);
  const unread = channel.unreadCount ?? 0;
  const [hovered, setHovered] = useState(false);

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
        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[13px] font-medium transition-all cursor-pointer group pr-8 ${
          isActive
            ? 'bg-indigo-50 text-indigo-900 shadow-sm ring-1 ring-indigo-500/30 font-bold'
            : 'text-slate-600 hover:text-[#162D4E] hover:bg-white/50'
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-[#162D4E]'}`} />
        <span className="flex-1 truncate text-left">
          {channel.name}
        </span>
        {/* Unread badge */}
        {unread > 0 && !hovered && (
          <span className="shrink-0 bg-rose-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Close DM button (always on hover) */}
      {hovered && onClose && (
        <button
          onClick={e => { e.stopPropagation(); onClose(); }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer z-10"
          title="Move to Closed chats"
        >
          <X className="w-3.5 h-3.5" />
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

    {/* Active Threads Nested */}
    {activeThreads.length > 0 && onOpenThread && (
      <div className="pl-6 pr-2 py-1 space-y-1 relative before:content-[''] before:absolute before:left-4 before:top-0 before:bottom-3 before:w-px before:bg-slate-200">
        {activeThreads.map(thread => (
          <div key={thread.id} className="relative group/thread-wrapper">
            <button
              onClick={(e) => { e.stopPropagation(); onOpenThread(thread); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer text-slate-600 hover:text-indigo-700 hover:bg-indigo-50/50 group/thread relative before:content-[''] before:absolute before:-left-2 before:top-1/2 before:w-2 before:h-px before:bg-slate-200 pr-6"
            >
              <MessageCircle className="w-3.5 h-3.5 text-indigo-400 group-hover/thread:text-indigo-600 shrink-0" />
              <span className="flex-1 truncate text-left">
                {thread.threadTitle || "Active Thread"}
              </span>
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

function ChannelGroupSection({
  group,
  activeChannelId,
  onSelectChannel,
  canCreate,
  onCreateChannel,
  onDeleteChannel,
  activeThreads,
  unreadThreads,
  onOpenThread,
  onDeleteThread,
  onCloseThread,
}: {
  group: ChannelGroup;
  activeChannelId: string | null;
  onSelectChannel: (ch: ChatChannel) => void;
  canCreate?: boolean;
  onCreateChannel?: () => void;
  onDeleteChannel?: (ch: ChatChannel) => void;
  activeThreads?: import('../types').TeamTalkMessage[];
  unreadThreads?: import('../types').TeamTalkMessage[];
  onOpenThread?: (msg: import('../types').TeamTalkMessage) => void;
  onDeleteThread?: (id: string) => void;
  onCloseThread?: (id: string) => void;
}) {
  const Icon = group.icon;
  const [collapsed, setCollapsed] = useState(false);
  const unreadCount = group.channels.reduce((sum, ch) => sum + (ch.unreadCount || 0), 0);
  
  const bgClass = group.label === 'Groups' ? 'bg-emerald-50 text-emerald-800' : 'bg-violet-50 text-violet-800';
  const iconClass = group.label === 'Groups' ? 'text-emerald-500' : 'text-violet-500';
  const badgeClass = group.label === 'Groups' ? 'bg-emerald-200 text-emerald-900' : 'bg-violet-200 text-violet-900';

  return (
    <div className="mb-4 space-y-1">
      <div className={`flex items-center justify-between px-3 py-1.5 rounded-lg ${bgClass}`}>
        <button
          onClick={() => setCollapsed(v => !v)}
          className="flex-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer text-left"
        >
          {collapsed ? <ChevronRight className={`w-3.5 h-3.5 ${iconClass}`} /> : <ChevronDown className={`w-3.5 h-3.5 ${iconClass}`} />}
          <span className="flex-1">{group.label}</span>
          {unreadCount > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-extrabold shadow-sm ${badgeClass}`}>
              {unreadCount}
            </span>
          )}
        </button>
        <div className="flex items-center gap-1 shrink-0">
          {group.label === 'Groups' && canCreate && (
            <button
              onClick={onCreateChannel}
              className={`p-1 rounded-md hover:bg-white/50 transition-colors cursor-pointer ${iconClass}`}
              title="Add member"
            >
              <UserPlus className="w-3.5 h-3.5" />
            </button>
          )}
          {canCreate && onCreateChannel && group.label !== 'Groups' && (
            <button
              onClick={onCreateChannel}
              className={`p-1 rounded-md hover:bg-white/50 transition-colors cursor-pointer ${iconClass}`}
              title="Create channel"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {!collapsed && (
        <div className="space-y-0.5 pl-1">
          {group.channels.map(ch => {
            const channelThreadsMap = new Map<string, import('../types').TeamTalkMessage>();
            activeThreads?.filter(t => t.channelId === ch.id).forEach(t => channelThreadsMap.set(t.id, t));
            unreadThreads?.filter(t => t.channelId === ch.id).forEach(t => channelThreadsMap.set(t.id, t));
            const channelThreads = Array.from(channelThreadsMap.values());

            return (
              <ChannelItem
                key={ch.id}
                channel={ch}
                isActive={ch.id === activeChannelId}
                onClick={() => onSelectChannel(ch)}
                onDelete={onDeleteChannel ? () => onDeleteChannel(ch) : undefined}
                activeThreads={channelThreads}
                onOpenThread={onOpenThread}
                onDeleteThread={onDeleteThread}
                onCloseThread={onCloseThread}
              />
            );
          })}
        </div>
      )}
    </div>
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
  onOpenInbox,
  unreadMentionCount = 0,
  isInboxActive = false,
  closedDMChannelIds = [],
  onCloseDM,
  onStartDirectChat,
  allUsers = [],
  onDeleteThread,
  onCloseThread,
}: ChannelSidebarProps) {
  const canManageChannels = currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER || currentUser.role === Role.SUPER_ADMIN;

  // Visible DM channels (not closed)
  const visibleDMChannels = channels.filter(c => c.type === 'dm' && !closedDMChannelIds.includes(c.id));
  // Group and Channel channels
  const groupChannelsList = channels.filter(c => c.type === 'channel' || c.type === 'department');
  const otherChannelsList = channels.filter(c => c.type !== 'dm' && c.type !== 'channel' && c.type !== 'department');

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

  const totalUnreadMsgs = unreadMentionCount + unreadThreads.reduce((acc, t) => acc + (t.unreadReplyCount ?? 1), 0);

  // Reusable sub-section: a collapsible mini-header + list
  function SubSection({
    label, icon: Icon, channels: items, bgClass, iconClass, badgeClass, onAdd, onAddTitle,
    onClose, onDelete, onDeleteThread, onCloseThread,
    alwaysShow = false
  }: {
    label: string; icon: React.ElementType; channels: ChatChannel[];
    bgClass: string; iconClass: string; badgeClass: string;
    onAdd?: () => void; onAddTitle?: string;
    onClose?: (id: string) => void; onDelete?: (ch: ChatChannel) => void;
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
          <button onClick={() => setCollapsed(v => !v)} className="flex-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer text-left">
            {collapsed ? <ChevronRight className={`w-3 h-3 ${iconClass}`} /> : <ChevronDown className={`w-3 h-3 ${iconClass}`} />}
            <span className="flex-1">{label}</span>
            {sectionUnread > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-extrabold ${badgeClass}`}>{sectionUnread}</span>
            )}
          </button>
          {onAdd && (
            <button onClick={onAdd} className={`p-1 rounded-md hover:bg-white/50 transition-colors cursor-pointer ${iconClass}`} title={onAddTitle}>
              <UserPlus className="w-3 h-3" />
            </button>
          )}
        </div>
        {!collapsed && (
          <div className="space-y-0.5 pl-1">
            {items.length === 0 && alwaysShow && (
              <div className="px-3 py-4 text-center text-slate-400 text-[11px] font-medium italic">
                No {label.toLowerCase()} available.
              </div>
            )}
            {items.map(ch => {
              const chThreadsMap = new Map<string, import('../types').TeamTalkMessage>();
              activeThreads?.filter(t => t.channelId === ch.id).forEach(t => chThreadsMap.set(t.id, t));
              unreadThreads?.filter(t => t.channelId === ch.id).forEach(t => chThreadsMap.set(t.id, t));
              const isChatAdmin = ch.createdBy === currentUser.id;
              const isClientAdmin = currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER || currentUser.role === Role.SUPER_ADMIN;
              const canCloseDM = onClose && (isChatAdmin || isClientAdmin);

              return (
                <ChannelItem
                  key={ch.id}
                  channel={ch}
                  isActive={ch.id === activeChannelId}
                  onClick={() => onSelectChannel(ch)}
                  onClose={canCloseDM ? () => onClose(ch.id) : undefined}
                  onDelete={onDelete ? () => onDelete(ch) : undefined}
                  activeThreads={Array.from(chThreadsMap.values())}
                  onOpenThread={onOpenThread}
                  onDeleteThread={onDeleteThread}
                  onCloseThread={onCloseThread}
                  canDeleteThread={canManageChannels || ch.createdBy === currentUser.id}
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
        <div className="flex items-stretch gap-2">
          <button
            onClick={onSearch}
            className="flex-1 flex items-center gap-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl px-3 py-2 text-slate-500 hover:text-slate-700 transition-all cursor-pointer"
            title="Search channels..."
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[11px] font-medium hidden sm:inline">Search...</span>
          </button>
          {canManageChannels && (
            <button
              onClick={onCreateChannel}
              id="btn-create-channel"
              className="shrink-0 flex items-center justify-center p-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer"
              title="Create new channel"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Channel list */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-3" id="channel-list">

        {/* Quick View — styled like section headers */}
        {onOpenInbox && (
          <button
            onClick={onOpenInbox}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all cursor-pointer text-[10px] font-bold uppercase tracking-wider ${
              isInboxActive
                ? 'bg-slate-700 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Inbox className={`w-3.5 h-3.5 ${isInboxActive ? 'text-slate-200' : 'text-slate-500'}`} />
              <span>Quick View</span>
            </div>
            <div className="flex items-center gap-1.5">
              {totalUnreadMsgs > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-extrabold ${isInboxActive ? 'bg-slate-500 text-white' : 'bg-slate-800 text-white'}`}>
                  {totalUnreadMsgs}
                </span>
              )}
              <ChevronRight className={`w-3 h-3 ${isInboxActive ? 'text-slate-300' : 'text-slate-400'}`} />
            </div>
          </button>
        )}

        {hasNoChannels && (
          <div className="px-4 py-3 text-center text-slate-500 bg-slate-50 rounded-xl mb-4 border border-slate-100">
            <p className="text-[12px] font-medium">No channels found.</p>
            <p className="text-[10px] mt-1 text-slate-400">Use the + buttons to create new spaces.</p>
          </div>
        )}

        <>
            {/* ═══ UNREAD GROUP ═══ */}
            {hasUnreadSection && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 px-1 pt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Unread</span>
                </div>
                <SubSection
                  label="Direct Chats" icon={MessageCircle} channels={dmUnread}
                  bgClass="bg-sky-50 text-sky-800" iconClass="text-sky-500" badgeClass="bg-sky-200 text-sky-900"
                  onAdd={onStartDirectChat} onAddTitle="Add member"
                  onClose={onCloseDM}
                  onDeleteThread={onDeleteThread}
                  onCloseThread={onCloseThread}
                />
                <SubSection
                  label="Channels" icon={Users} channels={groupsUnread}
                  bgClass="bg-emerald-50 text-emerald-800" iconClass="text-emerald-500" badgeClass="bg-emerald-200 text-emerald-900"
                  onAdd={canManageChannels ? onCreateChannel : undefined} onAddTitle="Add member"
                  onDelete={canManageChannels ? onDeleteChannel : undefined}
                  onDeleteThread={onDeleteThread}
                  onCloseThread={onCloseThread}
                />
                <SubSection
                  label="Rooms" icon={Hash} channels={channelsUnread}
                  bgClass="bg-violet-50 text-violet-800" iconClass="text-violet-500" badgeClass="bg-violet-200 text-violet-900"
                  onAdd={canManageChannels ? onCreateChannel : undefined} onAddTitle="Create channel"
                  onDelete={canManageChannels ? onDeleteChannel : undefined}
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
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Everything Else</span>
                </div>
                <SubSection
                  label="Direct Messages" icon={MessageCircle} channels={dmRead}
                  bgClass="bg-sky-50/60 text-sky-700" iconClass="text-sky-400" badgeClass="bg-sky-100 text-sky-800"
                  onAdd={onStartDirectChat} onAddTitle="New Direct Message"
                  onClose={onCloseDM}
                  onDeleteThread={onDeleteThread}
                  onCloseThread={onCloseThread}
                  alwaysShow={true}
                />
                <SubSection
                  label="Channels" icon={Users} channels={groupsRead}
                  bgClass="bg-emerald-50/60 text-emerald-700" iconClass="text-emerald-400" badgeClass="bg-emerald-100 text-emerald-800"
                  onAdd={canManageChannels ? onCreateChannel : undefined} onAddTitle="Add member"
                  onDelete={canManageChannels ? onDeleteChannel : undefined}
                  onDeleteThread={onDeleteThread}
                  onCloseThread={onCloseThread}
                  alwaysShow={true}
                />
                <SubSection
                  label="Rooms" icon={Hash} channels={channelsRead}
                  bgClass="bg-violet-50/60 text-violet-700" iconClass="text-violet-400" badgeClass="bg-violet-100 text-violet-800"
                  onAdd={canManageChannels ? onCreateChannel : undefined} onAddTitle="Create channel"
                  onDelete={canManageChannels ? onDeleteChannel : undefined}
                  onDeleteThread={onDeleteThread}
                  onCloseThread={onCloseThread}
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
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#162D4E] to-[#1E3A5F] shadow-sm flex items-center justify-center text-white text-[11px] font-bold">
            {currentUser.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-slate-700 truncate leading-none">{currentUser.name}</p>
          <p className="text-[9px] text-slate-500 font-medium truncate mt-0.5">{currentUser.role}</p>
        </div>
        <div className="flex h-2.5 w-2.5 relative shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-sm" />
        </div>
      </div>
    </aside>
  );
}
