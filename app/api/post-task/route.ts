import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { NextResponse } from "next/server";

// In-memory store — shared across both GET and POST
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

    // Create a dedicated escrow wallet for this task
    const client = initiateDeveloperControlledWalletsClient({
      apiKey:       process.env.CIRCLE_API_KEY!,
      entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
      appId:        process.env.CIRCLE_APP_ID!,
    });

    const walletSet = await client.createWalletSet({
      name: `AgentVault - Escrow - ${title.slice(0, 40)}`,
    });

    const wallets = await client.createWallets({
      blockchains: ["ARC-TESTNET" as any],
      count: 1,
      walletSetId: walletSet.data?.walletSet?.id ?? "",
      accountType: "SCA",
    });

    const escrowWallet  = wallets.data?.wallets?.[0];
    const escrowAddress = escrowWallet?.address ?? null;
    const escrowId      = escrowWallet?.id ?? null;

    const task = {
      id:            crypto.randomUUID(),
      title,
      description,
      reward:        rewardNum.toString(),
      minRep:        minRep ?? 50,
      agentId:       agentId ?? null,
      status:        "open",
      escrowAddress,
      escrowId,
      escrowStatus:  escrowAddress ? "wallet_created" : "pending",
      createdAt:     new Date().toISOString(),
    };

    tasks.push(task);

    return NextResponse.json({ task });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ tasks });
}
