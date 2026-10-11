import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { generateImportPreview } from "@/lib/monev/attendance-importer";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    const userId = session?.userId || null;

    let rawContent = "";
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (file) {
        rawContent = await file.text();
      } else {
        const textParam = formData.get("content") as string | null;
        rawContent = textParam || "";
      }
    } else {
      const body = await req.json().catch(() => ({}));
      if (typeof body === "string") {
        rawContent = body;
      } else {
        rawContent = body.content || (Object.keys(body).length > 0 ? JSON.stringify(body) : "");
      }
    }

    if (!rawContent || !rawContent.trim()) {
      return NextResponse.json(
        { success: false, error: "Konten data presensi JSON tidak boleh kosong. Silakan tempelkan respons dari GET /api/v1/attendances." },
        { status: 400 }
      );
    }

    const preview = generateImportPreview(userId, rawContent);

    return NextResponse.json({
      success: true,
      preview,
      isAuthenticated: Boolean(userId),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Gagal memproses pratinjau data: ${msg}` },
      { status: 500 }
    );
  }
}
