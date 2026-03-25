import { NextResponse } from "next/server";
import { createAuthMessage, normalizeAddress } from "@/lib/auth";
import { issueNonce } from "@/lib/session-store";

type NonceRequest = {
  address?: string;
};

export async function POST(req: Request) {
  try {
    const { address } = await req.json() as NonceRequest;
    if (!address) {
      return NextResponse.json({ error: "Missing address" }, { status: 400 });
    }

    const normalized = normalizeAddress(address);
    if (!normalized) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    const nonce = issueNonce(normalized);
    const message = createAuthMessage(normalized, nonce);

    return NextResponse.json({ nonce, message, address: normalized });
  } catch {
    return NextResponse.json({ error: "Failed to issue nonce" }, { status: 500 });
  }
}
