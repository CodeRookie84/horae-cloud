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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

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
      const { data: created, error } = await admin.auth.admin.createUser({
        email: String(loginEmail).toLowerCase(),
        password: String(password),
        email_confirm: true,
        user_metadata: { app_user_id: targetUserId },
      });
      if (error) throw error;
      await admin.from("users").update({ auth_id: created.user.id, pwd_changed: false }).eq("id", targetUserId);
      return json({ ok: true, authId: created.user.id });
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
