import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ tasks: [], message: "Task registry live" });
}
