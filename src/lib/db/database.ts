import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import {
  DbUser,
  DbAttendanceRecord,
  DbSyncRun,
  DbNotificationPreference,
  DbNotification,
  INITIAL_SCHEMA_SQL,
} from "./schema";
export type {
  DbUser,
  DbAttendanceRecord,
  DbSyncRun,
  DbNotificationPreference,
  DbNotification,
} from "./schema";
import { SafeUser } from "@/types";

let dbInstance: Database.Database | null = null;

export function getDatabasePath(): string {
  if (process.env.DATABASE_PATH) {
    return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.DATABASE_PATH);
  }
  return path.resolve(process.cwd(), "data", "maa.db");
}

export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = getDatabasePath();
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new Database(dbPath);

  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("foreign_keys = ON");
  dbInstance.pragma("synchronous = NORMAL");

  dbInstance.exec(INITIAL_SCHEMA_SQL);

  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// 1. Repositori Pengguna (User Isolation)
export const userRepository = {
  create(user: { id: string; name: string; email: string; password_hash: string }): SafeUser {
    const db = getDb();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO users (id, name, email, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(user.id, user.name, user.email.toLowerCase().trim(), user.password_hash, now, now);
    return {
      id: user.id,
      name: user.name,
      email: user.email.toLowerCase().trim(),
      created_at: now,
      updated_at: now,
    };
  },

  findByEmail(email: string): DbUser | null {
    const db = getDb();
    const stmt = db.prepare(`SELECT * FROM users WHERE email = ? COLLATE NOCASE`);
    const row = stmt.get(email.toLowerCase().trim()) as DbUser | undefined;
    return row || null;
  },

  findById(id: string): SafeUser | null {
    const db = getDb();
    const stmt = db.prepare(`SELECT id, name, email, created_at, updated_at FROM users WHERE id = ?`);
    const row = stmt.get(id) as SafeUser | undefined;
    return row || null;
  },
};

// 2. Repositori Catatan Presensi (Deduplikasi per User dan Tanggal)
export const attendanceRepository = {
  upsert(record: {
    id: string;
    user_id: string;
    attendance_date: string;
    status: string;
    approval_status?: string | null;
    source: string;
    source_updated_at?: string | null;
    raw_response?: string | null;
    notes?: string | null;
  }): DbAttendanceRecord {
    const db = getDb();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO attendance_records (
        id, user_id, attendance_date, status, approval_status,
        source, source_updated_at, last_checked_at, raw_response, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, attendance_date) DO UPDATE SET
        status = excluded.status,
        approval_status = excluded.approval_status,
        source = excluded.source,
        source_updated_at = excluded.source_updated_at,
        last_checked_at = excluded.last_checked_at,
        raw_response = excluded.raw_response,
        notes = excluded.notes
    `);

    stmt.run(
      record.id,
      record.user_id,
      record.attendance_date,
      record.status,
      record.approval_status || null,
      record.source,
      record.source_updated_at || null,
      now,
      record.raw_response || null,
      record.notes || null
    );

    const selectStmt = db.prepare(`
      SELECT * FROM attendance_records WHERE user_id = ? AND attendance_date = ?
    `);
    return selectStmt.get(record.user_id, record.attendance_date) as DbAttendanceRecord;
  },

  findByUserAndDateRange(
    userId: string,
    startDate: string,
    endDate: string,
    statusFilter?: string
  ): DbAttendanceRecord[] {
    const db = getDb();
    let query = `
      SELECT * FROM attendance_records
      WHERE user_id = ? AND attendance_date >= ? AND attendance_date <= ?
    `;
    const params: (string | number)[] = [userId, startDate, endDate];

    if (statusFilter && statusFilter !== "ALL") {
      query += ` AND status = ?`;
      params.push(statusFilter);
    }

    query += ` ORDER BY attendance_date DESC`;
    const stmt = db.prepare(query);
    return stmt.all(...params) as DbAttendanceRecord[];
  },

  findLatestByUser(userId: string): DbAttendanceRecord | null {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM attendance_records
      WHERE user_id = ?
      ORDER BY attendance_date DESC, last_checked_at DESC
      LIMIT 1
    `);
    const row = stmt.get(userId) as DbAttendanceRecord | undefined;
    return row || null;
  },
};

