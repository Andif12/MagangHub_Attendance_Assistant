import { NextResponse } from "next/server";
import { investigateMonevAuth } from "@/lib/monev/auth-investigation";

export async function GET() {
  const status = await investigateMonevAuth();
  return NextResponse.json({
    success: true,
    data: status,
  });
}
