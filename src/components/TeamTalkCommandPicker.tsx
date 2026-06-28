/**
 * TeamTalkCommandPicker.tsx
 * Floating dropdown for /slash commands — appears when user types / in input.
 */
import React, { useEffect, useRef } from 'react';
import { CheckSquare, AlertTriangle, Pin, Bell } from 'lucide-react';

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  managerOnly?: boolean;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'task',
    label: '/task',
    description: 'Create a task from this message',
    icon: CheckSquare,
    iconColor: 'text-emerald-500',
  },
  {
    id: 'pin',
    label: '/pin',
    description: 'Pin this message to the top for everyone',
    icon: Pin,
    iconColor: 'text-amber-500',
    managerOnly: true,
  },
  {
    id: 'announce',
    label: '/announce',
    description: 'Post to the announcements channel',
    icon: Bell,
    iconColor: 'text-indigo-500',
    managerOnly: true,
  },
];

interface CommandPickerProps {
  query: string;
  isManager: boolean;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
}

export default function TeamTalkCommandPicker({ query, isManager, onSelect, onClose }: CommandPickerProps) {
  const filtered = SLASH_COMMANDS.filter(cmd => {
    if (cmd.managerOnly && !isManager) return false;
    return cmd.id.startsWith(query.toLowerCase()) || cmd.label.includes(query.toLowerCase());
  });

  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  if (filtered.length === 0) return null;

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden"
      id="command-picker"
    >
      <div className="px-3 py-2 border-b border-slate-100">
        <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">Quick Commands</span>
      </div>
      {filtered.map(cmd => {
        const Icon = cmd.icon;
        return (
          <button
            key={cmd.id}
            id={`slash-cmd-${cmd.id}`}
            onMouseDown={(e) => { e.preventDefault(); onSelect(cmd); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <Icon className={`w-3.5 h-3.5 ${cmd.iconColor}`} />
            </div>
            <div>
              <p className="text-[14px] font-bold text-slate-800 font-mono">{cmd.label}</p>
              <p className="text-[12px] text-slate-400">{cmd.description}</p>
            </div>
            {cmd.managerOnly && (
              <span className="ml-auto text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full shrink-0">Admin</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
