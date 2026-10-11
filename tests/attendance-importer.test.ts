import { describe, it, expect } from "vitest";
import {
  validateAndNormalizeItem,
  parseAttendanceText,
} from "../src/lib/monev/attendance-importer";

describe("Attendance Importer (Monev Data Parsing without Extension)", () => {
  it("normalizes a valid raw Monev attendance object", () => {
    const raw = {
      date: "2026-10-09",
      status: "PRESENT",
      approval_status: "APPROVED",
      notes: "Catatan harian selesai",
    };
    const normalized = validateAndNormalizeItem(raw);
    expect(normalized).toBeDefined();
    expect(normalized?.date).toBe("2026-10-09");
    expect(normalized?.status).toBe("PRESENT");
    expect(normalized?.approval_status).toBe("APPROVED");
    expect(normalized?.notes).toBe("Catatan harian selesai");
  });

  it("parses JSON payload from official Monev response { data: [...] }", () => {
    const jsonStr = JSON.stringify({
      data: [
        { date: "2026-10-08", status: "PRESENT", approval_status: "APPROVED" },
        { date: "2026-10-07", status: "ON_LEAVE", approval_status: "APPROVED" },
        { date: "2026-10-06", status: "ABSENT" },
      ],
    });

    const result = parseAttendanceText(jsonStr);
    expect(result.errors.length).toBe(0);
    expect(result.valid.length).toBe(3);
    expect(result.valid[0].date).toBe("2026-10-08");
    expect(result.valid[1].status).toBe("ON_LEAVE");
    expect(result.valid[2].status).toBe("ABSENT");
  });

  it("parses CSV attendance text with headers", () => {
    const csvStr = `date,status,approval_status,notes
2026-10-05,PRESENT,APPROVED,Disetujui
2026-10-02,PRESENT,SUBMITTED,Menunggu
2026-10-01,PRESENT,APPROVED,Selesai`;

    const result = parseAttendanceText(csvStr);
    expect(result.errors.length).toBe(0);
    expect(result.valid.length).toBe(3);
    expect(result.valid[0].date).toBe("2026-10-05");
    expect(result.valid[1].approval_status).toBe("SUBMITTED");
  });

  it("rejects invalid text and reports errors cleanly", () => {
    const invalidJson = `{ malformed json `;
    const result = parseAttendanceText(invalidJson);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.valid.length).toBe(0);
  });
});
