import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as importHandler } from "../../src/app/api/attendance/import/route";
import { GET as recordsHandler } from "../../src/app/api/attendance/records/route";
import { GET as syncRunsHandler } from "../../src/app/api/attendance/sync-runs/route";
import { createSessionToken } from "../../src/lib/auth/session";
import { userRepository, attendanceRepository } from "../../src/lib/db/database";
import crypto from "crypto";

describe("MAA End-to-End API Integration & Multi-Tenant Isolation Tests", () => {
  let userAlpha: { id: string; email: string; name: string; token: string };
  let userBeta: { id: string; email: string; name: string; token: string };

  beforeEach(async () => {
    // 1. Setup User Alpha
    const alphaId = `user-alpha-${crypto.randomUUID()}`;
    const alphaEmail = `alpha-${crypto.randomUUID()}@example.com`;
    const createdAlpha = userRepository.create({
      id: alphaId,
      email: alphaEmail,
      name: "User Alpha",
      password_hash: "SECRET_HASH",
    });
    const tokenAlpha = await createSessionToken({
      userId: createdAlpha.id,
      email: createdAlpha.email,
      name: createdAlpha.name,
    });
    userAlpha = {
      id: createdAlpha.id,
      email: createdAlpha.email,
      name: createdAlpha.name,
      token: tokenAlpha,
    };

    // 2. Setup User Beta
    const betaId = `user-beta-${crypto.randomUUID()}`;
    const betaEmail = `beta-${crypto.randomUUID()}@example.com`;
    const createdBeta = userRepository.create({
      id: betaId,
      email: betaEmail,
      name: "User Beta",
      password_hash: "SECRET_HASH",
    });
    const tokenBeta = await createSessionToken({
      userId: createdBeta.id,
      email: createdBeta.email,
      name: createdBeta.name,
    });
    userBeta = {
      id: createdBeta.id,
      email: createdBeta.email,
      name: createdBeta.name,
      token: tokenBeta,
    };
  });

  it("1. Unauthenticated requests to /api/attendance/records are rejected with 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/attendance/records", {
      method: "GET",
    });
    const res = await recordsHandler(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("2. User Alpha can import JSON attendances without browser extension", async () => {
    const payload = {
      data: [
        {
          date: "2026-10-08",
          status: "PRESENT",
          approval_status: "APPROVED",
          notes: "Alpha Attend 1",
        },
        {
          date: "2026-10-09",
          status: "PRESENT",
          approval_status: "SUBMITTED",
          notes: "Alpha Attend 2",
        },
      ],
    };

    const req = new NextRequest("http://localhost:3000/api/attendance/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAlpha.token}`,
      },
      body: JSON.stringify({ content: JSON.stringify(payload) }),
    });

    const res = await importHandler(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.recordsSaved).toBe(2);
  });

  it("3. Multi-Tenant Isolation: User Beta cannot see User Alpha's attendance records", async () => {
    // A. Alpha imports 2 records
    const alphaPayload = {
      data: [
        { date: "2026-10-01", status: "PRESENT", approval_status: "APPROVED" },
        { date: "2026-10-02", status: "PRESENT", approval_status: "APPROVED" },
      ],
    };
    const reqAlphaImport = new NextRequest("http://localhost:3000/api/attendance/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAlpha.token}`,
      },
      body: JSON.stringify({ content: JSON.stringify(alphaPayload) }),
    });
    await importHandler(reqAlphaImport);

    // B. Beta imports 1 record with different date
    const betaPayload = {
      data: [
        { date: "2026-10-05", status: "ON_LEAVE", approval_status: "APPROVED" },
      ],
    };
    const reqBetaImport = new NextRequest("http://localhost:3000/api/attendance/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userBeta.token}`,
      },
      body: JSON.stringify({ content: JSON.stringify(betaPayload) }),
    });
    await importHandler(reqBetaImport);

    // C. Query as User Alpha: must only see Alpha's records
    const reqAlphaGet = new NextRequest(
      "http://localhost:3000/api/attendance/records?startDate=2026-10-01&endDate=2026-10-31",
      {
        headers: { Authorization: `Bearer ${userAlpha.token}` },
      }
    );
    const resAlpha = await recordsHandler(reqAlphaGet);
    const dataAlpha = await resAlpha.json();
    expect(dataAlpha.records.length).toBe(2);
    expect(dataAlpha.records.every((r: any) => r.user_id === userAlpha.id)).toBe(true);
    expect(dataAlpha.records.some((r: any) => r.attendance_date === "2026-10-05")).toBe(false);

    // D. Query as User Beta: must only see Beta's records
    const reqBetaGet = new NextRequest(
      "http://localhost:3000/api/attendance/records?startDate=2026-10-01&endDate=2026-10-31",
      {
        headers: { Authorization: `Bearer ${userBeta.token}` },
      }
    );
    const resBeta = await recordsHandler(reqBetaGet);
    const dataBeta = await resBeta.json();
    expect(dataBeta.records.length).toBe(1);
    expect(dataBeta.records[0].user_id).toBe(userBeta.id);
    expect(dataBeta.records[0].status).toBe("ON_LEAVE");
  });

  it("4. Multi-Tenant Isolation: User Beta cannot see User Alpha's sync runs", async () => {
    // Alpha performs import
    const reqAlphaImport = new NextRequest("http://localhost:3000/api/attendance/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAlpha.token}`,
      },
      body: JSON.stringify({
        content: JSON.stringify({
          data: [{ date: "2026-10-07", status: "PRESENT" }],
        }),
      }),
    });
    await importHandler(reqAlphaImport);

    // Query sync runs as User Beta
    const reqBetaRuns = new NextRequest("http://localhost:3000/api/attendance/sync-runs", {
      headers: { Authorization: `Bearer ${userBeta.token}` },
    });
    const resBeta = await syncRunsHandler(reqBetaRuns);
    const dataBeta = await resBeta.json();
    expect(dataBeta.syncRuns.length).toBe(0); // Beta has no sync runs
  });

  it("5. Direct unauthenticated import is rejected with 401 Unauthorized", async () => {
    const payload = {
      data: [{ date: "2026-10-08", status: "PRESENT", approval_status: "APPROVED" }],
    };

    const req = new NextRequest("http://localhost:3000/api/attendance/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: JSON.stringify(payload),
        email: "unauth@example.com",
        name: "Peserta Unauth",
      }),
    });

    const res = await importHandler(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("Akses ditolak");
  });

  it("6. Invalid or empty payload is rejected with 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/attendance/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAlpha.token}`,
      },
      body: JSON.stringify({ content: "bukan data json atau csv valid" }),
    });

    const res = await importHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
  });
});
