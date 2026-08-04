import { NextResponse } from "next/server";
import { enforceRateLimit, requireActiveAdmin, RequestSecurityError } from "@/src/lib/server/requestSecurity";

export const runtime = "nodejs";

const REVIEW_STATUSES = new Set(["approved", "rejected"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    enforceRateLimit(request, "admin-document-review", 60, 60_000);
    const { supabase, user } = await requireActiveAdmin();
    const { bookingId } = await params;

    const body = (await request.json().catch(() => null)) as
      | { documentId?: unknown; status?: unknown; reason?: unknown }
      | null;
    const documentId = typeof body?.documentId === "string" ? body.documentId : "";
    const rawStatus = body?.status;
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

    if (!documentId || typeof rawStatus !== "string" || !REVIEW_STATUSES.has(rawStatus)) {
      return NextResponse.json({ error: "Choose a valid document review action." }, { status: 400 });
    }
    const status = rawStatus as "approved" | "rejected";
    if (status === "rejected" && !reason) {
      return NextResponse.json({ error: "Add a reason for the rejection." }, { status: 400 });
    }
    if (reason.length > 1000) {
      return NextResponse.json({ error: "Review notes must be 1,000 characters or fewer." }, { status: 400 });
    }

    const { data: document } = await supabase
      .from("booking_documents")
      .select("id, booking_id, user_id, document_type")
      .eq("id", documentId)
      .eq("booking_id", bookingId)
      .maybeSingle();
    if (!document) return NextResponse.json({ error: "The document could not be found." }, { status: 404 });

    const now = new Date().toISOString();
    await supabase
      .from("booking_documents")
      .update({
        review_status: status,
        review_notes: reason || null,
        reviewed_by: user.id,
        reviewed_at: now,
      })
      .eq("id", documentId);

    await supabase.from("requirement_document_reviews").insert({
      booking_document_id: documentId,
      status,
      notes: reason || null,
      reviewed_by: user.id,
      reviewed_at: now,
    });

    const { data: allDocuments } = await supabase
      .from("booking_documents")
      .select("review_status")
      .eq("booking_id", bookingId);

    const statuses = (allDocuments ?? []).map((d) => d.review_status);
    const requirementsStatus = statuses.some((s) => s === "rejected")
      ? "rejected"
      : statuses.length > 0 && statuses.every((s) => s === "approved")
        ? "approved"
        : "pending_review";

    await supabase.from("bookings").update({ requirements_status: requirementsStatus }).eq("id", bookingId);

    await supabase.from("notifications").insert({
      user_id: document.user_id,
      booking_id: bookingId,
      type: "requirements_reviewed",
      title: status === "approved" ? "Verification document approved" : "Document replacement requested",
      message:
        status === "approved"
          ? `Your ${document.document_type.replace(/_/g, " ")} was approved.`
          : reason,
      action_url: `/account/bookings/${bookingId}`,
    });

    await supabase.rpc("log_audit_event", {
      p_action: "verification.document_reviewed",
      p_entity_type: "booking_document",
      p_entity_id: documentId,
      p_booking_id: bookingId,
      p_new_values: { status, reason },
    });

    return NextResponse.json({ success: true, requirementsStatus });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Requirement review failed", error);
    return NextResponse.json({ error: "The document review could not be saved." }, { status: 500 });
  }
}
