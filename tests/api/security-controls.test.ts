import { beforeEach, describe, expect, it } from "vitest";

import { POST as noncePost } from "@/app/api/auth/nonce/route";
import { clearRateLimits } from "@/lib/rate-limit";
import { clearAuditLogs, listAuditLogs } from "@/lib/audit-log";
import { clearAuthState } from "@/lib/session-store";

describe("security controls", () => {
  beforeEach(() => {
    clearAuthState();
    clearRateLimits();
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
});
