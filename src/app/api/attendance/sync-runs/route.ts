import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { syncRunRepository } from "@/lib/db/database";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json(
      { error: "Autentikasi diperlukan. Silakan masuk terlebih dahulu." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  const runs = syncRunRepository.listByUser(session.userId, limit);

  return NextResponse.json({
    success: true,
    syncRuns: runs,
  });
}
