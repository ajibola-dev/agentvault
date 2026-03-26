import { beforeEach, describe, expect, it } from "vitest";

import { POST as noncePost } from "@/app/api/auth/nonce/route";
import { POST as updateTaskStatusPost } from "@/app/api/update-task-status/route";
import { AUTH_SESSION_COOKIE } from "@/lib/auth";
import { clearRateLimits } from "@/lib/rate-limit";
import { clearAuditLogs, listAuditLogs } from "@/lib/audit-log";
import { clearAuthState, createSession } from "@/lib/session-store";

describe("security controls", () => {
  beforeEach(async () => {
    await clearAuthState();
    await clearRateLimits();
    clearAuditLogs();
  });

  it("rate-limits nonce issuance and records audit events", async () => {
    for (let i = 0; i < 20; i += 1) {
      const req = new Request("http://localhost/api/auth/nonce", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.10",
        },
        body: JSON.stringify({
          address: "0x1111111111111111111111111111111111111111",
        }),
      });

      const res = await noncePost(req);
      expect(res.status).toBe(200);
    }

    const limitedReq = new Request("http://localhost/api/auth/nonce", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "203.0.113.10",
      },
      body: JSON.stringify({
        address: "0x1111111111111111111111111111111111111111",
      }),
    });

    const limitedRes = await noncePost(limitedReq);
    expect(limitedRes.status).toBe(429);

    const logs = listAuditLogs(200);
    const limitedLog = logs.find((l) => l.endpoint === "auth/nonce" && l.status === "rate_limited");
    expect(limitedLog).toBeTruthy();
    expect(limitedLog?.message).toContain("Too many nonce requests");
  });

  it("rate-limits authenticated task updates by wallet even when IP changes", async () => {
    const actor = "0x3333333333333333333333333333333333333333";
    const sessionToken = await createSession(actor);
    const cookie = `${AUTH_SESSION_COOKIE}=${sessionToken}`;

    for (let i = 0; i < 40; i += 1) {
      const req = new Request("http://localhost/api/update-task-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie,
          "x-forwarded-for": `203.0.113.${i}`,
        },
        body: JSON.stringify({}),
      });

      const res = await updateTaskStatusPost(req);
      expect(res.status).toBe(400);
    }

    const limitedReq = new Request("http://localhost/api/update-task-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
        "x-forwarded-for": "198.51.100.44",
      },
      body: JSON.stringify({}),
    });

    const limitedRes = await updateTaskStatusPost(limitedReq);
    expect(limitedRes.status).toBe(429);

    const logs = listAuditLogs(300);
    const limitedLog = logs.find((l) => l.endpoint === "tasks/update-status" && l.status === "rate_limited");
    expect(limitedLog).toBeTruthy();
    expect(limitedLog?.actorAddress?.toLowerCase()).toBe(actor);
    expect(limitedLog?.message).toContain("Too many status update requests for this wallet");
  });
});
