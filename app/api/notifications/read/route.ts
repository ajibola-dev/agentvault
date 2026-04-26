import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/notifications/read
// Body: { address: "0x...", notificationId?: "uuid" } 
// If notificationId omitted, marks all as read
export async function POST(req: NextRequest) {
  const { address, notificationId } = await req.json();
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });

  const query = supabase
    .from("notifications")
    .update({ read: true })
    .eq("recipient_address", address.toLowerCase());

  if (notificationId) query.eq("id", notificationId);

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}