-- =============================================================
-- One-time cleanup: ensureOutletChannelsForClient used to seed every
-- outlet's room with the FULL client roster instead of just the staff
-- who belong to that outlet, so non-admin staff ended up a member of
-- every outlet's room regardless of assignment. Admins/super admins
-- are intentionally members of every outlet room — leave those alone.
-- =============================================================

DELETE FROM chat_members cm
USING chat_channels ch, public.users u
WHERE cm.channel_id = ch.id
  AND cm.user_id = u.id
  AND ch.type = 'outlet'
  AND u.tenant_id <> ch.tenant_id
  AND u.role NOT IN ('Admin', 'Super Admin');
