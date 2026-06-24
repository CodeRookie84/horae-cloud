/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ClipboardCheck, Download, Search, Filter, Inbox, CheckCircle2, Circle, Building2 } from "lucide-react";
import { Checklist, Department, Role, User as AppUser, Tenant } from "../types";

interface ChecklistReportProps {
  checklists: Checklist[];
  activeUser: AppUser;
  tenants: Tenant[];
  tenantUsers?: AppUser[];
  onToggleChecklistItem: (chkId: string, itemId: string) => void;
  onDeleteChecklist: (id: string) => void;
}

export default function ChecklistReport({
  checklists,
  activeUser,
  tenants = [],
  tenantUsers = [],
  onToggleChecklistItem,
  onDeleteChecklist
}: ChecklistReportProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [tenantFilter, setTenantFilter] = useState<string>("ALL");

  // Filtering checklists
  const filteredChecklists = checklists.filter(chk => {
    const matchesSearch = chk.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          chk.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = deptFilter === "ALL" || chk.department === deptFilter;
    const matchesRole = roleFilter === "ALL" || chk.role === roleFilter;
    const matchesTenant = tenantFilter === "ALL" || chk.tenantId === tenantFilter;
    return matchesSearch && matchesDept && matchesRole && matchesTenant;
  });

  const downloadCSVReport = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Checklist Title,Description,Outlet,Department,Target Role,Created By,Item Text,Status,Completed By,Completed At\n";

    filteredChecklists.forEach(chk => {
      chk.items.forEach(item => {
        const title = `"${chk.title.replace(/"/g, '""')}"`;
        const desc = `"${chk.description.replace(/"/g, '""')}"`;
        const targetTenant = tenants.find(t => t.id === chk.tenantId);
        const tenantName = targetTenant ? `"${targetTenant.name}"` : `"${chk.tenantId}"`;
        const dept = `"${chk.department}"`;
        const role = `"${chk.role}"`;
        const creator = `"${chk.createdBy.name}"`;
        const itemText = `"${item.text.replace(/"/g, '""')}"`;
        const status = item.completed ? "Completed" : "Pending";
        const completedBy = item.completedBy ? `"${item.completedBy.name}"` : "N/A";
        const completedAt = item.completedAt ? `"${new Date(item.completedAt).toLocaleString()}"` : "N/A";

        csvContent += `${title},${desc},${tenantName},${dept},${role},${creator},${itemText},${status},${completedBy},${completedAt}\n`;
      });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Checklist_Compliance_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" id="checklist-report-container">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <ClipboardCheck className="text-[#C5A880] w-6 h-6" />
            Checklist Compliance Report
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Audit standard operating procedures across your organization. Monitor task compliance and download shift reports.
          </p>
        </div>

        <button
          onClick={downloadCSVReport}
          disabled={filteredChecklists.length === 0}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-50 font-semibold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Download CSV Report
        </button>
      </div>

      {/* Filters Section */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search checklists..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Outlet Filter */}
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={tenantFilter}
              onChange={(e) => setTenantFilter(e.target.value)}
              className="text-xs border border-slate-200 px-3 py-2 rounded-xl bg-slate-50 cursor-pointer font-semibold focus:outline-none"
            >
              <option value="ALL">All Outlets</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="text-xs border border-slate-200 px-3 py-2 rounded-xl bg-slate-50 cursor-pointer font-semibold focus:outline-none"
            >
              <option value="ALL">All Departments</option>
              {Array.from(new Set(tenantUsers.map(u => u.department).filter(Boolean))).map(d => (
                <option key={d as string} value={d as string}>{d as string}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-xs border border-slate-200 px-3 py-2 rounded-xl bg-slate-50 cursor-pointer font-semibold focus:outline-none"
            >
              <option value="ALL">All Roles</option>
              {Array.from(new Set(tenantUsers.map(u => u.role).filter(Boolean))).map(r => (
                <option key={r as string} value={r as string}>{r as string}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Reports Grid */}
      {filteredChecklists.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 text-center py-16">
          <Inbox className="mx-auto w-10 h-10 text-slate-300 mb-3" />
          <p className="text-sm font-bold text-slate-700">No Checklists Found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Try adjusting your search terms or filter configurations.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredChecklists.map(checklist => {
            const completedCount = checklist.items.filter(i => i.completed).length;
            const progressPct = checklist.items.length > 0 
              ? Math.round((completedCount / checklist.items.length) * 100) 
              : 100;

            return (
              <div key={checklist.id} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
                {/* Checklist Summary */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[9px] font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-150 px-2 py-0.5 rounded">
                        Dept: {checklist.department}
                      </span>
                      <span className="text-[9px] font-bold font-mono bg-amber-50 text-amber-700 border border-amber-155 px-2 py-0.5 rounded">
                        Target: {checklist.role}
                      </span>
                      {/* Target Outlet Badge */}
                      {(() => {
                        const t = tenants.find(tenant => tenant.id === checklist.tenantId);
                        return (
                          <span className="text-[9px] font-bold font-mono bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded">
                            Outlet: {t ? t.name : checklist.tenantId}
                          </span>
                        );
                      })()}
                      <span className="text-[9px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border">
                        Created by: {checklist.createdBy.name}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 mt-1">
                      {checklist.title}
                    </h3>
                    <p className="text-xs text-slate-500">{checklist.description}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="block text-sm font-bold text-slate-800">
                      {completedCount} / {checklist.items.length} Completed
                    </span>
                    <span className="text-xs text-slate-400 font-bold font-mono">
                      {progressPct}% Progress
                    </span>
                    <div className="w-32 bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden ml-auto">
                      <div className="bg-[#C5A880] h-full" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                </div>

                {/* Items Audit Detail */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5">Checklist Step</th>
                        <th className="px-4 py-2.5">Completed By</th>
                        <th className="px-4 py-2.5">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs">
                      {checklist.items.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3">
                            {item.completed ? (
                              <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                                <CheckCircle2 className="w-4 h-4" />
                                Completed
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-amber-500 font-semibold">
                                <Circle className="w-4 h-4" />
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-700">
                            {item.text}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {item.completedBy ? (
                              <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-slate-600">
                                {item.completedBy.name}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-400 font-mono text-[10px]">
                            {item.completedAt ? new Date(item.completedAt).toLocaleString() : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
