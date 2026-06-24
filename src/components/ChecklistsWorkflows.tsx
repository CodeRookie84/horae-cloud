/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ClipboardCheck, CheckCircle2, UserCheck, Building2, Check, ArrowLeft, ChevronRight, Clock, Loader2, Languages } from "lucide-react";
import { Checklist, ChecklistItem, Tenant } from "../types";
import { translateText, store } from "../services/store";

const CHECKLIST_LANGS = [
  { code: 'kn', label: 'ಕನ್ನಡ', name: 'Kannada' },
  { code: 'hi', label: 'हिंदी', name: 'Hindi' },
  { code: 'ta', label: 'தமிழ்', name: 'Tamil' },
  { code: 'bn', label: 'বাংলা', name: 'Bengali' },
] as const;

interface ChecklistsWorkflowsProps {
  checklists: Checklist[];
  tenants: Tenant[];
  onSubmitChecklist: (checklistId: string, itemStates: { [itemId: string]: boolean }, customInputs?: { [fieldName: string]: string }) => void;
  onBack?: () => void;
  onRefresh?: () => void;
}

export default function ChecklistsWorkflows({
  checklists: rawChecklists,
  tenants = [],
  onSubmitChecklist,
  onBack,
  onRefresh
}: ChecklistsWorkflowsProps) {
  const [selectedTenantId, setSelectedTenantId] = useState<string>("ALL");
  const [showCompleted, setShowCompleted] = useState<boolean>(false);
  const [customInputsState, setCustomInputsState] = useState<{ [checklistId: string]: { [fieldName: string]: string } }>({});

  const [localChecked, setLocalChecked] = useState<{ [itemId: string]: boolean }>(() => {
    const init: { [itemId: string]: boolean } = {};
    rawChecklists.forEach(c => {
      c.items.forEach(i => {
        init[i.id] = i.completed;
      });
    });
    return init;
  });

  const [yesNoAnswers, setYesNoAnswers] = useState<{ [itemId: string]: "yes" | "no" | "na" | "" }>(() => {
    const init: { [itemId: string]: "yes" | "no" | "na" | "" } = {};
    rawChecklists.forEach(c => {
      const latestSub = c.submissions && c.submissions.length > 0
        ? [...c.submissions].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0]
        : null;
      c.items.forEach(i => {
        if (i.completed && latestSub) {
          const choice = latestSub.customInputs?.[`choice_${i.id}`];
          if (choice === "yes" || choice === "no" || choice === "na") {
            init[i.id] = choice;
          } else {
            init[i.id] = "";
          }
        } else {
          init[i.id] = "";
        }
      });
    });
    return init;
  });

  const [userNotes, setUserNotes] = useState<{ [checklistId: string]: string }>(() => {
    const init: { [checklistId: string]: string } = {};
    rawChecklists.forEach(c => {
      const latestSub = c.submissions && c.submissions.length > 0
        ? [...c.submissions].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0]
        : null;
      const hasCompletedItem = c.items.some(i => i.completed);
      if (hasCompletedItem && latestSub) {
        init[c.id] = latestSub.customInputs?.["User Notes / Remarks"] || "";
      } else {
        init[c.id] = "";
      }
    });
    return init;
  });

  React.useEffect(() => {
    setLocalChecked(prev => {
      const next = { ...prev };
      rawChecklists.forEach(c => {
        c.items.forEach(i => {
          if (next[i.id] === undefined) {
            next[i.id] = i.completed;
          }
        });
      });
      return next;
    });

    setYesNoAnswers(prev => {
      const next = { ...prev };
      rawChecklists.forEach(c => {
        const latestSub = c.submissions && c.submissions.length > 0
          ? [...c.submissions].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0]
          : null;
        c.items.forEach(i => {
          if (next[i.id] === undefined || next[i.id] === "") {
            if (i.completed && latestSub) {
              const choice = latestSub.customInputs?.[`choice_${i.id}`];
              if (choice === "yes" || choice === "no" || choice === "na") {
                next[i.id] = choice;
              } else {
                next[i.id] = "";
              }
            } else {
              next[i.id] = "";
            }
          }
        });
      });
      return next;
    });

    setUserNotes(prev => {
      const next = { ...prev };
      rawChecklists.forEach(c => {
        if (next[c.id] === undefined || next[c.id] === "") {
          const latestSub = c.submissions && c.submissions.length > 0
            ? [...c.submissions].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0]
            : null;
          const hasCompletedItem = c.items.some(i => i.completed);
          if (hasCompletedItem && latestSub) {
            next[c.id] = latestSub.customInputs?.["User Notes / Remarks"] || "";
          } else {
            next[c.id] = "";
          }
        }
      });
      return next;
    });
  }, [rawChecklists]);

  const handleToggleLocal = (itemId: string) => {
    setLocalChecked(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // ── Translation state ───────────────────────────────────────────────────────
  // Cache: { [checklistId]: { [langCode]: { title, description, adminNotes, sections, items } } }
  const [translations, setTranslations] = useState<Record<string, Record<string, any>>>({});
  const [translatingLang, setTranslatingLang] = useState<string | null>(null);
  // Active language per checklist
  const [activeLangs, setActiveLangs] = useState<Record<string, string>>({});

  const handleTranslate = async (checklistId: string, langCode: string, checklist: Checklist) => {
    if (translatingLang) return;
    // Reset to original
    if (langCode === 'original') {
      setActiveLangs(prev => ({ ...prev, [checklistId]: 'original' }));
      return;
    }
    // Use cache if available
    if (translations[checklistId]?.[langCode]) {
      setActiveLangs(prev => ({ ...prev, [checklistId]: langCode }));
      return;
    }
    setTranslatingLang(langCode);
    try {
      const tr = async (text: string) => text.trim() ? await translateText(text, langCode as any) : text;
      const translatedTitle = await tr(checklist.title);
      const translatedDesc = await tr(checklist.description || '');
      const translatedNotes = await tr(checklist.adminNotes || '');
      // Translate sections
      const translatedSections = await Promise.all(
        (checklist.sections || []).map(async sec => ({
          ...sec,
          name: await tr(sec.name),
          items: await Promise.all(sec.items.map(async item => ({ ...item, text: await tr(item.text) })))
        }))
      );
      // Translate flat items
      const translatedItems = await Promise.all(
        checklist.items.map(async item => ({ ...item, text: await tr(item.text) }))
      );
      const result = {
        title: translatedTitle,
        description: translatedDesc,
        adminNotes: translatedNotes,
        sections: translatedSections,
        items: translatedItems,
      };
      setTranslations(prev => ({
        ...prev,
        [checklistId]: { ...(prev[checklistId] || {}), [langCode]: result }
      }));
      setActiveLangs(prev => ({ ...prev, [checklistId]: langCode }));
    } catch (e) {
      console.error('Checklist translation failed:', e);
    } finally {
      setTranslatingLang(null);
    }
  };

  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null);

  const checklists = (selectedTenantId === "ALL" 
    ? rawChecklists 
    : rawChecklists.filter(c => c.tenantId === selectedTenantId)
  ).filter(c => {
    if (showCompleted) return true;
    const isCompleted = c.items.length > 0 && c.items.every(i => i.completed);
    return !isCompleted;
  });

  // Determine which checklist is selected
  const activeChecklist = selectedChecklistId 
    ? checklists.find(c => c.id === selectedChecklistId) || null 
    : null;

  // If a specific checklist is selected, show only it
  if (activeChecklist) {
    const checklist = activeChecklist;
    const completedCount = checklist.type === "yes_no"
      ? checklist.items.filter(item => yesNoAnswers[item.id] === "yes" || yesNoAnswers[item.id] === "no" || yesNoAnswers[item.id] === "na").length
      : checklist.items.filter(item => localChecked[item.id]).length;
    const percentage = checklist.items.length > 0
      ? Math.round((completedCount / checklist.items.length) * 100)
      : 100;

    // Resolve display content (original or translated)
    const activeLang = activeLangs[checklist.id] || 'original';
    const trData = activeLang !== 'original' ? translations[checklist.id]?.[activeLang] : null;
    const displayTitle = trData?.title || checklist.title;
    const displayDesc = trData?.description !== undefined ? trData.description : (checklist.description || '');
    const displayNotes = trData?.adminNotes !== undefined ? trData.adminNotes : (checklist.adminNotes || '');
    const displaySections = trData?.sections || checklist.sections || [];
    const displayItems = trData?.items || checklist.items;

    return (
      <div className="space-y-4" id="checklists-wrapper">
        <button
          onClick={() => setSelectedChecklistId(null)}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer select-none border border-slate-200 hover:border-slate-300 bg-white px-3 py-1.5 rounded-xl shadow-xs self-start"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Checklists
        </button>

        <div 
          className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between"
        >
          <div className="space-y-3">
            {/* ── Language Selector ─────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                <Languages className="w-3 h-3" /> View in:
              </div>
              <button
                onClick={() => handleTranslate(checklist.id, 'original', checklist)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                  activeLang === 'original'
                    ? 'bg-[#162D4E] text-[#C5A880] border-[#162D4E]'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Original
              </button>
              {CHECKLIST_LANGS.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => handleTranslate(checklist.id, lang.code, checklist)}
                  disabled={translatingLang !== null}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                    activeLang === lang.code
                      ? 'bg-[#162D4E] text-[#C5A880] border-[#162D4E]'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {translatingLang === lang.code
                    ? <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Translating...</>
                    : <>{lang.label} <span className="text-[8px] text-slate-400">{lang.name}</span></>}
                </button>
              ))}
            </div>

            <div className="flex justify-between items-start gap-3">
              <div className="space-y-1 w-full text-left">
                <h3 className="text-sm font-bold text-slate-800 leading-snug mt-1">
                  {displayTitle}
                </h3>
                {displayDesc && (
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-0.5">{displayDesc}</p>
                )}
                {displayNotes && (
                  <div className="p-3 bg-amber-50/50 border border-amber-200/50 rounded-xl text-left my-2">
                    <span className="text-[9px] text-amber-800 font-bold uppercase tracking-wider block mb-0.5">Instructions / Admin Notes</span>
                    <p className="text-[10px] text-amber-900 font-medium leading-relaxed whitespace-pre-wrap">{displayNotes}</p>
                  </div>
                )}
                {(() => {
                  if (!checklist.attachment) return null;
                  try {
                    const fileObj = JSON.parse(checklist.attachment);
                    if (!fileObj.name || !fileObj.data) return null;
                    return (
                      <div className="mt-2.5">
                        <a
                          href={fileObj.data}
                          download={fileObj.name}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-2.5 py-1 rounded-xl transition-all cursor-pointer shadow-2xs"
                        >
                          📎 View Original Template: {fileObj.name}
                        </a>
                      </div>
                    );
                  } catch (e) {
                    return null;
                  }
                })()}
              </div>
            </div>

            {checklist.customInputFields && checklist.customInputFields.length > 0 && (
              <div className="space-y-2.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-150 text-left my-2">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Required Information</span>
                {checklist.customInputFields.map(field => {
                  const val = customInputsState[checklist.id]?.[field] || "";
                  return (
                    <div key={field} className="space-y-1">
                      <label className="text-[10px] text-slate-600 font-bold block">{field}</label>
                      <input
                        type="text"
                        placeholder={`Enter ${field.toLowerCase()}...`}
                        value={val}
                        onChange={(e) => {
                          setCustomInputsState(prev => ({
                            ...prev,
                            [checklist.id]: {
                              ...(prev[checklist.id] || {}),
                              [field]: e.target.value
                            }
                          }));
                        }}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500 transition-colors"
                      />
                    </div>
                  );
                })}
              </div>
            )}

          {/* Checklist Items */}
          <div className="space-y-3 pt-2 border-t border-slate-50" id="checklist-checkpoints-panel">
            {displaySections && displaySections.length > 0 ? (
              displaySections.map((section: any) => (
                <div key={section.id} className="space-y-2 text-left">
                  <div className="bg-slate-100/70 border border-slate-200/50 rounded-xl px-3 py-1 text-left">
                    <span className="text-[10px] font-bold text-slate-800 font-mono">
                      {section.number} {section.name}
                    </span>
                  </div>
                  <div className="space-y-1.5 pl-1">
                    {section.items.map((secItem: any) => {
                      const itemId = secItem.id;
                      const displayText = secItem.text;
                      const isYesNo = checklist.type === "yes_no";
                      const selectedAnswer = yesNoAnswers[itemId];
                      return (
                        <div 
                          key={itemId}
                          onClick={() => { if (!isYesNo) handleToggleLocal(itemId); }}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2 rounded-xl border transition-colors cursor-pointer select-none text-left ${
                            !isYesNo && localChecked[itemId] 
                              ? "bg-slate-50 border-slate-100/60 text-slate-500" 
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-55/50"
                          }`}
                        >
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            {!isYesNo && (
                              <button
                                type="button"
                                className={`mt-0.5 h-4 w-4 rounded-md border flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                                  localChecked[itemId] 
                                    ? "bg-emerald-500 border-emerald-500 text-white" 
                                    : "border-slate-300 bg-white"
                                }`}
                              >
                                {localChecked[itemId] && <CheckCircle2 className="w-3 h-3 text-white fill-emerald-500" />}
                              </button>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`text-[11px] font-semibold leading-relaxed ${!isYesNo && localChecked[itemId] ? "line-through text-slate-400" : "text-slate-800"}`}>
                                {displayText}
                              </p>
                            </div>
                          </div>
                          {isYesNo && (
                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                              {(["yes", "no", "na"] as const).map((choice) => {
                                const label = choice === "yes" ? "Yes" : choice === "no" ? "No" : "N/A";
                                const isSelected = selectedAnswer === choice;
                                let btnClass = "";
                                if (choice === "yes") { btnClass = isSelected ? "bg-emerald-600 text-white border-emerald-600 shadow-xs" : "bg-white text-emerald-600 border-slate-200 hover:bg-emerald-50"; }
                                else if (choice === "no") { btnClass = isSelected ? "bg-rose-600 text-white border-rose-600 shadow-xs" : "bg-white text-rose-600 border-slate-200 hover:bg-rose-50"; }
                                else { btnClass = isSelected ? "bg-slate-500 text-white border-slate-500 shadow-xs" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"; }
                                return (
                                  <button key={choice} type="button" onClick={() => setYesNoAnswers(prev => ({...prev, [itemId]: choice}))} className={`px-2.5 py-1 text-[10px] font-bold border rounded-lg transition-all cursor-pointer ${btnClass}`}>
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              displayItems.map((item: any) => {
                const displayText = item.text;
                const isYesNo = checklist.type === "yes_no";
                const selectedAnswer = yesNoAnswers[item.id];
                return (
                  <div 
                    key={item.id}
                    onClick={() => { if (!isYesNo) handleToggleLocal(item.id); }}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2 rounded-xl border transition-colors cursor-pointer select-none text-left ${
                      !isYesNo && localChecked[item.id] 
                        ? "bg-slate-50 border-slate-100/60 text-slate-500" 
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-55/50"
                    }`}
                  >
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      {!isYesNo && (
                        <button type="button" className={`mt-0.5 h-4 w-4 rounded-md border flex items-center justify-center transition-all shrink-0 cursor-pointer ${ localChecked[item.id] ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 bg-white"}`}>
                          {localChecked[item.id] && <CheckCircle2 className="w-3 h-3 text-white fill-emerald-500" />}
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-semibold leading-relaxed ${!isYesNo && localChecked[item.id] ? "line-through text-slate-400" : "text-slate-800"}`}>{displayText}</p>
                        {item.completed && !isYesNo && localChecked[item.id] && item.completedBy && (
                          <span className="text-[8px] font-bold font-mono text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded mt-0.5 inline-flex items-center gap-0.5">
                            <UserCheck className="w-2.5 h-2.5" /> Checked by {item.completedBy.name}
                          </span>
                        )}
                      </div>
                    </div>
                    {isYesNo && (
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        {(["yes", "no", "na"] as const).map((choice) => {
                          const label = choice === "yes" ? "Yes" : choice === "no" ? "No" : "N/A";
                          const isSelected = selectedAnswer === choice;
                          let btnClass = "";
                          if (choice === "yes") { btnClass = isSelected ? "bg-emerald-600 text-white border-emerald-600 shadow-xs" : "bg-white text-emerald-600 border-slate-200 hover:bg-emerald-50"; }
                          else if (choice === "no") { btnClass = isSelected ? "bg-rose-600 text-white border-rose-600 shadow-xs" : "bg-white text-rose-600 border-slate-200 hover:bg-rose-50"; }
                          else { btnClass = isSelected ? "bg-slate-500 text-white border-slate-500 shadow-xs" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"; }
                          return (
                            <button key={choice} type="button" onClick={() => setYesNoAnswers(prev => ({...prev, [item.id]: choice}))} className={`px-2.5 py-1 text-[10px] font-bold border rounded-lg transition-all cursor-pointer ${btnClass}`}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* User Notes */}
          <div className="space-y-1.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-150 text-left my-3">
            <label className="text-[10px] text-slate-605 font-bold block">User Notes / Remarks (Optional)</label>
            <textarea
              placeholder="Add notes, observations, or remarks..."
              value={userNotes[checklist.id] || ""}
              onChange={(e) => setUserNotes(prev => ({...prev, [checklist.id]: e.target.value}))}
              rows={2}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500 transition-colors resize-none"
            />
          </div>

          <button
            onClick={() => {
              if (checklist.customInputFields && checklist.customInputFields.length > 0) {
                const inputs = customInputsState[checklist.id] || {};
                const missingFields = checklist.customInputFields.filter(f => !inputs[f] || !inputs[f].trim());
                if (missingFields.length > 0) {
                  alert(`Please fill in all required fields: ${missingFields.join(", ")}`);
                  return;
                }
              }
              
              const itemStates: { [itemId: string]: boolean } = {};
              const finalCustomInputs = { ...(customInputsState[checklist.id] || {}) };
              
              if (checklist.type === "yes_no") {
                const allItems = checklist.sections && checklist.sections.length > 0
                  ? checklist.sections.flatMap(s => s.items)
                  : checklist.items;
                const unanswered = allItems.filter(item => !yesNoAnswers[item.id]);
                if (unanswered.length > 0) {
                  alert("Please select Yes, No, or N/A for all checkpoints.");
                  return;
                }
                allItems.forEach(i => {
                  const ans = yesNoAnswers[i.id];
                  itemStates[i.id] = (ans === "yes" || ans === "no" || ans === "na");
                  finalCustomInputs[`choice_${i.id}`] = ans;
                });
              } else {
                checklist.items.forEach(i => {
                  itemStates[i.id] = !!localChecked[i.id];
                });
              }
              
              if (userNotes[checklist.id]) {
                finalCustomInputs["User Notes / Remarks"] = userNotes[checklist.id];
              }
              
              onSubmitChecklist(checklist.id, itemStates, finalCustomInputs);
              setCustomInputsState(prev => { const next = { ...prev }; delete next[checklist.id]; return next; });
              setUserNotes(prev => { const next = { ...prev }; delete next[checklist.id]; return next; });
              setTimeout(() => {
                alert("Submitted successfully!");
                if (onRefresh) onRefresh();
                if (onBack) onBack();
              }, 100);
            }}
            className="mt-3 w-full bg-[#162D4E] hover:bg-[#162D4E]/90 text-[#C5A880] hover:text-[#C5A880]/90 py-2 rounded-xl shadow-xs cursor-pointer font-bold text-xs transition-all flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" /> Submit Checklist
          </button>
          </div>

          {/* Status Bar */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono mt-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-600">Compliance:</span>
              <span className="font-bold text-slate-700">{completedCount} / {checklist.items.length} ({percentage}%)</span>
            </div>
            <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${percentage === 100 ? "bg-emerald-500" : "bg-[#C5A880]"}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── CHECKLISTS LIST VIEW ─────────────────────────────────────────────────────
  return (
    <div className="space-y-4" id="checklists-wrapper">
      {onBack && (
        <button 
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-555 hover:text-slate-800 transition-colors cursor-pointer select-none border border-slate-200 hover:border-slate-300 bg-white px-3 py-1.5 rounded-xl shadow-xs self-start"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
      )}
      {/* Top Banner Control */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <ClipboardCheck className="text-amber-500 w-5 h-5" />
            Checklist Routine Audits
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Hide/Show Completed Toggle */}
          <button
            type="button"
            onClick={() => setShowCompleted(!showCompleted)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 select-none ${
              showCompleted 
                ? "bg-slate-900 border-slate-900 text-white" 
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span>{showCompleted ? "Show Completed" : "Hide Completed"}</span>
          </button>

          {/* Outlet Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700">
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>Filter Outlet:</span>
            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              className="bg-transparent font-bold focus:outline-none cursor-pointer text-slate-850"
            >
              <option value="ALL">All Outlets</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Checklist Name List */}
      {checklists.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 text-center py-16" id="no-checklists-banner">
          <ClipboardCheck className="mx-auto w-10 h-10 text-slate-300 mb-3" />
          <p className="text-sm font-bold text-slate-700">No Routines Configured</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
            There are no checklist routines configured for your role or outlet at this time.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {checklists.map((checklist, idx) => {
            const completedCount = checklist.type === "yes_no"
              ? checklist.items.filter(item => yesNoAnswers[item.id] === "yes" || yesNoAnswers[item.id] === "no" || yesNoAnswers[item.id] === "na").length
              : checklist.items.filter(item => localChecked[item.id]).length;
            const percentage = checklist.items.length > 0
              ? Math.round((completedCount / checklist.items.length) * 100)
              : 100;
            const isCompleted = checklist.items.length > 0 && checklist.items.every(i => i.completed);
            return (
              <button
                key={checklist.id}
                onClick={() => setSelectedChecklistId(checklist.id)}
                className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50 cursor-pointer ${
                  idx < checklists.length - 1 ? 'border-b border-slate-100' : ''
                }`}
              >
                <span className={`shrink-0 w-2 h-2 rounded-full ${
                  isCompleted ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{checklist.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[10px] text-slate-400">
                      {checklist.items.length} item{checklist.items.length !== 1 ? 's' : ''}
                      {checklist.type === "yes_no" && <span className="ml-1 text-indigo-500 font-bold">(Yes/No)</span>}
                    </p>
                    {checklist.recurrence && (
                      <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1 py-0.5 rounded">
                        <Clock className="inline w-2.5 h-2.5 mr-0.5" />{checklist.recurrence}
                      </span>
                    )}
                  </div>
                  {/* Mini progress bar */}
                  <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full transition-all duration-500 ${percentage === 100 ? "bg-emerald-500" : "bg-[#C5A880]"}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
