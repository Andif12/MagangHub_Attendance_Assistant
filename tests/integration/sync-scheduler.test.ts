import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as cronGetHandler, POST as cronPostHandler } from "../../src/app/api/cron/sync/route";
import {
  runScheduledSync,
  syncUserAttendance,
  getSyncIntervalMinutes,
} from "../../src/lib/sync/sync-service";
import {
  userRepository,
  attendanceRepository,
  syncRunRepository,
  notificationRepository,
} from "../../src/lib/db/database";
import { officialMonevProvider } from "../../src/lib/monev/official-provider";
import crypto from "crypto";

describe("MAA Background Sync Service & Deployment Cron Integration Tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("1. Konfigurasi Interval Sinkronisasi: Default 30 menit & fleksibel dari environment", () => {
    delete process.env.SYNC_INTERVAL_MINUTES;
    expect(getSyncIntervalMinutes()).toBe(30);

    process.env.SYNC_INTERVAL_MINUTES = "15";
    expect(getSyncIntervalMinutes()).toBe(15);

    process.env.SYNC_INTERVAL_MINUTES = "45";
    expect(getSyncIntervalMinutes()).toBe(45);

    process.env.SYNC_INTERVAL_MINUTES = "invalid";
    expect(getSyncIntervalMinutes()).toBe(30);
  });

  it("2. Keamanan Endpoint /api/cron/sync: Wajib otorisasi Bearer CRON_SECRET", async () => {
    process.env.CRON_SECRET = "super_secret_cron_token_12345";
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    // A. Tanpa header Authorization -> HTTP 401
    const unauthReq = new NextRequest("http://localhost:3000/api/cron/sync", {
      method: "GET",
    });
    const unauthRes = await cronGetHandler(unauthReq);
    expect(unauthRes.status).toBe(401);
    const unauthJson = await unauthRes.json();
    expect(unauthJson.error).toContain("CRON_SECRET");

    // B. Token salah -> HTTP 401
    const wrongReq = new NextRequest("http://localhost:3000/api/cron/sync", {
      method: "GET",
      headers: {
        Authorization: "Bearer token_yang_salah",
      },
    });
    const wrongRes = await cronGetHandler(wrongReq);
    expect(wrongRes.status).toBe(401);

    // C. Token benar -> HTTP 200 (atau 207 Multi-status)
    const validReq = new NextRequest("http://localhost:3000/api/cron/sync", {
      method: "GET",
      headers: {
        Authorization: "Bearer super_secret_cron_token_12345",
      },
    });
    const validRes = await cronGetHandler(validReq);
    expect([200, 207]).toContain(validRes.status);
    const validJson = await validRes.json();
    expect(validJson.intervalMinutes).toBe(30);
    expect(typeof validJson.totalUsers).toBe("number");
  });

  it("3. Penanganan Tanpa Kredensial Resmi: Tidak membuat data palsu & mencatat status BLOCKED transparan", async () => {
    process.env.MONEV_API_ENABLED = "false";
    delete process.env.MONEV_AUTH_TOKEN;

    const testUserId = `user-${crypto.randomUUID()}`;
    userRepository.create({
      id: testUserId,
      email: `sync-test-${crypto.randomUUID()}@example.com`,
      name: "Sync Test User",
      password_hash: "HASH",
    });

    // Simpan satu record awal manual
    attendanceRepository.upsert({
      id: `att-${testUserId}-2026-10-09`,
      user_id: testUserId,
      attendance_date: "2026-10-09",
      status: "HADIR_DISETUJUI",
      source: "MANUAL_IMPORT_VERIFIED",
      notes: "Catatan penting asli",
    });

    const result = await syncUserAttendance(testUserId, {
      startDate: "2026-10-10",
      endDate: "2026-10-10",
    });

    // Harus menyatakan BLOCKED secara jujur
    expect(result.success).toBe(false);
    expect(result.resultStatus).toBe("BLOCKED");
    expect(result.errorCode).toBe("OFFICIAL_AUTH_UNAVAILABLE");
    expect(result.message).toContain("belum memiliki kredensial resmi");

    // Pastikan TIDAK ADA catatan presensi fiktif yang ditambahkan
    const records = attendanceRepository.findByUserAndDateRange(testUserId, "2026-10-10", "2026-10-10");
    expect(records.length).toBe(0);

    // Pastikan catatan presensi asli sebelumnya tidak tertimpa/rusak
    const originalRecord = attendanceRepository.findByUserAndDateRange(testUserId, "2026-10-09", "2026-10-09")[0];
    expect(originalRecord).toBeDefined();
    expect(originalRecord.status).toBe("HADIR_DISETUJUI");
    expect(originalRecord.notes).toBe("Catatan penting asli");

    // Periksa bahwa audit log sync_runs tersimpan dengan benar
    const runs = syncRunRepository.listByUser(testUserId);
    expect(runs.length).toBeGreaterThan(0);
    expect(runs[0].result).toBe("BLOCKED");
    expect(runs[0].error_code).toBe("OFFICIAL_AUTH_UNAVAILABLE");
  });

  it("4. Eksekusi Kredensial Resmi Berhasil: Deduplikasi, pembaruan status, dan preservasi catatan", async () => {
    process.env.MONEV_API_ENABLED = "true";
    process.env.MONEV_AUTH_TOKEN = "real_official_jwt_bearer_token";
    process.env.MONEV_PARTICIPANT_ID = "61726052-a567-4250-9999-528574163999";

    const testUserId = `user-${crypto.randomUUID()}`;
    userRepository.create({
      id: testUserId,
      email: `sync-official-${crypto.randomUUID()}@example.com`,
      name: "Official Sync User",
      password_hash: "HASH",
    });

    // Record awal dengan catatan pengguna
    attendanceRepository.upsert({
      id: `att-${testUserId}-2026-10-10`,
      user_id: testUserId,
      attendance_date: "2026-10-10",
      status: "BELUM_DIISI",
      approval_status: null,
      source: "initial",
      notes: "Catatan khusus peserta",
    });

    // Mock fetchAttendances dari provider resmi mengembalikan data baru
    vi.spyOn(officialMonevProvider, "fetchAttendances").mockResolvedValueOnce({
      success: true,
      statusCode: 200,
      records: [
        {
          date: "2026-10-10",
          status: "HADIR",
          approval_status: "APPROVED",
          updated_at: "2026-10-10T17:00:00Z",
          notes: undefined, // Respons API Monev tidak menyertakan notes
        },
      ],
      message: "Berhasil membaca 1 catatan absensi asli dari Monev.",
    });

    const result = await syncUserAttendance(testUserId, {
      startDate: "2026-10-10",
      endDate: "2026-10-10",
    });

    expect(result.success).toBe(true);
    expect(result.resultStatus).toBe("SUCCESS");
    expect(result.recordsChecked).toBe(1);

    // Verifikasi deduplikasi dan preservasi catatan (notes tidak hilang tertimpa null)
    const updated = attendanceRepository.findByUserAndDateRange(testUserId, "2026-10-10", "2026-10-10")[0];
    expect(updated).toBeDefined();
    expect(updated.status).toBe("HADIR");
    expect(updated.approval_status).toBe("APPROVED");
    expect(updated.source).toBe("official_monev");
    expect(updated.notes).toBe("Catatan khusus peserta"); // Preserved by COALESCE!

    // Verifikasi audit log sync_runs
    const runs = syncRunRepository.listByUser(testUserId);
    expect(runs[0].result).toBe("SUCCESS");
    expect(runs[0].records_checked).toBe(1);
  });

  it("5. Penanganan Token Kedaluwarsa (HTTP 401) dan Rate Limit (HTTP 429)", async () => {
    process.env.MONEV_API_ENABLED = "true";
    process.env.MONEV_AUTH_TOKEN = "expired_token";
    process.env.MONEV_PARTICIPANT_ID = "61726052-a567-4250-9999-528574163999";

    const testUserId = `user-${crypto.randomUUID()}`;
    userRepository.create({
      id: testUserId,
      email: `expired-user-${crypto.randomUUID()}@example.com`,
      name: "Expired User",
      password_hash: "HASH",
    });

    // Mock 401 Auth Failed
    vi.spyOn(officialMonevProvider, "fetchAttendances").mockResolvedValueOnce({
      success: false,
      statusCode: 401,
      records: [],
      errorCode: "AUTH_FAILED",
      message: "Autentikasi ke server Monev ditolak (HTTP 401). Sesi tidak valid atau telah kedaluwarsa.",
    });

    const authFailResult = await syncUserAttendance(testUserId);
    expect(authFailResult.success).toBe(false);
    expect(authFailResult.resultStatus).toBe("FAILED");
    expect(authFailResult.errorCode).toBe("AUTH_EXPIRED");

    // Mock 429 Rate Limited
    vi.spyOn(officialMonevProvider, "fetchAttendances").mockResolvedValueOnce({
      success: false,
      statusCode: 429,
      records: [],
      errorCode: "RATE_LIMITED",
      message: "Batas frekuensi permintaan server Monev tercapai (HTTP 429).",
    });

    const rateLimitResult = await syncUserAttendance(testUserId);
    expect(rateLimitResult.success).toBe(false);
    expect(rateLimitResult.resultStatus).toBe("FAILED");
    expect(rateLimitResult.errorCode).toBe("RATE_LIMITED");
  });

  it("6. Multi-Tenant User Isolation: Menjalankan sinkronisasi secara terisolasi tanpa kebocoran data antar pengguna", async () => {
    process.env.MONEV_API_ENABLED = "true";
    process.env.MONEV_AUTH_TOKEN = "valid_token";
    process.env.MONEV_PARTICIPANT_ID = "participant-isolated";

    const user1Id = `tenant1-${crypto.randomUUID()}`;
    const user2Id = `tenant2-${crypto.randomUUID()}`;

    userRepository.create({
      id: user1Id,
      email: `t1-${crypto.randomUUID()}@example.com`,
      name: "Tenant 1",
      password_hash: "HASH",
    });

    userRepository.create({
      id: user2Id,
      email: `t2-${crypto.randomUUID()}@example.com`,
      name: "Tenant 2",
      password_hash: "HASH",
    });

    // User 1 receives 1 record
    vi.spyOn(officialMonevProvider, "fetchAttendances").mockResolvedValueOnce({
      success: true,
      statusCode: 200,
      records: [{ date: "2026-10-11", status: "HADIR", approval_status: "APPROVED" }],
      message: "Success",
    });

    await syncUserAttendance(user1Id, { startDate: "2026-10-11", endDate: "2026-10-11" });

    // User 1 has 1 record, User 2 has 0 records
    const u1Records = attendanceRepository.findByUserAndDateRange(user1Id, "2026-10-11", "2026-10-11");
    const u2Records = attendanceRepository.findByUserAndDateRange(user2Id, "2026-10-11", "2026-10-11");

    expect(u1Records.length).toBe(1);
    expect(u2Records.length).toBe(0);

    // Sync runs for User 1 are not visible in User 2
    const u1Runs = syncRunRepository.listByUser(user1Id);
    const u2Runs = syncRunRepository.listByUser(user2Id);

    expect(u1Runs.length).toBe(1);
    expect(u2Runs.length).toBe(0);
  });
});
