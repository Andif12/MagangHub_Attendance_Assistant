import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { attendanceRepository } from "@/lib/db/database";
import { normalizeDateToTimezone } from "@/lib/monitoring/attendance-monitor";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json(
      { error: "Autentikasi diperlukan. Silakan masuk terlebih dahulu." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const tz = searchParams.get("timezone") || process.env.DEFAULT_TIMEZONE || "Asia/Makassar";
  const today = normalizeDateToTimezone(undefined, tz);

  const startDate = searchParams.get("startDate") || today.slice(0, 7) + "-01";
  const endDate = searchParams.get("endDate") || today;
  const statusFilter = searchParams.get("status") || "ALL";

  const records = attendanceRepository.findByUserAndDateRange(
    session.userId,
    startDate,
    endDate,
    statusFilter
  );

  const latest = attendanceRepository.findLatestByUser(session.userId);

  return NextResponse.json({
    success: true,
    records,
    latestRecord: latest,
    dateRange: { startDate, endDate },
  });
}
