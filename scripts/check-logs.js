import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vexqmdrldxhwrpcwbxow.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleHFtZHJsZHhod3JwY3dieG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MTg0MTQsImV4cCI6MjA5NTk5NDQxNH0.8PvUvQf_h1rZD4ZrjFlQOuRaJP45ytGBJjbg_2DEAmI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogs() {
  const { data, error } = await supabase
    .from('notification_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error("Error fetching logs:", error);
  } else {
    console.log("Recent Notification Logs:");
    data.forEach(log => console.log(`[${log.created_at}] [${log.channel}] [${log.status}] ${log.error_message || ''}`));
  }
}

checkLogs();
