import { NextResponse } from "next/server";
import { enforceRateLimit, RequestSecurityError } from "@/src/lib/server/requestSecurity";
import { createClient } from "@/src/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    enforceRateLimit(request, "auth-session-sync", 15, 60_000);
    const body = (await request.json().catch(() => null)) as
      | { accessToken?: unknown; refreshToken?: unknown }
      | null;
    const accessToken = typeof body?.accessToken === "string" ? body.accessToken : "";
    const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken : "";
    if (!accessToken || !refreshToken) {
      return NextResponse.json({ error: "The signed-in session is incomplete." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error || !data.user) {
      return NextResponse.json({ error: "The signed-in session could not be saved." }, { status: 401 });
    }

    return NextResponse.json({ success: true, uid: data.user.id });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Session synchronization failed", error);
    return NextResponse.json({ error: "The signed-in session could not be saved." }, { status: 500 });
  }
}
