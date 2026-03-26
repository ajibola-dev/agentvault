import { describe, expect, it, beforeEach } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { POST as noncePost } from "@/app/api/auth/nonce/route";
import { POST as verifyPost } from "@/app/api/auth/verify/route";
import { GET as sessionGet } from "@/app/api/auth/session/route";
import { POST as assignPost } from "@/app/api/assign-task/route";
import { POST as updateTaskStatusPost } from "@/app/api/update-task-status/route";
import { clearAuthState } from "@/lib/session-store";
import { clearRateLimits } from "@/lib/rate-limit";
import { clearAuditLogs } from "@/lib/audit-log";
import { clearTasks, createTask, getTaskById } from "@/lib/task-repo";
import type { Task } from "@/lib/task-store";

async function authenticate(address: `0x${string}`, signMessage: (message: string) => Promise<`0x${string}`>): Promise<string> {
  const nonceReq = new Request("http://localhost/api/auth/nonce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });

  const nonceRes = await noncePost(nonceReq);
  expect(nonceRes.status).toBe(200);
  const nonceData = await nonceRes.json() as { nonce: string; message: string; address: string };

  const signature = await signMessage(nonceData.message);

  const verifyReq = new Request("http://localhost/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: nonceData.address,
      nonce: nonceData.nonce,
      signature,
    }),
  });

  const verifyRes = await verifyPost(verifyReq);
  expect(verifyRes.status).toBe(200);

  const cookie = verifyRes.headers.get("set-cookie");
  expect(cookie).toBeTruthy();
  return cookie!;
}

function buildTask(params: {
  id: string;
  creatorAddress: string;
  agentAddress?: string;
  status?: Task["status"];
  agentId?: string | null;
}): Task {
  return {
    id: params.id,
    title: "Task",
    description: "Description",
    reward: "10",
    minRep: 50,
    creatorAddress: params.creatorAddress,
    agentId: params.agentId ?? null,
    agentAddress: params.agentAddress ?? null,
    status: params.status ?? "open",
    escrowAddress: null,
    escrowId: null,
    escrowStatus: "pending",
    ciphertext: "test",
    createdAt: new Date().toISOString(),
    assignedAt: params.status === "assigned" ? new Date().toISOString() : undefined,
  };
}

describe("task auth and lifecycle APIs", () => {
  beforeEach(async () => {
    clearAuthState();
    clearRateLimits();
    clearAuditLogs();
    await clearTasks();
  });

  it("creates auth session and exposes it through /api/auth/session", async () => {
    const owner = privateKeyToAccount(generatePrivateKey());

    const cookie = await authenticate(owner.address, async (message) => owner.signMessage({ message }));

    const sessionReq = new Request("http://localhost/api/auth/session", {
      method: "GET",
      headers: { cookie },
    });

    const sessionRes = await sessionGet(sessionReq);
    expect(sessionRes.status).toBe(200);
    const data = await sessionRes.json() as { authenticated: boolean; address?: string };

    expect(data.authenticated).toBe(true);
    expect(data.address?.toLowerCase()).toBe(owner.address.toLowerCase());
  });

  it("allows only task creator to assign and enforces lifecycle transitions by role", async () => {
    const creator = privateKeyToAccount(generatePrivateKey());
    const agent = privateKeyToAccount(generatePrivateKey());
    const outsider = privateKeyToAccount(generatePrivateKey());

    const creatorCookie = await authenticate(creator.address, async (message) => creator.signMessage({ message }));
    const agentCookie = await authenticate(agent.address, async (message) => agent.signMessage({ message }));
    const outsiderCookie = await authenticate(outsider.address, async (message) => outsider.signMessage({ message }));

    await createTask(buildTask({ id: "task-1", creatorAddress: creator.address }));

    const forbiddenAssignReq = new Request("http://localhost/api/assign-task", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: outsiderCookie },
      body: JSON.stringify({
        taskId: "task-1",
        agentId: "agent-1",
        agentAddress: agent.address,
      }),
    });
    const forbiddenAssignRes = await assignPost(forbiddenAssignReq);
    expect(forbiddenAssignRes.status).toBe(403);

    const assignReq = new Request("http://localhost/api/assign-task", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: creatorCookie },
      body: JSON.stringify({
        taskId: "task-1",
        agentId: "agent-1",
        agentAddress: agent.address,
      }),
    });
    const assignRes = await assignPost(assignReq);
    expect(assignRes.status).toBe(200);

    const forbiddenStartReq = new Request("http://localhost/api/update-task-status", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: creatorCookie },
      body: JSON.stringify({ taskId: "task-1", status: "in_progress" }),
    });
    const forbiddenStartRes = await updateTaskStatusPost(forbiddenStartReq);
    expect(forbiddenStartRes.status).toBe(403);

    const startReq = new Request("http://localhost/api/update-task-status", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: agentCookie },
      body: JSON.stringify({ taskId: "task-1", status: "in_progress" }),
    });
    const startRes = await updateTaskStatusPost(startReq);
    expect(startRes.status).toBe(200);

    const completeReq = new Request("http://localhost/api/update-task-status", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: agentCookie },
      body: JSON.stringify({ taskId: "task-1", status: "completed" }),
    });
    const completeRes = await updateTaskStatusPost(completeReq);
    expect(completeRes.status).toBe(200);

    const payReq = new Request("http://localhost/api/update-task-status", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: creatorCookie },
      body: JSON.stringify({ taskId: "task-1", status: "paid" }),
    });
    const payRes = await updateTaskStatusPost(payReq);
    expect(payRes.status).toBe(200);

    const task = await getTaskById("task-1");
    expect(task?.status).toBe("paid");
  });
});
