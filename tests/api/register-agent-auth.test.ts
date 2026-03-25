import { describe, expect, it } from "vitest";

import { POST as registerAgentPost } from "@/app/api/register-agent/route";

describe("register-agent auth", () => {
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
