/**
 * swotService.ts — Supabase-backed persistence for the SWOT Compass feature.
 * Replaces the original tool's standalone /api backend. One analysis per user
 * (retaking overwrites via upsert on user_id).
 */
import { supabase } from './supabaseClient';
import type { AnalysisRecord } from '../components/swot/swotEngine';

function mapRow(row: any): AnalysisRecord {
  return {
    role: row.role || '',
    industry: row.industry || '',
    file: row.file || '',
    s: row.s || [],
    w: row.w || [],
    o: row.o || [],
    t: row.t || [],
    sMore: row.s_more || '',
    wMore: row.w_more || '',
    oMore: row.o_more || '',
    tMore: row.t_more || '',
    answers: row.answers || { likert: {}, texts: {} },
    completedAt: row.completed_at,
  };
}

/** The user's current analysis, or null if they haven't completed one. */
export async function getMyAnalysis(userId: string): Promise<AnalysisRecord | null> {
  const { data, error } = await supabase
    .from('swot_analyses')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data);
}

/** Save (upsert) the user's analysis. Overwrites any previous one. */
export async function saveAnalysis(
  userId: string,
  tenantId: string | null,
  clientId: string | null,
  record: AnalysisRecord
): Promise<boolean> {
  const now = new Date().toISOString();
  const { error } = await supabase.from('swot_analyses').upsert({
    user_id: userId,
    tenant_id: tenantId,
    client_id: clientId,
    role: record.role,
    industry: record.industry,
    file: record.file || '',
    s: record.s,
    w: record.w,
    o: record.o,
    t: record.t,
    s_more: record.sMore || '',
    w_more: record.wMore || '',
    o_more: record.oMore || '',
    t_more: record.tMore || '',
    answers: record.answers || { likert: {}, texts: {} },
    completed_at: now,
    updated_at: now,
  }, { onConflict: 'user_id' });

  if (error) { console.error('saveAnalysis:', error); return false; }
  return true;
}
