/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Building2,
  User,
  ClipboardCheck,
  MessageSquare,
  BookOpen,
  UserSquare2,
  Layers,
  ChevronDown,
  Megaphone,
  Briefcase,
  ShieldCheck,
  LogOut,
  X,
  Key,
  MessageCircle,
  Bell,
  BellOff
} from "lucide-react";
import { Client, Tenant, User as AppUser, Role, Department } from "../types";
import { store } from "../services/store";
import { initPush, clearPushSubscription, setPushOptOut, getLastPushError } from "../services/fcmService";

interface SidebarProps {
  clients: Client[];
  activeClient: Client;
  onSelectClient: (id: string) => void;
  
  tenants: Tenant[];
  activeTenant: Tenant;
  onSelectTenant: (id: string) => void;
  
  tenantUsers: AppUser[];
  activeUser: AppUser;
  onSelectUser: (id: string) => void;
  
  activeTab: string;
  onSelectTab: (tab: string) => void;
  notificationsCount: number;
  chatUnreadCount?: number;
  
  isOpen: boolean;
  onClose: () => void;
  allUsers: AppUser[];
  allTenants: Tenant[];

  loggedInEmail: string | null;
  onLogout: () => void;
}

export default function Sidebar({
  clients,
  activeClient,
  onSelectClient,
  tenants,
  activeTenant,
  onSelectTenant,
  tenantUsers,
  activeUser,
  onSelectUser,
  activeTab,
  onSelectTab,
  notificationsCount,
  chatUnreadCount = 0,
  isOpen,
  onClose,
  allUsers,
  allTenants,
  loggedInEmail,
  onLogout
}: SidebarProps) {
  const [pushBusy, setPushBusy] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted' && !!activeUser.fcmToken
  );

  // activeUser.fcmToken can change from outside this component — e.g. the
  // server nulls it when a push subscription goes dead (410/404) so the
  // client re-prompts. useState only reads it once, so without this the
  // toggle would keep showing "on" forever after a silent server-side
  // revocation, even though pushes have stopped arriving.
  useEffect(() => {
    setPushEnabled(
      typeof Notification !== 'undefined' && Notification.permission === 'granted' && !!activeUser.fcmToken
    );
  }, [activeUser.fcmToken]);

  const handleTogglePush = async () => {
    setPushBusy(true);
    try {
      if (pushEnabled) {
        await clearPushSubscription(activeUser.id);
        setPushOptOut(true);
        setPushEnabled(false);
      } else {
        const token = await initPush(activeUser.id);
        if (token) {
          await store.updateUserFCMToken(activeUser.id, token);
          setPushEnabled(true);
        } else {
          const reason = getLastPushError();
          alert("Couldn't enable notifications.\n\nReason: " + (reason || "Notifications may be blocked in your browser settings. Enable them there, then try again."));
        }
      }
    } finally {
      setPushBusy(false);
    }
  };

  // Mobile helper wraps to collapse drawer on action
  const handleTabClick = (tab: string) => {
    onSelectTab(tab);
    onClose();
  };

  const handleClientChange = (id: string) => {
    onSelectClient(id);
    onClose();
  };

  const handleTenantChange = (id: string) => {
    onSelectTenant(id);
    onClose();
  };

  const handleUserChange = (id: string) => {
    onSelectUser(id);
    onClose();
  };

  const isSuperAdminLoggedIn = loggedInEmail === 'coderookie84@gmail.com';
  const isImpersonating = isSuperAdminLoggedIn && activeUser.id !== 'user-superadmin';
  const isSystemActive = activeClient.id === 'client-system' || activeClient.id === 'client-hq';
  const clientServices = activeClient.services || ["notices", "checklists", "tasks", "quizzes", "sops"];
  const showNotices = clientServices.includes("notices");
  const showChecklists = clientServices.includes("checklists");
  const showTasks = clientServices.includes("tasks");
  const showQuizzes = clientServices.includes("quizzes");
  const showSOPs = clientServices.includes("sops");

  return (
    <>
      {/* Backdrop backdrop for mobile viewports */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300"
          id="sidebar-backdrop"
        />
      )}

      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-50 text-slate-600 flex flex-col border-r border-slate-200 transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`} 
        id="sidebar-panel"
      >
        {/* Platform Branding */}
        <div className="relative bg-white border-b border-slate-200 h-24 flex flex-col items-center justify-center p-2" id="sidebar-branding">
          <img 
            src="/horae-logo.jpg" 
            alt="Horae Logo" 
            className="h-14 w-auto object-contain mx-auto" 
          />
          <p className="text-xs font-semibold text-[#162D4E] uppercase tracking-[0.18em] mt-1.5 select-none font-sans">
            Operations, Simplified
          </p>
          {/* Close Sidebar button on mobile */}
          <button 
            onClick={onClose}
            className="md:hidden absolute top-2 right-2 p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-full transition-colors cursor-pointer z-10"
            title="Close Menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Impersonation Back Link (Top Bar under branding) */}
        {isImpersonating && (
          <div className="p-3 border-b border-indigo-900/40 bg-indigo-950/20" id="sidebar-impersonate-bar">
            <button
              onClick={() => handleUserChange('user-superadmin')}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs uppercase rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer text-center flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#C5A880]" />
              Exit Client Workspace
            </button>
          </div>
        )}

        {/* SaaS Client & Tenant Switcher / Platform Banner */}
        {isSuperAdminLoggedIn ? (
          isSystemActive ? (
            <div className="p-3 border-b border-slate-200 space-y-2" id="sidebar-platform-switcher">
              <div className="bg-white border border-slate-200 px-3 py-2 rounded-lg text-center shadow-inner">
                <span className="text-xs font-semibold text-[#C5A880] tracking-wide block">Platform Admin Console ⚡</span>
              </div>
              <button
                onClick={() => {
                  const firstBrand = clients.find(c => c.id !== 'client-system' && c.id !== 'client-hq');
                  if (firstBrand) {
                    handleClientChange(firstBrand.id);
                  }
                }}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs uppercase rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer text-center"
              >
                ← Go to Brand Outlets
              </button>
            </div>
          ) : (
            <>
              {/* SaaS Client Switcher (Visible to Super Admin) */}
              <div className="p-3 border-b border-slate-200 space-y-1" id="sidebar-client-switcher">
                <label className="text-sm text-[#C5A880] font-medium tracking-wide block px-1">
                  Brand Organization
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                  <select
                    id="client-dropdown"
                    value={activeClient.id}
                    onChange={(e) => {
                      if (e.target.value) handleClientChange(e.target.value);
                    }}
                    className="w-full pl-8 pr-7 py-1.5 bg-white hover:bg-slate-750 border border-slate-200 rounded-md text-sm font-semibold text-slate-700 focus:outline-none appearance-none cursor-pointer transition-colors"
                  >
                    {clients.filter(c => c.id !== 'client-system' && c.id !== 'client-hq').map(c => (
                      <option key={c.id} value={c.id}>
                        {c.logo} {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-2.5 w-3 h-3 text-slate-500 pointer-events-none" />
                </div>
                <div className="pt-1">
                  <button
                    onClick={() => handleClientChange('client-system')}
                    className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 font-medium text-[10px] uppercase rounded-lg transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#C5A880]" />
                    ← Back to Platform Admin
                  </button>
                </div>
              </div>
            </>
          )
        ) : (
          <>
            {/* Statically locked Client/Brand for normal logged-in user */}
            <div className="p-3 border-b border-slate-200 space-y-1" id="sidebar-client-locked">
              <label className="text-sm text-[#C5A880] font-medium tracking-wide block px-1">
                Client Organization
              </label>
              <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-2">
                <span className="text-sm">{activeClient.logo}</span>
                <span>{activeClient.name}</span>
              </div>
            </div>


          </>
        )}

        {/* Main Feature Tabs Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" id="sidebar-navigation">
          {activeUser.role === Role.SUPER_ADMIN ? (
            <>
              <div className="text-sm text-[#C5A880] font-medium tracking-wide mb-1 px-1">
                Platform Admin
              </div>
              <button
                id="btn-saas-admin"
                onClick={() => handleTabClick("horae-admin")}
                className={`w-full flex items-center justify-between px-2.5 py-1.8 mb-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  activeTab === "horae-admin"
                    ? "bg-slate-900 text-white shadow-xs font-semibold"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Horae Admin Panel</span>
                </div>
              </button>
            </>
          ) : (
            <>
              {/* Back to Horae Admin console tab ONLY visible if Super Admin is Impersonating */}
              {isImpersonating && (
                <button
                  id="btn-switch-to-horae-admin"
                  onClick={() => {
                    handleUserChange('user-superadmin');
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-2 mb-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold border border-transparent shadow-xs transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#C5A880]" />
                    <span>Return to Horae Admin</span>
                  </div>
                </button>
              )}

              <div className="text-sm text-slate-500 font-medium tracking-wide mb-1 px-1">
                Operations
              </div>
              
              <button
                id="btn-dashboard"
                onClick={() => handleTabClick("dashboard")}
                className={`w-full flex items-center justify-between px-2.5 py-1.8 rounded-md text-sm font-medium transition-all cursor-pointer ${
                  activeTab === "dashboard"
                    ? "bg-blue-50 text-blue-700 font-semibold rounded-xl"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Dashboard Overview</span>
                </div>
              </button>

              {showNotices && (
                <button
                  id="btn-notices"
                  onClick={() => handleTabClick("notices")}
                  className={`w-full flex items-center justify-between px-2.5 py-1.8 rounded-md text-sm font-medium transition-all cursor-pointer ${
                    activeTab === "notices"
                      ? "bg-blue-50 text-blue-700 font-semibold rounded-xl"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-3.5 h-3.5" />
                    <span>Notices Board</span>
                  </div>
                </button>
              )}

              {showChecklists && (
                <button
                  id="btn-checklists"
                  onClick={() => handleTabClick("checklists")}
                  className={`w-full flex items-center justify-between px-2.5 py-1.8 rounded-md text-sm font-medium transition-all cursor-pointer ${
                    activeTab === "checklists"
                      ? "bg-blue-50 text-blue-700 font-semibold rounded-xl"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span>Checklist Routines</span>
                  </div>
                </button>
              )}

              {showTasks && (
                <button
                  id="btn-tasks"
                  onClick={() => handleTabClick("tasks")}
                  className={`w-full flex items-center justify-between px-2.5 py-1.8 rounded-md text-sm font-medium transition-all cursor-pointer ${
                    activeTab === "tasks"
                      ? "bg-blue-50 text-blue-700 font-semibold rounded-xl"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Task Manager</span>
                  </div>
                </button>
              )}

              {showQuizzes && (
                <button
                  id="btn-quizzes"
                  onClick={() => handleTabClick("quizzes")}
                  className={`w-full flex items-center justify-between px-2.5 py-1.8 rounded-md text-sm font-medium transition-all cursor-pointer ${
                    activeTab === "quizzes"
                      ? "bg-blue-50 text-blue-700 font-semibold rounded-xl"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Quizzes</span>
                  </div>
                </button>
              )}

              {showSOPs && (
                <button
                  id="btn-sops"
                  onClick={() => handleTabClick("sops")}
                  className={`w-full flex items-center justify-between px-2.5 py-1.8 rounded-md text-sm font-medium transition-all cursor-pointer ${
                    activeTab === "sops"
                      ? "bg-blue-50 text-blue-700 font-semibold rounded-xl"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-[#C5A880]" />
                    <span>SOPs</span>
                  </div>
                </button>
              )}

              {/* ── Team Talk ── */}
              <div className="text-sm text-slate-500 font-medium tracking-wide mt-4 mb-1 px-1">
                Communication
              </div>
              <button
                id="btn-team-talk"
                onClick={() => handleTabClick("team-talk")}
                className={`w-full flex items-center justify-between px-2.5 py-1.8 rounded-md text-sm font-medium transition-all cursor-pointer ${
                  activeTab === "team-talk"
                    ? "bg-gradient-to-r from-[#162D4E] to-slate-800 border border-[#C5A880]/30 text-slate-800 shadow-lg font-semibold"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-3.5 h-3.5 text-[#C5A880]" />
                  <span>Team Talk</span>
                </div>
                {chatUnreadCount > 0 && (
                  <span className="bg-rose-500 text-slate-800 text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                    {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                  </span>
                )}
              </button>

              {activeUser.role === Role.ADMIN && (
                <>
                  <div className="text-[9px] text-[#C5A880] font-medium tracking-wide mt-4 mb-1 px-1">
                    Administration
                  </div>
                  <button
                    id="btn-admin-panel"
                    onClick={() => handleTabClick("admin-panel")}
                    className={`w-full flex items-center justify-between px-2.5 py-1.8 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                      activeTab === "admin-panel"
                        ? "bg-[#C5A880] text-slate-950 shadow-lg font-semibold"
                        : "text-slate-500 hover:text-[#C5A880] hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Admin Panel</span>
                    </div>
                  </button>
                </>
              )}
            </>
          )}
        </nav>

        {/* Acting User Persona Simulation Selector (Hiding for normal users, showing only for Super Admin) */}
        {!isSystemActive && (
          <div className="p-3 bg-slate-900/40 border-t border-slate-200" id="sidebar-persona">
            {isSuperAdminLoggedIn ? (
              <>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[8px] text-[#C5A880] font-medium tracking-wide">
                    Simulate User Persona
                  </label>
                  <span className="flex h-1.5 w-1.5 rounded-full bg-[#C5A880] relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C5A880] opacity-75"></span>
                  </span>
                </div>
                
                <div className="relative mb-2">
                  <UserSquare2 className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                  <select
                    id="user-persona-dropdown"
                    value={activeUser.id}
                    onChange={(e) => handleUserChange(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 bg-white hover:bg-white border border-slate-200 rounded-md text-[10px] font-semibold text-slate-700 focus:outline-none appearance-none cursor-pointer transition-colors"
                  >
                    {tenantUsers.map(usr => (
                      <option key={usr.id} value={usr.id}>
                        {usr.name} ({usr.role})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-2.5 w-3 h-3 text-slate-500 pointer-events-none" />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[8px] text-slate-500 font-medium tracking-wide">
                  Logged In Account
                </label>
              </div>
            )}

             {/* Selected / Current User Details Box */}
             <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
               <img
                 src={activeUser.avatar}
                 alt={activeUser.name}
                 id="active-user-avatar"
                 referrerPolicy="no-referrer"
                 className="w-6 text-xs text-slate-500 h-6 rounded object-cover bg-white"
               />
               <div className="min-w-0 flex-1">
                 <p className="text-[10px] font-semibold text-slate-800 truncate leading-tight">
                   {activeUser.name}
                 </p>
                 <p className="text-[8px] text-slate-500 truncate space-x-1">
                   <span className="text-[#C5A880] font-semibold">{activeUser.role}</span>
                   <span className="text-slate-700">|</span>
                   <span>{activeUser.department}</span>
                 </p>
               </div>
               <button
                 type="button"
                 onClick={handleTogglePush}
                 disabled={pushBusy}
                 className={`p-1 rounded-lg transition-colors cursor-pointer shrink-0 disabled:opacity-50 ${
                   pushEnabled ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-white hover:text-slate-600'
                 }`}
                 title={pushEnabled ? "Notifications on — tap to turn off" : "Notifications off — tap to turn on"}
               >
                 {pushEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
               </button>
               <button
                 type="button"
                 onClick={() => {
                   const currentPwd = store.getPasswordForEmail(activeUser.email);
                   const newPwd = prompt(`Change Password for ${activeUser.name}:\n\nCurrent Password: ${currentPwd}\n\nEnter new password (min 6 characters):`);
                   if (newPwd !== null) {
                     const trimmed = newPwd.trim();
                     if (trimmed.length < 6) {
                       alert("Password must be at least 6 characters long.");
                     } else {
                       store.updateUserPassword(activeUser.email, trimmed).then(() => {
                        alert("Password updated successfully!");
                      }).catch((err) => {
                        console.error("Failed to sync password to DB:", err);
                        alert("Password updated locally, but failed to sync to database.");
                      });
                     }
                   }
                 }}
                 className="p-1 hover:bg-white rounded-lg text-slate-500 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
                 title="Change Password"
               >
                 <Key className="w-3.5 h-3.5" />
               </button>
             </div>
          </div>
        )}

        {/* Global Logout Actions Button */}
        <div className="p-3 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white hover:bg-white hover:text-red-400 text-slate-500 hover:border-red-950/50 border border-slate-200 rounded-xl text-xs font-medium transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
