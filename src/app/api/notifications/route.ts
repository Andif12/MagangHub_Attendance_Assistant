import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { notificationRepository } from "@/lib/db/database";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json(
      { error: "Autentikasi diperlukan. Silakan masuk terlebih dahulu." },
      { status: 401 }
    );
  }

  const notifications = notificationRepository.listByUser(session.userId, 50);
  const unreadCount = notificationRepository.getUnreadCount(session.userId);
  const preferences = notificationRepository.getPreferences(session.userId);

  return NextResponse.json({
    success: true,
    notifications,
    unreadCount,
    preferences,
  });
}
