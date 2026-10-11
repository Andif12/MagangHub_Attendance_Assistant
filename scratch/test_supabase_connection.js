const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'] || env['SUPABASE_URL'];
const publishableKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] || env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'] || env['SUPABASE_PUBLISHABLE_KEY'] || env['SUPABASE_ANON_KEY'];
const secretKey = env['SUPABASE_SERVICE_ROLE_KEY'] || env['SUPABASE_SECRET_KEY'];

console.log('=== PEMERIKSAAN KONEKSI SUPABASE ===');
console.log('URL terdeteksi:', Boolean(supabaseUrl));
console.log('Publishable/Anon key terdeteksi:', Boolean(publishableKey));
console.log('Secret/Service role key terdeteksi:', Boolean(secretKey));

async function probe() {
  if (!supabaseUrl || !publishableKey) {
    console.log('Gagal: URL atau Key tidak ditemukan');
    return;
  }

  // 1. Tes koneksi REST dasar dengan Publishable Key
  console.log('\n1. Tes REST ping dengan Publishable Key:');
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': publishableKey,
        'Authorization': `Bearer ${publishableKey}`
      }
    });
    console.log(`Status HTTP: ${res.status} (${res.statusText})`);
  } catch (err) {
    console.log('Fetch error:', err.message);
  }

  // 2. Tes query tabel menggunakan createClient
  const client = createClient(supabaseUrl, secretKey || publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const tables = ['users', 'sessions', 'provider_credentials', 'attendance_records', 'sync_runs', 'notifications', 'notification_preferences'];

  console.log('\n2. Status Pemeriksaan Tabel di Database Supabase:');
  for (const t of tables) {
    try {
      const { data, error, status } = await client.from(t).select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`- Tabel '${t}': HTTP ${status} | [${error.code}] ${error.message}`);
      } else {
        console.log(`- Tabel '${t}': HTTP ${status} | BERHASIL (Tabel Ada)`);
      }
    } catch (e) {
      console.log(`- Tabel '${t}': Exception: ${e.message}`);
    }
  }
}

probe();
