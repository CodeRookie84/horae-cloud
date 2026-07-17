/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Building2, 
  Users, 
  Layers, 
  Plus, 
  Activity, 
  Briefcase, 
  Globe, 
  Sparkles, 
  Check, 
  UserPlus, 
  ShieldCheck,
  X,
  Edit2,
  Trash2
} from "lucide-react";
import { Client, Tenant, User, Role, Department } from "../types";
import HoraeLogoIcon from "./HoraeLogoIcon";
import { store } from "../services/store";
import * as plans from "../services/plans";

/** Read-only preview of the features a plan (+ Training add-on) grants. */
function PlanFeaturePreview({ plan, trainingAddon }: { plan: plans.PlanId; trainingAddon: boolean }) {
  const feats = plans.planFeatures(plan, { trainingAddon, createdAt: new Date().toISOString() });
  return (
    <div className="space-y-2 text-left border border-slate-100 p-3 rounded-xl bg-slate-50/50">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
        Included Features {plan === "Free" && <span className="text-emerald-600">(all — 15-day trial)</span>}
      </label>
      {feats.length === 0 ? (
        <p className="text-[10px] text-slate-400 font-semibold">No features (trial expired).</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {feats.map(f => (
            <span key={f} className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
              {plans.FEATURE_LABELS[f]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Training add-on toggle — only meaningful for Essential/Pro. */
function TrainingAddonToggle({ plan, value, onChange }: { plan: plans.PlanId; value: boolean; onChange: (v: boolean) => void }) {
  if (!plans.trainingAddonApplies(plan)) return null;
  return (
    <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700 cursor-pointer select-none border border-slate-100 p-3 rounded-xl bg-slate-50/50">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
      />
      <span>Add <span className="text-indigo-700">Training</span> as a combo add-on</span>
    </label>
  );
}

interface HoraeAdminPanelProps {
  clients: Client[];
  tenants: Tenant[];
  users: User[];
  onAddClient: (id: string, name: string, logo: string, plan: "Free" | "Essential" | "Pro" | "Enterprise" | "Training", trainingAddon: boolean) => void;
  onAddTenant: (clientId: string, name: string, subdomain: string, logo: string, plan: "Free" | "Essential" | "Pro" | "Enterprise" | "Training") => void;
  onOnboardUser: (tenantId: string, name: string, email: string, role: string, department: string, avatar: string, phoneNumber?: string, whatsappOptedIn?: boolean) => void;
  onSelectUser: (userId: string) => void;
  onUpdateClient: (id: string, name: string, logo: string, plan: "Free" | "Essential" | "Pro" | "Enterprise" | "Training", trainingAddon: boolean) => void;
  onDeleteClient: (id: string) => void;
  onUpdateTenant: (tenantId: string, name: string, subdomain: string, logo: string, plan: "Free" | "Essential" | "Pro" | "Enterprise" | "Training") => void;
  onDeleteTenant: (tenantId: string) => void;
  onUpdateUser: (userId: string, name: string, email: string, role: string, department: string) => void;
  onDeleteUser: (userId: string) => void;
}

export default function HoraeAdminPanel({
  clients: rawClients,
  tenants,
  users,
  onAddClient,
  onAddTenant,
  onOnboardUser,
  onSelectUser,
  onUpdateClient,
  onDeleteClient,
  onUpdateTenant,
  onDeleteTenant,
  onUpdateUser,
  onDeleteUser
}: HoraeAdminPanelProps) {
  const clients = rawClients.filter(c => c.id !== "client-system" && c.id !== "client-hq");
  const [activeTab, setActiveTab] = useState<"clients" | "outlets" | "staff">("clients");

  // State for adding a client
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientLogo, setClientLogo] = useState("🍰");
  const [clientPlan, setClientPlan] = useState<plans.PlanId>("Pro");
  const [clientTrainingAddon, setClientTrainingAddon] = useState<boolean>(false);
  const [clientSuccessMsg, setClientSuccessMsg] = useState("");

  // State for editing a client
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editName, setEditName] = useState("");
  const [editLogo, setEditLogo] = useState("");
  const [editPlan, setEditPlan] = useState<plans.PlanId>("Pro");
  const [editTrainingAddon, setEditTrainingAddon] = useState<boolean>(false);

  // State for deleting a client
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);

  // State for editing a tenant (outlet)
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [editTenantName, setEditTenantName] = useState("");
  const [editTenantSubdomain, setEditTenantSubdomain] = useState("");
  const [editTenantLogo, setEditTenantLogo] = useState("");
  const [editTenantPlan, setEditTenantPlan] = useState<plans.PlanId>("Pro");

  // State for deleting a tenant
  const [deletingTenantId, setDeletingTenantId] = useState<string | null>(null);

  // State for editing a user (staff)
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserRole, setEditUserRole] = useState("");
  const [editUserDepartment, setEditUserDepartment] = useState("");

  // State for deleting a user
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // State for adding an outlet (tenant)
  const [selectedClientId, setSelectedClientId] = useState("");
  const [outletName, setOutletName] = useState("");
  const [outletSubdomain, setOutletSubdomain] = useState("");
  const [outletLogo, setOutletLogo] = useState("🏪");
  const [outletSuccessMsg, setOutletSuccessMsg] = useState("");

  // State for onboarding staff
  const [staffClientFilter, setStaffClientFilter] = useState("");
  const [staffTenantId, setStaffTenantId] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPhone, setStaffPhone] = useState("");

  // Dynamic staff role & department states
  const [staffRole, setStaffRole] = useState<string>("Manager");
  const [staffDept, setStaffDept] = useState<string>("Management");
  const [customRole, setCustomRole] = useState("");
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [customDept, setCustomDept] = useState("");
  const [isCustomDept, setIsCustomDept] = useState(false);

  const [staffSuccessMsg, setStaffSuccessMsg] = useState("");

  // Synchronize client selections once clients finish loading asynchronously
  React.useEffect(() => {
    if (clients.length > 0) {
      if (!selectedClientId || !clients.some(c => c.id === selectedClientId)) {
        setSelectedClientId(clients[0].id);
      }
      if (!staffClientFilter || !clients.some(c => c.id === staffClientFilter)) {
        setStaffClientFilter(clients[0].id);
      }
    }
  }, [clients]);

  // Synchronize staffTenantId when staffClientFilter changes
  React.useEffect(() => {
    const outlets = tenants.filter(t => t.clientId === staffClientFilter);
    if (outlets.length > 0) {
      if (!staffTenantId || !outlets.some(o => o.id === staffTenantId)) {
        setStaffTenantId(outlets[0].id);
      }
    } else {
      setStaffTenantId("");
    }
  }, [staffClientFilter, tenants]);

  // Filter tenants for selected client in outlet creation & staff onboarding
  const clientOutlets = tenants.filter(t => t.clientId === (activeTab === "staff" ? staffClientFilter : selectedClientId));

  // Dynamic lists scanning
  const defaultRoles = Object.values(Role).filter(r => r !== Role.ALL) as string[];
  const defaultDepts = Object.values(Department).filter(d => d !== Department.ALL) as string[];
  
  const clientTenantIds = tenants.filter(t => t.clientId === staffClientFilter).map(t => t.id);
  const clientUsers = users.filter(u => clientTenantIds.includes(u.tenantId));
  
  const existingRoles = Array.from(new Set(clientUsers.map(u => u.role).filter(Boolean)));
  const existingDepts = Array.from(new Set(clientUsers.map(u => u.department).filter(Boolean)));
  
  const availableRoles = Array.from(new Set([...defaultRoles, ...existingRoles]));
  const availableDepts = Array.from(new Set([...defaultDepts, ...existingDepts]));

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId.trim() || !clientName.trim()) return;
    onAddClient(clientId.toLowerCase().replace(/[^a-z0-9-]/g, ''), clientName, clientLogo, clientPlan, plans.trainingAddonApplies(clientPlan) && clientTrainingAddon);
    setClientSuccessMsg(`Successfully onboarded Client: ${clientName} (ID: ${clientId.toLowerCase().replace(/[^a-z0-9-]/g, '')})!`);
    setClientId("");
    setClientName("");
    setTimeout(() => setClientSuccessMsg(""), 4000);
  };

  const handleCreateOutlet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !outletName.trim() || !outletSubdomain.trim()) return;
    
    // Auto-append domain if needed
    let sub = outletSubdomain.toLowerCase().replace(/\s+/g, "-");
    if (!sub.endsWith(".horae.ops")) {
      sub = `${sub}.horae.ops`;
    }

    onAddTenant(selectedClientId, outletName, sub, outletLogo, "Enterprise");
    setOutletSuccessMsg(`Successfully added Outlet: ${outletName} under selected Client!`);
    setOutletName("");
    setOutletSubdomain("");
    setTimeout(() => setOutletSuccessMsg(""), 4000);
  };

  const handleOnboardStaff = (e: React.FormEvent) => {
    e.preventDefault();
    const targetTenant = staffTenantId || clientOutlets[0]?.id;
    if (!targetTenant || !staffName.trim() || (!staffEmail.trim() && !staffPhone.trim())) return;

    const finalRole = isCustomRole ? customRole.trim() : staffRole;
    const finalDept = isCustomDept ? customDept.trim() : staffDept;

    if (isCustomRole && !customRole.trim()) return;
    if (isCustomDept && !customDept.trim()) return;

    // Random avatar placeholder based on gender/style
    const randomAvatarId = Math.floor(Math.random() * 70);
    const avatarUrl = `https://i.pravatar.cc/150?img=${randomAvatarId}`;

    onOnboardUser(targetTenant, staffName, staffEmail, finalRole, finalDept, avatarUrl, staffPhone, !!staffPhone);
    const generatedPwd = store.getPasswordForEmail(staffEmail.trim().toLowerCase() || store.normalizePhone(staffPhone).e164);
    setStaffSuccessMsg(`Staff member ${staffName} onboarded successfully! Generated Password: ${generatedPwd}`);
    setStaffName("");
    setStaffEmail("");
    setStaffPhone("");
    setCustomRole("");
    setCustomDept("");
    setIsCustomRole(false);
    setIsCustomDept(false);
    setTimeout(() => setStaffSuccessMsg(""), 6000);
  };

  // Switch client filters cleanly
  const handleStaffClientFilterChange = (val: string) => {
    setStaffClientFilter(val);
    setIsCustomRole(false);
    setIsCustomDept(false);
    setCustomRole("");
    setCustomDept("");
    const matchedTenants = tenants.filter(t => t.clientId === val);
    if (matchedTenants.length > 0) {
      setStaffTenantId(matchedTenants[0].id);
    } else {
      setStaffTenantId("");
    }
  };

  return (
    <div className="space-y-6" id="horae-admin-container">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <img 
            src="/horae-logo.jpg" 
            alt="Horae Logo" 
            className="w-16 h-12 object-contain bg-white rounded-xl p-1 border border-slate-200/50 shadow-inner"
          />
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              Horae Admin
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Client Onboarding & Management
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            onChange={(e) => {
              const selectedUserId = e.target.value;
              if (selectedUserId) onSelectUser(selectedUserId);
            }}
            value=""
            className="px-3.5 py-2 bg-[#162D4E] hover:bg-[#162D4E]/90 text-white font-bold text-xs rounded-xl shadow-lg cursor-pointer focus:outline-none border-none transition-colors"
          >
            <option value="" disabled>Enter Client Workspace...</option>
            {clients.map(client => {
              const clientTenants = tenants.filter(t => t.clientId === client.id);
              const clientTenantIds = clientTenants.map(t => t.id);
              const adminUser = users.find(u => clientTenantIds.includes(u.tenantId) && u.role === Role.ADMIN) ||
                                users.find(u => clientTenantIds.includes(u.tenantId));
              return adminUser ? (
                <option key={client.id} value={adminUser.id}>
                  {client.logo} {client.name}
                </option>
              ) : null;
            })}
          </select>

          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-3.5 py-1.5 rounded-xl">
            <Activity className="w-4 h-4 text-indigo-600 animate-pulse" />
            <span className="text-[10px] font-bold font-mono text-indigo-700 uppercase tracking-wider">
              Horae Engine Active
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Switcher Navigation */}
      <div className="flex border-b border-slate-200 gap-6">
        {[
          { id: "clients", label: "Clients Onboarding", icon: Briefcase },
          { id: "outlets", label: "Outlet Provisioning", icon: Building2 },
          { id: "staff", label: "Staff Directory", icon: Users }
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 pb-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === t.id
                  ? "border-indigo-600 text-indigo-600 font-bold"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Dynamic Tab Panels */}
      <div className="min-h-[450px]">
        <AnimatePresence mode="wait">
          {activeTab === "clients" && (
            <motion.div
              key="clients"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Form Card */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 h-fit">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-4.5 h-4.5 text-indigo-600" />
                  Onboard Brand Client
                </h3>

                <form onSubmit={handleCreateClient} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Company ID / Identifier (for Login)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. cakewala"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Brand Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Cakewala or Eshanya"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
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
                        value={clientLogo}
                        onChange={(e) => setClientLogo(e.target.value)}
                        className="w-full text-center text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Subscription Plan
                      </label>
                      <select
                        value={clientPlan}
                        onChange={(e) => setClientPlan(e.target.value as any)}
                        className="w-full text-xs px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
                      >
                        <option value="Free">Free (15 Days Trial)</option>
                        <option value="Essential">Essential</option>
                        <option value="Pro">Pro</option>
                        <option value="Enterprise">Enterprise</option>
                        <option value="Training">Training</option>
                      </select>
                    </div>
                  </div>

                  {/* Training add-on + derived feature preview */}
                  <TrainingAddonToggle plan={clientPlan} value={clientTrainingAddon} onChange={setClientTrainingAddon} />
                  <PlanFeaturePreview plan={clientPlan} trainingAddon={clientTrainingAddon} />

                  {clientSuccessMsg && (
                    <div className="p-2.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-[10px] font-semibold flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      {clientSuccessMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-200 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Onboard Brand
                  </button>
                </form>
              </div>

              {/* Table Card */}
              <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <h3 className="font-bold text-sm text-slate-800">Currently Onboarded Clients</h3>
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="px-4 py-3">Brand</th>
                        <th className="px-4 py-3">Client ID</th>
                        <th className="px-4 py-3">Plan</th>
                        <th className="px-4 py-3">Onboarded At</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs">
                      {clients.map(client => (
                        <tr key={client.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 flex items-center gap-2">
                            <span className="text-xl">{client.logo}</span>
                            <span className="font-semibold text-slate-800">{client.name}</span>
                          </td>
                          <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{client.id}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              client.plan === "Enterprise"
                                ? "bg-purple-50 text-purple-600"
                                : "bg-indigo-50 text-indigo-600"
                            }`}>
                              {client.plan}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-[10px]">
                            {new Date(client.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right space-x-2">
                            <button
                              onClick={() => {
                                setEditingClient(client);
                                setEditName(client.name);
                                setEditLogo(client.logo);
                                setEditPlan(client.plan);
                                setEditTrainingAddon(!!client.trainingAddon);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                              title="Edit Client"
                            >
                              <Edit2 className="w-3 h-3" />
                              Edit
                            </button>
                            <button
                              onClick={() => setDeletingClientId(client.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="Delete Client"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "outlets" && (
            <motion.div
              key="outlets"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Form Card */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 h-fit">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <Building2 className="w-4.5 h-4.5 text-indigo-600" />
                  Provision Outlet Workspace
                </h3>

                <form onSubmit={handleCreateOutlet} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Target Brand Client
                    </label>
                    <select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      className="w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
                    >
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.logo} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

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
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
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
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
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
                        className="w-full text-center text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
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
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-200 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Provision Workspace
                  </button>
                </form>
              </div>

              {/* Table / List Card */}
              <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-800">Outlets Provisioned</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Filter:</span>
                    <select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      className="text-xs border border-slate-200 px-2 py-1 rounded-lg bg-slate-50 cursor-pointer"
                    >
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.logo} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  {clientOutlets.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No outlets provisioned under this client organization yet.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <th className="px-4 py-3">Outlet Workspace</th>
                          <th className="px-4 py-3">Tenant ID</th>
                          <th className="px-4 py-3">Subdomain routing</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-xs">
                        {clientOutlets.map(out => (
                          <tr key={out.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 flex items-center gap-2">
                              <span className="text-lg">{out.logo}</span>
                              <span className="font-semibold text-slate-800">{out.name}</span>
                            </td>
                            <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{out.id}</td>
                            <td className="px-4 py-3 font-mono text-indigo-600 text-[10px]">
                              {out.subdomain}
                            </td>
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
            </motion.div>
          )}

          {activeTab === "staff" && (
            <motion.div
              key="staff"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Onboard Staff Form */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 h-fit">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <UserPlus className="w-4.5 h-4.5 text-indigo-600" />
                  Onboard Workspace User
                </h3>

                <form onSubmit={handleOnboardStaff} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Target Brand Client
                    </label>
                    <select
                      value={staffClientFilter}
                      onChange={(e) => handleStaffClientFilterChange(e.target.value)}
                      className="w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
                    >
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.logo} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Assign Outlet Workspace
                    </label>
                    <select
                      value={staffTenantId}
                      onChange={(e) => setStaffTenantId(e.target.value)}
                      className="w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
                    >
                      {clientOutlets.map(o => (
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
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Email Address <span className="text-slate-400 font-medium normal-case">(optional if mobile is given)</span>
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. vikram@cakewala.com"
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Mobile Number <span className="text-slate-400 font-medium normal-case">(10 digits — WhatsApp + login)</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g., 9876543210"
                      value={staffPhone}
                      onChange={(e) => {
                        // Keep just the 10-digit number (pastes like +91 98765 43210 or 09876543210 work too)
                        let d = e.target.value.replace(/\D/g, "");
                        if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
                        if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
                        setStaffPhone(d.slice(0, 10));
                      }}
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Assigned Role
                      </label>
                      <select
                        value={isCustomRole ? "CUSTOM" : staffRole}
                        onChange={(e) => {
                          if (e.target.value === "CUSTOM") {
                            setIsCustomRole(true);
                          } else {
                            setIsCustomRole(false);
                            setStaffRole(e.target.value);
                          }
                        }}
                        className="w-full text-xs px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
                      >
                        {availableRoles.map(role => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                        <option value="CUSTOM">+ Add Custom Role...</option>
                      </select>
                      {isCustomRole && (
                        <input
                          type="text"
                          required
                          placeholder="Enter custom role..."
                          value={customRole}
                          onChange={(e) => setCustomRole(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors mt-2"
                        />
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Department
                      </label>
                      <select
                        value={isCustomDept ? "CUSTOM" : staffDept}
                        onChange={(e) => {
                          if (e.target.value === "CUSTOM") {
                            setIsCustomDept(true);
                          } else {
                            setIsCustomDept(false);
                            setStaffDept(e.target.value);
                          }
                        }}
                        className="w-full text-xs px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
                      >
                        {availableDepts.map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                        <option value="CUSTOM">+ Add Custom Department...</option>
                      </select>
                      {isCustomDept && (
                        <input
                          type="text"
                          required
                          placeholder="Enter custom department..."
                          value={customDept}
                          onChange={(e) => setCustomDept(e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors mt-2"
                        />
                      )}
                    </div>
                  </div>

                  {staffSuccessMsg && (
                    <div className="p-2.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-[10px] font-semibold flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      {staffSuccessMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-200 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Onboard Staff
                  </button>
                </form>
              </div>

              {/* Directory Listing */}
              <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-800">Workspace User Directory</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Brand:</span>
                      <select
                        value={staffClientFilter}
                        onChange={(e) => handleStaffClientFilterChange(e.target.value)}
                        className="text-xs border border-slate-200 px-2 py-1 rounded-lg bg-slate-50 cursor-pointer"
                      >
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.logo} {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  {users.filter(u => {
                    const matchedTenant = tenants.find(t => t.id === u.tenantId);
                    return matchedTenant && matchedTenant.clientId === staffClientFilter;
                  }).length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No staff onboarded under this brand organization yet.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <th className="px-4 py-3">Staff Member</th>
                          <th className="px-4 py-3">Outlet/Workspace</th>
                          <th className="px-4 py-3">Role & Dept</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-xs">
                        {users.filter(u => {
                          const matchedTenant = tenants.find(t => t.id === u.tenantId);
                          return matchedTenant && matchedTenant.clientId === staffClientFilter;
                        }).map(usr => {
                          const userTenant = tenants.find(t => t.id === usr.tenantId);
                          return (
                            <tr key={usr.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 flex items-center gap-3">
                                <img
                                  src={usr.avatar}
                                  alt={usr.name}
                                  className="w-7 h-7 rounded-lg object-cover bg-slate-100 text-[8px] text-slate-400"
                                />
                                <div>
                                  <span className="font-semibold block text-slate-800">{usr.name}</span>
                                  <span className="text-[10px] text-slate-400 block font-mono">{usr.email || usr.phoneNumber || "—"}</span>
                                  <span className="text-[9px] text-slate-500 font-mono font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded w-fit block mt-0.5" title="Login Password">
                                    🔑 {store.getPasswordForEmail(store.loginKeyFor(usr))}
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Modals for Client Edit/Delete */}
      <AnimatePresence>
        {editingClient && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="edit-client-modal">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6 space-y-4 relative"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-slate-800">Edit Brand Client Details</h3>
                <button 
                  onClick={() => setEditingClient(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onUpdateClient(editingClient.id, editName, editLogo, editPlan, plans.trainingAddonApplies(editPlan) && editTrainingAddon);
                  setEditingClient(null);
                }}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Company ID / Identifier (Read-Only)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={editingClient.id}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 font-mono select-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Brand Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cakewala"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
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
                      value={editLogo}
                      onChange={(e) => setEditLogo(e.target.value)}
                      className="w-full text-center text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Subscription Plan
                    </label>
                    <select
                      value={editPlan}
                      onChange={(e) => setEditPlan(e.target.value as any)}
                      className="w-full text-xs px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
                    >
                      <option value="Free">Free (15 Days Trial)</option>
                      <option value="Essential">Essential</option>
                      <option value="Pro">Pro</option>
                      <option value="Enterprise">Enterprise</option>
                      <option value="Training">Training</option>
                    </select>
                  </div>
                </div>

                {/* Training add-on + derived feature preview */}
                <TrainingAddonToggle plan={editPlan} value={editTrainingAddon} onChange={setEditTrainingAddon} />
                <PlanFeaturePreview plan={editPlan} trainingAddon={editTrainingAddon} />

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingClient(null)}
                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-500 font-semibold rounded-xl text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {deletingClientId && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="delete-client-modal">
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
                <h3 className="font-bold text-base text-slate-800">Delete Brand Client?</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Are you sure you want to delete this brand client? This will delete all its outlets, onboarded staff, tasks, checklists, and all associated data. This action is irreversible.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingClientId(null)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-500 font-semibold rounded-xl text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteClient(deletingClientId);
                    setDeletingClientId(null);
                  }}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
                >
                  Delete Client
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {editingTenant && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="edit-tenant-modal">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6 space-y-4 relative"
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
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
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
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
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
                      className="w-full text-center text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Subscription Plan
                    </label>
                    <select
                      value={editTenantPlan}
                      onChange={(e) => setEditTenantPlan(e.target.value as any)}
                      className="w-full text-xs px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
                    >
                      <option value="Free">Free (15 Days Trial)</option>
                      <option value="Essential">Essential</option>
                      <option value="Pro">Pro</option>
                      <option value="Enterprise">Enterprise</option>
                      <option value="Training">Training</option>
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
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {deletingTenantId && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="delete-tenant-modal">
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
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="edit-user-modal">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6 space-y-4 relative"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-slate-800">Edit Staff Details & Roles</h3>
                <button 
                  onClick={() => setEditingUser(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
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
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-450 font-mono select-none"
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
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
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
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
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
                      className="w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
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
                      className="w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
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
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {deletingUserId && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="delete-user-modal">
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
      </AnimatePresence>
    </div>
  );
}
