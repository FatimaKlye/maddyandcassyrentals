import { NextResponse } from "next/server";
import { enforceRateLimit, requireActiveAdmin, RequestSecurityError } from "@/src/lib/server/requestSecurity";
import { getAuditLogs } from "@/src/services/adminReadService";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    enforceRateLimit(request, "admin-audit-read", 60, 60_000);
    const { supabase } = await requireActiveAdmin();
    const logs = await getAuditLogs(supabase);
    return NextResponse.json({ logs });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Admin audit read failed", error);
    return NextResponse.json({ error: "Audit history could not be loaded." }, { status: 500 });
  }
}
