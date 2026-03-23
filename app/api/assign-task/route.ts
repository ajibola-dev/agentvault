import { NextResponse } from "next/server";
import { tasks } from "../post-task/route";

export async function POST(req: Request) {
  try {
    const { taskId, agentId, agentAddress } = await req.json();

    if (!taskId || !agentId) {
      return NextResponse.json({ error: "Missing taskId or agentId" }, { status: 400 });
    }

    const task = tasks.find((t: any) => t.id === taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (task.agentId) {
      return NextResponse.json({ error: "Task already assigned" }, { status: 400 });
    }

    task.agentId      = agentId;
    task.agentAddress = agentAddress ?? null;
    task.status       = "assigned";
    task.assignedAt   = new Date().toISOString();

    return NextResponse.json({ task });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
