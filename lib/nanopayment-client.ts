import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "crypto";

const ARC_TESTNET_CHAIN_ID = 5042002;
const GATEWAY_CONTRACT = "0x0000000000000000000000000000000000000000"; // placeholder until Gateway access

export interface RepQueryResult {
  address: string;
  reputation: number;
  name: string;
  tags: string[];
  completedTasks: number;
  recentTasks: unknown[];
  pricePaid: string;
  timestamp: string;
}

export async function queryAgentRep(
  agentAddress: string,
  payerPrivateKey: string
): Promise<RepQueryResult> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://agentvault-ecru.vercel.app";
  const url = `${baseUrl}/api/rep-query/${agentAddress}`;

  // Step 1: probe for 402
  const probe = await fetch(url);
  if (probe.status !== 402) {
    throw new Error(`Expected 402, got ${probe.status}`);
  }

  const { accepts } = await probe.json();
  const requirement = accepts[0];

  // Step 2: build EIP-3009 payment payload
  const account = privateKeyToAccount(payerPrivateKey as `0x${string}`);
  const nonce = `0x${randomBytes(32).toString("hex")}`;
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 5);

  const authorization = {
    from: account.address,
    to: requirement.payTo,
    value: BigInt(requirement.maxAmountRequired),
    validAfter: BigInt(0),
    validBefore,
    nonce,
  };

  const domain = {
    name: "GatewayWalletBatched",
    version: "1",
    chainId: ARC_TESTNET_CHAIN_ID,
    verifyingContract: GATEWAY_CONTRACT as `0x${string}`,
  };

  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  };

  const signature = await account.signTypedData({
    domain,
    types,
    primaryType: "TransferWithAuthorization",
    message: {
      ...authorization,
      value: authorization.value,
      validAfter: authorization.validAfter,
      validBefore: authorization.validBefore,
    },
  });

  const paymentPayload = {
    x402Version: 2,
    scheme: "exact",
    network: `eip155:${ARC_TESTNET_CHAIN_ID}`,
    payload: {
      authorization: {
        from: authorization.from,
        to: authorization.to,
        value: authorization.value.toString(),
        validAfter: authorization.validAfter.toString(),
        validBefore: authorization.validBefore.toString(),
        nonce,
      },
      signature,
    },
    resource: url,
  };

  const encoded = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");

  // Step 3: retry with payment
  const paid = await fetch(url, {
    headers: { "x-payment": encoded },
  });

  if (!paid.ok) {
    throw new Error(`Payment failed: ${paid.status}`);
  }

  return paid.json();
}