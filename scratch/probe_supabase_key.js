const fs = require('fs');
const path = require('path');

const envFile = path.resolve(process.cwd(), '.env.local');
const env = {};
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const k = trimmed.slice(0, idx).trim();
      let v = trimmed.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[k] = v;
    }
  }
}

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const anonKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

async function probeTable(table) {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });
    const text = await res.text();
    console.log(`Table [${table}]: HTTP ${res.status} | Body: ${text.slice(0, 150)}`);
  } catch (err) {
    console.log(`Table [${table}]: Network Error: ${err.message}`);
  }
}

async function run() {
  await probeTable('users');
  await probeTable('attendance_records');
  await probeTable('non_existent_table_test');
}
run();
