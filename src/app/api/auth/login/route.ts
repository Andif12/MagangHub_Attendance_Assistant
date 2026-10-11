import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        "Metode login lokal mandiri dinonaktifkan. MagangHub Attendance Assistant (MAA) mewajibkan autentikasi resmi akun MagangHub / Kemnaker sebagai satu-satunya pintu masuk pengguna.",
    },
    { status: 403 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: "Metode login lokal mandiri dinonaktifkan.",
    },
    { status: 403 }
  );
}
