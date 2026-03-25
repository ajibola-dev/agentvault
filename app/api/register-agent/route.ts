import {
  generateEntitySecretCiphertext,
  initiateDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";
import { NextResponse } from "next/server";
import { getAuthenticatedAddress } from "@/lib/auth";

const IDENTITY_REGISTRY   = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713";
const METADATA_URI        = "ipfs://bafkreibdi6623n3xpf7ymk62ckb4bo75o3qemwkpfvp5i25j66itxvsoei";
type CircleWallet = {
  id?: string;
  address?: string;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(req: Request) {
  try {
    const callerAddress = getAuthenticatedAddress(req);
    if (!callerAddress) {
      return NextResponse.json({ error: "Unauthorized: sign in with wallet first" }, { status: 401 });
    }

    const apiKey = process.env.CIRCLE_API_KEY!;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET!;

    await generateEntitySecretCiphertext({ apiKey, entitySecret });

    const client = initiateDeveloperControlledWalletsClient({
      apiKey,
      entitySecret,
    });

    const walletSet = await client.createWalletSet({
      name: "AgentVault - Agent Wallets",
    });

    const wallets = await client.createWallets({
      blockchains: ["ARC-TESTNET"],
      count: 2,
      walletSetId: walletSet.data?.walletSet?.id ?? "",
      accountType: "SCA",
    });

    const ownerWallet     = wallets.data?.wallets?.[0] as CircleWallet | undefined;
    const validatorWallet = wallets.data?.wallets?.[1] as CircleWallet | undefined;
    const ownerAddress    = ownerWallet?.address;
    const ownerId         = ownerWallet?.id;
    const validatorId     = validatorWallet?.id;

    const registerTx = await client.createContractExecutionTransaction({
      walletId:             ownerId!,
      contractAddress:      IDENTITY_REGISTRY,
      abiFunctionSignature: "register(string)",
      abiParameters:        [METADATA_URI],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    const reputationTx = await client.createContractExecutionTransaction({
      walletId:             validatorId!,
      contractAddress:      REPUTATION_REGISTRY,
      abiFunctionSignature: "recordReputation(address,uint256,string)",
      abiParameters:        [ownerAddress!, "1", "initial_registration"],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    return NextResponse.json({
      owner:        ownerAddress,
      validator:    validatorWallet?.address,
      identityTx:   registerTx.data?.id   ?? "pending",
      reputationTx: reputationTx.data?.id ?? "pending",
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
