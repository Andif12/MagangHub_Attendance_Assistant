import { NextRequest, NextResponse } from "next/server";
import { userRepository } from "@/lib/db/database";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const correlationId = `sso-${crypto.randomUUID().slice(0, 8)}`;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const hasCode = Boolean(code);
  const hasState = Boolean(state);
  const hasError = Boolean(error);

  console.log(
    `[MAA_SSO_DIAGNOSTIC][${correlationId}] TAHAP: SSO_CALLBACK_ENTRY | hasCode: ${hasCode} | hasState: ${hasState} | hasError: ${hasError}`
  );

  if (error) {
    console.log(
      `[MAA_SSO_DIAGNOSTIC][${correlationId}] TAHAP: SSO_CALLBACK_ABORT | Kategori: PROVIDER_ERROR_RETURNED`
    );
    return NextResponse.redirect(
      new URL(`/?auth_error=sso_rejected&correlation_id=${correlationId}`, req.url)
    );
  }

  // Parameter code dan state wajib ada dari alur OAuth resmi
  if (!code || !state) {
    console.log(
      `[MAA_SSO_DIAGNOSTIC][${correlationId}] TAHAP: SSO_CALLBACK_ABORT | Kategori: MISSING_CODE_OR_STATE`
    );
    return NextResponse.redirect(
      new URL(`/?auth_error=missing_code_or_state&correlation_id=${correlationId}`, req.url)
    );
  }

  try {
    // 1. Verifikasi pertukaran kode dengan server Monev Kemnaker resmi
    const exchangeUrl = `https://monev-api.maganghub.kemnaker.go.id/api/v1/auth/login/callback?code=${encodeURIComponent(
      code
    )}&state=${encodeURIComponent(state)}`;

    console.log(
      `[MAA_SSO_DIAGNOSTIC][${correlationId}] TAHAP: MONEV_CODE_EXCHANGE_START | Target: monev-api /api/v1/auth/login/callback`
    );

    const res = await fetch(exchangeUrl, {
      method: "GET",
      headers: {
        "User-Agent": "MagangHub-Attendance-Assistant/0.1.0",
        Accept: "application/json",
      },
    });

    console.log(
      `[MAA_SSO_DIAGNOSTIC][${correlationId}] TAHAP: MONEV_CODE_EXCHANGE_RESULT | HTTP: ${res.status}`
    );

    if (!res.ok) {
      console.log(
        `[MAA_SSO_DIAGNOSTIC][${correlationId}] TAHAP: SSO_CALLBACK_FAIL | Kategori: CODE_EXCHANGE_REJECTED | HTTP: ${res.status}`
      );
      return NextResponse.redirect(
        new URL(
          `/?auth_error=exchange_failed&correlation_id=${correlationId}`,
          req.url
        )
      );
    }

    const data = await res.json();
    const token = data?.access_token || data?.data?.access_token;
    const hasToken = Boolean(token);

    console.log(
      `[MAA_SSO_DIAGNOSTIC][${correlationId}] TAHAP: MONEV_TOKEN_PARSED | hasToken: ${hasToken}`
    );

    if (!token) {
      console.log(
        `[MAA_SSO_DIAGNOSTIC][${correlationId}] TAHAP: SSO_CALLBACK_FAIL | Kategori: EMPTY_TOKEN_IN_RESPONSE`
      );
      return NextResponse.redirect(
        new URL(
          `/?auth_error=exchange_failed&correlation_id=${correlationId}`,
          req.url
        )
      );
    }

    // 2. Verifikasi identitas peserta asli ke endpoint profil Monev
    console.log(
      `[MAA_SSO_DIAGNOSTIC][${correlationId}] TAHAP: VERIFY_PROFILE_START | Target: monev-api /api/v1/users/me`
    );

    const profileRes = await fetch(
      "https://monev-api.maganghub.kemnaker.go.id/api/v1/users/me",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "MagangHub-Attendance-Assistant/0.1.0",
        },
      }
    );

    console.log(
      `[MAA_SSO_DIAGNOSTIC][${correlationId}] TAHAP: VERIFY_PROFILE_RESULT | HTTP: ${profileRes.status}`
    );

    if (!profileRes.ok) {
      console.log(
        `[MAA_SSO_DIAGNOSTIC][${correlationId}] TAHAP: SSO_CALLBACK_FAIL | Kategori: PROFILE_VERIFY_REJECTED | HTTP: ${profileRes.status}`
      );
      return NextResponse.redirect(
        new URL(
          `/?auth_error=profile_failed&correlation_id=${correlationId}`,
          req.url
        )
      );
    }

    const profileData = await profileRes.json();
    const monevUser = profileData?.data || profileData;

    const email = monevUser?.email;
    const name = monevUser?.name || "Peserta MagangHub";
    const externalId = monevUser?.id || monevUser?.participant_id;
    const hasValidEmail = Boolean(email && typeof email === "string" && email.includes("@"));

    console.log(
      `[MAA_SSO_DIAGNOSTIC][${correlationId}] TAHAP: IDENTITY_PARSED | hasValidEmail: ${hasValidEmail} | hasExternalId: ${Boolean(externalId)}`
    );

    if (!hasValidEmail) {
      console.log(
        `[MAA_SSO_DIAGNOSTIC][${correlationId}] TAHAP: SSO_CALLBACK_FAIL | Kategori: IDENTITY_EMAIL_MISSING`
      );
      return NextResponse.redirect(
        new URL(
          `/?auth_error=identity_missing&correlation_id=${correlationId}`,
          req.url
        )
      );
    }

    // 3. Daftarkan / temukan pengguna terverifikasi di basis data
    let user = userRepository.findByEmail(email);
    if (!user) {
      const created = userRepository.create({
        id: externalId || crypto.randomUUID(),
        email,
        name,
        password_hash: "MONEV_SSO_VERIFIED",
      });
      user = userRepository.findByEmail(created.email);
    }

    if (!user) {
      console.log(
        `[MAA_SSO_DIAGNOSTIC][${correlationId}] TAHAP: SSO_CALLBACK_FAIL | Kategori: DATABASE_USER_CREATION_FAILED`
      );
      return NextResponse.redirect(new URL(`/?auth_error=user_creation_failed&correlation_id=${correlationId}`, req.url));
    }

    // 4. Terbitkan sesi MAA terverifikasi
    const sessionJwt = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    console.log(
      `[MAA_SSO_DIAGNOSTIC][${correlationId}] TAHAP: SSO_COMPLETE_SUCCESS | Sesi Diterbitkan: true`
    );

    const response = NextResponse.redirect(new URL("/?auth_success=1", req.url));
    setSessionCookie(response, sessionJwt);

    return response;
  } catch (err: unknown) {
    const errorType = err instanceof Error ? err.name : "UNKNOWN_EXCEPTION";
    console.log(
      `[MAA_SSO_DIAGNOSTIC][${correlationId}] TAHAP: SSO_CALLBACK_EXCEPTION | Kategori: NETWORK_OR_SYSTEM_ERROR | Info: ${errorType}`
    );
    return NextResponse.redirect(
      new URL(`/?auth_error=network_error&correlation_id=${correlationId}`, req.url)
    );
  }
}
