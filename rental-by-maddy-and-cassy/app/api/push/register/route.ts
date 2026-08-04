import { NextResponse } from "next/server";
import { enforceRateLimit, requireUser, RequestSecurityError } from "@/src/lib/server/requestSecurity";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "push-register", 10, 60_000);
    const { supabase, user } = await requireUser();
    const body = (await request.json().catch(() => null)) as
      | { endpoint?: unknown; p256dh?: unknown; auth?: unknown }
      | null;

    const endpoint = typeof body?.endpoint === "string" ? body.endpoint.trim() : "";
    const p256dh = typeof body?.p256dh === "string" ? body.p256dh.trim() : "";
    const auth = typeof body?.auth === "string" ? body.auth.trim() : "";

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "The push subscription is invalid." }, { status: 400 });
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh_key: p256dh,
        auth_key: auth,
        user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? "",
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Push registration failed", error);
    return NextResponse.json({ error: "Push notifications could not be enabled." }, { status: 500 });
  }
}
