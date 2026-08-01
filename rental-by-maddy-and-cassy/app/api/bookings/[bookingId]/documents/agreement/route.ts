import { NextResponse } from "next/server";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { getAdminDb } from "@/src/lib/firebase/admin";
import {
  enforceAppCheck,
  enforceRateLimit,
  requireUser,
  RequestSecurityError,
} from "@/src/lib/server/requestSecurity";
import { generateAndSaveFinalAgreement } from "@/src/lib/server/customerDocuments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    enforceRateLimit(request, "signed-agreement", 6, 60_000);
    await enforceAppCheck(request);
    const user = await requireUser(request);
    const { bookingId } = await params;
    const db = getAdminDb();
    const bookingRef = db.collection("bookings").doc(bookingId);
    const agreementRef = bookingRef.collection("agreement").doc("main");
    const [bookingSnapshot, agreementSnapshot] = await Promise.all([
      bookingRef.get(),
      agreementRef.get(),
    ]);

    if (!bookingSnapshot.exists || !agreementSnapshot.exists) {
      return errorResponse("The signed agreement could not be found.", 404);
    }
    const booking: DocumentData & { id: string } = {
      id: bookingSnapshot.id,
      ...(bookingSnapshot.data() ?? {}),
    };
    const agreement = agreementSnapshot.data() ?? {};
    if (booking.userId !== user.uid) {
      return errorResponse("You do not have access to this booking.", 403);
    }
    if (!["paid", "partially_paid"].includes(String(booking.paymentStatus))) {
      return errorResponse("A verified reservation payment is required first.", 409);
    }
    if (agreement.status !== "submitted_for_review") {
      return errorResponse("The rental agreement has not been submitted.", 409);
    }

    const storagePath =
      `private/users/${user.uid}/bookings/${bookingId}/documents/signed-agreement-${booking.bookingRef}.pdf`;
    await generateAndSaveFinalAgreement({
      booking,
      agreement,
      paymentReference:
        typeof booking.paymentReference === "string"
          ? booking.paymentReference
          : "Verified through PayMongo",
      storagePath,
    });

    const now = Timestamp.now();
    const batch = db.batch();
    batch.update(agreementRef, {
      finalAgreementPath: storagePath,
      updatedAt: now,
    });
    batch.set(bookingRef.collection("documents").doc("signed-rental-agreement"), {
      type: "final_rental_agreement",
      storagePath,
      title: "Signed Rental Agreement",
      generatedAt: now,
    });
    await batch.commit();

    return NextResponse.json({ success: true, storagePath });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return errorResponse(error.message, error.status);
    }
    console.error("Signed agreement PDF generation failed", error);
    return errorResponse("The signed agreement PDF could not be prepared.", 500);
  }
}
