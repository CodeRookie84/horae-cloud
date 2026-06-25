// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DEPT / ROLE HELPERS  (shared utilities for smart membership)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Converts a department name to a URL-safe channel slug */
export function deptToSlug(department: string): string {
  return (department || 'general')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/, '') || 'general';
}

/** Maps a department string exactly to the channel slug it belongs to */
export function getDeptChannelName(department: string): string {
  return deptToSlug(department);
}

/** Returns true for any manager/supervisor/admin-level role */
export function isManagerRole(role: string): boolean {
  const r = (role || '').toLowerCase();
  return r.includes('admin') || r.includes('manager') || r.includes('supervisor') || r.includes('operations') || r.includes('hr');
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DEFAULT CHANNEL SEEDING  (smart dept-based membership)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface BasicUser { id: string; department: string; role: string; }

/**
 * Seed default channels on first Team Talk use.
 * Dynamically creates one channel per unique department from allUsers.
 * Managers are added to ALL channels. Each dept user goes to their dept channel.
 *  #general       -> everyone
 *  #announcements -> everyone (managers post, staff read-only)
 *  #<dept-slug>   -> users of that department + all managers
 */
export async function seedDefaultChannels(
  tenantId: string,
  creatorId: string,
  allUsers: BasicUser[]
): Promise<void> {
  // Scoped to this outlet (tenant) only — each outlet must get its own room,
  // independent of whether other outlets already have channels.
  const { data: existing } = await supabase
    .from('chat_channels')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1);

  if (existing && existing.length > 0) return;

  const allUserIds = allUsers.map(u => u.id);

  // Fetch tenant name + client to use as channel name / scope
  const { data: tenant } = await supabase.from('tenants').select('name, client_id').eq('id', tenantId).single();
  const outletName = tenant ? tenant.name : 'Outlet';
  const slug = outletName.toLowerCase().replace(/\s+/g, '-');

  // Base Outlet Channel
  const channel = await createChannel(tenantId, slug, 'outlet', creatorId, `${outletName} Outlet Channel`, undefined, undefined, tenant?.client_id);
  if (channel) {
    await addMembers(channel.id, allUserIds);
    await sendSystemMessage(channel.id, tenantId, `Welcome to the ${outletName} channel!`);
  }
}

/**
 * Ensure every outlet under a client has its room/channel, and that all
 * client admins (ADMIN/SUPER_ADMIN) are members of every outlet channel —
 * so admins always see + can read/post in every outlet's room, regardless
 * of which outlet they personally belong to. Call this whenever an admin
 * opens Team Talk, and right after a new outlet is provisioned.
 */
export async function ensureOutletChannelsForClient(
  clientId: string,
  outletTenantIds: string[],
  allClientUsers: BasicUser[],
  adminUserIds: string[],
  creatorId: string
): Promise<void> {
  for (const tenantId of outletTenantIds) {
    const usersInOutlet = allClientUsers; // outlet channel membership seeds with the full roster like before
    await seedDefaultChannels(tenantId, creatorId, usersInOutlet);
  }

  if (adminUserIds.length === 0 || outletTenantIds.length === 0) return;

  const { data: outletChannels } = await supabase
    .from('chat_channels')
    .select('id')
    .eq('client_id', clientId)
    .in('tenant_id', outletTenantIds)
    .eq('type', 'outlet')
    .eq('is_archived', false);

  for (const ch of outletChannels || []) {
    await addMembers(ch.id, adminUserIds);
  }
}


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// AUTO-MEMBERSHIP ON STAFF ONBOARDING
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Call this right after saving a new staff member to Supabase.
 * Auto-adds them to the correct channels from their dept + role.
 * ZERO manual group management needed.
 *
 * In store.ts, after supabase.from('users').insert([newUser]):
 *   await chatService.autoAddUserToChannels(tenantId, newUser.id, newUser.role, newUser.department);
 */
