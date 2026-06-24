import React, { useState } from 'react';
import { Inbox, Bell, MessageCircle, Hash, ChevronRight, CheckCircle2, ArrowLeft } from 'lucide-react';
import type { TeamTalkMessage, ChatChannel } from '../types';

interface TeamTalkInboxProps {
  mentionMessages: TeamTalkMessage[];
  /** Active sidebar threads (threads that have been made "active" and show in sidebar) */
  activeThreads: TeamTalkMessage[];
  /** Unread threads — inline threads with unread replies */
  unreadThreads: TeamTalkMessage[];
  onOpenThread: (msg: TeamTalkMessage) => void;
  onOpenMention: (msg: TeamTalkMessage) => void;
  /** ID of the currently logged-in user to filter threads relevant to them */
  currentUserId: string;
  /** Closed direct messages channels */
  closedDMChannels?: ChatChannel[];
  /** Callback to reopen a closed DM */
  onReopenDM?: (channelId: string) => void;
  /** Callback to toggle mobile sidebar */
  onMenuClick?: () => void;
  /** Active Tenant ID for searching messages */
  tenantId?: string;
  /** Callback to navigate back to previous screen */
  onBack?: () => void;
}

export default function TeamTalkInbox({
  mentionMessages,
  activeThreads,
  unreadThreads,
  onOpenThread,
  onOpenMention,
  currentUserId,
  closedDMChannels = [],
  onReopenDM,
  onMenuClick,
  tenantId,
  onBack,
}: TeamTalkInboxProps) {

  // Only show truly unread threads
  const combinedThreads = unreadThreads
    .filter(t => {
      if (t.senderId === currentUserId) return true;
      if (t.mentionedUserIds?.includes(currentUserId)) return true;
      return true; // We assume unreadThreads passed in are already relevant to the user
    })
    .sort((a, b) =>
      new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
    );

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };
  
  // Grouping logic by date
  const groupThreadsByDate = (threads: TeamTalkMessage[]) => {
    const groups: { [key: string]: TeamTalkMessage[] } = {
      'Today': [],
      'Yesterday': [],
      'This Week': [],
      'Earlier': []
    };
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const thisWeek = today - 86400000 * 7;
    
    threads.forEach(t => {
      const time = new Date(t.updatedAt || t.createdAt).getTime();
      if (time >= today) groups['Today'].push(t);
      else if (time >= yesterday) groups['Yesterday'].push(t);
      else if (time >= thisWeek) groups['This Week'].push(t);
      else groups['Earlier'].push(t);
    });
    
    return groups;
  };
  
  const groupedThreads = groupThreadsByDate(combinedThreads);

  return (
    <div className="flex-1 flex flex-col bg-white min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-sky-50 border-b border-sky-100 shrink-0 shadow-sm relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-xl shadow-sm border border-sky-100 flex items-center justify-center">
            <Inbox className="w-4 h-4 text-sky-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-sky-900">Quick View</h2>
            <p className="text-[11px] text-sky-700 font-medium">Your unread messages and mentions</p>
          </div>
        </div>
        <button 
          onClick={onBack || onMenuClick} 
          className="w-8 h-8 flex items-center justify-center hover:bg-sky-100 rounded-lg text-sky-700 shrink-0 cursor-pointer bg-white shadow-sm border border-sky-100"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">

        <div className="mb-6 flex justify-start">
          {/* Closed Direct Chats Section */}
          {closedDMChannels.length > 0 && onReopenDM && (
            <ClosedDirectChatsSection
              closedDMChannels={closedDMChannels}
              onReopenDM={onReopenDM}
              tenantId={tenantId}
            />
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Mentions Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Recent Mentions</h3>
              <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {mentionMessages.length}
              </span>
            </div>

            {mentionMessages.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-sm">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-[13px] font-medium text-slate-600">You're all caught up on mentions!</p>
              </div>
            ) : (
              <div className="grid gap-2">
                {mentionMessages.map(msg => (
                  <button
                    key={`mention-${msg.id}`}
                    onClick={() => onOpenMention(msg)}
                    className="bg-sky-50/60 border border-sky-100 hover:border-sky-300 rounded-2xl p-4 text-left transition-all shadow-sm hover:shadow-md group flex flex-col sm:flex-row sm:items-center gap-4 cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {msg.senderAvatar ? (
                          <img src={msg.senderAvatar} alt="" className="w-5 h-5 rounded-full" />
                        ) : (
                          <div className="w-5 h-5 bg-sky-200 rounded-full flex items-center justify-center text-[9px] font-bold text-sky-700">
                            {msg.senderName.charAt(0)}
                          </div>
                        )}
                        <span className="text-[12px] font-bold text-slate-700">{msg.senderName}</span>
                        <span className="text-[10px] text-slate-400">mentioned you on {formatDate(msg.createdAt)} at {formatTime(msg.createdAt)}</span>
                      </div>
                      <p className="text-[13px] text-slate-600 line-clamp-2 pl-7">{msg.content}</p>
                    </div>
                    <div className="shrink-0 flex items-center justify-end sm:justify-center">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center group-hover:bg-sky-100 transition-colors">
                        <ChevronRight className="w-4 h-4 text-sky-400 group-hover:text-sky-600" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

        {/* Unread Threads Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="w-4 h-4 text-sky-500" />
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Unread Threads</h3>
            <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {combinedThreads.length}
            </span>
          </div>

          {combinedThreads.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-sm">
              <Hash className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-[13px] font-medium text-slate-500">No unread threads for you.</p>
              <p className="text-[11px] text-slate-400 mt-1">Threads you participate in with new replies will appear here.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedThreads).map(([dateLabel, threads]) => {
                if (threads.length === 0) return null;
                return (
                  <div key={dateLabel} className="space-y-2">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-1">{dateLabel}</h4>
                    <div className="grid gap-2">
                      {threads.map(thread => (
                        <button
                          key={`thread-${thread.id}`}
                          onClick={() => onOpenThread(thread)}
                          className="bg-sky-50/60 border border-sky-100 rounded-2xl p-4 text-left transition-all shadow-sm hover:shadow-md hover:border-sky-300 group flex items-center gap-4 cursor-pointer"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="bg-sky-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0">
                                NEW
                              </span>
                              <span className="text-[12px] font-bold text-slate-700 truncate">{thread.threadTitle || "Thread"}</span>
                              <span className="text-[10px] text-slate-400 shrink-0">Updated {formatTime(thread.updatedAt || thread.createdAt)}</span>
                            </div>
                            <p className="text-[13px] text-slate-600 line-clamp-1">{thread.content}</p>
                          </div>
                          <div className="shrink-0 flex items-center justify-end sm:justify-center">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center group-hover:bg-sky-100 transition-colors">
                              <ChevronRight className="w-4 h-4 text-sky-400 group-hover:text-sky-600" />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        </div>

      </div>
    </div>
  );
}

function ClosedDirectChatsSection({
  closedDMChannels,
  onReopenDM,
  tenantId
}: {
  closedDMChannels: ChatChannel[];
  onReopenDM: (id: string) => void;
  tenantId?: string;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [matchedChannelIds, setMatchedChannelIds] = React.useState<string[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  React.useEffect(() => {
    if (!searchText.trim() || !tenantId) {
      setMatchedChannelIds([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { searchMessages } = await import('../services/chatService');
        const msgs = await searchMessages(tenantId, searchText);
        setMatchedChannelIds(msgs.map(m => m.channelId));
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchText, tenantId]);

  const filteredChannels = closedDMChannels.filter(ch =>
    ch.name.toLowerCase().includes(searchText.toLowerCase()) ||
    matchedChannelIds.includes(ch.id)
  );

  return (
    <div className="relative">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer text-slate-600 shadow-sm border border-slate-200"
      >
        <MessageCircle className="w-3 h-3" />
        <span className="text-[11px] font-bold">Closed Chats ({closedDMChannels.length})</span>
        <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${collapsed ? '' : 'rotate-90'}`} />
      </button>

      {!collapsed && (
        <div className="absolute top-full left-0 mt-2 z-20 w-[300px] bg-white border border-slate-200 rounded-2xl p-4 shadow-xl">
          <input
            type="text"
            placeholder="Search by name or keywords inside the chat..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="w-full px-3 py-2 text-[12px] border border-slate-200 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {isSearching ? (
              <p className="text-[11px] text-slate-400 text-center py-4 animate-pulse">Searching...</p>
            ) : filteredChannels.length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center py-4">No matching chats found.</p>
            ) : (
              filteredChannels.map(ch => (
                <button
                  key={ch.id}
                  onClick={() => {
                    onReopenDM(ch.id);
                    setSearchText('');
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors cursor-pointer group text-left"
                >
                  <span className="text-[12px] font-semibold text-slate-700">{ch.name}</span>
                  <span className="text-[10px] font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    Reopen
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
