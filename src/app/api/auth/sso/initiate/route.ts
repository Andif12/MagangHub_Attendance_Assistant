import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  const correlationId = `sso-${crypto.randomUUID().slice(0, 8)}`;
  console.log(`[MAA_SSO_DIAGNOSTIC][${correlationId}] TAHAP: SSO_INITIATE_START | Status: PROCEEDING`);

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
    const hasRedirectUrl = bodyText.startsWith("http");
    const hasSetCookie = Boolean(setCookie);

    console.log(
      `[MAA_SSO_DIAGNOSTIC][${correlationId}] TAHAP: MONEV_LOGIN_RESPONSE | HTTP: ${res.status} | hasRedirectUrl: ${hasRedirectUrl} | hasSetCookie: ${hasSetCookie}`
    );

    if (res.status === 201 && hasRedirectUrl) {
      // Analisis Diagnostik Kritis:
      // Set-Cookie 'monev_oauth_state' diterbitkan oleh domain monev-api ke server MAA (bukan ke browser pengguna).
      console.log(
        `[MAA_SSO_DIAGNOSTIC][${correlationId}] DIAGNOSIS: Cookie monev_oauth_state diterima oleh server backend MAA, BUKAN oleh domain browser pengguna di kemnaker.go.id (Cookie Domain Isolation).`
      );

      return NextResponse.json({
        success: true,
        redirectUrl: bodyText.trim(),
        correlationId,
        status: res.status,
      });
    }

    console.log(
      `[MAA_SSO_DIAGNOSTIC][${correlationId}] TAHAP: SSO_INITIATE_FAIL | Kategori: UPSTREAM_REJECTION | HTTP: ${res.status}`
    );

    return NextResponse.json(
      {
        success: false,
        error: `Server Monev mengembalikan status HTTP ${res.status}.`,
        correlationId,
      },
      { status: 502 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.name : "UNKNOWN_ERROR";
    console.log(
      `[MAA_SSO_DIAGNOSTIC][${correlationId}] TAHAP: SSO_INITIATE_ERROR | Kategori: NETWORK_TIMEOUT_ERROR | Info: ${msg}`
    );

    return NextResponse.json(
      {
        success: false,
        error: `Gagal menghubungi endpoint auth Monev (${msg}).`,
        correlationId,
      },
      { status: 502 }
    );
  }
}
