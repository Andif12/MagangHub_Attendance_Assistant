# LAPORAN AUDIT & RENCANA REBUILD: ARSITEKTUR SUPABASE + VERCEL
## MagangHub Attendance Assistant (MAA)

Dokumen ini mendokumentasikan hasil audit menyeluruh terhadap arsitektur lama berbasis SQLite, analisis hambatan autentikasi Kemnaker, serta cetak biru migrasi ke **Supabase PostgreSQL** dan platform deployment **Vercel**.

---

### 1. Arsitektur Saat Ini

```
[ Klien / Browser ] 
       │
       ▼
[ Next.js 16 App Router (Localhost:3000) ]
       ├── / (Dashboard jika ber-sesi, Login jika belum)
       ├── /api/auth/me (Verifikasi Sesi JWT)
       ├── /api/auth/sso/initiate & callback (SSO Monev - Redirect Terkunci)
       ├── /api/attendance/records, status, sync
       └── /api/cron/sync (Cron Job)
       │
       ▼
[ Penyimpanan Lokal: SQLite (better-sqlite3) ]
       └── File lokal: ./data/maa.db (WAL Mode)
```

**Keterbatasan Arsitektur Lama:**
1. **Filesystem Ephemeral:** Vercel adalah lingkungan serverless tanpa persistent local disk. File SQLite `./data/maa.db` akan hilang setiap kali container fungsi di-recycle atau di-deploy ulang.
2. **Ketergantungan Ekstensi / Manual Import:** Ketiadaan OAuth publik dari Kemnaker menyebabkan pengguna harus bergantung pada ekstensi peramban atau impor respons manual.
3. **Ketiadaan Enkripsi Terstandar untuk Kredensial Server:** Token yang disimpan di `.env` belum dienkripsi dengan standar authenticated encryption (AES-256-GCM).

---

### 2. Masalah Autentikasi yang Masih Terjadi

1. **Strict Redirect Allowlist di Kemnaker SSO:**
   * Endpoint `GET /api/v1/auth/login` di `monev-api.maganghub.kemnaker.go.id` menghasilkan URL otorisasi Kemnaker dengan `client_id=79230891-cc02-43c8-964c-b525bce27857`.
   * Server otorisasi Kemnaker (`account.kemnaker.go.id`) mengunci parameter `redirect_uri` secara kaku ke `https://monev.maganghub.kemnaker.go.id/sso/callback`.
   * Parameter `redirect_uri` khusus pihak ketiga (seperti `http://localhost:3000/...` atau `https://maa-app.vercel.app/...`) ditolak atau diabaikan oleh server Kemnaker.
2. **Ketiadaan API Publik & OIDC Discovery:**
   * Endpoint `/.well-known/openid-configuration` mengembalikan `HTTP 404`.
   * Kemnaker tidak membuka pendaftaran OAuth Client publik bagi pengembang eksternal.
3. **Pemisahan Tegas:**
   * MAA tidak boleh memalsukan alur SSO atau berpura-pura bahwa login otomatis pihak ketiga dapat berjalan tanpa dukungan Kemnaker.
   * Impor berkas presensi tidak boleh disalahgunakan sebagai mekanisme penerbitan sesi login publik tanpa identitas terverifikasi.

---

### 3. Pemetaan File (Pertahankan, Ubah, Hapus)

| Komponen / Berkas | Status Tindakan | Alasan & Rencana |
| :--- | :--- | :--- |
| `src/lib/db/database.ts` | **Refactor ke Supabase** | Ganti engine `better-sqlite3` dengan Supabase Client PostgreSQL (`@supabase/supabase-js`). |
| `src/lib/db/schema.ts` | **Migrasi ke SQL** | Pindahkan definisi DDL ke migrasi SQL `supabase/migrations/`. |
| `src/lib/auth/encryption.ts` | **Buat Baru** | Implementasikan modul enkripsi kredensial AES-256-GCM menggunakan `BOT_MONEV_ENCRYPTION_KEY`. |
| `src/lib/env.ts` | **Buat Baru** | Validasi variabel lingkungan saat startup tanpa membocorkan nilai rahasia. |
| `src/lib/auth/session.ts` | **Perbarui** | Integrasikan verifikasi sesi dengan tabel `sessions` di Supabase dan cookie `maa_session`. |
| `src/lib/monev/schedule-evaluator.ts` | **Pertahankan** | Logika bisnis evaluasi status presensi (HADIR, IZIN, LIBUR, dll.) bersih dan stateless. |
| `src/lib/monev/official-provider.ts` | **Pertahankan** | Komunikasi server-to-server ke `monev-api` tetap dipertahankan dengan proteksi token terenkripsi. |
| `src/app/api/attendance/import/route.ts` | **Perketat Proteksi** | Wajibkan autentikasi aktif. Tidak lagi menerbitkan sesi untuk pengguna anonim. |
| `src/components/MagangHubLoginPage.tsx` | **Sempurnakan** | Tampilkan status integrasi transparan: jelaskan bahwa Kemnaker belum membuka callback pihak ketiga. |
| `vercel.json` | **Pertahankan & Optimalkan** | Konfigurasi Vercel Cron untuk eksekusi setiap 30 menit ke `/api/cron/sync`. |

