/**
 * The ONE infrastructure seam between KOT and Horae.
 *
 * KOT re-uses Horae's Supabase client (shared infra, not design). Every KOT file
 * imports the client from HERE, never from `src/services/supabaseClient`, so that
 * extracting KOT into a standalone app is a single-file change: point this at a
 * freshly-created client and nothing else in `src/kot/` needs to move.
 */
export { supabase } from "../../services/supabaseClient";
export type { KotStatus } from "../status";
