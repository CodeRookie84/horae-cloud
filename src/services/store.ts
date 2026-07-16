/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Client,
  Tenant, 
  User, 
  Notice, 
  Checklist, 
  ChecklistItem,
  Task, 
  OperationalNotification, 
  Department, 
  Role,
  ChatMessage,
  Quiz,
  QuizAttempt,
  SOP,
  SOPReadStatus,
  isTargetMatched
} from "../types";
import supabase from "./supabaseClient";
import * as chatService from "./chatService";
import * as plans from "./plans";

export class StoreService {
  // Active Simulated States (Client & Tenant focus & acting user role validation)
  private activeClientId: string = "client-system";
  private activeTenantId: string = "tenant-system";
  private activeUserId: string = "user-superadmin"; // Default active user

  constructor() {
    this.loadState();
  }

  private loadState() {
    this.activeClientId = localStorage.getItem("horae_active_client_id") || "client-system";
    this.activeTenantId = localStorage.getItem("horae_active_tenant_id") || "tenant-system";
    this.activeUserId = localStorage.getItem("horae_active_user_id") || "user-superadmin";
  }

  // Active state switch tools
  public getActiveClientId(): string {
    return this.activeClientId;
  }

  public async getActiveClient(): Promise<Client> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', this.activeClientId)
      .single();
    
