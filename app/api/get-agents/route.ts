import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const client = initiateDeveloperControlledWalletsClient({
      apiKey: process.env.VITE_CIRCLE_API_KEY!,
      entitySecret: process.env.VITE_CIRCLE_API_KEY!,
    });

    const walletSets = await client.listWalletSets({});
    const agentSets = walletSets.data?.walletSets?.filter(ws: any) =>
      ws.name?.includes("AgentVault")
    ) ?? [];

    const agents = await Promise.all(
      agentSets.map(async (ws: any) => {
        const wallets = await client.listWallets({ walletSetId: ws.id });
        const owner = wallets.data?.wallets?.[0];
        const validator = wallets.data?.wallets?.[1];
        return {
          id: ws.id,
          name: ws.name,
          owner: owner?.address,
          validator: validator?.address,
          createdAt: ws.createDate,
          reputation: 1,
        };
      })
    );

    return NextResponse.json({ agents });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