// 3. Repositori Audit Pemeriksaan (Sync Runs)
export const syncRunRepository = {
  create(run: {
    id: string;
    user_id: string;
    started_at: string;
    result: "SUCCESS" | "FAILED" | "BLOCKED" | "PARTIAL";
    error_code?: string | null;
    records_checked?: number;
    message?: string | null;
  }): DbSyncRun {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO sync_runs (
        id, user_id, started_at, completed_at, result, error_code, records_checked, message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      run.id,
      run.user_id,
      run.started_at,
      null,
      run.result,
      run.error_code || null,
      run.records_checked || 0,
      run.message || null
    );

    return {
      id: run.id,
      user_id: run.user_id,
      started_at: run.started_at,
      completed_at: null,
      result: run.result,
      error_code: run.error_code || null,
      records_checked: run.records_checked || 0,
      message: run.message || null,
    };
  },

  complete(
    id: string,
    update: {
      result: "SUCCESS" | "FAILED" | "BLOCKED" | "PARTIAL";
      error_code?: string | null;
      records_checked: number;
      message?: string | null;
    }
  ): void {
    const db = getDb();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE sync_runs
      SET completed_at = ?, result = ?, error_code = ?, records_checked = ?, message = ?
      WHERE id = ?
    `);
    stmt.run(now, update.result, update.error_code || null, update.records_checked, update.message || null, id);
  },

  listByUser(userId: string, limit: number = 20): DbSyncRun[] {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM sync_runs
      WHERE user_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `);
    return stmt.all(userId, limit) as DbSyncRun[];
  },
};

// 4. Repositori Notifikasi & Preferensi
export const notificationRepository = {
  create(notif: {
    id: string;
    user_id: string;
    type: "ATTENDANCE_MISSING" | "STATUS_CHANGED" | "SYNC_FAILED" | "SYSTEM";
    message: string;
  }): DbNotification {
    const db = getDb();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO notifications (id, user_id, type, message, is_read, created_at)
      VALUES (?, ?, ?, ?, 0, ?)
    `);
    stmt.run(notif.id, notif.user_id, notif.type, notif.message, now);
    return {
      id: notif.id,
      user_id: notif.user_id,
      type: notif.type,
      message: notif.message,
      is_read: 0,
      created_at: now,
    };
  },

  listByUser(userId: string, limit: number = 30): DbNotification[] {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(userId, limit) as DbNotification[];
  },

  markAsRead(id: string, userId: string): boolean {
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?
    `);
    const result = stmt.run(id, userId);
    return result.changes > 0;
  },

  markAllAsRead(userId: string): number {
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0
    `);
    const result = stmt.run(userId);
    return result.changes;
  },

  getUnreadCount(userId: string): number {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0
    `);
    const row = stmt.get(userId) as { count: number };
    return row.count;
  },

  getPreferences(userId: string): DbNotificationPreference {
    const db = getDb();
    const stmt = db.prepare(`SELECT * FROM notification_preferences WHERE user_id = ?`);
    let row = stmt.get(userId) as DbNotificationPreference | undefined;

    if (!row) {
      const id = `pref-${userId}-${Date.now()}`;
      const now = new Date().toISOString();
      const defaultSettings = JSON.stringify({
        urgentReminderHour: 16,
        reminderIntervalMinutes: 30,
        notifyOnStatusChange: true,
      });

      db.prepare(`
        INSERT INTO notification_preferences (id, user_id, enabled, channel, settings, updated_at)
        VALUES (?, ?, 1, 'browser', ?, ?)
      `).run(id, userId, defaultSettings, now);

      row = {
        id,
        user_id: userId,
        enabled: 1,
        channel: "browser",
        settings: defaultSettings,
        updated_at: now,
      };
    }

    return row;
  },
};
