/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { BookOpen, Shield, Code, Server, HelpCircle, Layers } from "lucide-react";

export default function DocsAndGuide() {
  const [activeTab, setActiveTab] = useState<string>("setup");

  return (
    <div className="space-y-6" id="docs-wrapper">
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
          <BookOpen className="text-amber-500 w-6 h-6" />
          Horae Scaling & Step-By-Step Setup Guide
        </h2>
        <p className="text-slate-600 mt-2 max-w-3xl text-sm leading-relaxed">
          Detailed technical blueprints mapping your transition from a single-bakery utility (HoraeOps) into a scalable, high-performance, multi-tenant Horae application under your new profile: <code className="bg-slate-50 text-slate-800 px-1.5 py-0.5 rounded font-mono text-xs">coderookie84@gmail.com</code>.
        </p>
      </div>

      {/* Navigation Inside Docs */}
      <div className="flex border-b border-slate-100 gap-1 overflow-x-auto pb-1" id="docs-nav-tabs">
        <button
          id="tab-setup"
          onClick={() => setActiveTab("setup")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
            activeTab === "setup"
              ? "bg-amber-50 text-amber-800"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Layers className="w-4 h-4" />
          Account Transition
        </button>
        <button
          id="tab-database"
          onClick={() => setActiveTab("database")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
            activeTab === "database"
              ? "bg-amber-50 text-amber-800"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Server className="w-4 h-4" />
          Firebase vs Supabase (Horae)
        </button>
        <button
          id="tab-security"
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
            activeTab === "security"
              ? "bg-amber-50 text-amber-800"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Shield className="w-4 h-4" />
          Multi-Tenant Rules
        </button>
        <button
          id="tab-architecture"
          onClick={() => setActiveTab("architecture")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
            activeTab === "architecture"
              ? "bg-amber-50 text-amber-800"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Code className="w-4 h-4" />
          n8n & Horae Integration
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "setup" && (
        <div className="space-y-6" id="docs-setup-content">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-mono text-xs font-bold">1</span>
                GitHub Handover (New Repository)
              </h3>
              <p className="text-slate-600 mt-2 text-sm leading-relaxed">
                To move the repository from your previous account to your new one (<span className="font-semibold text-slate-700">coderookie84</span>), follow these clean commands:
              </p>
              <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs mt-3 overflow-x-auto space-y-1">
                <p className="text-slate-400"># 1. Clone your HoraeOps repository</p>
                <p>git clone https://github.com/coderookie84/HoraeOps.git</p>
                <p>cd HoraeOps</p>
                <p className="text-slate-400"># 2. Rename existing remote origin to historic</p>
                <p>git remote rename origin old-origin</p>
                <p className="text-slate-400"># 3. Add your newly created repository on your new account</p>
                <p>git remote add origin https://github.com/coderookie84/HoraeOps.git</p>
                <p className="text-slate-400"># 4. Push the master/main tree up to the new secure repo</p>
                <p>git push -u origin main</p>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            <div>
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-mono text-xs font-bold">2</span>
                Firebase Project Provisioning (coderookie84)
              </h3>
              <ol className="list-decimal list-inside text-sm text-slate-600 mt-3 space-y-2 leading-relaxed">
                <li>Log in to <span className="font-semibold">Firebase Console</span> under <code className="bg-slate-50 text-slate-800 px-1 py-0.5 rounded font-mono text-xs">coderookie84@gmail.com</code>.</li>
                <li>Click <span className="font-semibold">"Add Project"</span> and name it <span className="text-slate-800 font-semibold font-mono text-xs">"horae-ops-multi"</span>.</li>
                <li>Go to <span className="font-semibold">Authentication &gt; Sign-In Method</span>. Enable <span className="font-semibold">Google Auth</span> (required by standard compliance). Add the local port/Cloud Run domains to authorization whitelist.</li>
                <li>Go to <span className="font-semibold">Firestore Database &gt; Create Database</span>. Choose <span className="font-semibold">Start in Test Mode</span>, then choose a cloud region nearby (e.g. Asia-Southeast1 for smooth latency in Singapore/India branches).</li>
                <li>In Firebase Project settings, create a new <span className="font-semibold">Web App Configuration</span>. Under the web configuration modal, copy their secure JSON values.</li>
              </ol>
            </div>

            <div className="h-px bg-slate-100" />

            <div>
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-mono text-xs font-bold">3</span>
                Update Workspace Configurations
              </h3>
              <p className="text-slate-600 mt-2 text-sm leading-relaxed">
                Inject your copied Firebase config keys into AI Studio using a file named <code className="bg-slate-50 text-slate-800 px-1.5 py-0.5 rounded font-mono text-xs">firebase-applet-config.json</code> at the root of your project:
              </p>
              <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs mt-3">
                <pre>{`{
  "apiKey": "your-new-api-key-here",
  "authDomain": "horae-ops-multi.firebaseapp.com",
  "projectId": "horae-ops-multi",
  "storageBucket": "horae-ops-multi.appspot.com",
  "messagingSenderId": "YourSenderId",
  "appId": "YourAppId",
  "firestoreDatabaseId": "(default)"
}`}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "database" && (
        <div className="space-y-6" id="docs-database-content">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Layers className="text-amber-500 w-5 h-5 animate-pulse" />
              Horae Architectural Recommendation: Firebase vs Supabase
            </h3>
            
            <p className="text-slate-600 text-sm leading-relaxed">
              You requested advice on whether migrating to <span className="font-semibold text-slate-700">Supabase</span> provides a clear upper hand, or if <span className="font-semibold text-indigo-700">Firebase Firestore</span> is robust enough to handle your multi-tenant platform. Below is a detailed breakdown for your specific Horae multi-client operations framework.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4" id="db-comparisons">
              {/* Firebase Option */}
              <div className="border border-indigo-100 bg-indigo-50/20 p-5 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold font-mono rounded">RECOMMENDED</span>
                  <h4 className="text-sm font-bold text-indigo-900">Keep Firebase Firestore</h4>
                </div>
                <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside">
                  <li><span className="font-semibold text-slate-800">No Re-write Cost</span>: You already have working Firebase integrations (Auth, notifications). Stay focused on UX and avoid deep structural shifts.</li>
                  <li><span className="font-semibold text-slate-800">Real-Time by Default</span>: Firebase handles collaborative task chat, live checklist completions, and push notifications with native websockets, requiring zero server overhead.</li>
                  <li><span className="font-semibold text-slate-800">Enterprise Scale with Zero Config</span>: Handles millions of requests with automated scale-out sharding.</li>
                  <li><span className="font-semibold text-slate-800">New Multi-Database support</span>: Firebase now permits multiple Firestore databases in a single Spark project! You can isolate critical clients on separate DB nodes.</li>
                </ul>
              </div>

              {/* Supabase Option */}
              <div className="border border-teal-100 bg-teal-50/20 p-5 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-teal-100 text-teal-800 text-xs font-bold font-mono rounded">ALTERNATIVE</span>
                  <h4 className="text-sm font-bold text-teal-900">Migrate to Supabase (Postgres)</h4>
                </div>
                <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside">
                  <li><span className="font-semibold text-slate-800">Relational Joins</span>: Makes complex analytics simpler (calculating bakery yield rates, tracking task durations by worker averages).</li>
                  <li><span className="font-semibold text-slate-800">Row-Level Security (RLS)</span>: SQL database handles multi-tenancy securely with standard tenant ID WHERE filters.</li>
                  <li><span className="font-semibold text-slate-800">Supabase Billing</span>: Fixed $25/mo Pro tier limits are highly predictable, while Firebase Spark is free up to 50K reads/day, after which Blaze pays per-read.</li>
                  <li><span className="font-semibold text-slate-800">Hosting and DB Locking</span>: Supabase can run anywhere, whereas Firebase binds heavily to Google Cloud Platform.</li>
                </ul>
              </div>
            </div>

            {/* Billing Comparison Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-xl mt-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 uppercase font-semibold text-[10px]">
                    <th className="p-3">Feature Metric</th>
                    <th className="p-3 text-indigo-700">Firebase (Blaze / Free)</th>
                    <th className="p-3 text-teal-700 font-semibold">Supabase (Pro / Free)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                  <tr>
                    <td className="p-3 font-semibold text-slate-800">Free Tier Limits</td>
                    <td className="p-3 text-indigo-700">50K Reads, 20K Writes/day (spark quota is generous for starting!)</td>
                    <td className="p-3 text-teal-700">500MB DB storage, 2GB high-performance file bandwidth</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-800">Scalability Model</td>
                    <td className="p-3">Pay-as-you-Scale. Only billed for exact reads/writes. Perfect for early-stage platforms.</td>
                    <td className="p-3">Fixed Tiers ($25 Pro includes 8GB database, extra storage billed at $0.135/GB).</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-800">Multi-Tenancy Setup</td>
                    <td className="p-3">Easy document indexing with <code className="bg-slate-50 p-1 rounded font-mono text-[10px]">tenantId</code> inside top-level collection.</td>
                    <td className="p-3">Postgres schemas or Tenant ID policies with foreign keys referencing users.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Tradeoff Conclusion */}
            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 text-xs text-amber-900 mt-2 space-y-1 leading-relaxed">
              <p className="font-bold flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" />
                Final Verdict: Stick with Firebase Firestore
              </p>
              <p>
                Since your operations app involves baking staff completing simple checklists and managers chatting on tasks in real time, the high-write/low-relationship pattern fits Firestore perfectly. By utilizing the Zero-Trust Security Rules detailed in the next tab, you can completely isolate multi-client companies securely in one Project under the Spark plan, paying exactly $0.00 until your food-service franchise is processing over 50,000 active bakery logins every day.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "security" && (
        <div className="space-y-6" id="docs-security-content">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Shield className="text-emerald-500 w-5 h-5 animate-pulse" />
              Multi-Tenant Zero-Trust Security Rules (`firestore.rules`)
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              When scaling to multiple clients (multi-tenant), it is extremely critical that <span className="font-semibold text-red-600">Company B cannot peek or write into Company A's checklists, notices, or tasks</span>.
            </p>

            <div className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-xs overflow-x-auto space-y-1">
              <p className="text-emerald-400">rules_version = '2';</p>
              <p className="text-emerald-400">service cloud.firestore {"{"}</p>
              <p className="text-emerald-400">  match /databases/{"{database}"}/documents {"{"}</p>
              <p className="text-slate-500">    // Catch-All Master Gate</p>
              <p className="text-emerald-400">    match /{"{document=**}"} {"{"}</p>
              <p className="text-emerald-400">      allow read, write: if false;</p>
              <p className="text-emerald-400">    {"}"}</p>
              <br />
              <p className="text-slate-500">    // Global reusable helpers</p>
              <p className="text-amber-300">    function isSignedIn() {"{"} return request.auth != null; {"}"}</p>
              <p className="text-amber-300">    function getUserDoc() {"{"}</p>
              <p className="text-amber-300">      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;</p>
              <p className="text-amber-300">    {"}"}</p>
              <p className="text-amber-300">    function matchesTenant(tenantId) {"{"}</p>
              <p className="text-amber-300">      return isSignedIn() && getUserDoc().tenantId == tenantId;</p>
              <p className="text-amber-300">    {"}"}</p>
              <br />
              <p className="text-slate-500">    // Sub-structure for multi-tenant tasks collection</p>
              <p className="text-emerald-400">    match /tasks/{"{taskId}"} {"{"}</p>
              <p className="text-emerald-400">      allow read: if isSignedIn() && resource.data.tenantId == getUserDoc().tenantId;</p>
              <p className="text-emerald-400">      allow create: if isSignedIn() && request.resource.data.tenantId == getUserDoc().tenantId;</p>
              <p className="text-emerald-400">      allow update, delete: if isSignedIn() && resource.data.tenantId == getUserDoc().tenantId && (</p>
              <p className="text-emerald-400">        getUserDoc().role == 'Manager' || getUserDoc().role == 'Supervisor' || resource.data.assignedUserId == request.auth.uid</p>
              <p className="text-emerald-400">      );</p>
              <p className="text-emerald-400">    {"}"}</p>
              <br />
              <p className="text-slate-500">    // Security architecture for Notice collections containing Roles and Departments</p>
              <p className="text-emerald-400">    match /notices/{"{noticeId}"} {"{"}</p>
              <p className="text-emerald-400">      allow read: if matchesTenant(resource.data.tenantId) && (</p>
              <p className="text-emerald-400">        resource.data.department == 'All Departments' || resource.data.department == getUserDoc().department</p>
              <p className="text-emerald-400">      );</p>
              <p className="text-emerald-400">      allow write: if matchesTenant(request.resource.data.tenantId) && (</p>
              <p className="text-emerald-400">        getUserDoc().role == 'Manager' || getUserDoc().role == 'Admin'</p>
              <p className="text-emerald-400">      );</p>
              <p className="text-emerald-400">    {"}"}</p>
              <p className="text-emerald-400">  {"}"}</p>
              <p className="text-emerald-400">{"}"}</p>
            </div>
            
            <p className="text-slate-500 text-xs italic">
              * Note: The matchesTenant function isolates data directly based on the authenticated user's linked database profile. Even if Company B clones your React app and tampers with local JavaScript values, Firebase's server-side rules will instantly terminate any cross-tenant leakage.
            </p>
          </div>
        </div>
      )}

      {activeTab === "architecture" && (
        <div className="space-y-6" id="docs-arch-content">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Layers className="text-cyan-500 w-5 h-5" />
              Horae Operational Stack: Hosting, n8n, & Antigravity AI
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="arch-bento-grid">
              {/* Box 1 Vercel */}
              <div className="border border-slate-100 p-4 rounded-xl space-y-2 bg-slate-50/50">
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono">HOSTING: VERCEL</span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Vercel provides perfect CDN caching, instant Git-triggered deployments from your new GitHub repo, and supports Serverless functions.
                </p>
              </div>

              {/* Box 2 n8n */}
              <div className="border border-slate-100 p-4 rounded-xl space-y-2 bg-slate-50/50">
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono">AUTOMATION: n8n</span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Set up n8n workflows triggered by Firestore webhooks. E.g., when a "High Priority" task stays "Todo" for over 12 hours, trigger an n8n WhatsApp notify to the supervising baker on shift!
                </p>
              </div>

              {/* Box 3 Antigravity */}
              <div className="border border-slate-100 p-4 rounded-xl space-y-2 bg-slate-50/50">
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono">AI WORKFLOWS</span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Inject Gemini models server-side or via webhook middleware. The model can automatically scan newly created baking tasks, translate instructions for multi-lingual staff, or extract steps into checklists!
                </p>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            <div>
              <h4 className="text-sm font-bold text-slate-800">Modular Workspace Isolation (Future-Proof Pattern)</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Notice how we have segmented other workflows (Notices, Checklists, Task Manager) into explicit folder views beneath `/src/components/`. This ensures a developer can optimize the task manager’s status board (e.g. adding columns or drag-and-drop animations) or inject chat notifications without running the risk of corrupting checklist calculation logic in other modules!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
