import crypto from "crypto";
import {
  userRepository,
  attendanceRepository,
  syncRunRepository,
  notificationRepository,
  DbAttendanceRecord,
  DbSyncRun,
} from "../db/database";
import { officialMonevProvider } from "../monev/official-provider";
import { maskParticipantId } from "../monev/auth-investigation";
import { normalizeDateToTimezone } from "../monitoring/attendance-monitor";

export interface UserSyncResult {
  userId: string;
  success: boolean;
  resultStatus: "SUCCESS" | "FAILED" | "BLOCKED" | "PARTIAL";
  recordsChecked: number;
  newOrUpdatedRecords: number;
  message: string;
  errorCode?: string | null;
  syncRunId: string;
}

export interface ScheduledSyncResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  intervalMinutes: number;
  mode: "OFFICIAL_API" | "UNCONFIGURED_FALLBACK";
  totalUsers: number;
  processedUsers: number;
  successfulUsers: number;
  failedUsers: number;
  timestamp: string;
  details: UserSyncResult[];
}

let isSyncInProgress = false;

export function getSyncIntervalMinutes(): number {
  const envVal = process.env.SYNC_INTERVAL_MINUTES;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 30; // Default 30 menit
}

export async function syncUserAttendance(
  userId: string,
  options?: { startDate?: string; endDate?: string; timezone?: string }
): Promise<UserSyncResult> {
  const tz = options?.timezone || process.env.DEFAULT_TIMEZONE || "Asia/Makassar";
  const today = normalizeDateToTimezone(undefined, tz);
  const startDate = options?.startDate || today;
  const endDate = options?.endDate || today;

  const runId = `sync-${crypto.randomUUID()}`;
  const startedAt = new Date().toISOString();

  // 1. Audit Kredensial Resmi Server Monev
  if (!officialMonevProvider.isEnabled) {
    const unavailMsg =
      "Sinkronisasi otomatis backend terjadwal belum memiliki kredensial resmi Kemnaker (MONEV_AUTH_TOKEN). Menggunakan data presensi terverifikasi sebelumnya.";

    syncRunRepository.create({
      id: runId,
      user_id: userId,
      started_at: startedAt,
      result: "BLOCKED",
      error_code: "OFFICIAL_AUTH_UNAVAILABLE",
      records_checked: 0,
      message: unavailMsg,
    });
    syncRunRepository.complete(runId, {
      result: "BLOCKED",
      error_code: "OFFICIAL_AUTH_UNAVAILABLE",
      records_checked: 0,
      message: unavailMsg,
    });

    return {
      userId,
      success: false,
      resultStatus: "BLOCKED",
      recordsChecked: 0,
      newOrUpdatedRecords: 0,
      message: unavailMsg,
      errorCode: "OFFICIAL_AUTH_UNAVAILABLE",
      syncRunId: runId,
    };
  }

  // 2. Buat Log Sync Run Aktif
  syncRunRepository.create({
    id: runId,
    user_id: userId,
    started_at: startedAt,
    result: "PARTIAL",
    records_checked: 0,
    message: "Mengambil data absensi terbaru dari server Monev...",
  });

  const participantId = process.env.MONEV_PARTICIPANT_ID || userId;
  const fetchResult = await officialMonevProvider.fetchAttendances(
    participantId,
    startDate,
    endDate
  );

  // 3. Penanganan Galat Otorisasi / Sesi Kedaluwarsa (HTTP 401/403)
  if (fetchResult.errorCode === "AUTH_FAILED" || fetchResult.errorCode === "AUTH_REQUIRED") {
    const errorMsg = `Sesi otorisasi Monev Kemnaker kedaluwarsa atau tidak sah (${fetchResult.errorCode}). Perlu pembaruan MONEV_AUTH_TOKEN.`;
    syncRunRepository.complete(runId, {
      result: "FAILED",
      error_code: "AUTH_EXPIRED",
      records_checked: 0,
      message: errorMsg,
    });

    notificationRepository.create({
      id: `notif-${crypto.randomUUID()}`,
      user_id: userId,
      type: "SYNC_FAILED",
      message: "Sesi otorisasi Monev Kemnaker kedaluwarsa. Sinkronisasi otomatis terjadwal terhenti sementara.",
    });

    return {
      userId,
      success: false,
      resultStatus: "FAILED",
      recordsChecked: 0,
      newOrUpdatedRecords: 0,
      message: errorMsg,
      errorCode: "AUTH_EXPIRED",
      syncRunId: runId,
    };
  }

  // 4. Penanganan Batas Frekuensi Permintaan (Rate Limited HTTP 429)
  if (fetchResult.errorCode === "RATE_LIMITED") {
    syncRunRepository.complete(runId, {
      result: "FAILED",
      error_code: "RATE_LIMITED",
      records_checked: 0,
      message: fetchResult.message,
    });

    return {
      userId,
      success: false,
      resultStatus: "FAILED",
      recordsChecked: 0,
      newOrUpdatedRecords: 0,
      message: fetchResult.message,
      errorCode: "RATE_LIMITED",
      syncRunId: runId,
    };
  }

  // 5. Penanganan Galat Jaringan / Timeout Lainnya
  if (!fetchResult.success) {
    syncRunRepository.complete(runId, {
      result: "FAILED",
      error_code: fetchResult.errorCode || "CONNECTION_ERROR",
      records_checked: 0,
      message: fetchResult.message,
    });

    return {
      userId,
      success: false,
      resultStatus: "FAILED",
      recordsChecked: 0,
      newOrUpdatedRecords: 0,
      message: fetchResult.message,
      errorCode: fetchResult.errorCode || "CONNECTION_ERROR",
      syncRunId: runId,
    };
  }

  // 6. Deduplikasi dan Penyimpanan Data Asli Secara Terisolasi
  let updatedCount = 0;
  for (const raw of fetchResult.records) {
    const normalizedDate = normalizeDateToTimezone(raw.date, tz);
    const existing = attendanceRepository.findByUserAndDateRange(
      userId,
      normalizedDate,
      normalizedDate
    )[0];

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

    updatedCount++;

    // Deteksi jika terjadi perubahan status atau status persetujuan
    if (
      existing &&
      (existing.status !== saved.status || existing.approval_status !== saved.approval_status)
    ) {
      notificationRepository.create({
        id: `notif-${crypto.randomUUID()}`,
        user_id: userId,
        type: "STATUS_CHANGED",
        message: `Status presensi tanggal ${normalizedDate} berubah dari ${existing.status} (${existing.approval_status || "-"}) menjadi ${saved.status} (${saved.approval_status || "-"}).`,
      });
    }
  }

  // 7. Deteksi Presensi Hari Kerja yang Belum Terisi
  const dayOfWeek = new Date().getDay(); // 0 = Minggu, 6 = Sabtu
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const todayRecord = attendanceRepository.findByUserAndDateRange(userId, today, today)[0];

  if (isWeekday && (!todayRecord || todayRecord.status === "BELUM_DIISI")) {
    notificationRepository.create({
      id: `notif-${crypto.randomUUID()}`,
      user_id: userId,
      type: "ATTENDANCE_MISSING",
      message: `Presensi Anda pada hari ini (${today}) belum tercatat di Monev. Segera lakukan presensi di portal resmi.`,
    });
  }

  const successMsg = `Sinkronisasi otomatis berhasil: ${fetchResult.records.length} data absensi asli terbaca.`;
  syncRunRepository.complete(runId, {
    result: "SUCCESS",
    records_checked: fetchResult.records.length,
    message: successMsg,
  });

  return {
    userId,
    success: true,
    resultStatus: "SUCCESS",
    recordsChecked: fetchResult.records.length,
    newOrUpdatedRecords: updatedCount,
    message: successMsg,
    syncRunId: runId,
  };
}

