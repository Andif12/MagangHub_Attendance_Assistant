import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as importHandler } from "../src/app/api/attendance/import/route";
import { POST as previewHandler } from "../src/app/api/attendance/import/preview/route";
import { GET as recordsHandler } from "../src/app/api/attendance/records/route";
import { GET as meHandler } from "../src/app/api/auth/me/route";
import { createSessionToken } from "../src/lib/auth/session";
import { userRepository, attendanceRepository } from "../src/lib/db/database";
import crypto from "crypto";

describe("Pengujian Wajib Opsi A: Web-Only dengan Impor Manual Data Presensi", () => {
  let userA: { id: string; email: string; name: string; token: string };
  let userB: { id: string; email: string; name: string; token: string };

  beforeEach(async () => {
    // Setup Pengguna A
    const aId = `user-a-${crypto.randomUUID()}`;
    const aEmail = `user-a-${crypto.randomUUID()}@example.com`;
    const createdA = userRepository.create({
      id: aId,
      email: aEmail,
      name: "Pengguna A",
      password_hash: "HASH_A",
    });
    const tokenA = await createSessionToken({
      userId: createdA.id,
      email: createdA.email,
      name: createdA.name,
    });
    userA = { id: createdA.id, email: createdA.email, name: createdA.name, token: tokenA };

    // Setup Pengguna B
    const bId = `user-b-${crypto.randomUUID()}`;
    const bEmail = `user-b-${crypto.randomUUID()}@example.com`;
    const createdB = userRepository.create({
      id: bId,
      email: bEmail,
      name: "Pengguna B",
      password_hash: "HASH_B",
    });
    const tokenB = await createSessionToken({
      userId: createdB.id,
      email: createdB.email,
      name: createdB.name,
    });
    userB = { id: createdB.id, email: createdB.email, name: createdB.name, token: tokenB };
  });

  it("1. Pengguna yang belum login TIDAK dapat mengimpor data atau melihat pratinjau (HTTP 401)", async () => {
    // Coba import tanpa sesi
    const reqImport = new NextRequest("http://localhost:3000/api/attendance/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: JSON.stringify({
          data: [{ date: "2026-10-09", status: "PRESENT", approval_status: "APPROVED" }],
        }),
      }),
    });
    const resImport = await importHandler(reqImport);
    expect(resImport.status).toBe(401);
    const jsonImport = await resImport.json();
    expect(jsonImport.error).toContain("Akses ditolak");

    // Coba preview tanpa sesi
    const reqPreview = new NextRequest("http://localhost:3000/api/attendance/import/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: JSON.stringify({
          data: [{ date: "2026-10-09", status: "PRESENT" }],
        }),
      }),
    });
    const resPreview = await previewHandler(reqPreview);
    expect(resPreview.status).toBe(200);
    const jsonPreview = await resPreview.json();
    expect(jsonPreview.isAuthenticated).toBe(false);
  });

  it("2. Isolasi Pengguna: Pengguna A tidak dapat mengakses data pengguna B", async () => {
    // Pengguna A mengimpor data presensi miliknya
    const payloadA = {
      data: [
        { date: "2026-10-01", status: "PRESENT", approval_status: "APPROVED", notes: "Catatan Rahasia A" },
      ],
    };
    const reqImportA = new NextRequest("http://localhost:3000/api/attendance/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({ content: JSON.stringify(payloadA) }),
    });
    const resImportA = await importHandler(reqImportA);
    expect(resImportA.status).toBe(200);

    // Pengguna B memeriksa endpoint records miliknya
    const reqGetB = new NextRequest(
      "http://localhost:3000/api/attendance/records?startDate=2026-10-01&endDate=2026-10-31",
      {
        headers: { Authorization: `Bearer ${userB.token}` },
      }
    );
    const resGetB = await recordsHandler(reqGetB);
    const dataB = await resGetB.json();
    expect(resGetB.status).toBe(200);
    expect(dataB.records.length).toBe(0); // Pengguna B tidak melihat apapun dari Pengguna A

    // Pengguna A memeriksa endpoint records miliknya
    const reqGetA = new NextRequest(
      "http://localhost:3000/api/attendance/records?startDate=2026-10-01&endDate=2026-10-31",
      {
        headers: { Authorization: `Bearer ${userA.token}` },
      }
    );
    const resGetA = await recordsHandler(reqGetA);
    const dataA = await resGetA.json();
    expect(dataA.records.length).toBe(1);
    expect(dataA.records[0].user_id).toBe(userA.id);
    expect(dataA.records[0].notes).toBe("Catatan Rahasia A");
  });

  it("3. Format berkas tidak valid atau kosong ditolak secara jelas (HTTP 400)", async () => {
    // A. Konten kosong
    const reqEmpty = new NextRequest("http://localhost:3000/api/attendance/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({ content: "   " }),
    });
    const resEmpty = await importHandler(reqEmpty);
    expect(resEmpty.status).toBe(400);
    const jsonEmpty = await resEmpty.json();
    expect(jsonEmpty.error).toContain("tidak boleh kosong");

    // B. JSON rusak
    const reqMalformed = new NextRequest("http://localhost:3000/api/attendance/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({ content: "{ invalid json format }" }),
    });
    const resMalformed = await importHandler(reqMalformed);
    expect(resMalformed.status).toBe(400);
    const jsonMalformed = await resMalformed.json();
    expect(jsonMalformed.details).toBeDefined();

    // C. Pratinjau untuk format rusak juga mengembalikan error
    const reqPreview = new NextRequest("http://localhost:3000/api/attendance/import/preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({ content: "{ broken json" }),
    });
    const resPreview = await previewHandler(reqPreview);
    expect(resPreview.status).toBe(200);
    const previewJson = await resPreview.json();
    expect(previewJson.preview.validRows).toBe(0);
    expect(previewJson.preview.errors.length).toBeGreaterThan(0);
  });

  it("4. Idempotensi & Deduplikasi: Mengimpor data yang sama tidak menggandakan catatan (Upsert)", async () => {
    const payload = {
      data: [
        { date: "2026-10-08", status: "PRESENT", approval_status: "APPROVED" },
        { date: "2026-10-09", status: "PRESENT", approval_status: "APPROVED" },
      ],
    };

    // Impor pertama
    const req1 = new NextRequest("http://localhost:3000/api/attendance/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({ content: JSON.stringify(payload) }),
    });
    const res1 = await importHandler(req1);
    const data1 = await res1.json();
    expect(data1.recordsSaved).toBe(2);
    expect(data1.newRecords).toBe(2);

    // Pratinjau impor kedua: mendeteksi 2 duplikat
    const reqPreview = new NextRequest("http://localhost:3000/api/attendance/import/preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({ content: JSON.stringify(payload) }),
    });
    const resPreview = await previewHandler(reqPreview);
    const dataPreview = await resPreview.json();
    expect(dataPreview.preview.validRows).toBe(2);
    expect(dataPreview.preview.newCount).toBe(0);
    expect(dataPreview.preview.duplicateCount).toBe(2);

    // Impor kedua dengan data persis sama
    const req2 = new NextRequest("http://localhost:3000/api/attendance/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({ content: JSON.stringify(payload) }),
    });
    const res2 = await importHandler(req2);
    const data2 = await res2.json();
    expect(data2.recordsSaved).toBe(2);
    expect(data2.duplicateRecords).toBe(2);
    expect(data2.newRecords).toBe(0);

    // Periksa total record di DB: tetap 2 catatan, tidak menjadi 4!
    const reqRecords = new NextRequest(
      "http://localhost:3000/api/attendance/records?startDate=2026-10-01&endDate=2026-10-31",
      {
        headers: { Authorization: `Bearer ${userA.token}` },
      }
    );
    const resRecords = await recordsHandler(reqRecords);
    const recordsJson = await resRecords.json();
    expect(recordsJson.records.length).toBe(2);
  });

  it("5. Status Submitted dan Approved TIDAK tercampur & tidak memalsukan status", async () => {
    const csvContent = `date,status,approval_status,notes
2026-10-01,PRESENT,APPROVED,Telah disetujui
2026-10-02,PRESENT,SUBMITTED,Menunggu review mentor
2026-10-03,ON_LEAVE,PENDING,Pengajuan izin
2026-10-04,ABSENT,,Tanpa keterangan persetujuan`;

    const req = new NextRequest("http://localhost:3000/api/attendance/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({ content: csvContent }),
    });
    const res = await importHandler(req);
    expect(res.status).toBe(200);

    const reqRecords = new NextRequest(
      "http://localhost:3000/api/attendance/records?startDate=2026-10-01&endDate=2026-10-31",
      {
        headers: { Authorization: `Bearer ${userA.token}` },
      }
    );
    const resRecords = await recordsHandler(reqRecords);
    const data = await resRecords.json();

    const rec01 = data.records.find((r: any) => r.attendance_date === "2026-10-01");
    const rec02 = data.records.find((r: any) => r.attendance_date === "2026-10-02");
    const rec03 = data.records.find((r: any) => r.attendance_date === "2026-10-03");
    const rec04 = data.records.find((r: any) => r.attendance_date === "2026-10-04");

    expect(rec01.approval_status).toBe("APPROVED");
    expect(rec02.approval_status).toBe("SUBMITTED");
    expect(rec03.approval_status).toBe("SUBMITTED");
    // Tidak diubah menjadi APPROVED jika di sumber tidak ada persetujuan
    expect(rec04.approval_status).toBeNull();
  });

  it("6. TIDAK ADA sesi yang dibuat dari proses impor (Impor tidak memalsukan autentikasi)", async () => {
    // Pengguna belum login mencoba mengirim data impor dengan info profil fiktif di dalam payload
    const spoofPayload = {
      user: {
        id: "attacker-id-12345",
        email: "attacker@spoof.com",
        name: "Attacker Spoofed",
      },
      data: [{ date: "2026-10-09", status: "PRESENT" }],
    };

    const req = new NextRequest("http://localhost:3000/api/attendance/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: JSON.stringify(spoofPayload) }),
    });

    const res = await importHandler(req);
    // Ditolak 401 karena tidak ada sesi valid
    expect(res.status).toBe(401);

    // Cookie maa_session tidak diterbitkan
    expect(res.cookies.get("maa_session")).toBeUndefined();

    // Verifikasi endpoint /api/auth/me tetap 401
    const reqMe = new NextRequest("http://localhost:3000/api/auth/me");
    const resMe = await meHandler(reqMe);
    expect(resMe.status).toBe(401);
  });
});
