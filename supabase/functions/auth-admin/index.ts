/**
 * Supabase Edge Function: auth-admin
 *
 * Privileged Supabase Auth operations that must NOT run in the browser (they
 * need the service_role key, which Supabase injects here automatically — it is
 * never shipped to the client):
 *
 *   - reset_password   : an admin sets a new password for another user
 *   - provision_auth   : create an auth account for an existing staff row + link it
 *   - delete_auth      : remove a staff member's auth account
 *
 * Authorization: the CALLER's JWT (sent automatically by supabase.functions.invoke)
 * is verified. Only Admin / Super Admin may call. A client Admin is restricted to
 * users within their OWN client (client_id); a Super Admin may act across clients.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// WhatsApp welcome message (Meta Cloud API) — same creds the notify-dispatcher uses.
const META_WA_TOKEN     = Deno.env.get("META_WA_TOKEN") || "";
const META_PHONE_NUM_ID = Deno.env.get("META_PHONE_NUMBER_ID") || "";
const APP_BASE_URL      = Deno.env.get("APP_BASE_URL") || "https://horae.cloud";
// A brand-new user has never messaged the business, so the 24h free-text window
// is closed — the welcome MUST be an approved template. Body params: {{1}} name,
// {{2}} temp password, {{3}} app link.
const WELCOME_TEMPLATE_NAME = Deno.env.get("WELCOME_TEMPLATE_NAME") || "horae_welcome";

/**
 * Sends the one-time welcome WhatsApp (name + temp password + app link) to a
 * freshly-provisioned staff member. Best-effort: any failure is logged and
 * swallowed so it never blocks account creation. Returns true if Meta accepted.
 */
