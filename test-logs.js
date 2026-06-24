import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://vexqmdrldxhwrpcwbxow.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleHFtZHJsZHhod3JwY3dieG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MTg0MTQsImV4cCI6MjA5NTk5NDQxNH0.8PvUvQf_h1rZD4ZrjFlQOuRaJP45ytGBJjbg_2DEAmI";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkLogs() {
  const { data, error } = await supabase.from('notification_log')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(10);
    
  if (error) {
    console.error("Error querying logs:", error);
  } else {
    console.log("Latest logs:");
    console.table(data.map(d => ({
      sent_at: d.sent_at,
      event: d.event_type,
      channel: d.channel,
      status: d.status,
      error: d.error_message
    })));
  }
}

checkLogs();
