import { NextResponse } from "next/server";
import { AUTH_SESSION_COOKIE, getSessionToken } from "@/lib/auth";
import { invalidateSession } from "@/lib/session-store";

export async function POST(req: Request) {
  const token = getSessionToken(req);
  if (token) {
    invalidateSession(token);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: AUTH_SESSION_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });

  return response;
}
