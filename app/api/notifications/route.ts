import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/notifications?address=0x...
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_address", address.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const unread = (data ?? []).filter(n => !n.read).length;
  return NextResponse.json({ notifications: data ?? [], unread });
}

// POST /api/notifications — internal use only, called by other API routes
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { recipient_address, type, title, message, task_id } = body;

  if (!recipient_address || !type || !title || !message) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { error } = await supabase.from("notifications").insert({
    recipient_address: recipient_address.toLowerCase(),
    type,
    title,
    message,
    task_id: task_id ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}