export async function autoAddUserToChannels(
  tenantId: string,
  userId: string,
  role: string,
  department: string
): Promise<void> {
  const toJoin = new Set<string>();

  // Fetch tenant name to find the outlet channel
  const { data: tenant } = await supabase.from('tenants').select('name').eq('id', tenantId).single();
  const outletName = tenant ? tenant.name : 'Outlet';
  const slug = outletName.toLowerCase().replace(/\s+/g, '-');

  // Find outlet channel
  const { data: outletChannel } = await supabase
    .from('chat_channels')
    .select('id, name')
    // .eq('tenant_id', tenantId)
    .eq('type', 'outlet')
    .eq('name', slug)
    .limit(1);

  if (outletChannel && outletChannel[0]) toJoin.add(outletChannel[0].id);

  // Dynamic Rules from auto_rules table
  const { data: rules } = await supabase
    .from('chat_channel_auto_rules')
    .select('channel_id, role, department')
    // .eq('tenant_id', tenantId);

  if (rules) {
    for (const rule of rules) {
      const roleMatch = !rule.role || rule.role === role;
      const deptMatch = !rule.department || rule.department === department;
      if (roleMatch && deptMatch) toJoin.add(rule.channel_id);
    }
  }

  // Add user to all matched channels
  for (const channelId of toJoin) {
    await addMembers(channelId, [userId]);
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ESCALATION
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Escalate a message to a different channel.
 * Posts a system message in the target channel preserving full context.
 * Manager-only action â€” always visible to the whole target channel.
 */
export async function escalateMessage(params: {
  originalMessage: TeamTalkMessage;
  fromChannelName: string;
  toChannelId: string;
  tenantId: string;
  escalatedByName: string;
  note?: string;
}): Promise<void> {
  const { originalMessage, fromChannelName, toChannelId, tenantId, escalatedByName, note } = params;
  const preview = originalMessage.messageType === 'voice'
    ? (originalMessage.voiceTranscript ? '"' + originalMessage.voiceTranscript.slice(0, 120) + '"' : 'Voice message')
    : '"' + (originalMessage.content || '').slice(0, 150) + ((originalMessage.content || '').length > 150 ? '...' : '') + '"';

  const body = [
    'Escalated by ' + escalatedByName + ' from #' + fromChannelName,
    'From: ' + originalMessage.senderName + (originalMessage.senderRole ? ' (' + originalMessage.senderRole + ')' : ''),
    preview,
    ...(note?.trim() ? ['Note: ' + note.trim()] : []),
  ].join('\n');

  await sendSystemMessage(toChannelId, tenantId, 'ESCALATION: ' + body);
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * chatService.ts â€” Team Talk real-time chat service
 * All Supabase operations for channels, messages, voice, reactions, and Gemini integration.
 */

import { supabase } from './supabaseClient';
import { GoogleGenAI } from '@google/genai';
import type { ChatChannel, ChatMember, TeamTalkMessage } from '../types';

const genai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DB row â†’ TypeScript type mappers
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function mapChannel(row: any): ChatChannel {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id ?? undefined,
    name: row.name,
    description: row.description,
    type: row.type,
    contextType: row.context_type,
    contextId: row.context_id,
    createdBy: row.created_by,
    isArchived: row.is_archived,
    createdAt: row.created_at,
  };
}

function mapMessage(row: any): TeamTalkMessage {
  return {
    id: row.id,
    channelId: row.channel_id,
    threadId: row.thread_id ?? undefined,
    threadStatus: row.thread_status ?? undefined,
    threadTitle: row.thread_title ?? undefined,
    parentId: row.parent_id ?? undefined,
    senderId: row.sender_id,
    senderName: row.sender_name,
    senderRole: row.sender_role ?? undefined,
    senderAvatar: row.sender_avatar ?? undefined,
    content: row.content ?? undefined,
    messageType: row.message_type,
    voiceUrl: row.voice_url ?? undefined,
    voiceDurationSec: row.voice_duration_sec ?? undefined,
    voiceTranscript: row.voice_transcript ?? undefined,
    detectedLanguage: row.detected_language ?? undefined,
    translations: row.translations ?? {},
    linkedTaskId: row.linked_task_id ?? undefined,
    linkedChecklistId: row.linked_checklist_id ?? undefined,
    linkedNoticeId: row.linked_notice_id ?? undefined,
    mentionedUserIds: row.mentioned_user_ids ?? undefined,
    isBranched: row.is_branched ?? false,
    branchTaskId: row.branch_task_id ?? undefined,
    reactions: row.reactions ?? {},
    isEdited: row.is_edited ?? false,
    isDeleted: row.is_deleted ?? false,
    tenantId: row.tenant_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CHANNELS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Get all channels a user is a member of, for a given tenant */
export async function getChannels(tenantId: string, userId: string): Promise<ChatChannel[]> {

  // Fetch channels where user is a member
  const { data: memberRows, error: memberErr } = await supabase
    .from('chat_members')
    .select('channel_id')
    .eq('user_id', userId);

  if (memberErr || !memberRows) return [];

  const channelIds = memberRows.map((r: any) => r.channel_id);
  if (channelIds.length === 0) return [];

  const { data, error } = await supabase
    .from('chat_channels')
    .select('*')
    // .eq('tenant_id', tenantId)
    .in('id', channelIds)
    .eq('is_archived', false)
    .order('type', { ascending: true })
    .order('name', { ascending: true });

  if (error || !data) return [];
  const channels = data.map(mapChannel);
  
  // Fetch unread count for each channel
  const channelsWithUnread = await Promise.all(
    channels.map(async (ch) => {
      const unread = await getUnreadCount(ch.id, userId);
      return { ...ch, unreadCount: unread };
    })
  );
  
  return channelsWithUnread;
}

/** Get all member IDs of a specific channel */
export async function getChannelMemberIds(channelId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('chat_members')
    .select('user_id')
    .eq('channel_id', channelId);

  if (error || !data) return [];
  
  return data.map(row => row.user_id);
}

/**
 * Get all channels visible to an admin/manager: every non-DM channel across
 * the given outlet (tenant) IDs — i.e. every outlet under their client —
 * plus their own DMs. `outletTenantIds` should be every tenant belonging
 * to the user's client (their own outlet included).
 */
export async function getAllChannels(outletTenantIds: string[], userId: string): Promise<ChatChannel[]> {
  // 1. Fetch all non-DM channels (Rooms, Channels, Departments) within this client's outlets
  const { data: publicData, error: publicErr } = await supabase
    .from('chat_channels')
    .select('*')
    .in('tenant_id', outletTenantIds)
    .neq('type', 'dm')
    .eq('is_archived', false);

  // 2. Fetch channels where user is a member (to get their DMs)
  const { data: memberRows } = await supabase
    .from('chat_members')
    .select('channel_id')
    .eq('user_id', userId);

  const memberChannelIds = memberRows ? memberRows.map((r: any) => r.channel_id) : [];
  
  let memberData: any[] = [];
  if (memberChannelIds.length > 0) {
    const { data: mData } = await supabase
      .from('chat_channels')
      .select('*')
      .in('id', memberChannelIds)
      .eq('is_archived', false);
    if (mData) memberData = mData;
  }

  // Combine and deduplicate
  const allData = [...(publicData || []), ...memberData];
  const uniqueChannelsMap = new Map();
  allData.forEach(row => uniqueChannelsMap.set(row.id, row));
  const uniqueData = Array.from(uniqueChannelsMap.values());

  // Sort
  uniqueData.sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.name.localeCompare(b.name);
  });

  const channels = uniqueData.map(mapChannel);
  
  // Fetch unread count for each channel
  const channelsWithUnread = await Promise.all(
    channels.map(async (ch) => {
      const unread = await getUnreadCount(ch.id, userId);
      return { ...ch, unreadCount: unread };
    })
  );
  
  return channelsWithUnread;
}

/** Create a new channel and add the creator as admin member */
export async function createChannel(
  tenantId: string,
  name: string,
  type: ChatChannel['type'],
  createdBy: string,
  description?: string,
  contextType?: 'task' | 'notice' | 'checklist',
  contextId?: string,
  clientId?: string
): Promise<ChatChannel | null> {
  let resolvedClientId = clientId;
  if (!resolvedClientId) {
    const { data: tenant } = await supabase.from('tenants').select('client_id').eq('id', tenantId).single();
    resolvedClientId = tenant?.client_id;
  }

  const { data, error } = await supabase
    .from('chat_channels')
    .insert({
      tenant_id: tenantId,
      client_id: resolvedClientId ?? null,
      name: name.toLowerCase().replace(/\s+/g, '-'),
      description,
      type,
      context_type: contextType ?? null,
      context_id: contextId ?? null,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('createChannel error:', error);
    return null;
  }

  // Add creator as admin member
  await supabase.from('chat_members').insert({
    channel_id: data.id,
    user_id: createdBy,
    role: 'admin',
  });

  return mapChannel(data);
}

/** Update channel properties (e.g., name, description) */
export async function updateChannel(channelId: string, updates: Partial<ChatChannel>): Promise<void> {
  const payload: any = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.description !== undefined) payload.description = updates.description;
  
  if (Object.keys(payload).length === 0) return;

  await supabase
    .from('chat_channels')
    .update(payload)
    .eq('id', channelId);
}

/** Add a user to a channel */
export async function addMember(channelId: string, userId: string, role: 'admin' | 'member' = 'member'): Promise<void> {
  await supabase.from('chat_members').upsert({
    channel_id: channelId,
    user_id: userId,
    role,
  }, { onConflict: 'channel_id,user_id' });
}

/** Bulk add members to a channel */
export async function addMembers(channelId: string, userIds: string[]): Promise<void> {
  const rows = userIds.map(uid => ({ channel_id: channelId, user_id: uid, role: 'member' }));
  await supabase.from('chat_members').upsert(rows, { onConflict: 'channel_id,user_id' });
}

export async function removeMembers(channelId: string, userIds: string[]): Promise<void> {
  await supabase
    .from('chat_members')
    .delete()
    .eq('channel_id', channelId)
    .in('user_id', userIds);
}

/** Get membership record for a user in a channel */
export async function getMember(channelId: string, userId: string): Promise<ChatMember | null> {
  const { data, error } = await supabase
    .from('chat_members')
    .select('*')
    .eq('channel_id', channelId)
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return {
    channelId: data.channel_id,
    userId: data.user_id,
    role: data.role,
    lastReadAt: data.last_read_at ?? undefined,
    isMuted: data.is_muted,
    joinedAt: data.joined_at,
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MESSAGES
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Get top-level (non-threaded) messages for a channel, paginated */
export async function getMessages(
  channelId: string,
  limit = 50,
  beforeTimestamp?: string
): Promise<TeamTalkMessage[]> {
  let query = supabase
    .from('chat_messages')
    .select('*')
    .eq('channel_id', channelId)
    .is('thread_id', null)         // only root messages
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (beforeTimestamp) {
    query = query.lt('created_at', beforeTimestamp);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(mapMessage);
}

/** Get all replies in a thread (given the root message id) */
export async function getThreadReplies(threadId: string): Promise<TeamTalkMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('thread_id', threadId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data.map(mapMessage);
}

/** Get reply counts for a list of message IDs (for thread badges) */
export async function getReplyCountsBatch(messageIds: string[]): Promise<Record<string, number>> {
  if (!messageIds.length) return {};

  const { data, error } = await supabase
    .from('chat_messages')
    .select('thread_id')
    .in('thread_id', messageIds)
    .eq('is_deleted', false);

  if (error || !data) return {};

  const counts: Record<string, number> = {};
  for (const row of data) {
    if (row.thread_id) {
      counts[row.thread_id] = (counts[row.thread_id] || 0) + 1;
    }
  }
  return counts;
}

/** Send a text message */
export async function sendMessage(params: {
  channelId: string;
  tenantId: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  senderAvatar?: string;
  content: string;
  threadId?: string;
  parentId?: string;
  linkedTaskId?: string;
  linkedChecklistId?: string;
  linkedNoticeId?: string;
  mentionedUserIds?: string[];
  threadStatus?: string;
  messageType?: string;
}): Promise<TeamTalkMessage | null> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      channel_id: params.channelId,
      tenant_id: params.tenantId,
      thread_id: params.threadId ?? null,
      parent_id: params.parentId ?? null,
      sender_id: params.senderId,
      sender_name: params.senderName,
      sender_role: params.senderRole ?? null,
      sender_avatar: params.senderAvatar ?? null,
      content: params.content,
      message_type: params.messageType ?? 'text',
      linked_task_id: params.linkedTaskId ?? null,
      linked_checklist_id: params.linkedChecklistId ?? null,
      linked_notice_id: params.linkedNoticeId ?? null,
      mentioned_user_ids: params.mentionedUserIds ?? null,
      thread_status: params.threadStatus ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('sendMessage error:', error);
    return null;
  }
  return mapMessage(data);
}

/** Send a system message (e.g., "Task #1024 created from this thread") */
export async function sendSystemMessage(
  channelId: string,
  tenantId: string,
  content: string,
  threadId?: string,
  branchTaskId?: string
): Promise<void> {
  await supabase.from('chat_messages').insert({
    channel_id: channelId,
    tenant_id: tenantId,
    thread_id: threadId ?? null,
    sender_id: 'system',
    sender_name: 'Horae',
    content,
    message_type: 'system',
    branch_task_id: branchTaskId ?? null
  });
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// VOICE MESSAGES
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Upload a voice recording blob to Supabase Storage and insert message.
 * Returns the full message record.
 */
export async function sendVoiceMessage(params: {
  channelId: string;
  tenantId: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  senderAvatar?: string;
  audioBlob: Blob;
  durationSec: number;
  threadId?: string;
  mentionedUserIds?: string[];
  threadStatus?: string;
}): Promise<TeamTalkMessage | null> {
  // 1. Upload to Supabase Storage
  const fileName = `${params.tenantId}/${params.channelId}/${Date.now()}-${params.senderId}.webm`;
  const { error: storageError } = await supabase.storage
    .from('chat-voice-messages')
    .upload(fileName, params.audioBlob, {
      contentType: 'audio/webm',
      upsert: false,
    });

  if (storageError) {
    console.error('Voice upload error:', storageError);
    return null;
  }

  // 2. Get public URL
  const { data: urlData } = supabase.storage
    .from('chat-voice-messages')
    .getPublicUrl(fileName);
  const voiceUrl = urlData.publicUrl;

  // 3. Try Gemini transcription (non-blocking â€” if it fails we still save the message)
  let transcript: string | undefined;
  try {
    transcript = await transcribeVoice(params.audioBlob);
  } catch (e) {
    console.warn('Voice transcription failed (non-fatal):', e);
  }

  // 4. Insert message record
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      channel_id: params.channelId,
      tenant_id: params.tenantId,
      thread_id: params.threadId ?? null,
      sender_id: params.senderId,
      sender_name: params.senderName,
      sender_role: params.senderRole ?? null,
      sender_avatar: params.senderAvatar ?? null,
      message_type: 'voice',
      voice_url: voiceUrl,
      voice_duration_sec: params.durationSec,
      voice_transcript: transcript ?? null,
      mentioned_user_ids: params.mentionedUserIds ?? null,
      thread_status: params.threadStatus ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('sendVoiceMessage insert error:', error);
    return null;
  }
  return mapMessage(data);
}

/** Transcribe voice audio using Gemini */
export async function transcribeVoice(audioBlob: Blob): Promise<string> {
  // Convert blob to base64
  const arrayBuffer = await audioBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Audio = btoa(binary);

  const response = await genai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'audio/webm',
              data: base64Audio,
            },
          },
          {
            text: 'Transcribe this voice message accurately. If non-English, transcribe in the original language. Return only the transcription text, nothing else.',
          },
        ],
      },
    ],
  });

  return response.text ?? '';
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// REACTIONS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Toggle a reaction on a message.
 * If the user already reacted with this emoji, removes it. Otherwise adds it.
 */
