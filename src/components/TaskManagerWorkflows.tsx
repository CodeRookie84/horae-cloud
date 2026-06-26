/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { 
  CheckSquare, 
  Trash2, 
  Plus, 
  Send, 
  MessageSquare, 
  Calendar, 
  User, 
  Clock, 
  AlertCircle,
  Hash,
  ChevronRight,
  ChevronDown,
  Bell,
  ArrowLeft,
  AlertTriangle,
  Search,
  Filter,
  Users,
  Grid,
  Check,
  Percent,
  Activity,
  Layers,
  ChevronUp,
  Mic,
  MicOff,
  Languages,
  List,
  Maximize2,
  Minimize2,
  X,
  Download
} from "lucide-react";
import { Task, User as AppUser, Role, Department, Tenant } from "../types";
import { supabase } from '../services/supabaseClient';
import { store, translateText } from "../services/store";
import TeamTalkMemberPicker, { resolveMemberIds, EMPTY_SELECTION, type MemberPickerSelection } from "./TeamTalkMemberPicker";

interface TaskManagerWorkflowsProps {
  tasks: Task[];
  tenantUsers: AppUser[];
  activeUser: AppUser;
  tenants: Tenant[];
  onAddTask: (title: string, description: string, priority: string, dueDate: string, assignedUserIds: string[]) => void;
  onUpdateTaskStatus: (taskId: string, status: "Assigned" | "In Progress" | "Pending" | "On Hold" | "Completed" | "Closed") => void;
  onUpdateTaskPriority: (taskId: string, priority: string) => void;
  onAddMessage: (taskId: string, message: string) => void;
  onDeleteTask: (id: string) => void;
  onSendReminder: (id: string) => void;
  onUrgentNotify: (id: string) => void;
  onBack?: () => void;
}

