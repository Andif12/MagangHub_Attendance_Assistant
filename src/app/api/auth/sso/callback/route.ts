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

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/?auth_error=missing_code_or_state", req.url)
    );
  }

  try {
    // Attempt code exchange with Monev API
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

    const data = await res.json();
    const token = data?.access_token || data?.data?.access_token;

    if (!token) {
      return NextResponse.redirect(
        new URL(
          `/?auth_error=exchange_failed&details=${encodeURIComponent(
            data?.message || "Monev API menolak kode otorisasi."
          )}`,
          req.url
        )
      );
    }

    // Fetch user profile using the acquired access token
    const profileRes = await fetch(
      "https://monev-api.maganghub.kemnaker.go.id/api/v1/users/me",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "MagangHub-Attendance-Assistant/0.1.0",
        },
      }
    );

    const profileData = await profileRes.json();
    const monevUser = profileData?.data || profileData;

    const email = monevUser?.email || `participant_${code.slice(0, 8)}@maganghub.kemnaker.go.id`;
    const name = monevUser?.name || "Peserta MagangHub";
    const participantId = monevUser?.id || monevUser?.participant_id || code.slice(0, 12);

    let user = userRepository.findByEmail(email);
    if (!user) {
      const created = userRepository.create({
        id: crypto.randomUUID(),
        email,
        name,
        password_hash: "MONEV_SSO_AUTHENTICATED",
      });
      user = userRepository.findByEmail(created.email);
    }

    if (!user) {
      return NextResponse.redirect(new URL("/?auth_error=user_creation_failed", req.url));
    }

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
