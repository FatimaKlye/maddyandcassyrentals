import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/src/lib/firebase/admin";
import {
  requireAdmin,
  RequestSecurityError,
} from "@/src/lib/server/requestSecurity";
import type {
  RequirementDocumentKey,
  RequirementReviewStatus,
} from "@/src/types/booking";

export const runtime = "nodejs";

const DOCUMENT_KEYS = new Set<RequirementDocumentKey>([
  "idOneStoragePath",
  "idTwoStoragePath",
  "selfieWithIdStoragePath",
  "emergencyContactIdStoragePath",
]);
const REVIEW_STATUSES = new Set<RequirementReviewStatus>([
  "pending",
  "approved",
  "rejected",
  "replacement_requested",
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
): Promise<NextResponse> {
  try {
    const db = getAdminDb();
    const admin = await requireAdmin(request, db);
    const { bookingId } = await params;
    const body = (await request.json().catch(() => null)) as
      | { documentKey?: unknown; status?: unknown; reason?: unknown }
      | null;
    const documentKey = body?.documentKey as RequirementDocumentKey;
    const status = body?.status as RequirementReviewStatus;
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (!DOCUMENT_KEYS.has(documentKey) || !REVIEW_STATUSES.has(status)) {
      return NextResponse.json({ error: "Choose a valid document review action." }, { status: 400 });
    }
    if (["rejected", "replacement_requested"].includes(status) && !reason) {
      return NextResponse.json({ error: "Add a reason for the requested replacement." }, { status: 400 });
    }
    if (reason.length > 1000) {
      return NextResponse.json({ error: "Review notes must be 1,000 characters or fewer." }, { status: 400 });
    }

    const bookingRef = db.collection("bookings").doc(bookingId);
    const requirementsRef = bookingRef.collection("requirements").doc("main");
    await db.runTransaction(async (transaction) => {
      const [bookingSnapshot, requirementsSnapshot] = await transaction.getAll(
        bookingRef,
        requirementsRef,
      );
      if (!bookingSnapshot.exists || !requirementsSnapshot.exists) {
        throw new Error("NOT_FOUND");
      }
      const booking = bookingSnapshot.data() ?? {};
      const requirements = requirementsSnapshot.data() ?? {};
      const now = Timestamp.now();
      const reviews = {
        ...(typeof requirements.reviews === "object" && requirements.reviews
          ? requirements.reviews
          : {}),
        [documentKey]: {
          status,
          ...(reason ? { reason } : {}),
          reviewedBy: admin.uid,
          reviewedAt: now,
        },
      };
      const expectedKeys: RequirementDocumentKey[] = [
        "idOneStoragePath",
        "idTwoStoragePath",
        "selfieWithIdStoragePath",
        "emergencyContactIdStoragePath",
      ];
      const allApproved = expectedKeys.every(
        (key) => reviews[key]?.status === "approved",
      );
      const correctionNeeded = expectedKeys.some((key) =>
        ["rejected", "replacement_requested"].includes(reviews[key]?.status),
      );
      const requirementsStatus = allApproved
        ? "verified"
        : correctionNeeded
          ? "correction_required"
          : "submitted";

      transaction.update(requirementsRef, {
        reviews,
        status: requirementsStatus,
        correctionNotes: correctionNeeded ? reason : FieldValue.delete(),
        updatedAt: now,
      });
      const bookingUpdates: Record<string, unknown> = {
        requirementsStatus,
        updatedAt: now,
      };
      if (correctionNeeded) {
        bookingUpdates.status = "correction_required";
        bookingUpdates.adminRemarks = reason;
      } else if (booking.status === "correction_required" && allApproved) {
        bookingUpdates.status = "under_review";
      }
      transaction.update(bookingRef, bookingUpdates);

      const userId = typeof booking.userId === "string" ? booking.userId : "";
      if (userId) {
        transaction.set(db.collection("users").doc(userId).collection("notifications").doc(), {
          recipientId: userId,
          bookingId,
          type: correctionNeeded ? "correction_required" : "requirements_reviewed",
          title: correctionNeeded ? "Document replacement requested" : "Verification document reviewed",
          message: correctionNeeded
            ? reason
            : `${documentKey.replaceAll("StoragePath", "")} was ${status}.`,
          actionUrl: `/account/bookings/${bookingId}`,
          isRead: false,
          createdAt: now,
        });
      }
      transaction.set(db.collection("auditLogs").doc(), {
        action: "verification.document_reviewed",
        actorType: "admin",
        actorId: admin.uid,
        bookingId,
        targetType: "requirement_document",
        targetId: documentKey,
        metadata: { status, reason },
        createdAt: now,
      });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "The booking requirements could not be found." }, { status: 404 });
    }
    console.error("Requirement review failed", error);
    return NextResponse.json({ error: "The document review could not be saved." }, { status: 500 });
  }
}
