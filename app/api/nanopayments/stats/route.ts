import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, count } = await supabase
    .from("nanopayment_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(50);

  const totalUsdc = data?.reduce(
    (sum, row) => sum + parseFloat(row.amount_usdc ?? "0"),
    0
  ) ?? 0;

  return NextResponse.json({
    totalTransactions: count ?? 0,
    totalUsdcPaid: totalUsdc.toFixed(6),
    recentTransactions: data ?? [],
    pricePerQuery: "0.001",
    network: "Arc Testnet",
    settlement: "Circle Gateway Nanopayments (batched)",
  });
}