import { NextResponse } from "next/server";
import { requireActiveAdmin } from "@/src/lib/server/requestSecurity";
import { createAdminClient } from "@/src/lib/supabase/admin";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const { uid: targetUid } = await params;
  if (!targetUid || targetUid.length > 128) return errorResponse("The selected account is invalid.", 400);

  try {
    const { supabase, user } = await requireActiveAdmin();
    if (user.id === targetUid) {
      return errorResponse("You cannot delete the account you are currently using.", 409);
    }

    const { data: targetAdmin } = await supabase
      .from("admins")
      .select("user_id, is_active")
      .eq("user_id", targetUid)
      .maybeSingle();
    if (targetAdmin?.is_active) {
      return errorResponse("Administrator accounts are protected and cannot be deleted from customer management.", 409);
    }

    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(targetUid);
    if (error && !error.message.includes("not found") && !error.message.includes("User not found")) {
      throw new Error(error.message);
    }

    // profiles.id references auth.users(id) on delete cascade, so the
    // profile row (and its notifications/push subscriptions) are removed
    // automatically. Booking and payment history remain, keyed by user_id,
    // for business record-keeping.
    await admin.rpc("log_audit_event", {
      p_action: "account.deleted",
      p_entity_type: "user",
      p_entity_id: targetUid,
      p_metadata: { bookingHistoryPreserved: true },
    });

    return NextResponse.json({ deleted: true, uid: targetUid, bookingHistoryPreserved: true });
  } catch (error) {
    console.error("Admin customer deletion failed", error);
    return errorResponse("The customer account could not be deleted. Please try again.", 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const { uid: targetUid } = await params;
  if (!targetUid || targetUid.length > 128) return errorResponse("The selected account is invalid.", 400);

  const body = (await request.json().catch(() => null)) as
    | {
        displayName?: unknown;
        phoneNumber?: unknown;
        fullAddress?: unknown;
        accountStatus?: unknown;
        role?: unknown;
      }
    | null;
  if (!body) return errorResponse("The account update is invalid.", 400);

  try {
    const { supabase, user } = await requireActiveAdmin();

    const { data: target } = await supabase.from("profiles").select("*").eq("id", targetUid).maybeSingle();
    if (!target) return errorResponse("This user account no longer exists.", 404);

    const accountStatus = body.accountStatus === "active" || body.accountStatus === "suspended" ? body.accountStatus : target.account_status;
    const role = body.role === "admin" || body.role === "customer" ? body.role : target.display_role;
    if (user.id === targetUid && (accountStatus !== "active" || role !== "admin")) {
      return errorResponse("You cannot suspend or demote the account you are using.", 409);
    }

    const clean = (value: unknown, max: number, fallback: string) =>
      typeof value === "string" ? value.trim().slice(0, max) : fallback;

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        display_name: clean(body.displayName, 150, target.display_name),
        phone_number: clean(body.phoneNumber, 50, target.phone_number ?? ""),
        full_address: clean(body.fullAddress, 500, target.full_address ?? ""),
        account_status: accountStatus,
        display_role: role,
      })
      .eq("id", targetUid);
    if (profileError) throw new Error(profileError.message);

    if (role === "admin") {
      await supabase.from("admins").upsert(
        { user_id: targetUid, is_active: accountStatus === "active", created_by: user.id },
        { onConflict: "user_id" },
      );
    } else {
      await supabase.from("admins").update({ is_active: false }).eq("user_id", targetUid);
    }

    await supabase.rpc("log_audit_event", {
      p_action: "account.updated",
      p_entity_type: "user",
      p_entity_id: targetUid,
      p_previous_values: { accountStatus: target.account_status, role: target.display_role },
      p_new_values: { accountStatus, role },
    });

    return NextResponse.json({ success: true, uid: targetUid, accountStatus, role });
  } catch (error) {
    console.error("Admin account update failed", error);
    return errorResponse("The account could not be updated.", 500);
  }
}
