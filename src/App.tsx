/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { BrowserRouter, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  Bell, 
  Settings, 
  HelpCircle, 
  AlertTriangle, 
  CheckSquare, 
  Building2,
  RefreshCw,
  LogOut,
  Menu,
  Layers,
  Megaphone,
  ClipboardCheck,
  MessageSquare,
  BookOpen,
  MessageCircle
} from "lucide-react";

import { store } from "./services/store";
import { Client, Tenant, User as AppUser, Role, Department } from "./types";
import { listenForSWNavigation } from "./services/fcmService";

import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import NoticesWorkflows from "./components/NoticesWorkflows";
import ChecklistsWorkflows from "./components/ChecklistsWorkflows";
import TaskManagerWorkflows from "./components/TaskManagerWorkflows";
import HoraeAdminPanel from "./components/HoraeAdminPanel";
import Quizzes from "./components/Quizzes";
import SOPs from "./components/SOPs";
import ClientAdminPanel from "./components/ClientAdminPanel";
import Login from "./components/Login";
import NotificationPermissionBanner from "./components/NotificationPermissionBanner";
import TeamTalk from "./components/TeamTalk";


/** Single row in the notifications dropdown — swipe left/right to dismiss, tap to open + mark read. */
function NotificationRow({
  notif, onDismiss, onOpen,
}: {
  notif: any;
  onDismiss: () => void;
  onOpen: () => void;
}) {
  const [dragX, setDragX] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const DISMISS_THRESHOLD = 80;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    setDragX(e.touches[0].clientX - touchStartX.current);
  };
  const handleTouchEnd = () => {
    if (Math.abs(dragX) > DISMISS_THRESHOLD) {
      onDismiss();
    } else {
      setDragX(0);
    }
    touchStartX.current = null;
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="absolute inset-0 flex items-center justify-between px-3 bg-rose-50 text-rose-500 text-[10px] font-semibold">
        <span>← Swipe to dismiss</span>
        <span>Swipe to dismiss →</span>
      </div>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={onOpen}
        style={{ transform: `translateX(${dragX}px)`, opacity: 1 - Math.min(Math.abs(dragX) / 200, 0.6) }}
        className="relative bg-white text-left border-b border-slate-50/50 pb-2 text-[11px] space-y-0.5 cursor-pointer hover:bg-slate-50 p-1.5 rounded-xl transition-transform"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-slate-800 leading-tight flex-1">{notif.title}</p>
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            className="text-slate-300 hover:text-rose-500 transition-colors cursor-pointer shrink-0 leading-none text-sm"
            title="Dismiss"
          >
            ×
          </button>
        </div>
        <p className="text-slate-500 font-normal leading-normal">{notif.message}</p>
        <p className="text-[9px] text-slate-400 font-mono">
          {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}

function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();

  // ── Deep-link: parse URL on mount to jump to correct tab/item ────────────
  const deepLinkRef = useRef<{ tab: string; itemId?: string } | null>(null);
  useEffect(() => {
    const path = location.pathname;
    const match = (prefix: string) => path.startsWith(prefix)
      ? path.slice(prefix.length).split('/')[0] || undefined
      : undefined;

    if (path.startsWith('/tasks'))        deepLinkRef.current = { tab: 'tasks',      itemId: match('/tasks/') };
    else if (path.startsWith('/notices')) deepLinkRef.current = { tab: 'notices',    itemId: match('/notices/') };
    else if (path.startsWith('/checklists')) deepLinkRef.current = { tab: 'checklists', itemId: match('/checklists/') };
    else if (path.startsWith('/quizzes')) deepLinkRef.current = { tab: 'quizzes',    itemId: match('/quizzes/') };
    else if (path.startsWith('/sops'))    deepLinkRef.current = { tab: 'sops',       itemId: match('/sops/') };
    else if (path.startsWith('/digest'))  deepLinkRef.current = { tab: 'dashboard' };
    // else /dashboard or / — no deep link needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navigation Track — sync with URL
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  // Track which item ID was deep-linked (passed to child components)
  const [deepLinkedItemId, setDeepLinkedItemId] = useState<string | undefined>(undefined);

  const handleSetActiveTab = useCallback((tab: string, itemId?: string) => {
    setActiveTab(tab);
    setDeepLinkedItemId(itemId);
    // Push browser URL to match (enables native back-button navigation)
    const urlMap: Record<string, string> = {
      dashboard: '/dashboard', notices: '/notices', checklists: '/checklists',
      tasks: '/tasks', quizzes: '/quizzes', sops: '/sops', 'admin-panel': '/admin',
      'horae-admin': '/horae-admin', 'checklist-report': '/checklist-report',
      'team-talk': '/teamtalk',
    };
    if (urlMap[tab] && location.pathname !== urlMap[tab]) {
      navigate(urlMap[tab]);
    }
  }, [navigate, location.pathname]);

  // History padding: Ensure PWA back-swipe always goes to dashboard instead of exiting if opened via deep link
  useEffect(() => {
    if (window.history.length <= 1 && location.pathname !== '/dashboard' && location.pathname !== '/' && location.pathname !== '') {
      window.history.replaceState(null, '', '/dashboard');
      window.history.pushState(null, '', location.pathname);
    }
  }, []);

  // Sync state when user presses the browser back button
  useEffect(() => {
    const path = location.pathname;
    const pathParts = path.split('/');
    const mainRoute = '/' + (pathParts[1] || 'dashboard');
    const itemId = pathParts[2] || undefined;
    
    const reverseMap: Record<string, string> = {
      '/dashboard': 'dashboard', '/notices': 'notices', '/checklists': 'checklists',
      '/tasks': 'tasks', '/quizzes': 'quizzes', '/sops': 'sops', '/admin': 'admin-panel',
      '/horae-admin': 'horae-admin', '/checklist-report': 'checklist-report',
      '/teamtalk': 'team-talk',
    };
    
    const targetTab = reverseMap[mainRoute];
    if (targetTab && targetTab !== activeTab) {
      setActiveTab(targetTab);
      setDeepLinkedItemId(itemId);
    }
  }, [location.pathname, activeTab]);

  const handleBack = useCallback(() => {
    handleSetActiveTab('dashboard');
  }, [handleSetActiveTab]);


  // Authentication Track
  const [loggedInEmail, setLoggedInEmail] = useState<string | null>(store.getLoggedInEmail());
  
  // Simulated React States (Injected from abstracted Store)
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [tenantUsers, setTenantUsers] = useState<AppUser[]>([]);
  const [activeUser, setActiveUser] = useState<AppUser | null>(null);
  
  const [notices, setNotices] = useState<any[]>([]);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<any[]>([]);
  const [sops, setSops] = useState<any[]>([]);
  const [sopReadStatuses, setSopReadStatuses] = useState<any[]>([]);
  const [chatUnreadCount, setChatUnreadCount] = useState<number>(0);

  const isTrialExpired = activeClient?.plan === "Free" && (() => {
    if (!activeClient.createdAt) return false;
    const createdTime = new Date(activeClient.createdAt).getTime();
    const elapsedMs = Date.now() - createdTime;
    const trialDurationMs = 15 * 24 * 60 * 60 * 1000;
    return elapsedMs > trialDurationMs;
  })();
  
  // Loading state
  const [loading, setLoading] = useState<boolean>(true);
  
  // Mobile responsive sidebar open/close state
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Notification alert state
  const [newAlertMessage, setNewAlertMessage] = useState<string>("");
  const [showNotificationDropdown, setShowNotificationDropdown] = useState<boolean>(false);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>(() => {
    try {
      const val = localStorage.getItem(`horae_dismissed_notifications_${activeUser?.id ?? ''}`);
      return val ? JSON.parse(val) : [];
    } catch { return []; }
  });
  useEffect(() => {
    if (!activeUser) return;
    try {
      const val = localStorage.getItem(`horae_dismissed_notifications_${activeUser.id}`);
      setDismissedNotificationIds(val ? JSON.parse(val) : []);
    } catch { setDismissedNotificationIds([]); }
  }, [activeUser?.id]);
  const dismissNotification = (id: string) => {
    setDismissedNotificationIds(prev => {
      const next = [...prev, id];
      if (activeUser) localStorage.setItem(`horae_dismissed_notifications_${activeUser.id}`, JSON.stringify(next));
      return next;
    });
  };
  const visibleNotifications = notifications.filter(n => !dismissedNotificationIds.includes(n.id));

  // Load and refresh state triggers
  const refreshLocalState = async () => {
    try {
      const [
        clientsList,
        activeClientObj,
        allTenantsList,
        allUsersList,
        tenantObj,
        userObj
      ] = await Promise.all([
        store.getAllClients(),
        store.getActiveClient(),
        store.getAllTenants(),
        store.getAllUsers(),
        store.getActiveTenant(),
        store.getActiveUser()
      ]);

      const [
        filteredTenants,
        matchedUsers,
        noticesList,
        checklistsList,
        tasksList,
        notificationsList
      ] = await Promise.all([
        store.getTenantsByClient(activeClientObj.id),
        store.getTenantUsers(),
        store.getNotices(),
        store.getChecklists(),
        store.getTasks(),
        store.getNotifications()
      ]);

      setClients(clientsList);
      setActiveClient(activeClientObj);
      setAllTenants(allTenantsList);
      setAllUsers(allUsersList);
      setTenants(filteredTenants);
      setActiveTenant(tenantObj);
      setTenantUsers(matchedUsers);
      setActiveUser(userObj);

      // Load Database Synced Quiz and SOP modules
      const quizzesList = await store.getQuizzes();
      const attemptsList = await store.getQuizAttempts();
      const sopsList = await store.getSOPs();
      const readStatusesList = await store.getSOPReadStatuses();
      
      // Fetch unread channels and threads
      const { getChannels, getAllChannels, getUnreadThreads } = await import('./services/chatService');
      const isManager = [Role.ADMIN, Role.MANAGER, Role.SUPER_ADMIN, 'Admin', 'Manager', 'Super Admin'].includes(userObj.role as any);
      
      const clientOutletIds = filteredTenants.map(t => t.id);
      const [channels, unreadThreads] = await Promise.all([
        isManager ? getAllChannels(clientOutletIds, userObj.id) : getChannels(tenantObj.id, userObj.id),
        getUnreadThreads(tenantObj.id, userObj.id)
      ]);
      
      const unreadCount = channels.reduce((acc, ch) => acc + (ch.unreadCount ?? 0), 0) + 
                          unreadThreads.reduce((acc, t) => acc + (t.unreadReplyCount ?? 1), 0);
      setChatUnreadCount(unreadCount);

      setQuizzes(quizzesList);
      setQuizAttempts(attemptsList);
      setSops(sopsList);
      setSopReadStatuses(readStatusesList);

      if (userObj.role === Role.SUPER_ADMIN) {
        handleSetActiveTab("horae-admin");
      } else if (activeTab === "horae-admin") {
        handleSetActiveTab("dashboard");
      } else if (userObj.role !== Role.ADMIN && (activeTab === "checklist-report" || activeTab === "admin-panel")) {
        handleSetActiveTab("dashboard");
      }

      setNotices(noticesList);
      setChecklists(checklistsList);
      setTasks(tasksList);
      setNotifications(notificationsList);
    } catch (error) {
      console.error("Failed to refresh state from database:", error);
    } finally {
      setLoading(false);
    }
  };

  // Initial load & real-time sync subscription
  useEffect(() => {
    refreshLocalState();

    const unsubscribe = store.subscribeToChanges(() => {
      refreshLocalState();
    });

    return () => {
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll for chat unread counts to keep sidebar updated
  useEffect(() => {
    if (!activeUser || !activeTenant) return;
    const fetchUnread = () => {
      import('./services/chatService').then(({ getChannels, getAllChannels, getUnreadThreads }) => {
        const isManager = [Role.ADMIN, Role.MANAGER, Role.SUPER_ADMIN, 'Admin', 'Manager', 'Super Admin'].includes(activeUser.role as any);
        const channelsPromise = isManager
          ? getAllChannels(tenants.map(t => t.id), activeUser.id)
          : getChannels(activeUser.tenantId, activeUser.id);
          
        Promise.all([
          channelsPromise,
          getUnreadThreads(activeUser.tenantId, activeUser.id)
        ]).then(([channels, unreadThreads]) => {
          const count = channels.reduce((acc, ch) => acc + (ch.unreadCount ?? 0), 0) + 
            unreadThreads.reduce((acc, t) => acc + (t.unreadReplyCount ?? 1), 0);
          setChatUnreadCount(count);
        }).catch(() => {});
      });
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [activeUser, activeTenant, tenants]);

  // ── Apply deep link once data is loaded ───────────────────────────────────
  useEffect(() => {
    if (!loading && deepLinkRef.current) {
      const { tab, itemId } = deepLinkRef.current;
      handleSetActiveTab(tab, itemId);
      deepLinkRef.current = null;
    }
  }, [loading, handleSetActiveTab]);

  // ── SW Navigation listener (for when app is already open + notification tapped) ─
  useEffect(() => {
    const unsubSW = listenForSWNavigation((url) => {
      const path = new URL(url, window.location.origin).pathname;
      if (path.startsWith('/tasks'))        handleSetActiveTab('tasks',      path.split('/')[2]);
      else if (path.startsWith('/notices')) handleSetActiveTab('notices',    path.split('/')[2]);
      else if (path.startsWith('/checklists')) handleSetActiveTab('checklists', path.split('/')[2]);
      else if (path.startsWith('/quizzes')) handleSetActiveTab('quizzes',    path.split('/')[2]);
      else                                  handleSetActiveTab('dashboard');
    });
    return unsubSW;
  }, [handleSetActiveTab]);

  // ── Last-seen heartbeat (for anti-spam: skip WhatsApp if user is online) ─
  useEffect(() => {
    if (!activeUser) return;
    const tick = () => store.touchLastSeen(activeUser.id);
    tick(); // immediate on login
    const interval = setInterval(tick, 5 * 60 * 1000); // every 5 minutes
    return () => clearInterval(interval);
  }, [activeUser?.id]);

  const handleSelectClient = async (clientId: string) => {
    setLoading(true);
    await store.setActiveClient(clientId);
    await refreshLocalState();
    handleSetActiveTab("dashboard");
    triggerToast("Switched active Brand Client!");
  };

  const handleAddClient = async (id: string, name: string, logo: string, plan: "Free" | "Essential" | "Pro" | "Enterprise", services: string[]) => {
    await store.addClient(id, name, logo, plan);
    store.saveClientServices(id, services);
    await refreshLocalState();
  };

  const handleUpdateClient = async (id: string, name: string, logo: string, plan: "Free" | "Essential" | "Pro" | "Enterprise", services: string[]) => {
    await store.updateClient(id, name, logo, plan);
    store.saveClientServices(id, services);
    await refreshLocalState();
  };

  const handleDeleteClient = async (id: string) => {
    await store.deleteClient(id);
    await refreshLocalState();
  };

  const handleLogout = () => {
    store.logout();
    setLoggedInEmail(null);
    setActiveUser(null);
    setActiveClient(null);
    setActiveTenant(null);
    triggerToast("Logged out successfully.");
  };

  const handleAddTenant = async (clientId: string, name: string, subdomain: string, logo: string, plan: "Free" | "Essential" | "Pro" | "Enterprise") => {
    const newTenant = await store.addTenant(clientId, name, subdomain, logo, plan);

    // Auto-generate the Outlet room in Team Talk and make sure every client
    // admin (not just whoever clicked "Add Outlet") is already a member of it.
    if (activeUser) {
      try {
        const { ensureOutletChannelsForClient } = await import('./services/chatService');
        const clientOutletIds = [...allTenants.filter(t => t.clientId === clientId).map(t => t.id), newTenant.id];
        const clientUsers = allUsers.filter(u => clientOutletIds.includes(u.tenantId));
        const adminUserIds = clientUsers
          .filter(u => u.role === Role.ADMIN || u.role === Role.SUPER_ADMIN)
          .map(u => u.id);
        await ensureOutletChannelsForClient(clientId, clientOutletIds, clientUsers, adminUserIds, activeUser.id);
      } catch (e) {
        console.error("Failed to auto-create outlet room:", e);
      }
    }

    await refreshLocalState();
  };

  const handleOnboardStaff = async (tenantId: string, name: string, email: string, role: Role, department: Department, avatar: string, phoneNumber?: string, whatsappOptedIn?: boolean) => {
    await store.onboardingUser(tenantId, name, email, role, department, avatar, phoneNumber, whatsappOptedIn);
    await refreshLocalState();
  };

  // Set selected Tenant and automatically sync Persona user
  const handleSelectTenant = async (tenantId: string) => {
    setLoading(true);
    await store.setActiveTenant(tenantId);
    await refreshLocalState();
    handleSetActiveTab("dashboard");
    triggerToast("Switched Tenant Workspace!");
  };

  const handleSelectUser = async (userId: string) => {
    setLoading(true);
    await store.setActiveUser(userId);
    await refreshLocalState();
    triggerToast("Acting Persona changed!");
  };

  // Trigger non-intrusive alert toast for operational actions
  const triggerToast = (msg: string) => {
    setNewAlertMessage(msg);
    setTimeout(() => {
      setNewAlertMessage("");
    }, 4500);
  };

  // Post notice handler
  const handlePostNotice = async (title: string, content: string, dept: Department | string, role: Role | string, isUrgent: boolean, tenantId: string, subject?: string) => {
    await store.addNotice(title, content, dept, role, isUrgent, tenantId, subject);
    await refreshLocalState();
    triggerToast("New Operational Notice published successfully!");
  };

  const handleDeleteNotice = async (id: string) => {
    await store.deleteNotice(id);
    await refreshLocalState();
    triggerToast("Announcement removed.");
  };

  // Checklist Actions
  const handleCreateChecklist = async (
    title: string, 
    description: string, 
    dept: Department | string, 
    role: Role | string, 
    items: string[], 
    tenantId: string, 
    recurrence?: string, 
    recurrenceDay?: string, 
    attachment?: string,
    customInputFields?: string[],
    sections?: any[],
    type?: "single" | "yes_no",
    adminNotes?: string,
    groupId?: string
  ) => {
    await store.createChecklist(title, description, dept, role, items, tenantId, recurrence, recurrenceDay, attachment, customInputFields, sections, type, adminNotes, groupId);
    await refreshLocalState();
    triggerToast("New standard compliance routine deployed to shift!");
  };

  const handleUpdateChecklist = async (
    id: string,
    title: string, 
    description: string, 
    dept: Department | string, 
    role: Role | string, 
    items: string[], 
    tenantId: string, 
    recurrence?: string, 
    recurrenceDay?: string, 
    attachment?: string,
    customInputFields?: string[],
    sections?: any[],
    type?: "single" | "yes_no",
    adminNotes?: string
  ) => {
    await store.updateChecklist(id, title, description, dept, role, items, tenantId, recurrence, recurrenceDay, attachment, customInputFields, sections, type, adminNotes);
    await refreshLocalState();
    triggerToast("Compliance routine updated successfully!");
  };

  const handleToggleChecklistItem = async (checklistId: string, itemId: string) => {
    await store.toggleChecklistItem(checklistId, itemId);
    await refreshLocalState();
  };

  const handleSubmitChecklist = async (checklistId: string, itemStates: { [itemId: string]: boolean }, customInputs?: { [fieldName: string]: string }) => {
    await store.submitChecklist(checklistId, itemStates, customInputs);
    await refreshLocalState();
    triggerToast("Compliance routine recorded successfully!");
  };

  const handleCreateQuiz = async (title: string, description: string, dept: Department | string, role: Role | string, questions: any[], tenantId: string) => {
    await store.addQuiz(title, description, dept, role, questions, tenantId);
    await refreshLocalState();
    triggerToast("New knowledge assessment published!");
  };

  const handleDeleteQuiz = async (id: string) => {
    await store.deleteQuiz(id);
    await refreshLocalState();
    triggerToast("Quiz assessment deleted.");
  };

  const handleSubmitQuizAttempt = async (quizId: string, quizTitle: string, score: number, totalQuestions: number, answers: number[]) => {
    await store.submitQuizAttempt(quizId, quizTitle, score, totalQuestions, answers);
    await refreshLocalState();
    triggerToast("Quiz results logged successfully.");
  };

  const handleCreateSOP = async (title: string, description: string, category: string, dept: Department | string, role: Role | string, content: string, fileUrl: string, tenantId: string) => {
    await store.addSOP(title, description, category, dept, role, content, fileUrl, tenantId);
    await refreshLocalState();
    triggerToast("New standard operating procedure published!");
  };

  const handleDeleteSOP = async (id: string) => {
    await store.deleteSOP(id);
    await refreshLocalState();
    triggerToast("SOP document removed.");
  };

  const handleMarkSOPAsRead = async (sopId: string, sopTitle: string) => {
    await store.markSOPAsRead(sopId, sopTitle);
    await refreshLocalState();
    triggerToast("SOP read receipt logged.");
  };

  const handleDeleteChecklist = async (id: string) => {
    await store.deleteChecklist(id);
    await refreshLocalState();
    triggerToast("Compliance routine deleted.");
  };

  // Task Manager Actions
  const handleAddTask = async (title: string, description: string, priority: string, dueDate: string, assignedUserIds: string[], tenantId: string, channelId?: string, msgId?: string): Promise<string> => {
    const task = await store.addTask(title, description, priority, dueDate, assignedUserIds, tenantId, channelId, msgId);
    await refreshLocalState();
    triggerToast("Operational task designated successfully.");
    return task.id;
  };

  const handleUpdateTaskStatus = async (taskId: string, status: "Assigned" | "In Progress" | "Pending" | "On Hold" | "Completed" | "Closed") => {
    // Optimistic update
    setTasks(prevTasks => prevTasks.map(t => t.id === taskId ? { ...t, status } : t));
    
    // Background update
    store.updateTaskStatus(taskId, status).then(() => {
      refreshLocalState();
    }).catch(err => {
      console.error("Failed to update task status:", err);
      // Revert on error by refreshing state
      refreshLocalState();
    });
  };

  const handleUpdateTaskPriority = async (taskId: string, priority: string) => {
    await store.updateTaskPriority(taskId, priority);
    await refreshLocalState();
    triggerToast("Task priority updated.");
  };

  const handleSendReminder = async (taskId: string) => {
    await store.sendTaskReminder(taskId);
    await refreshLocalState();
    triggerToast("Task reminder sent successfully!");
  };

  const handleUrgentTaskNotify = async (taskId: string) => {
    try {
      await store.sendUrgentWhatsAppPush("task", taskId);
      triggerToast("Sent to staff on WhatsApp.");
    } catch (err: any) {
      console.error("Urgent WhatsApp push failed:", err);
      triggerToast("Failed to send WhatsApp notification: " + (err?.message || "unknown error"));
    }
  };

  const handleUrgentNoticeNotify = async (noticeId: string) => {
    try {
      await store.sendUrgentWhatsAppPush("notice", noticeId);
      triggerToast("Sent to staff on WhatsApp.");
    } catch (err: any) {
      console.error("Urgent WhatsApp push failed:", err);
      triggerToast("Failed to send WhatsApp notification: " + (err?.message || "unknown error"));
    }
  };

  const handleAddMessage = async (taskId: string, message: string) => {
    await store.addTaskChatMessage(taskId, message);
    await refreshLocalState();
  };

  const handleDeleteTask = async (taskId: string) => {
    await store.deleteTask(taskId);
    await refreshLocalState();
    triggerToast("Task deleted.");
  };

  // Outlet & Staff CRUD Callbacks
  const handleUpdateTenant = async (tenantId: string, name: string, subdomain: string, logo: string, plan: "Free" | "Essential" | "Pro" | "Enterprise") => {
    await store.updateTenant(tenantId, name, subdomain, logo, plan);
    await refreshLocalState();
    triggerToast("Outlet workspace updated.");
  };

  const handleDeleteTenant = async (tenantId: string) => {
    await store.deleteTenant(tenantId);
    await refreshLocalState();
    triggerToast("Outlet workspace deleted.");
  };

  const handleUpdateUser = async (userId: string, name: string, email: string, role: string, department: string) => {
    await store.updateUser(userId, name, email, role, department);
    await refreshLocalState();
    triggerToast("Staff user updated.");
  };

  const handleDeleteUser = async (userId: string) => {
    await store.deleteUser(userId);
    await refreshLocalState();
    triggerToast("Staff user deleted.");
  };

  const handleResetWorkspaceData = async () => {
    if (confirm("Are you sure you want to reset all local database state to default demo sets?")) {
      store.resetAllData();
      await refreshLocalState();
      handleSetActiveTab("dashboard");
      triggerToast("Local database reset to seed conditions.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#162D4E] flex items-center justify-center text-slate-200 font-sans p-6" id="app-loading-gate">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-[#C5A880]" />
          <p className="text-xs font-mono font-medium tracking-wider text-[#C5A880]/80">Loading Client Gateway...</p>
        </div>
      </div>
    );
  }

  if (!loggedInEmail) {
    return (
      <>
        <Login
          onLoginSuccess={async (usr) => {
            setLoggedInEmail(usr.email);
            await refreshLocalState();
            // Request FCM permission immediately after login
            if ('Notification' in window && Notification.permission === 'default') {
              setTimeout(() => {
                // Show banner after 1s to let the app settle
              }, 1000);
            }
          }}
        />
        {/* Login-time FCM permission banner — shown 1s after Login component renders */}
        {/* We'll show it once app loads after login */}
      </>
    );
  }

  if (clients.length === 0 || !activeTenant || !activeUser) {
    return (
      <div className="min-h-screen bg-[#162D4E] flex items-center justify-center text-slate-200 font-sans p-6" id="app-setup-gate">
        <div className="max-w-md w-full bg-white text-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6 border border-slate-100">
          <img 
            src="/horae-logo.jpg" 
            alt="Horae Logo" 
            className="h-16 w-auto object-contain mx-auto bg-white p-2 rounded-2xl border border-slate-100 shadow-inner" 
          />
          <div className="space-y-2">
            <h2 className="text-2xl font-medium tracking-tight text-[#162D4E]">Setup Horae Database</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Your database connection is active, but your tables do not contain any clients, outlets, or user personas.
            </p>
          </div>

          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/50 text-left space-y-2">
            <p className="text-[11px] font-medium text-amber-800 tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Database Policies Required
            </p>
            <p className="text-xs text-amber-700 leading-relaxed font-medium">
              Important: You must configure a Row Level Security (RLS) policy in Supabase that permits inserts/selects, or temporarily disable RLS, otherwise initialization inserts will fail.
            </p>
          </div>

          <button
            onClick={async () => {
              setLoading(true);
              try {
                await store.seedDatabase();
                await refreshLocalState();
              } catch (err: any) {
                console.error("Seed error:", err);
                alert("Failed to seed database.\n\nError: " + (err.message || JSON.stringify(err)) + "\n\nTip: Run 'create policy \"Allow all\" on clients for all using (true) with check (true);' in your Supabase SQL Editor for all tables!");
                setLoading(false);
              }
            }}
            className="w-full py-3.5 px-6 bg-[#162D4E] hover:bg-[#162D4E]/90 text-white font-semibold rounded-2xl transition-all shadow-lg hover:shadow-xl cursor-pointer"
          >
            Seed Default Clients & Users
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-800 font-sans overflow-hidden" id="horae-portal">

      {/* FCM push permission banner — login variant shown once after login */}
      {activeUser && loggedInEmail && (
        <NotificationPermissionBanner
          userId={activeUser.id}
          variant="login"
          onPermissionGranted={(token) => {
            store.updateUserFCMToken(activeUser.id, token);
          }}
        />
      )}

      {/* FCM reminder banner — appears after 60s if permission not yet granted */}
      {activeUser && loggedInEmail && (
        <NotificationPermissionBanner
          userId={activeUser.id}
          variant="reminder"
          onPermissionGranted={(token) => {
            store.updateUserFCMToken(activeUser.id, token);
          }}
        />
      )}

      {/* SIDEBAR COMPONENT */}
      <Sidebar
        clients={clients}
        activeClient={activeClient || clients[0]}
        onSelectClient={handleSelectClient}
        tenants={tenants}
        activeTenant={activeTenant || tenants[0]}
        onSelectTenant={handleSelectTenant}
        tenantUsers={tenantUsers}
        activeUser={activeUser}
        onSelectUser={handleSelectUser}
        activeTab={activeTab}
        onSelectTab={(tab) => handleSetActiveTab(tab)}
        notificationsCount={notifications.length}
        chatUnreadCount={chatUnreadCount}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        allUsers={allUsers}
        allTenants={allTenants}
        loggedInEmail={loggedInEmail}
        onLogout={handleLogout}
      />

      {/* MAIN VIEWPORT CARRIER */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden" id="main-viewport">
        
        {/* Super Admin Impersonation Indicator Banner */}
        {loggedInEmail === 'coderookie84@gmail.com' && activeUser.id !== 'user-superadmin' && (
          <div className="bg-indigo-600 text-white px-4 py-2.5 flex items-center justify-between text-xs font-medium shrink-0 shadow-md animate-fade-in" id="impersonation-warning-banner">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>
                Impersonation Active: Viewing workspace as <strong>{activeUser.name} ({activeUser.role})</strong> under <strong>{activeClient?.name}</strong>.
              </span>
            </span>
            <button
              onClick={() => handleSelectUser('user-superadmin')}
              className="bg-white text-indigo-700 px-3 py-1 rounded-lg hover:bg-slate-100 font-medium active:scale-95 transition-all cursor-pointer text-[10px] tracking-wide shrink-0"
            >
              Exit Workspace
            </button>
          </div>
        )}

        {/* TOP STATUS BAR BAR */}
        {activeTab !== 'team-talk' && (
        <header className="bg-white border-b border-slate-100 px-4 py-3 md:px-8 md:py-4 flex items-center justify-between shrink-0" id="top-navbar">
          <div className="flex items-center gap-3">
            {/* Hamburger Menu Toggle */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-1.5 -ml-1 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Real-time Toast Notifications Box */}
            <AnimatePresence>
              {newAlertMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="bg-slate-900 text-amber-400 font-medium font-mono text-[10px] px-3 py-1.5 rounded-lg border border-slate-800 shadow-sm flex items-center gap-2 max-w-sm truncate"
                  id="system-banner-alerts"
                >
                  <span className="inline-block w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
                  {newAlertMessage}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Custom Interactive Notifications Bell icon */}
            <div className="relative">
              <button
                id="btn-notifications-dropdown"
                onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all relative cursor-pointer"
              >
                <Bell className="w-5 h-5" />
                {visibleNotifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
                )}
              </button>

              {/* Bullet Notifications Feed Dropdown */}
              {showNotificationDropdown && (
                <div
                  className="absolute right-0 mt-2.5 w-80 bg-white border border-slate-150 rounded-2xl shadow-xl z-50 p-4 space-y-3.5"
                  id="notifications-dropdown-menu"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="text-xs font-medium text-slate-800 flex items-center gap-1">
                      <Bell className="w-3.5 h-3.5 text-amber-500" />
                      Dynamic Horae Alerts
                    </h4>
                    <span className="text-[9px] font-mono text-slate-400 font-medium uppercase">
                      {visibleNotifications.length} Shift Messages
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1" id="notifications-dropdown-feed">
                    {visibleNotifications.length === 0 ? (
                      <p className="text-[11px] text-slate-400 py-4 text-center">Clear notification queue!</p>
                    ) : (
                      visibleNotifications.map(notif => (
                        <NotificationRow
                          key={notif.id}
                          notif={notif}
                          onDismiss={() => dismissNotification(notif.id)}
                          onOpen={() => {
                            setShowNotificationDropdown(false);
                            dismissNotification(notif.id);
                            if (notif.category === "notice") {
                              handleSetActiveTab("dashboard");
                              setTimeout(() => {
                                document.getElementById("dashboard-notices-panel")?.scrollIntoView({ behavior: 'smooth' });
                              }, 150);
                            } else if (notif.category === "task") {
                              handleSetActiveTab("tasks");
                            } else if (notif.category === "checklist") {
                              handleSetActiveTab("checklists");
                            } else if (notif.category === "quiz") {
                              handleSetActiveTab("dashboard");
                              setTimeout(() => {
                                document.getElementById("dashboard-quizzes-panel")?.scrollIntoView({ behavior: 'smooth' });
                              }, 150);
                            }
                          }}
                        />
                      ))
                    )}
                  </div>

                  <button
                    onClick={() => setShowNotificationDropdown(false)}
                    className="w-full text-center text-[10px] text-slate-500 hover:text-slate-800 font-semibold pt-1 block border-t border-slate-50"
                  >
                    Close Panel
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        )}

        {/* CONTAINER SHEATH WITH SCROLLING INTERNAL COLUMN */}
        <main className={`flex-1 overflow-y-auto ${activeTab === 'team-talk' ? 'bg-white p-0' : 'bg-[#F1F5F9] p-4 md:p-5 lg:p-6'}`} id="scrolling-main-box">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className={`h-full ${activeTab === 'team-talk' ? 'w-full' : 'max-w-7xl mx-auto'}`}
            >
              {/* Tab routing mappings */}
              {isTrialExpired && activeUser.role !== Role.SUPER_ADMIN ? (
                <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center max-w-2xl mx-auto bg-white rounded-3xl border border-slate-200/80 shadow-md space-y-6 my-4">
                  <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 text-3xl shadow-sm animate-pulse">
                    ⏳
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-medium text-slate-800 tracking-tight">Free Trial Expired</h2>
                    <p className="text-slate-500 text-sm leading-relaxed">
                      Your 15-day free trial of the Horae Operations Portal has concluded. To continue using the portal's compliance, tasks, and notification services, please upgrade your subscription.
                    </p>
                  </div>

                  {/* Pricing/Plan Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full pt-4">
                    {/* Essential Card */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs text-left flex flex-col justify-between hover:border-indigo-500 transition-all">
                      <div className="space-y-2">
                        <span className="text-[9px] font-medium tracking-wider uppercase text-indigo-650 bg-indigo-50 px-2 py-0.5 rounded">Essential</span>
                        <h3 className="text-sm font-medium text-slate-800">Tasks + Notices</h3>
                        <ul className="text-[10px] text-slate-500 space-y-1 pt-2">
                          <li>• Task management</li>
                          <li>• Notices & announcements</li>
                          <li>• Basic communications</li>
                        </ul>
                      </div>
                      {activeUser.role === Role.ADMIN ? (
                        <button 
                          onClick={async () => {
                            if (activeClient) {
                              await store.updateClient(activeClient.id, activeClient.name, activeClient.logo, "Essential");
                              await refreshLocalState();
                              triggerToast("Brand upgraded to Essential Plan!");
                            }
                          }}
                          className="mt-4 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl cursor-pointer shadow-sm text-center"
                        >
                          Upgrade Essential
                        </button>
                      ) : (
                        <p className="text-[9px] text-slate-400 mt-4 text-center font-medium">Contact admin to upgrade</p>
                      )}
                    </div>

                    {/* Pro Card */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm text-left flex flex-col justify-between hover:border-indigo-500 transition-all relative overflow-hidden">
                      <div className="space-y-2">
                        <span className="text-[9px] font-medium tracking-wider uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Pro</span>
                        <h3 className="text-sm font-medium text-slate-800">Tasks+Notices+Quiz+SOP</h3>
                        <ul className="text-[10px] text-slate-500 space-y-1 pt-2">
                          <li>• All Essential features</li>
                          <li>• Knowledge quizzes</li>
                          <li>• SOP Documentation</li>
                        </ul>
                      </div>
                      {activeUser.role === Role.ADMIN ? (
                        <button 
                          onClick={async () => {
                            if (activeClient) {
                              await store.updateClient(activeClient.id, activeClient.name, activeClient.logo, "Pro");
                              await refreshLocalState();
                              triggerToast("Brand upgraded to Pro Plan!");
                            }
                          }}
                          className="mt-4 w-full py-2 bg-[#162D4E] hover:bg-[#162D4E]/90 text-[#C5A880] font-medium text-xs rounded-xl cursor-pointer shadow-sm text-center"
                        >
                          Upgrade Pro
                        </button>
                      ) : (
                        <p className="text-[9px] text-slate-400 mt-4 text-center font-medium">Contact admin to upgrade</p>
                      )}
                    </div>

                    {/* Enterprise Card */}
                    <div className="bg-white border border-indigo-200 rounded-2xl p-4 shadow-sm text-left flex flex-col justify-between hover:border-indigo-500 transition-all relative">
                      <div className="absolute top-2 right-2 text-[8px] bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.5 rounded uppercase">Full Suite</div>
                      <div className="space-y-2">
                        <span className="text-[9px] font-medium tracking-wider uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Enterprise</span>
                        <h3 className="text-sm font-medium text-slate-800">Checklists + All</h3>
                        <ul className="text-[10px] text-slate-500 space-y-1 pt-2">
                          <li>• All Pro features</li>
                          <li>• Compliance Checklists</li>
                          <li>• Audit history & CSV</li>
                        </ul>
                      </div>
                      {activeUser.role === Role.ADMIN ? (
                        <button 
                          onClick={async () => {
                            if (activeClient) {
                              await store.updateClient(activeClient.id, activeClient.name, activeClient.logo, "Enterprise");
                              await refreshLocalState();
                              triggerToast("Brand upgraded to Enterprise Plan!");
                            }
                          }}
                          className="mt-4 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl cursor-pointer shadow-sm text-center"
                        >
                          Upgrade Enterprise
                        </button>
                      ) : (
                        <p className="text-[9px] text-slate-400 mt-4 text-center font-medium">Contact admin to upgrade</p>
                      )}
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 font-medium">
                    Need custom pricing? Contact our team at <a href="mailto:support@horae.ops" className="text-indigo-600 underline">support@horae.ops</a>.
                  </div>
                </div>
              ) : activeUser.role === Role.SUPER_ADMIN ? (
                <HoraeAdminPanel
                  clients={clients}
                  tenants={allTenants}
                  users={allUsers}
                  onAddClient={handleAddClient}
                  onAddTenant={handleAddTenant}
                  onOnboardUser={handleOnboardStaff}
                  onSelectUser={handleSelectUser}
                  onUpdateClient={handleUpdateClient}
                  onDeleteClient={handleDeleteClient}
                  onUpdateTenant={handleUpdateTenant}
                  onDeleteTenant={handleDeleteTenant}
                  onUpdateUser={handleUpdateUser}
                  onDeleteUser={handleDeleteUser}
                />
              ) : (
                <>
                  {activeTab === "dashboard" && (
                    <Dashboard
                      activeTenant={activeTenant}
                      activeUser={activeUser}
                      tenants={tenants}
                      notices={notices}
                      checklists={checklists}
                      tasks={tasks}
                      tenantUsers={tenantUsers}
                      onSubmitChecklist={handleSubmitChecklist}
                      onNavigate={handleSetActiveTab}
                      onAddTask={(title, desc, priority, date, assignees) =>
                        handleAddTask(title, desc, priority, date, assignees, activeUser.tenantId)
                      }
                      quizzes={quizzes}
                      quizAttempts={quizAttempts}
                    />
                  )}

                  {activeTab === "notices" && (
                    <NoticesWorkflows
                      notices={notices}
                      tenants={tenants}
                      activeUser={activeUser}
                      onBack={handleBack}
                      onUrgentNotify={handleUrgentNoticeNotify}
                    />
                  )}

                  {activeTab === "checklists" && (
                  <ChecklistsWorkflows
                      checklists={checklists}
                      tenants={tenants}
                      onSubmitChecklist={handleSubmitChecklist}
                      onBack={handleBack}
                      onRefresh={refreshLocalState}
                    />
                  )}

                  {activeTab === "tasks" && (
                    <TaskManagerWorkflows
                      tasks={tasks}
                      tenantUsers={allUsers}
                      activeUser={activeUser}
                      tenants={tenants}
                      onAddTask={(title, desc, priority, date, assignees) =>
                        handleAddTask(title, desc, priority, date, assignees, activeUser.tenantId)
                      }
                      onUpdateTaskStatus={handleUpdateTaskStatus}
                      onUpdateTaskPriority={handleUpdateTaskPriority}
                      onAddMessage={handleAddMessage}
                      onDeleteTask={handleDeleteTask}
                      onSendReminder={handleSendReminder}
                      onUrgentNotify={handleUrgentTaskNotify}
                      onBack={handleBack}
                    />
                  )}

                  {activeTab === "quizzes" && (
                    <Quizzes
                      quizzes={quizzes}
                      attempts={quizAttempts}
                      activeUser={activeUser}
                      onSubmitAttempt={handleSubmitQuizAttempt}
                      onBack={handleBack}
                    />
                  )}

                  {activeTab === "sops" && (
                    <SOPs
                      sops={sops}
                      readStatuses={sopReadStatuses}
                      activeUser={activeUser}
                      onMarkRead={handleMarkSOPAsRead}
                      onBack={handleBack}
                    />
                  )}

                  {activeTab === "team-talk" && (
                    <TeamTalk
                      activeUser={activeUser}
                      tenantId={activeUser.tenantId}
                      tenants={tenants}
                      allTenantUsers={[Role.SUPER_ADMIN, Role.ADMIN].includes(activeUser.role as Role) ? allUsers : allUsers.filter(u => tenants.map(t => t.id).includes(u.tenantId))}
                      tasks={tasks}
                      onCreateTask={async (title, description, _channelId, _msgId, assigneeIds) => {
                        const targetAssignees = assigneeIds && assigneeIds.length > 0 ? assigneeIds : [activeUser.id];
                        const taskId = await handleAddTask(title, description, 'High', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], targetAssignees, activeUser.tenantId, _channelId, _msgId);
                        return taskId;
                      }}
                      onBack={handleBack}
                    />
                  )}

                  {activeTab === "admin-panel" && activeUser.role === Role.ADMIN && (
                    <ClientAdminPanel
                      allUsers={allUsers}
                      notices={notices}
                      onPostNotice={handlePostNotice}
                      onDeleteNotice={handleDeleteNotice}
                       checklists={checklists}
                       onCreateChecklist={handleCreateChecklist}
                       onUpdateChecklist={handleUpdateChecklist}
                       onSubmitChecklist={handleSubmitChecklist}
                       onDeleteChecklist={handleDeleteChecklist}
                      tasks={tasks}
                      tenantUsers={tenantUsers}
                      tenants={tenants}
                      onAddTask={handleAddTask}
                      onUpdateTaskStatus={handleUpdateTaskStatus}
                      onUpdateTaskPriority={handleUpdateTaskPriority}
                      onAddMessage={handleAddMessage}
                      onDeleteTask={handleDeleteTask}
                      onSendReminder={handleSendReminder}
                      quizzes={quizzes}
                      onCreateQuiz={handleCreateQuiz}
                      onDeleteQuiz={handleDeleteQuiz}
                      quizAttempts={quizAttempts}
                      sops={sops}
                      onCreateSOP={handleCreateSOP}
                      onDeleteSOP={handleDeleteSOP}
                      sopReadStatuses={sopReadStatuses}
                      activeUser={activeUser}
                      activeClient={activeClient || clients[0]}
                      onAddTenant={handleAddTenant}
                      onUpdateTenant={handleUpdateTenant}
                      onDeleteTenant={handleDeleteTenant}
                      onOnboardUser={handleOnboardStaff}
                      onUpdateUser={handleUpdateUser}
                      onDeleteUser={handleDeleteUser}
                      onBack={handleBack}
                    />
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </main>


      </div>

    </div>
  );
}
