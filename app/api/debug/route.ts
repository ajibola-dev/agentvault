import { NextResponse } from "next/server";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    hasCircleApiKey: Boolean(process.env.CIRCLE_API_KEY),
    hasCircleEntitySecret: Boolean(process.env.CIRCLE_ENTITY_SECRET),
    hasCircleAppId: Boolean(process.env.CIRCLE_APP_ID),
    hasWalletConnectProjectId: Boolean(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID),
  });
}
