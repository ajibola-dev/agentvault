import { 
  initiateDeveloperControlledWalletsClient,
  generateEntitySecretCiphertext
} from "@circle-fin/developer-controlled-wallets";
import { NextResponse } from "next/server";

export const tasks: any[] = [];

export async function POST(req: Request) {
  try {
    const { title, description, reward, minRep, agentId } = await req.json();

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
      blockchains:  ["ARC-TESTNET" as any],
      count:        1,
      walletSetId:  walletSet.data?.walletSet?.id ?? "",
      accountType:  "SCA",
    });

    const escrowWallet  = wallets.data?.wallets?.[0];
    const escrowAddress = escrowWallet?.address ?? null;
    const escrowId      = escrowWallet?.id ?? null;

    const task = {
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

  } catch (err: any) {
    return NextResponse.json({
      error: err.message,
      code:  err?.code,
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ tasks });
}
