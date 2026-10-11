import { NextRequest, NextResponse } from "next/server";
import { userRepository } from "@/lib/db/database";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/?auth_error=sso_rejected&message=${encodeURIComponent(error)}`, req.url)
    );
  }

  // Parameter code dan state wajib ada dari alur OAuth resmi
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/?auth_error=missing_code_or_state", req.url)
    );
  }

  try {
    // 1. Verifikasi pertukaran kode dengan server Monev Kemnaker resmi
    const exchangeUrl = `https://monev-api.maganghub.kemnaker.go.id/api/v1/auth/login/callback?code=${encodeURIComponent(
      code
    )}&state=${encodeURIComponent(state)}`;

    const res = await fetch(exchangeUrl, {
      method: "GET",
      headers: {
        "User-Agent": "MagangHub-Attendance-Assistant/0.1.0",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      return NextResponse.redirect(
        new URL(
          `/?auth_error=exchange_failed&details=${encodeURIComponent(
            `Server Monev menolak pertukaran kode otorisasi (HTTP ${res.status}).`
          )}`,
          req.url
        )
      );
    }

    const data = await res.json();
    const token = data?.access_token || data?.data?.access_token;

    if (!token) {
      return NextResponse.redirect(
        new URL(
          `/?auth_error=exchange_failed&details=${encodeURIComponent(
            data?.message || "Token akses tidak diterbitkan oleh server Monev."
          )}`,
          req.url
        )
      );
    }

    // 2. Verifikasi identitas peserta asli ke endpoint profil Monev
    const profileRes = await fetch(
      "https://monev-api.maganghub.kemnaker.go.id/api/v1/users/me",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "MagangHub-Attendance-Assistant/0.1.0",
        },
      }
    );

    if (!profileRes.ok) {
      return NextResponse.redirect(
        new URL(
          `/?auth_error=profile_failed&details=${encodeURIComponent(
            "Identitas peserta tidak dapat diverifikasi dari server Monev."
          )}`,
          req.url
        )
      );
    }

    const profileData = await profileRes.json();
    const monevUser = profileData?.data || profileData;

    // Pastikan email valid benar-benar diperoleh dari respon resmi Kemnaker
    const email = monevUser?.email;
    const name = monevUser?.name || "Peserta MagangHub";
    const externalId = monevUser?.id || monevUser?.participant_id;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.redirect(
        new URL(
          `/?auth_error=identity_missing&details=${encodeURIComponent(
            "Identitas email resmi peserta tidak ditemukan dalam respons Monev."
          )}`,
          req.url
        )
      );
    }

    // 3. Daftarkan / temukan pengguna terverifikasi di basis data lokal
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
      return NextResponse.redirect(new URL("/?auth_error=user_creation_failed", req.url));
    }

    // 4. Terbitkan sesi MAA terverifikasi
    const sessionJwt = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const response = NextResponse.redirect(new URL("/?auth_success=1", req.url));
    setSessionCookie(response, sessionJwt);

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(
      new URL(`/?auth_error=network_error&details=${encodeURIComponent(msg)}`, req.url)
    );
  }
}
