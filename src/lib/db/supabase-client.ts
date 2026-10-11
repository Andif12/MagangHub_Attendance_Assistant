import { createClient, SupabaseClient } from "@supabase/supabase-js";

let adminClientInstance: SupabaseClient | null = null;
let publicClientInstance: SupabaseClient | null = null;

function getResolvedUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
}

function getResolvedServiceKey(): string | undefined {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY
  );
}

function getResolvedAnonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY
  );
}

export function isSupabaseConfigured(): boolean {
  const url = getResolvedUrl();
  const key = getResolvedServiceKey();
  return Boolean(url && key);
}

/**
 * Mendapatkan Supabase client untuk server backend menggunakan Service/Secret Key.
 * DILARANG digunakan di browser atau diekspos ke client component.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (typeof window !== "undefined") {
    throw new Error("Keamanan: getSupabaseAdmin hanya boleh dipanggil di lingkungan server runtime.");
  }

  const url = getResolvedUrl();
  const key = getResolvedServiceKey();

  if (!url || !key) {
    return null;
  }

  if (!adminClientInstance) {
    adminClientInstance = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return adminClientInstance;
}

/**
 * Mendapatkan Supabase client publik (anon/publishable key) untuk operasi berbasis RLS.
 */
export function getSupabasePublic(): SupabaseClient | null {
  const url = getResolvedUrl();
  const key = getResolvedAnonKey();

  if (!url || !key) {
    return null;
  }

  if (!publicClientInstance) {
    publicClientInstance = createClient(url, key);
  }

  return publicClientInstance;
}
