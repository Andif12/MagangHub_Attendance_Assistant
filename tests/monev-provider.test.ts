import { describe, it, expect, vi, beforeEach } from "vitest";
import { OfficialMonevProvider } from "@/lib/monev/official-provider";
import {
  maskParticipantId,
  redactSensitive,
} from "@/lib/monev/auth-investigation";

describe("OfficialMonevProvider - Security & Error Handling", () => {
  let provider: OfficialMonevProvider;

  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.MONEV_API_ENABLED;
    delete process.env.MONEV_AUTH_TOKEN;
    delete process.env.MONEV_PARTICIPANT_ID;
    provider = new OfficialMonevProvider();
  });

  describe("1. Masking & Sensor Data Sensitif", () => {
    it("melakukan sensor (masking) pada ID peserta", () => {
      expect(maskParticipantId("")).toBe("[Belum Dikonfigurasi]");
      expect(maskParticipantId("123")).toBe("****");
      expect(maskParticipantId("participant-uuid-98765")).toBe("***8765");
    });

    it("meredaksi (redact) token dan cookie dari pesan log dan galat", () => {
      const sensitive = "Authorization: Bearer secret_token_xyz123, cookie: session=abc";
      const redacted = redactSensitive(sensitive);
      expect(redacted).not.toContain("secret_token_xyz123");
      expect(redacted).toContain("[REDACTED]");
    });
  });

  describe("2. Penanganan Ketiadaan Kredensial", () => {
    it("menolak eksekusi jika token tidak tersedia", async () => {
      const res = await provider.fetchAttendances("usr_123", "2026-10-01", "2026-10-11");
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("AUTH_REQUIRED");
      expect(res.records).toHaveLength(0);
    });
  });

  describe("3. Parsing Respons Berhasil & Status Galat Server", () => {
    it("berhasil membaca data presensi nyata saat server merespons 200", async () => {
      const mockRecords = [
        {
          date: "2026-10-11",
          status: "PRESENT",
          approval_status: "APPROVED",
          created_at: "2026-10-11T08:00:00+08:00",
          updated_at: "2026-10-11T09:00:00+08:00",
        },
      ];

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: mockRecords }),
      } as Response);

      const res = await provider.fetchAttendances(
        "usr_123",
        "2026-10-11",
        "2026-10-11",
        "test_token_valid"
      );

      expect(res.success).toBe(true);
      expect(res.records).toHaveLength(1);
      expect(res.records[0].status).toBe("PRESENT");
      expect(res.records[0].approval_status).toBe("APPROVED");
    });

    it("menangani HTTP 401/403 sesi kedaluwarsa dengan benar", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      } as Response);

      const res = await provider.fetchAttendances(
        "usr_123",
        "2026-10-11",
        "2026-10-11",
        "test_token_expired"
      );

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("AUTH_FAILED");
      expect(res.statusCode).toBe(401);
    });

    it("menangani HTTP 429 Rate Limit dengan benar", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      } as Response);

      const res = await provider.fetchAttendances(
        "usr_123",
        "2026-10-11",
        "2026-10-11",
        "test_token_valid"
      );

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("RATE_LIMITED");
      expect(res.statusCode).toBe(429);
    });
  });
});
