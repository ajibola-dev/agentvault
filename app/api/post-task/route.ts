import { NextResponse } from "next/server";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const tasks: any[] = [];

export async function POST(req: Request) {
  try {
    const { title, description, reward, agentId } = await req.json();

    if (!title || !description || !reward) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const task = {
      id: crypto.randomUUID(),
      title,
      description,
      reward,
      agentId: agentId ?? null,
      status: "open",
      createdAt: new Date().toISOString(),
    };

    tasks.push(task);

    return NextResponse.json({ task });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ tasks });
}
