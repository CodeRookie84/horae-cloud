/**
 * TeamTalkPinnedBanner.tsx
 * Sticky banner at top of message area showing the pinned message.
 * Dismissable per-session (doesn't unpin from DB).
 */
import React from 'react';
import { Pin, X, ChevronRight } from 'lucide-react';
import type { TeamTalkMessage } from '../types';

interface PinnedBannerProps {
  message: TeamTalkMessage;
  onDismiss: () => void;
  onJump: () => void;
  canUnpin?: boolean;
  onUnpin?: () => void;
}

export default function TeamTalkPinnedBanner({ message, onDismiss, onJump, canUnpin, onUnpin }: PinnedBannerProps) {
  const preview = message.messageType === 'voice'
    ? (message.voiceTranscript ? `🎤 ${message.voiceTranscript.slice(0, 80)}` : '🎤 Voice message')
    : (message.content || '').slice(0, 100);

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2 bg-gradient-to-r from-amber-50 to-amber-100/60 border-b border-amber-200 shrink-0"
      id="pinned-banner"
    >
      {/* Pin icon */}
      <div className="w-6 h-6 rounded-lg bg-amber-200 flex items-center justify-center shrink-0">
        <Pin className="w-3 h-3 text-amber-700 fill-amber-700" />
      </div>

      {/* Content */}
      <button
        onClick={onJump}
        className="flex-1 min-w-0 text-left cursor-pointer"
      >
        <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide leading-none mb-0.5">
          📌 Pinned by {message.senderName}
        </p>
        <p className="text-[13px] text-slate-700 truncate leading-tight">
          {preview}
          {(message.content || '').length > 100 ? '...' : ''}
        </p>
      </button>

      <div className="flex items-center gap-1 shrink-0">
        {/* Jump to message */}
        <button
          onClick={onJump}
          className="p-1 hover:bg-amber-200/60 rounded-lg text-amber-700 transition-colors cursor-pointer"
          title="Jump to message"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Unpin (manager only) */}
        {canUnpin && onUnpin && (
          <button
            onClick={onUnpin}
            className="p-1 hover:bg-rose-100 rounded-lg text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
            title="Unpin message"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Dismiss banner (session only) */}
        {!canUnpin && (
          <button
            onClick={onDismiss}
            className="p-1 hover:bg-amber-200/60 rounded-lg text-amber-600 transition-colors cursor-pointer"
            title="Hide banner (message stays pinned)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
