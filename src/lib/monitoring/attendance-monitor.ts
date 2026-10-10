import crypto from "crypto";
import {
  attendanceRepository,
  syncRunRepository,
  notificationRepository,
  DbAttendanceRecord,
  DbSyncRun,
} from "../db/database";
import { officialMonevProvider } from "../monev/official-provider";
import { investigateMonevAuth, maskParticipantId } from "../monev/auth-investigation";

export interface MonitorSyncOptions {
  userId: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
}

export interface MonitorSyncResult {
  success: boolean;
  connectionState: "REAL_CONNECTED" | "BLOCKED" | "UNVERIFIED";
  syncRun: DbSyncRun;
  records: DbAttendanceRecord[];
  message: string;
  source: string;
  technicalDetails?: Record<string, unknown>;
}

export function normalizeDateToTimezone(dateStr?: string, tz: string = "Asia/Makassar"): string {
  if (!dateStr) {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return formatter.format(now);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  try {
    const date = new Date(dateStr);
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return formatter.format(date);
  } catch {
    return dateStr.slice(0, 10);
  }
}

export async function runAttendanceSync(options: MonitorSyncOptions): Promise<MonitorSyncResult> {
  const { userId } = options;
  const tz = options.timezone || process.env.DEFAULT_TIMEZONE || "Asia/Makassar";
  const today = normalizeDateToTimezone(undefined, tz);
  const startDate = options.startDate || today;
  const endDate = options.endDate || today;

  const runId = `sync-${crypto.randomUUID()}`;
  const startedAt = new Date().toISOString();

  // 1. Cek Ketersediaan Kredensial Resmi
  if (!officialMonevProvider.isEnabled) {
    const authStatus = await investigateMonevAuth();
    const blockedMsg =
      "Integrasi Monev MagangHub berstatus BLOCKED/UNVERIFIED: Sesi browser di portal Kemnaker diisolasi oleh peramban (W3C Same-Origin Policy) dan Kemnaker belum merilis OAuth 2.0 publik untuk aplikasi pihak ketiga.";

    const syncRun = syncRunRepository.create({
      id: runId,
      user_id: userId,
      started_at: startedAt,
      result: "BLOCKED",
      error_code: "BROWSER_SOP_RESTRICTION",
      records_checked: 0,
      message: blockedMsg,
    });
    syncRunRepository.complete(runId, {
      result: "BLOCKED",
      error_code: "BROWSER_SOP_RESTRICTION",
      records_checked: 0,
      message: blockedMsg,
    });

    const existingRecords = attendanceRepository.findByUserAndDateRange(userId, startDate, endDate);

    return {
      success: false,
      connectionState: "BLOCKED",
      syncRun,
      records: existingRecords,
      message: blockedMsg,
      source: "UNAVAILABLE",
      technicalDetails: {
        investigation: authStatus,
        participantIdMasked: maskParticipantId(process.env.MONEV_PARTICIPANT_ID),
      },
    };
  }

  // 2. Jalankan Permintaan Nyata ke API Monev Resmi
  const syncRun = syncRunRepository.create({
    id: runId,
    user_id: userId,
    started_at: startedAt,
    result: "PARTIAL",
    records_checked: 0,
    message: "Mengambil data absensi asli dari server Monev...",
  });

  const participantId = process.env.MONEV_PARTICIPANT_ID || "";
  const fetchResult = await officialMonevProvider.fetchAttendances(participantId, startDate, endDate);

  // Jika gagal otorisasi (HTTP 401/403)
  if (fetchResult.errorCode === "AUTH_FAILED" || fetchResult.errorCode === "AUTH_REQUIRED") {
    syncRunRepository.complete(runId, {
      result: "FAILED",
      error_code: fetchResult.errorCode,
      records_checked: 0,
      message: fetchResult.message,
    });

    // PENTING: Jangan kirim notifikasi absensi hilang jika autentikasi gagal!
    return {
      success: false,
      connectionState: "UNVERIFIED",
      syncRun: { ...syncRun, result: "FAILED", error_code: fetchResult.errorCode, message: fetchResult.message },
      records: attendanceRepository.findByUserAndDateRange(userId, startDate, endDate),
      message: fetchResult.message,
      source: "official_monev",
    };
  }

  // Jika gagal koneksi atau rate limited
  if (!fetchResult.success) {
    syncRunRepository.complete(runId, {
      result: "FAILED",
      error_code: fetchResult.errorCode || "CONNECTION_ERROR",
      records_checked: 0,
      message: fetchResult.message,
    });

    // PENTING: Jangan kirim notifikasi absensi hilang jika server error atau timeout!
    return {
      success: false,
      connectionState: "BLOCKED",
      syncRun: { ...syncRun, result: "FAILED", error_code: fetchResult.errorCode || "CONNECTION_ERROR", message: fetchResult.message },
      records: attendanceRepository.findByUserAndDateRange(userId, startDate, endDate),
      message: fetchResult.message,
      source: "official_monev",
    };
  }

  // 3. Simpan dan Deduplikasi Catatan Presensi Nyata
  const savedRecords: DbAttendanceRecord[] = [];

  for (const raw of fetchResult.records) {
    const normalizedDate = normalizeDateToTimezone(raw.date, tz);
    const existing = attendanceRepository.findByUserAndDateRange(userId, normalizedDate, normalizedDate)[0];

    const saved = attendanceRepository.upsert({
      id: `att-${userId}-${normalizedDate}`,
      user_id: userId,
      attendance_date: normalizedDate,
      status: raw.status,
      approval_status: raw.approval_status || null,
      source: "official_monev",
      source_updated_at: raw.updated_at || raw.created_at || null,
      raw_response: JSON.stringify(raw),
      notes: raw.notes || null,
    });

    savedRecords.push(saved);

    // Deteksi perubahan status absensi / persetujuan
    if (existing && (existing.status !== saved.status || existing.approval_status !== saved.approval_status)) {
      notificationRepository.create({
        id: `notif-${crypto.randomUUID()}`,
        user_id: userId,
        type: "STATUS_CHANGED",
        message: `Status absensi tanggal ${normalizedDate} berubah dari ${existing.status} (${existing.approval_status || "-"}) menjadi ${saved.status} (${saved.approval_status || "-"}).`,
      });
    }
  }

  // 4. Deteksi Jika Absensi Hari Ini Belum Terdeteksi (HANYA jika sync sukses)
  const todayRecord = savedRecords.find((r) => r.attendance_date === today);
  if (!todayRecord && fetchResult.records.length === 0) {
    notificationRepository.create({
      id: `notif-${crypto.randomUUID()}`,
      user_id: userId,
      type: "ATTENDANCE_MISSING",
      message: `Presensi Anda pada hari ini (${today}) belum terdeteksi di portal Monev. Segera lakukan presensi di portal resmi.`,
    });
  }

  const completedMessage = `Sinkronisasi berhasil: ${fetchResult.records.length} data absensi asli terbaca.`;
  syncRunRepository.complete(runId, {
    result: "SUCCESS",
    records_checked: fetchResult.records.length,
    message: completedMessage,
  });

  const updatedRecords = attendanceRepository.findByUserAndDateRange(userId, startDate, endDate);

  return {
    success: true,
    connectionState: "REAL_CONNECTED",
    syncRun: {
      ...syncRun,
      result: "SUCCESS",
      records_checked: fetchResult.records.length,
      message: completedMessage,
      completed_at: new Date().toISOString(),
    },
    records: updatedRecords,
    message: completedMessage,
    source: "official_monev",
  };
}
