/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TeamTalkMessageBubble.tsx — Single message renderer with reactions, actions, thread badge
 */

import React, { useState, useEffect } from 'react';
import {
  MoreHorizontal, MessageSquare, Trash2, Edit3,
  CheckSquare, Link, Globe, GitBranch, ChevronRight, Check, Pin, GitPullRequest, Send as NotifyIcon
} from 'lucide-react';
import type { TeamTalkMessage } from '../types';
import type { User as AppUser } from '../types';
import TeamTalkVoicePlayer from './TeamTalkVoicePlayer';
import TeamTalkImageViewer from './TeamTalkImageViewer';
import * as chatService from '../services/chatService';
import { translateText } from '../services/store';
import { renderMentionContent } from './TeamTalk';

const REACTION_EMOJIS = ['👍', '❤️', '🔥', '👀', '✅', '😂', '🙏'];

interface MessageBubbleProps {
  message: TeamTalkMessage;
  currentUser: AppUser;
  replyCount?: number;
  onReplyInThread: (msg: TeamTalkMessage) => void;
  /** Called to START a new thread on this message (participant picker will open) */
  onStartThread?: (msg: TeamTalkMessage) => void;
  onConvertToTask: (msg: TeamTalkMessage) => void;
  onDelete: (msgId: string) => void;
  onPin?: (msgId: string) => void;
  onNotify?: (msg: TeamTalkMessage) => void;
  /** Client admins can delete any message, not just their own */
  canModerate?: boolean;
  showAvatar?: boolean;
  isThreadView?: boolean;
  isHighlighted?: boolean;
  /** IDs of users who are participants of this message's thread (for privacy filtering) */
  threadParticipantIds?: string[];
  currentUserId?: string;
  /** WhatsApp-style multi-select: when true, tapping the bubble toggles selection instead of actions */
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (msgId: string) => void;
  /** Enters selection mode starting with this message selected — from the "More" menu */
  onStartSelection?: (msgId: string) => void;
}

