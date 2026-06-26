/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Megaphone, Inbox, Building2, ArrowLeft, ChevronRight, ShieldAlert, Clock, MessageSquare } from "lucide-react";
import { Notice, Tenant, User as AppUser, Role } from "../types";

interface NoticesWorkflowsProps {
  notices: Notice[];
  tenants: Tenant[];
  activeUser: AppUser;
  onBack?: () => void;
  onUrgentNotify?: (id: string) => void;
}

export default function NoticesWorkflows({
  notices: rawNotices,
  tenants = [],
  activeUser,
  onBack,
  onUrgentNotify
}: NoticesWorkflowsProps) {
  const canNotify = [Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER, Role.SUPERVISOR].includes(activeUser.role as Role);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("ALL");
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

  const [readNoticeIds, setReadNoticeIds] = useState<string[]>(() => {
    try {
      const val = localStorage.getItem(`horae_read_notices_${activeUser.id}`);
      return val ? JSON.parse(val) : [];
    } catch {
      return [];
    }
  });

  const handleMarkNoticeRead = (noticeId: string) => {
    const updated = [...readNoticeIds, noticeId];
    setReadNoticeIds(updated);
    localStorage.setItem(`horae_read_notices_${activeUser.id}`, JSON.stringify(updated));
  };

  const notices = selectedTenantId === "ALL" 
    ? rawNotices 
    : rawNotices.filter(n => n.tenantId === selectedTenantId);

  // ─── NOTICE DETAIL VIEW ─────────────────────────────────────────────────────
  if (selectedNotice) {
    const isUnread = !readNoticeIds.includes(selectedNotice.id);
    return (
      <div className="space-y-4" id="notices-detail-view">
        {/* Back button */}
        <button
          onClick={() => setSelectedNotice(null)}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer select-none border border-slate-200 hover:border-slate-300 bg-white px-3 py-1.5 rounded-xl shadow-xs self-start"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Notices List
        </button>

        <div className={`bg-white rounded-2xl border p-6 shadow-sm space-y-5 relative overflow-hidden ${
          selectedNotice.isUrgent ? "border-red-200 bg-red-50/5" : "border-slate-100"
        }`}>
          {selectedNotice.isUrgent && (
            <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />
          )}
          {/* Meta row */}
          <div className="text-xs text-slate-700 font-bold bg-slate-100/70 border border-slate-200/50 rounded-xl px-3 py-1.5 font-mono flex items-center justify-between">
            <span className="text-slate-500 uppercase tracking-wider text-[9px]">Published:</span>
            <span>{new Date(selectedNotice.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 items-center">
            {isUnread && (
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono animate-pulse">New</span>
            )}
            {selectedNotice.isUrgent && (
              <span className="text-[10px] font-bold bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-mono animate-pulse">⚠ Urgent</span>
            )}
            {selectedNotice.subject && (
              <span className="text-[10px] font-bold font-mono bg-rose-50 text-rose-800 border border-rose-150 px-1.5 py-0.5 rounded">Subject: {selectedNotice.subject}</span>
            )}
          </div>
          <h2 className="text-xl font-bold text-slate-800 leading-snug">{selectedNotice.title}</h2>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-normal">{selectedNotice.content}</p>
          {selectedNotice.videoUrl && (
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 shadow-inner">
              <video src={selectedNotice.videoUrl} controls className="w-full max-h-64 object-cover" />
            </div>
          )}
          {/* Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-md px-1.5 py-0.5 text-slate-600 text-[10px] font-mono">
              <span className="inline-block w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
              By: {selectedNotice.createdBy.name} ({selectedNotice.createdBy.role})
            </span>
            <div className="flex items-center gap-2">
              {canNotify && onUrgentNotify && (
                <button
                  onClick={() => onUrgentNotify(selectedNotice.id)}
                  title="Notify staff on WhatsApp now"
                  className="flex items-center gap-1.5 py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Notify on WhatsApp
                </button>
              )}
              {isUnread && (
                <button
                  onClick={() => handleMarkNoticeRead(selectedNotice.id)}
                  className="py-1.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                >
                  Mark as Read
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── NOTICES LIST VIEW ───────────────────────────────────────────────────────
  return (
    <div className="space-y-4" id="notices-wrapper">
      {onBack && (
        <button 
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer select-none border border-slate-200 hover:border-slate-300 bg-white px-3 py-1.5 rounded-xl shadow-xs self-start"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Megaphone className="text-amber-500 w-5 h-5 animate-bounce" />
            Operations Notice Board
          </h2>
          <p className="text-xs text-slate-400 mt-1">{notices.length} notice{notices.length !== 1 ? 's' : ''} · Click a notice to read it</p>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700">
          <Building2 className="w-3.5 h-3.5 text-indigo-600" />
          <span>Outlet:</span>
          <select value={selectedTenantId} onChange={(e) => setSelectedTenantId(e.target.value)} className="bg-transparent font-bold focus:outline-none cursor-pointer text-slate-850">
            <option value="ALL">All</option>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      {/* Notices Name List */}
      {notices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 text-center py-16">
          <Inbox className="mx-auto w-10 h-10 text-slate-300 mb-3" />
          <p className="text-sm font-bold text-slate-700">No Announcements Pending</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">No notices published for your department or role at this time.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {notices.map((notice, idx) => {
            const isUnread = !readNoticeIds.includes(notice.id);
            return (
              <div
                key={notice.id}
                className={`w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 ${
                  idx < notices.length - 1 ? 'border-b border-slate-100' : ''
                }`}
              >
                <button
                  onClick={() => setSelectedNotice(notice)}
                  className="flex-1 flex items-center gap-3 text-left cursor-pointer min-w-0"
                >
                  {/* Urgency / read indicator */}
                  <span className={`shrink-0 w-2 h-2 rounded-full ${
                    notice.isUrgent ? 'bg-red-500' : isUnread ? 'bg-emerald-500 animate-pulse' : 'bg-slate-200'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${ isUnread ? 'text-slate-800' : 'text-slate-500'}`}>
                      {notice.isUrgent && <span className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-100 px-1 py-0.5 rounded mr-1.5 uppercase">Urgent</span>}
                      {isUnread && <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1 py-0.5 rounded mr-1.5 uppercase">New</span>}
                      {notice.title}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(notice.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {notice.createdBy.name}
                    </p>
                  </div>
                </button>
                {canNotify && onUrgentNotify && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onUrgentNotify(notice.id); }}
                    title="Notify staff on WhatsApp now"
                    className="shrink-0 p-1.5 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                )}
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
