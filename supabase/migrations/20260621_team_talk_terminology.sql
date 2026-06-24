-- =============================================================
-- Team Talk — Terminology Migration
-- Migration: 20260621_team_talk_terminology.sql
-- Description: Renames 'group' to 'channel', and 'channel' to 'room' in chat_channels type.
-- =============================================================

-- 1. Drop existing CHECK constraints on chat_channels.type
-- Since constraints might have auto-generated names, we dynamically drop them.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'chat_channels'::regclass
          AND contype = 'c'
    ) LOOP
        -- We will drop all check constraints and re-add the necessary ones.
        -- This ensures we catch the 'type' constraint regardless of its name.
        EXECUTE 'ALTER TABLE chat_channels DROP CONSTRAINT ' || r.conname;
    END LOOP;
END $$;

-- 2. Update existing data
-- It's critical to update 'channel' to 'room' first to avoid conflicts
UPDATE chat_channels
SET type = 'room'
WHERE type = 'channel';

UPDATE chat_channels
SET type = 'channel'
WHERE type = 'group';

-- 3. Re-add the CHECK constraints with the new allowed values
ALTER TABLE chat_channels 
ADD CONSTRAINT chat_channels_type_check 
CHECK (type IN ('announcement', 'department', 'outlet', 'context', 'dm', 'channel', 'room'));

ALTER TABLE chat_channels 
ADD CONSTRAINT chat_channels_context_type_check 
CHECK (context_type IN ('task', 'notice', 'checklist'));
