import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    apiKeyLength:    process.env.CIRCLE_API_KEY?.length ?? 0,
    secretLength:    process.env.CIRCLE_ENTITY_SECRET?.length ?? 0,
    apiKeyPrefix:    process.env.CIRCLE_API_KEY?.slice(0, 8) ?? "missing",
    secretPrefix:    process.env.CIRCLE_ENTITY_SECRET?.slice(0, 4) ?? "missing",
  });
}
