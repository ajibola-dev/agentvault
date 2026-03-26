import { expect, test } from "@playwright/test";
import { privateKeyToAccount } from "viem/accounts";

const TEST_WALLET_PRIVATE_KEY = process.env.TEST_WALLET_PRIVATE_KEY;
const TEST_WALLET_ADDRESS = process.env.TEST_WALLET_ADDRESS;

test("public APIs are reachable", async ({ request }) => {
  const tasks = await request.get("/api/get-tasks");
  expect(tasks.ok()).toBeTruthy();
  const tasksBody = await tasks.json();
  expect(Array.isArray(tasksBody.tasks)).toBeTruthy();

  const agents = await request.get("/api/get-agents");
  expect(agents.ok()).toBeTruthy();
  const agentsBody = await agents.json();
  expect(Array.isArray(agentsBody.agents)).toBeTruthy();

  const session = await request.get("/api/auth/session");
  expect(session.ok()).toBeTruthy();
  const sessionBody = await session.json();
  expect(typeof sessionBody.authenticated).toBe("boolean");
});

test("protected APIs reject unauthenticated requests", async ({ request }) => {
  const postTask = await request.post("/api/post-task", {
    data: { title: "x", description: "y", reward: "1" },
  });
  expect(postTask.status()).toBe(401);

  const assign = await request.post("/api/assign-task", {
    data: { taskId: "x", agentId: "y" },
  });
  expect(assign.status()).toBe(401);

  const update = await request.post("/api/update-task-status", {
    data: { taskId: "x", status: "in_progress" },
  });
  expect(update.status()).toBe(401);

  const register = await request.post("/api/register-agent");
  expect(register.status()).toBe(401);

  const auditLogs = await request.get("/api/audit-logs?limit=20");
  expect(auditLogs.status()).toBe(401);
});

test("wallet auth can retrieve actor-scoped audit logs", async ({ request }) => {
  test.skip(!TEST_WALLET_PRIVATE_KEY || !TEST_WALLET_ADDRESS, "TEST_WALLET_PRIVATE_KEY and TEST_WALLET_ADDRESS are required");

  const account = privateKeyToAccount(TEST_WALLET_PRIVATE_KEY as `0x${string}`);
  expect(account.address.toLowerCase()).toBe((TEST_WALLET_ADDRESS as string).toLowerCase());

  const nonceRes = await request.post("/api/auth/nonce", {
    data: { address: TEST_WALLET_ADDRESS },
  });
  expect(nonceRes.ok()).toBeTruthy();
  const nonceBody = await nonceRes.json();

  expect(typeof nonceBody.nonce).toBe("string");
  expect(typeof nonceBody.message).toBe("string");
  expect(typeof nonceBody.address).toBe("string");

  const signature = await account.signMessage({ message: nonceBody.message as string });

  const verifyRes = await request.post("/api/auth/verify", {
    data: {
      address: nonceBody.address,
      nonce: nonceBody.nonce,
      signature,
    },
  });
  expect(verifyRes.ok()).toBeTruthy();

  const sessionRes = await request.get("/api/auth/session");
  expect(sessionRes.ok()).toBeTruthy();
  const sessionBody = await sessionRes.json();
  expect(sessionBody.authenticated).toBe(true);
  expect((sessionBody.address as string).toLowerCase()).toBe((TEST_WALLET_ADDRESS as string).toLowerCase());

  const logsRes = await request.get("/api/audit-logs?limit=20");
  expect(logsRes.ok()).toBeTruthy();
  const logsBody = await logsRes.json();
  expect(Array.isArray(logsBody.logs)).toBeTruthy();
});
