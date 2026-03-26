import { beforeEach, describe, expect, it } from "vitest";

import { GET as auditLogsGet } from "@/app/api/audit-logs/route";
import { clearRateLimits } from "@/lib/rate-limit";
import { clearAuditLogs } from "@/lib/audit-log";
import { clearAuthState } from "@/lib/session-store";

describe("audit-logs auth", () => {
  beforeEach(async () => {
    await clearAuthState();
    await clearRateLimits();
    clearAuditLogs();
  });

  it("rejects unauthenticated caller", async () => {
    const req = new Request("http://localhost/api/audit-logs", {
      method: "GET",
    });

    const res = await auditLogsGet(req);
    expect(res.status).toBe(401);
  });
});
