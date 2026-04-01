import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    throw new Error("Missing CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET in env");
  }

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

  const walletSet = await client.createWalletSet({
    name: "AgentVault Platform Wallet Set",
  });

  const walletSetId = walletSet.data?.walletSet?.id;
  if (!walletSetId) {
    throw new Error("Failed to create wallet set");
  }

  const wallets = await client.createWallets({
    blockchains: ["ARC-TESTNET"],
    count: 1,
    walletSetId,
    accountType: "SCA",
  });

  const wallet = wallets.data?.wallets?.[0];

  if (!wallet) {
    throw new Error("Failed to create platform wallet");
  }

  console.log("\n=== AGENTVAULT PLATFORM WALLET ===");
  console.log("Wallet ID:", wallet.id);
  console.log("Wallet Address:", wallet.address);
  console.log("Wallet Set ID:", wallet.walletSetId);
  console.log("Blockchain:", wallet.blockchain);
  console.log("==================================\n");
}

main().catch((err) => {
  console.error("Error creating platform wallet:");
  console.error(err);
  process.exit(1);
});
