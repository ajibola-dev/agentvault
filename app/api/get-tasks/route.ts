import { NextResponse } from "next/server";
import { tasks } from "../post-task/route";

export async function GET() {
  return NextResponse.json({ tasks });
}
