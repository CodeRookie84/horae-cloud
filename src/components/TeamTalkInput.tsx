/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TeamTalkInput.tsx — Message compose bar with:
 *   • WhatsApp-style dominant voice record button
 *   • @mention detection → MentionPicker dropdown
 *   • /command detection → CommandPicker dropdown
 *   • 🚨 Quick report button
 *   • Reply banner
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Send, X, Square, Slash, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { User as AppUser } from '../types';
import TeamTalkMentionPicker from './TeamTalkMentionPicker';
import TeamTalkCommandPicker, { type SlashCommand } from './TeamTalkCommandPicker';

interface TeamTalkInputProps {
  onSendText: (text: string, mentionedUserIds?: string[], escalationRole?: string) => Promise<void>;
  onSendVoice: (blob: Blob, durationSec: number, escalationRole?: string) => Promise<void>;
  onCommand?: (commandId: string) => void;
  allUsers?: AppUser[];
  channelMembers?: AppUser[];
  currentUser?: AppUser;
  isManager?: boolean;
  disabled?: boolean;
  placeholder?: string;
  replyingTo?: { senderName: string; content?: string } | null;
  onCancelReply?: () => void;
}

type InputMode = 'idle' | 'typing' | 'recording' | 'recorded';

export default function TeamTalkInput({
  onSendText,
  onSendVoice,
  onCommand,
  allUsers = [],
  channelMembers = [],
  currentUser,
  isManager = false,
  disabled = false,
  placeholder = 'Type a message...',
  replyingTo = null,
  onCancelReply,
}: TeamTalkInputProps) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<InputMode>('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [mentionedUsers, setMentionedUsers] = useState<AppUser[]>([]);

  // Dictation (speech-to-text) — same languages as the Task input
  const [speechLanguage, setSpeechLanguage] = useState<"en-US" | "hi-IN" | "kn-IN" | "ta-IN">("en-US");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Mention/command picker state
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showCommandPicker, setShowCommandPicker] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');



  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordedBlobRef = useRef<Blob | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [text]);

  // Detect @ and / triggers as user types
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    setMode(val.trim() ? 'typing' : 'idle');

    const cursorPos = e.target.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursorPos);

    // @mention trigger — match @ followed by word chars
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch && allUsers.length > 0) {
      setMentionQuery(atMatch[1]);
      setShowMentionPicker(true);
      setShowCommandPicker(false);
    } else {
      setShowMentionPicker(false);
      setMentionQuery('');
    }

    // /command trigger — match / at start of word
    const slashMatch = textBefore.match(/(?:^|\s)\/(\w*)$/);
    if (slashMatch) {
      setCommandQuery(slashMatch[1]);
      setShowCommandPicker(true);
      setShowMentionPicker(false);
    } else {
      setShowCommandPicker(false);
      setCommandQuery('');
    }
  }, [allUsers]);

  // Select a mention → replace @query with @[Name](id)
  const handleMentionSelect = useCallback((user: AppUser) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursorPos = ta.selectionStart ?? text.length;
    const textBefore = text.slice(0, cursorPos);
    const textAfter = text.slice(cursorPos);
    const replaced = textBefore.replace(/@\w*$/, `@[${user.name}](${user.id}) `);
    setText(replaced + textAfter);
    setMentionedUsers(prev => [...prev.filter(u => u.id !== user.id), user]);
    setShowMentionPicker(false);
    setMentionQuery('');
    setTimeout(() => ta.focus(), 0);
  }, [text]);

  // Select a /command
  const handleCommandSelect = useCallback((cmd: SlashCommand) => {
    setShowCommandPicker(false);
    setCommandQuery('');

    if (cmd.id === 'task' || cmd.id === 'pin' || cmd.id === 'announce') {
      // Replace the /word with empty string, then notify parent
      setText(prev => prev.replace(/(?:^|\s)\/\w*$/, ' ').trimStart());
      onCommand?.(cmd.id);
      return;
    }
    // Default: replace / with label
    setText(prev => prev.replace(/(?:^|\s)\/\w*$/, ` ${cmd.label} `).trimStart());
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [onCommand]);

  // Extract mentioned user IDs from text (parses @[Name](id) format)
  const extractMentionedIds = useCallback((txt: string): string[] => {
    const matches = [...txt.matchAll(/@\[([^\]]+)\]\(([^)]+)\)/g)];
    return matches.map(m => m[2]);
  }, []);

  // Send text message
  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    const mentionedIds = extractMentionedIds(trimmed);
    let ids = mentionedIds;
    if (mentionedUsers.length > 0) {
      ids = [...new Set(mentionedUsers.map(u => u.id))];
    }
    
    await onSendText(trimmed, ids.length > 0 ? ids : undefined, undefined);

    setText('');
    setMentionedUsers([]);
    setMode('idle');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [text, disabled, onSendText, extractMentionedIds, mentionedUsers]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      setShowMentionPicker(false);
      setShowCommandPicker(false);
    }
  }, [handleSend]);

  // ── Dictation (speech-to-text into the textarea) ─────────────
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported in this browser');
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = speechLanguage;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const resultText = event.results[0][0].transcript;
        setText(prev => prev ? prev + " " + resultText : resultText);
        setMode('typing');
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  }, [speechLanguage]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsListening(false);
  }, []);

  // ── Voice recording ─────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (disabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        recordedBlobRef.current = blob;
        stream.getTracks().forEach(t => t.stop());
        setMode('recorded');
      };
      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setRecordingSeconds(0);
      setMode('recording');
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch {
      console.error('Mic access denied');
    }
  }, [disabled]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  }, []);

  const cancelRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    recordedBlobRef.current = null;
    setMode('idle');
    setRecordingSeconds(0);
  }, []);

  const sendRecording = useCallback(async () => {
    const blob = recordedBlobRef.current;
    if (!blob) return;
    const secs = recordingSeconds;
    recordedBlobRef.current = null;
    setMode('idle');
    setRecordingSeconds(0);
    await onSendVoice(blob, secs);
  }, [recordedBlobRef, recordingSeconds, onSendVoice]);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const hasText = text.trim().length > 0;

  return (
    <div className="bg-white border-t border-slate-200 shrink-0" ref={wrapperRef}>
      {/* Reply banner */}
      <AnimatePresence>
        {replyingTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center gap-3 px-4 py-2 bg-slate-50 border-b border-slate-100 overflow-hidden"
          >
            <div className="w-0.5 h-8 bg-[#162D4E] rounded-full shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-[#162D4E]">Replying to {replyingTo.senderName}</p>
              <p className="text-[13px] text-slate-500 truncate">{replyingTo.content || '🎤 Voice message'}</p>
            </div>
            <button onClick={onCancelReply} className="p-1 hover:bg-slate-200 rounded cursor-pointer">
              <X className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main compose area */}
      <div className="relative flex items-end gap-2 px-3 py-3">
        {/* Mention / Command pickers — positioned above input */}
        <AnimatePresence>


          {showMentionPicker && (
            <motion.div
              key="mention-picker"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="absolute bottom-full left-3 mb-1 z-50"
            >
              <TeamTalkMentionPicker
                query={mentionQuery}
                allUsers={allUsers.filter(u => u.id !== currentUser?.id)}
                currentUserId={currentUser?.id || ''}
                onSelectUser={handleMentionSelect}
                onSelectGroup={() => {}}
                onClose={() => setShowMentionPicker(false)}
              />
            </motion.div>
          )}
          {showCommandPicker && (
            <motion.div
              key="command-picker"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="absolute bottom-full left-3 mb-1 z-50"
            >
              <TeamTalkCommandPicker
                query={commandQuery}
                isManager={isManager}
                onSelect={handleCommandSelect}
                onClose={() => setShowCommandPicker(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── RECORDING STATE ── */}
        {(mode === 'recording' || mode === 'recorded') ? (
          <div className="flex-1 flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-2.5">
            {mode === 'recording' ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                <span className="text-[15px] font-bold text-rose-600 tabular-nums flex-1">{fmtTime(recordingSeconds)}</span>
                {/* Waveform bars */}
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-0.5 bg-rose-400 rounded-full animate-pulse"
                      style={{ height: `${6 + Math.random() * 14}px`, animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-[15px] font-bold text-emerald-700 flex-1">Ready to send ({fmtTime(recordingSeconds)})</span>
              </>
            )}
          </div>
        ) : (
          /* ── TYPING STATE ── */
          <div className="flex-1 flex flex-col gap-1">
            {/* Text area, with the dictation mic docked inside it */}
            <div className="flex-1 bg-slate-100 rounded-2xl flex items-end gap-2 px-3 py-2 min-h-[40px]">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                placeholder={disabled ? placeholder : placeholder}
                rows={1}
                className="flex-1 bg-transparent text-[15px] text-slate-800 placeholder-slate-400 resize-none focus:outline-none leading-5 max-h-[120px] overflow-y-auto disabled:opacity-50"
                id="team-talk-input"
              />
              <select
                value={speechLanguage}
                onChange={(e) => setSpeechLanguage(e.target.value as any)}
                title="Dictation language"
                className="bg-transparent text-slate-400 text-[11px] font-medium pr-0.5 focus:outline-none cursor-pointer shrink-0"
              >
                <option value="en-US">EN</option>
                <option value="hi-IN">हिं</option>
                <option value="kn-IN">ಕನ</option>
                <option value="ta-IN">தமி</option>
              </select>
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                disabled={disabled}
                className={`p-1 rounded-full flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 shrink-0 ${
                  isListening
                    ? "bg-slate-900 text-white animate-pulse shadow-sm"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-200"
                }`}
                title={isListening ? "Stop dictation" : "Dictate — converts speech to text in this box"}
              >
                {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            </div>
            {isListening && (
              <span className="text-[11px] text-red-500 font-medium uppercase tracking-wide animate-pulse px-1">
                Listening...
              </span>
            )}
          </div>
        )}

        {/* ── ACTION BUTTON(S) ── */}
        <div className="flex items-end gap-2 shrink-0">
          {mode === 'recording' ? (
            <>
              {/* Cancel recording */}
              <button
                onClick={cancelRecording}
                className="w-10 h-10 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                title="Cancel"
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
              {/* Stop recording */}
              <button
                onClick={stopRecording}
                className="w-12 h-12 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors cursor-pointer shadow-md"
                title="Stop recording"
              >
                <Square className="w-5 h-5 text-white fill-white" />
              </button>
            </>
          ) : mode === 'recorded' ? (
            <>
              {/* Discard */}
              <button
                onClick={cancelRecording}
                className="w-10 h-10 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                title="Discard"
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
              {/* Send voice */}
              <button
                onClick={sendRecording}
                className="w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center transition-all cursor-pointer shadow-md"
                title="Send voice message"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </>
          ) : hasText ? (
            /* Send text — clear arrow button, never looks like a black circle */
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={handleSend}
              disabled={disabled}
              className="h-10 px-4 rounded-full bg-[#162D4E] hover:bg-[#1E3A5F] flex items-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-50"
              title="Send message"
              id="send-text-btn"
            >
              <Send className="w-4 h-4 text-[#C5A880]" />
              <span className="text-[14px] font-bold text-white">Send</span>
            </motion.button>
          ) : (
            /* BIG Voice record button — WhatsApp style, dominant CTA */
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={startRecording}
              disabled={disabled}
              className="w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center transition-all cursor-pointer shadow-md hover:bg-[#20bd5a] disabled:opacity-50"
              title="Hold to record voice message"
              id="voice-record-btn"
            >
              <Mic className="w-5 h-5 text-white stroke-[2.5px]" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Mention tags preview (below input when mentions exist) */}
      {mentionedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1 px-4 pb-2">
          {mentionedUsers.map(u => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-[12px] font-bold px-2 py-0.5 rounded-full"
            >
              @{u.name.split(' ')[0]}
              <button
                onClick={() => {
                  setMentionedUsers(prev => prev.filter(m => m.id !== u.id));
                  setText(prev => prev.replace(new RegExp(`@\\[${u.name}\\]\\(${u.id}\\)\\s?`, 'g'), ''));
                }}
                className="hover:text-indigo-900 cursor-pointer"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
