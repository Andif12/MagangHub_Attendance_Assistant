import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { validateAndNormalizeItem, processAndSaveImport, ImportedAttendanceItem } from "@/lib/monev/attendance-importer";

/**
 * Endpoint sinkronisasi presensi dari MAA Companion Extension (DOM-Only)
 * 
 * Prinsip Keamanan & Integritas:
 * 1. Menolak seluruh payload anonim (Wajib sesi MAA valid).
 * 2. Tidak mempercayai user_id atau participant_id arbitrer dari klien.
 * 3. Mengikat penyimpanan ke session.userId yang terverifikasi di server.
 * 4. Idempotent upsert tanpa memalsukan status kehadiran atau persetujuan.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !session.userId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Akses ditolak: Penyimpanan data presensi ke database Supabase memerlukan sesi MAA yang terverifikasi. Pembacaan DOM berhasil secara lokal di peramban, namun identitas belum terautentikasi di server MAA.",
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawAttendances = body.attendances || body.data || [];

    if (!Array.isArray(rawAttendances) || rawAttendances.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Payload presensi dari DOM kosong atau tidak memiliki format yang valid.",
        },
        { status: 400 }
      );
    }

    // Normalisasi dan validasi setiap catatan presensi dari DOM
    const validItems: ImportedAttendanceItem[] = [];
    const invalidItems: string[] = [];

    for (let i = 0; i < rawAttendances.length; i++) {
      const raw = rawAttendances[i];
      if (raw && typeof raw === "object") {
        const normalized = validateAndNormalizeItem(raw as Record<string, unknown>);
        if (normalized) {
          validItems.push(normalized);
        } else {
          invalidItems.push(`Item #${i + 1}: format tanggal atau status tidak sesuai.`);
        }
      }
    }

    if (validItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Tidak ada catatan presensi yang valid dari pembacaan DOM.",
          details: invalidItems,
        },
        { status: 400 }
      );
    }

    // Simpan data secara idempotent ke database pengguna yang terisolasi
    const saveResult = processAndSaveImport(
      session.userId,
      validItems,
      "MONEV_COMPANION_DOM"
    );

    return NextResponse.json({
      success: true,
      message: `Berhasil menyinkronkan ${saveResult.savedCount} catatan presensi dari DOM portal Monev.`,
      recordsSaved: saveResult.savedCount,
      newRecords: saveResult.newCount,
      updatedRecords: saveResult.updatedCount,
      duplicateRecords: saveResult.duplicateCount,
      paginationInfo: body.paginationInfo || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        error: `Gagal memproses sinkronisasi DOM: ${msg}`,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: "Metode tidak diizinkan. Gunakan POST dengan sesi MAA yang valid.",
    },
    { status: 405 }
  );
}
