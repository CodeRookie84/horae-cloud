-- Drop the Team Talk (chat) tables — the Team Talk feature was removed from the
-- app on 2026-08-08 (archived separately as a ZIP). These 9 tables are its only
-- remaining DB footprint; after the 2026-08-10 residue cleanup, NO app code or
-- edge function reads or writes them:
--   * store.sendUrgentMessageWhatsAppPush() (the last chat_members reader) removed
--   * notify-dispatcher's dead `kind === "message"` branch removed
--   * task.linkedChannelId / linkedMessageId (convert-message-to-task) removed
--
-- notify-dispatcher itself is UNCHANGED in behaviour for the task manager,
-- notices, digests, and urgent task/notice/training pushes — only the unused
-- Team Talk message path was pruned.
--
-- ⚠️ DESTRUCTIVE: permanently deletes all Team Talk history. No staging DB exists,
-- and the feature was already archived, so run this only when you're certain the
-- archive is sufficient. CASCADE handles the inter-table FKs (all internal to the
-- chat set + references to users); nothing OUTSIDE the chat set references these
-- tables, so the cascade cannot reach tasks/notices/checklists/etc.
--
-- Apply via the Supabase dashboard SQL editor, or from a linked CLI:
--   supabase db query --linked "<paste this file>"
--
-- Idempotent: safe to re-run.

DROP TABLE IF EXISTS public.chat_read_receipts       CASCADE;
DROP TABLE IF EXISTS public.chat_thread_participants  CASCADE;
DROP TABLE IF EXISTS public.chat_mentions             CASCADE;
DROP TABLE IF EXISTS public.chat_priority_users       CASCADE;
DROP TABLE IF EXISTS public.chat_channel_auto_rules   CASCADE;
DROP TABLE IF EXISTS public.chat_members              CASCADE;
DROP TABLE IF EXISTS public.chat_messages             CASCADE;
DROP TABLE IF EXISTS public.chat_channels             CASCADE;
DROP TABLE IF EXISTS public.chat_spaces               CASCADE;