---

### 4. Rencana Migrasi Database (SQLite ke Supabase PostgreSQL)

#### Struktur Tabel Supabase PostgreSQL:
1. **`users`**:
   * `id`: UUID (Primary Key)
   * `email`: VARCHAR(255) (UNIQUE, NOT NULL)
   * `name`: VARCHAR(255) (NOT NULL)
   * `provider`: VARCHAR(64) (DEFAULT 'maganghub')
   * `provider_user_id`: VARCHAR(255) (NULLABLE, UNIQUE)
   * `created_at`: TIMESTAMPTZ (DEFAULT now())
   * `updated_at`: TIMESTAMPTZ (DEFAULT now())
2. **`sessions`**:
   * `id`: UUID (Primary Key)
   * `user_id`: UUID (REFERENCES users(id) ON DELETE CASCADE)
   * `token_hash`: VARCHAR(255) (UNIQUE, NOT NULL)
   * `expires_at`: TIMESTAMPTZ (NOT NULL)
   * `created_at`: TIMESTAMPTZ (DEFAULT now())
3. **`provider_credentials`**:
   * `id`: UUID (Primary Key)
   * `user_id`: UUID (REFERENCES users(id) ON DELETE CASCADE)
   * `provider`: VARCHAR(64) (NOT NULL)
   * `encrypted_data`: TEXT (NOT NULL)
   * `iv`: VARCHAR(64) (NOT NULL)
   * `auth_tag`: VARCHAR(64) (NOT NULL)
   * `key_version`: VARCHAR(16) (DEFAULT 'v1')
   * `created_at`: TIMESTAMPTZ (DEFAULT now())
   * `updated_at`: TIMESTAMPTZ (DEFAULT now())
4. **`attendance_records`**:
   * `id`: VARCHAR(255) (Primary Key)
   * `user_id`: UUID (REFERENCES users(id) ON DELETE CASCADE)
   * `attendance_date`: DATE (NOT NULL)
   * `status`: VARCHAR(64) (NOT NULL)
   * `approval_status`: VARCHAR(64) (NULLABLE)
   * `source`: VARCHAR(64) (DEFAULT 'official_monev')
   * `source_updated_at`: TIMESTAMPTZ (NULLABLE)
   * `raw_response`: JSONB (NULLABLE)
   * `notes`: TEXT (NULLABLE)
   * `created_at`: TIMESTAMPTZ (DEFAULT now())
   * `updated_at`: TIMESTAMPTZ (DEFAULT now())
   * **CONSTRAINT**: `UNIQUE (user_id, attendance_date)`
5. **`sync_runs`**:
   * `id`: VARCHAR(255) (Primary Key)
   * `user_id`: UUID (REFERENCES users(id) ON DELETE CASCADE)
   * `started_at`: TIMESTAMPTZ (NOT NULL)
   * `completed_at`: TIMESTAMPTZ (NULLABLE)
   * `result`: VARCHAR(32) (NOT NULL) -- 'SUCCESS', 'BLOCKED', 'FAILED', 'PARTIAL'
   * `error_code`: VARCHAR(64) (NULLABLE)
   * `records_checked`: INTEGER (DEFAULT 0)
   * `message`: TEXT (NULLABLE)
6. **`notifications`** & **`notification_preferences`**:
   * Menampung log pengingat presensi dan preferensi saluran per pengguna.

---

### 5. Daftar Environment Variables

```dotenv
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Security & Encryption (AES-256-GCM - 32 Bytes Hex)
BOT_MONEV_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
MAA_SESSION_SECRET=kunci_rahasia_jwt_minimal_32_karakter_acak

# Scheduling & Cron
CRON_SECRET=kunci_rahasia_bearer_cron_anda
SYNC_INTERVAL_MINUTES=30
DEFAULT_TIMEZONE=Asia/Makassar

# Monev API
MONEV_API_BASE_URL=https://monev-api.maganghub.kemnaker.go.id
APP_URL=http://localhost:3000
```

---

### 6. Hambatan Autentikasi yang Memerlukan Dukungan Resmi Kemnaker

Untuk mengaktifkan autentikasi otomatis langsung (Direct SSO):
1. **Pengelola Kemnaker** harus mendaftarkan MAA sebagai OAuth 2.0 Client resmi.
2. Menambahkan URL `https://[DOMAIN-MAA]/api/auth/sso/callback` ke dalam whitelist *Redirect URIs*.
3. Menerbitkan `client_secret` resmi bagi MAA untuk pertukaran `authorization_code`.
