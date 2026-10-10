import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { userRepository, notificationRepository } from "@/lib/db/database";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { createSessionToken, getSessionCookieOptions } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/auth/rate-limiter";

const RegisterSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
  email: z.string().trim().email("Format email tidak valid").max(255),
  password: z.string().min(8, "Kata sandi minimal 8 karakter"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "local";
    const rateLimit = checkRateLimit(`register:${ip}`, 5, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Terlalu banyak permintaan pendaftaran. Silakan coba lagi nanti.",
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Input tidak valid";
      return NextResponse.json({ error: firstIssue }, { status: 400 });
    }

    const { name, email, password } = parsed.data;

    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      return NextResponse.json({ error: strength.message }, { status: 400 });
    }

    const existing = userRepository.findByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar. Silakan masuk menggunakan akun Anda." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();

    const newUser = userRepository.create({
      id: userId,
      name,
      email,
      password_hash: passwordHash,
    });

    notificationRepository.getPreferences(userId);

    const sessionToken = await createSessionToken({
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
    });

    const cookieOptions = getSessionCookieOptions();

    const response = NextResponse.json(
      {
        success: true,
        message: "Pendaftaran berhasil.",
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
        },
      },
      { status: 201 }
    );

    response.cookies.set(cookieOptions.name, sessionToken, cookieOptions);
    return response;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Terjadi kesalahan pada server.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
