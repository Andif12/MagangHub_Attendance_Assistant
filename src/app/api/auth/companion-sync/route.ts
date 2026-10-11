import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  // Verifikasi sesi resmi: Tolak pembuatan sesi lokal tanpa autentikasi MagangHub
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Akses ditolak: Pembuatan sesi mandiri tanpa autentikasi MagangHub dinonaktifkan. Pengguna wajib terautentikasi melalui login resmi MagangHub / Kemnaker.",
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: false,
    error: "Endpoint sinkronisasi mandiri telah digantikan oleh autentikasi terpadu MagangHub.",
  }, { status: 403 });
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: "Metode tidak diizinkan.",
    },
    { status: 405 }
  );
}
