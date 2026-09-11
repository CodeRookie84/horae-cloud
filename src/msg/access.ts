/**
 * checkMsgAccess — decides whether a logged-in Horae user sees the "Translate"
 * launcher icon. Kept in the MSG module so Horae core carries no MSG logic beyond
 * a single call (isolation contract, mirrors src/kot/access.ts).
 *
 * Translation itself is a WhatsApp-only self-help feature that EVERY staff member
 * gets by default (like reminders), so onboarded participants have no in-app
 * screen. The icon only opens the backend admin surface — a place to give the
 * translator to extra non-staff phone numbers — so it is shown to admins only.
 * There is no per-client entitlement to check, so this stays synchronous-cheap
 * (kept async to match the KOT gate's call site in App.tsx).
 */
export async function checkMsgAccess(
  clientId: string,
  _userId: string | undefined,
  _phone: string | undefined,
  isAdmin: boolean,
): Promise<boolean> {
  return !!clientId && isAdmin;
}
