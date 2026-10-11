import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { userRepository } from "@/lib/db/database";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, getSessionCookieOptions } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/auth/rate-limiter";

const LoginSchema = z.object({
  email: z.string().trim().email("Format email tidak valid").max(255),
  password: z.string().min(1, "Kata sandi wajib diisi"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "local";
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
    }

    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Email atau kata sandi tidak valid." },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const rateLimitKey = `login:${ip}:${email.toLowerCase()}`;
    const rateLimit = checkRateLimit(rateLimitKey, 5, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Terlalu banyak percobaan login yang gagal. Silakan coba lagi dalam beberapa saat.",
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    const user = userRepository.findByEmail(email);
    if (!user) {
      // Mitigasi serangan timing attack
      await verifyPassword(
        password,
        "$2a$12$e80yq7K27hXyE3G5b9HqOeXJtZ12c6f10g5h6j7k8l9m0n1o2p3q."
      );
      return NextResponse.json(
        { error: "Email atau kata sandi tidak valid." },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Email atau kata sandi tidak valid." },
        { status: 401 }
      );
    }

    const sessionToken = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const cookieOptions = getSessionCookieOptions();

    const response = NextResponse.json({
      success: true,
      message: "Berhasil masuk ke akun MAA.",
      token: sessionToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });

    response.cookies.set(cookieOptions.name, sessionToken, cookieOptions);
    return response;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Terjadi kesalahan pada server.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
