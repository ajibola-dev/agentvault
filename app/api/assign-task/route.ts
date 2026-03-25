import { NextResponse } from "next/server";
import { getAuthenticatedAddress, sameAddress } from "@/lib/auth";
import { assignTask, getTaskById } from "@/lib/task-repo";

export const runtime = "nodejs";

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
    const callerAddress = getAuthenticatedAddress(req);
    if (!callerAddress) {
      return NextResponse.json({ error: "Unauthorized: sign in with wallet first" }, { status: 401 });
    }

    const { taskId, agentId, agentAddress } = await req.json() as AssignTaskRequest;

    if (!taskId || !agentId) {
      return NextResponse.json({ error: "Missing taskId or agentId" }, { status: 400 });
    }

    const task = getTaskById(taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (!sameAddress(task.creatorAddress, callerAddress)) {
      return NextResponse.json({ error: "Forbidden: only task creator can assign" }, { status: 403 });
    }

    if (task.agentId) {
      return NextResponse.json({ error: "Task already assigned" }, { status: 400 });
    }

    const updatedTask = assignTask({
      id: taskId,
      agentId,
      agentAddress: agentAddress ?? null,
      assignedAt: new Date().toISOString(),
    });
    if (!updatedTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ task: updatedTask });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
