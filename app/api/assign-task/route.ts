import { NextResponse } from "next/server";
import { tasks } from "@/lib/task-store";

type AssignTaskRequest = {
  taskId?: string;
  agentId?: string;
  agentAddress?: string | null;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(req: Request) {
  try {
    const { taskId, agentId, agentAddress } = await req.json() as AssignTaskRequest;

    if (!taskId || !agentId) {
      return NextResponse.json({ error: "Missing taskId or agentId" }, { status: 400 });
    }

    const task = tasks.find((t) => t.id === taskId);
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
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
