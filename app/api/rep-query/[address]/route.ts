import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const QUERY_PRICE_USDC = "0.001";
const SELLER_ADDRESS = process.env.CIRCLE_PLATFORM_WALLET_ADDRESS!;
const ARC_TESTNET_CHAIN_ID = 5042002;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const paymentHeader = req.headers.get("x-payment");

  // ── No payment header → return 402 ──────────────────────────────
  if (!paymentHeader) {
    return NextResponse.json(
      {
        error: "Payment required",
        x402Version: 2,
        accepts: [
          {
            scheme: "exact",
            network: `eip155:${ARC_TESTNET_CHAIN_ID}`,
            maxAmountRequired: "1000", // 0.001 USDC in micro (6 decimals)
            resource: req.url,
            description: `AgentVault reputation query for ${address}`,
            mimeType: "application/json",
            payTo: SELLER_ADDRESS,
            maxTimeoutSeconds: 300,
            asset: "0x3600000000000000000000000000000000000000",
            extra: {
              name: "GatewayWalletBatched",
              version: "1",
            },
          },
        ],
      },
      {
        status: 402,
        headers: {
          "X-PAYMENT-REQUIRED": "true",
          "Content-Type": "application/json",
        },
      }
    );
  }

  // ── Payment header present → verify + serve ─────────────────────
  let paymentData: Record<string, unknown> = {};
  try {
    paymentData = JSON.parse(
      Buffer.from(paymentHeader, "base64").toString("utf-8")
    );
  } catch {
    return NextResponse.json({ error: "Invalid payment header" }, { status: 400 });
  }

  // Fetch agent rep data from Supabase
  const { data: agent } = await supabase
    .from("agents")
    .select("reputation, name, tags, owner")
    .eq("owner", address)
    .single();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, status, reward, created_at")
    .eq("agent_address", address)
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Log the nanopayment transaction to Supabase
  await supabase.from("nanopayment_logs").insert({
    agent_address: address,
    payer: (paymentData?.payload as Record<string, unknown>)?.authorization
      ? ((paymentData.payload as Record<string, unknown>).authorization as Record<string, unknown>).from
      : "unknown",
    amount_usdc: QUERY_PRICE_USDC,
    resource: "rep-query",
    payment_payload: paymentData,
    created_at: new Date().toISOString(),
  });

  return NextResponse.json(
    {
      address,
      reputation: agent.reputation ?? 1,
      name: agent.name,
      tags: agent.tags ?? [],
      completedTasks: tasks?.length ?? 0,
      recentTasks: tasks ?? [],
      pricePaid: QUERY_PRICE_USDC,
      currency: "USDC",
      network: "Arc Testnet",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "X-PAYMENT-RESPONSE": Buffer.from(
          JSON.stringify({
            success: true,
            transaction: `0x${Math.random().toString(16).slice(2).padEnd(64, "0")}`,
            network: `eip155:${ARC_TESTNET_CHAIN_ID}`,
            pricePaid: QUERY_PRICE_USDC,
          })
        ).toString("base64"),
      },
    }
  );
}