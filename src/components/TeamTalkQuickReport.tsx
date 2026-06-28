/**
 * TeamTalkQuickReport.tsx — v2
 * Smart issue routing: category → auto-suggests responsible roles.
 * Staff picks from a "Suggested" list (right people first) or "Others".
 */
import React, { useState, useMemo } from 'react';
import { AlertTriangle, X, CheckSquare, ChevronDown, Star } from 'lucide-react';
import { motion } from 'motion/react';
import type { User as AppUser } from '../types';

// ── Category → responsible roles mapping ─────────────────────
const CATEGORY_ROUTES: Record<string, string[]> = {
  equipment:   ['Manager', 'Supervisor', 'Admin', 'Operations', 'Maintenance'],
  safety:      ['Admin', 'Manager', 'Supervisor', 'Operations', 'HR'],
  stock:       ['Manager', 'Supervisor', 'Purchase', 'Store Manager'],
  customer:    ['Manager', 'Supervisor', 'Front Desk Manager'],
  cleanliness: ['Supervisor', 'Manager', 'Admin'],
  hr:          ['HR', 'Admin', 'Manager'],
  other:       ['Manager', 'Admin', 'Supervisor'],
};

const ISSUE_CATEGORIES = [
  { id: 'equipment',   emoji: '🔧', label: 'Equipment Problem',   example: 'Oven not heating, mixer broken...' },
  { id: 'safety',      emoji: '⚠️', label: 'Safety Issue',        example: 'Wet floor, gas leak, injury...' },
  { id: 'stock',       emoji: '📦', label: 'Stock / Inventory',   example: 'Ingredients out of stock...' },
  { id: 'customer',    emoji: '🧑‍💼', label: 'Customer Issue',    example: 'Complaint, refund request...' },
  { id: 'cleanliness', emoji: '🧹', label: 'Cleanliness',         example: 'Pest, spill, hygiene issue...' },
  { id: 'hr',          emoji: '👤', label: 'HR / People Issue',   example: 'Attendance, conflict, payroll...' },
  { id: 'other',       emoji: '💬', label: 'Other',               example: 'Anything else...' },
];

interface QuickReportProps {
  currentUser: AppUser;
  teammates: AppUser[];
  onClose: () => void;
  onSubmit: (params: {
    category: string;
    description: string;
    assigneeId: string;
    assigneeName: string;
  }) => Promise<void>;
}

export default function TeamTalkQuickReport({ currentUser, teammates, onClose, onSubmit }: QuickReportProps) {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Smart routing: split teammates into Suggested and Others based on category
  const { suggested, others } = useMemo(() => {
    const others = teammates.filter(u => u.id !== currentUser.id);
    if (!category) {
      // Default: managers first
      const mgrs = others.filter(u => ['Admin', 'Manager', 'Supervisor', 'Super Admin'].some(r => u.role?.includes(r)));
      const rest = others.filter(u => !mgrs.find(m => m.id === u.id));
      return { suggested: mgrs, others: rest };
    }
    const responsibleRoles = CATEGORY_ROUTES[category] || [];
    const suggested = others.filter(u =>
      responsibleRoles.some(r => (u.role || '').toLowerCase().includes(r.toLowerCase()))
    );
    const suggestedIds = new Set(suggested.map(u => u.id));
    const rest = others.filter(u => !suggestedIds.has(u.id));
    return { suggested, others: rest };
  }, [category, teammates, currentUser.id]);

  const selectedCat = ISSUE_CATEGORIES.find(c => c.id === category);
  const selectedAssignee = [...suggested, ...others].find(u => u.id === assigneeId);

  // Auto-select first suggested person when category changes
  const handleCategorySelect = (catId: string) => {
    setCategory(catId);
    setAssigneeId(''); // reset so user picks from new suggested list
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !description.trim() || !assigneeId) return;
    setSubmitting(true);
    await onSubmit({
      category: selectedCat?.label || category,
      description: description.trim(),
      assigneeId,
      assigneeName: selectedAssignee?.name || '',
    });
    setDone(true);
    setSubmitting(false);
    setTimeout(onClose, 1800);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-rose-50 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-[15px] font-bold text-slate-800">Report an Issue</h3>
            <p className="text-[12px] text-slate-500">The right person will be auto-suggested based on the issue type</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-rose-100 rounded-lg cursor-pointer">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              <CheckSquare className="w-7 h-7 text-emerald-600" />
            </div>
            <h4 className="text-base font-bold text-slate-800 mb-1">Issue Reported ✅</h4>
            <p className="text-[14px] text-slate-500">
              A task was created and {selectedAssignee?.name} has been notified immediately.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Category */}
            <div>
              <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wider block mb-2">
                What's the issue? <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ISSUE_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategorySelect(cat.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      category === cat.id ? 'border-rose-400 bg-rose-50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-lg shrink-0">{cat.emoji}</span>
                    <span className={`text-[13px] font-semibold leading-tight ${category === cat.id ? 'text-rose-700' : 'text-slate-700'}`}>
                      {cat.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                Describe the issue <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={selectedCat?.example || 'Describe what happened...'}
                rows={3}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[15px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-300/50 resize-none"
                required
              />
            </div>

            {/* Smart Assignee Picker */}
            <div>
              <label className="text-[13px] font-bold text-slate-600 uppercase tracking-wider block mb-2">
                Assign to <span className="text-rose-500">*</span>
              </label>

              {/* Suggested (auto-routed by role) */}
              {suggested.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center gap-1 mb-1.5">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-400" />
                    <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
                      Suggested for {selectedCat?.label || 'this issue'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    {suggested.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setAssigneeId(u.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border-2 transition-all cursor-pointer text-left ${
                          assigneeId === u.id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        {u.avatar ? (
                          <img src={u.avatar.split('#')[0]} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-100" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#162D4E] to-slate-700 flex items-center justify-center text-white text-[12px] font-bold shrink-0">
                            {u.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className={`text-[14px] font-bold truncate ${assigneeId === u.id ? 'text-emerald-800' : 'text-slate-800'}`}>{u.name}</p>
                          <p className="text-[12px] text-slate-400 truncate">{u.role}</p>
                        </div>
                        {assigneeId === u.id && (
                          <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Others (fallback dropdown) */}
              {others.length > 0 && (
                <div>
                  {suggested.length > 0 && (
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Or choose someone else</p>
                  )}
                  <div className="relative">
                    <select
                      value={!suggested.find(u => u.id === assigneeId) ? assigneeId : ''}
                      onChange={e => setAssigneeId(e.target.value)}
                      className="w-full appearance-none px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-300/50 cursor-pointer"
                    >
                      <option value="">Select from all staff...</option>
                      {others.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {selectedAssignee && (
                <p className="text-[12px] text-emerald-600 font-semibold mt-1.5 flex items-center gap-1">
                  ✓ {selectedAssignee.name} will be notified immediately
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-3 border border-slate-200 rounded-xl text-[14px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !category || !description.trim() || !assigneeId}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-xl text-[14px] font-bold cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Reporting...' : '🚨 Report Issue'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
