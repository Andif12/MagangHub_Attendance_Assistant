import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import {
  parseAttendanceText,
  processAndSaveImport,
} from "@/lib/monev/attendance-importer";

export async function POST(req: NextRequest) {
  try {
    // Keamanan Ketat: Impor hanya dapat dilakukan oleh pengguna yang telah terautentikasi
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: "Akses ditolak: Impor data presensi hanya dapat dilakukan oleh pengguna yang telah terautentikasi.",
        },
        { status: 401 }
      );
    }

    let rawContent = "";
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (file) {
        rawContent = await file.text();
      } else {
        const textParam = formData.get("content") as string | null;
        rawContent = textParam || "";
      }
    } else {
      const body = await req.json();
      if (typeof body === "string") {
        rawContent = body;
      } else {
        rawContent = body.content || JSON.stringify(body);
      }
    }

    if (!rawContent || !rawContent.trim()) {
      return NextResponse.json(
        { success: false, error: "Konten data presensi tidak boleh kosong." },
        { status: 400 }
      );
    }

    const parseResult = parseAttendanceText(rawContent);

    if (parseResult.valid.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Tidak ada data presensi valid yang berhasil dibaca dari teks/berkas.",
          details: parseResult.errors,
        },
        { status: 400 }
      );
    }

    // Simpan dan Validasi Catatan Presensi Terisolasi untuk Sesi Pengguna Ini
    const saveResult = processAndSaveImport(
      session.userId,
      parseResult.valid,
      "MANUAL_IMPORT_VERIFIED"
    );

    return NextResponse.json({
      success: true,
      message: `Berhasil mengimpor ${saveResult.savedCount} catatan presensi asli ke akun Anda (${saveResult.newCount} baru, ${saveResult.updatedCount} diperbarui, ${saveResult.duplicateCount} duplikat).`,
      recordsSaved: saveResult.savedCount,
      newRecords: saveResult.newCount,
      updatedRecords: saveResult.updatedCount,
      duplicateRecords: saveResult.duplicateCount,
      rejectedRecords: parseResult.errors.length,
      warnings: parseResult.errors.length > 0 ? parseResult.errors : undefined,
      records: saveResult.records,
      paginationInfo: parseResult.paginationInfo,
      user: {
        id: session.userId,
        name: session.name,
        email: session.email,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Gagal memproses impor: ${msg}` },
      { status: 500 }
    );
  }
}
