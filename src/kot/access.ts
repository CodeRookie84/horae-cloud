/**
 * checkKotAccess — decides whether a logged-in Horae user sees the "Cake KOT"
 * launcher icon. Kept in the KOT module so Horae core carries no KOT logic
 * beyond a single call (isolation contract).
 *
 * Shown only for KOT-enabled clients (a row in kot_clients), then to admins
 * (so they can do first-time setup) or to linked participants (by linked_user_id
 * or phone). Non-KOT clients never see it. The shared floor uses the QR kiosk.
 */
import { supabase } from "./lib/supabase";

export async function checkKotAccess(
  clientId: string,
  userId: string | undefined,
  phone: string | undefined,
  isAdmin: boolean,
): Promise<boolean> {
  if (!clientId) return false;

  // Is this client KOT-enabled at all? (the entitlement flag)
  const { data: enabled } = await supabase
    .from("kot_clients").select("client_id").eq("client_id", clientId).limit(1);
  if (!enabled?.length) return false;

  // Admins can always open it (needed to bootstrap the first station/person).
  if (isAdmin) return true;

  // Otherwise the user must be a linked participant of this client.
  const digits = (phone || "").replace(/\D/g, "");
  const { data } = await supabase.from("kot_participants")
    .select("id, phone, linked_user_id").eq("client_id", clientId).eq("active", true);
  return (data || []).some((p: any) =>
    (userId && p.linked_user_id === userId) ||
    (digits && String(p.phone || "").replace(/\D/g, "").endsWith(digits.slice(-10))),
  );
}
