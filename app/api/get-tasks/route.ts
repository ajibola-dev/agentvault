import { NextResponse } from "next/server";
import { tasks } from "@/lib/task-store";

export async function GET() {
  return NextResponse.json({ tasks });
}