export async function toggleReaction(
  messageId: string,
  emoji: string,
  userId: string,
  currentReactions: Record<string, string[]>
): Promise<void> {
  const updated = { ...currentReactions };
  const users = updated[emoji] ?? [];
  if (users.includes(userId)) {
    updated[emoji] = users.filter(uid => uid !== userId);
    if (updated[emoji].length === 0) delete updated[emoji];
  } else {
    updated[emoji] = [...users, userId];
  }

  await supabase
    .from('chat_messages')
    .update({ reactions: updated })
    .eq('id', messageId);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TRANSLATION (Gemini)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu',
  kn: 'Kannada', ml: 'Malayalam', mr: 'Marathi', gu: 'Gujarati',
  pa: 'Punjabi', bn: 'Bengali', ur: 'Urdu',
};

/** Translate a message to a target language using Gemini. Caches result in DB. */
export async function translateMessage(
  messageId: string,
  targetLang: string,
  content: string,
  existingTranslations: Record<string, string>
): Promise<string> {
  // Return cached translation if available
  if (existingTranslations[targetLang]) {
    return existingTranslations[targetLang];
  }

  const langName = LANGUAGE_NAMES[targetLang] || targetLang;
  const response = await genai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{
      role: 'user',
      parts: [{
        text: `Translate the following message to ${langName}. Return only the translated text, nothing else, no quotes.\n\nMessage: ${content}`,
      }],
    }],
  });

  const translated = response.text?.trim() ?? content;

  // Cache in DB for future requests
  const updatedTranslations = { ...existingTranslations, [targetLang]: translated };
  await supabase
    .from('chat_messages')
    .update({ translations: updatedTranslations })
    .eq('id', messageId);

  return translated;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// READ RECEIPTS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Mark a channel as read by updating last_read_at for the user */
