import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { notificationRepository } from "@/lib/db/database";
import { z } from "zod";

const ReadSchema = z.object({
  notificationId: z.string().optional(),
  all: z.boolean().optional(),
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

  const parsed = ReadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input tidak valid." }, { status: 400 });
  }

  if (parsed.data.all) {
    const updatedCount = notificationRepository.markAllAsRead(session.userId);
    return NextResponse.json({ success: true, updatedCount });
  }

  if (parsed.data.notificationId) {
    const success = notificationRepository.markAsRead(parsed.data.notificationId, session.userId);
    return NextResponse.json({ success });
  }

  return NextResponse.json({ error: "Parameter tidak lengkap." }, { status: 400 });
}
