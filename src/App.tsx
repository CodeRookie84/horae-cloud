/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
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
import * as plans from "./services/plans";
import { Client, Tenant, User as AppUser, Role, Department } from "./types";
import { listenForSWNavigation } from "./services/fcmService";

import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import NotificationPermissionBanner from "./components/NotificationPermissionBanner";
import * as trainingSvc from "./services/trainingService";

// Lazy-loaded: everything below is one large admin/workflow module that's only
// ever needed once a signed-in user actually opens that specific tab. Statically
// importing all of them made every visitor — including an anonymous one on the
// login screen — download the entire app (1.7MB/438KB gzipped) up front. Each
// becomes its own chunk, fetched only when its tab is first opened.
const NoticesWorkflows = lazy(() => import("./components/NoticesWorkflows"));
const ChecklistsWorkflows = lazy(() => import("./components/ChecklistsWorkflows"));
const TaskManagerWorkflows = lazy(() => import("./components/TaskManagerWorkflows"));
const HoraeAdminPanel = lazy(() => import("./components/HoraeAdminPanel"));
const Quizzes = lazy(() => import("./components/Quizzes"));
const SOPs = lazy(() => import("./components/SOPs"));
const ClientAdminPanel = lazy(() => import("./components/ClientAdminPanel"));
const TeamTalk = lazy(() => import("./components/TeamTalk"));
const SwotCompass = lazy(() => import("./components/swot/SwotCompass"));
const MaintenanceHub = lazy(() => import("./components/maintenance/MaintenanceHub"));
const Training = lazy(() => import("./components/Training"));
const TrainingAdmin = lazy(() => import("./components/TrainingAdmin"));


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

