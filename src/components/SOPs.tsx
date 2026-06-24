/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { BookOpen, Search, Filter, CheckCircle2, FileText, ArrowLeft, Download, Eye } from "lucide-react";
import { SOP, SOPReadStatus, User as AppUser, Department, Role, isTargetMatched } from "../types";

interface SOPsProps {
  sops: SOP[];
  readStatuses: SOPReadStatus[];
  activeUser: AppUser;
  onMarkRead: (sopId: string, sopTitle: string) => void;
  onBack?: () => void;
}

export default function SOPs({
  sops,
  readStatuses,
  activeUser,
  onMarkRead,
  onBack
}: SOPsProps) {
  const [selectedSOP, setSelectedSOP] = useState<SOP | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [feedbackMsg, setFeedbackMsg] = useState<string>("");

  // Get categories from SOPs
  const categories = Array.from(new Set(sops.map(s => s.category)));

  // Filter SOPs targeted at this user
  const mySOPs = sops.filter(s => {
    const matchesSearch = s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "ALL" || s.category === selectedCategory;
    const matchesDept = isTargetMatched(s.department, activeUser.department, Department.ALL);
    const matchesRole = isTargetMatched(s.role, activeUser.role, Role.ALL);
    const matchesTenant = s.tenantId === "ALL" || s.tenantId === activeUser.tenantId;

    return matchesSearch && matchesCategory && matchesDept && matchesRole && matchesTenant;
  });

  const myReadStatuses = readStatuses.filter(r => r.userId === activeUser.id);

  const handleSelectSOP = (sop: SOP) => {
    setSelectedSOP(sop);
    setFeedbackMsg("");
  };

  const handleMarkAsRead = (sop: SOP) => {
    onMarkRead(sop.id, sop.title);
    setFeedbackMsg("Verification submitted: Confirmed reading and comprehension of this procedure!");
    setTimeout(() => {
      setFeedbackMsg("");
    }, 4000);
  };

  return (
    <div className="space-y-4" id="sops-container">
      {onBack && (
        <button 
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-555 hover:text-slate-800 transition-colors cursor-pointer select-none border border-slate-200 hover:border-slate-300 bg-white px-3 py-1.5 rounded-xl shadow-xs self-start"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
      )}
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <BookOpen className="text-indigo-600 w-5 h-5" />
            Standard Operating Procedures (SOP)
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Access, read, and confirm comprehension of formal baker, cashier, and kitchen operational manuals.
          </p>
        </div>
      </div>

      {selectedSOP ? (
        // SOP DETAIL READ VIEW
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-md space-y-6">
          <button
            onClick={() => setSelectedSOP(null)}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to SOP Directory
          </button>

          {feedbackMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-250 text-emerald-800 font-bold text-xs rounded-xl flex items-center gap-2 animate-pulse">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {feedbackMsg}
            </div>
          )}

          <div className="border-b border-slate-100 pb-4 space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[8px] font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded uppercase">
                {selectedSOP.category}
              </span>
              <span className="text-[8px] font-bold font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded uppercase">
                Dept: {selectedSOP.department}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-800">{selectedSOP.title}</h3>
            <p className="text-slate-500 text-xs leading-relaxed">{selectedSOP.description}</p>
          </div>

          {/* Render SOP Content */}
          <div className="prose max-w-none text-slate-750 text-xs leading-relaxed whitespace-pre-wrap p-5 bg-slate-50 rounded-2xl border border-slate-100 font-normal">
            {selectedSOP.content}
          </div>

          {/* Attachments if any */}
          {(() => {
            if (!selectedSOP.fileUrl) return null;
            let fileName = selectedSOP.fileUrl;
            let fileData: string | null = null;
            
            try {
              if (selectedSOP.fileUrl.startsWith("{")) {
                const parsed = JSON.parse(selectedSOP.fileUrl);
                fileName = parsed.name;
                fileData = parsed.data;
              }
            } catch (e) {
              console.error("Failed to parse SOP fileUrl as JSON", e);
            }

            if (!fileData) {
              return (
                <div className="p-4 bg-indigo-50/30 border border-indigo-100 rounded-xl flex items-center gap-3">
                  <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
                  <p className="text-xs font-bold text-slate-700">{fileName}</p>
                </div>
              );
            }

            const handleOpenFile = () => {
              try {
                const parts = fileData!.split(";base64,");
                const contentType = parts[0].split(":")[1] || "application/octet-stream";
                const raw = atob(parts[1]);
                const uInt8Array = new Uint8Array(raw.length);
                for (let i = 0; i < raw.length; i++) {
                  uInt8Array[i] = raw.charCodeAt(i);
                }
                const blob = new Blob([uInt8Array], { type: contentType });
                const blobUrl = URL.createObjectURL(blob);
                // For PDFs on iOS, we open in same tab as new tab can be blocked
                const a = document.createElement('a');
                a.href = blobUrl;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
              } catch (e) {
                // Fallback: use data URI directly
                const a = document.createElement('a');
                a.href = fileData!;
                a.target = '_blank';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }
            };

            const handleDownloadFile = () => {
              const a = document.createElement('a');
              a.href = fileData!;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            };
            
            return (
              <div className="p-4 bg-indigo-50/30 border border-indigo-100 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-800">{fileName}</p>
                    <p className="text-[9px] text-slate-400 font-medium font-mono">Reference Operations Manual Attachment</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button 
                    onClick={handleOpenFile}
                    className="flex items-center justify-center gap-1 bg-[#162D4E] text-[#C5A880] px-3 py-1.5 rounded-lg text-[10px] font-bold shadow hover:bg-opacity-95 cursor-pointer flex-1 sm:flex-none"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Open Document
                  </button>
                  <button 
                    onClick={handleDownloadFile}
                    className="flex items-center justify-center gap-1 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow hover:bg-slate-800 cursor-pointer flex-1 sm:flex-none"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                </div>
              </div>
            );
          })()}

          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            <span className="text-[9px] text-slate-400 font-mono">
              Published by: {selectedSOP.createdBy.name} ({selectedSOP.createdBy.role})
            </span>

            <div className="flex items-center gap-2">
              {myReadStatuses.find(r => r.sopId === selectedSOP.id) ? (
                <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-3 py-1.8 rounded-xl border border-emerald-200 text-xs font-bold font-mono">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Read Confirmation Logged
                </div>
              ) : (
                <button
                  onClick={() => handleMarkAsRead(selectedSOP)}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-900 border border-amber-500 font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  Mark as Read & Confirmed
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        // SOP SEARCH LIST DIRECTORY
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Search & Filter Controls */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search manuals, recipes, checkout policies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 shrink-0">
                <Filter className="w-3.5 h-3.5 text-indigo-600" />
                <span>Category:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-transparent font-bold focus:outline-none cursor-pointer text-slate-850"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {mySOPs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-200 text-center py-16 sm:col-span-2">
                  <FileText className="mx-auto w-10 h-10 text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-750">No SOP Manuals Found</p>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed max-w-sm mx-auto">
                    Try refining your search keyword or selecting a different category filter.
                  </p>
                </div>
              ) : (
                mySOPs.map(sop => {
                  const hasRead = myReadStatuses.find(r => r.sopId === sop.id);

                  return (
                    <div 
                      key={sop.id} 
                      onClick={() => handleSelectSOP(sop)}
                      className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3 cursor-pointer hover:shadow-md hover:border-indigo-150 transition-all text-left flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-[8px] font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded uppercase">
                            {sop.category}
                          </span>
                          {hasRead && (
                            <span className="text-[8px] font-bold font-mono bg-emerald-50 text-emerald-800 border border-emerald-100 px-1.5 py-0.5 rounded">
                              ✓ Read
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-slate-850 line-clamp-1 leading-tight">{sop.title}</h4>
                        <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed font-normal">{sop.description}</p>
                      </div>

                      <div className="pt-2.5 border-t border-slate-50 flex items-center justify-between text-[9px] text-slate-400 font-mono mt-2">
                        <span>By: {sop.createdBy.name}</span>
                        <span>{new Date(sop.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* SIDE PANEL: READ RECEIPT LOGS */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4 h-fit text-left">
            <div className="border-b border-slate-50 pb-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                Read Confirmation History
              </h3>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {myReadStatuses.length === 0 ? (
                <p className="text-[10px] text-slate-400 py-6 text-center">No manuals confirmed read yet.</p>
              ) : (
                myReadStatuses.map(status => (
                  <div key={status.id} className="border-b border-slate-50 pb-2.5 text-left text-[11px] space-y-0.5">
                    <span className="font-bold text-slate-700 leading-tight block truncate">
                      {status.sopTitle}
                    </span>
                    <p className="text-[9px] text-slate-400 font-mono">
                      Confirmed on {new Date(status.readAt).toLocaleDateString()} at {new Date(status.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
