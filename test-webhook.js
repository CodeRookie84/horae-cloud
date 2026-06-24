

(async () => {
  const payload = {
    type: "INSERT",
    table: "tasks",
    record: {
      id: "test-task-" + Date.now(),
      tenant_id: "tenant-system",
      title: "Manual Node Test",
      status: "Assigned",
      priority: "High",
      due_date: "2026-06-15",
      assigned_user_id: "user-1780864169375" // Cakewala Admin (verified phone)
    }
  };

  try {
    console.log("Sending POST to notify-dispatcher...");
    const res = await fetch("https://vexqmdrldxhwrpcwbxow.supabase.co/functions/v1/notify-dispatcher", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleHFtZHJsZHhod3JwY3dieG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MTg0MTQsImV4cCI6MjA5NTk5NDQxNH0.8PvUvQf_h1rZD4ZrjFlQOuRaJP45ytGBJjbg_2DEAmI"
      },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
  } catch (err) {
    console.error("Error:", err);
  }
})();