/** Merge a delta batch into an existing list by id (upsert), newest-first. */
function upsertById<T extends { id: string; createdAt?: string }>(prev: T[], delta: T[]): T[] {
  if (delta.length === 0) return prev;
  const byId = new Map(prev.map(x => [x.id, x]));
  for (const d of delta) byId.set(d.id, d);
  return Array.from(byId.values())
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
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
    else if (path.startsWith('/maintenance')) deepLinkRef.current = { tab: 'maintenance' };
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
      'team-talk': '/teamtalk', swot: '/swot', maintenance: '/maintenance', training: '/training',
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
      '/teamtalk': 'team-talk', '/swot': 'swot', '/maintenance': 'maintenance', '/training': 'training',
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
  const [trainings, setTrainings] = useState<any[]>([]);
  const [trainingAttempts, setTrainingAttempts] = useState<any[]>([]);
  const [chatUnreadCount, setChatUnreadCount] = useState<number>(0);

  const isTrialExpired = !!activeClient && plans.isTrialExpired(activeClient.plan, activeClient.createdAt);
  const clientFeatures = activeClient?.services ?? [];
  const hasFeature = (key: string) => clientFeatures.includes(key);

  // The dashboard is only worth showing when the plan grants something it
  // surfaces. A Training-only client has an empty dashboard, so Training becomes
  // their landing page and the Dashboard tab is hidden.
  const DASHBOARD_FEATURES = ["tasks", "teamtalk", "notices", "checklists", "quizzes"];
  const dashboardMeaningful = clientFeatures.some(f => DASHBOARD_FEATURES.includes(f));
  const homeTab = dashboardMeaningful ? "dashboard"
    : clientFeatures.includes("training") ? "training"
    : "dashboard";
  // The tab actually rendered. When the plan has no dashboard, "dashboard"
  // resolves to the home tab SYNCHRONOUSLY here — so the dashboard never paints
  // and there's no reactive redirect bouncing between the two (which flickered).
  const effectiveTab = (activeTab === "dashboard" && !dashboardMeaningful) ? homeTab : activeTab;
  // "Back to Dashboard" only makes sense when there IS a dashboard — for a
  // Training-only plan it silently no-oped (handleBack set activeTab to
  // "dashboard", but effectiveTab resolved right back to "training", so the
  // button looked broken). Pass undefined to hide the button entirely instead.
  const backToDashboard = dashboardMeaningful ? handleBack : undefined;
  
  // Loading state
  const [loading, setLoading] = useState<boolean>(true);
  
  // Mobile responsive sidebar open/close state
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Notification alert state
  const [newAlertMessage, setNewAlertMessage] = useState<string>("");
  const seenNotifIdsRef = useRef<Set<string> | null>(null);
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

      // Independent reads — none depends on another's result (trainingAttempts is
      // the one exception, fetched right after since it needs trainingsList's ids).
      // Batched into one Promise.all rather than several sequential awaits: this
      // both cuts real round-trip latency (parallel instead of serial) and lets
      // the shared getActiveUser()/getTenantsByClient() lookups (called
      // internally by several of these) collapse into a single request each via
      // store's request de-duplication, instead of one fresh fetch per stage.
      const [
        filteredTenants,
        matchedUsers,
        noticesList,
        checklistsList,
        tasksList,
        notificationsList,
        quizzesList,
        attemptsList,
        sopsList,
        readStatusesList,
        trainingsList
      ] = await Promise.all([
        store.getTenantsByClient(activeClientObj.id),
        store.getTenantUsers(),
        store.getNotices(),
        store.getChecklists(),
        store.getTasks(),
        store.getNotifications(),
        store.getQuizzes(),
        store.getQuizAttempts(),
        store.getSOPs(),
        store.getSOPReadStatuses(),
        trainingSvc.getTrainings(activeClientObj.id)
      ]);
      const trainingAttemptsList = await trainingSvc.getAttempts(trainingsList.map(t => t.id));

      setClients(clientsList);
      setActiveClient(activeClientObj);
      setAllTenants(allTenantsList);
      setAllUsers(allUsersList);
      setTenants(filteredTenants);
      setActiveTenant(tenantObj);
      setTenantUsers(matchedUsers);
      setActiveUser(userObj);
      
      // Fetch unread channels, threads & mentions — the dashboard total is the sum of all three:
      // plain unread messages in DMs/channels/rooms, unread thread replies, and unread @mentions.
      const { getChannels, getAllChannels, getUnreadThreads, getMentionCount } = await import('./services/chatService');
      const isManager = [Role.ADMIN, Role.MANAGER, Role.SUPER_ADMIN, 'Admin', 'Manager', 'Super Admin'].includes(userObj.role as any);

      const clientOutletIds = filteredTenants.map(t => t.id);
      const [channels, unreadThreads, mentionCount] = await Promise.all([
        isManager ? getAllChannels(clientOutletIds, userObj.id) : getChannels(tenantObj.id, userObj.id),
        getUnreadThreads(tenantObj.id, userObj.id),
        getMentionCount(userObj.id, tenantObj.id),
      ]);

      const unreadCount = channels.reduce((acc, ch) => acc + (ch.unreadCount ?? 0), 0) +
                          unreadThreads.reduce((acc, t) => acc + (t.unreadReplyCount ?? 1), 0) +
                          mentionCount;
      setChatUnreadCount(unreadCount);

      setQuizzes(quizzesList);
      setQuizAttempts(attemptsList);
      setSops(sopsList);
      setSopReadStatuses(readStatusesList);
      setTrainings(trainingsList);
      setTrainingAttempts(trainingAttemptsList);

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
      if (seenNotifIdsRef.current === null) {
        seenNotifIdsRef.current = new Set(notificationsList.map((n: any) => n.id));
      } else {
        const newItems = notificationsList.filter((n: any) => !seenNotifIdsRef.current!.has(n.id));
        if (newItems.length > 0) {
          const msg = newItems[0].title || "New notification";
          setNewAlertMessage(msg);
          setTimeout(() => setNewAlertMessage(""), 4500);
        }
        seenNotifIdsRef.current = new Set(notificationsList.map((n: any) => n.id));
      }
      setNotifications(notificationsList);
    } catch (error) {
      console.error("Failed to refresh state from database:", error);
    } finally {
      setLoading(false);
    }
  };

  // Light background sync — refetches only the four collaborative tables
  // (notifications, tasks, notices, checklists), skips the task_messages join,
  // and does NOT touch chat/quiz/SOP/users or trigger tab side effects. Shared
  // by the realtime handler, the focus/visibility catch-up, and the interval.
  // Guard against overlapping syncs — on mobile, focus + visibilitychange +
  // the interval + a realtime event can all fire within the same tick (e.g.
  // during a pull-to-refresh), and running several full refetches at once caused
  // the UI to thrash/flicker. One at a time.
  const syncInFlightRef = useRef(false);
  const lightSync = useCallback(async (mode: 'full' | 'delta' = 'full') => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    // Raise a toast for any notifications we haven't seen before.
    const alertUnseen = (list: any[]) => {
      const unseen = seenNotifIdsRef.current
        ? list.filter((n: any) => !seenNotifIdsRef.current!.has(n.id))
        : [];
      if (seenNotifIdsRef.current === null) {
        seenNotifIdsRef.current = new Set(list.map((n: any) => n.id));
      } else {
        if (unseen.length > 0) {
          setNewAlertMessage(unseen[0].title || "New notification");
          setTimeout(() => setNewAlertMessage(""), 4500);
        }
        unseen.forEach((n: any) => seenNotifIdsRef.current!.add(n.id));
      }
    };

    // 'full' replaces each list; 'delta' fetches only rows changed in the recent
    // window and merges them in — a fraction of the payload for foreground polls.
    const DELTA_WINDOW_MS = 60_000;
    const since = mode === 'delta' ? new Date(Date.now() - DELTA_WINDOW_MS).toISOString() : undefined;
    try {
      const [notificationsList, tasksList, noticesList, checklistsList] = await Promise.all([
        store.getNotifications(since),
        store.getTasks({ withMessages: false, since }),
        store.getNotices(since),
        store.getChecklists(since),
      ]);
      if (mode === 'full') {
        setTasks(tasksList);
        setNotices(noticesList);
        setChecklists(checklistsList);
        alertUnseen(notificationsList);
        setNotifications(notificationsList);
      } else {
        if (tasksList.length) setTasks(prev => upsertById(prev, tasksList));
        if (noticesList.length) setNotices(prev => upsertById(prev, noticesList));
        if (checklistsList.length) setChecklists(prev => upsertById(prev, checklistsList));
        if (notificationsList.length) {
          alertUnseen(notificationsList);
          setNotifications(prev => upsertById(prev, notificationsList));
        }
      }
    } catch {
      // A delta fetch can fail if `updated_at` isn't migrated yet — fall back to
      // a full sync so updates keep flowing. Full-mode errors are just ignored
      // (the next tick retries).
      if (mode === 'delta') {
        try {
          const [n, t, no, c] = await Promise.all([
            store.getNotifications(),
            store.getTasks({ withMessages: false }),
            store.getNotices(),
            store.getChecklists(),
          ]);
          setTasks(t); setNotices(no); setChecklists(c);
          alertUnseen(n); setNotifications(n);
        } catch { /* silent — next sync will retry */ }
      }
    } finally {
      syncInFlightRef.current = false;
    }
  }, []);

  // Coalesce a burst of realtime events into at most one light sync per window,
  // so a flurry of changes doesn't fire a fetch per event.
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSync = useCallback(() => {
    if (syncDebounceRef.current) return;
    syncDebounceRef.current = setTimeout(() => {
      syncDebounceRef.current = null;
      lightSync('delta');
    }, 4000);
  }, [lightSync]);

  // Stable so the always-mounted permission banners don't re-run their effect on
  // every App render (an inline arrow here changed identity constantly).
  const handleFcmToken = useCallback((token: string) => {
    if (activeUser) store.updateUserFCMToken(activeUser.id, token);
  }, [activeUser?.id]);

  // Initial full load — ONLY when someone is actually signed in. Without this
  // guard, every anonymous visit to the login page still fired the full
  // refreshLocalState() waterfall (~40 Supabase requests against the default
  // client-system/tenant-system/user-superadmin context) before the visitor
  // had typed anything, wasting a large chunk of the page's load time and
  // Supabase request quota for data that's never shown. Post-login, the login
  // success handler already calls refreshLocalState() itself.
  useEffect(() => {
    if (!loggedInEmail) { setLoading(false); return; }
    refreshLocalState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scoped realtime subscription. Only the active client's outlets are listened
  // to (tenantKey is a stable primitive, so ordinary refreshes that re-create
  // the tenants array don't churn the socket), and a burst debounces into one
  // light sync — instead of every client re-running a full refresh on every
  // change anywhere in the database.
  const tenantKey = tenants.map(t => t.id).sort().join(',');
  useEffect(() => {
    if (!activeUser || !tenantKey) return;
    const unsubscribe = store.subscribeToChanges(scheduleSync, tenantKey.split(','));
    return () => { unsubscribe(); };
  }, [activeUser?.id, tenantKey, scheduleSync]);

  // Cross-device sync fallback (foreground only).
  //
  // Live updates come from the scoped realtime subscription above, but that
  // silently drops events: a mobile PWA's websocket is suspended while it's
  // backgrounded and missed events are never replayed. This is the safety net —
  // it catches up instantly on focus/visibility when you reopen the app, and on
  // a light interval WHILE THE APP IS FOREGROUND. Backgrounded clients don't run
  // the interval (they catch up on the focus/visibility events), so idle users
  // stop generating steady polling load.
  useEffect(() => {
    if (!activeUser) return;
    // Reopening the app does a FULL reconcile (covers anything missed while
    // backgrounded, including deletions); the foreground interval does a light
    // DELTA merge.
    const onFull = () => { if (document.visibilityState === 'visible') lightSync('full'); };
    document.addEventListener('visibilitychange', onFull);
    window.addEventListener('focus', onFull);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') lightSync('delta');
    }, 15000);

    return () => {
      document.removeEventListener('visibilitychange', onFull);
      window.removeEventListener('focus', onFull);
      clearInterval(interval);
    };
  }, [activeUser?.id, lightSync]);

  // Poll for chat unread counts to keep sidebar updated
  useEffect(() => {
    if (!activeUser || !activeTenant) return;
    const fetchUnread = () => {
      import('./services/chatService').then(({ getChannels, getAllChannels, getUnreadThreads, getMentionCount }) => {
        const isManager = [Role.ADMIN, Role.MANAGER, Role.SUPER_ADMIN, 'Admin', 'Manager', 'Super Admin'].includes(activeUser.role as any);
        const channelsPromise = isManager
          ? getAllChannels(tenants.map(t => t.id), activeUser.id)
          : getChannels(activeUser.tenantId, activeUser.id);

        Promise.all([
          channelsPromise,
          getUnreadThreads(activeUser.tenantId, activeUser.id),
          getMentionCount(activeUser.id, activeUser.tenantId),
        ]).then(([channels, unreadThreads, mentionCount]) => {
          const count = channels.reduce((acc, ch) => acc + (ch.unreadCount ?? 0), 0) +
            unreadThreads.reduce((acc, t) => acc + (t.unreadReplyCount ?? 1), 0) +
            mentionCount;
          setChatUnreadCount(count);
        }).catch(() => {});
      });
    };
    fetchUnread();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchUnread();
    }, 15000);
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
      else if (path.startsWith('/maintenance')) handleSetActiveTab('maintenance');
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

  const handleAddClient = async (id: string, name: string, logo: string, plan: "Free" | "Essential" | "Pro" | "Enterprise" | "Training", trainingAddon: boolean) => {
    await store.addClient(id, name, logo, plan, trainingAddon);
    await refreshLocalState();
  };

  const handleUpdateClient = async (id: string, name: string, logo: string, plan: "Free" | "Essential" | "Pro" | "Enterprise" | "Training", trainingAddon: boolean) => {
    await store.updateClient(id, name, logo, plan, trainingAddon);
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

  const handleAddTenant = async (clientId: string, name: string, subdomain: string, logo: string, plan: "Free" | "Essential" | "Pro" | "Enterprise" | "Training") => {
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

  const handleOnboardStaff = async (tenantId: string, name: string, email: string, role: Role, department: Department, avatar: string, phoneNumber?: string, whatsappOptedIn?: boolean, clitAccess?: boolean, clitRole?: string) => {
    await store.onboardingUser(tenantId, name, email, role, department, avatar, phoneNumber, whatsappOptedIn, clitAccess, clitRole);
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
  const handleUpdateTenant = async (tenantId: string, name: string, subdomain: string, logo: string, plan: "Free" | "Essential" | "Pro" | "Enterprise" | "Training") => {
    await store.updateTenant(tenantId, name, subdomain, logo, plan);
    await refreshLocalState();
    triggerToast("Outlet workspace updated.");
  };

  const handleDeleteTenant = async (tenantId: string) => {
    await store.deleteTenant(tenantId);
    await refreshLocalState();
    triggerToast("Outlet workspace deleted.");
  };

  const handleUpdateUser = async (userId: string, name: string, email: string, role: string, department: string, clitAccess?: boolean, clitRole?: string) => {
    await store.updateUser(userId, name, email, role, department, clitAccess, clitRole);
    await refreshLocalState();
    triggerToast("Staff user updated.");
  };

  const handleSetClitAccess = async (userId: string, access: boolean, clitRole: string) => {
    await store.setClitAccess(userId, access, clitRole);
    await refreshLocalState();
    triggerToast(access ? "CLIT access granted." : "CLIT access removed.");
  };

  const refreshTraining = async () => {
    const cid = activeClient?.id;
    if (!cid) return;
    const list = await trainingSvc.getTrainings(cid);
    const att = await trainingSvc.getAttempts(list.map(t => t.id));
    setTrainings(list);
    setTrainingAttempts(att);
  };

  const handleSubmitTraining = async (training: any, answers: number[], screenLeaves: number = 0) => {
    const att = await trainingSvc.submitAttempt(
      training,
      { id: activeUser!.id, name: activeUser!.name, role: String(activeUser!.role), department: String(activeUser!.department), tenantId: activeUser!.tenantId },
      answers,
      screenLeaves,
    );
    await refreshTraining();
    return att;
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await store.deleteUser(userId);
      await refreshLocalState();
      triggerToast("Staff user deleted.");
    } catch (err: any) {
      console.error("Delete user failed:", err);
      await refreshLocalState();
      triggerToast("Couldn't delete user: " + (err?.message || "unknown error"));
    }
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
      <div
        className="min-h-screen flex items-center justify-center font-sans p-6"
        id="app-loading-gate"
        style={{ background: "linear-gradient(135deg, var(--color-brand-tint) 0%, var(--color-cream) 42%, var(--color-accent-tint) 100%)" }}
      >
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin" style={{ color: "var(--color-brand)" }} />
          <p className="text-xs font-mono font-medium tracking-wider" style={{ color: "var(--color-ink-soft)" }}>Loading Client Gateway…</p>
        </div>
      </div>
    );
  }

  if (!loggedInEmail) {
    return (
      <>
        <Login
          onLoginSuccess={async (usr) => {
            // Gate the whole post-login repopulation behind the loading screen —
            // otherwise the portal renders through several half-updated states
            // (old persona → new persona, features settling) and visibly flickers
            // until it stabilizes. A hard refresh doesn't flicker because `loading`
            // starts true and covers the first full load; mirror that here.
            setLoading(true);
            setLoggedInEmail(usr.email || usr.phoneNumber || usr.id);
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
      <div className="min-h-screen flex items-center justify-center font-sans p-6" id="app-setup-gate"
           style={{ background: "linear-gradient(135deg, var(--color-brand-tint) 0%, var(--color-cream) 42%, var(--color-accent-tint) 100%)" }}>
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
          onPermissionGranted={handleFcmToken}
        />
      )}

      {/* FCM reminder banner — appears after 60s if permission not yet granted */}
      {activeUser && loggedInEmail && (
        <NotificationPermissionBanner
          userId={activeUser.id}
          variant="reminder"
          onPermissionGranted={handleFcmToken}
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
        activeTab={effectiveTab}
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
        <header className="bg-white/70 backdrop-blur-xl border-b border-slate-100 px-4 py-3 md:px-8 md:py-4 flex items-center justify-between shrink-0" id="top-navbar">
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
              key={effectiveTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className={`h-full ${activeTab === 'team-talk' ? 'w-full' : 'max-w-7xl mx-auto'}`}
            >
              {/* Tab routing mappings */}
              <Suspense fallback={
                <div className="flex items-center justify-center py-24">
                  <RefreshCw className="w-6 h-6 animate-spin text-[color:var(--color-brand,#8B7CF6)]" />
                </div>
              }>
              {isTrialExpired && activeUser.role !== Role.SUPER_ADMIN ? (
                <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center max-w-2xl mx-auto bg-white rounded-3xl border border-slate-200/80 shadow-md space-y-6 my-4">
                  <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 text-3xl shadow-sm animate-pulse">
                    ⏳
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-medium text-slate-800 tracking-tight">Free Trial Expired</h2>
                    <p className="text-slate-500 text-sm leading-relaxed">
                      Your 15-day free trial of the Horae Operations Portal has concluded. To keep using the portal, your organization needs an active subscription plan.
                    </p>
                  </div>

                  {/* Plan overview (informational — activation is handled by Horae) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full pt-2 text-left">
                    {([
                      { name: "Essential", desc: "Task Manager + Team Talk" },
                      { name: "Pro", desc: "Essential + Checklists, Equipment Maintenance & Notice Board" },
                      { name: "Enterprise", desc: "Pro + Training, Quizzes & SOPs" },
                      { name: "Training", desc: "Training only — combinable with Essential or Pro" },
                    ] as const).map(p => (
                      <div key={p.name} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                        <span className="text-[9px] font-semibold tracking-wider uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{p.name}</span>
                        <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">{p.desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-amber-50 border border-amber-200/60 rounded-2xl text-[11px] text-amber-800 font-medium leading-relaxed w-full">
                    Plans are activated by your Horae account manager. Contact us at <a href="mailto:support@horae.cloud" className="text-indigo-600 underline font-semibold">support@horae.cloud</a> and we'll switch your organization to the plan you need.
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
                  {effectiveTab === "dashboard" && (
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
                      trainings={trainings}
                      trainingAttempts={trainingAttempts}
                      features={clientFeatures}
                    />
                  )}

                  {activeTab === "notices" && (
                    <NoticesWorkflows
                      notices={notices}
                      tenants={tenants}
                      activeUser={activeUser}
                      onBack={backToDashboard}
                      onUrgentNotify={handleUrgentNoticeNotify}
                    />
                  )}

                  {activeTab === "checklists" && (
                  <ChecklistsWorkflows
                      checklists={checklists}
                      tenants={tenants}
                      onSubmitChecklist={handleSubmitChecklist}
                      onBack={backToDashboard}
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
                      onUrgentNotify={handleUrgentTaskNotify}
                      onBack={backToDashboard}
                    />
                  )}

                  {activeTab === "quizzes" && (
                    <Quizzes
                      quizzes={quizzes}
                      attempts={quizAttempts}
                      activeUser={activeUser}
                      onSubmitAttempt={handleSubmitQuizAttempt}
                      onBack={backToDashboard}
                    />
                  )}

                  {activeTab === "sops" && (
                    <SOPs
                      sops={sops}
                      readStatuses={sopReadStatuses}
                      activeUser={activeUser}
                      onMarkRead={handleMarkSOPAsRead}
                      onBack={backToDashboard}
                    />
                  )}

                  {effectiveTab === "training" && hasFeature("training") && (
                    [Role.ADMIN, Role.SUPER_ADMIN].includes(activeUser.role as Role) ? (
                      <TrainingAdmin
                        trainings={trainings}
                        attempts={trainingAttempts}
                        activeUser={activeUser}
                        clientId={activeClient?.id || activeTenant.clientId}
                        tenants={tenants}
                        clientUsers={allUsers.filter(u => tenants.some(t => t.id === u.tenantId))}
                        onChanged={refreshTraining}
                      />
                    ) : (
                      <Training
                        trainings={trainings}
                        attempts={trainingAttempts}
                        activeUser={activeUser}
                        onSubmit={handleSubmitTraining}
                        onBack={backToDashboard}
                      />
                    )
                  )}

                  {activeTab === "team-talk" && hasFeature("teamtalk") && (
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
                      onBack={backToDashboard}
                    />
                  )}

                  {activeTab === "swot" && (
                    <SwotCompass
                      activeUser={activeUser}
                      tenants={tenants}
                    />
                  )}

                  {activeTab === "maintenance" && hasFeature("maintenance") && (activeUser.clitAccess || [Role.ADMIN, Role.SUPER_ADMIN].includes(activeUser.role as Role)) && (
                    <MaintenanceHub
                      activeUser={activeUser}
                      activeTenant={activeTenant}
                      tenants={tenants}
                      clientUsers={allUsers.filter(u => tenants.some(t => t.id === u.tenantId))}
                      onSetClitAccess={handleSetClitAccess}
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
                      onBack={backToDashboard}
                    />
                  )}
                </>
              )}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>


      </div>

    </div>
  );
}
