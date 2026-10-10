import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export const SESSION_COOKIE_NAME = "maa_session";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 hari

function getJwtSecret(): Uint8Array {
  const secret =
    process.env.MAA_JWT_SECRET ||
    "maa_default_development_secret_key_minimum_32_characters_long_for_safety";
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.userId && payload.email && payload.name) {
      return {
        userId: String(payload.userId),
        email: String(payload.email),
        name: String(payload.name),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(request: Request | NextRequest): Promise<SessionPayload | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const bearerToken = authHeader.substring(7).trim();
    if (bearerToken) {
      const verified = await verifySessionToken(bearerToken);
      if (verified) return verified;
    }
  }

  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));

  if (!match) return null;

  const token = match.substring(SESSION_COOKIE_NAME.length + 1);
  if (!token) return null;

  return verifySessionToken(token);
}

export function getSessionCookieOptions(): {
  name: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function setSessionCookie(response: { cookies: { set: Function } }, token: string): void {
  const options = getSessionCookieOptions();
  response.cookies.set(options.name, token, {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path,
    maxAge: options.maxAge,
  });
}
