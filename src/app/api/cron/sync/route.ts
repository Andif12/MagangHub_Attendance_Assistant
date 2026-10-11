import { NextRequest, NextResponse } from "next/server";
import { runScheduledSync, getSyncIntervalMinutes } from "@/lib/sync/sync-service";

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // Jika CRON_SECRET dikonfigurasi di environment, verifikasi ketat wajib lolos
  if (cronSecret && cronSecret.trim().length > 0) {
    const authHeader = req.headers.get("authorization") || "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    return bearerToken === cronSecret.trim();
  }

  // Jika CRON_SECRET belum diset dan berada di lingkungan non-production, izinkan untuk pengujian lokal
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  // Di lingkungan production tanpa CRON_SECRET yang disetel, tolak demi keamanan
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      {
        error: "Akses ditolak: Kredensial otorisasi cron (CRON_SECRET) tidak valid atau belum dikonfigurasi.",
      },
      { status: 401 }
    );
  }

  try {
    const result = await runScheduledSync();
    return NextResponse.json(result, { status: result.success || result.skipped ? 200 : 207 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: `Gagal menjalankan job cron sinkronisasi: ${msg}`,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
