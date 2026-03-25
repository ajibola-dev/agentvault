import { beforeEach, describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { POST as noncePost } from "@/app/api/auth/nonce/route";
import { POST as verifyPost } from "@/app/api/auth/verify/route";
import { POST as postTaskPost } from "@/app/api/post-task/route";
import { GET as getTasksGet } from "@/app/api/get-tasks/route";
import { clearAuthState } from "@/lib/session-store";
import { clearRateLimits } from "@/lib/rate-limit";
import { clearAuditLogs } from "@/lib/audit-log";
import { clearTasks } from "@/lib/task-repo";

const {
  mockGenerateCiphertext,
  mockCreateWalletSet,
  mockCreateWallets,
  mockInitiateClient,
} = vi.hoisted(() => ({
  mockGenerateCiphertext: vi.fn(),
  mockCreateWalletSet: vi.fn(),
  mockCreateWallets: vi.fn(),
  mockInitiateClient: vi.fn(),
}));

vi.mock("@circle-fin/developer-controlled-wallets", () => ({
  generateEntitySecretCiphertext: mockGenerateCiphertext,
  initiateDeveloperControlledWalletsClient: mockInitiateClient,
}));

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

describe("post-task and get-tasks APIs", () => {
  beforeEach(() => {
    process.env.CIRCLE_API_KEY = "test-api-key";
    process.env.CIRCLE_ENTITY_SECRET = "test-entity-secret";

    clearAuthState();
    clearRateLimits();
    clearAuditLogs();
    clearTasks();

    mockGenerateCiphertext.mockReset();
    mockCreateWalletSet.mockReset();
    mockCreateWallets.mockReset();
    mockInitiateClient.mockReset();

    mockGenerateCiphertext.mockResolvedValue("ciphertext-token");
    mockCreateWalletSet.mockResolvedValue({ data: { walletSet: { id: "wallet-set-1" } } });
    mockCreateWallets.mockResolvedValue({
      data: {
        wallets: [{ id: "escrow-wallet-1", address: "0x1111111111111111111111111111111111111111" }],
      },
    });
    mockInitiateClient.mockReturnValue({
      createWalletSet: mockCreateWalletSet,
      createWallets: mockCreateWallets,
    });
  });

  it("rejects post-task when caller is not authenticated", async () => {
    const req = new Request("http://localhost/api/post-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Test Task",
        description: "Task description",
        reward: "25",
      }),
    });

    const res = await postTaskPost(req);
    expect(res.status).toBe(401);
  });

  it("creates a task and returns it from get-tasks", async () => {
    const owner = privateKeyToAccount(generatePrivateKey());
    const cookie = await authenticate(owner.address, async (message) => owner.signMessage({ message }));

    const postReq = new Request("http://localhost/api/post-task", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        title: "Security Audit",
        description: "Audit contract for reentrancy",
        reward: "50",
        minRep: 80,
      }),
    });

    const postRes = await postTaskPost(postReq);
    expect(postRes.status).toBe(200);
    const postData = await postRes.json() as { task: { id: string; creatorAddress: string; escrowStatus: string; status: string } };

    expect(postData.task.id).toBeTruthy();
    expect(postData.task.creatorAddress.toLowerCase()).toBe(owner.address.toLowerCase());
    expect(postData.task.escrowStatus).toBe("wallet_created");
    expect(postData.task.status).toBe("open");

    const getRes = await getTasksGet();
    expect(getRes.status).toBe(200);
    const getData = await getRes.json() as { tasks: Array<{ id: string; title: string }> };

    expect(getData.tasks.length).toBe(1);
    expect(getData.tasks[0]?.id).toBe(postData.task.id);
    expect(getData.tasks[0]?.title).toBe("Security Audit");
  });

  it("returns Circle error code on wallet creation failure", async () => {
    const owner = privateKeyToAccount(generatePrivateKey());
    const cookie = await authenticate(owner.address, async (message) => owner.signMessage({ message }));

    mockCreateWalletSet.mockRejectedValueOnce({
      message: "Circle unavailable",
      code: "CIRCLE_DOWN",
    });

    const req = new Request("http://localhost/api/post-task", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        title: "Failing Task",
        description: "This should fail",
        reward: "10",
      }),
    });

    const res = await postTaskPost(req);
    expect(res.status).toBe(500);
    const data = await res.json() as { error?: string; code?: string };

    expect(data.error).toBe("Circle unavailable");
    expect(data.code).toBe("CIRCLE_DOWN");

    const getRes = await getTasksGet();
    const getData = await getRes.json() as { tasks: unknown[] };
    expect(getData.tasks).toHaveLength(0);
  });
});
