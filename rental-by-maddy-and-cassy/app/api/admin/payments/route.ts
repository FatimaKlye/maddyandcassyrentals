import { NextResponse } from "next/server";
import { enforceRateLimit, requireActiveAdmin, RequestSecurityError } from "@/src/lib/server/requestSecurity";
import { getAllPaymentRecords, getPaymentEvents } from "@/src/services/adminReadService";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    enforceRateLimit(request, "admin-payments-read", 60, 60_000);
    const { supabase } = await requireActiveAdmin();

    const [payments, events] = await Promise.all([getAllPaymentRecords(supabase), getPaymentEvents(supabase)]);

    return NextResponse.json({ payments, events });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Admin payment activity read failed", error);
    return NextResponse.json({ error: "Payment activity could not be loaded." }, { status: 500 });
  }
}