export default function TeamTalkMessageBubble({
  message,
  currentUser,
  replyCount = 0,
  onReplyInThread,
  onStartThread,
  onConvertToTask,
  onDelete,
  onPin,
  onNotify,
  canModerate = false,
  showAvatar = true,
  isThreadView = false,
  isHighlighted = false,
  threadParticipantIds,
  currentUserId,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
  onStartSelection,
}: MessageBubbleProps) {
  const isMine = message.senderId === currentUser.id;
  const isSystem = message.messageType === 'system';
  const hasThread = (replyCount > 0) || (message.threadStatus != null);
  // Is current user a thread participant? (used for filtering)
  const isThreadParticipant = !threadParticipantIds || threadParticipantIds.includes(currentUser.id);
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [selectedLang, setSelectedLang] = useState<"original" | "en" | "hi" | "kn" | "ta">("original");
  const [langCache, setLangCache] = useState<Record<string, string>>(message.translations || {});
  const [isTranslating, setIsTranslating] = useState(false);
  const [reacted, setReacted] = useState<Record<string, string[]>>(message.reactions || {});

  // Briefly flash (pulse) when first landing on a highlighted message from a
  // notification/mention/thread jump, then settle into a steadier highlight
  // so it's obvious at a glance which message you were sent here to see.
  const [flashing, setFlashing] = useState(isHighlighted);
  useEffect(() => {
    if (!isHighlighted) { setFlashing(false); return; }
    setFlashing(true);
    const t = setTimeout(() => setFlashing(false), 1800);
    return () => clearTimeout(t);
  }, [isHighlighted, message.id]);

  // System messages — centered pill
  if (isSystem) {
    const isTaskSystem = message.content?.includes('[View in Task Manager]');
    const isClickable = message.threadStatus === 'private' || replyCount > 0;
    
    return (
      <div className="flex justify-center my-3" id={`msg-${message.id}`}>
        <div 
          onClick={isClickable ? () => onReplyInThread(message) : undefined}
          className={`inline-flex items-center gap-2 bg-slate-100 border border-slate-200/80 text-slate-500 text-[12px] font-semibold px-3 py-1.5 rounded-full shadow-xs ${isClickable ? 'cursor-pointer hover:bg-slate-200' : ''}`}
        >
          <GitBranch className="w-3 h-3 text-indigo-400" />
          {isTaskSystem ? (
            <span>
              {message.content?.replace(' — [View in Task Manager]', '')}
              {message.branchTaskId && (
                <a href={`/tasks/${message.branchTaskId}`} className="ml-2 text-indigo-600 hover:underline">
                  View in Task Manager
                </a>
              )}
            </span>
          ) : (
            <span>{message.content} {isClickable && <span className="ml-1 text-indigo-500 font-bold">(Click to open thread)</span>}</span>
          )}
        </div>
      </div>
    );
  }

  const handleReaction = async (emoji: string) => {
    const updated = { ...reacted };
    const users = updated[emoji] ?? [];
    if (users.includes(currentUser.id)) {
      updated[emoji] = users.filter(uid => uid !== currentUser.id);
      if (updated[emoji].length === 0) delete updated[emoji];
    } else {
      updated[emoji] = [...users, currentUser.id];
    }
    setReacted(updated);
    await chatService.toggleReaction(message.id, emoji, currentUser.id, reacted);
    setShowReactions(false);
  };

  const handleLanguageToggle = async (lang: "original" | "en" | "hi" | "kn" | "ta") => {
    setSelectedLang(lang);
    if (lang === "original" || langCache[lang]) return;
    setIsTranslating(true);
    try {
      const content = message.content || message.voiceTranscript || '';
      const result = await translateText(content, lang as 'en' | 'hi' | 'kn' | 'ta');
      const updatedCache = { ...langCache, [lang]: result };
      setLangCache(updatedCache);
      // Cache in DB so other users benefit without re-translating
      chatService.cacheMessageTranslation(message.id, updatedCache).catch(() => {});
    } catch (e) {
      console.error('Translation error:', e);
      alert('Translation failed. Please try again.\n\nError: ' + (e as Error).message);
      setSelectedLang("original");
    } finally {
      setIsTranslating(false);
    }
  };

  const timestamp = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const reactionEntries = Object.entries(reacted).filter(([, users]) => users.length > 0);

  return (
    <div
      id={`msg-${message.id}`}
      className={`flex gap-2.5 mb-1 group ${isMine ? 'flex-row-reverse' : 'flex-row'} ${
        isSelected
          ? 'bg-indigo-50 rounded-2xl px-1 py-0.5 -mx-1'
          : flashing
            ? 'ring-2 ring-amber-400 ring-offset-2 rounded-2xl bg-amber-100 px-1 py-0.5 -mx-1 animate-pulse'
            : isHighlighted
              ? 'ring-2 ring-amber-300 ring-offset-1 rounded-2xl bg-amber-50/60 px-1 py-0.5 -mx-1 transition-colors duration-700'
              : ''
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowMenu(false); setShowReactions(false); }}
      onClick={selectionMode ? () => onToggleSelect?.(message.id) : undefined}
    >
      {/* Selection checkbox — WhatsApp-style multi-select */}
      {selectionMode && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect?.(message.id); }}
          className={`shrink-0 self-center w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors cursor-pointer ${
            isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'
          }`}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </button>
      )}

      {/* Avatar */}
      {showAvatar && !isMine && (
        <div className="shrink-0 pt-0.5">
          {message.senderAvatar ? (
            <img
              src={message.senderAvatar}
              alt={message.senderName}
              className="w-7 h-7 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#162D4E] to-slate-700 flex items-center justify-center text-white text-[12px] font-bold">
              {message.senderName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}
      {!showAvatar && !isMine && <div className="w-7 shrink-0" />}

      {/* Content column */}
      <div className={`flex flex-col max-w-[72%] ${isMine ? 'items-end' : 'items-start'}`}>
        {/* Sender name + time (only for others' messages) */}
        {!isMine && showAvatar && (
          <div className="flex items-baseline gap-1.5 mb-0.5 px-1">
            <span className="text-[13px] font-bold text-slate-700">{message.senderName.split(' - ')[0]}</span>
            <span className="text-[11px] text-slate-400 font-mono">{timestamp}</span>
          </div>
        )}

        {/* Bubble */}
        <div className="relative">
          {showActions && (
            <div className="fixed inset-0 z-20 lg:hidden" onClick={() => setShowActions(false)} />
          )}
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (selectionMode) { onToggleSelect?.(message.id); return; }
              setShowActions(v => !v);
            }}
            className={`relative rounded-2xl px-3.5 py-2.5 shadow-xs cursor-pointer ${
              isMine
                ? 'bg-[#162D4E] text-white rounded-br-sm'
                : 'bg-white border border-slate-200/80 text-slate-800 rounded-bl-sm'
            } ${message.isBranched ? 'ring-1 ring-amber-400/50' : ''}`}
          >
            {/* Branched badge */}
            {message.isBranched && (
              <div className={`flex items-center gap-1.5 mb-1.5 text-[12px] font-bold uppercase tracking-wide p-1.5 rounded bg-amber-500/10 ${isMine ? 'text-amber-300' : 'text-amber-600'}`}>
                <GitBranch className="w-3 h-3" />
                <span>Task created</span>
                {message.branchTaskId && (
                  <a href={`/tasks/${message.branchTaskId}`} className="ml-auto underline hover:text-amber-500 flex items-center gap-0.5">
                    View
                  </a>
                )}
              </div>
            )}

            {/* Message content */}
            {message.messageType === 'voice' && message.voiceUrl ? (
              <TeamTalkVoicePlayer
                url={message.voiceUrl}
                durationSec={message.voiceDurationSec}
                transcript={message.voiceTranscript}
                isMine={isMine}
              />
            ) : message.messageType === 'image' && message.imageUrl ? (
              <TeamTalkImageViewer
                url={message.imageUrl}
                width={message.imageWidth}
                height={message.imageHeight}
              />
            ) : (
              <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
                {message.isDeleted ? (
                  <span className="italic opacity-50 text-[14px]">Message deleted</span>
                ) : selectedLang !== "original" && langCache[selectedLang] ? (
                  langCache[selectedLang]
                ) : (
                  // Render @mentions highlighted
                  renderMentionContent(message.content || '', currentUser.id)
                )}
              </p>
            )}

            {/* Language toggle — same 4 languages as the Task input */}
            {showLangPicker && !message.isDeleted && (
              <div className={`flex gap-1 mt-2 pt-2 border-t ${isMine ? 'border-white/20' : 'border-slate-100'}`}>
                {(["original", "en", "hi", "kn", "ta"] as const).map((lang) => {
                  const label = lang === "original" ? "Original" : lang === "en" ? "English" : lang === "hi" ? "हिन्दी" : lang === "kn" ? "ಕನ್ನಡ" : "தமிழ்";
                  const isSelected = selectedLang === lang;
                  return (
                    <button
                      key={lang}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLanguageToggle(lang); }}
                      disabled={isTranslating}
                      className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer disabled:opacity-50 ${
                        isSelected
                          ? (isMine ? 'bg-white/20 text-white' : 'bg-slate-800 text-white')
                          : (isMine ? 'text-white/60 hover:text-white' : 'text-slate-500 hover:text-slate-800')
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                {isTranslating && <span className="text-[11px] animate-spin">⟳</span>}
              </div>
            )}

            {/* Timestamp for own messages */}
            {isMine && (
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <span className="text-[11px] text-white/50 font-mono">{timestamp}</span>
                {message.isEdited && <span className="text-[10px] text-white/40">edited</span>}
                <Check className="w-3 h-3 text-white/40" />
              </div>
            )}
          </div>

          {/* Reaction pill display */}
          {reactionEntries.length > 0 && (
            <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
              {reactionEntries.map(([emoji, users]) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className={`flex items-center gap-0.5 text-[13px] px-1.5 py-0.5 rounded-full border transition-all cursor-pointer ${
                    users.includes(currentUser.id)
                      ? 'bg-[#162D4E]/10 border-[#162D4E]/30 font-bold'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="text-[12px] text-slate-600 font-semibold">{users.length}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Thread reply badge — only visible to participants */}
        {!isThreadView && hasThread && isThreadParticipant && !message.isDeleted && (
          <button
            onClick={(e) => { e.stopPropagation(); onReplyInThread(message); }}
            className={`flex items-center gap-1 text-[12px] font-semibold text-indigo-600 hover:text-indigo-700 mt-0.5 px-1 transition-colors cursor-pointer relative z-20 touch-manipulation ${isMine ? 'flex-row-reverse' : ''}`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
        {!isThreadView && !hasThread && onStartThread && !message.isDeleted && (
          <button
            onClick={(e) => { e.stopPropagation(); onStartThread(message); }}
            className={`flex items-center gap-1 text-[12px] font-semibold text-indigo-600 hover:text-indigo-700 mt-0.5 px-1 transition-colors cursor-pointer relative z-20 touch-manipulation ${isMine ? 'flex-row-reverse' : ''}`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Reply</span>
          </button>
        )}
      </div>

      {/* Hover action buttons (always visible on mobile, hover on desktop) */}
      {!message.isDeleted && !selectionMode && (
        <div className={`flex items-center gap-0.5 self-center transition-opacity relative z-30 ${showActions ? 'opacity-100' : 'opacity-0 pointer-events-none'} lg:group-hover:opacity-100 lg:group-hover:pointer-events-auto ${isMine ? 'flex-row-reverse' : ''}`}>
          {/* Quick reactions — hidden on mobile (kept in the "More" sheet) to avoid pushing off-screen,
              but stays visible once opened from that sheet so the popover can render */}
          <div className={`relative ${showReactions ? '' : 'hidden sm:block'}`}>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowReactions(v => !v);
              }}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors text-base cursor-pointer"
              title="React"
            >
              😊
            </button>
            {showReactions && (
              <div className={`absolute top-full mt-1 ${isMine ? 'right-0' : 'left-0'} bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 flex gap-1 z-[100]`}>
                {REACTION_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(emoji)}
                    className="text-lg hover:scale-125 transition-transform p-0.5 cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Translate — hidden on mobile (kept in the "More" sheet) to avoid pushing off-screen */}
          {(message.content || message.voiceTranscript) && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowLangPicker(v => !v);
              }}
              className={`hidden sm:inline-flex p-1.5 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer ${showLangPicker ? 'text-blue-700 bg-blue-50' : 'text-blue-500'}`}
              title="Translate"
            >
              <Globe className="w-3.5 h-3.5" />
            </button>
          )}


          {/* Notify on WhatsApp — hidden on mobile (kept in the "More" sheet) to avoid pushing off-screen */}
          {onNotify && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onNotify(message);
              }}
              className="hidden sm:inline-flex p-1.5 hover:bg-emerald-50 rounded-lg text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
              title="Notify on WhatsApp"
            >
              <NotifyIcon className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Pin Action — hidden on mobile (kept in the "More" sheet) to avoid pushing off-screen */}
          {onPin && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onPin(message.id);
              }}
              className="hidden sm:inline-flex p-1.5 hover:bg-amber-50 rounded-lg text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
              title="Pin for everyone"
            >
              <Pin className="w-3.5 h-3.5" />
            </button>
          )}

          {/* More actions menu */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowMenu(v => !v);
              }}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              title="More actions"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-[190] sm:hidden" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
                <div className={`fixed sm:absolute sm:top-full bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 right-4 sm:bottom-auto sm:left-auto sm:right-auto sm:mt-1 ${isMine ? 'sm:right-0' : 'sm:left-0'} bg-white border border-slate-200 rounded-xl shadow-2xl sm:shadow-xl z-[200] py-1 min-w-[160px] max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto`}>
                  {/* WhatsApp-style multi-select entry point */}
                  {onStartSelection && (
                    <button
                      onClick={() => { setShowMenu(false); onStartSelection(message.id); }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer font-medium"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />
                      Select
                    </button>
                  )}
                  {/* React + Translate — desktop already has dedicated inline icons; mobile only gets them here */}
                  <button
                    onClick={() => { setShowMenu(false); setShowReactions(true); }}
                    className={`sm:hidden flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer font-medium ${onStartSelection ? 'border-t border-slate-100' : ''}`}
                  >
                    <span className="text-base leading-none">😊</span>
                    React
                  </button>
                  {(message.content || message.voiceTranscript) && (
                    <button
                      onClick={() => { setShowMenu(false); setShowLangPicker(true); }}
                      className="sm:hidden flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer font-medium border-t border-slate-100"
                    >
                      <Globe className="w-3.5 h-3.5 text-blue-500" />
                      Translate
                    </button>
                  )}
                  <button
                    onClick={() => { onConvertToTask(message); setShowMenu(false); }}
                    className={`flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer font-medium border-t border-slate-100 ${onStartSelection ? '' : 'sm:border-t-0'}`}
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                    Convert to Task
                  </button>

                  {onNotify && (
                    <button
                      onClick={() => { onNotify(message); setShowMenu(false); }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer font-medium border-t border-slate-100"
                    >
                      <NotifyIcon className="w-3.5 h-3.5 text-emerald-500" />
                      Notify on WhatsApp
                    </button>
                  )}

                  {onPin && (
                    <button
                      onClick={() => { onPin(message.id); setShowMenu(false); }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer font-medium border-t border-slate-100"
                    >
                      <Pin className="w-3.5 h-3.5 text-amber-500" />
                      Pin for everyone
                    </button>
                  )}

                  {(isMine || canModerate) && (
                    <button
                      onClick={() => { onDelete(message.id); setShowMenu(false); }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer font-medium border-t border-slate-100"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      Delete Message
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
