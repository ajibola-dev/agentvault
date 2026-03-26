import { NextResponse } from "next/server";
import { getAuthenticatedAddress, sameAddress } from "@/lib/auth";
import { getTaskById, updateTaskStatus } from "@/lib/task-repo";
import type { Task } from "@/lib/task-store";
import { getClientIp } from "@/lib/request-meta";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAuditEvent } from "@/lib/audit-log";

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
  const ip = getClientIp(req);
  const ipLimit = await checkRateLimit({
    endpoint: "tasks/update-status",
    key: `ip:${ip}`,
    max: 40,
    windowMs: 60_000,
  });
  if (!ipLimit.allowed) {
    logAuditEvent({
      endpoint: "tasks/update-status",
      action: "update_task_status",
      ip,
      status: "rate_limited",
      message: "Too many status update requests",
    });
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } }
    );
  }

  try {
    const callerAddress = await getAuthenticatedAddress(req);
    if (!callerAddress) {
      logAuditEvent({
        endpoint: "tasks/update-status",
        action: "update_task_status",
        ip,
        status: "unauthorized",
        message: "Missing auth session",
      });
      return NextResponse.json({ error: "Unauthorized: sign in with wallet first" }, { status: 401 });
    }
    const actorLimit = await checkRateLimit({
      endpoint: "tasks/update-status",
      key: `actor:${callerAddress.toLowerCase()}`,
      max: 40,
      windowMs: 60_000,
    });
    if (!actorLimit.allowed) {
      logAuditEvent({
        endpoint: "tasks/update-status",
        action: "update_task_status",
        actorAddress: callerAddress,
        ip,
        status: "rate_limited",
        message: "Too many status update requests for this wallet",
      });
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(actorLimit.retryAfterSeconds) } }
      );
    }

    const { taskId, status } = await req.json() as UpdateTaskStatusRequest;

    if (!taskId || !status) {
      logAuditEvent({
        endpoint: "tasks/update-status",
        action: "update_task_status",
        actorAddress: callerAddress,
        ip,
        status: "validation_error",
        message: "Missing taskId or status",
      });
      return NextResponse.json({ error: "Missing taskId or status" }, { status: 400 });
    }

    if (status === "open" || status === "assigned") {
      logAuditEvent({
        endpoint: "tasks/update-status",
        action: "update_task_status",
        actorAddress: callerAddress,
        ip,
        status: "validation_error",
        resourceId: taskId,
        message: "Invalid target status",
      });
      return NextResponse.json({ error: "Invalid target status" }, { status: 400 });
    }

    const task = await getTaskById(taskId);
    if (!task) {
      logAuditEvent({
        endpoint: "tasks/update-status",
        action: "update_task_status",
        actorAddress: callerAddress,
        ip,
        status: "not_found",
        resourceId: taskId,
        message: "Task not found",
      });
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (!canTransition(task, status, callerAddress)) {
      logAuditEvent({
        endpoint: "tasks/update-status",
        action: "update_task_status",
        actorAddress: callerAddress,
        ip,
        status: "forbidden",
        resourceId: taskId,
        message: "Invalid transition for caller",
      });
      return NextResponse.json({ error: "Forbidden: invalid transition for caller" }, { status: 403 });
    }

    const updated = await updateTaskStatus(task.id, status);
    if (!updated) {
      logAuditEvent({
        endpoint: "tasks/update-status",
        action: "update_task_status",
        actorAddress: callerAddress,
        ip,
        status: "not_found",
        resourceId: taskId,
        message: "Task not found",
      });
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    logAuditEvent({
      endpoint: "tasks/update-status",
      action: "update_task_status",
      actorAddress: callerAddress,
      ip,
      status: "success",
      resourceId: taskId,
      metadata: { status },
    });

    return NextResponse.json({ task: updated });
  } catch {
    logAuditEvent({
      endpoint: "tasks/update-status",
      action: "update_task_status",
      ip,
      status: "error",
      message: "Failed to update task status",
    });
    return NextResponse.json({ error: "Failed to update task status" }, { status: 500 });
  }
}
