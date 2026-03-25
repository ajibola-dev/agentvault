import { beforeEach, describe, expect, it } from "vitest";

import { POST as registerAgentPost } from "@/app/api/register-agent/route";
import { clearRateLimits } from "@/lib/rate-limit";
import { clearAuditLogs } from "@/lib/audit-log";
import { clearAuthState } from "@/lib/session-store";

describe("register-agent auth", () => {
  beforeEach(() => {
    clearAuthState();
    clearRateLimits();
    clearAuditLogs();
  });

  it("rejects unauthenticated caller", async () => {
    const req = new Request("http://localhost/api/register-agent", {
      method: "POST",
    });

    const res = await registerAgentPost(req);
    expect(res.status).toBe(401);

    const data = await res.json() as { error?: string };
    expect(data.error).toContain("Unauthorized");
  });
});
