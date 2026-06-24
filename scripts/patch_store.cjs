// Patch store.ts — add autoAddUserToChannels call after user insert
const fs = require('fs');

// 1. Patch store.ts
const storePath = 'c:\\Users\\admin\\horae-ops\\src\\services\\store.ts';
let store = fs.readFileSync(storePath, 'utf8');

// Add import for chatService at the top (after existing imports)
if (!store.includes('autoAddUserToChannels')) {
  // Find the last import line
  const importInsertPoint = store.indexOf("import { createClient }");
  if (importInsertPoint !== -1) {
    const lineEnd = store.indexOf('\n', importInsertPoint);
    store = store.slice(0, lineEnd + 1) + "import * as chatService from './chatService';\r\n" + store.slice(lineEnd + 1);
  }

  // Add autoAddUserToChannels call after the supabase insert
  store = store.replace(
    "    await supabase.from('users').insert([newUser]);\r\n    return {",
    "    await supabase.from('users').insert([newUser]);\r\n    // Auto-add to Team Talk channels based on dept + role (zero manual setup needed)\r\n    chatService.autoAddUserToChannels(tenantId, newUser.id, newUser.role, newUser.department).catch(console.error);\r\n    return {"
  );
  fs.writeFileSync(storePath, store, 'utf8');
  console.log('store.ts patched: autoAddUserToChannels call added');
} else {
  console.log('store.ts already patched');
}
