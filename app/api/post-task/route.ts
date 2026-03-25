import { 
  initiateDeveloperControlledWalletsClient,
  generateEntitySecretCiphertext
} from "@circle-fin/developer-controlled-wallets";
import { NextResponse } from "next/server";
import { tasks, type Task } from "@/lib/task-store";

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
  return error instanceof Error ? error.message : "Unknown error";
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code } = error as { code?: unknown };
    return typeof code === "string" ? code : undefined;
  }

  return undefined;
}
export async function POST(req: Request) {
  try {
    const { title, description, reward, minRep, agentId } = await req.json() as PostTaskRequest;

    if (!title || !description || !reward) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const rewardNum = parseFloat(reward);
    if (isNaN(rewardNum) || rewardNum <= 0) {
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
      agentId:      agentId ?? null,
      status:       "open",
      escrowAddress,
      escrowId,
      escrowStatus: escrowAddress ? "wallet_created" : "pending",
      ciphertext,
      createdAt:    new Date().toISOString(),
    };

    tasks.push(task);
    return NextResponse.json({ task });

  } catch (err: unknown) {
    return NextResponse.json({
      error: getErrorMessage(err),
      code:  getErrorCode(err),
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ tasks });
}
