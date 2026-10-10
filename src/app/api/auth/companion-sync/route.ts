import { NextRequest, NextResponse } from "next/server";
import {
  userRepository,
  attendanceRepository,
  syncRunRepository,
  notificationRepository,
} from "@/lib/db/database";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import crypto from "crypto";

interface CompanionSyncPayload {
  user: {
    id: string;
    name: string;
    email: string;
  };
  attendances?: Array<{
    id?: string;
    date: string;
    status: string;
    approval_status?: string | null;
    created_at?: string;
    updated_at?: string;
  }>;
}

function getCorsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(req),
  });
}

export async function POST(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  try {
    let body: CompanionSyncPayload;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Payload JSON tidak valid." },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!body?.user?.email || !body?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Identitas pengguna MagangHub tidak lengkap (email dan ID peserta wajib).",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const { email, name, id: participantId } = body.user;

    // 1. Dapatkan atau buat pengguna MagangHub asli di DB
    let user = userRepository.findByEmail(email);
    if (!user) {
      const created = userRepository.create({
        id: crypto.randomUUID(),
        email,
        name: name || "Peserta MagangHub",
        password_hash: "COMPANION_AUTHENTICATED",
      });
      user = userRepository.findByEmail(created.email);
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Gagal membuat sesi pengguna di database." },
        { status: 500, headers: corsHeaders }
      );
    }

    // 2. Simpan catatan absensi asli jika disertakan
    let savedCount = 0;
    if (Array.isArray(body.attendances) && body.attendances.length > 0) {
      for (const item of body.attendances) {
        if (!item.date || !item.status) continue;
        const normalizedStatus = String(item.status).toUpperCase().trim();
        const normalizedApproval = item.approval_status
          ? String(item.approval_status).toUpperCase().trim()
          : null;

        attendanceRepository.upsert({
          id: item.id || crypto.randomUUID(),
          user_id: user.id,
          attendance_date: item.date,
          status: normalizedStatus,
          approval_status: normalizedApproval,
          source: "MONEV_COMPANION_LIVE",
          source_updated_at: item.updated_at || item.created_at || new Date().toISOString(),
          raw_response: JSON.stringify(item),
          notes: `Disinkronkan langsung dari portal Monev MagangHub (${participantId})`,
        });
        savedCount++;
      }
    }

    // 3. Catat audit sync run
    const runId = crypto.randomUUID();
    syncRunRepository.create({
      id: runId,
      user_id: user.id,
      started_at: new Date().toISOString(),
      result: "SUCCESS",
      error_code: null,
      records_checked: savedCount,
      message: `Berhasil menyinkronkan ${savedCount} catatan absensi asli dari Monev MagangHub.`,
    });

    // 4. Periksa notifikasi absensi belum terdeteksi untuk hari ini jika tidak ada record
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(new Date());
    const todayRecords = attendanceRepository.findByUserAndDateRange(user.id, today, today);
    if (!todayRecords || todayRecords.length === 0) {
      notificationRepository.create({
        id: crypto.randomUUID(),
        user_id: user.id,
        type: "ATTENDANCE_MISSING",
        message: `Absensi tanggal ${today} belum terdeteksi di portal Monev MagangHub. Mohon periksa pengisian presensi Anda.`,
      });
    }

    // 5. Buat token sesi MAA dan set cookie
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const response = NextResponse.json(
      {
        success: true,
        message: `Berhasil menghubungkan sesi MagangHub untuk ${user.name} (${user.email}) dan menyinkronkan ${savedCount} absensi asli.`,
        token,
        recordsSaved: savedCount,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      },
      { headers: corsHeaders }
    );

    setSessionCookie(response, token);
    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Gagal memproses sinkronisasi: ${msg}` },
      { status: 500, headers: corsHeaders }
    );
  }
}
