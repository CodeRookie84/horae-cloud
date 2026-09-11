/**
 * The ONE infrastructure seam between MSG (translation) and Horae.
 *
 * MSG re-uses Horae's Supabase client (shared infra, not design). Every MSG file
 * imports the client from HERE, never from `src/services/supabaseClient`, so that
 * extracting MSG into a standalone app is a single-file change (mirrors
 * src/kot/lib/supabase.ts).
 */
export { supabase } from "../../services/supabaseClient";