    if (error || !data) {
      const clients = await this.getAllClients();
      return clients[0];
    }
    return this.mapClient(data);
  }

  /** Map a raw `clients` row → Client, deriving feature entitlements from the plan. */
  private mapClient(c: any): Client {
    const trainingAddon = !!c.training_addon;
    return {
      id: c.id,
      name: c.name,
      logo: c.logo,
      plan: c.plan,
      createdAt: c.created_at,
      trainingAddon,
      services: plans.planFeatures(c.plan, { trainingAddon, createdAt: c.created_at }),
    };
  }

  public async getAllClients(): Promise<Client[]> {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('name');

    return (data || []).map(c => this.mapClient(c));
  }

  public async getActiveTenant(): Promise<Tenant> {
    const { data } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', this.activeTenantId)
      .single();
    
    if (!data) {
      const tenants = await this.getAllTenants();
      return tenants[0];
    }
    return {
      id: data.id,
      clientId: data.client_id,
      name: data.name,
      subdomain: data.subdomain,
      logo: data.logo,
      plan: data.plan,
      createdAt: data.created_at
    };
  }

  /**
   * The key a user's password is cached under (and the value stored in the login
   * session). Email when present, else phone number, else the user id — so
   * phone-only staff (no email) still resolve to a stable, collision-free key.
   */
  public loginKeyFor(u: { email?: string | null; phoneNumber?: string | null; phone_number?: string | null; id?: string }): string {
    return String(u.email || u.phoneNumber || (u as any).phone_number || u.id || "").toLowerCase().trim();
  }

  private mapUserRecord(u: any): User {
    let avatar = u.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150";
    let pwd = "";
    const pwdKey = this.loginKeyFor(u);
    if (avatar.includes("#pwd=")) {
      const parts = avatar.split("#pwd=");
      avatar = parts[0];
      pwd = parts[1];
      this.saveStaffPassword(pwdKey, pwd);
    } else {
      const passwords = this.getStaffPasswords();
      const localPwd = passwords[pwdKey];
      if (localPwd) {
        pwd = localPwd;
        const updatedAvatar = (u.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150") + "#pwd=" + localPwd;
        supabase
          .from('users')
          .update({ avatar: updatedAvatar })
          .eq('id', u.id)
          .then(({ error }) => {
            if (error) console.error("Auto-sync password to DB failed:", error);
          });
      } else {
        pwd = this.generateRandomPassword();
        this.saveStaffPassword(pwdKey, pwd);
        const updatedAvatar = (u.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150") + "#pwd=" + pwd;
        supabase
          .from('users')
          .update({ avatar: updatedAvatar })
          .eq('id', u.id)
          .then(({ error }) => {
            if (error) console.error("Auto-sync generated password to DB failed:", error);
          });
      }
    }
    return {
      id: u.id,
      name: u.name,
      email: u.email || "",
      role: this.normalizeRole(u.role),
      department: this.normalizeDept(u.department),
      tenantId: u.tenant_id,
      avatar,
      isOnline: u.is_online,
      phoneNumber: u.phone_number || undefined,
      whatsappOptedIn: u.whatsapp_opted_in || false,
      fcmToken: u.fcm_token || undefined,
      lastSeenAt: u.last_seen_at || undefined,
      clitAccess: u.clit_access || false,
      clitRole: u.clit_role || undefined,
    };
  }

  private normalizeRole(role: string): string {
    if (!role) return Role.STAFF;
    const r = role.toLowerCase().trim();
    if (r === 'super admin' || r === 'super_admin') return Role.SUPER_ADMIN;
    if (r === 'admin') return Role.ADMIN;
    if (r === 'manager') return Role.MANAGER;
    if (r === 'supervisor') return Role.SUPERVISOR;
    if (r === 'staff') return Role.STAFF;
    if (r === 'chef' || r === 'lead baker' || r === 'chef / lead baker' || r.includes('chef') || r.includes('lead baker')) return Role.CHEF;
    if (r === 'baker' || r === 'bread maker') return Role.BREAD_MAKER;
    if (r === 'packer') return Role.PACKER;
    if (r === 'cashier') return Role.CASHIER;
    return role; // Keep custom as is
  }

  private normalizeDept(dept: string): string {
    if (!dept) return Department.OUTLET;
    const d = dept.toLowerCase().trim();
    if (d === 'management') return Department.MANAGEMENT;
    if (d === 'kitchen' || d === 'baking' || d === 'kitchen & baking' || d.includes('kitchen') || d.includes('baking')) return Department.KITCHEN;
    if (d === 'packing' || d === 'inventory' || d === 'packing & inventory' || d.includes('packing') || d.includes('inventory')) return Department.PACKING;
    if (d === 'front desk' || d === 'sales' || d === 'front desk & sales' || d.includes('front desk') || d.includes('sales')) return Department.FRONT_DESK;
    if (d === 'outlet') return Department.OUTLET;
    if (d === 'store') return Department.STORE;
    return dept; // Keep custom as is
  }

  public async getActiveUser(): Promise<User> {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', this.activeUserId)
      .single();
    
    if (!data) {
      const users = await this.getAllUsers();
      return users[0];
    }
    return this.mapUserRecord(data);
  }

  public async getAllTenants(): Promise<Tenant[]> {
    const { data } = await supabase.from('tenants').select('*');
    return (data || []).map(t => ({
      id: t.id,
      clientId: t.client_id,
      name: t.name,
      subdomain: t.subdomain,
      logo: t.logo,
      plan: t.plan,
      createdAt: t.created_at
    }));
  }

  public async getAllUsers(): Promise<User[]> {
    const { data } = await supabase.from('users').select('*');
    return (data || []).map(u => this.mapUserRecord(u));
  }

  public async getTenantsByClient(clientId: string): Promise<Tenant[]> {
    const { data } = await supabase
      .from('tenants')
      .select('*')
      .eq('client_id', clientId);
    
    return (data || []).map(t => ({
      id: t.id,
      clientId: t.client_id,
      name: t.name,
      subdomain: t.subdomain,
      logo: t.logo,
      plan: t.plan,
      createdAt: t.created_at
    }));
  }

  // Get users belonging ONLY to current tenant
  public async getTenantUsers(): Promise<User[]> {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('tenant_id', this.activeTenantId);
    
    return (data || []).map(u => this.mapUserRecord(u));
  }

  public async setActiveClient(clientId: string) {
    this.activeClientId = clientId;
    localStorage.setItem("horae_active_client_id", clientId);
    
    // Switch active workspace to first tenant under this client
    const tenants = await this.getTenantsByClient(clientId);
    if (tenants.length > 0) {
      await this.setActiveTenant(tenants[0].id);
    }
  }

  public async setActiveTenant(tenantId: string) {
    this.activeTenantId = tenantId;
    localStorage.setItem("horae_active_tenant_id", tenantId);
    
    // Sync client
    const { data: tenant } = await supabase
      .from('tenants')
      .select('client_id')
      .eq('id', tenantId)
      .single();
    
    if (tenant && tenant.client_id !== this.activeClientId) {
      this.activeClientId = tenant.client_id;
      localStorage.setItem("horae_active_client_id", tenant.client_id);
    }
    
    // Auto-update active user to the first match of this new tenant to make switcher clean!
    const matchedUsers = await this.getTenantUsers();
    if (matchedUsers.length > 0) {
      this.setActiveUser(matchedUsers[0].id);
    }
  }

  public async setActiveUser(userId: string) {
    this.activeUserId = userId;
    localStorage.setItem("horae_active_user_id", userId);
    
    // Sync tenant is matching
    const { data: u } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .single();
    
    if (u && u.tenant_id !== this.activeTenantId) {
      this.activeTenantId = u.tenant_id;
      localStorage.setItem("horae_active_tenant_id", u.tenant_id);
      
      const { data: tenant } = await supabase
        .from('tenants')
        .select('client_id')
        .eq('id', u.tenant_id)
        .single();
      
      if (tenant && tenant.client_id !== this.activeClientId) {
        this.activeClientId = tenant.client_id;
        localStorage.setItem("horae_active_client_id", tenant.client_id);
      }
    }
  }

  // --- Horae PASSWORD & SERVICES HELPERS ---
  public generateRandomPassword(): string {
    const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    const all = alphabet + numbers;
    
    // Retrieve existing passwords to ensure uniqueness
    const passwords = this.getStaffPasswords();
    const existing = new Set(Object.values(passwords));
    
    while (true) {
      let pass = "";
      pass += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
      pass += numbers.charAt(Math.floor(Math.random() * numbers.length));
      for (let i = 2; i < 6; i++) {
        pass += all.charAt(Math.floor(Math.random() * all.length));
      }
      const shuffled = pass.split('').sort(() => 0.5 - Math.random()).join('');
      if (!existing.has(shuffled)) {
        return shuffled;
      }
    }
  }

  public getStaffPasswords(): Record<string, string> {
    const data = localStorage.getItem("horae_staff_passwords");
    const passwords = data ? JSON.parse(data) : {};
    if (!passwords["coderookie84@gmail.com"]) {
      passwords["coderookie84@gmail.com"] = "!Horae@2026";
    }
    if (!passwords["admin@horae.ops"]) {
      passwords["admin@horae.ops"] = "!Horae@2026";
    }
    return passwords;
  }

  public saveStaffPassword(email: string, password: string) {
    const passwords = this.getStaffPasswords();
    passwords[email.toLowerCase().trim()] = password;
    localStorage.setItem("horae_staff_passwords", JSON.stringify(passwords));
  }

  public getPasswordForEmail(email: string): string {
    const passwords = this.getStaffPasswords();
    const cleanEmail = email.toLowerCase().trim();
    if (!passwords[cleanEmail]) {
      const newPwd = this.generateRandomPassword();
      this.saveStaffPassword(cleanEmail, newPwd);
      return newPwd;
    }
    return passwords[cleanEmail];
  }

  public async updateUserPassword(identifier: string, newPassword: string): Promise<void> {
    this.saveStaffPassword(identifier, newPassword);

    // `identifier` is an email or a mobile number — match the right column.
    const clean = identifier.trim();
    const isEmail = clean.includes('@');
    const { data: matchedUsers } = await supabase
      .from('users')
      .select('*')
      .eq(isEmail ? 'email' : 'phone_number', isEmail ? clean.toLowerCase() : clean.replace(/\s+/g, ''));

    if (matchedUsers && matchedUsers.length > 0) {
      for (const u of matchedUsers) {
        let baseAvatar = u.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150";
        if (baseAvatar.includes("#pwd=")) {
          baseAvatar = baseAvatar.split("#pwd=")[0];
        }
        const newAvatar = baseAvatar + "#pwd=" + newPassword;
        await supabase
          .from('users')
          .update({ avatar: newAvatar })
          .eq('id', u.id);
      }
    }
  }

  /**
   * Feature entitlements are DERIVED from the plan (+ Training add-on) — see
   * plans.ts. This wrapper keeps the old signature; the add-on flag is read from
   * the client row by mapClient, so callers that only have a plan get the base set.
   */
  public getClientServicesSync(_clientId: string, plan: string, createdAt?: string, trainingAddon?: boolean): string[] {
    return plans.planFeatures(plan, { trainingAddon, createdAt });
  }

  // --- Horae LOGIN / AUTHENTICATION METHODS ---
  /**
   * `identifier` may be an email OR a mobile number. Emails match the `email`
   * column; anything without an "@" is treated as a phone number and matched
   * against `phone_number`. Passwords live on the user row (`avatar#pwd=`), so
   * phone-only staff (no email) authenticate the same way.
   */
  public async verifyLogin(companyId: string, identifier: string, password?: string): Promise<User | null> {
    const cleanId = identifier.trim();
    const isEmail = cleanId.includes('@');
    const cleanEmail = cleanId.toLowerCase();
    const cleanPhone = cleanId.replace(/\s+/g, '');
    const cleanCompanyId = companyId.toLowerCase().trim().replace(/\s+/g, '-');

    if (cleanEmail === 'coderookie84@gmail.com') {
      const correctPassword = this.getPasswordForEmail(cleanEmail);
      if (!password || password !== correctPassword) {
        return null;
      }
      // Platform Super Admin logs in
      const { data: adminUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', 'user-superadmin')
        .single();
      
      if (adminUser) {
        localStorage.setItem("horae_logged_in_email", cleanEmail);
        await this.setActiveUser(adminUser.id);
        return this.mapUserRecord(adminUser);
      }
      return null;
    }

    // Normal client user login
    // 1. Fetch target client
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', cleanCompanyId)
      .single();

    if (!client) return null;

    // 2. Fetch all tenants of this client
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id')
      .eq('client_id', client.id);

    if (!tenants || tenants.length === 0) return null;

    const tenantIds = tenants.map(t => t.id);

    // 3. Find the user by email OR phone number belonging to one of these tenants
    const { data: matchedUsers } = await supabase
      .from('users')
      .select('*')
      .eq(isEmail ? 'email' : 'phone_number', isEmail ? cleanEmail : cleanPhone)
      .in('tenant_id', tenantIds);

    if (!matchedUsers || matchedUsers.length === 0) return null;

    // Found! Use the first matching user persona
    const user = matchedUsers[0];
    const pwdKey = this.loginKeyFor(user);

    // Now extract correct password from user record or local storage
    let correctPassword = "Horae1";
    if (user.avatar && user.avatar.includes("#pwd=")) {
      correctPassword = user.avatar.split("#pwd=")[1];
      this.saveStaffPassword(pwdKey, correctPassword);
    } else {
      correctPassword = this.getPasswordForEmail(pwdKey);
    }

    if (!password || password !== correctPassword) {
      return null;
    }

    localStorage.setItem("horae_logged_in_email", pwdKey);
    // Clear stale client/tenant context from any previous session before setting the new user
    localStorage.removeItem("horae_active_client_id");
    localStorage.removeItem("horae_active_tenant_id");
    await this.setActiveUser(user.id);
    return this.mapUserRecord(user);
  }

  public getLoggedInEmail(): string | null {
    return localStorage.getItem("horae_logged_in_email");
  }

  public logout() {
    localStorage.removeItem("horae_logged_in_email");
    localStorage.removeItem("horae_active_user_id");
    localStorage.removeItem("horae_active_client_id");
    localStorage.removeItem("horae_active_tenant_id");
  }

  // --- Horae ONBOARDING METHODS ---
  public async addClient(id: string, name: string, logo: string, plan: "Free" | "Essential" | "Pro" | "Enterprise" | "Training", trainingAddon: boolean = false): Promise<Client> {
    const cleanId = id.toLowerCase().trim().replace(/\s+/g, '-');
    const newClient = {
      id: cleanId,
      name,
      logo,
      plan,
      training_addon: trainingAddon,
      created_at: new Date().toISOString()
    };
    await supabase.from('clients').insert([newClient]);
    return this.mapClient(newClient);
  }

  public async updateClient(clientId: string, name: string, logo: string, plan: "Free" | "Essential" | "Pro" | "Enterprise" | "Training", trainingAddon: boolean = false): Promise<void> {
    const cleanId = clientId.toLowerCase().trim().replace(/\s+/g, '-');
    await supabase
      .from('clients')
      .update({ name, logo, plan, training_addon: trainingAddon })
      .eq('id', cleanId);
  }

  public async deleteClient(clientId: string): Promise<void> {
    const cleanId = clientId.toLowerCase().trim().replace(/\s+/g, '-');
    
    // 1. Get all tenants of this client
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id')
      .eq('client_id', cleanId);
    
    if (tenants && tenants.length > 0) {
      const tenantIds = tenants.map(t => t.id);
      
      // Delete checklist items
      const { data: checklists } = await supabase
        .from('checklists')
        .select('id')
        .in('tenant_id', tenantIds);
      
      if (checklists && checklists.length > 0) {
        const checklistIds = checklists.map(c => c.id);
        await supabase.from('checklist_items').delete().in('checklist_id', checklistIds);
        await supabase.from('checklists').delete().in('id', checklistIds);
      }
      
      // Delete task messages
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id')
        .in('tenant_id', tenantIds);
      
      if (tasks && tasks.length > 0) {
        const taskIds = tasks.map(t => t.id);
        await supabase.from('task_messages').delete().in('task_id', taskIds);
        await supabase.from('tasks').delete().in('id', taskIds);
      }
      
      // Delete notices, notifications, users, tenants
      await supabase.from('notices').delete().in('tenant_id', tenantIds);
      await supabase.from('notifications').delete().in('tenant_id', tenantIds);
      await supabase.from('users').delete().in('tenant_id', tenantIds);
      await supabase.from('tenants').delete().in('id', tenantIds);
      
      // Clean local storage items
      const quizzes = await this.getQuizzes();
      const updatedQuizzes = quizzes.filter(q => q.tenantId === "ALL" || !tenantIds.includes(q.tenantId));
      localStorage.setItem("horae_quizzes", JSON.stringify(updatedQuizzes));

      const sops = await this.getSOPs();
      const updatedSOPs = sops.filter(s => s.tenantId === "ALL" || !tenantIds.includes(s.tenantId));
      localStorage.setItem("horae_sops", JSON.stringify(updatedSOPs));
    }
    
    // 2. Delete the client itself
    await supabase.from('clients').delete().eq('id', cleanId);

    // If active client was deleted, switch to another brand or reset
    if (this.activeClientId === cleanId) {
      const remainingClients = await this.getAllClients();
      const otherClient = remainingClients.find(c => c.id !== cleanId && c.id !== 'client-system' && c.id !== 'client-hq');
      if (otherClient) {
        await this.setActiveClient(otherClient.id);
      } else {
        localStorage.removeItem("horae_active_client_id");
        localStorage.removeItem("horae_active_tenant_id");
        localStorage.removeItem("horae_active_user_id");
        this.loadState();
      }
    }
  }

  public async addTenant(clientId: string, name: string, subdomain: string, logo: string, plan: "Free" | "Essential" | "Pro" | "Enterprise" | "Training"): Promise<Tenant> {
    const newTenant = {
      id: "tenant-" + Date.now(),
      client_id: clientId,
      name,
      subdomain,
      logo,
      plan,
      created_at: new Date().toISOString()
    };
    await supabase.from('tenants').insert([newTenant]);
    return {
      id: newTenant.id,
      clientId: newTenant.client_id,
      name: newTenant.name,
      subdomain: newTenant.subdomain,
      logo: newTenant.logo,
      plan: newTenant.plan,
      createdAt: newTenant.created_at
    };
  }

  public async updateTenant(tenantId: string, name: string, subdomain: string, logo: string, plan: "Free" | "Essential" | "Pro" | "Enterprise" | "Training"): Promise<void> {
    await supabase
      .from('tenants')
      .update({ name, subdomain, logo, plan })
      .eq('id', tenantId);
  }

  public async deleteTenant(tenantId: string): Promise<void> {
    // 1. Delete checklists and checklist items
    const { data: checklists } = await supabase
      .from('checklists')
      .select('id')
      .eq('tenant_id', tenantId);
    
    if (checklists && checklists.length > 0) {
      const checklistIds = checklists.map(c => c.id);
      await supabase.from('checklist_items').delete().in('checklist_id', checklistIds);
      await supabase.from('checklists').delete().in('id', checklistIds);
    }
    
    // 2. Delete tasks and messages
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('tenant_id', tenantId);
    
    if (tasks && tasks.length > 0) {
      const taskIds = tasks.map(t => t.id);
      await supabase.from('task_messages').delete().in('task_id', taskIds);
      await supabase.from('tasks').delete().in('id', taskIds);
    }
    
    // 3. Delete notices, notifications, users
    await supabase.from('notices').delete().eq('tenant_id', tenantId);
    await supabase.from('notifications').delete().eq('tenant_id', tenantId);
    await supabase.from('users').delete().eq('tenant_id', tenantId);
    
    // 4. Delete tenant record itself
    await supabase.from('tenants').delete().eq('id', tenantId);

    // 5. Clean local storage
    const quizzes = await this.getQuizzes();
    const updatedQuizzes = quizzes.filter(q => q.tenantId !== tenantId);
    localStorage.setItem("horae_quizzes", JSON.stringify(updatedQuizzes));

    const sops = await this.getSOPs();
    const updatedSOPs = sops.filter(s => s.tenantId !== tenantId);
    localStorage.setItem("horae_sops", JSON.stringify(updatedSOPs));

    // Reset active tenant state if deleted
    if (this.activeTenantId === tenantId) {
      const remainingTenants = await this.getAllTenants();
      const otherTenant = remainingTenants.find(t => t.id !== tenantId && t.id !== 'tenant-system');
      if (otherTenant) {
        await this.setActiveTenant(otherTenant.id);
      } else {
        localStorage.removeItem("horae_active_tenant_id");
        this.loadState();
      }
    }
  }

  public async updateUser(
    userId: string, name: string, email: string, role: string, department: string,
    clitAccess?: boolean, clitRole?: string,
  ): Promise<void> {
    const normRole = this.normalizeRole(role);
    const normDept = this.normalizeDept(department);
    const patch: any = { name, email, role: normRole, department: normDept };
    if (clitAccess !== undefined) {
      patch.clit_access = !!clitAccess;
      patch.clit_role = clitAccess ? (clitRole || 'technician') : null;
    }
    await supabase
      .from('users')
      .update(patch)
      .eq('id', userId);
  }

  /** Grant/revoke CLIT (Equipment Maintenance) access + role for a staff member. */
  public async setClitAccess(userId: string, clitAccess: boolean, clitRole?: string): Promise<void> {
    await supabase
      .from('users')
      .update({ clit_access: !!clitAccess, clit_role: clitAccess ? (clitRole || 'technician') : null })
      .eq('id', userId);
  }

  public async deleteUser(userId: string): Promise<void> {
    // Disassociate from tasks
    await supabase
      .from('tasks')
      .update({ assigned_user_id: null })
      .eq('assigned_user_id', userId);

    await supabase
      .from('tasks')
      .update({ created_by_user_id: null })
      .eq('created_by_user_id', userId);

    // Delete user
    await supabase.from('users').delete().eq('id', userId);

    // Reset active user state if deleted
    if (this.activeUserId === userId) {
      const remainingUsers = await this.getAllUsers();
      const otherUser = remainingUsers.find(u => u.id !== userId && u.id !== 'user-superadmin');
      if (otherUser) {
        await this.setActiveUser(otherUser.id);
      } else {
        localStorage.removeItem("horae_active_user_id");
        this.loadState();
      }
    }
  }

  public async onboardingUser(
    tenantId: string,
    name: string,
    email: string,
    role: Role | string,
    department: Department | string,
    avatar: string,
    phoneNumber?: string,
    whatsappOptedIn?: boolean,
    clitAccess?: boolean,
    clitRole?: string
  ): Promise<User> {
    const cleanEmail = (email || "").trim();
    const cleanPhone = (phoneNumber || "").trim();

    // Email is optional, but a staff member needs at least one login identifier.
    if (!cleanEmail && !cleanPhone) {
      throw new Error("Provide an email address or a mobile number so this staff member can log in.");
    }

    // ── Duplicate identifier guard ─────────────────────────────
    if (cleanEmail) {
      const { data: existing, error: lookupError } = await supabase
        .from('users')
        .select('id, email')
        .ilike('email', cleanEmail)
        .limit(1);
      if (!lookupError && existing && existing.length > 0) {
        throw new Error(`A staff member with the email "${cleanEmail}" is already registered. Please use a different email address.`);
      }
    } else {
      const { data: existing } = await supabase
        .from('users')
        .select('id, phone_number')
        .eq('phone_number', cleanPhone.replace(/\s+/g, ''))
        .limit(1);
      if (existing && existing.length > 0) {
        throw new Error(`A staff member with the mobile number "${cleanPhone}" is already registered. Please use a different number.`);
      }
    }
    // ──────────────────────────────────────────────────────────

    const userId = "user-" + Date.now();
    const pwd = this.generateRandomPassword();
    // Cache the password under the same key login will use (email, else phone, else id).
    this.saveStaffPassword(cleanEmail || cleanPhone.replace(/\s+/g, '') || userId, pwd);

    const baseAvatar = avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150";
    const avatarWithPwd = baseAvatar + "#pwd=" + pwd;

    const normRole = this.normalizeRole(role);
    const normDept = this.normalizeDept(department);

    const newUser: any = {
      id: userId,
      name,
      email: cleanEmail || null,
      role: normRole,
      department: normDept,
      tenant_id: tenantId,
      avatar: avatarWithPwd,
    };

    if (cleanPhone) newUser.phone_number = cleanPhone.replace(/\s+/g, '');
    if (whatsappOptedIn !== undefined) newUser.whatsapp_opted_in = whatsappOptedIn;
    newUser.clit_access = !!clitAccess;
    newUser.clit_role = clitAccess ? (clitRole || 'technician') : null;

    await supabase.from('users').insert([newUser]);
    
    // Save to memory so it's available next time entry
    this.addCustomRole(normRole);
    this.addCustomDept(normDept);
    
    // Auto-add to Team Talk channels based on dept + role (zero manual setup needed)
    chatService.autoAddUserToChannels(tenantId, newUser.id, newUser.role, newUser.department).catch(console.error);
    return {
      id: newUser.id,
      name: newUser.name,
      email: cleanEmail || "",
      role: newUser.role,
      department: newUser.department,
      tenantId: newUser.tenant_id,
      avatar: baseAvatar,
      phoneNumber: cleanPhone || undefined,
      whatsappOptedIn: whatsappOptedIn || false,
      clitAccess: !!clitAccess,
      clitRole: clitAccess ? (clitRole || 'technician') : undefined,
    };
  }

  public getCustomRoles(): string[] {
    try {
      const stored = localStorage.getItem('horae_custom_roles');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  }

  public addCustomRole(role: string) {
    if (!role) return;
    const roles = new Set(this.getCustomRoles());
    roles.add(role);
    localStorage.setItem('horae_custom_roles', JSON.stringify(Array.from(roles)));
  }

  public getCustomDepts(): string[] {
    try {
      const stored = localStorage.getItem('horae_custom_depts');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  }

  public addCustomDept(dept: string) {
    if (!dept) return;
    const depts = new Set(this.getCustomDepts());
    depts.add(dept);
    localStorage.setItem('horae_custom_depts', JSON.stringify(Array.from(depts)));
  }

  /** Update a user's WhatsApp phone number and opt-in status */
  public async updateUserPhone(
    userId: string,
    phoneNumber: string,
    whatsappOptedIn: boolean
  ): Promise<void> {
    await supabase
      .from('users')
      .update({ phone_number: phoneNumber.trim(), whatsapp_opted_in: whatsappOptedIn })
      .eq('id', userId);
  }

  /** Save FCM token to the user's profile in the database */
  public async updateUserFCMToken(userId: string, fcmToken: string | null): Promise<void> {
    await supabase
      .from('users')
      .update({ fcm_token: fcmToken })
      .eq('id', userId);
  }

  /** Update last_seen_at for anti-spam (called periodically while app is open) */
  public async touchLastSeen(userId: string): Promise<void> {
    await supabase
      .from('users')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', userId);
  }

  // --- BUSINESS ENTITY CRUD ---

  // Notices Board
  public async getNotices(since?: string): Promise<Notice[]> {
    const curUser = await this.getActiveUser();
    const tenants = await this.getTenantsByClient(this.activeClientId);
    const tenantIds = tenants.map(t => t.id);
    let noticesQuery = supabase.from('notices').select('*').in('tenant_id', tenantIds);
    if (since) noticesQuery = noticesQuery.gt('updated_at', since);
    const { data, error } = await noticesQuery;
    if (since && error) throw error;

    const list = (data || []).map(notice => {
      let cleanContent = notice.content || "";
      let videoUrl = "";
      if (notice.content && notice.content.includes("---HORAE-METADATA---")) {
        const parts = notice.content.split("---HORAE-METADATA---");
        cleanContent = parts[0].trim();
        try {
          const meta = JSON.parse(parts[1].trim());
          videoUrl = meta.videoUrl || "";
        } catch (e) {}
      }

      let subject: string | undefined = undefined;
      if (cleanContent.startsWith("---SUBJECT: ")) {
        const idx = cleanContent.indexOf("---\n");
        if (idx !== -1) {
          subject = cleanContent.substring(12, idx);
          cleanContent = cleanContent.substring(idx + 4);
        }
      }

      return {
        id: notice.id,
        tenantId: notice.tenant_id,
        title: notice.title,
        content: cleanContent,
        videoUrl,
        subject,
        isUrgent: notice.is_urgent,
        department: notice.department as Department,
        role: notice.role as Role,
        createdAt: notice.created_at,
        createdBy: {
          userId: notice.created_by_user_id,
          name: notice.created_by_name,
          role: notice.created_by_role
        }
      };
    });

    return list.filter(notice => {
      if (curUser.role === Role.ADMIN || curUser.role === Role.MANAGER || curUser.role === Role.SUPER_ADMIN) {
        return true; 
      }
      const matchDept = isTargetMatched(notice.department, curUser.department, Department.ALL);
      const matchRole = isTargetMatched(notice.role, curUser.role, Role.ALL);
      return matchDept && matchRole;
    }).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async addNotice(title: string, content: string, dept: Department | string, role: Role | string, isUrgent: boolean, tenantId: string, subject?: string): Promise<Notice> {
    const me = await this.getActiveUser();
    const clientTenants = await this.getTenantsByClient(this.activeClientId);
    
    let targetTenantIds: string[] = [];
    if (tenantId === "ALL") {
      targetTenantIds = clientTenants.map(t => t.id);
    } else {
      targetTenantIds = [tenantId];
    }

    let finalContent = content;
    if (subject && subject.trim()) {
      finalContent = `---SUBJECT: ${subject.trim()}---\n${content}`;
    }

    const newNotices = targetTenantIds.map((tId, idx) => ({
      id: `notice-${Date.now()}-${idx}`,
      tenant_id: tId,
      title,
      content: finalContent,
      is_urgent: isUrgent,
      department: dept,
      role,
      created_at: new Date().toISOString(),
      created_by_user_id: me.id,
      created_by_name: me.name,
      created_by_role: me.role
    }));

    await supabase.from('notices').insert(newNotices);

    // Send notifications to each target outlet
    await Promise.all(targetTenantIds.map(tId =>
      this.addNotification(
        isUrgent ? "CRITICAL Notice: " + title : "New Notice: " + title,
        "Posted under department " + dept + " — Target: " + role,
        "notice",
        dept,
        role,
        undefined,
        tId
      )
    ));

    return {
      id: newNotices[0].id,
      tenantId: newNotices[0].tenant_id,
      title: newNotices[0].title,
      content: newNotices[0].content,
      isUrgent: newNotices[0].is_urgent,
      department: newNotices[0].department as Department,
      role: newNotices[0].role as Role,
      createdAt: newNotices[0].created_at,
      createdBy: {
        userId: newNotices[0].created_by_user_id,
        name: newNotices[0].created_by_name,
        role: newNotices[0].created_by_role
      }
    };
  }

  public async deleteNotice(noticeId: string): Promise<void> {
    await supabase.from('notices').delete().eq('id', noticeId);
  }

  // Checklist Routines
  public async getChecklists(since?: string): Promise<Checklist[]> {
    const curUser = await this.getActiveUser();
    const tenants = await this.getTenantsByClient(this.activeClientId);
    const tenantIds = tenants.map(t => t.id);

    let checklistsQuery = supabase.from('checklists').select('*').in('tenant_id', tenantIds);
    if (since) checklistsQuery = checklistsQuery.gt('updated_at', since);
    const { data: checklistsData, error: checklistsError } = await checklistsQuery;
    if (since && checklistsError) throw checklistsError;

    if (!checklistsData || checklistsData.length === 0) return [];

    // Pre-parse to build group submissions map and filter out non-compliance checklists
    const groupSubmissionsMap: Record<string, any[]> = {};
    const complianceChecklistsData = (checklistsData || []).filter(c => {
      try {
        if (c.description && c.description.startsWith("{")) {
          const obj = JSON.parse(c.description);
          if (obj.type === "sop" || obj.type === "quiz") return false;
          const gId = obj.groupId || `group-${c.id}`;
          if (obj.submissions && obj.submissions.length > 0) {
            if (!groupSubmissionsMap[gId]) {
              groupSubmissionsMap[gId] = [];
            }
            groupSubmissionsMap[gId].push(...obj.submissions);
          }
        }
      } catch (e) {}
      return true;
    });

    if (complianceChecklistsData.length === 0) return [];

    const { data: itemsData } = await supabase
      .from('checklist_items')
      .select('*')
      .in('checklist_id', complianceChecklistsData.map(c => c.id));

    const combined: Checklist[] = complianceChecklistsData.map(c => {
      // Parse description for recurrence details & attachment & submissions
      let parsedDesc = c.description;
      let recurrence = "One-time";
      let recurrenceDay = "";
      let translations: any = undefined;
      let attachment = "";
      let submissions: any[] = [];
      let customInputFields: string[] = [];
      let sections: any[] = [];
      let type: "single" | "yes_no" = "single";
      let adminNotes = "";
      let groupId = `group-${c.id}`;
      try {
        if (c.description && c.description.startsWith("{")) {
          const obj = JSON.parse(c.description);
          parsedDesc = obj.desc !== undefined ? obj.desc : c.description;
          recurrence = obj.recurrence || "One-time";
          recurrenceDay = obj.recurrenceDay || "";
          translations = obj.translations || undefined;
          attachment = obj.attachment || "";
          customInputFields = obj.customInputFields || [];
          sections = obj.sections || [];
          type = obj.type || "single";
          adminNotes = obj.adminNotes || "";
          groupId = obj.groupId || `group-${c.id}`;
          submissions = groupSubmissionsMap[groupId] || [];
        }
      } catch (e) {
        // Fallback for legacy text descriptions
      }

      // Fetch template items
      const templateItems = (itemsData || [])
        .filter(item => item.checklist_id === c.id)
        .map(item => ({
          id: item.id,
          text: item.text,
          completed: false,
          completedBy: null as any,
          completedAt: null as any
        }));

      // Sort templateItems by index parsed from ID (e.g. item-checklist-0, item-checklist-1)
      const getItemIndex = (id: string) => {
        const parts = id.split("-");
        return parseInt(parts[parts.length - 1] || "0", 10);
      };
      templateItems.sort((a, b) => getItemIndex(a.id) - getItemIndex(b.id));

      // Rewrite section item IDs if sections exist to match database item IDs
      let finalSections = sections || [];
      if (sections && sections.length > 0) {
        let globalItemIndex = 0;
        finalSections = sections.map(sec => ({
          ...sec,
          items: (sec.items || []).map((item: any) => {
            const dbItem = templateItems[globalItemIndex];
            const itemId = dbItem ? dbItem.id : `item-${c.id}-${globalItemIndex}`;
            globalItemIndex++;
            return {
              ...item,
              id: itemId
            };
          })
        }));
      }

      // Find latest submission within recurrence window for the CURRENT user
      const userSubmissions = (submissions || []).filter(sub => sub.submittedBy?.userId === curUser.id);
      const latestSubmission = userSubmissions.length > 0
        ? [...userSubmissions].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0]
        : null;

      let shouldShowCompleted = false;
      if (latestSubmission) {
        const subDateStr = latestSubmission.submittedAt.split("T")[0];
        const today = new Date();
        const todayStr = today.toISOString().split("T")[0];

        if (recurrence === "Daily") {
          if (subDateStr === todayStr) {
            shouldShowCompleted = true;
          }
        } else if (recurrence === "Weekly") {
          const getSunday = (d: Date) => {
            const dateCopy = new Date(d.getTime());
            const day = dateCopy.getDay();
            const diff = dateCopy.getDate() - day;
            return new Date(dateCopy.setDate(diff)).toISOString().split("T")[0];
          };
          const todaySun = getSunday(today);
          const subSun = getSunday(new Date(latestSubmission.submittedAt));
          if (subSun === todaySun) {
            shouldShowCompleted = true;
          }
        } else if (recurrence === "Custom") {
          const diffTime = Math.abs(today.getTime() - new Date(latestSubmission.submittedAt).getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays < 3) {
            shouldShowCompleted = true;
          }
        } else {
          // One-time checklists show completion forever once completed
          shouldShowCompleted = true;
        }
      }

      // Map template items to completed states from the latest submission
      // For yes_no checklists, mark all items as completed if the user submitted
      const finalItems = templateItems.map(item => {
        if (shouldShowCompleted && latestSubmission) {
          // For yes_no type, any submission means all items are "done"
          const isItemChecked = type === "yes_no" 
            ? true 
            : !!latestSubmission.items?.[item.id];
          return {
            ...item,
            completed: isItemChecked,
            completedBy: isItemChecked ? {
              userId: latestSubmission.submittedBy.userId,
              name: latestSubmission.submittedBy.name
            } : null,
            completedAt: isItemChecked ? latestSubmission.submittedAt : null
          };
        }
        return item;
      });

      return {
        id: c.id,
        tenantId: c.tenant_id,
        title: c.title,
        description: parsedDesc,
        department: c.department as Department,
        role: c.role as Role,
        createdAt: c.created_at,
        createdBy: {
          userId: c.created_by_user_id,
          name: c.created_by_name,
          role: c.created_by_role
        },
        items: finalItems,
        recurrence,
        recurrenceDay,
        translations,
        attachment,
        customInputFields,
        sections: finalSections,
        type,
        adminNotes,
        submissions,
        groupId
      } as any;
    });

    return combined.filter(checklist => {
      if (curUser.role === Role.ADMIN || curUser.role === Role.MANAGER || curUser.role === Role.SUPER_ADMIN) {
        return true; 
      }
      const matchDept = isTargetMatched(checklist.department, curUser.department, Department.ALL);
      const matchRole = isTargetMatched(checklist.role, curUser.role, Role.ALL);
      return matchDept && matchRole;
    }).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async createChecklist(
    title: string, 
    description: string, 
    dept: Department | string, 
    role: Role | string, 
    itemsText: string[], 
    tenantId: string,
    recurrence: string = "One-time",
    recurrenceDay: string = "",
    attachment: string = "",
    customInputFields?: string[],
    sections?: any[],
    type?: "single" | "yes_no",
    adminNotes?: string,
    groupId?: string
  ): Promise<Checklist> {
    const me = await this.getActiveUser();
    const clientTenants = await this.getTenantsByClient(this.activeClientId);
    const finalGroupId = groupId || `group-${Date.now()}`;
    
    let targetTenantIds: string[] = [];
    if (tenantId === "ALL") {
      targetTenantIds = clientTenants.map(t => t.id);
    } else {
      targetTenantIds = [tenantId];
    }

    // We will generate checklists for each target tenant
    const newChecklists = targetTenantIds.map((tId, idx) => ({
      id: `checklist-${Date.now()}-${idx}`,
      tenant_id: tId,
      title,
      description: JSON.stringify({
        desc: description,
        recurrence,
        recurrenceDay,
        attachment,
        customInputFields: customInputFields || [],
        sections: sections || [],
        type: type || "single",
        adminNotes: adminNotes || "",
        groupId: finalGroupId
      }),
      department: dept,
      role,
      created_at: new Date().toISOString(),
      created_by_user_id: me.id,
      created_by_name: me.name,
      created_by_role: me.role
    }));

    await supabase.from('checklists').insert(newChecklists);

    // Create checklist items for all checklists
    const checklistItems: any[] = [];
    newChecklists.forEach((chk) => {
      itemsText.forEach((txt, index) => {
        checklistItems.push({
          id: `item-${chk.id}-${index}`,
          checklist_id: chk.id,
          text: txt,
          completed: false
        });
      });
    });

    await supabase.from('checklist_items').insert(checklistItems);

    // Send notifications to each target outlet
    await Promise.all(targetTenantIds.map(tId =>
      this.addNotification(
        "Checkpoint checklist assigned: " + title,
        description,
        "checklist",
        dept,
        role,
        undefined,
        tId
      )
    ));

    return {
      id: newChecklists[0].id,
      tenantId: newChecklists[0].tenant_id,
      title: newChecklists[0].title,
      description: newChecklists[0].description,
      department: newChecklists[0].department as Department,
      role: newChecklists[0].role as Role,
      createdAt: newChecklists[0].created_at,
      createdBy: {
        userId: newChecklists[0].created_by_user_id,
        name: newChecklists[0].created_by_name,
        role: newChecklists[0].created_by_role
      },
      items: checklistItems
        .filter(item => item.checklist_id === newChecklists[0].id)
        .map(item => ({
          id: item.id,
          text: item.text,
          completed: item.completed,
          completedBy: null,
          completedAt: null
        })),
      attachment: attachment
    };
  }

  public async updateChecklist(
    checklistId: string,
    title: string,
    description: string,
    dept: Department | string,
    role: Role | string,
    itemsText: string[],
    tenantId: string,
    recurrence: string = "One-time",
    recurrenceDay: string = "",
    attachment: string = "",
    customInputFields?: string[],
    sections?: any[],
    type?: "single" | "yes_no",
    adminNotes?: string
  ): Promise<void> {
    // 1. Fetch current checklist description to extract existing submissions and translations
    const { data: existingChecklist } = await supabase
      .from('checklists')
      .select('description')
      .eq('id', checklistId)
      .single();

    let existingSubmissions: any[] = [];
    let existingTranslations: any = undefined;
    let existingGroupId: string | undefined = undefined;

    if (existingChecklist && existingChecklist.description) {
      try {
        const obj = JSON.parse(existingChecklist.description);
        existingSubmissions = obj.submissions || [];
        existingTranslations = obj.translations || undefined;
        existingGroupId = obj.groupId || undefined;
      } catch (e) {
        // Ignore parsing errors
      }
    }

    // 2. Generate final sections with mapped database item IDs
    let finalSections = sections || [];
    if (sections && sections.length > 0) {
      let globalItemIndex = 0;
      finalSections = sections.map(sec => ({
        ...sec,
        items: (sec.items || []).map((item: any) => {
          const itemId = `item-${checklistId}-${globalItemIndex}`;
          globalItemIndex++;
          return {
            ...item,
            id: itemId
          };
        })
      }));
    }

    const updatedDesc = JSON.stringify({
      desc: description,
      recurrence,
      recurrenceDay,
      attachment,
      customInputFields: customInputFields || [],
      sections: finalSections,
      type: type || "single",
      adminNotes: adminNotes || "",
      submissions: existingSubmissions,
      translations: existingTranslations,
      ...(existingGroupId ? { groupId: existingGroupId } : {})
    });

    // 3. Update the checklists table row
    await supabase
      .from('checklists')
      .update({
        title,
        description: updatedDesc,
        department: dept,
        role: role,
        tenant_id: tenantId
      })
      .eq('id', checklistId);

    // 4. Delete existing items in checklist_items table for this checklist
    await supabase
      .from('checklist_items')
      .delete()
      .eq('checklist_id', checklistId);

    // 5. Insert new checklist items
    const checklistItems = itemsText.map((txt, index) => ({
      id: `item-${checklistId}-${index}`,
      checklist_id: checklistId,
      text: txt,
      completed: false
    }));

    await supabase.from('checklist_items').insert(checklistItems);
  }

  /**
   * Patches only the groupId field in a checklist's description JSON.
   * Used when duplicating an old checklist that never had a groupId assigned.
   */
  public async patchChecklistGroupId(checklistId: string, groupId: string): Promise<void> {
    const { data: existing } = await supabase
      .from('checklists')
      .select('description')
      .eq('id', checklistId)
      .single();
    if (!existing) return;
    try {
      const obj = JSON.parse(existing.description || '{}');
      if (obj.groupId) return; // Already has a groupId, don't overwrite
      obj.groupId = groupId;
      await supabase
        .from('checklists')
        .update({ description: JSON.stringify(obj) })
        .eq('id', checklistId);
    } catch (e) {
      console.error('patchChecklistGroupId failed:', e);
    }
  }

  public async toggleChecklistItem(checklistId: string, itemId: string): Promise<Checklist | null> {
    const me = await this.getActiveUser();
    const { data: item } = await supabase
      .from('checklist_items')
      .select('completed')
      .eq('id', itemId)
      .single();

    if (!item) return null;

    const nextCompleted = !item.completed;
    await supabase
      .from('checklist_items')
      .update({
        completed: nextCompleted,
        completed_by_user_id: nextCompleted ? me.id : null,
        completed_by_name: nextCompleted ? me.name : null,
        completed_at: nextCompleted ? new Date().toISOString() : null
      })
      .eq('id', itemId);

    const checklists = await this.getChecklists();
    return checklists.find(c => c.id === checklistId) || null;
  }

  public async submitChecklist(checklistId: string, itemStates: { [itemId: string]: boolean }, customInputs?: { [fieldName: string]: string }): Promise<Checklist | null> {
    const me = await this.getActiveUser();
    
    const { data: checklistData } = await supabase
      .from('checklists')
      .select('*')
      .eq('id', checklistId)
      .single();
      
    if (!checklistData) return null;
    
    let descObj: any = {};
    try {
      if (checklistData.description && checklistData.description.startsWith("{")) {
        descObj = JSON.parse(checklistData.description);
      } else {
        descObj = { desc: checklistData.description };
      }
    } catch (e) {
      descObj = { desc: checklistData.description };
    }
    
    if (!descObj.submissions) {
      descObj.submissions = [];
    }
    
    const newSubmission = {
      id: `submission-${Date.now()}`,
      submittedAt: new Date().toISOString(),
      submittedBy: {
        userId: me.id,
        name: me.name
      },
      items: itemStates,
      customInputs: customInputs || {}
    };
    
    descObj.submissions.push(newSubmission);
    
    await supabase
      .from('checklists')
      .update({
        description: JSON.stringify(descObj)
      })
      .eq('id', checklistId);

    // Submission recorded. Language is a display-only concern handled in the UI.
    // No group sync needed — each checklist is a single record, submitted independently.

    const checklists = await this.getChecklists();
    return checklists.find(c => c.id === checklistId) || null;
  }

  public async saveChecklistTranslations(
    checklistId: string,
    lang: string,
    translated: { title: string; description: string; items: Record<string, string> }
  ): Promise<Checklist | null> {
    const { data: checklist } = await supabase
      .from('checklists')
      .select('description')
      .eq('id', checklistId)
      .single();

    if (!checklist) return null;

    let descObj: any = { desc: "", recurrence: "One-time", recurrenceDay: "" };
    try {
      if (checklist.description && checklist.description.startsWith("{")) {
        descObj = JSON.parse(checklist.description);
      } else {
        descObj.desc = checklist.description;
      }
    } catch (e) {
      descObj.desc = checklist.description;
    }

    if (!descObj.translations) descObj.translations = {};
    descObj.translations[lang] = translated;

    await supabase
      .from('checklists')
      .update({ description: JSON.stringify(descObj) })
      .eq('id', checklistId);

    const checklists = await this.getChecklists();
    return checklists.find(c => c.id === checklistId) || null;
  }

  public async deleteChecklist(checklistId: string): Promise<void> {
    await supabase.from('checklists').delete().eq('id', checklistId);
  }

  // Task Manager
  /**
   * @param opts.withMessages  include each task's chat (default true). The light
   *   background sync passes `false` to skip the whole `task_messages` fetch.
   */
  public async getTasks(opts?: { withMessages?: boolean; since?: string }): Promise<Task[]> {
    const withMessages = opts?.withMessages !== false;
    const curUser = await this.getActiveUser();
    const tenants = await this.getTenantsByClient(this.activeClientId);
    const tenantIds = tenants.map(t => t.id);
    let tasksQuery = supabase.from('tasks').select('*').in('tenant_id', tenantIds);
    if (opts?.since) tasksQuery = tasksQuery.gt('updated_at', opts.since);
    const { data: tasksData, error: tasksError } = await tasksQuery;
    if (opts?.since && tasksError) throw tasksError; // let the caller fall back to a full sync

    if (!tasksData || tasksData.length === 0) return [];

    const chatData = withMessages
      ? (await supabase.from('task_messages').select('*').in('task_id', tasksData.map(t => t.id))).data
      : null;

    const combined: Task[] = tasksData.map(t => {
      const chat: ChatMessage[] = (chatData || [])
        .filter(msg => msg.task_id === t.id)
        .map(msg => ({
          id: msg.id,
          userId: msg.user_id,
          senderName: msg.sender_name,
          senderRole: msg.sender_role,
          message: msg.message,
          timestamp: msg.timestamp
        }))
        .sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Unpack metadata from description if present
      let desc = t.description || "";
      let assigneeIds: string[] = [t.assigned_user_id].filter(Boolean);
      let translations: Record<string, string> | undefined = undefined;
      let photos: string[] = [];
      let linkedChannelId: string | undefined = undefined;
      let linkedMessageId: string | undefined = undefined;

      const parts = desc.split('\n\n---HORAE-METADATA---\n');
      if (parts.length > 1) {
        try {
          const metadata = JSON.parse(parts[1]);
          if (metadata.assigneeIds) assigneeIds = metadata.assigneeIds;
          if (metadata.translations) translations = metadata.translations;
          if (metadata.photos) photos = metadata.photos;
          if (metadata.linkedChannelId) linkedChannelId = metadata.linkedChannelId;
          if (metadata.linkedMessageId) linkedMessageId = metadata.linkedMessageId;
          desc = parts[0];
        } catch (e) {
          // ignore parsing error
        }
      }

      return {
        id: t.id,
        tenantId: t.tenant_id,
        title: t.title,
        description: desc,
        status: t.status as any,
        priority: t.priority as any,
        dueDate: t.due_date,
        assignedUserId: t.assigned_user_id,
        assignedUserIds: assigneeIds,
        createdByUserId: t.created_by_user_id,
        createdAt: t.created_at,
        chat,
        translations,
        photos,
        linkedChannelId,
        linkedMessageId
      };
    });

    return combined.filter(t => {
      // Only Admin/Super Admin get full oversight here — Managers and Supervisors
      // have their own outlets' staff to track but should still only see tasks
      // actually assigned to or created by them, same as everyone else. Org-wide
      // oversight for those roles lives in the Admin Panel, not Task Manager.
      if (curUser.role === Role.ADMIN || curUser.role === Role.SUPER_ADMIN) {
        return true;
      }
      return t.assignedUserId === curUser.id ||
             t.assignedUserIds?.includes(curUser.id) ||
             t.createdByUserId === curUser.id;
    }).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async addTask(title: string, description: string, priority: string, dueDate: string, assignedUserIds: string[], tenantId: string, channelId?: string, msgId?: string): Promise<Task> {
    const me = await this.getActiveUser();
    const primaryAssignee = assignedUserIds[0] || me.id;

    let cleanDescription = description;
    let existingMetadata: any = {};
    const parts = description.split('\n\n---HORAE-METADATA---\n');
    if (parts.length > 1) {
      cleanDescription = parts[0];
      try {
        existingMetadata = JSON.parse(parts[1]);
      } catch (e) {}
    }

    const metadata = {
      ...existingMetadata,
      assigneeIds: assignedUserIds,
      linkedChannelId: channelId || existingMetadata.linkedChannelId,
      linkedMessageId: msgId || existingMetadata.linkedMessageId
    };
    const packedDescription = `${cleanDescription}\n\n---HORAE-METADATA---\n${JSON.stringify(metadata)}`;

    const newTask = {
      id: "task-" + Date.now(),
      tenant_id: tenantId,
      title,
      description: packedDescription,
      status: "Assigned",
      priority,
      due_date: dueDate,
      assigned_user_id: primaryAssignee,
      created_by_user_id: me.id,
      created_at: new Date().toISOString()
    };

    await supabase.from('tasks').insert([newTask]);

    // In-app notifications for all assignees
    await Promise.all(assignedUserIds.map(async (uId) => {
      const { data: assignee } = await supabase
        .from('users')
        .select('*')
        .eq('id', uId)
        .single();

      if (assignee) {
        await this.addNotification(
          "New Task Assigned: " + title,
          `Assigned to you. Due on ${dueDate}`,
          "task",
          assignee.department as Department,
          assignee.role as Role,
          uId,
          tenantId
        );
      }
    }));

    // Push notification — invoke edge function directly from client so push fires
    // regardless of whether the Supabase DB webhook is configured.
    supabase.functions.invoke('notify-dispatcher', {
      body: {
        type: 'INSERT',
        table: 'tasks',
        record: { ...newTask, assigned_user_ids: assignedUserIds },
        old_record: null,
      },
    }).catch(() => { /* non-fatal — best-effort push */ });

    return {
      id: newTask.id,
      tenantId: newTask.tenant_id,
      title: newTask.title,
      description,
      status: "Assigned",
      priority: newTask.priority,
      dueDate: newTask.due_date,
      assignedUserId: primaryAssignee,
      assignedUserIds,
      createdByUserId: newTask.created_by_user_id,
      createdAt: newTask.created_at,
      chat: []
    };
  }

  public async updateTaskStatus(taskId: string, status: "Assigned" | "In Progress" | "Pending" | "On Hold" | "Completed" | "Closed"): Promise<Task | null> {
    // Fetch task before update so we have old_record for edge function
    const { data: taskRow } = await supabase.from('tasks').select('*').eq('id', taskId).single();
    const oldStatus = taskRow?.status;

    await supabase
      .from('tasks')
      .update({ status })
      .eq('id', taskId);

    if (taskRow) {
      const me = await this.getActiveUser();
      const assigneeIds: string[] = taskRow.assigned_user_ids || (taskRow.assigned_user_id ? [taskRow.assigned_user_id] : []);

      // In-app notification for all assignees + task creator (excluding the person who changed status)
      const recipientIds = [...new Set([...assigneeIds, taskRow.created_by_user_id])].filter(id => id && id !== me.id);
      await Promise.all(recipientIds.map(async (uId) => {
        const { data: u } = await supabase.from('users').select('*').eq('id', uId).single();
        if (u) {
          await this.addNotification(
            `Task ${status}: ${taskRow.title}`,
            `Status changed from ${oldStatus} to ${status}`,
            "task",
            u.department as Department,
            u.role as Role,
            uId,
            taskRow.tenant_id
          );
        }
      }));

      // Push via edge function — client-side so webhook config is not required
      supabase.functions.invoke('notify-dispatcher', {
        body: {
          type: 'UPDATE',
          table: 'tasks',
          record: { ...taskRow, status, assigned_user_ids: assigneeIds },
          old_record: { ...taskRow, status: oldStatus, assigned_user_ids: assigneeIds },
          actorId: me.id,
        },
      }).catch(() => {});
    }

    const tasks = await this.getTasks();
    return tasks.find(t => t.id === taskId) || null;
  }

  public async updateTaskPriority(taskId: string, priority: string): Promise<Task | null> {
    await supabase
      .from('tasks')
      .update({ priority })
      .eq('id', taskId);

    const tasks = await this.getTasks();
    return tasks.find(t => t.id === taskId) || null;
  }

  public async sendUrgentWhatsAppPush(kind: "task" | "notice", recordId: string): Promise<void> {
    const me = await this.getActiveUser();
    let record: any;
    let userIds: string[];

    if (kind === "task") {
      const tasks = await this.getTasks();
      const task = tasks.find(t => t.id === recordId);
      if (!task) return;
      record = { id: task.id, title: task.title };
      userIds = task.assignedUserIds && task.assignedUserIds.length ? task.assignedUserIds : (task.assignedUserId ? [task.assignedUserId] : []);
    } else {
      const notices = await this.getNotices();
      const notice = notices.find(n => n.id === recordId);
      if (!notice) return;
      record = { id: notice.id, title: notice.title };
      const { data: users } = await supabase.from('users').select('id').eq('tenant_id', notice.tenantId);
      userIds = (users || []).map((u: any) => u.id);
    }

    if (!userIds.length) throw new Error("No recipients found for this " + kind);

    const { error } = await supabase.functions.invoke('notify-dispatcher', {
      body: { type: 'URGENT_PUSH', kind, record, userIds, tenantId: me.tenantId },
    });
    if (error) throw error;
  }

  public async sendUrgentMessageWhatsAppPush(messageId: string, channelId: string, content: string, senderName: string, mentionedUserIds?: string[]): Promise<void> {
    const me = await this.getActiveUser();
    let userIds = mentionedUserIds && mentionedUserIds.length ? mentionedUserIds : [];

    if (!userIds.length) {
      const { data: members } = await supabase.from('chat_members').select('user_id').eq('channel_id', channelId);
      userIds = (members || []).map((m: any) => m.user_id).filter((id: string) => id !== me.id);
    }

    if (!userIds.length) throw new Error("No recipients found for this message");

    const record = { id: messageId, channelId, title: content.slice(0, 100), senderName };
    const { error } = await supabase.functions.invoke('notify-dispatcher', {
      body: { type: 'URGENT_PUSH', kind: 'message', record, userIds, tenantId: me.tenantId },
    });
    if (error) throw error;
  }

  public async addTaskChatMessage(taskId: string, messageText: string): Promise<Task | null> {
    const me = await this.getActiveUser();
    const newMessage = {
      id: "msg-" + Date.now(),
      task_id: taskId,
      user_id: me.id,
      sender_name: me.name,
      sender_role: me.role,
      message: messageText,
      timestamp: new Date().toISOString()
    };

    await supabase.from('task_messages').insert([newMessage]);

    // Fetch task to get assignees for notification targeting
    const { data: taskRow } = await supabase.from('tasks').select('*').eq('id', taskId).single();
    if (taskRow) {
      const assigneeIds: string[] = taskRow.assigned_user_ids || (taskRow.assigned_user_id ? [taskRow.assigned_user_id] : []);
      const recipientIds = [...new Set([...assigneeIds, taskRow.created_by_user_id])].filter(id => id && id !== me.id);

      // In-app notification for all recipients except the sender
      await Promise.all(recipientIds.map(async (uId) => {
        const { data: u } = await supabase.from('users').select('*').eq('id', uId).single();
        if (u) {
          await this.addNotification(
            `${me.name} on: ${taskRow.title}`,
            messageText.slice(0, 120),
            "task",
            u.department as Department,
            u.role as Role,
            uId,
            taskRow.tenant_id
          );
        }
      }));

      // Push — TASK_COMMENT type handled by edge function
      supabase.functions.invoke('notify-dispatcher', {
        body: {
          type: 'TASK_COMMENT',
          taskId,
          taskTitle: taskRow.title,
          senderName: me.name,
          senderId: me.id,
          message: messageText,
          recipientIds,
          tenantId: taskRow.tenant_id,
        },
      }).catch(() => {});
    }

    const tasks = await this.getTasks();
    return tasks.find(t => t.id === taskId) || null;
  }

  public async deleteTask(taskId: string): Promise<void> {
    await supabase.from('tasks').delete().eq('id', taskId);
  }

  // Notifications
  public async getNotifications(since?: string): Promise<OperationalNotification[]> {
    const curUser = await this.getActiveUser();
    const tenants = await this.getTenantsByClient(this.activeClientId);
    const tenantIds = tenants.map(t => t.id);
    let notifQuery = supabase.from('notifications').select('*').in('tenant_id', tenantIds);
    if (since) notifQuery = notifQuery.gt('updated_at', since);
    const { data, error } = await notifQuery;
    if (since && error) throw error;

    const list: OperationalNotification[] = (data || []).map(n => ({
      id: n.id,
      tenantId: n.tenant_id,
      title: n.title,
      message: n.message,
      category: n.category as any,
      department: n.department,
      role: n.role,
      createdAt: n.created_at,
      targetUserId: n.target_user_id
    }));

    return list.filter(notif => {
      if (notif.targetUserId) {
        return notif.targetUserId === curUser.id;
      }
      if (curUser.role === Role.ADMIN || curUser.role === Role.MANAGER || curUser.role === Role.SUPER_ADMIN) {
        return true;
      }
      const matchDept = isTargetMatched(notif.department as string, curUser.department, Department.ALL);
      const matchRole = isTargetMatched(notif.role as string, curUser.role, Role.ALL);
      return matchDept && matchRole;
    }).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private async addNotification(
    title: string, 
    message: string, 
    category: "notice" | "checklist" | "task" | "system",
    department: Department | string = Department.ALL,
    role: Role | string = Role.ALL,
    targetUserId?: string,
    tenantId?: string
  ): Promise<OperationalNotification> {
    const newNotif = {
      id: "notif-" + Date.now(),
      tenant_id: tenantId || this.activeTenantId,
      title,
      message,
      category,
      department,
      role,
      created_at: new Date().toISOString(),
      target_user_id: targetUserId || null
    };

    await supabase.from('notifications').insert([newNotif]);

    return {
      id: newNotif.id,
      tenantId: newNotif.tenant_id,
      title,
      message,
      category,
      department,
      role,
      createdAt: newNotif.created_at,
      targetUserId
    };
    }

  // --- QUIZ & SOP MODULES (Database Backed) ---

  public async getQuizzes(): Promise<Quiz[]> {
    const curUser = await this.getActiveUser();
    const tenants = await this.getTenantsByClient(this.activeClientId);
    const tenantIds = tenants.map(t => t.id);

    const { data: dbChecklists } = await supabase
      .from('checklists')
      .select('*')
      .in('tenant_id', tenantIds);

    const quizChecklists = (dbChecklists || []).filter(c => {
      try {
        if (c.description && c.description.startsWith("{")) {
          const obj = JSON.parse(c.description);
          return obj.type === "quiz";
        }
      } catch (e) {}
      return false;
    });

    if (quizChecklists.length === 0) {
      // Seed default quizzes
      const defaultQuizzes = [
        {
          title: "Food Safety & Temperature Standards",
          description: "Required quiz for all kitchen and baking staff regarding standard storage and baking temperatures.",
          department: Department.KITCHEN,
          role: Role.ALL,
          questions: [
            {
              id: "q1",
              questionText: "What is the minimum internal temperature for cooling baked bread before packaging?",
              options: ["20°C (68°F)", "32°C (90°F)", "45°C (113°F)", "50°C (122°F)"],
              correctOptionIndex: 1
            },
            {
              id: "q2",
              questionText: "Which raw ingredients must be stored on the lowest shelf in the walk-in refrigerator?",
              options: ["Raw liquid eggs", "Fresh fruit toppings", "Baking butter", "Dry flour bags"],
              correctOptionIndex: 0
            },
            {
              id: "q3",
              questionText: "How often should the baking oven's ambient temperature indicators be calibrated?",
              options: ["Daily", "Weekly", "Monthly", "Every 6 months"],
              correctOptionIndex: 1
            }
          ]
        },
        {
          title: "Cash Billing & Discount Policies",
          description: "Required quiz for all cashiers and front desk staff regarding daily billing operations.",
          department: Department.FRONT_DESK,
          role: Role.ALL,
          questions: [
            {
              id: "qc1",
              questionText: "What is the maximum instant discount a cashier can apply without manager approval?",
              options: ["0%", "5%", "10%", "20%"],
              correctOptionIndex: 1
            },
            {
              id: "qc2",
              questionText: "Under what category should a canceled transaction due to customer change of mind be logged?",
              options: ["System Error", "Customer Refusal", "Order Cancelation", "Spoil Log"],
              correctOptionIndex: 2
            }
          ]
        }
      ];

      const seededQuizzes = await Promise.all(defaultQuizzes.map(async (q) => {
        return this.addQuiz(q.title, q.description, q.department, q.role, q.questions, "ALL");
      }));
      return seededQuizzes;
    }

    return quizChecklists.map(c => {
      let descObj: any = {};
      try {
        descObj = JSON.parse(c.description);
      } catch (e) {}
      return {
        id: c.id,
        tenantId: c.tenant_id,
        title: c.title,
        description: descObj.desc || "",
        department: c.department,
        role: c.role,
        createdAt: c.created_at,
        createdBy: {
          userId: c.created_by_user_id,
          name: c.created_by_name,
          role: c.created_by_role
        },
        questions: descObj.questions || []
      } as Quiz;
    });
  }

  public async addQuiz(title: string, description: string, dept: Department | string, role: Role | string, questions: any[], tenantId: string): Promise<Quiz> {
    const me = await this.getActiveUser();
    const formattedQuestions = questions.map((q, idx) => ({
      id: `q-${Date.now()}-${idx}`,
      questionText: q.questionText,
      options: q.options,
      correctOptionIndex: q.correctOptionIndex
    }));

    const desc = JSON.stringify({
      desc: description,
      questions: formattedQuestions,
      type: "quiz",
      submissions: []
    });

    const chk = {
      title,
      description: desc,
      department: dept,
      role: role,
      tenant_id: tenantId,
      created_by_user_id: me.id,
      created_by_name: me.name,
      created_by_role: me.role,
      created_at: new Date().toISOString()
    };

    const { data } = await supabase
      .from('checklists')
      .insert([chk])
      .select()
      .single();

    const quizId = data ? data.id : `quiz-${Date.now()}`;

    return {
      id: quizId,
      tenantId,
      title,
      description,
      department: dept,
      role,
      createdAt: chk.created_at,
      createdBy: {
        userId: me.id,
        name: me.name,
        role: me.role
      },
      questions: formattedQuestions
    };
  }

  public async deleteQuiz(quizId: string): Promise<void> {
    await supabase
      .from('checklists')
      .delete()
      .eq('id', quizId);
  }

  public async getQuizAttempts(): Promise<QuizAttempt[]> {
    const tenants = await this.getTenantsByClient(this.activeClientId);
    const tenantIds = tenants.map(t => t.id);

    const { data: dbChecklists } = await supabase
      .from('checklists')
      .select('*')
      .in('tenant_id', tenantIds);

    const quizChecklists = (dbChecklists || []).filter(c => {
      try {
        if (c.description && c.description.startsWith("{")) {
          const obj = JSON.parse(c.description);
          return obj.type === "quiz";
        }
      } catch (e) {}
      return false;
    });

    const attempts: QuizAttempt[] = [];
    quizChecklists.forEach(c => {
      try {
        const obj = JSON.parse(c.description);
        if (obj.submissions && obj.submissions.length > 0) {
          obj.submissions.forEach((sub: any, idx: number) => {
            attempts.push({
              id: `attempt-${c.id}-${idx}`,
              quizId: c.id,
              quizTitle: c.title,
              userId: sub.submittedBy.userId,
              userName: sub.submittedBy.name,
              userRole: sub.submittedBy.role || "Staff",
              score: sub.score,
              totalQuestions: sub.totalQuestions,
              answers: sub.answers || [],
              completedAt: sub.submittedAt
            } as any);
          });
        }
      } catch (e) {}
    });

    return attempts;
  }

  public async submitQuizAttempt(quizId: string, quizTitle: string, score: number, totalQuestions: number, answers: number[]): Promise<QuizAttempt> {
    const me = await this.getActiveUser();

    const { data: c } = await supabase
      .from('checklists')
      .select('*')
      .eq('id', quizId)
      .single();

    if (!c) throw new Error("Quiz not found");

    let descObj: any = {};
    try {
      descObj = JSON.parse(c.description);
    } catch (e) {
      descObj = { desc: c.description };
    }

    if (!descObj.submissions) descObj.submissions = [];

    const newAttemptSub = {
      submittedAt: new Date().toISOString(),
      submittedBy: {
        userId: me.id,
        name: me.name,
        role: me.role
      },
      score,
      totalQuestions,
      answers
    };

    descObj.submissions.push(newAttemptSub);

    await supabase
      .from('checklists')
      .update({ description: JSON.stringify(descObj) })
      .eq('id', quizId);

    return {
      id: `attempt-${quizId}-${Date.now()}`,
      quizId,
      quizTitle,
      userId: me.id,
      userName: me.name,
      userRole: me.role,
      score,
      totalQuestions,
      answers,
      completedAt: newAttemptSub.submittedAt
    } as any;
  }

  public async getSOPs(): Promise<SOP[]> {
    const curUser = await this.getActiveUser();
    const tenants = await this.getTenantsByClient(this.activeClientId);
    const tenantIds = tenants.map(t => t.id);
    const tenantIdOrAll = [...tenantIds, 'ALL'];

    const { data: dbChecklists } = await supabase
      .from('checklists')
      .select('*')
      .in('tenant_id', tenantIdOrAll);

    const sopChecklists = (dbChecklists || []).filter(c => {
      try {
        if (c.description && c.description.startsWith("{")) {
          const obj = JSON.parse(c.description);
          return obj.type === "sop";
        }
      } catch (e) {}
      return false;
    });

    if (sopChecklists.length === 0) {
      const defaultSOPs = [
        {
          title: "Kitchen Opening Operations Standard",
          description: "Crucial guidelines to start the kitchen shift. Covering ventilation, prep sanitization, and proofing settings.",
          category: "Operations",
          department: Department.KITCHEN,
          role: Role.ALL,
          content: `### Kitchen Opening Checklist & Standard Procedures

All kitchen personnel must strictly adhere to the opening sequence to ensure safety and quality standards:

1. **Ventilation Activation**: Turn on the main exhaust fans immediately upon entering. Do NOT start any gas burners before checking that the exhaust is fully running.
2. **Sanitation Verification**: Wipe down all stainless steel countertops with food-safe sanitizing solution (dilution ratio: 1 tablet per 5 liters of water).
3. **Equipment Preheating**:
   - Deck ovens should be switched to 230°C top / 210°C bottom heating.
   - Proofer cabinet temperature should be set to 38°C (100°F) with 85% relative humidity.
4. **Safety Verification**: Ensure the fire extinguisher pressure pin is green and the egress pathway is clear of prep crates.`,
          fileUrl: "kitchen_opening_manual.pdf"
        },
        {
          title: "End of Day Register Reconciliation SOP",
          description: "Standard reconciliation workflow for cashier drawer close-out.",
          category: "Billing & Cash",
          department: Department.FRONT_DESK,
          role: Role.ALL,
          content: `### Cash Register Reconciliation Guidelines

This guide ensures that cash flows are reconciled correctly at the close of every shift.

1. **Print Z-Report**: Extract the physical receipt listing the day's transactions from the POS machine.
2. **Physical Count**: Count all bills and coins in the register. Keep a float of 2,000 INR in the drawer for the morning shift.
3. **Log Discrepancies**: Any deficit or surplus exceeding 50 INR must be immediately reported to the shift manager and logged in the daily operations chat.
4. **Deposit Preparation**: Seal the remaining cash in the branded drop-envelope and drop it into the under-counter safe.`,
          fileUrl: "billing_ops_manual.pdf"
        }
      ];

      const seededSOPs = await Promise.all(defaultSOPs.map(async (sop) => {
        return this.addSOP(sop.title, sop.description, sop.category, sop.department, sop.role, sop.content, sop.fileUrl, "ALL");
      }));
      return seededSOPs;
    }

    return sopChecklists.map(c => {
      let descObj: any = {};
      try {
        descObj = JSON.parse(c.description);
      } catch (e) {}
      return {
        id: c.id,
        tenantId: c.tenant_id,
        title: c.title,
        description: descObj.desc || "",
        category: descObj.category || "Operations",
        department: c.department,
        role: c.role,
        content: descObj.content || "",
        fileUrl: descObj.fileUrl || "",
        createdAt: c.created_at,
        createdBy: {
          userId: c.created_by_user_id,
          name: c.created_by_name,
          role: c.created_by_role
        }
      } as SOP;
    });
  }

  public async addSOP(title: string, description: string, category: string, dept: Department | string, role: Role | string, content: string, fileUrl: string, tenantId: string): Promise<SOP> {
    const me = await this.getActiveUser();

    const desc = JSON.stringify({
      desc: description,
      category,
      content,
      fileUrl,
      type: "sop",
      submissions: []
    });

    const chk = {
      title,
      description: desc,
      department: dept,
      role: role,
      tenant_id: tenantId,
      created_by_user_id: me.id,
      created_by_name: me.name,
      created_by_role: me.role,
      created_at: new Date().toISOString()
    };

    const { data } = await supabase
      .from('checklists')
      .insert([chk])
      .select()
      .single();

    const sopId = data ? data.id : `sop-${Date.now()}`;

    return {
      id: sopId,
      tenantId,
      title,
      description,
      category,
      department: dept,
      role,
      content,
      fileUrl,
      createdAt: chk.created_at,
      createdBy: {
        userId: me.id,
        name: me.name,
        role: me.role
      }
    };
  }

  public async deleteSOP(sopId: string): Promise<void> {
    await supabase
      .from('checklists')
      .delete()
      .eq('id', sopId);
  }

  public async getSOPReadStatuses(): Promise<SOPReadStatus[]> {
    const tenants = await this.getTenantsByClient(this.activeClientId);
    const tenantIds = tenants.map(t => t.id);
    const tenantIdOrAll = [...tenantIds, 'ALL'];

    const { data: dbChecklists } = await supabase
      .from('checklists')
      .select('*')
      .in('tenant_id', tenantIdOrAll);

    const sopChecklists = (dbChecklists || []).filter(c => {
      try {
        if (c.description && c.description.startsWith("{")) {
          const obj = JSON.parse(c.description);
          return obj.type === "sop";
        }
      } catch (e) {}
      return false;
    });

    const statuses: SOPReadStatus[] = [];
    sopChecklists.forEach(c => {
      try {
        const obj = JSON.parse(c.description);
        if (obj.submissions && obj.submissions.length > 0) {
          obj.submissions.forEach((sub: any, idx: number) => {
            statuses.push({
              id: `read-${c.id}-${sub.submittedBy.userId}`,
              sopId: c.id,
              sopTitle: c.title,
              userId: sub.submittedBy.userId,
              userName: sub.submittedBy.name,
              userRole: sub.submittedBy.role || "Staff",
              readAt: sub.submittedAt
            } as any);
          });
        }
      } catch (e) {}
    });

    return statuses;
  }

  public async markSOPAsRead(sopId: string, sopTitle: string): Promise<SOPReadStatus> {
    const me = await this.getActiveUser();

    const { data: c } = await supabase
      .from('checklists')
      .select('*')
      .eq('id', sopId)
      .single();

    if (!c) throw new Error("SOP not found");

    let descObj: any = {};
    try {
      descObj = JSON.parse(c.description);
    } catch (e) {
      descObj = { desc: c.description };
    }

    if (!descObj.submissions) descObj.submissions = [];

    const alreadyRead = descObj.submissions.some((sub: any) => sub.submittedBy.userId === me.id);
    if (!alreadyRead) {
      const newReadSub = {
        submittedAt: new Date().toISOString(),
        submittedBy: {
          userId: me.id,
          name: me.name,
          role: me.role
        }
      };

      descObj.submissions.push(newReadSub);

      await supabase
        .from('checklists')
        .update({ description: JSON.stringify(descObj) })
        .eq('id', sopId);
    }

    return {
      id: `read-${sopId}-${me.id}`,
      sopId,
      sopTitle,
      userId: me.id,
      userName: me.name,
      userRole: me.role,
      readAt: new Date().toISOString()
    } as any;
  }

  // --- Real-time Sync Subscriptions ---
  /**
   * Realtime updates for the operational tables. Scoped two ways to keep cost
   * sane at fleet scale (see the cost-optimization notes):
   *   1. only the four collaborative tables — not every table in `public`;
   *   2. filtered to the caller's tenant IDs, so one client never wakes on
   *      another client's changes (cuts cross-tenant realtime-message fan-out).
   * With no tenantIds it falls back to an unfiltered listen on those tables.
   */
  public subscribeToChanges(onUpdate: () => void, tenantIds?: string[]) {
    const tables = ['tasks', 'notices', 'checklists', 'notifications'];
    const filter = tenantIds && tenantIds.length ? `tenant_id=in.(${tenantIds.join(',')})` : undefined;
    const channel = supabase.channel('horae-postgres-changes');
    for (const table of tables) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
        () => onUpdate(),
      );
    }
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  public async seedDatabase() {
    const clients = [
      { id: 'client-system', name: 'Horae Admin', logo: '⚡', plan: 'Enterprise' }
    ];

    const tenants = [
      { id: 'tenant-system', client_id: 'client-system', name: 'Horae Admin Console', subdomain: 'admin.horae.ops', logo: '⚡', plan: 'Enterprise' }
    ];

    const users = [
      { id: 'user-superadmin', tenant_id: 'tenant-system', name: 'Horae Admin', email: 'admin@horae.ops', role: 'Super Admin', department: 'Management', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150#pwd=!Horae@2026' }
    ];

    const { error: err1 } = await supabase.from('clients').insert(clients);
    if (err1) throw err1;

    const { error: err2 } = await supabase.from('tenants').insert(tenants);
    if (err2) throw err2;

    const { error: err3 } = await supabase.from('users').insert(users);
    if (err3) throw err3;
  }

  public resetAllData() {
    localStorage.removeItem("horae_active_client_id");
    localStorage.removeItem("horae_active_tenant_id");
    localStorage.removeItem("horae_active_user_id");
    localStorage.removeItem("horae_quizzes");
    localStorage.removeItem("horae_quiz_attempts");
    localStorage.removeItem("horae_sops");
    localStorage.removeItem("horae_sop_read_statuses");
    this.loadState();
  }
}

export async function translateText(text: string, targetLanguage: 'en' | 'hi' | 'kn' | 'ta'): Promise<string> {
  try {
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=auto&tl=${targetLanguage}&q=${encodeURIComponent(text)}`
    );
    const data = await response.json();
    return data[0].map((item: any) => item[0]).join('');
  } catch (error) {
    console.error("Translation failed, falling back to mock:", error);
    return text;
  }
}

export const store = new StoreService();
export default store;
