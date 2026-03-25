import { NextResponse } from "next/server";
import { getAuthenticatedAddress, sameAddress } from "@/lib/auth";
import { getTaskById, updateTaskStatus } from "@/lib/task-repo";
import type { Task } from "@/lib/task-store";

export const runtime = "nodejs";

type UpdateTaskStatusRequest = {
  taskId?: string;
  status?: Task["status"];
};

function isAssignedAgent(task: Task, callerAddress: string): boolean {
  return Boolean(task.agentAddress && sameAddress(task.agentAddress, callerAddress));
}

function canTransition(task: Task, nextStatus: Task["status"], callerAddress: string): boolean {
  const isCreator = sameAddress(task.creatorAddress, callerAddress);
  const isAgent = isAssignedAgent(task, callerAddress);

  if (task.status === "assigned" && nextStatus === "in_progress") {
    return isAgent;
  }

  if (task.status === "in_progress" && nextStatus === "completed") {
    return isAgent;
  }

  if (task.status === "completed" && nextStatus === "paid") {
    return isCreator;
  }

  return false;
}

export async function POST(req: Request) {
  try {
    const callerAddress = getAuthenticatedAddress(req);
    if (!callerAddress) {
      return NextResponse.json({ error: "Unauthorized: sign in with wallet first" }, { status: 401 });
    }

    const { taskId, status } = await req.json() as UpdateTaskStatusRequest;

    if (!taskId || !status) {
      return NextResponse.json({ error: "Missing taskId or status" }, { status: 400 });
    }

    if (status === "open" || status === "assigned") {
      return NextResponse.json({ error: "Invalid target status" }, { status: 400 });
    }

    const task = getTaskById(taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (!canTransition(task, status, callerAddress)) {
      return NextResponse.json({ error: "Forbidden: invalid transition for caller" }, { status: 403 });
    }

    const updated = updateTaskStatus(task.id, status);
    if (!updated) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ task: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update task status" }, { status: 500 });
  }
}
