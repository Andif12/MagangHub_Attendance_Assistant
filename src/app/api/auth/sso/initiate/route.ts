import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://monev-api.maganghub.kemnaker.go.id/api/v1/auth/login", {
      method: "GET",
      headers: {
        "User-Agent": "MagangHub-Attendance-Assistant/0.1.0",
        Accept: "text/plain, application/json, */*",
      },
    });

    const bodyText = await res.text();
    const setCookie = res.headers.get("set-cookie");

    if (res.status === 201 && bodyText.startsWith("http")) {
      const response = NextResponse.json({
        success: true,
        redirectUrl: bodyText.trim(),
        status: res.status,
      });

      // Forward the oauth state cookie if present
      if (setCookie) {
        response.headers.set("x-monev-cookie", setCookie);
      }

      return response;
    }

    return NextResponse.json(
      {
        success: false,
        error: `Server Monev mengembalikan status ${res.status}: ${bodyText.slice(0, 200)}`,
      },
      { status: 502 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        error: `Gagal menghubungi endpoint auth Monev: ${msg}`,
      },
      { status: 502 }
    );
  }
}
