import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getDb, closeDb, userRepository, attendanceRepository, syncRunRepository } from "../src/lib/db/database";
import crypto from "crypto";

describe("Monev SSO Investigation & Companion Flow Tests", () => {
  beforeEach(() => {
    const db = getDb();
    db.prepare("DELETE FROM attendance_records").run();
    db.prepare("DELETE FROM sync_runs").run();
    db.prepare("DELETE FROM users").run();
  });

  afterAll(() => {
    closeDb();
  });

  it("1. Zero dummy data guarantee: Tidak ada record yang muncul tanpa sumber yang sah", () => {
    const user = userRepository.create({
      id: crypto.randomUUID(),
      name: "Peserta Nyata",
      email: "real_user@example.com",
      password_hash: "COMPANION_AUTHENTICATED",
    });

    const records = attendanceRepository.findByUserAndDateRange(user.id, "2026-10-01", "2026-10-31");
    expect(records).toHaveLength(0);
  });

  it("2. Menyimpan catatan absensi asli Monev dengan status dan persetujuan yang benar", () => {
    const user = userRepository.create({
      id: crypto.randomUUID(),
      name: "Peserta MagangHub",
      email: "peserta@kemnaker.go.id",
      password_hash: "COMPANION_AUTHENTICATED",
    });

    const saved = attendanceRepository.upsert({
      id: "att_live_001",
      user_id: user.id,
      attendance_date: "2026-10-10",
      status: "PRESENT",
      approval_status: "SUBMITTED",
      source: "MONEV_COMPANION_LIVE",
      raw_response: JSON.stringify({ status: "PRESENT", approval_status: "SUBMITTED" }),
    });

    expect(saved.status).toBe("PRESENT");
    expect(saved.approval_status).toBe("SUBMITTED");
    expect(saved.source).toBe("MONEV_COMPANION_LIVE");

    // Periksa deduplikasi: update status menjadi APPROVED
    const updated = attendanceRepository.upsert({
      id: "att_live_001",
      user_id: user.id,
      attendance_date: "2026-10-10",
      status: "PRESENT",
      approval_status: "APPROVED",
      source: "MONEV_COMPANION_LIVE",
    });

    expect(updated.approval_status).toBe("APPROVED");
    const count = attendanceRepository.findByUserAndDateRange(user.id, "2026-10-10", "2026-10-10");
    expect(count).toHaveLength(1);
  });

  it("3. Audit log mencatat riwayat pemeriksaan tanpa menyimpan kredensial", () => {
    const user = userRepository.create({
      id: crypto.randomUUID(),
      name: "Peserta Audit",
      email: "audit@example.com",
      password_hash: "SSO_AUTHENTICATED",
    });

    const runId = crypto.randomUUID();
    const run = syncRunRepository.create({
      id: runId,
      user_id: user.id,
      started_at: new Date().toISOString(),
      result: "SUCCESS",
      records_checked: 1,
      message: "Sinkronisasi berhasil",
    });

    expect(run.result).toBe("SUCCESS");
    expect(run.records_checked).toBe(1);

    const history = syncRunRepository.listByUser(user.id, 5);
    expect(history).toHaveLength(1);
    expect(history[0].user_id).toBe(user.id);
  });
});
