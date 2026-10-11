export interface AppEnv {
  isProduction: boolean;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
  databaseUrl?: string;
  encryptionKey?: string;
  sessionSecret: string;
  cronSecret?: string;
  appUrl: string;
  syncIntervalMinutes: number;
  defaultTimezone: string;
  monevApiBaseUrl: string;
}

export function validateEnv(): AppEnv {
  const isProduction = process.env.NODE_ENV === "production";

  // Sesi JWT secret
  const sessionSecret = process.env.MAA_SESSION_SECRET || process.env.MAA_JWT_SECRET;
  if (!sessionSecret && isProduction) {
    throw new Error(
      "Konfigurasi Error: Variabel lingkungan MAA_SESSION_SECRET wajib diatur di lingkungan production."
    );
  }

  // Enkripsi key
  const encryptionKey = process.env.BOT_MONEV_ENCRYPTION_KEY;

  // Supabase keys (Mendukung baik format NEXT_PUBLIC_* maupun SUPABASE_*)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  // Di production, jika Supabase dikonfigurasi, pastikan URL valid
  if (supabaseUrl && !supabaseUrl.startsWith("http")) {
    throw new Error("Konfigurasi Error: NEXT_PUBLIC_SUPABASE_URL atau SUPABASE_URL harus berupa URL valid (https://...).");
  }

  // Sanitasi Cron Secret
  const cronSecret = process.env.CRON_SECRET;

  // Interval sinkronisasi
  const rawInterval = process.env.SYNC_INTERVAL_MINUTES;
  const syncIntervalMinutes = rawInterval && !isNaN(parseInt(rawInterval, 10)) ? parseInt(rawInterval, 10) : 30;

  return {
    isProduction,
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    databaseUrl: process.env.DATABASE_URL,
    encryptionKey,
    sessionSecret: sessionSecret || "maa_default_dev_session_secret_min_32_chars_ok!",
    cronSecret,
    appUrl: process.env.APP_URL || "http://localhost:3000",
    syncIntervalMinutes,
    defaultTimezone: process.env.DEFAULT_TIMEZONE || "Asia/Makassar",
    monevApiBaseUrl: process.env.MONEV_API_BASE_URL || "https://monev-api.maganghub.kemnaker.go.id",
  };
}
