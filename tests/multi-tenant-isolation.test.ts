import { describe, it, expect, beforeEach } from "vitest";
import {
  userRepository,
  attendanceRepository,
  notificationRepository,
  syncRunRepository,
} from "@/lib/db/database";
import crypto from "crypto";

describe("MAA Multi-Tenant Data Isolation & Database Integrity", () => {
  let userAId: string;
  let userBId: string;

  beforeEach(() => {
    userAId = `userA-${crypto.randomUUID()}`;
    userBId = `userB-${crypto.randomUUID()}`;

    userRepository.create({
      id: userAId,
      name: "User Alpha",
      email: `alpha-${crypto.randomUUID()}@example.com`,
      password_hash: "hashA",
    });

    userRepository.create({
      id: userBId,
      name: "User Beta",
      email: `beta-${crypto.randomUUID()}@example.com`,
      password_hash: "hashB",
    });
  });

  it("menjamin User A tidak dapat membaca atau melihat catatan presensi User B", () => {
    attendanceRepository.upsert({
      id: `att-A-${crypto.randomUUID()}`,
      user_id: userAId,
      attendance_date: "2026-10-10",
      status: "PRESENT",
      approval_status: "APPROVED",
      source: "official_monev",
    });

    attendanceRepository.upsert({
      id: `att-B-${crypto.randomUUID()}`,
      user_id: userBId,
      attendance_date: "2026-10-10",
      status: "ABSENT",
      source: "official_monev",
    });

    const recordsA = attendanceRepository.findByUserAndDateRange(userAId, "2026-10-01", "2026-10-31");
    const recordsB = attendanceRepository.findByUserAndDateRange(userBId, "2026-10-01", "2026-10-31");

    expect(recordsA).toHaveLength(1);
    expect(recordsA[0].status).toBe("PRESENT");
    expect(recordsA[0].user_id).toBe(userAId);

    expect(recordsB).toHaveLength(1);
    expect(recordsB[0].status).toBe("ABSENT");
    expect(recordsB[0].user_id).toBe(userBId);
  });

  it("melakukan deduplikasi catatan presensi per user dan tanggal (UPSERT)", () => {
    const commonDate = "2026-10-11";

    attendanceRepository.upsert({
      id: `att-${userAId}-1`,
      user_id: userAId,
      attendance_date: commonDate,
      status: "PRESENT",
      approval_status: "PENDING",
      source: "official_monev",
    });

    attendanceRepository.upsert({
      id: `att-${userAId}-2`,
      user_id: userAId,
      attendance_date: commonDate,
      status: "PRESENT",
      approval_status: "APPROVED",
      source: "official_monev",
    });

    const records = attendanceRepository.findByUserAndDateRange(userAId, commonDate, commonDate);
    expect(records).toHaveLength(1);
    expect(records[0].approval_status).toBe("APPROVED");
  });

  it("mengisolasi riwayat audit sinkronisasi (sync_runs) antar pengguna", () => {
    syncRunRepository.create({
      id: `sync-A-${crypto.randomUUID()}`,
      user_id: userAId,
      started_at: new Date().toISOString(),
      result: "SUCCESS",
      records_checked: 5,
    });

    syncRunRepository.create({
      id: `sync-B-${crypto.randomUUID()}`,
      user_id: userBId,
      started_at: new Date().toISOString(),
      result: "BLOCKED",
      records_checked: 0,
    });

    const runsA = syncRunRepository.listByUser(userAId);
    const runsB = syncRunRepository.listByUser(userBId);

    expect(runsA).toHaveLength(1);
    expect(runsA[0].result).toBe("SUCCESS");

    expect(runsB).toHaveLength(1);
    expect(runsB[0].result).toBe("BLOCKED");
  });

  it("mengisolasi notifikasi pengguna dan menghitung jumlah belum dibaca secara independen", () => {
    notificationRepository.create({
      id: `notif-A-${crypto.randomUUID()}`,
      user_id: userAId,
      type: "ATTENDANCE_MISSING",
      message: "Pesan untuk User A",
    });

    notificationRepository.create({
      id: `notif-B-${crypto.randomUUID()}`,
      user_id: userBId,
      type: "STATUS_CHANGED",
      message: "Pesan untuk User B",
    });

    expect(notificationRepository.getUnreadCount(userAId)).toBe(1);
    expect(notificationRepository.getUnreadCount(userBId)).toBe(1);

    notificationRepository.markAllAsRead(userAId);

    expect(notificationRepository.getUnreadCount(userAId)).toBe(0);
    expect(notificationRepository.getUnreadCount(userBId)).toBe(1);
  });
});
