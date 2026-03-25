import { 
  initiateDeveloperControlledWalletsClient,
  generateEntitySecretCiphertext
} from "@circle-fin/developer-controlled-wallets";
import { NextResponse } from "next/server";
import type { Task } from "@/lib/task-store";
import { getAuthenticatedAddress } from "@/lib/auth";
import { createTask, listTasks } from "@/lib/task-repo";
import { getClientIp } from "@/lib/request-meta";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAuditEvent } from "@/lib/audit-log";

export const runtime = "nodejs";

type PostTaskRequest = {
  title?: string;
  description?: string;
  reward?: string;
  minRep?: number;
  agentId?: string | null;
};

type CircleWallet = {
  id?: string;
  address?: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const { message } = error as { message?: unknown };
    if (typeof message === "string") {
      return message;
    }
  }
  return "Unknown error";
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code } = error as { code?: unknown };
    return typeof code === "string" ? code : undefined;
  }

  return undefined;
}
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limit = checkRateLimit({
    endpoint: "tasks/post",
    key: `ip:${ip}`,
    max: 20,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    logAuditEvent({
      endpoint: "tasks/post",
      action: "post_task",
      ip,
      status: "rate_limited",
      message: "Too many task creation requests",
    });
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  try {
    const callerAddress = getAuthenticatedAddress(req);
    if (!callerAddress) {
      logAuditEvent({
        endpoint: "tasks/post",
        action: "post_task",
        ip,
        status: "unauthorized",
        message: "Missing auth session",
      });
      return NextResponse.json({ error: "Unauthorized: sign in with wallet first" }, { status: 401 });
    }

    const { title, description, reward, minRep, agentId } = await req.json() as PostTaskRequest;

    if (!title || !description || !reward) {
      logAuditEvent({
        endpoint: "tasks/post",
        action: "post_task",
        actorAddress: callerAddress,
        ip,
        status: "validation_error",
        message: "Missing required fields",
      });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const rewardNum = parseFloat(reward);
    if (isNaN(rewardNum) || rewardNum <= 0) {
      logAuditEvent({
        endpoint: "tasks/post",
        action: "post_task",
        actorAddress: callerAddress,
        ip,
        status: "validation_error",
        message: "Invalid reward amount",
      });
      return NextResponse.json({ error: "Invalid reward amount" }, { status: 400 });
    }

    const apiKey       = process.env.CIRCLE_API_KEY!;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET!;

    // Generate fresh ciphertext for this request
    const ciphertext = await generateEntitySecretCiphertext({ apiKey, entitySecret });

    const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

    const walletSet = await client.createWalletSet({
      name: `AV-Escrow-${title.slice(0, 30)}`,
    });

    const wallets = await client.createWallets({
      blockchains:  ["ARC-TESTNET"],
      count:        1,
      walletSetId:  walletSet.data?.walletSet?.id ?? "",
      accountType:  "SCA",
    });

    const escrowWallet  = wallets.data?.wallets?.[0] as CircleWallet | undefined;
    const escrowAddress = escrowWallet?.address ?? null;
    const escrowId      = escrowWallet?.id ?? null;

    const task: Task = {
      id:           crypto.randomUUID(),
      title,
      description,
      reward:       rewardNum.toString(),
      minRep:       minRep ?? 50,
      creatorAddress: callerAddress,
      agentId:      agentId ?? null,
      status:       "open",
      escrowAddress,
      escrowId,
      escrowStatus: escrowAddress ? "wallet_created" : "pending",
      ciphertext,
      createdAt:    new Date().toISOString(),
    };

    createTask(task);
    logAuditEvent({
      endpoint: "tasks/post",
      action: "post_task",
      actorAddress: callerAddress,
      ip,
      status: "success",
      resourceId: task.id,
    });
    return NextResponse.json({ task });

  } catch (err: unknown) {
    logAuditEvent({
      endpoint: "tasks/post",
      action: "post_task",
      ip,
      status: "error",
      message: getErrorMessage(err),
      metadata: { code: getErrorCode(err) },
    });
    return NextResponse.json({
      error: getErrorMessage(err),
      code:  getErrorCode(err),
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ tasks: listTasks() });
}
