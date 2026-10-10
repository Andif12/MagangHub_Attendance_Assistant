import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { runAttendanceSync } from "@/lib/monitoring/attendance-monitor";
import { z } from "zod";

const SyncBodySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timezone: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json(
      { error: "Autentikasi diperlukan. Silakan masuk terlebih dahulu." },
      { status: 401 }
    );
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    // Body optional
  }

  const parsed = SyncBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parameter tanggal tidak valid (format wajib YYYY-MM-DD)." },
      { status: 400 }
    );
  }

  const { startDate, endDate, timezone } = parsed.data;

  const result = await runAttendanceSync({
    userId: session.userId,
    startDate,
    endDate,
    timezone,
  });

  return NextResponse.json(result);
}
