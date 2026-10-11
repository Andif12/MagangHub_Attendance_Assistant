import { NextRequest, NextResponse } from "next/server";
import { investigateMonevAuth } from "@/lib/monev/auth-investigation";
import { officialMonevProvider } from "@/lib/monev/official-provider";
import { getSyncIntervalMinutes } from "@/lib/sync/sync-service";
import { getSessionFromRequest } from "@/lib/auth/session";
import { attendanceRepository, syncRunRepository } from "@/lib/db/database";

export async function GET(req: NextRequest) {
  const investigation = await investigateMonevAuth();
  const session = await getSessionFromRequest(req);

  let userMeta = null;
  let latestSyncRun = null;

  if (session?.userId) {
    userMeta = attendanceRepository.getLatestSourceInfo(session.userId);
    const runs = syncRunRepository.listByUser(session.userId, 1);
    latestSyncRun = runs.length > 0 ? runs[0] : null;
  }

  return NextResponse.json({
    success: true,
    data: {
      ...investigation,
      isAutoSyncAvailable: officialMonevProvider.isEnabled,
      syncIntervalMinutes: getSyncIntervalMinutes(),
      userMeta,
      latestSyncRun,
    },
  });
}
