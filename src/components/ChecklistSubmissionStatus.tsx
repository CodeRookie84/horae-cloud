/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ChecklistSubmissionStatus.tsx — a lightweight "who's submitted / who hasn't"
 * board for a checklist's tagged watchers (assignment.notifyUserIds) plus the
 * Client Admin / Super Admin. This is deliberately NOT the full Register (that
 * stays in the Client Admin Panel) — it's a narrow, per-checklist exception so
 * a QC person or chef can track their own checklist's roster without gaining
 * any broader role or access elsewhere in the app.
 */
import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, CheckCircle2, Clock } from "lucide-react";
import { Role } from "../types";
import type { Checklist, Tenant, User as AppUser } from "../types";
import { getChecklistRuns, isWithinRecurrenceWindow } from "../services/checklistCompliance";

export default function ChecklistSubmissionStatus({
  checklists, tenants, allUsers = [], activeUser, onBack,
}: {
  checklists: Checklist[];
  tenants: Tenant[];
  allUsers?: AppUser[];
  activeUser: { id: string; name: string; role?: string };
  onBack: () => void;
}) {
  const isAdmin = activeUser.role === Role.ADMIN || activeUser.role === Role.SUPER_ADMIN;

  // Checklists the viewer may see status for: a fixed assigned roster, and the
  // viewer is either the Client Admin or explicitly tagged as this one's watcher.
  const visible = useMemo(() => checklists.filter((c) => {
    const isCompliance = !!((c as any).packId || (c as any).frequency);
    if (!isCompliance) return false;
    const asg = (c as any).assignment;
    const roster: string[] = asg?.userIds || [];
    if (!roster.length) return false;
    if (isAdmin) return true;
    return (asg?.notifyUserIds || []).includes(activeUser.id);
  }), [checklists, isAdmin, activeUser.id]);

  const [runsByChecklist, setRunsByChecklist] = useState<Record<string, { userId: string; completedAt: string }[]>>({});
  const [loading, setLoading] = useState(true);
  const visibleKey = visible.map((c) => c.id).join(",");

  useEffect(() => {
    let alive = true;
    if (!visible.length) { setRunsByChecklist({}); setLoading(false); return; }
    setLoading(true);
    Promise.all(visible.map((c) => getChecklistRuns({ checklistId: c.id, tenantIds: [c.tenantId], limit: 300 })))
      .then((results) => {
        if (!alive) return;
        const map: Record<string, { userId: string; completedAt: string }[]> = {};
        visible.forEach((c, i) => {
          map[c.id] = (results[i] || [])
            .filter((r) => !!r.performer.userId)
            .map((r) => ({ userId: r.performer.userId as string, completedAt: r.completedAt }));
        });
        setRunsByChecklist(map);
        setLoading(false);
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey]);

  const nameFor = (userId: string) => allUsers.find((u) => u.id === userId)?.name || userId;
  const outletFor = (tenantId: string) => tenants.find((t) => t.id === tenantId)?.name || tenantId;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer select-none border border-slate-200 hover:border-slate-300 bg-white px-3 py-1.5 rounded-xl shadow-xs">
        <ArrowLeft className="w-4 h-4" /> Back to Checklists
      </button>

      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-800">Submission status</h2>
        <p className="text-[11px] text-slate-500 mt-0.5">Who's submitted this cycle for the checklists you're tagged to watch.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 text-center py-16 text-sm text-slate-500">
          No checklists with a fixed roster are tagged to you yet.
        </div>
      ) : (
        visible.map((c) => {
          const roster: string[] = (c as any).assignment?.userIds || [];
          const runs = runsByChecklist[c.id] || [];
          const latestByUser: Record<string, string> = {};
          runs.forEach((r) => {
            if (!latestByUser[r.userId] || r.completedAt > latestByUser[r.userId]) latestByUser[r.userId] = r.completedAt;
          });
          return (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-1.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-50">
                <h3 className="text-sm font-bold text-slate-800">{c.title}</h3>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{outletFor(c.tenantId)}</span>
              </div>
              <div className="divide-y divide-slate-50">
                {roster.map((uid) => {
                  const last = latestByUser[uid];
                  const done = last ? isWithinRecurrenceWindow(c.recurrence, last) : false;
                  return (
                    <div key={uid} className="flex items-center justify-between py-1.5 text-xs">
                      <span className="text-slate-700 font-medium">{nameFor(uid)}</span>
                      {done ? (
                        <span className="flex items-center gap-1 text-emerald-600 font-bold"><CheckCircle2 className="w-3.5 h-3.5" /> Submitted</span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-500 font-semibold"><Clock className="w-3.5 h-3.5" /> Pending</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
