/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShieldCheck, Megaphone, ClipboardCheck, MessageSquare, BookOpen, FileText, 
  Plus, Trash2, BellRing, Bell, Download, Search, Check, ChevronRight, X, Filter, Users, AlertTriangle, ArrowRight,
  Building2, UserPlus, Edit2, Copy, Languages, ArrowLeft, KeyRound, Eye, EyeOff, MessageCircle
} from "lucide-react";
import {
  Notice, Checklist, Task, User as AppUser, Tenant, Department, Role, Quiz, QuizAttempt, SOP, SOPReadStatus, Client
} from "../types";
import { store, translateText } from "../services/store";


function MultiSelectChecklist({
  label,
  options,
  selectedValues,
  onChange,
  allValue
}: {
  label: string;
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  allValue: string;
}) {
  return (
    <div className="space-y-1 text-left">
      <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">{label}</label>
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 max-h-24 overflow-y-auto space-y-1 text-left">
        {options.map(opt => {
          const isChecked = selectedValues.includes(opt);
          return (
            <label key={opt} className="flex items-center gap-1.5 text-[10px] text-slate-700 font-semibold cursor-pointer hover:bg-slate-100/50 p-0.5 rounded transition-colors select-none">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => {
                  if (opt === allValue) {
                    onChange([allValue]);
                  } else {
                    let updated = isChecked
                      ? selectedValues.filter(v => v !== opt)
                      : [...selectedValues.filter(v => v !== allValue), opt];
                    if (updated.length === 0) {
                      updated = [allValue];
                    }
                    onChange(updated);
                  }
                }}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span>{opt}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

interface ClientAdminPanelProps {
  notices: Notice[];
  onPostNotice: (title: string, content: string, dept: Department | string, role: Role | string, isUrgent: boolean, tenantId: string, subject?: string) => void;
  onDeleteNotice: (id: string) => void;
  
  checklists: Checklist[];
  onCreateChecklist: (title: string, description: string, dept: Department | string, role: Role | string, items: string[], tenantId: string, recurrence?: string, recurrenceDay?: string, attachment?: string, customInputFields?: string[], sections?: any[], type?: "single" | "yes_no", adminNotes?: string, groupId?: string) => void;
  onUpdateChecklist?: (id: string, title: string, description: string, dept: Department | string, role: Role | string, items: string[], tenantId: string, recurrence?: string, recurrenceDay?: string, attachment?: string, customInputFields?: string[], sections?: any[], type?: "single" | "yes_no", adminNotes?: string) => void;
  onSubmitChecklist: (checklistId: string, itemStates: { [itemId: string]: boolean }, customInputs?: { [fieldName: string]: string }) => void;
  onDeleteChecklist: (id: string) => void;
  
  tasks: Task[];
  allUsers: AppUser[];
  tenantUsers: AppUser[];
  tenants: Tenant[];
  onAddTask: (title: string, description: string, priority: string, dueDate: string, assignedUserIds: string[], tenantId: string) => void;
  onUpdateTaskStatus: (taskId: string, status: "Assigned" | "In Progress" | "Pending" | "On Hold" | "Completed" | "Closed") => void;
  onUpdateTaskPriority: (taskId: string, priority: string) => void;
  onAddMessage: (taskId: string, message: string) => void;
  onDeleteTask: (id: string) => void;

  quizzes: Quiz[];
  onCreateQuiz: (title: string, description: string, dept: Department | string, role: Role | string, questions: any[], tenantId: string) => void;
  onDeleteQuiz: (id: string) => void;
  quizAttempts: QuizAttempt[];
  
  sops: SOP[];
  onCreateSOP: (title: string, description: string, category: string, dept: Department | string, role: Role | string, content: string, fileUrl: string, tenantId: string) => void;
  onDeleteSOP: (id: string) => void;
  sopReadStatuses: SOPReadStatus[];
  
  activeUser: AppUser;
  activeClient: Client;
  
  onAddTenant: (clientId: string, name: string, subdomain: string, logo: string, plan: "Free" | "Essential" | "Pro" | "Enterprise") => void;
  onUpdateTenant: (tenantId: string, name: string, subdomain: string, logo: string, plan: "Free" | "Essential" | "Pro" | "Enterprise") => void;
  onDeleteTenant: (tenantId: string) => void;
  
  onOnboardUser: (tenantId: string, name: string, email: string, role: string, department: string, avatar: string, phoneNumber?: string, whatsappOptedIn?: boolean, clitAccess?: boolean, clitRole?: string) => void;
  onUpdateUser: (userId: string, name: string, email: string, role: string, department: string, clitAccess?: boolean, clitRole?: string) => void;
  onDeleteUser: (userId: string) => void;
  onBack?: () => void;
}

export default function ClientAdminPanel({
  notices,
  onPostNotice,
  onDeleteNotice,
  checklists,
  onCreateChecklist,
  onUpdateChecklist,
  onSubmitChecklist,
  onDeleteChecklist,
  tasks,
  allUsers,
  tenantUsers,
  tenants,
  onAddTask,
  onUpdateTaskStatus,
  onUpdateTaskPriority,
  onAddMessage,
  onDeleteTask,
  quizzes,
  onCreateQuiz,
  onDeleteQuiz,
  quizAttempts,
  sops,
  onCreateSOP,
  onDeleteSOP,
  sopReadStatuses,
  activeUser,
  activeClient,
  onAddTenant,
  onUpdateTenant,
  onDeleteTenant,
  onOnboardUser,
  onUpdateUser,
  onDeleteUser,
  onBack
}: ClientAdminPanelProps) {
  // Sub-tabs: notices, checklists, tasks, quizzes, sops, outlets, staff
  const [activeSubTab, setActiveSubTab] = useState<string>("notices");

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

  // Filter Outlets
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>("ALL");

  const clientUsers = allUsers?.filter(u => tenants.some(t => t.id === u.tenantId)) || tenantUsers;

  // ----------------------------------------------------
  // SUB-TAB 6: Outlets State & Logic
  // ----------------------------------------------------
  const [outletName, setOutletName] = useState("");
  const [outletSubdomain, setOutletSubdomain] = useState("");
  const [outletLogo, setOutletLogo] = useState("🏪");
  const [outletSuccessMsg, setOutletSuccessMsg] = useState("");

  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [editTenantName, setEditTenantName] = useState("");
  const [editTenantSubdomain, setEditTenantSubdomain] = useState("");
  const [editTenantLogo, setEditTenantLogo] = useState("");
  const [editTenantPlan, setEditTenantPlan] = useState<"Free" | "Essential" | "Pro" | "Enterprise">("Pro");
  const [deletingTenantId, setDeletingTenantId] = useState<string | null>(null);

  const handleCreateOutlet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClient.id || !outletName.trim() || !outletSubdomain.trim()) return;
    
    let sub = outletSubdomain.toLowerCase().replace(/\s+/g, "-");
    if (!sub.endsWith(".horae.ops")) {
      sub = `${sub}.horae.ops`;
    }

    onAddTenant(activeClient.id, outletName, sub, outletLogo, "Enterprise");
    setOutletSuccessMsg(`Successfully added Outlet: ${outletName}!`);
    setOutletName("");
    setOutletSubdomain("");
    setTimeout(() => setOutletSuccessMsg(""), 4000);
  };

  // ----------------------------------------------------
  // SUB-TAB 7: Staff State & Logic
  // ----------------------------------------------------
  const [staffTenantId, setStaffTenantId] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [staffRole, setStaffRole] = useState("");
  const [staffDept, setStaffDept] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [customDept, setCustomDept] = useState("");
  const [staffSuccessMsg, setStaffSuccessMsg] = useState("");
  const [staffErrorMsg, setStaffErrorMsg] = useState("");

  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserRole, setEditUserRole] = useState("");
  const [editUserDepartment, setEditUserDepartment] = useState("");
  const [resetPwdUser, setResetPwdUser] = useState<AppUser | null>(null);
  const [resetPwdValue, setResetPwdValue] = useState("");
  const [showResetPwdToggle, setShowResetPwdToggle] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (tenants.length > 0) {
      if (!staffTenantId || !tenants.some(o => o.id === staffTenantId)) {
        setStaffTenantId(tenants[0].id);
      }
    } else {
      setStaffTenantId("");
    }
  }, [tenants]);

  const baselineRoles = [
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.MANAGER,
    Role.SUPERVISOR,
    Role.STAFF
  ] as string[];

  const baselineDepts = [
    Department.MANAGEMENT,
    Department.OUTLET,
    Department.STORE
  ] as string[];

  const dynamicRoles = Array.from(new Set([
    ...tenantUsers.map(u => u.role),
    ...store.getCustomRoles()
  ])).filter(Boolean) as string[];
  const activeRoles = dynamicRoles.length > 0 ? dynamicRoles : ["Manager", "Supervisor", "Staff", "Cashier", "Chef"];

  const dynamicDepts = Array.from(new Set([
    ...tenantUsers.map(u => u.department),
    ...store.getCustomDepts()
  ])).filter(Boolean) as string[];
  const activeDepts = dynamicDepts.length > 0 ? dynamicDepts : ["Management", "Kitchen & Baking", "Front Desk & Sales", "Packing & Inventory"];

  // availableRoles: all roles for onboarding/editing staff directory
  const availableRoles = [...activeRoles, "+ Create custom..."];

  // availableDepts: all departments for onboarding/editing staff directory
  const availableDepts = [...activeDepts, "+ Create custom..."];

  // For other creation forms (Notices, Checklists, Quizzes, SOPs): allow active roles & departments
  const multiSelectRoles = ["All Roles", ...activeRoles];
  const multiSelectDepts = ["All Departments", ...activeDepts];

  // Initialize staffRole and staffDept to first active ones if empty
  useEffect(() => {
    if (!staffRole && activeRoles.length > 0) {
      setStaffRole(activeRoles[0]);
    }
  }, [activeRoles, staffRole]);

  useEffect(() => {
    if (!staffDept && activeDepts.length > 0) {
      setStaffDept(activeDepts[0]);
    }
  }, [activeDepts, staffDept]);

  const handleOnboardStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetTenant = staffTenantId || tenants[0]?.id;
    if (!targetTenant || !staffName.trim() || !staffEmail.trim()) return;

    const roleToOnboard = staffRole === "+ Create custom..." ? customRole.trim() : staffRole;
    const deptToOnboard = staffDept === "+ Create custom..." ? customDept.trim() : staffDept;

    if (!roleToOnboard || !deptToOnboard) {
      alert("Please enter a valid custom Role and Department.");
      return;
    }

    const avatarUrl = `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(staffName)}&backgroundColor=f8fafc`;

    try {
      setStaffErrorMsg("");
      await onOnboardUser(targetTenant, staffName, staffEmail, roleToOnboard as Role, deptToOnboard as Department, avatarUrl, staffPhone, !!staffPhone);
      const generatedPwd = store.getPasswordForEmail(staffEmail);
      setStaffSuccessMsg(`Staff member ${staffName} onboarded! Generated Password: ${generatedPwd}`);
      setStaffName("");
      setStaffEmail("");
      setStaffPhone("");
      setCustomRole("");
      setCustomDept("");
      setStaffRole(activeRoles[0] || "");
      setStaffDept(activeDepts[0] || "");
      setTimeout(() => setStaffSuccessMsg(""), 8000);
    } catch (err: any) {
      setStaffErrorMsg(err?.message || "Failed to onboard staff. Please try again.");
    }
  };

  const handleResetPassword = (usr: AppUser) => {
    setResetPwdUser(usr);
    setResetPwdValue("");
    setShowResetPwdToggle(false);
  };

  const downloadStaffCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Name,Email,Outlet,Role,Department,Password\n";
    tenantUsers.forEach(usr => {
      const name = `"${usr.name.replace(/"/g, '""')}"`;
      const email = `"${usr.email.replace(/"/g, '""')}"`;
      const tenant = `"${tenants.find(t => t.id === usr.tenantId)?.name || usr.tenantId}"`;
      const role = `"${usr.role}"`;
      const dept = `"${usr.department}"`;
      const pwd = `"${store.getPasswordForEmail(usr.email)}"`;
      csvContent += `${name},${email},${tenant},${role},${dept},${pwd}\n`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Staff_Directory_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadQuizScoreboardCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Employee,Role,Quiz Assessment,Score,Total Questions,Percentage,Completed Date\n";
    quizAttempts.forEach(att => {
      const emp = `"${att.userName.replace(/"/g, '""')}"`;
      const role = `"${att.userRole}"`;
      const title = `"${att.quizTitle.replace(/"/g, '""')}"`;
      const score = att.score;
      const total = att.totalQuestions;
      const pct = `"${Math.round((att.score / att.totalQuestions) * 100)}%"`;
      const date = `"${new Date(att.completedAt).toLocaleString()}"`;
      csvContent += `${emp},${role},${title},${score},${total},${pct},${date}\n`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Quiz_Scoreboard_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered lists based on outlet filter
  const filteredNotices = selectedOutletFilter === "ALL" ? notices : notices.filter(n => n.tenantId === selectedOutletFilter);
  const filteredChecklists = selectedOutletFilter === "ALL" ? checklists : checklists.filter(c => c.tenantId === selectedOutletFilter);
  const filteredTasks = selectedOutletFilter === "ALL" ? tasks : tasks.filter(t => t.tenantId === selectedOutletFilter);
  const filteredQuizzes = selectedOutletFilter === "ALL" ? quizzes : quizzes.filter(q => q.tenantId === selectedOutletFilter || q.tenantId === "ALL");
  const filteredSOPs = selectedOutletFilter === "ALL" ? sops : sops.filter(s => s.tenantId === selectedOutletFilter || s.tenantId === "ALL");

  // ----------------------------------------------------
  // SUB-TAB 1: Notices State & Logic
  // ----------------------------------------------------
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeSubject, setNoticeSubject] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [noticeDepts, setNoticeDepts] = useState<string[]>([Department.ALL]);
  const [noticeRoles, setNoticeRoles] = useState<string[]>([Role.ALL]);
  const [noticeIsUrgent, setNoticeIsUrgent] = useState(false);
  const [noticeTenant, setNoticeTenant] = useState("ALL");
  const [noticeError, setNoticeError] = useState("");
  const [noticeVideoUrl, setNoticeVideoUrl] = useState("");
  const [videoUploading, setVideoUploading] = useState(false);

  const handleNoticeVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setNoticeVideoUrl("");
      return;
    }
    setVideoUploading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      setNoticeVideoUrl(dataUrl);
      setVideoUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handlePostNoticeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeContent.trim()) {
      setNoticeError("Please provide both a title and details.");
      return;
    }
    let packedContent = noticeContent;
    if (noticeVideoUrl) {
      packedContent = `${noticeContent}\n\n---HORAE-METADATA---\n${JSON.stringify({ videoUrl: noticeVideoUrl })}`;
    }
    onPostNotice(noticeTitle, packedContent, JSON.stringify(noticeDepts), JSON.stringify(noticeRoles), noticeIsUrgent, noticeTenant, noticeSubject);
    setNoticeTitle("");
    setNoticeSubject("");
    setNoticeContent("");
    setNoticeVideoUrl("");
    setNoticeDepts([Department.ALL]);
    setNoticeRoles([Role.ALL]);
    setNoticeIsUrgent(false);
    setNoticeTenant("ALL");
    setNoticeError("");
  };

  // ----------------------------------------------------
  // SUB-TAB 2: Checklists State & Logic
  // ----------------------------------------------------
  const [checklistTitle, setChecklistTitle] = useState("");
  const [checklistDesc, setChecklistDesc] = useState("");
  const [checklistDepts, setChecklistDepts] = useState<string[]>([Department.ALL]);
  const [checklistRoles, setChecklistRoles] = useState<string[]>([Role.ALL]);
  const [checklistTenant, setChecklistTenant] = useState("ALL");
  const [checklistRecurrence, setChecklistRecurrence] = useState("Daily");
  const [checklistRecurrenceDay, setChecklistRecurrenceDay] = useState("");
  const [checklistError, setChecklistError] = useState("");
  const [checklistAttachment, setChecklistAttachment] = useState<string>("");
  const [checklistCustomFields, setChecklistCustomFields] = useState<string[]>(["Unit", "Date", "Checked by"]);
  const [newCustomFieldName, setNewCustomFieldName] = useState("");
  const [checklistType, setChecklistType] = useState<"single" | "yes_no">("single");
  const [checklistAdminNotes, setChecklistAdminNotes] = useState("");
  const [checklistSections, setChecklistSections] = useState<{ id: string; number: string; name: string; itemsText: string }[]>([
    { id: "sec-1", number: "1.0", name: "Opening Checks", itemsText: "" }
  ]);
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [isTranslatingForm, setIsTranslatingForm] = useState(false);

  const handleChecklistFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setChecklistAttachment("");
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      const serialized = JSON.stringify({
        name: file.name,
        data: dataUrl
      });
      setChecklistAttachment(serialized);
    };
    reader.readAsDataURL(file);
  };

  // Checklist Compliance Report filters
  const [chkReportSearch, setChkReportSearch] = useState("");

  const handleAddCustomField = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!newCustomFieldName.trim()) return;
    if (checklistCustomFields.includes(newCustomFieldName.trim())) return;
    setChecklistCustomFields([...checklistCustomFields, newCustomFieldName.trim()]);
    setNewCustomFieldName("");
  };

  const handleRemoveCustomField = (index: number) => {
    setChecklistCustomFields(checklistCustomFields.filter((_, i) => i !== index));
  };

  const handleAddChecklistSection = (e: React.MouseEvent) => {
    e.preventDefault();
    const nextNum = (checklistSections.length + 1) + ".0";
    setChecklistSections([
      ...checklistSections,
      { id: `sec-${Date.now()}`, number: nextNum, name: `Subsection ${checklistSections.length + 1}`, itemsText: "" }
    ]);
  };

  const handleRemoveChecklistSection = (id: string) => {
    if (checklistSections.length <= 1) return;
    setChecklistSections(checklistSections.filter(s => s.id !== id));
  };

  const handleUpdateChecklistSection = (id: string, field: string, value: string) => {
    setChecklistSections(checklistSections.map(s => {
      if (s.id === id) {
        return { ...s, [field]: value };
      }
      return s;
    }));
  };

  const handleSOPFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSopAttachment("");
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      const serialized = JSON.stringify({
        name: file.name,
        data: dataUrl
      });
      setSopAttachment(serialized);
    };
    reader.readAsDataURL(file);
  };

  const handleStartEditChecklist = (chk: Checklist) => {
    setEditingChecklistId(chk.id);
    setChecklistTitle(chk.title);
    setChecklistDesc(chk.description || "");
    
    // Parse depts and roles
    try {
      if (chk.department && chk.department.startsWith("[")) {
        setChecklistDepts(JSON.parse(chk.department));
      } else {
        setChecklistDepts([chk.department as string]);
      }
    } catch {
      setChecklistDepts([chk.department as string]);
    }
    
    try {
      if (chk.role && chk.role.startsWith("[")) {
        setChecklistRoles(JSON.parse(chk.role));
      } else {
        setChecklistRoles([chk.role as string]);
      }
    } catch {
      setChecklistRoles([chk.role as string]);
    }

    setChecklistTenant(chk.tenantId);
    setChecklistRecurrence(chk.recurrence || "One-time");
    setChecklistRecurrenceDay(chk.recurrenceDay || "");
    setChecklistAttachment(chk.attachment || "");
    setChecklistType(chk.type || "single");
    setChecklistAdminNotes(chk.adminNotes || "");
    
    if (chk.customInputFields && chk.customInputFields.length > 0) {
      setChecklistCustomFields(chk.customInputFields);
    } else {
      setChecklistCustomFields(["Unit", "Date", "Checked by"]);
    }
    
    if (chk.sections && chk.sections.length > 0) {
      const mappedSections = chk.sections.map(sec => ({
        id: sec.id,
        number: sec.number,
        name: sec.name,
        itemsText: sec.items.map(item => item.text).join("\n")
      }));
      setChecklistSections(mappedSections);
    } else {
      setChecklistSections([
        {
          id: "sec-1",
          number: "1.0",
          name: "Standard Checkpoints",
          itemsText: chk.items.map(item => item.text).join("\n")
        }
      ]);
    }

    const el = document.getElementById("checklist-creator-form-panel");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const [duplicatingGroupId, setDuplicatingGroupId] = useState<string | null>(null);

  const handleDuplicateChecklist = (chk: Checklist) => {
    handleStartEditChecklist(chk);
    setEditingChecklistId(null);
    setChecklistTitle(`${chk.title} (Duplicate)`);
    // Use the existing groupId, or generate a new one
    const sharedGroupId = (chk as any).groupId || `group-${chk.id}`;
    setDuplicatingGroupId(sharedGroupId);
    // If the original had no groupId stored in DB, patch it now so submissions can be linked
    if (!(chk as any).groupId) {
      store.patchChecklistGroupId(chk.id, sharedGroupId).catch(console.error);
    }
  };

  const handleResetChecklistForm = () => {
    setEditingChecklistId(null);
    setDuplicatingGroupId(null);
    setChecklistTitle("");
    setChecklistDesc("");
    setChecklistDepts([Department.ALL]);
    setChecklistRoles([Role.ALL]);
    setChecklistTenant("ALL");
    setChecklistRecurrence("Daily");
    setChecklistRecurrenceDay("");
    setChecklistError("");
    setChecklistAttachment("");
    setChecklistCustomFields(["Unit", "Date", "Checked by"]);
    setChecklistType("single");
    setChecklistAdminNotes("");
    setChecklistSections([
      { id: "sec-1", number: "1.0", name: "Opening Checks", itemsText: "" }
    ]);
  };

  const handleAutoTranslateForm = async (targetLang: 'hi' | 'kn' | 'ta') => {
    if (isTranslatingForm) return;
    setIsTranslatingForm(true);
    setChecklistError("");
    try {
      if (checklistTitle.trim()) {
        const trTitle = await translateText(checklistTitle, targetLang);
        setChecklistTitle(trTitle);
      }
      if (checklistDesc.trim()) {
        const trDesc = await translateText(checklistDesc, targetLang);
        setChecklistDesc(trDesc);
      }
      if (checklistAdminNotes.trim()) {
        const trNotes = await translateText(checklistAdminNotes, targetLang);
        setChecklistAdminNotes(trNotes);
      }
      const translatedSections = await Promise.all(
        checklistSections.map(async (sec) => {
          const trName = sec.name.trim() ? await translateText(sec.name, targetLang) : sec.name;
          const lines = sec.itemsText.split("\n").map(l => l.trim()).filter(Boolean);
          const translatedLines = await Promise.all(
            lines.map(l => translateText(l, targetLang))
          );
          return {
            ...sec,
            name: trName,
            itemsText: translatedLines.join("\n")
          };
        })
      );
      setChecklistSections(translatedSections);
    } catch (e) {
      console.error(e);
      setChecklistError("Form auto-translation failed.");
    } finally {
      setIsTranslatingForm(false);
    }
  };

  const handleCreateChecklistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checklistTitle.trim()) {
      setChecklistError("Checklist Title is required.");
      return;
    }

    const sectionsToSave: any[] = [];
    const flatItemsToCreate: string[] = [];

    for (const sec of checklistSections) {
      if (!sec.number.trim() || !sec.name.trim()) {
        setChecklistError("Please enter Subsection Number and Name for all subsections.");
        return;
      }
      const sectionItems = sec.itemsText
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      if (sectionItems.length === 0) {
        setChecklistError(`Please add at least one checkpoint in Subsection ${sec.number}: ${sec.name}.`);
        return;
      }

      const parsedItems = sectionItems.map((txt, index) => {
        const itemId = `item-${sec.id}-${index}-${Date.now()}`;
        flatItemsToCreate.push(txt);
        return {
          id: itemId,
          text: txt
        };
      });

      sectionsToSave.push({
        id: sec.id,
        number: sec.number.trim(),
        name: sec.name.trim(),
        items: parsedItems
      });
    }

    if (sectionsToSave.length === 0) {
      setChecklistError("Please add at least one subsection.");
      return;
    }

    if (editingChecklistId) {
      if (onUpdateChecklist) {
        onUpdateChecklist(
          editingChecklistId,
          checklistTitle,
          checklistDesc,
          JSON.stringify(checklistDepts),
          JSON.stringify(checklistRoles),
          flatItemsToCreate,
          checklistTenant,
          checklistRecurrence,
          checklistRecurrenceDay,
          checklistAttachment,
          checklistCustomFields,
          sectionsToSave,
          checklistType,
          checklistAdminNotes
        );
      }
    } else {
      onCreateChecklist(
        checklistTitle, 
        checklistDesc, 
        JSON.stringify(checklistDepts), 
        JSON.stringify(checklistRoles), 
        flatItemsToCreate, 
        checklistTenant,
        checklistRecurrence,
        checklistRecurrenceDay,
        checklistAttachment,
        checklistCustomFields,
        sectionsToSave,
        checklistType,
        checklistAdminNotes,
        duplicatingGroupId || undefined
      );
    }

    handleResetChecklistForm();
  };

  const downloadChecklistCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Checklist,Outlet,Department,Role,Submitted By,Role/Designation,Submitted At,Custom Inputs,User Notes\n";
    
    filteredChecklists.forEach(chk => {
      if (chk.submissions && chk.submissions.length > 0) {
        chk.submissions.forEach(sub => {
          const title = `"${chk.title.replace(/"/g, '""')}"`;
          const outlet = `"${tenants.find(t => t.id === chk.tenantId)?.name || chk.tenantId}"`;
          const dept = `"${chk.department}"`;
          const role = `"${chk.role}"`;
          const submittedBy = `"${sub.submittedBy?.name || 'N/A'}"`;
          const submittedByRole = `"${sub.submittedBy?.role || 'N/A'}"`;
          const submittedAt = `"${new Date(sub.submittedAt).toLocaleString()}"`;
          
          // Format custom inputs
          const customFieldsText = Object.entries(sub.customInputs || {})
            .filter(([key]) => key !== "User Notes / Remarks" && !key.startsWith("choice_"))
            .map(([key, val]) => `${key}: ${val}`)
            .join(" | ");
          const customInputs = `"${customFieldsText.replace(/"/g, '""')}"`;
          
          const userNotesText = sub.customInputs?.["User Notes / Remarks"] || "";
          const userNotes = `"${userNotesText.replace(/"/g, '""')}"`;
          
          csvContent += `${title},${outlet},${dept},${role},${submittedBy},${submittedByRole},${submittedAt},${customInputs},${userNotes}\n`;
        });
      } else {
        const title = `"${chk.title.replace(/"/g, '""')}"`;
        const outlet = `"${tenants.find(t => t.id === chk.tenantId)?.name || chk.tenantId}"`;
        const dept = `"${chk.department}"`;
        const role = `"${chk.role}"`;
        csvContent += `${title},${outlet},${dept},${role},"No Submissions","N/A","Pending","N/A","N/A"\n`;
      }
    });
    
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Checklist_Submission_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ----------------------------------------------------
  // SUB-TAB 3: Tasks State & Logic
  // ----------------------------------------------------
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskPriority, setTaskPriority] = useState<string>("High");
  const [taskDueDate, setTaskDueDate] = useState(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0]);
  const [taskAssignees, setTaskAssignees] = useState<string[]>([]);
  const [taskTenant, setTaskTenant] = useState("ALL");
  const [taskError, setTaskError] = useState("");

  // Task Chat popup
  const [chatTaskId, setChatTaskId] = useState<string | null>(null);
  const [chatInputText, setChatInputText] = useState("");

  const activeChatTask = tasks.find(t => t.id === chatTaskId);
  
  // Filter staff by selected creation outlet
  const assignableStaff = taskTenant === "ALL" 
    ? tenantUsers 
    : tenantUsers.filter(u => u.tenantId === taskTenant);

  // Auto-clear checkboxes when tenant filters change
  useEffect(() => {
    setTaskAssignees([]);
  }, [taskTenant, tenantUsers]);

  const handleCreateTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskDesc.trim()) {
      setTaskError("Please provide both a task title and details.");
      return;
    }
    if (taskAssignees.length === 0) {
      setTaskError("Please select at least one staff member to assign the task.");
      return;
    }
    
    // Sync tenantId
    const primaryAssigneeId = taskAssignees[0];
    const assigneeUser = tenantUsers.find(u => u.id === primaryAssigneeId);
    const targetTenantId = assigneeUser ? assigneeUser.tenantId : activeUser.tenantId;

    onAddTask(taskTitle, taskDesc, taskPriority, taskDueDate, taskAssignees, targetTenantId);
    setTaskTitle("");
    setTaskDesc("");
    setTaskPriority("High");
    setTaskDueDate(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0]);
    setTaskTenant("ALL");
    setTaskAssignees([]);
    setTaskError("");
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputText.trim() || !chatTaskId) return;
    onAddMessage(chatTaskId, chatInputText.trim());
    setChatInputText("");
  };

  const downloadTaskCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Task,Description,Outlet,Priority,Status,Due Date,Assignee,Days Pending\n";
    filteredTasks.forEach(t => {
      const title = `"${t.title.replace(/"/g, '""')}"`;
      const desc = `"${t.description.replace(/"/g, '""')}"`;
      const outlet = `"${tenants.find(ten => ten.id === t.tenantId)?.name || t.tenantId}"`;
      const priority = `"${t.priority}"`;
      const status = `"${t.status}"`;
      const dueDate = `"${t.dueDate}"`;
      const assignee = `"${tenantUsers.find(u => u.id === t.assignedUserId)?.name || "Unassigned"}"`;
      const daysPending = Math.floor(Math.abs(new Date().getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      csvContent += `${title},${desc},${outlet},${priority},${status},${dueDate},${assignee},${daysPending}\n`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Task_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadDetailedTasksCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Task ID,Title,Description,Outlet/Tenant,Priority,Status,Due Date,Creation Date,Assignees,Created By,Days Pending,Chat Transcript\n";
    
    filteredTasks.forEach(t => {
      const getTaskNumberStr = (task: Task) => {
        const parts = task.id.split("-");
        return parts[parts.length - 1];
      };
      const getAssigneeNameStr = (userId: string) => {
        const u = tenantUsers.find(tu => tu.id === userId);
        return u ? u.name : userId;
      };

      const taskId = `"${getTaskNumberStr(t)}"`;
      const title = `"${t.title.replace(/"/g, '""')}"`;
      const desc = `"${t.description.replace(/"/g, '""')}"`;
      const outlet = `"${(tenants.find(ten => ten.id === t.tenantId)?.name || t.tenantId).replace(/"/g, '""')}"`;
      const priority = `"${t.priority}"`;
      const status = `"${t.status}"`;
      const dueDate = `"${t.dueDate}"`;
      const creationDate = `"${t.createdAt ? new Date(t.createdAt).toLocaleString() : ''}"`;
      
      const assigneesList = t.assignedUserIds && t.assignedUserIds.length > 0 ? t.assignedUserIds : [t.assignedUserId];
      const assignees = `"${assigneesList.map(uid => getAssigneeNameStr(uid)).join("; ").replace(/"/g, '""')}"`;
      const creator = `"${getAssigneeNameStr(t.createdByUserId).replace(/"/g, '""')}"`;
      
      const createdDate = new Date(t.createdAt || Date.now());
      const today = new Date();
      const diffTime = Math.max(0, today.getTime() - createdDate.getTime());
      const daysPending = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      const transcript = `"${t.chat.map(msg => {
        const timeStr = new Date(msg.timestamp).toLocaleString();
        return `[${msg.senderName} (${msg.senderRole}) @ ${timeStr}]: ${msg.message}`;
      }).join("\n").replace(/"/g, '""')}"`;
      
      csvContent += `${taskId},${title},${desc},${outlet},${priority},${status},${dueDate},${creationDate},${assignees},${creator},${daysPending},${transcript}\n`;
    });
    
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Tasks_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ----------------------------------------------------
  // SUB-TAB 4: Quizzes State & Logic
  // ----------------------------------------------------
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDesc, setQuizDesc] = useState("");
  const [quizDepts, setQuizDepts] = useState<string[]>([Department.ALL]);
  const [quizRoles, setQuizRoles] = useState<string[]>([Role.ALL]);
  const [quizTenant, setQuizTenant] = useState("ALL");
  const [quizPreviewText, setQuizPreviewText] = useState("");
  const [quizError, setQuizError] = useState("");

  // Quiz Questions builder state
  const [quizQuestions, setQuizQuestions] = useState<any[]>([
    { questionText: "", options: ["", "", "", ""], correctOptionIndex: 0 }
  ]);

  const handleAddQuestionField = () => {
    setQuizQuestions([
      ...quizQuestions,
      { questionText: "", options: ["", "", "", ""], correctOptionIndex: 0 }
    ]);
  };

  const handleRemoveQuestionField = (idx: number) => {
    setQuizQuestions(quizQuestions.filter((_, i) => i !== idx));
  };

  const handleQuestionTextChange = (qIdx: number, text: string) => {
    const updated = [...quizQuestions];
    updated[qIdx].questionText = text;
    setQuizQuestions(updated);
  };

  const handleOptionTextChange = (qIdx: number, optIdx: number, text: string) => {
    const updated = [...quizQuestions];
    updated[qIdx].options[optIdx] = text;
    setQuizQuestions(updated);
  };

  const handleCorrectOptionChange = (qIdx: number, optIdx: number) => {
    const updated = [...quizQuestions];
    updated[qIdx].correctOptionIndex = optIdx;
    setQuizQuestions(updated);
  };



  const parseQuizFromText = (text: string): any[] => {
    const blocks = text.split(/(?:---\r?\n?|\r?\n\r?\n)/).map(b => b.trim()).filter(b => b.length > 0);
    const questions: any[] = [];
    for (const block of blocks) {
      const lines = block.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) continue;
      const questionText = lines[0];
      const optionLines = lines.slice(1);
      let correctOptionIndex = 0;
      const options: string[] = [];
      optionLines.forEach((optLine, index) => {
        let textVal = optLine;
        let isCorrect = false;
        if (textVal.startsWith("*")) {
          isCorrect = true;
          textVal = textVal.substring(1).trim();
        }
        if (textVal.toLowerCase().endsWith("(correct)")) {
          isCorrect = true;
          textVal = textVal.substring(0, textVal.length - 9).trim();
        }
        textVal = textVal.replace(/^[a-zA-Z][\)\.]\s*/, "");
        options.push(textVal);
        if (isCorrect) {
          correctOptionIndex = index;
        }
      });
      while (options.length < 2) {
        options.push(`Option ${options.length + 1}`);
      }
      questions.push({
        questionText,
        options,
        correctOptionIndex
      });
    }
    return questions;
  };

  const handleCreateQuizSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizTitle.trim()) {
      setQuizError("Quiz title is required.");
      return;
    }
    let finalQuestions: any[] = [];
    if (quizPreviewText.trim()) {
      finalQuestions = parseQuizFromText(quizPreviewText);
      if (finalQuestions.length === 0) {
        setQuizError("Could not parse any valid questions from the import text. Check formatting.");
        return;
      }
    } else {
      const invalidQ = quizQuestions.find(q => !q.questionText.trim() || q.options.some((o: string) => !o.trim()));
      if (invalidQ) {
        setQuizError("Please fill out all question texts and options.");
        return;
      }
      finalQuestions = quizQuestions;
    }

    onCreateQuiz(quizTitle, quizDesc, JSON.stringify(quizDepts), JSON.stringify(quizRoles), finalQuestions, quizTenant);
    setQuizTitle("");
    setQuizDesc("");
    setQuizDepts([Department.ALL]);
    setQuizRoles([Role.ALL]);
    setQuizTenant("ALL");
    setQuizQuestions([{ questionText: "", options: ["", "", "", ""], correctOptionIndex: 0 }]);
    setQuizPreviewText("");
    setQuizError("");
  };

  // ----------------------------------------------------
  // SUB-TAB 5: SOPs State & Logic
  // ----------------------------------------------------
  const [sopTitle, setSopTitle] = useState("");
  const [sopDesc, setSopDesc] = useState("");
  const [sopCategory, setSopCategory] = useState("Operations");
  const [sopDepts, setSopDepts] = useState<string[]>([Department.ALL]);
  const [sopRoles, setSopRoles] = useState<string[]>([Role.ALL]);
  const [sopContent, setSopContent] = useState("");
  const [sopAttachment, setSopAttachment] = useState("");
  const [sopTenant, setSopTenant] = useState("ALL");
  const [sopError, setSopError] = useState("");

  const handleCreateSOPSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sopTitle.trim() || !sopContent.trim()) {
      setSopError("SOP title and content details are required.");
      return;
    }
    onCreateSOP(sopTitle, sopDesc, sopCategory, JSON.stringify(sopDepts), JSON.stringify(sopRoles), sopContent, sopAttachment, sopTenant);
    setSopTitle("");
    setSopDesc("");
    setSopCategory("Operations");
    setSopDepts([Department.ALL]);
    setSopRoles([Role.ALL]);
    setSopContent("");
    setSopAttachment("");
    setSopTenant("ALL");
    setSopError("");
  };

  return (
    <div className="space-y-4" id="client-admin-panel">
      {onBack && (
        <button 
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-555 hover:text-slate-800 transition-colors cursor-pointer select-none border border-slate-200 hover:border-slate-300 bg-white px-3 py-1.5 rounded-xl shadow-xs self-start"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
      )}
      {/* Top Controls Bar */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-left">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
            <ShieldCheck className="w-5 h-5 text-indigo-600 animate-pulse" />
            Client Admin Panel
          </h2>
          <p className="text-[10px] text-slate-400 font-medium">Manage and audit notices, checklists, tasks, training quizzes, and SOP manuals.</p>
        </div>

        {/* Global Outlet Filter Dropdown */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-indigo-600" />
          <span>Scope:</span>
          <select
            value={selectedOutletFilter}
            onChange={(e) => setSelectedOutletFilter(e.target.value)}
            className="bg-transparent font-bold focus:outline-none cursor-pointer text-slate-850"
          >
            <option value="ALL">All Outlets</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Internal Navigation Sub-tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-1">
        {[
          { id: "notices", label: "Notices Board", icon: Megaphone },
          { id: "checklists", label: "Checklists & Reports", icon: ClipboardCheck },
          { id: "quizzes", label: "Quizzes & Scores", icon: BookOpen },
          { id: "sops", label: "SOP Document Logs", icon: FileText },
          { id: "outlets", label: "Outlets & Facilities", icon: Building2 },
          { id: "staff", label: "Staff Directory", icon: Users },

          { id: "reports", label: "Data Reports", icon: Download }
        ].map(subTab => {
          const Icon = subTab.icon;
          const isActive = activeSubTab === subTab.id;
          return (
            <button
              key={subTab.id}
              onClick={() => setActiveSubTab(subTab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 border-b-2 font-bold text-xs shrink-0 transition-all cursor-pointer ${
                isActive 
                  ? "border-indigo-600 text-indigo-700 bg-white" 
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {subTab.label}
            </button>
          );
        })}
      </div>

      {/* RENDER ACTIVE SUB-TAB VIEW */}
      <div className="space-y-6">
        
        {/* ========================================================
            TAB 1: MANAGING NOTICES
            ======================================================== */}
        {activeSubTab === "notices" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* NOTICE CREATOR FORM */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4 h-fit">
              <div className="border-b border-slate-50 pb-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Publish New Notice</h3>
              </div>

              {noticeError && (
                <div className="p-3 bg-red-50 text-red-800 rounded-xl text-xs font-semibold">{noticeError}</div>
              )}

              <form onSubmit={handlePostNoticeSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Title Heading</label>
                  <input
                    type="text"
                    value={noticeTitle}
                    onChange={(e) => setNoticeTitle(e.target.value)}
                    placeholder="e.g. End of Day Gas Shutoff"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-750 font-semibold focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Subject Heading (Optional)</label>
                  <input
                    type="text"
                    value={noticeSubject}
                    onChange={(e) => setNoticeSubject(e.target.value)}
                    placeholder="e.g. Kitchen Safety / Maintenance"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-750 font-semibold focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Target Outlet</label>
                  <select
                    value={noticeTenant}
                    onChange={(e) => setNoticeTenant(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-750 font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Outlets</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <MultiSelectChecklist
                    label="Department"
                    options={multiSelectDepts}
                    selectedValues={noticeDepts}
                    onChange={setNoticeDepts}
                    allValue={Department.ALL}
                  />
                  <MultiSelectChecklist
                    label="Role Grade"
                    options={multiSelectRoles}
                    selectedValues={noticeRoles}
                    onChange={setNoticeRoles}
                    allValue={Role.ALL}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Details</label>
                  <textarea
                    rows={4}
                    value={noticeContent}
                    onChange={(e) => setNoticeContent(e.target.value)}
                    placeholder="Provide details about standard sequences..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-755 focus:outline-none font-normal"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Video Message (Optional)</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleNoticeVideoFileChange}
                      className="text-xs font-semibold text-slate-750 border border-slate-200 rounded-xl px-2 py-1 bg-slate-500/10 w-full"
                    />
                    <button
                      type="button"
                      onClick={() => setNoticeVideoUrl("https://assets.mixkit.co/videos/preview/mixkit-baking-bread-in-a-bakery-44280-large.mp4")}
                      className="px-2 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-800 text-[9px] font-bold rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap cursor-pointer animate-pulse"
                    >
                      Use Stock Bakery Video
                    </button>
                  </div>
                  {videoUploading && <span className="text-[9px] text-slate-400 block animate-pulse">Reading video file...</span>}
                  {noticeVideoUrl && (
                    <div className="mt-2 p-1.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                      <span className="text-[9px] text-slate-500 truncate max-w-[80%] font-semibold">Video Selected: {noticeVideoUrl.substring(0, 30)}...</span>
                      <button
                        type="button"
                        onClick={() => setNoticeVideoUrl("")}
                        className="text-red-500 hover:text-red-750 text-[9px] font-bold cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="chk-notice-urgent"
                    type="checkbox"
                    checked={noticeIsUrgent}
                    onChange={(e) => setNoticeIsUrgent(e.target.checked)}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="chk-notice-urgent" className="text-xs font-bold text-red-750 cursor-pointer">
                    Flag as Urgent Shift Warning
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs rounded-xl shadow cursor-pointer"
                >
                  Publish Announcement
                </button>
              </form>
            </div>

            {/* NOTICES LIST WITH DELETE */}
            <div className="lg:col-span-2 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1">Active Notices Board ({filteredNotices.length})</h3>

              {filteredNotices.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-12 text-center text-slate-400 text-xs font-medium">
                  No notices posted. Use the form to publish announcements.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredNotices.map(notice => {
                    const isUnread = !readNoticeIds.includes(notice.id);
                    return (
                      <div 
                        key={notice.id} 
                        className={`bg-white rounded-2xl border p-4 shadow-sm relative flex flex-col justify-between space-y-3 ${
                          isUnread
                            ? "border-emerald-300 bg-emerald-50/5 shadow-xs shadow-emerald-50/20"
                            : notice.isUrgent 
                            ? "border-red-200 bg-red-50/10" 
                            : "border-slate-100"
                        }`}
                      >
                        {notice.isUrgent && <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />}
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <div className="flex flex-wrap gap-1 items-center">
                                {isUnread && (
                                  <span className="text-[7px] font-bold bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded uppercase animate-pulse">New</span>
                                )}
                                {notice.isUrgent && (
                                  <span className="text-[7px] font-bold bg-red-100 text-red-800 px-1 py-0.2 rounded uppercase animate-pulse">Urgent</span>
                                )}
                                <span className="text-[7px] font-bold bg-indigo-50 text-indigo-750 px-1 py-0.2 rounded uppercase">
                                  {tenants.find(t => t.id === notice.tenantId)?.name || notice.tenantId}
                                </span>
                              </div>
                              <h4 className="text-xs font-bold text-slate-850 mt-1 leading-tight">{notice.title}</h4>
                            </div>
                            <button
                              onClick={() => onDeleteNotice(notice.id)}
                              className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-600 line-clamp-3 font-normal leading-relaxed mt-2">{notice.content}</p>
                          {notice.videoUrl && (
                            <div className="mt-2.5 rounded-xl overflow-hidden border border-slate-200 bg-slate-950">
                              <video src={notice.videoUrl} controls className="w-full max-h-40 object-cover" />
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-2 pt-2 border-t border-slate-50">
                          {isUnread && (
                            <button
                              onClick={() => handleMarkNoticeRead(notice.id)}
                              className="w-full py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-855 text-[10px] font-bold rounded-lg border border-emerald-250 transition-colors cursor-pointer"
                            >
                              Got it, Mark as Read
                            </button>
                          )}
                          <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
                            <span>By: {notice.createdBy.name}</span>
                            <span>{new Date(notice.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2: MANAGING CHECKLISTS & REPORTS
            ======================================================== */}
        {activeSubTab === "checklists" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CHECKLIST CREATOR */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4 h-fit" id="checklist-creator-form-panel">
              <div className="border-b border-slate-50 pb-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {editingChecklistId ? "Edit Compliance Checklist" : "Create Compliance Checklist"}
                </h3>
              </div>



              {checklistError && (
                <div className="p-3 bg-red-50 text-red-800 rounded-xl text-xs font-semibold">{checklistError}</div>
              )}

              <form onSubmit={handleCreateChecklistSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Checklist Title</label>
                  <input
                    type="text"
                    value={checklistTitle}
                    onChange={(e) => setChecklistTitle(e.target.value)}
                    placeholder="e.g. Morning Deck Oven Preheating"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-750 font-semibold focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Description</label>
                  <input
                    type="text"
                    value={checklistDesc}
                    onChange={(e) => setChecklistDesc(e.target.value)}
                    placeholder="e.g. Required routines before kitchen opening..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-750 focus:outline-none font-normal"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Checklist Type</label>
                  <select
                    value={checklistType}
                    onChange={(e) => setChecklistType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-755 font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="single">Single Checkbox Marking</option>
                    <option value="yes_no">Yes / No / NA Options</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Instructions / Admin Notes (Optional)</label>
                  <textarea
                    rows={2}
                    value={checklistAdminNotes}
                    onChange={(e) => setChecklistAdminNotes(e.target.value)}
                    placeholder="Instructions or reference details for staff to see..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-755 focus:outline-none font-sans font-normal"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Target Outlet</label>
                  <select
                    value={checklistTenant}
                    onChange={(e) => setChecklistTenant(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-750 font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Outlets</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <MultiSelectChecklist
                    label="Department"
                    options={multiSelectDepts}
                    selectedValues={checklistDepts}
                    onChange={setChecklistDepts}
                    allValue={Department.ALL}
                  />
                  <MultiSelectChecklist
                    label="Role Grade"
                    options={multiSelectRoles}
                    selectedValues={checklistRoles}
                    onChange={setChecklistRoles}
                    allValue={Role.ALL}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Recurrence Schedule</label>
                  <select
                    value={checklistRecurrence}
                    onChange={(e) => setChecklistRecurrence(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-750 font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="One-time">One-time / Manual Reset</option>
                    <option value="Daily">Daily Reset</option>
                    <option value="Weekly">Weekly Reset</option>
                    <option value="Custom">Custom (Every 3 Days)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                    Attach Original Document Template (Optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*,application/pdf,.doc,.docx"
                    onChange={handleChecklistFileChange}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-700"
                  />
                  {checklistAttachment && (
                    <span className="text-[10px] text-emerald-600 font-bold block mt-1">
                      ✓ Attached: {JSON.parse(checklistAttachment).name}
                    </span>
                  )}
                </div>

                {/* 3-Part Checklist Builder */}
                {/* PART 1: User Input Fields (e.g. Unit, Date, Checked by) */}
                <div className="space-y-2.5 border-t border-slate-100 pt-4 text-left">
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                      Part 1: Custom User Inputs (Required during submission)
                    </label>
                    <p className="text-[9px] text-slate-400 mt-0.5 leading-relaxed">
                      Define fields that users must fill out when completing this checklist (e.g. Unit No, Shift, Checked By).
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Shift Type"
                      value={newCustomFieldName}
                      onChange={(e) => setNewCustomFieldName(e.target.value)}
                      className="flex-1 px-3 py-1.8 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomField}
                      className="px-3 py-1.8 bg-[#162D4E] text-[#C5A880] rounded-xl text-xs font-bold hover:bg-[#162D4E]/90 cursor-pointer shadow-xs"
                    >
                      + Add Field
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {checklistCustomFields.map((field, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 bg-slate-55 border border-slate-200 px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-650 shadow-2xs">
                        {field}
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomField(idx)}
                          className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {checklistCustomFields.length === 0 && (
                      <p className="text-[10px] text-slate-400 font-medium italic">No custom inputs configured.</p>
                    )}
                  </div>
                </div>

                {/* PART 2 & 3: Subsections and Checkpoints */}
                <div className="space-y-4 border-t border-slate-100 pt-4 text-left">
                  <div className="flex justify-between items-center">
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                        Parts 2 & 3: Subsections & Checkpoints
                      </label>
                      <p className="text-[9px] text-slate-400 mt-0.5 leading-relaxed">
                        Group compliance steps into distinct subsections.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddChecklistSection}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded-xl text-[10px] cursor-pointer shadow-xs transition-all active:scale-95"
                    >
                      + Add Subsection
                    </button>
                  </div>

                  <div className="space-y-4">
                    {checklistSections.map((sec, idx) => (
                      <div key={sec.id} className="p-4 bg-slate-50/50 border border-slate-200/80 rounded-2xl space-y-3 relative">
                        {checklistSections.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveChecklistSection(sec.id)}
                            className="absolute top-3 right-3 text-slate-355 hover:text-red-500 transition-colors cursor-pointer"
                            title="Remove Subsection"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}

                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-1 space-y-1">
                            <label className="text-[9px] text-slate-450 font-bold uppercase block">No.</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. 1.0"
                              value={sec.number}
                              onChange={(e) => handleUpdateChecklistSection(sec.id, "number", e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-750 focus:outline-none"
                            />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <label className="text-[9px] text-slate-455 font-bold uppercase block">Subsection Title</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Mixing Procedures"
                              value={sec.name}
                              onChange={(e) => handleUpdateChecklistSection(sec.id, "name", e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-750 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-450 font-bold uppercase block">Checkpoints (One step per line)</label>
                          <textarea
                            rows={4}
                            required
                            value={sec.itemsText}
                            onChange={(e) => handleUpdateChecklistSection(sec.id, "itemsText", e.target.value)}
                            placeholder="e.g. Preheat mixers&#10;Sanitize steel bowl&#10;Weigh flour ingredients"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none font-normal"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2.5">
                  {editingChecklistId && (
                    <button
                      type="button"
                      onClick={handleResetChecklistForm}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-800 font-bold text-xs rounded-xl shadow cursor-pointer transition-all border border-slate-200"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs rounded-xl shadow cursor-pointer transition-all"
                  >
                    {editingChecklistId ? "Update Checklist" : "Deploy Checklist"}
                  </button>
                </div>
              </form>
            </div>

            {/* CHECKLIST LISTS & COMPLIANCE REPORT */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Checklists List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1">Deployed Checklists ({filteredChecklists.length})</h3>
                {filteredChecklists.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-8 text-center text-slate-400 text-xs">
                    No checklists currently active.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredChecklists.map(chk => {
                      const completedCount = chk.items.filter(i => i.completed).length;
                      const pct = chk.items.length > 0 ? Math.round((completedCount / chk.items.length) * 100) : 100;
                      const isUnsubmitted = pct < 100;

                      return (
                        <div 
                          key={chk.id} 
                          className={`bg-white border rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-3 text-left transition-all ${
                            isUnsubmitted ? "border-amber-300 bg-amber-50/5 ring-1 ring-amber-250/20" : "border-slate-100"
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[7px] font-bold bg-indigo-50 text-indigo-750 px-1 py-0.2 rounded uppercase">
                                  {tenants.find(t => t.id === chk.tenantId)?.name || chk.tenantId}
                                </span>
                                {isUnsubmitted && (
                                  <span className="text-[7px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded uppercase animate-pulse">
                                    Incomplete ⚠️
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleStartEditChecklist(chk)}
                                  className="p-1 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer transition-colors"
                                  title="Edit Checklist"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => onDeleteChecklist(chk.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer transition-colors"
                                  title="Delete Checklist"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <h4 className="text-xs font-bold text-slate-850 mt-1">{chk.title}</h4>
                            <p className="text-[10px] text-slate-500 leading-snug">{chk.description}</p>
                          </div>

                          <div className="pt-2 border-t border-slate-50 space-y-1 mt-2">
                            <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                              <span>Completed: {completedCount}/{chk.items.length} items</span>
                              <span>{pct}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Compliance Report */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-50 pb-3">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Compliance Report Feed</h3>
                  <button 
                    onClick={downloadChecklistCSV}
                    disabled={filteredChecklists.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-bold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download CSV Report
                  </button>
                </div>

                <div className="overflow-x-auto max-h-[300px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] uppercase font-bold text-slate-450 tracking-wider">
                        <th className="py-2.5 px-2">Checklist</th>
                        <th className="py-2.5 px-2">Item Action</th>
                        <th className="py-2.5 px-2">Status</th>
                        <th className="py-2.5 px-2">Completed By</th>
                        <th className="py-2.5 px-2">Completed At</th>
                      </tr>
                    </thead>
                    <tbody className="text-[11px] font-medium text-slate-600">
                      {filteredChecklists.flatMap(chk => 
                        chk.items.map(item => (
                          <tr key={item.id} className="border-b border-slate-50/50 hover:bg-slate-50/50">
                            <td className="py-2 px-2 font-semibold text-slate-800 max-w-[120px] truncate">{chk.title}</td>
                            <td className="py-2 px-2 font-normal text-slate-600">{item.text}</td>
                            <td className="py-2 px-2">
                              <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold font-mono ${
                                item.completed ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : "bg-amber-50 text-amber-800 border border-amber-100"
                              }`}>
                                {item.completed ? "Done" : "Pending"}
                              </span>
                            </td>
                            <td className="py-2 px-2 font-mono text-[10px]">{item.completedBy ? item.completedBy.name : "-"}</td>
                            <td className="py-2 px-2 font-mono text-[9px] text-slate-400">
                              {item.completedAt ? new Date(item.completedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                            </td>
                          </tr>
                        ))
                      )}
                      {filteredChecklists.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">No checklists deployed.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================
            TAB 4: MANAGING QUIZZES
            ======================================================== */}
        {activeSubTab === "quizzes" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CREATE QUIZ FORM */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4 h-fit max-h-[700px] overflow-y-auto">
              <div className="border-b border-slate-50 pb-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Create Knowledge Assessment</h3>
              </div>

              {quizError && (
                <div className="p-3 bg-red-50 text-red-800 rounded-xl text-xs font-semibold">{quizError}</div>
              )}

              <form onSubmit={handleCreateQuizSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Quiz Title</label>
                  <input
                    type="text"
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                    placeholder="e.g. Sourdough Hydration Standards"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-750 font-semibold focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Description</label>
                  <input
                    type="text"
                    value={quizDesc}
                    onChange={(e) => setQuizDesc(e.target.value)}
                    placeholder="Brief description of training goals..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-750 focus:outline-none font-normal"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <MultiSelectChecklist
                    label="Target Department"
                    options={multiSelectDepts}
                    selectedValues={quizDepts}
                    onChange={setQuizDepts}
                    allValue={Department.ALL}
                  />
                  <MultiSelectChecklist
                    label="Target Role"
                    options={multiSelectRoles}
                    selectedValues={quizRoles}
                    onChange={setQuizRoles}
                    allValue={Role.ALL}
                  />
                </div>

                {/* Quiz Bulk Input Editor */}
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="space-y-1 text-left">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Questions Bulk Input Editor</label>
                    </div>
                    <textarea
                      rows={10}
                      value={quizPreviewText}
                      onChange={(e) => setQuizPreviewText(e.target.value)}
                      placeholder="Enter quiz questions and choices here. This helper text will disappear when you start typing.&#10;&#10;Format Example:&#10;What temperature should deck ovens be?&#10;A) 100°C&#10;B) 220°C (correct)&#10;C) 300°C&#10;---&#10;Which yeast type requires proofing in warm water before mixing?&#10;*A) Active Dry Yeast&#10;B) Instant Yeast&#10;C) Fresh Yeast"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-750 focus:outline-none font-normal"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Target Outlet Scope</label>
                  <select
                    value={quizTenant}
                    onChange={(e) => setQuizTenant(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-750 font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Outlets</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {/* Questions Fields Builder */}
                <div className="space-y-4 border-t border-slate-100 pt-3 text-left">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Questions ({quizQuestions.length})</label>
                    <button
                      type="button"
                      onClick={handleAddQuestionField}
                      className="flex items-center gap-0.5 text-indigo-600 hover:text-indigo-800 text-[10px] font-bold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Question
                    </button>
                  </div>

                  {quizQuestions.map((q, qIdx) => (
                    <div key={qIdx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 relative">
                      {quizQuestions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestionField(qIdx)}
                          className="absolute top-2 right-2 text-slate-300 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      
                      <div className="space-y-1">
                        <label className="text-[8px] text-slate-400 font-bold block">Question {qIdx + 1}</label>
                        <input
                          type="text"
                          value={q.questionText}
                          onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                          placeholder="e.g. What is the oven temperature for Sourdough?"
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8px] text-slate-400 font-bold block">Options — click <span className="text-emerald-600">✓ Correct</span> to mark the right answer</label>
                        <div className="space-y-1.5">
                          {q.options.map((opt: string, optIdx: number) => {
                            const isCorrect = q.correctOptionIndex === optIdx;
                            const letter = String.fromCharCode(65 + optIdx); // A, B, C, D
                            return (
                              <div key={optIdx} className={`flex items-center gap-2 border rounded-lg px-2 py-1.5 transition-all ${
                                isCorrect
                                  ? 'bg-emerald-50 border-emerald-300'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}>
                                <span className={`text-[10px] font-extrabold w-4 shrink-0 ${
                                  isCorrect ? 'text-emerald-700' : 'text-slate-400'
                                }`}>{letter})</span>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => handleOptionTextChange(qIdx, optIdx, e.target.value)}
                                  placeholder={`Option ${letter}`}
                                  className="flex-1 text-[10px] focus:outline-none font-medium bg-transparent min-w-0"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleCorrectOptionChange(qIdx, optIdx)}
                                  title={isCorrect ? 'This is marked as correct' : 'Click to mark as correct answer'}
                                  className={`shrink-0 text-[9px] font-extrabold px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                                    isCorrect
                                      ? 'bg-emerald-500 text-white border-emerald-500'
                                      : 'bg-white text-slate-400 border-slate-200 hover:text-emerald-600 hover:border-emerald-300'
                                  }`}
                                >
                                  {isCorrect ? '✓ Correct' : 'Mark'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs rounded-xl shadow cursor-pointer"
                >
                  Publish Quiz
                </button>
              </form>
            </div>

            {/* QUIZZES LIST & ATTEMPTS SCORE REPORTS */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Quizzes List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1">Active Quizzes ({filteredQuizzes.length})</h3>
                {filteredQuizzes.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-8 text-center text-slate-400 text-xs">
                    No quizzes created.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredQuizzes.map(quiz => (
                      <div key={quiz.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-3 text-left">
                        <div className="space-y-1">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex gap-1 items-center flex-wrap">
                              <span className="text-[7px] font-bold bg-indigo-50 text-indigo-750 px-1 py-0.2 rounded uppercase">
                                {tenants.find(t => t.id === quiz.tenantId)?.name || "All Outlets"}
                              </span>
                              <span className="text-[7px] font-bold bg-slate-100 text-slate-750 px-1 py-0.2 rounded uppercase">
                                Dept: {quiz.department}
                              </span>
                            </div>
                            <button
                              onClick={() => onDeleteQuiz(quiz.id)}
                              className="p-1 text-slate-300 hover:text-red-500 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <h4 className="text-xs font-bold text-slate-850 mt-1">{quiz.title}</h4>
                          <p className="text-[10px] text-slate-500 leading-snug">{quiz.description}</p>
                        </div>
                        <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                          <span>{quiz.questions.length} questions</span>
                          <span>By: {quiz.createdBy.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quiz Results Report */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-50 pb-3">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Employee Quiz Performance Report</h3>
                  <button 
                    onClick={downloadQuizScoreboardCSV}
                    disabled={quizAttempts.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-bold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download CSV Report
                  </button>
                </div>

                <div className="overflow-x-auto max-h-[300px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] uppercase font-bold text-slate-450 tracking-wider">
                        <th className="py-2.5 px-2">Employee</th>
                        <th className="py-2.5 px-2">Role</th>
                        <th className="py-2.5 px-2">Quiz Assessment</th>
                        <th className="py-2.5 px-2 text-center">Score</th>
                        <th className="py-2.5 px-2 text-right">Completed Date</th>
                      </tr>
                    </thead>
                    <tbody className="text-[11px] font-medium text-slate-600">
                      {quizAttempts.map(att => (
                        <tr key={att.id} className="border-b border-slate-50/50 hover:bg-slate-50/50">
                          <td className="py-2 px-2 font-bold text-slate-800">{att.userName}</td>
                          <td className="py-2 px-2 text-slate-500">{att.userRole}</td>
                          <td className="py-2 px-2 font-semibold text-slate-600 truncate max-w-[150px]">{att.quizTitle}</td>
                          <td className="py-2 px-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold font-mono ${
                              (att.score / att.totalQuestions) >= 0.75 
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-100" 
                                : "bg-red-50 text-red-800 border border-red-100"
                            }`}>
                              {att.score} / {att.totalQuestions} ({Math.round((att.score / att.totalQuestions) * 100)}%)
                            </span>
                          </td>
                          <td className="py-2 px-2 font-mono text-[9px] text-slate-400 text-right">
                            {new Date(att.completedAt).toLocaleDateString()} at {new Date(att.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                      {quizAttempts.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">No quiz records submitted.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================
            TAB 5: MANAGING SOPs
            ======================================================== */}
        {activeSubTab === "sops" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CREATE SOP FORM */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4 h-fit max-h-[700px] overflow-y-auto">
              <div className="border-b border-slate-50 pb-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Publish SOP Document</h3>
              </div>

              {sopError && (
                <div className="p-3 bg-red-50 text-red-800 rounded-xl text-xs font-semibold">{sopError}</div>
              )}

              <form onSubmit={handleCreateSOPSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Document Title</label>
                  <input
                    type="text"
                    value={sopTitle}
                    onChange={(e) => setSopTitle(e.target.value)}
                    placeholder="e.g. Evening Bakery Closure Sequence"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-750 font-semibold focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Short Summary</label>
                  <input
                    type="text"
                    value={sopDesc}
                    onChange={(e) => setSopDesc(e.target.value)}
                    placeholder="e.g. Standard guidelines to lock oven vents, cooling..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-750 focus:outline-none font-normal"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Category</label>
                    <input
                      type="text"
                      value={sopCategory}
                      onChange={(e) => setSopCategory(e.target.value)}
                      placeholder="e.g. Operations"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-750 font-semibold focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Scope Target Outlet</label>
                    <select
                      value={sopTenant}
                      onChange={(e) => setSopTenant(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-750 font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">All Outlets</option>
                      {tenants.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <MultiSelectChecklist
                    label="Department"
                    options={multiSelectDepts}
                    selectedValues={sopDepts}
                    onChange={setSopDepts}
                    allValue={Department.ALL}
                  />
                  <MultiSelectChecklist
                    label="Role Grade"
                    options={multiSelectRoles}
                    selectedValues={sopRoles}
                    onChange={setSopRoles}
                    allValue={Role.ALL}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Upload Reference Document Attachment</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                    onChange={handleSOPFileChange}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-750 hover:file:bg-slate-200 cursor-pointer"
                  />
                  {sopAttachment && (
                    <p className="text-[9px] text-emerald-600 font-semibold mt-1">
                      File loaded: {JSON.parse(sopAttachment).name}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Manual Guidelines Content (Text/Markdown)</label>
                  <textarea
                    rows={8}
                    value={sopContent}
                    onChange={(e) => setSopContent(e.target.value)}
                    placeholder="Describe safety steps, checklists, proofing parameters..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-750 focus:outline-none font-normal font-mono"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs rounded-xl shadow cursor-pointer"
                >
                  Publish SOP
                </button>
              </form>
            </div>

            {/* SOP DIRECTORY & READ CONFIRMATION LOGS */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* SOP List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1">Active Standard Operating Procedures ({filteredSOPs.length})</h3>
                {filteredSOPs.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-8 text-center text-slate-400 text-xs">
                    No SOPs uploaded. Use the panel on the left to write SOPs.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredSOPs.map(sop => (
                      <div key={sop.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-3 text-left">
                        <div className="space-y-1">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex gap-1 items-center flex-wrap">
                              <span className="text-[7px] font-bold bg-indigo-50 text-indigo-750 px-1 py-0.2 rounded uppercase">
                                {sop.category}
                              </span>
                              <span className="text-[7px] font-bold bg-slate-100 text-slate-750 px-1 py-0.2 rounded uppercase">
                                Outlet: {tenants.find(t => t.id === sop.tenantId)?.name || "All"}
                              </span>
                            </div>
                            <button
                              onClick={() => onDeleteSOP(sop.id)}
                              className="p-1 text-slate-300 hover:text-red-500 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <h4 className="text-xs font-bold text-slate-850 mt-1">{sop.title}</h4>
                          <p className="text-[10px] text-slate-500 leading-snug">{sop.description}</p>
                        </div>
                        <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                          <span>By: {sop.createdBy.name}</span>
                          <span>{new Date(sop.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SOP Read Log Report */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                <div className="border-b border-slate-50 pb-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Employee SOP Comprehension Report</h3>
                </div>

                <div className="overflow-x-auto max-h-[300px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] uppercase font-bold text-slate-450 tracking-wider">
                        <th className="py-2.5 px-2">Employee</th>
                        <th className="py-2.5 px-2">Role</th>
                        <th className="py-2.5 px-2">SOP Reference Document</th>
                        <th className="py-2.5 px-2 text-right">Confirmed Date</th>
                      </tr>
                    </thead>
                    <tbody className="text-[11px] font-medium text-slate-600">
                      {sopReadStatuses.map(status => (
                        <tr key={status.id} className="border-b border-slate-50/50 hover:bg-slate-50/50">
                          <td className="py-2 px-2 font-bold text-slate-800">{status.userName}</td>
                          <td className="py-2 px-2 text-slate-500">{status.userRole}</td>
                          <td className="py-2 px-2 font-semibold text-slate-605 truncate max-w-[200px]">{status.sopTitle}</td>
                          <td className="py-2 px-2 font-mono text-[9px] text-slate-400 text-right">
                            {new Date(status.readAt).toLocaleDateString()} at {new Date(status.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                      {sopReadStatuses.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400 text-xs">No reading confirmations logged.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================
            TAB 6: MANAGING OUTLETS
            ======================================================== */}
        {activeSubTab === "outlets" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" id="client-admin-outlets-pane">
            {/* Form Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 h-fit text-left">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Building2 className="w-4.5 h-4.5 text-indigo-600" />
                Provision Outlet Workspace
              </h3>

              <form onSubmit={handleCreateOutlet} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Outlet Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cakewala Mall Road"
                    value={outletName}
                    onChange={(e) => setOutletName(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-500/10 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Subdomain Prefix
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. mallroad"
                      value={outletSubdomain}
                      onChange={(e) => setOutletSubdomain(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-slate-500/10 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Icon/Emoji
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={2}
                      value={outletLogo}
                      onChange={(e) => setOutletLogo(e.target.value)}
                      className="w-full text-center text-xs px-3 py-2 bg-slate-500/10 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    />
                  </div>
                </div>

                {outletSuccessMsg && (
                  <div className="p-2.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-[10px] font-semibold flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    {outletSuccessMsg}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-200 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Provision Workspace
                </button>
              </form>
            </div>

            {/* Table / List Card */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 text-left">
              <h3 className="font-bold text-sm text-slate-800">Outlets Provisioned</h3>
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                {tenants.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No outlets provisioned under this client organization yet.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-500/10 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="px-4 py-3">Outlet Workspace</th>
                        <th className="px-4 py-3">Tenant ID</th>
                        <th className="px-4 py-3">Subdomain Routing</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs">
                      {tenants.map(out => (
                        <tr key={out.id} className="hover:bg-slate-500/10">
                          <td className="px-4 py-3 flex items-center gap-2">
                            <span className="text-lg">{out.logo}</span>
                            <span className="font-semibold text-slate-800">{out.name}</span>
                          </td>
                          <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{out.id}</td>
                          <td className="px-4 py-3 font-mono text-indigo-600 text-[10px]">{out.subdomain}</td>
                          <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setEditingTenant(out);
                                setEditTenantName(out.name);
                                setEditTenantSubdomain(out.subdomain);
                                setEditTenantLogo(out.logo);
                                setEditTenantPlan(out.plan);
                              }}
                              className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors inline-flex items-center justify-center cursor-pointer"
                              title="Edit Outlet Workspace"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingTenantId(out.id)}
                              className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-rose-600 transition-colors inline-flex items-center justify-center cursor-pointer"
                              title="Delete Outlet Workspace"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 7: MANAGING STAFF
            ======================================================== */}
        {activeSubTab === "staff" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" id="client-admin-staff-pane">
            {/* Onboard Staff Form */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 h-fit text-left">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <UserPlus className="w-4.5 h-4.5 text-indigo-600" />
                Onboard Workspace User
              </h3>

              <form onSubmit={handleOnboardStaff} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Assign Outlet Workspace
                  </label>
                  <select
                    value={staffTenantId}
                    onChange={(e) => setStaffTenantId(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 bg-slate-500/10 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
                  >
                    {tenants.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.logo} {o.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vikram Seth"
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-500/10 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. vikram@cakewala.com"
                    value={staffEmail}
                    onChange={(e) => { setStaffEmail(e.target.value); setStaffErrorMsg(""); }}
                    className={`w-full text-xs px-3 py-2 border rounded-xl focus:outline-none focus:bg-white transition-colors ${staffErrorMsg ? 'border-rose-400 bg-rose-50 focus:border-rose-500' : 'bg-slate-500/10 border-slate-200 focus:border-indigo-500'}`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    WhatsApp Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g., +919876543210"
                    value={staffPhone}
                    onChange={(e) => setStaffPhone(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-500/10 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Assigned Role
                    </label>
                    <select
                      value={staffRole}
                      onChange={(e) => setStaffRole(e.target.value)}
                      className="w-full text-xs px-2 py-2 bg-slate-500/10 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer font-semibold"
                    >
                      {availableRoles.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                    {staffRole === "+ Create custom..." && (
                      <input
                        type="text"
                        required
                        placeholder="Type custom role..."
                        value={customRole}
                        onChange={(e) => setCustomRole(e.target.value)}
                        className="mt-1.5 w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white font-semibold"
                      />
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Department
                    </label>
                    <select
                      value={staffDept}
                      onChange={(e) => setStaffDept(e.target.value)}
                      className="w-full text-xs px-2 py-2 bg-slate-500/10 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer font-semibold"
                    >
                      {availableDepts.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                    {staffDept === "+ Create custom..." && (
                      <input
                        type="text"
                        required
                        placeholder="Type custom dept..."
                        value={customDept}
                        onChange={(e) => setCustomDept(e.target.value)}
                        className="mt-1.5 w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white font-semibold"
                      />
                    )}
                  </div>
                </div>

                {staffErrorMsg && (
                  <div className="p-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-[10px] font-semibold flex items-start gap-1.5">
                    <span className="shrink-0 mt-0.5">⚠️</span>
                    <span>{staffErrorMsg}</span>
                  </div>
                )}
                {staffSuccessMsg && (
                  <div className="p-2.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-[10px] font-semibold flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    {staffSuccessMsg}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-200 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Onboard Staff
                </button>
              </form>
            </div>

            {/* Directory Listing */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 text-left">
              <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                <h3 className="font-bold text-sm text-slate-800">Workspace User Directory</h3>
                <button
                  onClick={downloadStaffCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-bold hover:bg-slate-800 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download CSV
                </button>
              </div>
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                {clientUsers.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No staff onboarded under this brand organization yet.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-500/10 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="px-4 py-3">Staff Member</th>
                        <th className="px-4 py-3">Outlet/Workspace</th>
                        <th className="px-4 py-3">Role & Dept</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs">
                      {clientUsers.map(usr => {
                        const userTenant = tenants.find(t => t.id === usr.tenantId);
                        return (
                          <tr key={usr.id} className="hover:bg-slate-500/10">
                            <td className="px-4 py-3 flex items-center gap-3">
                              <img
                                src={usr.avatar}
                                alt={usr.name}
                                className="w-7 h-7 rounded-lg object-cover bg-slate-100 text-[8px] text-slate-400"
                              />
                              <div>
                                <span className="font-semibold block text-slate-800">{usr.name}</span>
                                <span className="text-[10px] text-slate-400 block font-mono">{usr.email}</span>
                                <span className="text-[9px] text-slate-500 font-mono font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded w-fit block mt-0.5" title="Login Password">
                                  🔑 {store.getPasswordForEmail(usr.email)}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600 font-semibold">
                              {userTenant ? `${userTenant.logo} ${userTenant.name}` : "Unknown Outlet"}
                            </td>
                            <td className="px-4 py-3 space-y-0.5">
                              <span className="inline-block text-[9px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100">
                                {usr.role}
                              </span>
                              <span className="block text-[9px] text-slate-400 font-medium">
                                {usr.department}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                              <button
                                onClick={() => {
                                  setEditingUser(usr);
                                  setEditUserName(usr.name);
                                  setEditUserEmail(usr.email);
                                  setEditUserRole(usr.role);
                                  setEditUserDepartment(usr.department);
                                }}
                                className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors inline-flex items-center justify-center cursor-pointer"
                                title="Edit User Role/Details"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleResetPassword(usr)}
                                className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-amber-600 transition-colors inline-flex items-center justify-center cursor-pointer"
                                title="Reset User Password"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingUserId(usr.id)}
                                className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-rose-600 transition-colors inline-flex items-center justify-center cursor-pointer"
                                title="Delete User"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {activeSubTab === "reports" && (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6 text-left">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Organizational Data Reports</h3>
              <p className="text-xs text-slate-500 mt-1">
                Download consolidated CSV reports for your workspace. Use the brand/outlet filters at the top of the panel to filter files.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Workspace User Directory */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-805 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-600" />
                    Workspace User Directory
                  </h4>
                  <p className="text-xs text-slate-500 leading-normal">
                    Download the complete staff directory, including full names, emails, assigned roles, departments, associated outlets, and login passwords.
                  </p>
                </div>
                <button
                  onClick={downloadStaffCSV}
                  className="w-full sm:w-fit py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-indigo-100"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download User Directory
                </button>
              </div>

              {/* Card 2: Tasks & Workflows */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-805 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-indigo-600" />
                    Tasks & Workflows
                  </h4>
                  <p className="text-xs text-slate-500 leading-normal">
                    Download task status reports, including priorities, creation/due dates, assignees list, creator names, days pending, and complete shift chat transcripts.
                  </p>
                </div>
                <button
                  onClick={downloadDetailedTasksCSV}
                  className="w-full sm:w-fit py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-indigo-100"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Tasks Report
                </button>
              </div>

              {/* Card 3: Checklists & Compliance */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-805 uppercase tracking-wider flex items-center gap-1.5">
                    <ClipboardCheck className="w-4 h-4 text-indigo-600" />
                    Checklists & Compliance
                  </h4>
                  <p className="text-xs text-slate-500 leading-normal">
                    Download checklist compliance reports, listing checklist items, status (pending/completed), completion metadata, and employee read confirmation stamps.
                  </p>
                </div>
                <button
                  onClick={downloadChecklistCSV}
                  className="w-full sm:w-fit py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-indigo-100"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Checklists Report
                </button>
              </div>

              {/* Card 4: Quiz Performance Scoreboard */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-805 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    Quiz Performance Scoreboard
                  </h4>
                  <p className="text-xs text-slate-500 leading-normal">
                    Download quiz scores and performance history, including employee names, assigned roles, quiz titles, question counts, scores, and completion dates.
                  </p>
                </div>
                <button
                  onClick={downloadQuizScoreboardCSV}
                  className="w-full sm:w-fit py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-indigo-100"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Scoreboard Report
                </button>
              </div>
            </div>
          </div>
        )}


      </div>

      {/* Edit & Delete Modals for Outlets & Staff */}
      <AnimatePresence>
        {editingTenant && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="client-edit-tenant-modal">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6 space-y-4 text-left relative"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-slate-800">Edit Outlet Workspace</h3>
                <button 
                  onClick={() => setEditingTenant(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onUpdateTenant(editingTenant.id, editTenantName, editTenantSubdomain, editTenantLogo, editTenantPlan);
                  setEditingTenant(null);
                }}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Outlet Tenant ID (Read-Only)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={editingTenant.id}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-450 font-mono select-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Outlet Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editTenantName}
                    onChange={(e) => setEditTenantName(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-500/10 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Subdomain routing
                  </label>
                  <input
                    type="text"
                    required
                    value={editTenantSubdomain}
                    onChange={(e) => setEditTenantSubdomain(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-500/10 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Logo Icon / Emoji
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={2}
                      value={editTenantLogo}
                      onChange={(e) => setEditTenantLogo(e.target.value)}
                      className="w-full text-center text-xs px-3 py-2 bg-slate-500/10 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Subscription Plan
                    </label>
                    <select
                      value={editTenantPlan}
                      onChange={(e) => setEditTenantPlan(e.target.value as any)}
                      className="w-full text-xs px-2 py-2 bg-slate-500/10 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
                    >
                      <option value="Free">Free</option>
                      <option value="Pro">Pro</option>
                      <option value="Enterprise">Enterprise</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingTenant(null)}
                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-500 font-semibold rounded-xl text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {deletingTenantId && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="client-delete-tenant-modal">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center relative"
            >
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-slate-800">Delete Outlet Workspace?</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Are you sure you want to delete this outlet workspace? This will cascade-delete all checklists, tasks, notices, and staff users associated with it. This action is irreversible.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingTenantId(null)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-500 font-semibold rounded-xl text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteTenant(deletingTenantId);
                    setDeletingTenantId(null);
                  }}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
                >
                  Delete Outlet
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {editingUser && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="client-edit-user-modal">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6 space-y-4 text-left relative"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-slate-800">Edit Staff Details & Roles</h3>
                <button 
                  onClick={() => setEditingUser(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-655 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onUpdateUser(editingUser.id, editUserName, editUserEmail, editUserRole, editUserDepartment);
                  setEditingUser(null);
                }}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Staff User ID (Read-Only)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={editingUser.id}
                    className="w-full text-xs px-3 py-2 bg-slate-500/10 border border-slate-200 rounded-xl text-slate-450 font-mono select-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editUserName}
                    onChange={(e) => setEditUserName(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-500/10 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={editUserEmail}
                    onChange={(e) => setEditUserEmail(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-500/10 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Assign Role
                    </label>
                    <select
                      value={editUserRole}
                      onChange={(e) => setEditUserRole(e.target.value)}
                      className="w-full text-xs px-2.5 py-2 bg-slate-500/10 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
                    >
                      {availableRoles.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Department
                    </label>
                    <select
                      value={editUserDepartment}
                      onChange={(e) => setEditUserDepartment(e.target.value)}
                      className="w-full text-xs px-2.5 py-2 bg-slate-500/10 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
                    >
                      {availableDepts.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-500 font-semibold rounded-xl text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {deletingUserId && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="client-delete-user-modal">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center relative"
            >
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-slate-800">Delete Staff Member?</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Are you sure you want to delete this staff member user? Their name will be disassociated from tasks they created or were assigned to. This action is irreversible.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingUserId(null)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-500 font-semibold rounded-xl text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteUser(deletingUserId);
                    setDeletingUserId(null);
                  }}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
                >
                  Delete User
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {resetPwdUser && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in" id="client-reset-password-modal">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 relative text-left"
            >
              <button
                type="button"
                onClick={() => setResetPwdUser(null)}
                className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-slate-650 hover:bg-slate-50 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="text-center space-y-2 mb-4">
                <KeyRound className="w-10 h-10 text-amber-550 mx-auto" />
                <h3 className="text-lg font-bold text-slate-805">Reset User Password</h3>
                <p className="text-xs text-slate-500">
                  Set a new password for <span className="font-bold text-slate-800">{resetPwdUser.name}</span> ({resetPwdUser.email})
                </p>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                let targetPassword = resetPwdValue.trim();
                if (!targetPassword) {
                  targetPassword = store.generateRandomPassword();
                }
                try {
                  await store.updateUserPassword(resetPwdUser.email, targetPassword);
                  alert(`Password for ${resetPwdUser.name} has been reset to: ${targetPassword}`);
                  setResetPwdUser(null);
                } catch (err) {
                  console.error(err);
                  alert("Failed to reset password. Please try again.");
                }
              }} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showResetPwdToggle ? "text" : "password"}
                      placeholder="Enter new password (or leave blank to auto-generate)..."
                      value={resetPwdValue}
                      onChange={(e) => setResetPwdValue(e.target.value)}
                      className="w-full text-xs pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-850 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPwdToggle(!showResetPwdToggle)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-655 focus:outline-none cursor-pointer flex items-center h-5"
                    >
                      {showResetPwdToggle ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const rand = store.generateRandomPassword();
                      setResetPwdValue(rand);
                      setShowResetPwdToggle(true);
                    }}
                    className="py-2 px-3 border border-slate-200 text-slate-600 font-bold rounded-xl text-[10px] uppercase hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    🎲 Auto-Generate
                  </button>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetPwdUser(null)}
                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-500 font-semibold rounded-xl text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
                  >
                    Reset Password
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
