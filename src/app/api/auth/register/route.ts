import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        "Registrasi akun lokal MAA dinonaktifkan. Seluruh akses dashboard dan fitur MAA wajib menggunakan autentikasi akun resmi MagangHub / Kemnaker.",
    },
    { status: 403 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: "Registrasi lokal dinonaktifkan.",
    },
    { status: 403 }
  );
}
