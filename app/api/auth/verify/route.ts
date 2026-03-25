import { NextResponse } from "next/server";
import { verifyMessage } from "viem";
import {
  AUTH_SESSION_COOKIE,
  createAuthMessage,
  normalizeAddress,
} from "@/lib/auth";
import { consumeNonce, createSession, hasNonce } from "@/lib/session-store";

type VerifyRequest = {
  address?: string;
  nonce?: string;
  signature?: string;
};

export async function POST(req: Request) {
  try {
    const { address, nonce, signature } = await req.json() as VerifyRequest;

    if (!address || !nonce || !signature) {
      return NextResponse.json({ error: "Missing address, nonce, or signature" }, { status: 400 });
    }

    const normalized = normalizeAddress(address);
    if (!normalized) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    if (!hasNonce(normalized, nonce)) {
      return NextResponse.json({ error: "Invalid or expired nonce" }, { status: 400 });
    }

    const isValid = await verifyMessage({
      address: normalized as `0x${string}`,
      message: createAuthMessage(normalized, nonce),
      signature: signature as `0x${string}`,
    });

    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    if (!consumeNonce(normalized, nonce)) {
      return NextResponse.json({ error: "Nonce already used" }, { status: 400 });
    }

    const token = createSession(normalized);
    const response = NextResponse.json({ ok: true, address: normalized });

    response.cookies.set({
      name: AUTH_SESSION_COOKIE,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Failed to verify signature" }, { status: 500 });
  }
}