async function sendWelcomeWhatsApp(phone: string, name: string, password: string): Promise<boolean> {
  const to = String(phone || "").replace(/\D/g, "");
  if (!to || !META_WA_TOKEN || !META_PHONE_NUM_ID) return false;
  const firstName = (name || "there").split(" ")[0];
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: WELCOME_TEMPLATE_NAME,
      language: { code: "en_US" },
      components: [{
        type: "body",
        parameters: [firstName, password, APP_BASE_URL].map((text) => ({ type: "text", text })),
      }],
    },
  };
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${META_PHONE_NUM_ID}/messages`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${META_WA_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { console.error("[auth-admin] welcome WA failed:", res.status, await res.text()); return false; }
    return true;
  } catch (e) {
    console.error("[auth-admin] welcome WA error:", e);
    return false;
  }
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

/**
 * Find a Supabase Auth user by email address. supabase-js exposes no
 * "get user by email", so page through the admin list. Bounded so it can never
 * loop unbounded on a very large project.
 */
async function findAuthUserByEmail(email: string) {
  const target = email.toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) return null;
    const hit = data.users.find((u) => (u.email || "").toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < perPage) return null;
  }
  return null;
}

/** Resolve a users row (+ its client_id) by app user id. */
async function getTarget(userId: string) {
  const { data: u } = await admin.from("users").select("id, auth_id, tenant_id").eq("id", userId).single();
  if (!u) return null;
  const { data: t } = await admin.from("tenants").select("client_id").eq("id", u.tenant_id).single();
  return { userId: u.id, authId: u.auth_id as string | null, clientId: t?.client_id as string | undefined };
}

/** Verify the caller's JWT → their app role + client_id. */
async function resolveCaller(jwt: string) {
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data?.user) return null;
  const { data: profile } = await admin.from("users").select("id, role, tenant_id").eq("auth_id", data.user.id).single();
  if (!profile) return null;
  const { data: t } = await admin.from("tenants").select("client_id").eq("id", profile.tenant_id).single();
  return { userId: profile.id, role: profile.role as string, clientId: t?.client_id as string | undefined };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
  if (!jwt) return json({ error: "Not authenticated" }, 401);
  const caller = await resolveCaller(jwt);
  if (!caller) return json({ error: "Not authenticated" }, 401);

  const isSuper = caller.role === "Super Admin";
  if (!(isSuper || caller.role === "Admin")) return json({ error: "Not authorized" }, 403);

  const inScope = (targetClientId?: string) => isSuper || (!!targetClientId && targetClientId === caller.clientId);

  try {
    const { action } = body;

    if (action === "reset_password") {
      const { targetUserId, newPassword } = body;
      if (!targetUserId || !newPassword || String(newPassword).length < 6)
        return json({ error: "A target user and a password of at least 6 characters are required." }, 400);
      const target = await getTarget(targetUserId);
      if (!target) return json({ error: "User not found." }, 404);
      if (!inScope(target.clientId)) return json({ error: "You can only manage users in your own organization." }, 403);
      if (!target.authId) return json({ error: "This user has no login account yet." }, 400);
      const { error } = await admin.auth.admin.updateUserById(target.authId, { password: String(newPassword) });
      if (error) throw error;
      // Require the user to set their own password on next login.
      await admin.from("users").update({ pwd_changed: false }).eq("id", targetUserId);
      return json({ ok: true });
    }

    if (action === "provision_auth") {
      const { targetUserId, password, loginEmail } = body;
      if (!targetUserId || !password || !loginEmail)
        return json({ error: "targetUserId, loginEmail and password are required." }, 400);
      const target = await getTarget(targetUserId);
      if (!target) return json({ error: "User not found." }, 404);
      if (!inScope(target.clientId)) return json({ error: "You can only manage users in your own organization." }, 403);
      if (target.authId) return json({ error: "This user already has a login account." }, 400);
      const emailLc = String(loginEmail).toLowerCase();
      const mkUser = () => admin.auth.admin.createUser({
        email: emailLc,
        password: String(password),
        email_confirm: true,
        user_metadata: { app_user_id: targetUserId },
      });
      let { data: created, error } = await mkUser();
      if (error) {
        // The email (or the phone shim `91<last10>@horae.local`) may belong to
        // an ORPHANED auth account left behind when a staff member was deleted
        // before delete-on-remove existed. If no users row references it, it's
        // safe to reclaim: delete the orphan and retry so the same email /
        // mobile number can be re-onboarded instead of failing forever.
        const orphan = await findAuthUserByEmail(emailLc);
        if (orphan) {
          const { data: linked } = await admin.from("users").select("id").eq("auth_id", orphan.id).maybeSingle();
          if (!linked) {
            await admin.auth.admin.deleteUser(orphan.id);
            ({ data: created, error } = await mkUser());
          }
        }
      }
      if (error) throw error;
      await admin.from("users").update({ auth_id: created.user.id, pwd_changed: false }).eq("id", targetUserId);

      // Best-effort welcome WhatsApp with the temp password + app link, so the
      // staff member gets their credentials on their phone (not just the few
      // seconds it flashes on the admin's screen). Never blocks provisioning.
      let welcomeSent = false;
      const { data: staff } = await admin.from("users").select("name, phone_number").eq("id", targetUserId).single();
      if (staff?.phone_number) {
        welcomeSent = await sendWelcomeWhatsApp(staff.phone_number, staff.name || "", String(password));
      }
      return json({ ok: true, authId: created.user.id, welcomeSent });
    }

    if (action === "delete_auth") {
      const { targetUserId } = body;
      const target = await getTarget(targetUserId);
      if (!target) return json({ ok: true }); // nothing to remove
      if (!inScope(target.clientId)) return json({ error: "You can only manage users in your own organization." }, 403);
      if (target.authId) {
        const { error } = await admin.auth.admin.deleteUser(target.authId);
        if (error) throw error;
      }
      return json({ ok: true });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e: any) {
    console.error("[auth-admin] error:", e);
    return json({ error: String(e?.message || e) }, 500);
  }
});
