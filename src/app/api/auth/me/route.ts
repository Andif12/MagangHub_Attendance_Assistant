import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { userRepository } from "@/lib/db/database";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Sesi tidak ditemukan atau kedaluwarsa." }, { status: 401 });
  }

  const user = userRepository.findById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      created_at: user.created_at,
    },
  });
}