export async function markChannelRead(channelId: string, userId: string): Promise<void> {
  await supabase
    .from('chat_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('channel_id', channelId)
    .eq('user_id', userId);
}

/** Count unread messages in a channel for a user since last_read_at */
export async function getUnreadCount(channelId: string, userId: string): Promise<number> {
  const { data: member } = await supabase
    .from('chat_members')
    .select('last_read_at')
    .eq('channel_id', channelId)
    .eq('user_id', userId)
    .single();

  if (!member) return 0;

  const lastRead = member.last_read_at ?? '1970-01-01T00:00:00Z';

  const { count } = await supabase
    .from('chat_messages')
    .select('*', { count: 'exact', head: true })
    .eq('channel_id', channelId)
    .eq('is_deleted', false)
    .neq('sender_id', userId)
    .gt('created_at', lastRead);

  return count ?? 0;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TASK BRANCHING (Fork + Link pattern)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Mark a message as having been branched into a task.
 * Inserts a system message in the thread with a link to the new task.
 */
export async function markMessageBranched(
  messageId: string,
  channelId: string,
  tenantId: string,
  taskId: string,
  taskTitle: string,
  threadId?: string
): Promise<void> {
  // Mark original message as branched
  await supabase
    .from('chat_messages')
    .update({ is_branched: true, branch_task_id: taskId })
    .eq('id', messageId);

  // Insert system message in the same thread/channel so everyone sees the link
  await sendSystemMessage(
    channelId,
    tenantId,
    `🔗 Task created: "${taskTitle}" — [View in Task Manager]`,
    threadId,
    taskId
  );
}

// ————————————————————————————————————————————————————————————————————————————
// REALTIME SUBSCRIPTIONS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Subscribe to new messages in a channel via Supabase Realtime WebSocket.
 * Returns an unsubscribe function.
 */
export function subscribeToChannel(
  channelId: string,
  onMessage: (msg: TeamTalkMessage) => void,
  onDelete?: (messageId: string) => void
): () => void {
  const channelName = `chat:${channelId}`;
  const subscription = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${channelId}`,
      },
      (payload) => {
        onMessage(mapMessage(payload.new));
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${channelId}`,
      },
      (payload) => {
        // Deliver updated message (handles reaction updates, edits)
        onMessage(mapMessage(payload.new));
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MESSAGE SEARCH
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Full-text search across messages (content + voice transcripts) */
export async function searchMessages(
  tenantId: string,
  query: string,
  channelId?: string
): Promise<TeamTalkMessage[]> {
  let dbQuery = supabase
    .from('chat_messages')
    .select('*')
    // .eq('tenant_id', tenantId)
    .eq('is_deleted', false)
    .textSearch('content', query, { type: 'websearch' })
    .limit(30);

  if (channelId) dbQuery = dbQuery.eq('channel_id', channelId);

  const { data, error } = await dbQuery;
  if (error || !data) return [];
  return data.map(mapMessage);
}

/** Delete a message (soft delete) */
export async function deleteMessage(messageId: string): Promise<void> {
  await supabase
    .from('chat_messages')
    .update({ is_deleted: true, content: '[Message deleted]' })
    .eq('id', messageId);
}

/** Edit a message */
export async function editMessage(messageId: string, newContent: string): Promise<void> {
  await supabase
    .from('chat_messages')
    .update({ content: newContent, is_edited: true })
    .eq('id', messageId);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MENTIONS (@mentions)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Insert mention records after sending a message.
 * Call this after sendMessage resolves with a valid message ID.
 */
export async function insertMentions(
  messageId: string,
  channelId: string,
  tenantId: string,
  mentionedUserIds: string[],
  mentionedByUserId: string
): Promise<void> {
  if (!mentionedUserIds.length) return;
  const rows = mentionedUserIds.map(uid => ({
    message_id: messageId,
    channel_id: channelId,
    tenant_id: tenantId,
    mentioned_user_id: uid,
    mentioned_by_user_id: mentionedByUserId,
    is_read: false,
  }));
  await supabase.from('chat_mentions').insert(rows);

  // Also update the message record with mentioned_user_ids
  await supabase
    .from('chat_messages')
    .update({ mentioned_user_ids: mentionedUserIds })
    .eq('id', messageId);
}

/**
 * Get all unread @mentions for a user across a tenant.
 * Returns the full message objects for display in "My Day".
 */
export async function getMentions(
  userId: string,
  tenantId: string
): Promise<TeamTalkMessage[]> {
  const { data: mentionRows, error } = await supabase
    .from('chat_mentions')
    .select('message_id')
    .eq('mentioned_user_id', userId)
    // .eq('tenant_id', tenantId)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error || !mentionRows || mentionRows.length === 0) return [];

  const messageIds = mentionRows.map((r: any) => r.message_id);
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('*')
    .in('id', messageIds)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  return (messages ?? []).map(mapMessage);
}

/** Mark all @mentions as read for a user in a specific channel */
export async function markMentionsRead(userId: string, channelId: string): Promise<void> {
  await supabase
    .from('chat_mentions')
    .update({ is_read: true })
    .eq('mentioned_user_id', userId)
    .eq('channel_id', channelId);
}

/** Count unread @mentions for a user in a tenant */
export async function getMentionCount(userId: string, tenantId: string): Promise<number> {
  const { count } = await supabase
    .from('chat_mentions')
    .select('*', { count: 'exact', head: true })
    .eq('mentioned_user_id', userId)
    // .eq('tenant_id', tenantId)
    .eq('is_read', false);
  return count ?? 0;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PINNED MESSAGES
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Pin a message to the top of a channel */
export async function pinMessage(
  channelId: string,
  messageId: string,
  pinnedBy: string
): Promise<void> {
  await supabase
    .from('chat_channels')
    .update({
      pinned_message_id: messageId,
      pinned_at: new Date().toISOString(),
      pinned_by: pinnedBy,
    })
    .eq('id', channelId);
}

/** Unpin the current pinned message from a channel */
export async function unpinMessage(channelId: string): Promise<void> {
  await supabase
    .from('chat_channels')
    .update({ pinned_message_id: null, pinned_at: null, pinned_by: null })
    .eq('id', channelId);
}

/** Fetch the pinned message for a channel (if any) */
export async function getPinnedMessage(channelId: string): Promise<TeamTalkMessage | null> {
  // Get the channel to find pinned_message_id
  const { data: channel } = await supabase
    .from('chat_channels')
    .select('pinned_message_id')
    .eq('id', channelId)
    .single();

  if (!channel?.pinned_message_id) return null;

  const { data: msg } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('id', channel.pinned_message_id)
    .single();

  return msg ? mapMessage(msg) : null;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CHANNEL MANAGEMENT
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Soft-delete (archive) a channel â€” admin only */
export async function deleteChannel(channelId: string): Promise<void> {
  await supabase
    .from('chat_channels')
    .update({ is_archived: true })
    .eq('id', channelId);
}

/** Get the "outlet feed" channel for a tenant (the general/outlet-level channel) */
export async function getOutletChannel(tenantId: string): Promise<ChatChannel | null> {
  // Try to find a channel named 'general' or type 'outlet'
  const { data } = await supabase
    .from('chat_channels')
    .select('*')
    // .eq('tenant_id', tenantId)
    .eq('is_archived', false)
    .or('name.eq.general,type.eq.outlet')
    .limit(1)
    .single();

  return data ? mapChannel(data) : null;
}

/** Get the announcement channel for a tenant */
export async function getAnnouncementChannel(tenantId: string): Promise<ChatChannel | null> {
  const { data } = await supabase
    .from('chat_channels')
    .select('*')
    // .eq('tenant_id', tenantId)
    .eq('type', 'announcement')
    .eq('is_archived', false)
    .limit(1)
    .single();

  return data ? mapChannel(data) : null;
}

/**
 * Send a message WITH mention support.
 * Extended version of sendMessage that also creates mention records.
 */
export async function sendMessageWithMentions(params: {
  channelId: string;
  tenantId: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  senderAvatar?: string;
  content: string;
  mentionedUserIds?: string[];
  threadId?: string;
  parentId?: string;
  linkedTaskId?: string;
  threadStatus?: string;
}): Promise<TeamTalkMessage | null> {
  const msg = await sendMessage({
    channelId: params.channelId,
    tenantId: params.tenantId,
    senderId: params.senderId,
    senderName: params.senderName,
    senderRole: params.senderRole,
    senderAvatar: params.senderAvatar,
    content: params.content,
    threadId: params.threadId,
    parentId: params.parentId,
    linkedTaskId: params.linkedTaskId,
    mentionedUserIds: params.mentionedUserIds,
    threadStatus: params.threadStatus,
  });

  if (msg) {
    if (params.mentionedUserIds?.length) {
      await insertMentions(
        msg.id,
        params.channelId,
        params.tenantId,
        params.mentionedUserIds,
        params.senderId
      );
    }

    // Always ensure participants are tracked for threads, private threads, or mentions
    if (params.threadId || params.threadStatus === 'private' || params.mentionedUserIds?.length) {
      const rootThreadId = params.threadId || msg.id;
      const allParticipantIds = new Set(params.mentionedUserIds || []);
      allParticipantIds.add(params.senderId); // Sender is always a participant
      
      // If this is a reply to a thread, ensure the root author is also a participant
      if (params.threadId) {
        const { data: rootMsg } = await supabase.from('chat_messages').select('sender_id').eq('id', params.threadId).single();
        if (rootMsg && rootMsg.sender_id) {
          allParticipantIds.add(rootMsg.sender_id);
        }
      }

      const participantRows = Array.from(allParticipantIds).map(uid => ({
        thread_id: rootThreadId,
        user_id: uid,
        last_read_at: uid === params.senderId ? new Date().toISOString() : '1970-01-01T00:00:00Z'
      }));
      await supabase.from('chat_thread_participants').upsert(participantRows, { onConflict: 'thread_id,user_id', ignoreDuplicates: true });
    }
  }

  return msg;
}

/**
 * Subscribe to @mentions for a user (for real-time mention badge updates)
 */
export function subscribeToMentions(
  userId: string,
  tenantId: string,
  onMention: () => void
): () => void {
  const sub = supabase
    .channel(`mentions:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_mentions',
        filter: `mentioned_user_id=eq.${userId}`,
      },
      () => onMention()
    )
    .subscribe();

  return () => supabase.removeChannel(sub);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ESCALATED MESSAGES (Unified Inbox)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getEscalatedMessages(tenantId: string, role: string): Promise<TeamTalkMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    // .eq('tenant_id', tenantId)
    .eq('escalation_status', 'pending')
    .in('escalation_role', [role, 'Manager', 'Management']) // Basic role matching
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map(mapMessage);
}
// Add to chatService.ts

/** Elevate or Resolve a Thread */
export async function updateThreadStatus(threadId: string, status: 'open' | 'active' | 'resolved', title?: string): Promise<void> {
  const updates: any = { thread_status: status };
  if (title) updates.thread_title = title;
  await supabase.from('chat_messages').update(updates).eq('id', threadId);
}

/** Get All Recent Threads for Inbox */
export async function getAllThreads(tenantId: string, limit: number = 50): Promise<TeamTalkMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    // .eq('tenant_id', tenantId)
    .not('thread_status', 'is', null) // Has a thread status (meaning it's a thread root)
    .is('thread_id', null) // Is a root message
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map(mapMessage);
}

/** Get Active Threads for a User or Admin */
export async function getActiveThreads(tenantId: string, userId: string, isAdmin: boolean): Promise<TeamTalkMessage[]> {
  if (isAdmin) {
    // Admins see all active threads in the tenant
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      // .eq('tenant_id', tenantId)
      .eq('thread_status', 'active')
      .is('thread_id', null)
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false });
    if (error || !data) return [];
    return data.map(mapMessage);
  } else {
    // Regular users see threads they are participants of, OR threads that belong to channels they are in
    // This requires a complex query or multiple queries. For simplicity, we can fetch all active threads
    // and filter them, or use an RPC. Since we want an easy way out without new RPCs:
    
    // 1. Get channels user is in
    const { data: memberRows } = await supabase.from('chat_members').select('channel_id').eq('user_id', userId);
    const channelIds = memberRows?.map((r: any) => r.channel_id) || [];
    
    // 2. Get threads user is explicitly pulled into via mentions
    const { data: partRows } = await supabase.from('chat_thread_participants').select('thread_id').eq('user_id', userId);
    const specificThreadIds = partRows?.map((r: any) => r.thread_id) || [];

    // 3. Fetch active threads matching either condition
    let query = supabase
      .from('chat_messages')
      .select('*')
      // .eq('tenant_id', tenantId)
      .eq('thread_status', 'active')
      .is('thread_id', null)
      .eq('is_deleted', false);
      
    const { data, error } = await query;
    if (error || !data) return [];
    
    const allActive = data.map(mapMessage);
    
    // Filter in JS for simplicity since OR queries across different tables/arrays can be tricky without RPC
    return allActive.filter(msg => 
      channelIds.includes(msg.channelId) || specificThreadIds.includes(msg.id)
    );
  }
}

// ─────────────────────────────────────────────────────────────
// THREAD PARTICIPANTS  (private thread visibility)
// ─────────────────────────────────────────────────────────────

/** Start a private thread on a message — stores participant list */
export async function startThread(
  threadId: string,
  participantIds: string[],
  title: string,
  tenantId: string
): Promise<void> {
  // Set thread status on the root message
  await supabase.from('chat_messages')
    .update({ thread_status: 'open', thread_title: title })
    .eq('id', threadId);

  // Upsert participant rows
  const rows = participantIds.map(uid => ({
    thread_id: threadId,
    user_id: uid,
    joined_at: new Date().toISOString(),
  }));
  await supabase.from('chat_thread_participants').upsert(rows, { onConflict: 'thread_id,user_id' });
}

/** Get participant user IDs for a thread */
export async function getThreadParticipants(threadId: string): Promise<string[]> {
  const { data } = await supabase
    .from('chat_thread_participants')
    .select('user_id')
    .eq('thread_id', threadId);
  return (data || []).map((r: any) => r.user_id);
}

/** Add members to an existing active thread */
export async function addThreadParticipants(threadId: string, userIds: string[]): Promise<void> {
  const rows = userIds.map(uid => ({
    thread_id: threadId,
    user_id: uid,
    joined_at: new Date().toISOString(),
  }));
  await supabase.from('chat_thread_participants').upsert(rows, { onConflict: 'thread_id,user_id' });
}

/** Close a thread — set status to resolved, clears from active sidebar */
export async function closeThread(threadId: string): Promise<void> {
  await supabase.from('chat_messages')
    .update({ thread_status: 'resolved' })
    .eq('id', threadId);
}

/** Mark thread as read for a user */
export async function markThreadRead(threadId: string, userId: string): Promise<void> {
  await supabase.from('chat_thread_participants')
    .update({ last_read_at: new Date().toISOString() })
    .match({ thread_id: threadId, user_id: userId });
}

/** Get Unread Threads for a User */
export async function getUnreadThreads(tenantId: string, userId: string): Promise<TeamTalkMessage[]> {
  const { data: partRows } = await supabase.from('chat_thread_participants').select('thread_id, last_read_at').eq('user_id', userId);
  if (!partRows || partRows.length === 0) return [];
  
  const unreadThreads: TeamTalkMessage[] = [];
  
  for (const part of partRows) {
    const lastRead = part.last_read_at ?? '1970-01-01T00:00:00Z';
    const { count, data: replies } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact' })
      .eq('thread_id', part.thread_id)
      .neq('sender_id', userId)
      .gt('created_at', lastRead);
      
    if (count && count > 0) {
      const { data: thread } = await supabase.from('chat_messages').select('*').eq('id', part.thread_id).single();
      if (thread) {
        const mapped = mapMessage(thread);
        mapped.unreadReplyCount = count;
        unreadThreads.push(mapped);
      }
    }
  }
  
  return unreadThreads;
}

// ─────────────────────────────────────────────────────────────
// REAL-TIME SYNC FOR CHANNELS & MEMBERS
// ─────────────────────────────────────────────────────────────

export function subscribeToChannelsList(
  tenantId: string,
  userId: string,
  onUpdate: () => void
): () => void {
  const channel = supabase
    .channel(`sync-channels-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_channels', filter: `tenant_id=eq.${tenantId}` }, onUpdate)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members', filter: `user_id=eq.${userId}` }, onUpdate)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToChannelMembers(
  channelId: string,
  onUpdate: () => void
): () => void {
  const channel = supabase
    .channel(`sync-members-${channelId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members', filter: `channel_id=eq.${channelId}` }, onUpdate)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
