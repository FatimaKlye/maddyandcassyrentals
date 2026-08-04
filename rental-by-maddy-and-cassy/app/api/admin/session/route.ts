import { NextResponse } from "next/server";
import { enforceRateLimit, requireActiveAdmin, RequestSecurityError } from "@/src/lib/server/requestSecurity";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    enforceRateLimit(request, "admin-access-check", 60, 60_000);
    const { user } = await requireActiveAdmin();
    return NextResponse.json({ isAdmin: true, uid: user.id });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Administrator access could not be verified." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "admin-session", 10, 60_000);
    const { supabase, user } = await requireActiveAdmin();
    await supabase.rpc("log_audit_event", {
      p_action: "admin.login",
      p_entity_type: "admin_session",
      p_entity_id: user.id,
      p_metadata: {
        ip:
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request.headers.get("x-real-ip") ??
          "unknown",
        userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? "",
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "The administrator session could not be recorded." }, { status: 500 });
  }
}
