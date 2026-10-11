import { describe, it, expect } from "vitest";
import {
  evaluateDayCategory,
  buildScheduledDays,
  formatIndonesianDate,
  STATUS_META,
} from "../src/lib/monev/schedule-evaluator";
import { AttendanceRecord } from "../src/types";

describe("Monev Schedule Evaluator (8 Status Categories)", () => {
  const today = "2026-10-11"; // Sunday

  const makeRecord = (
    date: string,
    status: string,
    approval: "APPROVED" | "PENDING" | "REJECTED" | null = null,
    notes?: string
  ): AttendanceRecord => ({
    id: `rec-${date}`,
    user_id: "user-123",
    attendance_date: date,
    status,
    approval_status: approval,
    source: "MONEV_COMPANION",
    last_checked_at: new Date().toISOString(),
    notes: notes || null,
  });

  it("1. Hadir disetujui (PRESENT + APPROVED)", () => {
    const rec = makeRecord("2026-10-08", "PRESENT", "APPROVED");
    const category = evaluateDayCategory("2026-10-08", rec, today);
    expect(category).toBe("HADIR_DISETUJUI");
    expect(STATUS_META[category].label).toBe("Hadir disetujui");
  });

  it("2. Izin disetujui (ON_LEAVE / PERMISSION + APPROVED)", () => {
    const rec1 = makeRecord("2026-10-07", "ON_LEAVE", "APPROVED");
    expect(evaluateDayCategory("2026-10-07", rec1, today)).toBe("IZIN_DISETUJUI");

    const rec2 = makeRecord("2026-10-06", "IZIN", "APPROVED");
    expect(evaluateDayCategory("2026-10-06", rec2, today)).toBe("IZIN_DISETUJUI");

    const rec3 = makeRecord("2026-10-05", "SAKIT", "APPROVED");
    expect(evaluateDayCategory("2026-10-05", rec3, today)).toBe("IZIN_DISETUJUI");
  });

  it("3. Tidak Hadir (ABSENT / ALPHA)", () => {
    const rec = makeRecord("2026-10-02", "ABSENT", null);
    expect(evaluateDayCategory("2026-10-02", rec, today)).toBe("TIDAK_HADIR");

    const rec2 = makeRecord("2026-10-01", "ALPHA", null);
    expect(evaluateDayCategory("2026-10-01", rec2, today)).toBe("TIDAK_HADIR");
  });

  it("4. Kehadiran Ditolak (REJECTED)", () => {
    const rec = makeRecord("2026-10-08", "PRESENT", "REJECTED");
    expect(evaluateDayCategory("2026-10-08", rec, today)).toBe("KEHADIRAN_DITOLAK");

    const rec2 = makeRecord("2026-10-07", "REJECTED", null);
    expect(evaluateDayCategory("2026-10-07", rec2, today)).toBe("KEHADIRAN_DITOLAK");
  });

  it("5. Perlu Tindakan Anda (Catatan Revisi / DRAFT)", () => {
    const rec = makeRecord("2026-10-09", "PRESENT", "PENDING", "Perlu revisi laporan harian");
    expect(evaluateDayCategory("2026-10-09", rec, today)).toBe("PERLU_TINDAKAN");

    const rec2 = makeRecord("2026-10-09", "REVISION", null);
    expect(evaluateDayCategory("2026-10-09", rec2, today)).toBe("PERLU_TINDAKAN");
  });

  it("6. Menunggu Tindakan Mentor (PRESENT / ON_LEAVE + SUBMITTED / PENDING)", () => {
    const rec = makeRecord("2026-10-09", "PRESENT", "PENDING");
    expect(evaluateDayCategory("2026-10-09", rec, today)).toBe("MENUNGGU_MENTOR");

    const rec2 = makeRecord("2026-10-09", "PRESENT", null);
    expect(evaluateDayCategory("2026-10-09", rec2, today)).toBe("MENUNGGU_MENTOR");
  });

  it("7. Belum Diisi (Hari kerja magang s.d. hari ini tanpa record)", () => {
    // 2026-10-08 is Thursday (workday)
    expect(evaluateDayCategory("2026-10-08", undefined, today)).toBe("BELUM_DIISI");
  });

  it("8. Hari Libur (Berdasarkan record DAYOFF atau off-days spesifik peserta)", () => {
    // Record resmi berstatus DAYOFF
    const recDayoff = makeRecord("2026-10-10", "DAYOFF");
    expect(evaluateDayCategory("2026-10-10", recDayoff, today)).toBe("HARI_LIBUR");

    // Peserta dengan off_days kustom [0, 6] (Minggu & Sabtu)
    expect(evaluateDayCategory("2026-10-10", undefined, today, [0, 6])).toBe("HARI_LIBUR");
    expect(evaluateDayCategory("2026-10-11", undefined, today, [0, 6])).toBe("HARI_LIBUR");

    // Peserta ritel/shift tanpa off_days weekend (Sabtu/Minggu bukan hari libur otomatis)
    expect(evaluateDayCategory("2026-10-10", undefined, today)).toBe("BELUM_DIISI");
  });

  it("buildScheduledDays builds complete range with summary", () => {
    const records = [
      makeRecord("2026-10-05", "PRESENT", "APPROVED"),
      makeRecord("2026-10-06", "PRESENT", "APPROVED"),
      makeRecord("2026-10-07", "PRESENT", "APPROVED"),
      makeRecord("2026-10-08", "PRESENT", "APPROVED"),
      makeRecord("2026-10-09", "PRESENT", "PENDING"),
      makeRecord("2026-10-10", "DAYOFF"),
      makeRecord("2026-10-11", "DAYOFF"),
    ];

    const result = buildScheduledDays("2026-10-05", "2026-10-11", records, today);
    expect(result.days.length).toBe(7);
    expect(result.summary.hadirDisetujui).toBe(4);
    expect(result.summary.menungguMentor).toBe(1);
    expect(result.summary.hariLibur).toBe(2); // 2026-10-10 & 2026-10-11 dari status DAYOFF resmi
    expect(result.summary.belumDiisi).toBe(0);
  });

  it("formatIndonesianDate produces proper Indonesian date strings", () => {
    const { dayName, formattedDate } = formatIndonesianDate("2026-10-09");
    expect(dayName).toBe("Jumat");
    expect(formattedDate).toBe("9 Okt 2026");
  });
});