export default function TaskManagerWorkflows({
  tasks,
  tenantUsers,
  activeUser,
  tenants,
  onAddTask,
  onUpdateTaskStatus,
  onUpdateTaskPriority,
  onAddMessage,
  onDeleteTask,
  onSendReminder,
  onUrgentNotify,
  onBack
}: TaskManagerWorkflowsProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [selectedTaskInitialReadCount, setSelectedTaskInitialReadCount] = useState<number>(0);
  const prevSelectedTaskIdRef = useRef<string>("");
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  
  // Creation form states
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [priority, setPriority] = useState<string>("High");
  const [dueDate, setDueDate] = useState<string>(new Date().toLocaleDateString('en-CA'));
  const [assigneePicked, setAssigneePicked] = useState<MemberPickerSelection>(EMPTY_SELECTION);
  const assignedUserIds = resolveMemberIds(assigneePicked, tenantUsers, tenants);
  const [taskPhotos, setTaskPhotos] = useState<string[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    if (taskPhotos.length + files.length > 3) {
      alert("You can upload a maximum of 3 photos.");
      return;
    }
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setTaskPhotos(prev => [...prev, reader.result as string].slice(0, 3));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setTaskPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // Layout switcher and voice translation states
  const [viewLayout, setViewLayout] = useState<"columns" | "table">("table");
  const [isTaskExpanded, setIsTaskExpanded] = useState<boolean>(false);
  const [speechLanguage, setSpeechLanguage] = useState<"en-US" | "hi-IN" | "kn-IN" | "ta-IN">("en-US");
  const [isListening, setIsListening] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [selectedDisplayLang, setSelectedDisplayLang] = useState<"en" | "hi" | "kn" | "ta">("en");
  const [translationsCache, setTranslationsCache] = useState<Record<string, Record<string, string>>>({});
  const recognitionRef = useRef<any>(null);

  const handleLanguageToggle = async (lang: "en" | "hi" | "kn" | "ta") => {
    setSelectedDisplayLang(lang);
    if (activeTask && !activeTask.translations?.[lang] && !translationsCache[activeTask.id]?.[lang]) {
      try {
        const translated = await translateText(activeTask.description, lang);
        setTranslationsCache(prev => ({
          ...prev,
          [activeTask.id]: {
            ...(prev[activeTask.id] || {}),
            [lang]: translated
          }
        }));
      } catch (e) {
        console.error("Dynamic translation failed:", e);
      }
    }
  };

  // Reset display language when active task changes
  useEffect(() => {
    setSelectedDisplayLang("en");
    setMobileDetailTab("info");
  }, [selectedTaskId]);
  
  // Navigation & filtering states
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [mobileDetailTab, setMobileDetailTab] = useState<"info" | "chat">("info");
  const [mobileTab, setMobileTab] = useState<"assigned-to-me" | "assigned-by-me">("assigned-to-me");

  useEffect(() => {
    if (window.innerWidth < 1024 && mobileView === "detail") {
      window.history.pushState({ modal: 'task-detail' }, '', window.location.href);
    }
  }, [mobileView]);

  useEffect(() => {
    const handlePopState = () => {
      if (window.innerWidth < 1024 && mobileView === "detail") {
        setMobileView("list");
      }
    };
    window.addEventListener('popstate', handlePopState);
    
    const handleOpenAssign = () => {
      setShowCreateForm(true);
    };
    window.addEventListener('openTaskAssignModal', handleOpenAssign);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('openTaskAssignModal', handleOpenAssign);
    };
  }, [mobileView]);
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [selectedTenantId, setSelectedTenantId] = useState<string>("ALL");
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState<string>("");
  const [isPerformanceBoardOpen, setIsPerformanceBoardOpen] = useState<boolean>(false);
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string | null>(null);
  const [showClosedOnly, setShowClosedOnly] = useState<boolean>(false);
  
  // Admin dashboard view mode toggle for managers
  const [adminViewMode, setAdminViewMode] = useState<"my-columns" | "team-board">("my-columns");
  
  // Collapsible Accordions states for status groups
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    Completed: true,
    Closed: true
  });

  const [chatInput, setChatInput] = useState<string>("");
  const [errMess, setErrMess] = useState<string>("");
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const isManager = activeUser.role === Role.ADMIN || 
                    activeUser.role === Role.SUPER_ADMIN || 
                    activeUser.role === Role.MANAGER || 
                    activeUser.role === Role.SUPERVISOR;

  const activeTask = tasks.find(t => t.id === selectedTaskId);

  const getTaskNumber = (task: Task) => {
    const sortedTasks = [...tasks].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const idx = sortedTasks.findIndex(t => t.id === task.id);
    return idx >= 0 ? `#${idx + 1}` : "";
  };

  // Synchronize read count of task chats
  useEffect(() => {
    if (selectedTaskId && activeTask) {
      const key = `horae_task_chat_read_${activeUser.id}_${selectedTaskId}`;
      
      if (prevSelectedTaskIdRef.current !== selectedTaskId) {
        const prevVal = localStorage.getItem(key);
        const prevCount = prevVal ? parseInt(prevVal, 10) : 0;
        setSelectedTaskInitialReadCount(prevCount);
        prevSelectedTaskIdRef.current = selectedTaskId;
      }
      
      localStorage.setItem(key, activeTask.chat.length.toString());
    } else {
      prevSelectedTaskIdRef.current = "";
    }
  }, [selectedTaskId, activeTask?.chat.length, activeUser.id]);

  // Scroll to bottom of chat when active task updates
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedTaskId, tasks]);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      // Browser fallback simulation
      setIsListening(true);
      setTimeout(() => {
        let text = "";
        if (speechLanguage === "en-US") {
          text = "Prepare clean sheet pans for croissants baking in the morning.";
        } else if (speechLanguage === "hi-IN") {
          text = "सुबह क्रोइसैन पकाने के लिए साफ शीट पैन तैयार करें।";
        } else if (speechLanguage === "kn-IN") {
          text = "ಬೆಳಿಗ್ಗೆ ಕ್ರೋಸೆಂಟ್‌ಗಳನ್ನು ಬೇಕ್ ಮಾಡಲು ಕ್ಲೀನ್ ಶೀಟ್ ಪ್ಯಾನ್‌ಗಳನ್ನು ತಯಾರಿಸಿ.";
        } else {
          text = "காலையில் குரோசண்ட்ஸ் பேக் செய்ய சுத்தமான ஷீட் பான்களை தயார் செய்யவும்.";
        }
        setDescription(prev => prev ? prev + " " + text : text);
        setIsListening(false);
      }, 2000);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = speechLanguage;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const resultText = event.results[0][0].transcript;
        setDescription(prev => prev ? prev + " " + resultText : resultText);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const handleTranslateDescription = async () => {
    if (!description.trim()) return;
    setTranslating(true);
    try {
      const translated = await translateText(description, 'en');
      setDescription(translated);
    } catch (error) {
      alert("Failed to translate description.");
    } finally {
      setTranslating(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setErrMess("Task title and details are required.");
      return;
    }
    if (assignedUserIds.length === 0) {
      setErrMess("Please select at least one staff member to assign this task.");
      return;
    }
    setErrMess("");

    setTranslating(true);
    let translations = { en: description, hi: description, kn: description, ta: description };
    try {
      translations.en = await translateText(description, 'en');
      translations.hi = await translateText(description, 'hi');
      translations.kn = await translateText(description, 'kn');
      translations.ta = await translateText(description, 'ta');
    } catch (err) {
      console.error("Auto pre-translation failed:", err);
    } finally {
      setTranslating(false);
    }

    const metaString = `\n\n---HORAE-METADATA---\n${JSON.stringify({
      assigneeIds: assignedUserIds,
      translations,
      photos: taskPhotos
    })}`;

    onAddTask(title, description + metaString, priority, dueDate, assignedUserIds);

    // reset creation states
    setTitle("");
    setDescription("");
    setPriority("High");
    setDueDate(new Date().toLocaleDateString('en-CA'));
    setAssigneePicked(EMPTY_SELECTION);
    setTaskPhotos([]);
    setShowCreateForm(false);
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedTaskId) return;
    onAddMessage(selectedTaskId, chatInput.trim());
    setChatInput("");
  };

  const getAssigneeName = (uid: string) => {
    const found = tenantUsers.find(u => u.id === uid);
    return found ? found.name : "Unassigned Staff";
  };

  const getAssigneeAvatar = (uid: string) => {
    const found = tenantUsers.find(u => u.id === uid);
    return found ? found.avatar : "https://i.pravatar.cc/150?img=10";
  };

  const isTaskOverdue = (task: Task) => {
    if (task.status === "Completed" || task.status === "Closed") return false;
    const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];
    return task.dueDate < todayStr;
  };

  const getOverdueDays = (dueDateStr: string) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = new Date(dueDateStr);
    due.setHours(0,0,0,0);
    const diff = today.getTime() - due.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const downloadTasksCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Task ID,Title,Description,Outlet/Tenant,Priority,Status,Due Date,Creation Date,Assignees,Created By,Days Pending,Chat Transcript\n";
    
    filteredTasksList.forEach(t => {
      const taskId = `"${getTaskNumber(t)}"`;
      const title = `"${t.title.replace(/"/g, '""')}"`;
      const desc = `"${t.description.replace(/"/g, '""')}"`;
      const outlet = `"${(tenants.find(ten => ten.id === t.tenantId)?.name || t.tenantId).replace(/"/g, '""')}"`;
      const priority = `"${t.priority}"`;
      const status = `"${t.status}"`;
      const dueDate = `"${t.dueDate}"`;
      const creationDate = `"${t.createdAt ? new Date(t.createdAt).toLocaleString() : ''}"`;
      
      const assigneesList = t.assignedUserIds && t.assignedUserIds.length > 0 ? t.assignedUserIds : [t.assignedUserId];
      const assignees = `"${assigneesList.map(uid => getAssigneeName(uid)).join("; ").replace(/"/g, '""')}"`;
      const creator = `"${getAssigneeName(t.createdByUserId).replace(/"/g, '""')}"`;
      
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
  const toggleGroupCollapse = (groupLabel: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupLabel]: !prev[groupLabel]
    }));
  };

  // Filtering Logic
  const filterTask = (t: Task) => {
    // Selected employee filter (from Team Performance table click)
    if (selectedEmployeeFilter) {
      const isAssigned = (t.assignedUserIds && t.assignedUserIds.includes(selectedEmployeeFilter)) || 
                          t.assignedUserId === selectedEmployeeFilter;
      if (!isAssigned) return false;
    }

    // Closed Tasks Toggle Filter
    if (showClosedOnly) {
      if (t.status !== "Closed") return false;
    } else {
      if (t.status === "Closed") return false;
    }

    if (selectedTenantId !== "ALL" && t.tenantId !== selectedTenantId) return false;
    if (activeFilter === "All") return true;
    if (activeFilter === "Overdue") return isTaskOverdue(t);
    const localToday = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];
    if (activeFilter === "Due Today") return t.dueDate === localToday;
    if (activeFilter === "Critical") return t.priority === "Critical";
    if (activeFilter === "Assigned To Me") {
      return (t.assignedUserIds && t.assignedUserIds.includes(activeUser.id)) || t.assignedUserId === activeUser.id;
    }
    if (activeFilter === "Assigned By Me") {
      return t.createdByUserId === activeUser.id;
    }
    return t.status === activeFilter;
  };

  const filteredTasksList = tasks.filter(filterTask);

  // Only clear selection if the selected task is no longer visible
  useEffect(() => {
    if (selectedTaskId) {
      const isStillVisible = filteredTasksList.some(t => t.id === selectedTaskId);
      if (!isStillVisible) {
        setSelectedTaskId("");
      }
    }
  }, [filteredTasksList, selectedTaskId]);

  // Split tasks lists
  const assignedToMe = filteredTasksList.filter(t => 
    (t.assignedUserIds && t.assignedUserIds.includes(activeUser.id)) || 
    t.assignedUserId === activeUser.id
  );

  const assignedByMe = filteredTasksList.filter(t => 
    t.createdByUserId === activeUser.id
  );

  // Groupings definitions
  const statusGroups = [
    { id: "Assigned", label: "Assigned", check: (t: Task) => t.status === "Assigned" },
    { id: "In Progress", label: "In Progress", check: (t: Task) => t.status === "In Progress" },
    { id: "Pending", label: "Pending", check: (t: Task) => t.status === "Pending" },
    { id: "On Hold", label: "On Hold", check: (t: Task) => t.status === "On Hold" },
    { id: "Completed", label: "Completed", check: (t: Task) => t.status === "Completed" }
  ];

  // Dashboard Stats calculations
  const localToday = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];
  const totalTasksCount = tasks.length;
  const activeTasksCount = tasks.filter(t => t.status !== "Closed").length;
  const overdueCount = tasks.filter(t => new Date(t.dueDate) < new Date(localToday) && t.status !== "Completed" && t.status !== "Closed").length;
  const dueTodayCount = tasks.filter(t => t.dueDate === localToday && t.status !== "Completed" && t.status !== "Closed").length;
  const criticalOpenCount = tasks.filter(t => t.priority === "Critical" && t.status !== "Completed" && t.status !== "Closed").length;
  const completedTodayCount = tasks.filter(t => t.status === "Completed" && t.createdAt.split("T")[0] === localToday).length;
  
  const myAssignedToMeCount = tasks.filter(t => ((t.assignedUserIds && t.assignedUserIds.includes(activeUser.id)) || t.assignedUserId === activeUser.id) && t.status !== "Closed").length;
  const myAssignedByMeCount = tasks.filter(t => t.createdByUserId === activeUser.id && t.status !== "Closed").length;

  const totalClosedCompleted = tasks.filter(t => t.status === "Completed" || t.status === "Closed").length;
  const completionRate = totalTasksCount > 0 ? Math.round((totalClosedCompleted / totalTasksCount) * 100) : 100;

  // Render Priority badge helper
  const renderPriorityBadge = (p: string) => {
    switch(p) {
      case "Critical":
        return <span className="bg-red-50 text-red-750 font-medium border border-red-200 px-2 py-0.5 rounded-lg text-[9px] tracking-wide flex items-center gap-1 shrink-0"><span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-ping" />🔴 Critical (Within 1 Hr)</span>;
      case "High":
        return <span className="bg-orange-50 text-orange-750 font-medium border border-orange-200 px-2 py-0.5 rounded-lg text-[9px] tracking-wide flex items-center gap-1 shrink-0">🟠 High (EOD)</span>;
      case "Medium":
        return <span className="bg-amber-50 text-slate-700 font-medium border border-amber-250 px-2 py-0.5 rounded-lg text-[9px] tracking-wide flex items-center gap-1 shrink-0">🟡 Medium (EOD Tomorrow)</span>;
      case "Low":
      default:
        return <span className="bg-emerald-50 text-emerald-700 font-medium border border-emerald-255 px-2 py-0.5 rounded-lg text-[9px] tracking-wide flex items-center gap-1 shrink-0">🟢 Low (&gt; 2 Days)</span>;
    }
  };

  // Render Unread Chat Badge helper
  const renderUnreadChatBadge = (t: Task) => {
    const key = `horae_task_chat_read_${activeUser.id}_${t.id}`;
    const readCountStr = localStorage.getItem(key);
    const readCount = readCountStr ? parseInt(readCountStr, 10) : 0;
    
    const unreadCount = t.chat.length - readCount;
    if (unreadCount > 0 && t.id !== selectedTaskId) {
      return (
        <span 
          className="bg-slate-800 text-white font-semibold text-[8px] px-1.5 py-0.5 rounded-full flex items-center justify-center shadow-xs shrink-0 animate-pulse font-sans" 
          title={`${unreadCount} new comment${unreadCount > 1 ? "s" : ""}`}
        >
          {unreadCount} NEW
        </span>
      );
    }
    return null;
  };

  // Render Due date badge helper
  const renderDueDateBadge = (t: Task) => {
    const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];
    if (t.status === "Completed" || t.status === "Closed") {
      return (
        <span className="bg-slate-100 border border-slate-200 text-slate-500 font-mono text-[9px] px-2 py-0.5 rounded-lg flex items-center gap-1">
          <Clock className="w-3 h-3" /> Done
        </span>
      );
    }
    if (t.dueDate < todayStr) {
      const days = getOverdueDays(t.dueDate);
      return (
        <span className="bg-rose-50 border border-rose-200 text-rose-700 font-medium text-[9px] px-2 py-0.5 rounded-lg flex items-center gap-1 animate-pulse">
          🚨 OVERDUE BY {days} DAY{days > 1 ? "S" : ""}
        </span>
      );
    }
    if (t.dueDate === todayStr) {
      return (
        <span className="bg-amber-50 border border-amber-250 text-amber-800 font-medium text-[9px] px-2 py-0.5 rounded-lg flex items-center gap-1">
          ⚠ DUE TODAY
        </span>
      );
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    if (t.dueDate === tomorrowStr) {
      return (
        <span className="bg-blue-50 border border-blue-200 text-blue-800 font-semibold text-[9px] px-2 py-0.5 rounded-lg flex items-center gap-1">
          📅 DUE TOMORROW
        </span>
      );
    }
    return (
      <span className="bg-slate-50 border border-slate-200 text-slate-500 font-mono text-[9px] px-2 py-0.5 rounded-lg flex items-center gap-1">
        📅 Due: {t.dueDate}
      </span>
    );
  };

  // Render Reminder Bell
  const renderReminderBell = (t: Task) => {
    const isAssignee = activeUser.id === t.assignedUserId || (t.assignedUserIds && t.assignedUserIds.includes(activeUser.id));
    const isCreator = activeUser.id === t.createdByUserId;
    const isManager = activeUser.role === Role.ADMIN || 
                      activeUser.role === Role.SUPER_ADMIN || 
                      activeUser.role === Role.MANAGER || 
                      activeUser.role === Role.SUPERVISOR;
    const canRemind = isAssignee || isCreator || isManager;

    const sentRecently = !!(t.reminderSentAt && (Date.now() - new Date(t.reminderSentAt).getTime() < 24 * 60 * 60 * 1000));

    if (sentRecently) {
      const time = new Date(t.reminderSentAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (canRemind) {
              onSendReminder(t.id);
            }
          }}
          disabled={!canRemind}
          title={`Reminder sent in last 24h (at ${time}). Click to resend.`}
          className={`p-1 rounded-lg shrink-0 flex items-center gap-0.5 font-medium cursor-pointer relative ${
            canRemind ? "text-amber-500 hover:bg-slate-100" : "text-amber-400 opacity-80"
          }`}
        >
          <Bell className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
        </button>
      );
    }

    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (canRemind) {
            onSendReminder(t.id);
          } else {
            alert("Only assignees, task creator, or managers can send task reminders.");
          }
        }}
        disabled={!canRemind}
        title={canRemind ? "Send reminder bell to notify due status" : "Reminder not sent"}
        className={`p-1 rounded-lg shrink-0 ${
          canRemind ? "text-slate-400 hover:text-amber-600 hover:bg-amber-50 cursor-pointer" : "text-slate-300 pointer-events-none"
        }`}
      >
        <Bell className="w-3.5 h-3.5" />
      </button>
    );
  };

  const renderUrgentNotifyButton = (t: Task) => {
    const isCreator = activeUser.id === t.createdByUserId;
    const isManager = activeUser.role === Role.ADMIN ||
                      activeUser.role === Role.SUPER_ADMIN ||
                      activeUser.role === Role.MANAGER ||
                      activeUser.role === Role.SUPERVISOR;
    const canNotify = isCreator || isManager;
    if (!canNotify) return null;

    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onUrgentNotify(t.id);
        }}
        title="Notify assignee on WhatsApp now"
        className="p-1 rounded-lg shrink-0 flex items-center gap-1 text-[9px] font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Notify</span>
      </button>
    );
  };

  // Render a list of tasks for a status group inside a column
  const renderTaskCardsForGroup = (groupTasks: Task[]) => {
    if (groupTasks.length === 0) return null;
    
    return (
      <div className="space-y-2.5 mt-2">
        {groupTasks.map(t => {
          const isSelected = t.id === selectedTaskId;
          const isOver = isTaskOverdue(t);
          const assigneesList = t.assignedUserIds && t.assignedUserIds.length > 0 ? t.assignedUserIds : [t.assignedUserId];

          return (
            <div
              key={t.id}
              onClick={() => {
                setSelectedTaskId(t.id);
                setMobileView("detail");
              }}
              className={`p-3.5 border rounded-2xl cursor-pointer text-left transition-all relative ${
                isSelected
                  ? "bg-slate-900/25 border-slate-800 border-l-4 border-l-[#C5A880] ring-4 ring-[#C5A880]/20 shadow-sm scale-[1.01]"
                  : isOver
                  ? "bg-white border-slate-155 hover:bg-red-50/10 hover:border-red-200"
                  : "bg-white border-slate-155 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              {/* Card Meta Row */}
              <div className="flex justify-between items-center gap-2 mb-2 pb-1.5 border-b border-slate-100/50">
                <div className="flex flex-wrap gap-1.5 items-center">
                  {renderPriorityBadge(t.priority)}
                  {renderUnreadChatBadge(t)}
                </div>
                <div className="flex items-center gap-1">
                  {renderUrgentNotifyButton(t)}
                  {renderReminderBell(t)}
                </div>
              </div>

              {/* Prominent Due Date & Assigned To */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-2 mb-2.5 space-y-1 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] text-slate-400 font-medium tracking-wide block">Assigned to:</span>
                  <div>
                    {renderDueDateBadge(t)}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-slate-800 text-xs font-medium leading-tight truncate" title={assigneesList.map(uid => getAssigneeName(uid)).join(", ")}>
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{assigneesList.map(uid => getAssigneeName(uid)).join(", ")}</span>
                </div>
              </div>

              {/* Task Title & Description */}
              <div className="space-y-1">
                <h4 className="text-xs font-medium text-slate-800 tracking-tight leading-tight line-clamp-1">
                  {getTaskNumber(t)}: {t.title}
                </h4>
                <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                  {t.description}
                </p>
              </div>

              {/* Card Footer */}
              <div className="pt-2 border-t border-slate-50 mt-2.5 flex items-center justify-end text-[9px] font-mono text-slate-400">
                <span className="text-[8px] font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                  Assigned by: {getAssigneeName(t.createdByUserId)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render Column view
  const renderTaskColumn = (columnTasks: Task[], colTitle: string, colSubText: string) => {
    return (
      <div className="space-y-4 flex flex-col min-w-0 flex-1">
        <h3 className="text-xs font-medium text-slate-800 tracking-wide flex items-center justify-between bg-slate-100 border border-slate-200 px-4 py-2.5 rounded-2xl shadow-xs">
          <span>{colTitle}</span>
          <span className="font-mono text-[10px] bg-slate-250 text-slate-600 px-2 py-0.5 rounded-full font-medium">
            {columnTasks.length}
          </span>
        </h3>
        
        {columnTasks.length === 0 ? (
          <div className="bg-white/40 border border-dashed border-slate-200 rounded-3xl py-10 text-center text-slate-450 text-xs font-medium">
            No tasks in this category.
          </div>
        ) : (
          <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
            {statusGroups.map(group => {
              const groupTasks = columnTasks.filter(group.check);
              if (groupTasks.length === 0) return null;
              
              const isCollapsed = collapsedGroups[group.label];
              
              return (
                <div key={group.id} className="bg-slate-50/50 border border-slate-200 rounded-2xl p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleGroupCollapse(group.label)}
                    className="w-full flex items-center justify-between text-[10px] font-medium text-slate-600 hover:text-slate-800 focus:outline-none select-none"
                  >
                    <span className="flex items-center gap-1.5">
                      {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                      {group.label}
                    </span>
                    <span className="bg-slate-200 text-slate-600 font-mono text-[9px] px-2 py-0.2 rounded-full font-medium">
                      {groupTasks.length}
                    </span>
                  </button>
                  
                  {!isCollapsed && renderTaskCardsForGroup(groupTasks)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderTaskTableView = () => {
    if (filteredTasksList.length === 0) {
      return (
        <div className="bg-white border border-dashed border-slate-200 rounded-2xl py-12 text-center text-slate-400 text-xs font-medium">
          No tasks found matching current filters.
        </div>
      );
    }

    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden text-left" id="tasks-tabular-grid">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-medium tracking-wide text-slate-500">
                <th className="py-3 px-4 w-[45%]">Task Name & Details</th>
                <th className="py-3 px-3 text-center">Due Date</th>
                <th className="py-3 px-3">Assigned to</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {(['Critical', 'High', 'Medium', 'Low'] as const).map(prio => {
                const tasksInPrio = filteredTasksList.filter(t => t.priority === prio);
                if (tasksInPrio.length === 0) return null;
                
                const headerColorClass = 'bg-[#162D4E] text-white';
                                         
                const prioLabel = prio === 'Critical' ? 'Critical - Within 1 hour' : 
                                  prio === 'High' ? 'High - EOD' : 
                                  prio === 'Medium' ? 'Medium - Tomorrow' : 
                                  'Low - More than 2 days';
                
                return (
                  <React.Fragment key={prio}>
                    <tr className={`border-b border-slate-200 ${headerColorClass}`}>
                      <td colSpan={5} className="py-2 px-4 text-[10px] font-bold uppercase tracking-wider">
                        {prioLabel} <span className="ml-2 bg-white/20 text-white px-1.5 py-0.5 rounded-md font-mono text-[9px]">{tasksInPrio.length}</span>
                      </td>
                    </tr>
                    {tasksInPrio.map(t => {
                      const isSelected = t.id === selectedTaskId;
                      const isOver = isTaskOverdue(t);
                      const assigneesList = t.assignedUserIds && t.assignedUserIds.length > 0 ? t.assignedUserIds : [t.assignedUserId];

                      return (
                        <tr
                          key={t.id}
                          onClick={() => {
                            setSelectedTaskId(t.id);
                            setMobileView("detail");
                          }}
                          className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                            isSelected ? "bg-slate-900/15 font-semibold" : ""
                          } ${isOver ? "bg-rose-50/30 hover:bg-rose-50/60 border-l-[3px] border-l-rose-500" : ""}`}
                        >
                    {/* Task Title & Desc */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div className="flex items-start gap-2">
                          <span className={`h-2 w-2 rounded-full shrink-0 mt-1 ${
                            t.status === "Completed" ? "bg-slate-800" : t.status === "In Progress" ? "bg-blue-500" : "bg-slate-400"
                          }`} />
                          <h4 className="text-xs font-medium text-slate-800 tracking-tight leading-tight whitespace-normal break-words pr-2">
                            {getTaskNumber(t)}: {t.title}
                          </h4>
                          {renderUnreadChatBadge(t)}
                        </div>
                        <p className="text-[10px] text-slate-500 font-normal pl-4 font-sans line-clamp-2 whitespace-normal break-words pr-2">
                          {t.translations?.[selectedDisplayLang] || translationsCache[t.id]?.[selectedDisplayLang] || t.description}
                        </p>
                      </div>
                    </td>

                    {/* Due Date */}
                    <td className="py-3.5 px-3 text-center">
                      <div className="flex justify-center">
                        {renderDueDateBadge(t)}
                      </div>
                    </td>

                    {/* Assignees */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center -space-x-1.5 overflow-hidden" title={assigneesList.map(uid => getAssigneeName(uid)).join(", ")}>
                        {assigneesList.map((uid) => (
                          <img
                            key={uid}
                            src={getAssigneeAvatar(uid)}
                            alt={getAssigneeName(uid)}
                            className="w-5 h-5 rounded-full object-cover border-2 border-white inline-block shadow-xs"
                          />
                        ))}
                        <span className="text-[10px] text-slate-500 font-medium pl-2 truncate max-w-[80px]">
                          {assigneesList.length === 1 ? getAssigneeName(assigneesList[0]).split(" ")[0] : `${assigneesList.length} staff`}
                        </span>
                      </div>
                    </td>

                    {/* Status with interactive dropdown */}
                    <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-center">
                        {(() => {
                          const isCreator = t.createdByUserId === activeUser.id;
                          const isAdmin = activeUser.role === Role.ADMIN || activeUser.role === Role.SUPER_ADMIN;
                          const canClose = (isCreator || isAdmin) && (t.status === "Completed" || t.status === "Closed");
                          return (
                            <select
                              value={t.status}
                              onChange={(e) => onUpdateTaskStatus(t.id, e.target.value as any)}
                              className="bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-[10px] px-2 py-1 rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
                            >
                              <option value="Assigned">Assigned</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Pending">Pending</option>
                              <option value="On Hold">On Hold</option>
                              <option value="Completed">Completed</option>
                              {canClose && (
                                <option value="Closed">Closed</option>
                              )}
                            </select>
                          );
                        })()}
                      </div>
                    </td>

                    {/* Action buttons */}
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {renderUrgentNotifyButton(t)}
                        {renderReminderBell(t)}

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTaskId(t.id);
                            setMobileView("detail");
                          }}
                          className="p-1 text-slate-400 hover:text-slate-755 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Open chat & audit"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>

                        {(activeUser.role === Role.ADMIN || activeUser.role === Role.SUPER_ADMIN || t.createdByUserId === activeUser.id) && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("Permanently delete this task?")) {
                                onDeleteTask(t.id);
                              }
                            }}
                            className="p-1 text-slate-300 hover:text-slate-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4" id="tasks-module-grid">
      {onBack && (
        <button 
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-555 hover:text-slate-800 transition-colors cursor-pointer select-none border border-slate-200 hover:border-slate-300 bg-white px-3 py-1.5 rounded-xl shadow-xs self-start mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
      )}

      {/* 1. EMPLOYEE PERFORMANCE BOARD (Collapsible) */}
      {(activeUser.role === Role.ADMIN || activeUser.role === Role.SUPER_ADMIN) && (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-4">
        <div 
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => setIsPerformanceBoardOpen(!isPerformanceBoardOpen)}
        >
          <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500" />
            Employee Performance Board
          </h4>
          <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
            <div className="relative w-48 hidden sm:block">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search staff..."
                value={employeeSearchQuery}
                onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:outline-none focus:bg-white focus:border-indigo-500 transition-all"
              />
            </div>
            <button 
              className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              onClick={() => setIsPerformanceBoardOpen(!isPerformanceBoardOpen)}
            >
              {isPerformanceBoardOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>
        
        {isPerformanceBoardOpen && (
          <div className="border-t border-slate-100 p-4 bg-slate-50/50">
            <div className="relative w-full mb-4 sm:hidden">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search staff..."
                value={employeeSearchQuery}
                onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 font-medium focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4 text-center">Open Tasks</th>
                    <th className="py-3 px-4 text-center">Overdue</th>
                    <th className="py-3 px-4 text-center">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-600">
                  {tenantUsers
                    .filter(u => employeeSearchQuery ? u.name.toLowerCase().includes(employeeSearchQuery.toLowerCase()) : true)
                    .map(u => {
                    const userTasks = tasks.filter(t => (t.assignedUserIds && t.assignedUserIds.includes(u.id)) || t.assignedUserId === u.id);
                    const openCount = userTasks.filter(t => t.status !== "Completed" && t.status !== "Closed").length;
                    const userOverdue = userTasks.filter(isTaskOverdue).length;
                    const completedCount = userTasks.filter(t => t.status === "Completed" || t.status === "Closed").length;
                    
                    const isRowSelected = selectedEmployeeFilter === u.id;

                    return (
                      <tr 
                        key={u.id} 
                        onClick={() => {
                          setSelectedEmployeeFilter(isRowSelected ? null : u.id);
                          setIsPerformanceBoardOpen(false);
                        }}
                        className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                          isRowSelected ? "bg-indigo-50/50 border-l-2 border-l-indigo-600" : ""
                        }`}
                      >
                        <td className="py-3 px-4 flex items-center gap-3">
                          <img src={u.avatar} alt={u.name} className="w-6 h-6 rounded-full object-cover shrink-0 border border-slate-200" />
                          <div>
                            <span className="font-bold text-slate-800 block">{u.name}</span>
                            <span className="text-[10px] font-medium text-slate-400 block">{u.role}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-mono">{openCount}</td>
                        <td className={`py-3 px-4 text-center font-mono ${userOverdue > 0 ? "text-rose-600 font-bold" : "text-slate-400"}`}>{userOverdue}</td>
                        <td className="py-3 px-4 text-center font-mono text-emerald-600">{completedCount}</td>
                      </tr>
                    );
                  })}
                  {tenantUsers.filter(u => employeeSearchQuery ? u.name.toLowerCase().includes(employeeSearchQuery.toLowerCase()) : true).length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 text-sm">No staff members found matching "{employeeSearchQuery}"</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      )}
      


      {/* 2. STICKY FILTER BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs flex flex-col md:flex-row md:items-start justify-between gap-3 sticky top-0 z-30">
        <div className="flex flex-wrap items-center gap-1 md:gap-1.5 py-1 pr-2">
          {[
            { id: "All", label: "All Work" },
            { id: "Overdue", label: "Overdue" },
            { id: "Due Today", label: "Due Today" },
            { id: "Critical", label: "Critical" },
            { id: "Assigned", label: "Assigned" },
            { id: "In Progress", label: "In Progress" },
            { id: "Pending", label: "Pending" },
            { id: "On Hold", label: "On Hold" },
            { id: "Completed", label: "Completed" }
          ].map(f => {
            const isActive = activeFilter === f.id && !showClosedOnly;
            let colorClasses = "";
            switch (f.id) {
              case "All": colorClasses = isActive ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"; break;
              case "Overdue": colorClasses = isActive ? "bg-rose-500 text-white" : "bg-rose-100 text-rose-700 hover:bg-rose-200"; break;
              case "Due Today": colorClasses = isActive ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-700 hover:bg-orange-200"; break;
              case "Critical": colorClasses = isActive ? "bg-red-500 text-white" : "bg-red-100 text-red-700 hover:bg-red-200"; break;
              case "Assigned": colorClasses = isActive ? "bg-blue-500 text-white" : "bg-blue-100 text-blue-700 hover:bg-blue-200"; break;
              case "In Progress": colorClasses = isActive ? "bg-indigo-500 text-white" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"; break;
              case "Pending": colorClasses = isActive ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-700 hover:bg-amber-200"; break;
              case "On Hold": colorClasses = isActive ? "bg-slate-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"; break;
              case "Completed": colorClasses = isActive ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"; break;
            }

            return (
              <button
                key={f.id}
                onClick={() => {
                  setActiveFilter(f.id);
                  setShowClosedOnly(false); // Reset closed tasks when clicking other status filters
                  setSelectedEmployeeFilter(null); // clear row click filters
                }}
                className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-semibold tracking-tight whitespace-nowrap transition-all select-none cursor-pointer border border-transparent shadow-xs ${colorClasses} ${isActive ? 'scale-105 shadow-sm' : ''}`}
              >
                {f.label}
              </button>
            );
          })}
          {selectedEmployeeFilter && (
            <button
              onClick={() => setSelectedEmployeeFilter(null)}
              className="px-2 py-1 bg-slate-100 border border-slate-300 text-slate-800 rounded-lg text-[10px] font-medium flex items-center gap-1"
            >
              Staff: {getAssigneeName(selectedEmployeeFilter).split(" ")[0]} ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Outlet Filter for Managers */}
          {(activeUser.role === "ADMIN" || activeUser.role === "MANAGER") && (
            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none hover:border-slate-300 transition-colors shadow-xs"
            >
              <option value="ALL">All Outlets</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}

        </div>
      </div>

      {/* 2b. SECOND FILTER ROW: ASSIGNED TO/BY ME & CLOSED TASKS ARCHIVE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 py-2 bg-[#F1F5F9] border border-slate-200/60 rounded-2xl shadow-inner animate-fade-in">
        {/* Left Side: Assigned to me & Assigned by me toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (activeFilter === "Assigned To Me" && !showClosedOnly) {
                setActiveFilter("All");
              } else {
                setActiveFilter("Assigned To Me");
                setShowClosedOnly(false);
              }
              setSelectedEmployeeFilter(null);
            }}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold tracking-tight transition-all select-none cursor-pointer border flex-1 sm:flex-none text-center ${
              activeFilter === "Assigned To Me" && !showClosedOnly
                ? "bg-slate-900 text-white border-slate-900 shadow-sm opacity-100 scale-102"
                : activeFilter === "Assigned By Me" && !showClosedOnly
                ? "bg-[#F1F5F9] text-slate-400 border-slate-200 opacity-40 hover:opacity-75"
                : "bg-[#F1F5F9] text-slate-700 border-slate-300 hover:bg-slate-200 opacity-100"
            }`}
          >
            👤 Assigned To Me ({myAssignedToMeCount})
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeFilter === "Assigned By Me" && !showClosedOnly) {
                setActiveFilter("All");
              } else {
                setActiveFilter("Assigned By Me");
                setShowClosedOnly(false);
              }
              setSelectedEmployeeFilter(null);
            }}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold tracking-tight transition-all select-none cursor-pointer border flex-1 sm:flex-none text-center ${
              activeFilter === "Assigned By Me" && !showClosedOnly
                ? "bg-slate-900 text-white border-slate-900 shadow-sm opacity-100 scale-102"
                : activeFilter === "Assigned To Me" && !showClosedOnly
                ? "bg-[#F1F5F9] text-slate-400 border-slate-200 opacity-40 hover:opacity-75"
                : "bg-[#F1F5F9] text-slate-700 border-slate-300 hover:bg-slate-200 opacity-100"
            }`}
          >
            📢 Assigned By Me ({myAssignedByMeCount})
          </button>
        </div>

        {/* Right Side: Closed task Archive */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              id="toggle-closed-tasks"
              checked={showClosedOnly}
              onChange={(e) => {
                setShowClosedOnly(e.target.checked);
                setActiveFilter("All");
                setSelectedEmployeeFilter(null);
              }}
              className="rounded border-slate-300 text-slate-900 focus:ring-[#162D4E] w-4 h-4 cursor-pointer"
            />
            <span className="text-xs font-medium text-slate-500 hover:text-slate-850 flex items-center gap-1.5">
              📁 Closed Tasks Archive <span className="bg-slate-200 text-slate-750 text-[10px] px-2 py-0.5 rounded-full font-medium font-mono">{tasks.filter(t => t.status === "Closed").length}</span>
            </span>
          </label>
          {showClosedOnly && (
            <span className="text-[9px] font-semibold text-white tracking-wide bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800 animate-pulse">
              Archive Active
            </span>
          )}
        </div>
      </div>

      {/* 3. ADMIN ANALYTICS BOARD (TEAM BOARD MODE) */}
      {isManager && adminViewMode === "team-board" && (
        <div className="space-y-4 animate-fade-in bg-white border border-slate-200 rounded-2xl p-5 shadow-xs" id="team-operations-board">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div className="text-left">
              <h3 className="text-xs font-medium text-slate-800 tracking-wide flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-slate-800 animate-pulse" />
                Team Workload & Operations Board
              </h3>
              <p className="text-[10px] text-slate-400">Comprehensive overview of task distribution, bottlenecks, and staff performance.</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium font-mono">
              <span className="text-slate-500">Overall Completion Rate:</span>
              <span className="text-slate-800 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-lg">{completionRate}%</span>
            </div>
          </div>

          {/* KPI Dashboard grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Total Tasks Logged", count: totalTasksCount, bg: "bg-slate-50 border-slate-100" },
              { label: "Completed Today", count: completedTodayCount, bg: "bg-emerald-50 border-emerald-100 text-emerald-800" },
              { label: "Pending Overdue", count: overdueCount, bg: "bg-rose-50 border-rose-100 text-rose-800" },
              { label: "Critical Open", count: criticalOpenCount, bg: "bg-red-50 border-red-100 text-red-700" },
              { label: "Tasks Completion Rate", count: `${completionRate}%`, bg: "bg-slate-100 border-slate-300 text-indigo-800" }
            ].map((card, idx) => (
              <div key={idx} className={`p-3 rounded-xl border text-center ${card.bg}`}>
                <span className="text-lg font-mono font-medium block">{card.count}</span>
                <span className="text-[8px] font-medium tracking-wide text-slate-400 block mt-1">{card.label}</span>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* 4. WORKFLOWS COLUMNS BOARD (DESKTOP VIEW) */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-12 gap-6" id="tasks-board-body">
        
        {/* LEFT DIRECTORY / BOARD SECTION (7 cols on Desktop) */}
        <div className={`lg:col-span-7 flex flex-col space-y-4 ${mobileView === "list" ? "block" : "hidden lg:flex"}`} id="tasks-board-columns">
          
          {/* Section Header Controls */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
            <div className="text-left">
              <h3 className="text-xs font-medium text-slate-800 tracking-wide flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-amber-550" />
                Shift Tasks Board ({filteredTasksList.length})
              </h3>
              <p className="text-[10px] text-slate-400">Operations Workflow Logs</p>
            </div>

            <div className="flex items-center gap-2">
              {/* Layout Switcher */}
              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewLayout("columns")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                    viewLayout === "columns" ? "bg-white text-slate-800 shadow-xs" : "text-slate-450 hover:text-slate-700"
                  }`}
                  title="Column Board"
                >
                  <Layers className="w-3 h-3" />
                  <span>Board</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewLayout("table")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                    viewLayout === "table" ? "bg-white text-slate-800 shadow-xs" : "text-slate-450 hover:text-slate-700"
                  }`}
                  title="Tabular Grid"
                >
                  <List className="w-3 h-3" />
                  <span>Grid</span>
                </button>
              </div>

              {(activeUser.role === Role.ADMIN || activeUser.role === Role.SUPER_ADMIN) && (
                <button
                  onClick={downloadTasksCSV}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 font-medium text-[11px] text-white rounded-xl shadow-xs transition-all cursor-pointer"
                  title="Download Tasks CSV Report"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Report</span>
                </button>
              )}

              <button
                id="new-task-trigger-btn"
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 font-medium text-[11px] text-white border border-slate-800 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {showCreateForm ? "Cancel" : "Assign Task"}
              </button>
            </div>
          </div>

          {/* 4a. Task Creation Form */}
          {showCreateForm && (
            <form onSubmit={handleCreateTask} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3.5 text-left" id="task-creator-subform">
              <div className="border-b border-slate-100 pb-2">
                <h4 className="text-xs font-medium text-slate-850">Assign Operational Shift Task</h4>
              </div>

              {errMess && (
                <p className="p-2.5 bg-red-50 text-red-800 rounded-xl font-mono text-[10px] font-medium">
                  {errMess}
                </p>
              )}

              <div className="space-y-3">
                <div className="space-y-0.5">
                  <label className="text-xs text-slate-700 font-semibold tracking-wider block">Task Heading</label>
                  <input
                    id="task-title"
                    type="text"
                    required
                    placeholder="e.g. Clean and oil raw mixture gear tonight"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>

                <div className="space-y-0.5">
                  <label className="text-xs text-slate-700 font-semibold tracking-wider block">Task Descriptions</label>
                  <textarea
                    id="task-desc"
                    required
                    rows={3}
                    placeholder="Details to direct assignee on correct procedures..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-755 focus:outline-none focus:border-amber-500 transition-colors font-sans"
                  />
                  {/* Voice input controls & Translate button */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5">
                    <div className="flex items-center gap-1.5">
                      <select
                        value={speechLanguage}
                        onChange={(e) => setSpeechLanguage(e.target.value as any)}
                        className="bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-medium px-2 py-1 rounded-lg focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        <option value="en-US">English (US)</option>
                        <option value="hi-IN">हिन्दी (Hindi)</option>
                        <option value="kn-IN">ಕನ್ನಡ (Kannada)</option>
                        <option value="ta-IN">தமிழ் (Tamil)</option>
                      </select>
                      <button
                        type="button"
                        onClick={isListening ? stopListening : startListening}
                        className={`p-1.5 rounded-lg flex items-center justify-center transition-all border cursor-pointer ${
                          isListening 
                            ? "bg-slate-900 text-white border-slate-800 animate-pulse shadow-sm" 
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                        title={isListening ? "Stop Voice Input" : "Start Voice Input"}
                      >
                        {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                      </button>
                      {isListening && (
                        <span className="text-[9px] text-red-500 font-medium uppercase tracking-wide animate-pulse">
                          Listening...
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={translating || !description.trim()}
                      onClick={handleTranslateDescription}
                      className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-medium rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Languages className="w-3 h-3" />
                      {translating ? "Translating..." : "Translate to English"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-0.5">
                    <label className="text-xs text-slate-700 font-semibold tracking-wider block">Due Shift Date</label>
                    <input
                      id="task-date"
                      type="date"
                      value={dueDate}
                      min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0]}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-2.5 py-2 bg-slate-500/10 border border-slate-200 rounded-xl text-xs font-semibold text-slate-750 focus:outline-none cursor-pointer"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-xs text-slate-700 font-semibold tracking-wider block">Priority Rank</label>
                    <select
                      id="task-priority"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full px-2.5 py-2 bg-slate-500/10 border border-slate-200 rounded-xl text-xs font-semibold text-slate-750 focus:outline-none cursor-pointer"
                    >
                      <option value="Critical">Critical - Within 1 hour</option>
                      <option value="High">High - EOD</option>
                      <option value="Medium">Medium - Tomorrow</option>
                      <option value="Low">Low - More than 2 days</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-slate-700 font-semibold tracking-wider block">Assigned to (Select Multiple)</label>
                  <TeamTalkMemberPicker
                    candidates={tenantUsers}
                    tenants={tenants}
                    value={assigneePicked}
                    onChange={setAssigneePicked}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-700 font-semibold tracking-wider block">Task Photos (Optional, Max 3)</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={taskPhotos.length >= 3}
                    onChange={handlePhotoUpload}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-medium file:bg-amber-55/10 file:text-amber-800 hover:file:bg-amber-100/50 cursor-pointer"
                  />
                  {taskPhotos.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {taskPhotos.map((photo, index) => (
                        <div key={index} className="relative w-14 h-14 border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                          <img src={photo} alt={`Upload preview ${index + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removePhoto(index)}
                            className="absolute top-0.5 right-0.5 bg-slate-900 text-white rounded-full p-0.5 shadow hover:bg-red-650 cursor-pointer transition-colors"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-medium text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 text-white border border-slate-800 font-medium text-[11px] rounded-lg shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  Launch Task
                </button>
              </div>
            </form>
          )}

          {/* Board or Grid rendering */}
          {showClosedOnly ? (
            renderTaskTableView()
          ) : viewLayout === "columns" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                {renderTaskColumn(assignedToMe, "Assigned To Me", "Tasks delegated to you")}
              </div>
              <div>
                {renderTaskColumn(assignedByMe, "Assigned By Me", "Tasks created by you")}
              </div>
            </div>
          ) : (
            renderTaskTableView()
          )}

        </div>

        {/* RIGHT DETAIL VIEW & COLLABORATIVE CHAT (5 cols on Desktop) */}
        <div className={`lg:col-span-5 ${mobileView === "detail" ? "block" : "hidden lg:block"}`} id="tasks-board-chat-wrapper">
          {activeTask ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[650px] overflow-hidden" id="tasks-chat-board">
              
              {/* Header */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  {renderPriorityBadge(activeTask.priority)}
                  {activeTask.reminderSentAt && (Date.now() - new Date(activeTask.reminderSentAt).getTime() < 24 * 60 * 60 * 1000) && (
                    <span className="flex items-center gap-1 text-[9px] font-mono font-medium text-slate-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      <Bell className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                      Reminder Active
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setIsTaskExpanded(true)}
                    className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    title="Expand to Full Page"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  {(activeUser.role === Role.ADMIN || activeUser.role === Role.SUPER_ADMIN || activeTask.createdByUserId === activeUser.id) && (
                    <button
                      onClick={() => {
                        if (confirm("Permanently delete this task?")) {
                          onDeleteTask(activeTask.id);
                        }
                      }}
                      className="p-1 hover:bg-rose-50 rounded-lg text-slate-350 hover:text-slate-600 transition-colors cursor-pointer"
                      title="Remove Task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable details */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-left bg-white">
                {/* Responsive Mobile Go Back Button */}
                <button
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      window.history.back();
                    } else {
                      setMobileView("list");
                    }
                  }}
                  className="lg:hidden flex items-center gap-1.5 text-xs font-medium text-slate-800 hover:text-indigo-900 mb-2 transition-all p-1 hover:bg-slate-100 rounded-lg cursor-pointer"
                  id="btn-back-to-tasks"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>← Back to Tasks Board</span>
                </button>

                {isTaskOverdue(activeTask) && (
                  <div className="p-2 bg-rose-50 border border-rose-100 text-rose-700 rounded-lg text-[10px] font-medium flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-slate-600 shrink-0" />
                    <span>OVERDUE BY {getOverdueDays(activeTask.dueDate)} DAYS (Due: {activeTask.dueDate})</span>
                  </div>
                )}

                <h3 className="text-base font-medium text-slate-800 leading-snug tracking-tight mt-1">
                  {getTaskNumber(activeTask)}: {activeTask.title}
                </h3>

                {/* Prominent Metadata Block at the top */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-4 text-left shadow-2xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <span className="text-xs font-medium tracking-wide text-slate-500 block">Assigned to:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(activeTask.assignedUserIds && activeTask.assignedUserIds.length > 0
                          ? activeTask.assignedUserIds
                          : [activeTask.assignedUserId]
                        ).map(uid => (
                          <div key={uid} className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-2xs">
                            <img src={getAssigneeAvatar(uid)} alt="" className="w-5 h-5 rounded-full object-cover" />
                            <span className="text-xs text-slate-800 font-medium">{getAssigneeName(uid)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-xs font-medium tracking-wide text-slate-500 block">Due Date:</span>
                      <div className="text-sm font-medium text-slate-850 flex items-center gap-1 bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-2xs w-fit">
                        {renderDueDateBadge(activeTask)}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-2xs">
                      <span>Assigned by:</span>
                      <strong className="text-slate-800 font-medium">{getAssigneeName(activeTask.createdByUserId)}</strong>
                    </span>
                  </div>
                </div>

                {/* Language Toggle */}
                <div className="flex border-b border-slate-100 justify-start mb-2 gap-1 bg-slate-50 p-1 rounded-xl w-fit">
                  {(["en", "hi", "kn", "ta"] as const).map((lang) => {
                    const label = lang === "en" ? "English" : lang === "hi" ? "हिन्दी" : lang === "kn" ? "ಕನ್ನಡ" : "தமிழ்";
                    const isSelected = selectedDisplayLang === lang;
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => handleLanguageToggle(lang)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                          isSelected ? "bg-white text-slate-800 shadow-xs" : "text-slate-450 hover:text-slate-700"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <p className="text-base text-slate-700 leading-relaxed font-normal bg-white p-3.5 rounded-2xl border border-slate-100 font-sans whitespace-pre-wrap">
                  {activeTask.translations?.[selectedDisplayLang] || translationsCache[activeTask.id]?.[selectedDisplayLang] || activeTask.description}
                </p>

                {activeTask.photos && activeTask.photos.length > 0 && (
                  <div className="space-y-1 mt-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-150">
                    <span className="text-[9px] text-slate-400 font-medium tracking-wide block">Attached Photos ({activeTask.photos.length})</span>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {activeTask.photos.map((photo, pIdx) => (
                        <div 
                          key={pIdx} 
                          className="relative w-16 h-16 border border-slate-200 rounded-xl overflow-hidden shadow-xs cursor-pointer hover:opacity-85 transition-opacity flex-shrink-0"
                          onClick={() => setLightboxImage(photo)}
                        >
                          <img src={photo} alt={`Task Photo ${pIdx + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status Update Controller */}
                <div className="pt-2 border-t border-slate-100/50 space-y-1.5">
                  <span className="text-[8px] font-medium tracking-wide block text-slate-400">Update Phase Status</span>
                  <div className="flex flex-wrap gap-0.5 bg-slate-100 p-0.5 rounded-lg">
                    {(["Assigned", "In Progress", "Pending", "On Hold", "Completed", "Closed"] as const).map(p => {
                      const active = activeTask.status === p;
                      const isCreator = activeTask.createdByUserId === activeUser.id;
                      const isAdmin = activeUser.role === Role.ADMIN || activeUser.role === Role.SUPER_ADMIN;
                      const canClose = (isCreator || isAdmin) && (activeTask.status === "Completed" || activeTask.status === "Closed");
                      const isDisabled = p === "Closed" && !canClose;

                      return (
                        <button
                          key={p}
                          disabled={isDisabled}
                          onClick={() => !isDisabled && onUpdateTaskStatus(activeTask.id, p)}
                          title={p === "Closed" && !isCreator && !isAdmin ? "Only Assigned by (creator) or Company Admin can close completed tasks" : p === "Closed" && !canClose ? "Tasks must be marked Completed before closing" : ""}
                          className={`flex-1 py-1 text-[9px] font-semibold rounded-md transition-all select-none text-center ${
                            isDisabled 
                              ? "opacity-45 cursor-not-allowed text-slate-400" 
                              : active 
                              ? "bg-slate-900 text-white shadow-xs cursor-pointer" 
                              : "text-slate-500 hover:text-slate-850 hover:bg-slate-200 cursor-pointer"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Chat window */}
              <div className="h-[280px] border-t border-slate-150 bg-slate-50/70 flex flex-col min-h-0 shrink-0">
                <div className="px-4 py-1.5 border-b border-slate-100 bg-white text-[9px] text-slate-400 font-semibold font-mono flex items-center justify-between shrink-0">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> 
                    Shift Task Audits (Task {getTaskNumber(activeTask)})
                    {activeTask.chat.length - selectedTaskInitialReadCount > 0 && (
                      <span className="ml-1.5 bg-slate-800 text-white font-semibold text-[8px] px-1.5 py-0.5 rounded-full flex items-center justify-center shadow-xs animate-pulse font-sans">
                        {activeTask.chat.length - selectedTaskInitialReadCount} NEW
                      </span>
                    )}
                  </span>
                  <span>Assignees & Managers Only</span>
                </div>

                {/* Messages feed */}
                <div className="flex-1 p-3.5 space-y-3 overflow-y-auto">
                  {activeTask.chat.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-1.5 text-slate-400">
                      <MessageSquare className="w-7 h-7 text-slate-300" />
                      <p className="text-[11px] font-medium text-slate-700">Audit Chat is Empty</p>
                      <p className="text-[9px] text-slate-500 max-w-[200px]">Logs shift status updates and coordinators comments here.</p>
                    </div>
                  ) : (
                    activeTask.chat.map((m, index) => {
                      const mySelf = m.userId === activeUser.id;
                      const isNew = index >= selectedTaskInitialReadCount;
                      const showNewMessagesBanner = index === selectedTaskInitialReadCount && selectedTaskInitialReadCount > 0;
                      return (
                        <React.Fragment key={m.id}>
                          {showNewMessagesBanner && (
                            <div className="flex items-center justify-center my-4 select-none">
                              <div className="flex-1 border-t-2 border-dashed border-emerald-300" />
                              <span className="bg-slate-800 text-white font-semibold text-[8px] tracking-wide px-2 py-0.5 rounded-full mx-3 shadow-xs">
                                💬 New Messages
                              </span>
                              <div className="flex-1 border-t-2 border-dashed border-emerald-300" />
                            </div>
                          )}
                          <div className={`flex flex-col max-w-[85%] ${mySelf ? "ml-auto items-end" : "mr-auto items-start"}`}>
                            <div className="flex items-center gap-1 mb-0.5 text-[10px] text-slate-400 font-mono">
                              <span className="font-medium">{m.senderName.split(" ")[0]}</span>
                              <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded tracking-wide">{m.senderRole}</span>
                              {isNew && !mySelf && (
                                <span className="text-[9px] bg-emerald-100 text-emerald-800 font-medium px-1 rounded-sm tracking-wide">New</span>
                              )}
                              <span>•</span>
                              <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className={`p-2.5 rounded-2xl text-sm leading-relaxed font-semibold shadow-xs transition-all ${
                              mySelf 
                                ? "bg-slate-900 text-slate-100 rounded-tr-none" 
                                : isNew 
                                ? "bg-emerald-50/50 text-slate-800 border-2 border-emerald-200 rounded-tl-none ring-2 ring-emerald-500/10" 
                                : "bg-white text-slate-800 border border-slate-100 rounded-tl-none"
                            }`}>
                              {m.message}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Chat input */}
                <form onSubmit={handleSendChatMessage} className="p-2 bg-white border-t border-slate-100 flex gap-1.5 shrink-0">
                  <input
                    type="text"
                    placeholder="Type message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:border-amber-500 transition-all font-semibold"
                  />
                  <button
                    type="submit"
                    className="bg-slate-905 hover:bg-slate-805 text-white p-2 rounded-xl shrink-0 flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <Send className="w-3.5 h-3.5 text-white fill-white" />
                  </button>
                </form>
              </div>

            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-dashed border-slate-200 h-[600px] flex flex-col items-center justify-center text-center p-8 space-y-3">
              <CheckSquare className="w-12 h-12 text-slate-200 animate-pulse" />
              <p className="text-sm font-medium text-slate-700">Select an Operational Task</p>
              <p className="text-xs text-slate-400 max-w-xs">Use the left panel to review current shift tasks, or switch simulated personas in the sidebar to allocate a new job.</p>
            </div>
          )}
        </div>

      </div>

      {/* Mobile/Tablet Task Creation Form */}
      {showCreateForm && (
        <div className="lg:hidden mb-4 animate-fade-in">
          <form onSubmit={handleCreateTask} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3 text-left">
            <div className="border-b border-slate-100 pb-1.5 flex justify-between items-center">
              <h4 className="text-xs font-medium text-slate-850">Assign Operational Shift Task</h4>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="text-slate-450 hover:text-slate-650 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errMess && (
              <p className="p-2 bg-red-50 text-red-800 rounded-xl font-mono text-[9px] font-medium">
                {errMess}
              </p>
            )}

            <div className="space-y-2.5">
              <div className="space-y-0.5">
                <label className="text-xs text-slate-700 font-semibold tracking-wider block">Task Heading</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Clean and oil raw mixture gear tonight"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-705 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="space-y-0.5">
                <label className="text-xs text-slate-700 font-semibold tracking-wider block">Task Descriptions</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Details to direct assignee on correct procedures..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-755 focus:outline-none focus:border-amber-500 transition-colors font-sans"
                />
                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                  <div className="flex items-center gap-1">
                    <select
                      value={speechLanguage}
                      onChange={(e) => setSpeechLanguage(e.target.value as any)}
                      className="bg-slate-50 border border-slate-200 text-slate-650 text-[9px] font-medium px-1.5 py-0.5 rounded focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="en-US">English (US)</option>
                      <option value="hi-IN">हिन्दी (Hindi)</option>
                      <option value="kn-IN">ಕನ್ನಡ (Kannada)</option>
                      <option value="ta-IN">தமிழ் (Tamil)</option>
                    </select>
                    <button
                      type="button"
                      onClick={isListening ? stopListening : startListening}
                      className={`p-1 rounded flex items-center justify-center transition-all border cursor-pointer ${
                        isListening 
                          ? "bg-slate-900 text-white border-slate-800 animate-pulse shadow-sm" 
                          : "bg-white text-slate-650 border-slate-200 hover:bg-slate-55"
                      }`}
                    >
                      {isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={translating || !description.trim()}
                    onClick={handleTranslateDescription}
                    className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-medium rounded hover:bg-amber-100 disabled:opacity-50 transition-colors flex items-center gap-0.5 cursor-pointer"
                  >
                    <Languages className="w-2.5 h-2.5" />
                    {translating ? "Translating..." : "Translate to English"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <label className="text-xs text-slate-700 font-semibold tracking-wider block">Due Shift Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0]}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-500/10 border border-slate-200 rounded-lg text-xs font-semibold text-slate-750 focus:outline-none cursor-pointer"
                  />
                </div>

                <div className="space-y-0.5">
                  <label className="text-xs text-slate-700 font-semibold tracking-wider block">Priority Rank</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-500/10 border border-slate-200 rounded-lg text-xs font-semibold text-slate-750 focus:outline-none cursor-pointer"
                  >
                    <option value="Critical">Critical - 1h</option>
                    <option value="High">High - EOD</option>
                    <option value="Medium">Medium - Tomorrow</option>
                    <option value="Low">Low - 2+ days</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-700 font-semibold tracking-wider block">Assigned to (Select Multiple)</label>
                <TeamTalkMemberPicker
                  candidates={tenantUsers}
                  tenants={tenants}
                  value={assigneePicked}
                  onChange={setAssigneePicked}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-50">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-2.5 py-1 rounded-lg text-[9px] font-medium text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Discard
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-slate-900 text-white border border-slate-800 font-medium text-[10px] rounded-lg shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                Launch Task
              </button>
            </div>
          </form>
        </div>
      )}

      {/* On Mobile/Tablet (screens below lg): render a single-column list and a fullscreen details overlay */}
      <div className="lg:hidden flex flex-col h-[620px] bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs animate-fade-in" id="tasks-mobile-split-layout">
        {/* Mobile Task List (100% width) */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
          <div className="p-3 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
            <span className="text-[10px] font-semibold text-slate-900 tracking-wide">Tasks ({filteredTasksList.length})</span>
            <div className="flex items-center gap-1.5">
              {(activeUser.role === Role.ADMIN || activeUser.role === Role.SUPER_ADMIN) && (
                <button
                  onClick={downloadTasksCSV}
                  className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[9px] font-medium cursor-pointer shrink-0"
                >
                  <Download className="w-2.5 h-2.5" />
                  <span>Report</span>
                </button>
              )}
              {isManager && (
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="flex items-center gap-0.5 px-2 py-1 bg-slate-900 hover:bg-slate-800 font-medium text-[9px] text-white border border-slate-800 rounded-lg shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
                >
                  <Plus className="w-2.5 h-2.5" />
                  {showCreateForm ? "Cancel" : "Assign"}
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100/70">
            {filteredTasksList.length === 0 ? (
              <div className="p-4 text-center text-[10px] text-slate-400 font-semibold font-sans">No tasks</div>
            ) : (
              (['Critical', 'High', 'Medium', 'Low'] as const).map(prio => {
                const tasksInPrio = filteredTasksList.filter(t => t.priority === prio);
                if (tasksInPrio.length === 0) return null;
                
                const headerColorClass = prio === 'Critical' ? 'bg-red-100/80 text-red-800 border-red-200' :
                                         prio === 'High' ? 'bg-orange-100/80 text-orange-800 border-orange-200' :
                                         prio === 'Medium' ? 'bg-amber-100/80 text-amber-800 border-amber-200' :
                                         'bg-emerald-100/80 text-emerald-800 border-emerald-200';
                                         
                const prioLabel = prio === 'Critical' ? 'Critical - Within 1 hour' : 
                                  prio === 'High' ? 'High - EOD' : 
                                  prio === 'Medium' ? 'Medium - Tomorrow' : 
                                  'Low - More than 2 days';
                return (
                  <div key={prio} className="mb-3 last:mb-0">
                    <div className={`px-3 py-1.5 text-[10px] font-bold sticky top-0 z-10 border-b uppercase tracking-wider flex items-center justify-between ${headerColorClass}`}>
                      <span>{prioLabel}</span>
                      <span className="bg-white/50 px-1.5 py-0.5 rounded-md text-[9px]">{tasksInPrio.length}</span>
                    </div>
                    <div className="divide-y divide-slate-100/70">
                      {tasksInPrio.map(t => {
                        const isOverdue = isTaskOverdue(t);
                        return (
                          <div
                            key={t.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setSelectedTaskId(t.id);
                              setMobileView("detail");
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                setSelectedTaskId(t.id);
                                setMobileView("detail");
                              }
                            }}
                            className={`w-full text-left p-3.5 transition-all focus:outline-none flex flex-col gap-2 cursor-pointer ${
                              isOverdue ? "bg-rose-50/30 hover:bg-rose-50/60 border-l-[3px] border-l-rose-500" : "hover:bg-slate-50/60 bg-white"
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2 w-full">
                              <div className="flex flex-wrap gap-1 items-center">
                                {renderPriorityBadge(t.priority)}
                                {renderUnreadChatBadge(t)}
                              </div>
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                {renderUrgentNotifyButton(t)}
                                {renderReminderBell(t)}
                                <span className={`text-[8px] font-medium px-1.5 py-0.5 rounded border font-mono ${
                                  t.status === "Completed" ? "bg-slate-800/10 border-emerald-200 text-emerald-800" : t.status === "Closed" ? "bg-slate-500/10 border-slate-200 text-slate-500" : "bg-slate-1000/10 border-indigo-200 text-indigo-800"
                                }`}>{t.status}</span>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <h4 className="text-xs font-medium text-slate-800 leading-tight">
                                {getTaskNumber(t)}: {t.title}
                              </h4>
                              <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed font-sans">
                                {t.description}
                              </p>
                            </div>

                            <div className="flex items-center justify-between text-[9px] font-medium font-mono pt-1.5 border-t border-slate-100/50 mt-1">
                              <span className={isOverdue ? "text-rose-600 font-bold" : "text-slate-400"}>Due: {t.dueDate}</span>
                              <span className="text-slate-400">By: {getAssigneeName(t.createdByUserId).split(" ")[0]}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Mobile Detail Overlay (Fullscreen Modal) */}
        {mobileView === "detail" && activeTask && (
          <div className="fixed inset-0 z-50 bg-white flex flex-col h-full w-full overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <button
                onClick={() => {
                  setSelectedTaskId("");
                  if (window.innerWidth < 1024) {
                    window.history.back();
                  } else {
                    setMobileView("list");
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              
              <div className="flex items-center gap-2">
                {renderPriorityBadge(activeTask.priority)}
                {renderUrgentNotifyButton(activeTask)}
                {renderReminderBell(activeTask)}
                {(activeUser.role === Role.ADMIN || activeUser.role === Role.SUPER_ADMIN || activeTask.createdByUserId === activeUser.id) && (
                  <button
                    onClick={() => {
                      if (confirm("Permanently delete this task?")) {
                        onDeleteTask(activeTask.id);
                      }
                    }}
                    className="p-1.5 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-650 transition-colors cursor-pointer"
                    title="Delete Task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Tab Switched Header on Mobile */}
            <div className="flex border-b border-slate-100 bg-white shrink-0">
              <button
                type="button"
                onClick={() => setMobileDetailTab("info")}
                className={`flex-1 py-3 text-xs font-medium text-center border-b-2 transition-all ${
                  mobileDetailTab === "info" 
                    ? "border-slate-800 text-slate-900" 
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                Task Info
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileDetailTab("chat");
                  setSelectedTaskInitialReadCount(activeTask.chat.length);
                }}
                className={`flex-1 py-3 text-xs font-medium text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                  mobileDetailTab === "chat" 
                    ? "border-slate-800 text-slate-900" 
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                Comments
                {activeTask.chat.length > 0 && (
                  <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full text-[9px] font-medium">
                    {activeTask.chat.length}
                  </span>
                )}
                {activeTask.chat.length - selectedTaskInitialReadCount > 0 && mobileDetailTab !== "chat" && (
                  <span className="bg-slate-800 text-white font-semibold text-[8px] px-1.5 py-0.5 rounded-full flex items-center justify-center shadow-xs animate-pulse font-sans">
                    {activeTask.chat.length - selectedTaskInitialReadCount} NEW
                  </span>
                )}
              </button>
            </div>

            {/* Tab Contents */}
            {mobileDetailTab === "info" ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-left">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg border font-mono ${
                    activeTask.status === "Completed" ? "bg-slate-800/10 border-emerald-200 text-emerald-800 font-medium" : activeTask.status === "Closed" ? "bg-slate-500/10 border-slate-200 text-slate-500 font-medium" : "bg-slate-1000/10 border-indigo-200 text-indigo-800 font-medium"
                  }`}>{activeTask.status}</span>
                  {activeTask.reminderSentAt && (Date.now() - new Date(activeTask.reminderSentAt).getTime() < 24 * 60 * 60 * 1000) && (
                    <span className="flex items-center gap-1 text-[9px] font-mono font-medium text-slate-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      <Bell className="w-3 h-3 fill-amber-500 text-amber-600" />
                      Reminder Active
                    </span>
                  )}
                </div>

                <h4 className="text-base font-medium text-slate-800 leading-snug tracking-tight">
                  {getTaskNumber(activeTask)}: {activeTask.title}
                </h4>

                {/* Micro Details Block */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4 text-left shadow-2xs">
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium tracking-wide text-slate-500 block font-sans">Assigned to:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(activeTask.assignedUserIds && activeTask.assignedUserIds.length > 0
                        ? activeTask.assignedUserIds
                        : [activeTask.assignedUserId]
                      ).map(uid => (
                        <div key={uid} className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-2xs">
                          <img src={getAssigneeAvatar(uid)} alt="" className="w-5 h-5 rounded-full object-cover" />
                          <span className="text-xs text-slate-800 font-medium">{getAssigneeName(uid)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-xl shadow-2xs">
                      <span>Assigned by:</span>
                      <strong className="text-slate-800 font-medium">{getAssigneeName(activeTask.createdByUserId)}</strong>
                    </span>
                    <span className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-xl shadow-2xs">
                      <span>Due:</span>
                      <strong className="text-slate-800 font-medium">{activeTask.dueDate}</strong>
                    </span>
                  </div>
                </div>

                {/* Language Selector & Translation */}
                <div className="flex border-b border-slate-100 justify-start gap-1 bg-slate-500/5 p-1 rounded-xl w-fit">
                  {(["en", "hi", "kn", "ta"] as const).map((lang) => {
                    const label = lang === "en" ? "EN" : lang === "hi" ? "हि" : lang === "kn" ? "ಕ" : "த";
                    const isSelected = selectedDisplayLang === lang;
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => handleLanguageToggle(lang)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          isSelected ? "bg-white text-slate-800 shadow-xs" : "text-slate-450 hover:text-slate-700"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-sm text-slate-705 leading-relaxed bg-white p-4 rounded-xl border border-slate-100 font-sans whitespace-pre-wrap">
                  {activeTask.translations?.[selectedDisplayLang] || translationsCache[activeTask.id]?.[selectedDisplayLang] || activeTask.description}
                </p>

                {activeTask.photos && activeTask.photos.length > 0 && (
                  <div className="space-y-1 bg-slate-50 p-4 rounded-xl border border-slate-150">
                    <span className="text-[9px] text-slate-400 font-medium tracking-wide block font-sans">Attached Photos ({activeTask.photos.length})</span>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {activeTask.photos.map((photo, pIdx) => (
                        <div 
                          key={pIdx} 
                          className="relative w-14 h-14 border border-slate-200 rounded-xl overflow-hidden shadow-xs cursor-pointer hover:opacity-85 transition-opacity flex-shrink-0"
                          onClick={() => setLightboxImage(photo)}
                        >
                          <img src={photo} alt={`Task Photo ${pIdx + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status updates for mobile detail */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-medium tracking-wide block text-slate-400">Update Status</span>
                  <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl">
                    {(["Assigned", "In Progress", "Pending", "On Hold", "Completed", "Closed"] as const).map(p => {
                      const active = activeTask.status === p;
                      const isCreator = activeTask.createdByUserId === activeUser.id;
                      const isAdmin = activeUser.role === Role.ADMIN || activeUser.role === Role.SUPER_ADMIN;
                      const canClose = (isCreator || isAdmin) && (activeTask.status === "Completed" || activeTask.status === "Closed");
                      const isDisabled = p === "Closed" && !canClose;

                      return (
                        <button
                          key={p}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => !isDisabled && onUpdateTaskStatus(activeTask.id, p)}
                          className={`flex-1 py-2 text-[10px] font-semibold rounded-lg transition-all select-none text-center ${
                            isDisabled ? "opacity-35 cursor-not-allowed text-slate-400" : active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-200 hover:text-slate-850"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col bg-slate-50/50 overflow-hidden">
                <div className="flex-1 p-3.5 space-y-2.5 overflow-y-auto">
                  {activeTask.chat.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
                      <MessageSquare className="w-8 h-8 text-slate-300" />
                      <p className="text-xs font-semibold">No comments or updates yet</p>
                    </div>
                  ) : (
                    activeTask.chat.map((msg, i) => (
                      <div key={i} className="text-left bg-white p-3 rounded-xl border border-slate-100 shadow-2xs space-y-1">
                        <div className="flex justify-between text-xs font-medium text-indigo-650">
                          <span>{msg.senderName} ({msg.senderRole})</span>
                          <span className="text-slate-400 font-mono font-medium text-[9px]">{new Date(msg.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-normal font-normal">{msg.message}</p>
                      </div>
                    ))
                  )}
                  <div ref={chatBottomRef} />
                </div>
                <form 
                  onSubmit={handleSendChatMessage}
                  className="p-3 bg-white border-t border-slate-100 flex gap-2 shrink-0"
                >
                  <input
                    type="text"
                    placeholder="Type a comment..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-55 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-900 text-white font-medium text-xs rounded-xl cursor-pointer"
                  >
                    Send
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>

      {isTaskExpanded && activeTask && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 md:p-8 animate-fade-in" id="expanded-task-modal">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between text-left shrink-0">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {renderPriorityBadge(activeTask.priority)}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border font-mono ${
                    activeTask.status === "Completed" ? "bg-slate-800/10 border-emerald-200 text-emerald-800 font-medium" : activeTask.status === "Closed" ? "bg-slate-500/10 border-slate-200 text-slate-500 font-medium" : "bg-slate-1000/10 border-indigo-200 text-indigo-800 font-medium"
                  }`}>{activeTask.status}</span>
                  {activeTask.reminderSentAt && (Date.now() - new Date(activeTask.reminderSentAt).getTime() < 24 * 60 * 60 * 1000) && (
                    <span className="flex items-center gap-1 text-[10px] font-mono font-medium text-slate-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 animate-pulse">
                      <Bell className="w-3 h-3 fill-amber-500 text-amber-600" />
                      Reminder Active
                    </span>
                  )}
                </div>
                <h2 className="text-base md:text-lg font-medium text-slate-800 tracking-tight mt-1">
                  {getTaskNumber(activeTask)}: {activeTask.title}
                </h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setIsTaskExpanded(false)}
                  className="p-1.5 hover:bg-slate-200 rounded-xl text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  title="Close Full Page View"
                >
                  <Minimize2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Split view */}
            <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-200">
              
              {/* Left Column: Details & Actions */}
              <div className="flex-1 p-6 overflow-y-auto space-y-6 text-left">
                {/* Prominent Metadata */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-4 shadow-2xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <span className="text-xs font-medium tracking-wide text-slate-500 block">Assigned to:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(activeTask.assignedUserIds && activeTask.assignedUserIds.length > 0
                          ? activeTask.assignedUserIds
                          : [activeTask.assignedUserId]
                        ).map(uid => (
                          <div key={uid} className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-2xs">
                            <img src={getAssigneeAvatar(uid)} alt="" className="w-5 h-5 rounded-full object-cover" />
                            <span className="text-xs text-slate-800 font-medium">{getAssigneeName(uid)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-xs font-medium tracking-wide text-slate-500 block">Due Date:</span>
                      <div className="text-sm font-medium text-slate-805 flex items-center gap-1 bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-2xs w-fit">
                        {renderDueDateBadge(activeTask)}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-2xs">
                      <span>Assigned by:</span>
                      <strong className="text-slate-800 font-medium">{getAssigneeName(activeTask.createdByUserId)}</strong>
                    </span>
                  </div>
                </div>

                {/* Description & Translation */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold tracking-wide text-slate-400 block">Task Description</span>
                    <div className="flex border border-slate-200 justify-start gap-1 bg-slate-500/5 p-0.5 rounded-lg w-fit">
                      {(["en", "hi", "kn", "ta"] as const).map((lang) => {
                        const label = lang === "en" ? "English" : lang === "hi" ? "हिन्दी" : lang === "kn" ? "ಕನ್ನಡ" : "தமிழ்";
                        const isSelected = selectedDisplayLang === lang;
                        return (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => handleLanguageToggle(lang)}
                            className={`px-2.5 py-0.5 rounded-md text-[9px] font-medium transition-all cursor-pointer ${
                              isSelected ? "bg-white text-slate-800 shadow-2xs" : "text-slate-450 hover:text-slate-700"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-base text-slate-700 leading-relaxed font-normal bg-slate-50/50 p-4 rounded-2xl border border-slate-100 font-sans whitespace-pre-wrap">
                    {activeTask.translations?.[selectedDisplayLang] || translationsCache[activeTask.id]?.[selectedDisplayLang] || activeTask.description}
                  </p>
                </div>

                {/* Status Dropdown Controller */}
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold tracking-wide block text-slate-400">Update Status Phase</span>
                  <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl">
                    {(["Assigned", "In Progress", "Pending", "On Hold", "Completed", "Closed"] as const).map(p => {
                      const active = activeTask.status === p;
                      const isCreator = activeTask.createdByUserId === activeUser.id;
                      const isAdmin = activeUser.role === Role.ADMIN || activeUser.role === Role.SUPER_ADMIN;
                      const canClose = (isCreator || isAdmin) && (activeTask.status === "Completed" || activeTask.status === "Closed");
                      const isDisabled = p === "Closed" && !canClose;

                      return (
                        <button
                          key={p}
                          disabled={isDisabled}
                          onClick={() => !isDisabled && onUpdateTaskStatus(activeTask.id, p)}
                          title={p === "Closed" && !isCreator && !isAdmin ? "Only Assigned by (creator) or Company Admin can close completed tasks" : p === "Closed" && !canClose ? "Tasks must be marked Completed before closing" : ""}
                          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all select-none text-center ${
                            isDisabled 
                              ? "opacity-45 cursor-not-allowed text-slate-400" 
                              : active 
                              ? "bg-slate-900 text-white shadow-xs cursor-pointer" 
                              : "text-slate-500 hover:text-slate-850 hover:bg-slate-200 cursor-pointer"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: Chat/Audit thread */}
              <div className="w-full md:w-[420px] flex flex-col min-h-0 bg-slate-50/50">
                <div className="px-4 py-2 border-b border-slate-200 bg-white text-[10px] text-slate-400 font-semibold font-mono flex items-center justify-between shrink-0">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400" /> 
                    Shift Task Audits
                    {activeTask.chat.length - selectedTaskInitialReadCount > 0 && (
                      <span className="ml-1.5 bg-slate-800 text-white font-semibold text-[8px] px-1.5 py-0.5 rounded-full flex items-center justify-center shadow-xs animate-pulse font-sans">
                        {activeTask.chat.length - selectedTaskInitialReadCount} NEW
                      </span>
                    )}
                  </span>
                  <span>Coordinators Only</span>
                </div>

                {/* Chat Feed */}
                <div className="flex-1 p-4 space-y-3.5 overflow-y-auto">
                  {activeTask.chat.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-slate-400">
                      <MessageSquare className="w-8 h-8 text-slate-300" />
                      <p className="text-xs font-medium text-slate-700">Audit Chat is Empty</p>
                      <p className="text-[10px] text-slate-500 max-w-[200px]">Logs shift status updates and comments here.</p>
                    </div>
                  ) : (
                    activeTask.chat.map((m) => {
                      const mySelf = m.userId === activeUser.id;
                      return (
                        <div key={m.id} className={`flex flex-col max-w-[85%] ${mySelf ? "ml-auto items-end" : "mr-auto items-start"}`}>
                          <div className="flex items-center gap-1 mb-0.5 text-[9px] text-slate-400 font-mono">
                            <span className="font-medium">{m.senderName.split(" ")[0]}</span>
                            <span className="text-[8px] bg-slate-200 text-slate-600 px-1 rounded tracking-wide">{m.senderRole}</span>
                            <span>•</span>
                            <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className={`p-3 rounded-2xl text-sm leading-relaxed font-semibold shadow-xs ${
                            mySelf 
                              ? "bg-slate-900 text-slate-100 rounded-tr-none" 
                              : "bg-white text-slate-800 border border-slate-100 rounded-tl-none"
                          }`}>
                            {m.message}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Chat Input form */}
                <form 
                  onSubmit={handleSendChatMessage}
                  className="p-3 bg-white border-t border-slate-200 flex gap-2"
                >
                  <input
                    type="text"
                    placeholder="Comment on task status..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-900 text-white font-medium text-xs rounded-xl cursor-pointer hover:bg-[#203D60] transition-colors"
                  >
                    Send
                  </button>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}

      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white hover:text-slate-350 p-2 bg-slate-800/50 rounded-full transition-colors cursor-pointer"
            onClick={() => setLightboxImage(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={lightboxImage} 
            alt="Task Zoomed View" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-xl"
          />
        </div>
      )}
    </div>
  );
}
