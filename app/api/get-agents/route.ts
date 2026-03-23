import { initiateDeveloperControlledWalletsClient, generateEntitySecretCiphertext } from "@circle-fin/developer-controlled-wallets";
import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";

const REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713";

// Arc Testnet chain definition
const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://arc-testnet.drpc.org"] },
  },
} as const;

const reputationAbi = [
  {
    name: "getReputation",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "reputation",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

async function getReputationScore(address: string): Promise<number> {
  try {
    const client = createPublicClient({
      chain: arcTestnet,
      transport: http(),
    });

    // Try getReputation first, fall back to reputation mapping
    try {
      const score = await client.readContract({
        address: REPUTATION_REGISTRY as `0x${string}`,
        abi: reputationAbi,
        functionName: "getReputation",
        args: [address as `0x${string}`],
      });
      return Number(score);
    } catch {
      const score = await client.readContract({
        address: REPUTATION_REGISTRY as `0x${string}`,
        abi: reputationAbi,
        functionName: "reputation",
        args: [address as `0x${string}`],
      });
      return Number(score);
    }
  } catch {
    return 1; // fallback
  }
}

export async function GET() {
  try {
    const apiKey       = process.env.CIRCLE_API_KEY!;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET!;

    await generateEntitySecretCiphertext({ apiKey, entitySecret });

    const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

    const walletSets = await client.listWalletSets({});
    const agentSets  = walletSets.data?.walletSets?.filter((ws: any) =>
      ws.name?.includes("AgentVault") && !ws.name?.includes("Escrow")
    ) ?? [];

    const agents = await Promise.all(
      agentSets.map(async (ws: any) => {
        const wallets   = await client.listWallets({ walletSetId: ws.id });
        const owner     = wallets.data?.wallets?.[0];
        const validator = wallets.data?.wallets?.[1];

        const reputation = owner?.address
          ? await getReputationScore(owner.address)
          : 1;

        return {
          id:         ws.id,
          name:       ws.name,
          owner:      owner?.address,
          validator:  validator?.address,
          reputation,
          createdAt:  ws.createDate,
          status:     "active",
        };
      })
    );

    return NextResponse.json({ agents });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
