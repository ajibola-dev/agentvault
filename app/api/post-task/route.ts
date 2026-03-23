import { NextResponse } from "next/server";

export const tasks: any[] = [];

const CIRCLE_BASE = "https://api.circle.com/v1/w3s";

async function circlePost(path: string, body: object) {
  const res = await fetch(`${CIRCLE_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.CIRCLE_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

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

    // Create wallet set via REST API directly
    const walletSetRes = await circlePost("/developer/walletSets", {
      idempotencyKey: crypto.randomUUID(),
      name: `AgentVault - Escrow - ${title.slice(0, 40)}`,
    });

    const walletSetId = walletSetRes?.data?.walletSet?.id ?? null;

    let escrowAddress = null;
    let escrowId = null;

    if (walletSetId) {
      const walletsRes = await circlePost("/developer/wallets", {
        idempotencyKey: crypto.randomUUID(),
        blockchains: ["ARC-TESTNET"],
        count: 1,
        walletSetId,
        accountType: "SCA",
        entitySecretCiphertext: process.env.CIRCLE_ENTITY_SECRET,
      });
      const wallet = walletsRes?.data?.wallets?.[0];
      escrowAddress = wallet?.address ?? null;
      escrowId = wallet?.id ?? null;
    }

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
      createdAt:    new Date().toISOString(),
    };

    tasks.push(task);
    return NextResponse.json({ task });

  } catch (err: any) {
    return NextResponse.json({
      error: err.message,
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ tasks });
}
