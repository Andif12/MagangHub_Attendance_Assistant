import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as companionSyncHandler } from "../src/app/api/auth/companion-sync/route";
import { GET as recordsHandler } from "../src/app/api/attendance/records/route";
import { createSessionToken } from "../src/lib/auth/session";
import { userRepository, attendanceRepository } from "../src/lib/db/database";
import { validateAndNormalizeItem } from "../src/lib/monev/attendance-importer";
import crypto from "crypto";

describe("MAA DOM-Only Companion Tests (Zero-Token Security)", () => {
  let userA: { id: string; email: string; name: string; token: string };
  let userB: { id: string; email: string; name: string; token: string };

  beforeEach(async () => {
    // Pengguna A
    const aId = `user-a-${crypto.randomUUID()}`;
    const aEmail = `user-a-${crypto.randomUUID()}@example.com`;
    const createdA = userRepository.create({
      id: aId,
      email: aEmail,
      name: "Peserta A",
      password_hash: "COMPANION_HASH_A",
    });
    const tokenA = await createSessionToken({
      userId: createdA.id,
      email: createdA.email,
      name: createdA.name,
    });
    userA = { id: createdA.id, email: createdA.email, name: createdA.name, token: tokenA };

    // Pengguna B
    const bId = `user-b-${crypto.randomUUID()}`;
    const bEmail = `user-b-${crypto.randomUUID()}@example.com`;
    const createdB = userRepository.create({
      id: bId,
      email: bEmail,
      name: "Peserta B",
      password_hash: "COMPANION_HASH_B",
    });
    const tokenB = await createSessionToken({
      userId: createdB.id,
      email: createdB.email,
      name: createdB.name,
    });
    userB = { id: createdB.id, email: createdB.email, name: createdB.name, token: tokenB };
  });

  it("1. Normalisasi item DOM mengekstrak tanggal, status, persetujuan, dan jam secara akurat", () => {
    const rawDomItem = {
      date: "2026-10-10",
      status: "Hadir",
      approval_status: "Disetujui",
      in_time: "07:55",
      out_time: "17:02",
      notes: "Catatan dari layar",
    };

    const normalized = validateAndNormalizeItem(rawDomItem);
    expect(normalized).toBeDefined();
    expect(normalized?.date).toBe("2026-10-10");
    expect(normalized?.status).toBe("PRESENT");
    expect(normalized?.approval_status).toBe("APPROVED");
    expect(normalized?.in_time).toBe("07:55");
    expect(normalized?.out_time).toBe("17:02");
    expect(normalized?.notes).toBe("Catatan dari layar");
  });

  it("2. Item DOM dengan tanggal kalender tidak valid (misal 31 Feb) ditolak", () => {
    const invalidDateItem = {
      date: "2026-02-31",
      status: "Hadir",
    };
    const result = validateAndNormalizeItem(invalidDateItem);
    expect(result).toBeNull();
  });

  it("3. Status tanpa persetujuan TIDAK dipalsukan menjadi APPROVED", () => {
    const rawPending = {
      date: "2026-10-11",
      status: "HADIR",
      approval_status: "Menunggu",
    };
    const normPending = validateAndNormalizeItem(rawPending);
    expect(normPending?.approval_status).toBe("SUBMITTED");

    const rawNoApproval = {
      date: "2026-10-12",
      status: "TIDAK HADIR",
    };
    const normNoApproval = validateAndNormalizeItem(rawNoApproval);
    expect(normNoApproval?.approval_status).toBeNull();
  });

  it("4. Endpoint /api/auth/companion-sync menolak payload tanpa autentikasi (HTTP 401)", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/companion-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "DOM_COMPANION",
        attendances: [{ date: "2026-10-10", status: "PRESENT" }],
      }),
    });

    const res = await companionSyncHandler(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain("Akses ditolak");
  });

  it("5. Endpoint /api/auth/companion-sync menolak payload kosong (HTTP 400)", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/companion-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({ attendances: [] }),
    });

    const res = await companionSyncHandler(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("kosong");
  });

  it("6. Pengguna terautentikasi dapat menyinkronkan data DOM dan data tersimpan di DB secara idempotent", async () => {
    const domPayload = {
      source: "DOM_COMPANION",
      paginationInfo: { periodLabel: "Periode 1", isPartial: true },
      attendances: [
        { date: "2026-10-08", status: "PRESENT", approval_status: "APPROVED" },
        { date: "2026-10-09", status: "ON_LEAVE", approval_status: "APPROVED" },
      ],
    };

    // Sinkronisasi pertama
    const req1 = new NextRequest("http://localhost:3000/api/auth/companion-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify(domPayload),
    });
    const res1 = await companionSyncHandler(req1);
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    expect(json1.recordsSaved).toBe(2);
    expect(json1.newRecords).toBe(2);

    // Sinkronisasi kedua (data sama) -> Idempotent upsert, tidak bertambah jadi 4
    const req2 = new NextRequest("http://localhost:3000/api/auth/companion-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify(domPayload),
    });
    const res2 = await companionSyncHandler(req2);
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.recordsSaved).toBe(2);
    expect(json2.duplicateRecords).toBe(2);
    expect(json2.newRecords).toBe(0);

    // Verifikasi total catatan di DB pengguna A
    const reqRecords = new NextRequest(
      "http://localhost:3000/api/attendance/records?startDate=2026-10-01&endDate=2026-10-31",
      {
        headers: { Authorization: `Bearer ${userA.token}` },
      }
    );
    const resRecords = await recordsHandler(reqRecords);
    const recordsJson = await resRecords.json();
    expect(recordsJson.records.length).toBe(2);
    expect(recordsJson.records[0].source).toBe("MONEV_COMPANION_DOM");
  });

  it("7. Isolasi Multi-Tenant: Pengguna B tidak dapat melihat atau menimpa data DOM Pengguna A", async () => {
    // Pengguna A menyimpan data
    const reqSyncA = new NextRequest("http://localhost:3000/api/auth/companion-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({
        attendances: [{ date: "2026-10-07", status: "PRESENT", notes: "Catatan Pribadi A" }],
      }),
    });
    const resSyncA = await companionSyncHandler(reqSyncA);
    expect(resSyncA.status).toBe(200);

    // Pengguna B mengecek records miliknya
    const reqGetB = new NextRequest(
      "http://localhost:3000/api/attendance/records?startDate=2026-10-01&endDate=2026-10-31",
      {
        headers: { Authorization: `Bearer ${userB.token}` },
      }
    );
    const resGetB = await recordsHandler(reqGetB);
    const dataB = await resGetB.json();
    expect(dataB.records.length).toBe(0); // Pengguna B tidak memiliki akses ke data Pengguna A
  });

  it("8. Manifest dan Pola Match Pattern Ekstensi MV3 tidak mengandung port terlarang", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    const manifestContent = JSON.parse(fs.readFileSync("extension/manifest.json", "utf-8"));

    const allPatterns = [
      ...(manifestContent.host_permissions || []),
      ...(manifestContent.content_scripts?.flatMap((cs: { matches: string[] }) => cs.matches) || []),
    ];

    // Sesuai spesifikasi Google Chrome Extension Match Pattern, pola URL dilarang memuat nomor port (misal :3000)
    for (const pattern of allPatterns) {
      expect(pattern).not.toMatch(/:\d+\//);
    }
  });
});