export async function runScheduledSync(): Promise<ScheduledSyncResult> {
  const intervalMinutes = getSyncIntervalMinutes();
  const timestamp = new Date().toISOString();

  // Cegah eksekusi tumpang-tindih (concurrency lock)
  if (isSyncInProgress) {
    return {
      success: false,
      skipped: true,
      reason: "Eksekusi sinkronisasi sebelumnya masih berlangsung.",
      intervalMinutes,
      mode: officialMonevProvider.isEnabled ? "OFFICIAL_API" : "UNCONFIGURED_FALLBACK",
      totalUsers: 0,
      processedUsers: 0,
      successfulUsers: 0,
      failedUsers: 0,
      timestamp,
      details: [],
    };
  }

  isSyncInProgress = true;
  try {
    const allUsers = userRepository.findAll();
    const details: UserSyncResult[] = [];
    let successfulUsers = 0;
    let failedUsers = 0;

    for (const user of allUsers) {
      try {
        const res = await syncUserAttendance(user.id);
        details.push(res);
        if (res.success) {
          successfulUsers++;
        } else {
          failedUsers++;
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        failedUsers++;
        details.push({
          userId: user.id,
          success: false,
          resultStatus: "FAILED",
          recordsChecked: 0,
          newOrUpdatedRecords: 0,
          message: `Galat saat memproses sinkronisasi: ${errorMsg}`,
          errorCode: "INTERNAL_ERROR",
          syncRunId: `err-${crypto.randomUUID()}`,
        });
      }
    }

    return {
      success: failedUsers === 0 || successfulUsers > 0,
      intervalMinutes,
      mode: officialMonevProvider.isEnabled ? "OFFICIAL_API" : "UNCONFIGURED_FALLBACK",
      totalUsers: allUsers.length,
      processedUsers: details.length,
      successfulUsers,
      failedUsers,
      timestamp,
      details,
    };
  } finally {
    isSyncInProgress = false;
  }
}
