-- ==============================================================================
-- MAGANGHUB ATTENDANCE ASSISTANT (MAA) - INITIAL POSTGRESQL SCHEMA
-- Target Database: Supabase PostgreSQL
-- ==============================================================================

-- 1. Tabel Pengguna (Multi-Tenant Users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(64) NOT NULL DEFAULT 'maganghub',
    provider_user_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_provider_user_id ON public.users(provider_user_id);

-- 2. Tabel Sesi Server-Side (Sessions)
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON public.sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions(expires_at);

-- 3. Tabel Kredensial Provider Terenkripsi (Provider Credentials)
CREATE TABLE IF NOT EXISTS public.provider_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider VARCHAR(64) NOT NULL,
    encrypted_data TEXT NOT NULL,
    iv VARCHAR(64) NOT NULL,
    auth_tag VARCHAR(64) NOT NULL,
    key_version VARCHAR(16) NOT NULL DEFAULT 'v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_provider UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_provider_credentials_user_id ON public.provider_credentials(user_id);

-- 4. Tabel Catatan Presensi (Attendance Records)
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status VARCHAR(64) NOT NULL,
    approval_status VARCHAR(64),
    source VARCHAR(64) NOT NULL DEFAULT 'official_monev',
    source_updated_at TIMESTAMPTZ,
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    raw_response JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_attendance_date UNIQUE(user_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_user_date ON public.attendance_records(user_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_records_status ON public.attendance_records(status);

-- 5. Tabel Audit Sinkronisasi (Sync Runs)
CREATE TABLE IF NOT EXISTS public.sync_runs (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    result VARCHAR(32) NOT NULL, -- 'SUCCESS', 'BLOCKED', 'FAILED', 'PARTIAL'
    error_code VARCHAR(64),
    records_checked INTEGER NOT NULL DEFAULT 0,
    message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_user_started ON public.sync_runs(user_id, started_at DESC);

-- 6. Tabel Notifikasi Pengguna (Notifications)
CREATE TABLE IF NOT EXISTS public.notifications (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type VARCHAR(64) NOT NULL, -- 'ATTENDANCE_MISSING', 'STATUS_CHANGED', 'SYNC_FAILED', 'SYSTEM'
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read, created_at DESC);

-- 7. Tabel Preferensi Notifikasi (Notification Preferences)
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    channel VARCHAR(32) NOT NULL DEFAULT 'browser',
    settings JSONB NOT NULL DEFAULT '{"urgentReminderHour": 16, "reminderIntervalMinutes": 30, "notifyOnStatusChange": true}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Catatan Keamanan:
-- Akses backend MAA dilakukan melalui Supabase client dengan token terverifikasi di server.
-- RLS memastikan isolasi data antar pengguna terjamin.
CREATE POLICY users_isolation_policy ON public.users
    FOR ALL USING (id = auth.uid());

CREATE POLICY sessions_isolation_policy ON public.sessions
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY credentials_isolation_policy ON public.provider_credentials
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY attendance_isolation_policy ON public.attendance_records
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY sync_runs_isolation_policy ON public.sync_runs
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY notifications_isolation_policy ON public.notifications
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY preferences_isolation_policy ON public.notification_preferences
    FOR ALL USING (user_id = auth.uid());
