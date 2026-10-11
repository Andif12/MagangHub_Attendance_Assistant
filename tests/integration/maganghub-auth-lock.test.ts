import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as meHandler } from "../../src/app/api/auth/me/route";
import { POST as logoutHandler } from "../../src/app/api/auth/logout/route";
import { POST as loginHandler } from "../../src/app/api/auth/login/route";
import { POST as registerHandler } from "../../src/app/api/auth/register/route";
import { GET as ssoCallbackHandler } from "../../src/app/api/auth/sso/callback/route";
import { GET as recordsHandler } from "../../src/app/api/attendance/records/route";
import { POST as syncHandler } from "../../src/app/api/attendance/sync/route";
import { POST as importHandler } from "../../src/app/api/attendance/import/route";
import { GET as notifHandler } from "../../src/app/api/notifications/route";
import { POST as companionSyncHandler } from "../../src/app/api/auth/companion-sync/route";
import { createSessionToken } from "../../src/lib/auth/session";
import { userRepository, attendanceRepository } from "../../src/lib/db/database";
import crypto from "crypto";

describe("Verifikasi Sistem Autentikasi MagangHub Sebagai Satu-satunya Pintu Masuk", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Pengguna belum login → akses seluruh endpoint ditolak (HTTP 401)", async () => {
    // A. Endpoint info pengguna
    const reqMe = new NextRequest("http://localhost:3000/api/auth/me");
    const resMe = await meHandler(reqMe);
    expect(resMe.status).toBe(401);

    // B. Endpoint catatan presensi
    const reqRec = new NextRequest("http://localhost:3000/api/attendance/records");
    const resRec = await recordsHandler(reqRec);
    expect(resRec.status).toBe(401);

    // C. Endpoint trigger sinkronisasi
    const reqSync = new NextRequest("http://localhost:3000/api/attendance/sync", {
      method: "POST",
    });
    const resSync = await syncHandler(reqSync);
    expect(resSync.status).toBe(401);

    // D. Endpoint impor berkas tanpa email dan tanpa sesi -> ditolak 401
    const reqImport = new NextRequest("http://localhost:3000/api/attendance/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: JSON.stringify({
          data: [{ date: "2026-10-08", status: "PRESENT" }],
        }),
      }),
    });
    const resImport = await importHandler(reqImport);
    expect(resImport.status).toBe(401);

    // E. Endpoint notifikasi
    const reqNotif = new NextRequest("http://localhost:3000/api/notifications");
    const resNotif = await notifHandler(reqNotif);
    expect(resNotif.status).toBe(401);
  });

  it("2. Login dan registrasi lokal mandiri dinonaktifkan (HTTP 403)", async () => {
    // Login lokal ditolak
    const reqLogin = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "Password123!" }),
    });
    const resLogin = await loginHandler();
    expect(resLogin.status).toBe(403);
    const loginJson = await resLogin.json();
    expect(loginJson.error).toContain("dinonaktifkan");

    // Registrasi lokal ditolak
    const reqReg = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "User",
        email: "user@example.com",
        password: "Password123!",
      }),
    });
    const resReg = await registerHandler();
    expect(resReg.status).toBe(403);
    const regJson = await resReg.json();
    expect(regJson.error).toContain("dinonaktifkan");

    // Pembuatan sesi mandiri tanpa autentikasi ditolak
    const reqCompanion = new NextRequest("http://localhost:3000/api/auth/companion-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: { id: "123", email: "unauth@example.com", name: "Fake" } }),
    });
    const resCompanion = await companionSyncHandler(reqCompanion);
    expect(resCompanion.status).toBe(401);
  });

  it("3. Callback palsu atau parameter buatan pengguna → akses ditolak", async () => {
    // A. Callback tanpa parameter code atau state
    const reqMissing = new NextRequest("http://localhost:3000/api/auth/sso/callback");
    const resMissing = await ssoCallbackHandler(reqMissing);
    expect(resMissing.status).toBe(307); // Redirect to login
    expect(resMissing.headers.get("location")).toContain("auth_error=missing_code_or_state");

    // B. Callback dengan parameter buatan/palsu -> pertukaran kode ditolak server Kemnaker
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "invalid_grant", message: "Kode tidak sah" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );

    const reqFake = new NextRequest(
      "http://localhost:3000/api/auth/sso/callback?code=fake_code_123&state=fake_state_456"
    );
    const resFake = await ssoCallbackHandler(reqFake);
    expect(resFake.status).toBe(307);
    expect(resFake.headers.get("location")).toContain("auth_error=exchange_failed");
    // Pastikan tidak ada cookie sesi yang diterbitkan
    expect(resFake.cookies.get("maa_session")).toBeUndefined();
  });

  it("4. Autentikasi resmi berhasil dan terverifikasi → sesi MAA dibuat dan dashboard dapat diakses", async () => {
    const verifiedEmail = `peserta-resmi-${crypto.randomUUID()}@maganghub.kemnaker.go.id`;
    const verifiedName = "Andi Peserta Resmi";

    // 1. Mock respons pertukaran kode sukses dari Kemnaker
    const mockExchangeResponse = new Response(
      JSON.stringify({
        access_token: "jwt_token_resmi_kemnaker_xyz",
        token_type: "bearer",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

    // 2. Mock respons profil pengguna sukses dari Kemnaker
    const mockProfileResponse = new Response(
      JSON.stringify({
        data: {
          id: "61726052-a567-4250-9999-528574163999",
          email: verifiedEmail,
          name: verifiedName,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockExchangeResponse)
      .mockResolvedValueOnce(mockProfileResponse);

    // Panggil callback dengan kode otorisasi
    const reqCallback = new NextRequest(
      "http://localhost:3000/api/auth/sso/callback?code=valid_monev_code&state=valid_oauth_state"
    );
    const resCallback = await ssoCallbackHandler(reqCallback);

    // Harus redirect ke dashboard dengan indikator sukses dan menerbitkan cookie sesi
    expect(resCallback.status).toBe(307);
    expect(resCallback.headers.get("location")).toContain("auth_success=1");
    const sessionCookie = resCallback.cookies.get("maa_session");
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.value).toBeTruthy();

    // 3. Gunakan cookie sesi tersebut untuk mengakses /api/auth/me
    const reqMe = new NextRequest("http://localhost:3000/api/auth/me", {
      headers: {
        Cookie: `maa_session=${sessionCookie?.value}`,
      },
    });
    const resMe = await meHandler(reqMe);
    expect(resMe.status).toBe(200);
    const meData = await resMe.json();
    expect(meData.success).toBe(true);
    expect(meData.user.email).toBe(verifiedEmail);
    expect(meData.user.name).toBe(verifiedName);

    // 4. Akses dashboard records berhasil untuk pengguna ini
    const reqRec = new NextRequest("http://localhost:3000/api/attendance/records", {
      headers: {
        Cookie: `maa_session=${sessionCookie?.value}`,
      },
    });
    const resRec = await recordsHandler(reqRec);
    expect(resRec.status).toBe(200);
    const recData = await resRec.json();
    expect(recData.success).toBe(true);
    expect(Array.isArray(recData.records)).toBe(true);
  });

  it("5. Sesi kedaluwarsa atau token tidak valid → akses ditolak (HTTP 401)", async () => {
    // Token yang dimanipulasi
    const reqTampered = new NextRequest("http://localhost:3000/api/auth/me", {
      headers: {
        Authorization: "Bearer token_palsu_yang_dimanipulasi.header.payload.signature",
      },
    });
    const resTampered = await meHandler(reqTampered);
    expect(resTampered.status).toBe(401);

    // Token acak tanpa format JWT
    const reqInvalid = new NextRequest("http://localhost:3000/api/attendance/records", {
      headers: {
        Authorization: "Bearer random_string_not_a_jwt",
      },
    });
    const resInvalid = await recordsHandler(reqInvalid);
    expect(resInvalid.status).toBe(401);
  });

  it("6. Isolasi Pengguna: Pengguna terautentikasi tidak bisa mengakses data pengguna lain", async () => {
    // Buat User A dan User B yang terverifikasi
    const userA = userRepository.create({
      id: `usr-a-${crypto.randomUUID()}`,
      email: `usera-${crypto.randomUUID()}@maganghub.kemnaker.go.id`,
      name: "Peserta A",
      password_hash: "VERIFIED",
    });
    const userB = userRepository.create({
      id: `usr-b-${crypto.randomUUID()}`,
      email: `userb-${crypto.randomUUID()}@maganghub.kemnaker.go.id`,
      name: "Peserta B",
      password_hash: "VERIFIED",
    });

    const tokenA = await createSessionToken({ userId: userA.id, email: userA.email, name: userA.name });
    const tokenB = await createSessionToken({ userId: userB.id, email: userB.email, name: userB.name });

    // User A memiliki catatan presensi
    attendanceRepository.upsert({
      id: `att-a-1`,
      user_id: userA.id,
      attendance_date: "2026-10-10",
      status: "HADIR",
      approval_status: "APPROVED",
      source: "official_monev",
    });

    // User B mengakses catatan presensi: hanya melihat catatan milik B, tidak melihat A
    const reqB = new NextRequest("http://localhost:3000/api/attendance/records?startDate=2026-10-01&endDate=2026-10-31", {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const resB = await recordsHandler(reqB);
    const dataB = await resB.json();
    expect(dataB.records.length).toBe(0); // Kosong karena milik B belum ada

    // User A mengakses catatan presensi: melihat catatan milik A
    const reqA = new NextRequest("http://localhost:3000/api/attendance/records?startDate=2026-10-01&endDate=2026-10-31", {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const resA = await recordsHandler(reqA);
    const dataA = await resA.json();
    expect(dataA.records.length).toBe(1);
    expect(dataA.records[0].user_id).toBe(userA.id);
  });

  it("7. Logout → sesi MAA berakhir dan cookie sesi dicabut", async () => {
    const resLogout = await logoutHandler();
    expect(resLogout.status).toBe(200);

    // Cookie maa_session disetel ke maxAge: 0
    const deletedCookie = resLogout.cookies.get("maa_session");
    expect(deletedCookie).toBeDefined();
    expect(deletedCookie?.maxAge).toBe(0);

    // Permintaan berikutnya tanpa cookie ditolak
    const reqAfter = new NextRequest("http://localhost:3000/api/auth/me");
    const resAfter = await meHandler(reqAfter);
    expect(resAfter.status).toBe(401);
  });
});
