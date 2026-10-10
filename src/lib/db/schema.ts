import {
  User,
  AttendanceRecord,
  SyncRun,
  NotificationPreference,
  AppNotification,
} from "@/types";

export interface DbUser extends User {
  password_hash: string;
}

export type DbAttendanceRecord = AttendanceRecord;
export type DbSyncRun = SyncRun;
export type DbNotificationPreference = NotificationPreference;
export type DbNotification = AppNotification;

export const INITIAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  attendance_date TEXT NOT NULL,
  status TEXT NOT NULL,
  approval_status TEXT,
  source TEXT NOT NULL,
  source_updated_at TEXT,
  last_checked_at TEXT NOT NULL,
  raw_response TEXT,
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance_records(user_id, attendance_date);

CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  result TEXT NOT NULL,
  error_code TEXT,
  records_checked INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_user_started ON sync_runs(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  channel TEXT NOT NULL DEFAULT 'browser',
  settings TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);
`;
