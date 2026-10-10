import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  runAttendanceSync,
  normalizeDateToTimezone,
} from "@/lib/monitoring/attendance-monitor";
import {
  userRepository,
  attendanceRepository,
  notificationRepository,
} from "@/lib/db/database";
import { officialMonevProvider } from "@/lib/monev/official-provider";
import crypto from "crypto";

describe("MAA Attendance Monitoring & False-Alarm Safeguards", () => {
  let testUserId: string;

  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.MONEV_API_ENABLED;
    delete process.env.MONEV_AUTH_TOKEN;
    delete process.env.MONEV_PARTICIPANT_ID;

    testUserId = `user-${crypto.randomUUID()}`;
    userRepository.create({
      id: testUserId,
      name: "Tester MAA",
      email: `sync-${crypto.randomUUID()}@test.com`,
      password_hash: "hash",
    });
  });

  describe("1. Normalisasi Zona Waktu (WITA / Asia/Makassar)", () => {
    it("menormalkan tanggal ISO ke format YYYY-MM-DD", () => {
      const normalized = normalizeDateToTimezone("2026-10-11T02:00:00Z", "Asia/Makassar");
      expect(normalized).toBe("2026-10-11");
    });

    it("mempertahankan format YYYY-MM-DD jika sudah benar", () => {
      const normalized = normalizeDateToTimezone("2026-10-15", "Asia/Makassar");
      expect(normalized).toBe("2026-10-15");
    });
  });

  describe("2. Kejujuran Status Integrasi (Tanpa Data Dummy)", () => {
    it("melaporkan status BLOCKED secara jujur jika belum ada otorisasi resmi", async () => {
      const res = await runAttendanceSync({
        userId: testUserId,
        startDate: "2026-10-11",
        endDate: "2026-10-11",
      });

      expect(res.success).toBe(false);
      expect(res.connectionState).toBe("BLOCKED");
      expect(res.syncRun.result).toBe("BLOCKED");
      expect(res.message).toContain("BLOCKED/UNVERIFIED");
      expect(res.source).toBe("UNAVAILABLE");
    });
  });

  describe("3. Pencegahan Notifikasi Palsu Saat Provider Gagal", () => {
    it("TIDAK mengirim notifikasi 'Absensi belum diisi' jika terjadi gangguan koneksi/timeout", async () => {
      vi.spyOn(officialMonevProvider, "isEnabled", "get").mockReturnValue(true);
      vi.spyOn(officialMonevProvider, "fetchAttendances").mockResolvedValueOnce({
        success: false,
        statusCode: 0,
        records: [],
        errorCode: "CONNECTION_ERROR",
        message: "Endpoint Monev timeout setelah 8000ms",
      });

      const res = await runAttendanceSync({
        userId: testUserId,
        startDate: "2026-10-11",
        endDate: "2026-10-11",
      });

      expect(res.success).toBe(false);
      expect(res.syncRun.result).toBe("FAILED");

      const notifs = notificationRepository.listByUser(testUserId);
      const missingNotifs = notifs.filter((n) => n.type === "ATTENDANCE_MISSING");
      expect(missingNotifs).toHaveLength(0);
    });

    it("TIDAK mengirim notifikasi 'Absensi belum diisi' jika otorisasi 401 ditolak", async () => {
      vi.spyOn(officialMonevProvider, "isEnabled", "get").mockReturnValue(true);
      vi.spyOn(officialMonevProvider, "fetchAttendances").mockResolvedValueOnce({
        success: false,
        statusCode: 401,
        records: [],
        errorCode: "AUTH_FAILED",
        message: "HTTP 401 Unauthorized",
      });

      const res = await runAttendanceSync({
        userId: testUserId,
        startDate: "2026-10-11",
        endDate: "2026-10-11",
      });

      expect(res.success).toBe(false);
      expect(res.connectionState).toBe("UNVERIFIED");

      const notifs = notificationRepository.listByUser(testUserId);
      const missingNotifs = notifs.filter((n) => n.type === "ATTENDANCE_MISSING");
      expect(missingNotifs).toHaveLength(0);
    });
  });

  describe("4. Notifikasi Presensi Nyata yang Berhasil Divalidasi", () => {
    it("mengirim notifikasi ATTENDANCE_MISSING hanya saat sync sukses dan absensi hari ini kosong", async () => {
      vi.spyOn(officialMonevProvider, "isEnabled", "get").mockReturnValue(true);
      vi.spyOn(officialMonevProvider, "fetchAttendances").mockResolvedValueOnce({
        success: true,
        statusCode: 200,
        records: [],
        message: "Berhasil membaca 0 catatan presensi.",
      });

      const res = await runAttendanceSync({
        userId: testUserId,
        startDate: "2026-10-11",
        endDate: "2026-10-11",
      });

      expect(res.success).toBe(true);
      expect(res.syncRun.result).toBe("SUCCESS");

      const notifs = notificationRepository.listByUser(testUserId);
      const missingNotifs = notifs.filter((n) => n.type === "ATTENDANCE_MISSING");
      expect(missingNotifs).toHaveLength(1);
      expect(missingNotifs[0].message).toContain("belum terdeteksi");
    });

    it("mengirim notifikasi STATUS_CHANGED jika status absensi berubah dari PENDING menjadi APPROVED", async () => {
      attendanceRepository.upsert({
        id: `att-${testUserId}-2026-10-11`,
        user_id: testUserId,
        attendance_date: "2026-10-11",
        status: "PRESENT",
        approval_status: "PENDING",
        source: "official_monev",
      });

      vi.spyOn(officialMonevProvider, "isEnabled", "get").mockReturnValue(true);
      vi.spyOn(officialMonevProvider, "fetchAttendances").mockResolvedValueOnce({
        success: true,
        statusCode: 200,
        records: [
          {
            date: "2026-10-11",
            status: "PRESENT",
            approval_status: "APPROVED",
            created_at: "2026-10-11T08:00:00+08:00",
            updated_at: "2026-10-11T09:00:00+08:00",
          },
        ],
        message: "Berhasil membaca 1 catatan presensi.",
      });

      const res = await runAttendanceSync({
        userId: testUserId,
        startDate: "2026-10-11",
        endDate: "2026-10-11",
      });

      expect(res.success).toBe(true);

      const notifs = notificationRepository.listByUser(testUserId);
      const statusChangedNotifs = notifs.filter((n) => n.type === "STATUS_CHANGED");
      expect(statusChangedNotifs).toHaveLength(1);
      expect(statusChangedNotifs[0].message).toContain("APPROVED");
    });
  });
});
