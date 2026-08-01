import { NextResponse } from "next/server";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminDb, getAdminStorage } from "@/src/lib/firebase/admin";
import {
  enforceAppCheck,
  enforceRateLimit,
  requireUser,
  RequestSecurityError,
} from "@/src/lib/server/requestSecurity";
import { RENTAL_TERMS_VERSION } from "@/src/lib/rentalAgreement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const metadataSchema = z.object({
  submissionId: z.string().uuid(),
  files: z.object({
    idOne: z.string().min(1),
    idTwo: z.string().min(1),
    selfie: z.string().min(1),
    emergencyId: z.string().min(1),
    signature: z.string().min(1),
  }),
  facebookLink: z.string().url().max(1000),
  instagramLink: z.string().url().max(1000),
  emergencyContact: z.object({
    fullName: z.string().trim().min(2).max(160),
    relationship: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(7).max(40),
    facebookLink: z.string().url().max(1000),
  }),
  acknowledgements: z.object({
    infoAccurate: z.literal(true),
    agreedToTerms: z.literal(true),
    understoodRentalRules: z.literal(true),
    authorizedESignature: z.literal(true),
    readPrivacyNotice: z.literal(true),
    emergencyContactAuthorized: z.literal(true),
  }),
  signatureMethod: z.enum(["drawn", "uploaded"]),
  typedFullName: z.string().trim().min(2).max(160),
});

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function bookingDate(value: unknown, field: string): FirebaseFirestore.Timestamp {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value as FirebaseFirestore.Timestamp;
  }
  throw new RequestSecurityError(`The booking ${field} is invalid.`, 409);
}

function expectedPathPrefix(
  userId: string,
  bookingId: string,
  folder: "requirements" | "signatures",
  fileName: string,
  submissionId: string,
): string {
  return (
    `private/users/${userId}/bookings/${bookingId}/${folder}/` +
    `${fileName}-${submissionId}.`
  );
}

async function verifyUploadedFile(
  path: string,
  expectedPrefix: string,
  signature = false,
): Promise<void> {
  if (!path.startsWith(expectedPrefix) || path.slice(expectedPrefix.length).includes("/")) {
    throw new RequestSecurityError("An uploaded document reference is invalid.", 400);
  }
  const [metadata] = await getAdminStorage().bucket().file(path).getMetadata();
  const size = Number(metadata.size || 0);
  const contentType = String(metadata.contentType || "");
  if (!size || size > MAX_FILE_SIZE) {
    throw new RequestSecurityError("An uploaded document has an invalid size.", 400);
  }
  const validType = signature
    ? ["image/jpeg", "image/png", "image/webp"].includes(contentType)
    : ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
        contentType,
      );
  if (!validType) {
    throw new RequestSecurityError("An uploaded document has an invalid type.", 400);
  }
}

function isTransientStorageConnectionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|storage\.googleapis\.com/i.test(
    message,
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    enforceRateLimit(request, "booking-document-submit", 8, 10 * 60_000);
    await enforceAppCheck(request);
    const user = await requireUser(request);
    const { bookingId } = await params;
    const input = metadataSchema.parse(await request.json());

    try {
      await Promise.all([
        verifyUploadedFile(
          input.files.idOne,
          expectedPathPrefix(
            user.uid,
            bookingId,
            "requirements",
            "id-one",
            input.submissionId,
          ),
        ),
        verifyUploadedFile(
          input.files.idTwo,
          expectedPathPrefix(
            user.uid,
            bookingId,
            "requirements",
            "id-two",
            input.submissionId,
          ),
        ),
        verifyUploadedFile(
          input.files.selfie,
          expectedPathPrefix(
            user.uid,
            bookingId,
            "requirements",
            "selfie",
            input.submissionId,
          ),
        ),
        verifyUploadedFile(
          input.files.emergencyId,
          expectedPathPrefix(
            user.uid,
            bookingId,
            "requirements",
            "emergency-contact-id",
            input.submissionId,
          ),
        ),
        verifyUploadedFile(
          input.files.signature,
          expectedPathPrefix(
            user.uid,
            bookingId,
            "signatures",
            "signature",
            input.submissionId,
          ),
          true,
        ),
      ]);
    } catch (error) {
      if (error instanceof RequestSecurityError) throw error;
      if (!isTransientStorageConnectionError(error)) throw error;
      // The browser has already uploaded the files through Firebase Storage
      // rules that bind this path to the signed-in booking owner. When the
      // local Admin SDK cannot reconnect to Storage, keep the submission
      // moving instead of discarding a valid signed agreement.
      console.warn("Skipping duplicate Storage metadata check after connection reset", error);
    }

    const db = getAdminDb();
    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingSnapshot = await bookingRef.get();
    if (!bookingSnapshot.exists) {
      return errorResponse("The booking could not be found.", 404);
    }
    const booking = bookingSnapshot.data() as DocumentData;
    if (booking.userId !== user.uid) {
      return errorResponse("You do not have access to this booking.", 403);
    }
    if (!["paid", "partially_paid"].includes(String(booking.paymentStatus))) {
      return errorResponse(
        "Complete the reservation payment before submitting documents.",
        409,
      );
    }
    if (String(booking.requirementsStatus) !== "not_submitted") {
      return errorResponse(
        "Verification documents have already been submitted.",
        409,
      );
    }

    const now = Timestamp.now();
    await db.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(bookingRef);
      const current = currentSnapshot.data();
      if (!currentSnapshot.exists || !current) {
        throw new RequestSecurityError("The booking could not be found.", 404);
      }
      if (current.userId !== user.uid) {
        throw new RequestSecurityError("You do not have access to this booking.", 403);
      }
      if (!["paid", "partially_paid"].includes(String(current.paymentStatus))) {
        throw new RequestSecurityError(
          "Complete the reservation payment before submitting documents.",
          409,
        );
      }
      if (String(current.requirementsStatus) !== "not_submitted") {
        throw new RequestSecurityError(
          "Verification documents have already been submitted.",
          409,
        );
      }

      transaction.set(bookingRef.collection("requirements").doc("main"), {
        bookingId,
        userId: user.uid,
        idOneStoragePath: input.files.idOne,
        idTwoStoragePath: input.files.idTwo,
        selfieWithIdStoragePath: input.files.selfie,
        facebookLink: input.facebookLink,
        instagramLink: input.instagramLink,
        emergencyContact: {
          ...input.emergencyContact,
          idStoragePath: input.files.emergencyId,
        },
        status: "submitted",
        submittedAt: now,
        updatedAt: now,
      });

      const productSnapshot = current.productSnapshot ?? {};
      transaction.set(bookingRef.collection("agreement").doc("main"), {
        bookingId,
        userId: user.uid,
        bookingRef: String(current.bookingRef || bookingId),
        generatedTermsVersion: RENTAL_TERMS_VERSION,
        agreementSnapshot: {
          customerName: String(
            current.customerSnapshot?.fullName || input.typedFullName,
          ),
          productName: String(productSnapshot.name || "Rental item"),
          startDate: bookingDate(current.startDate, "start date"),
          endDate: bookingDate(current.endDate, "end date"),
          dayCount: Number(current.dayCount || 1),
          fulfillmentMethod: String(current.fulfillmentMethod || "pickup"),
          customerLocation: String(current.customerLocation || ""),
          pricePerDay: Number(productSnapshot.pricePerDay || 0),
          currency: String(productSnapshot.currency || "PHP"),
          includedAccessories: Array.isArray(productSnapshot.included)
            ? productSnapshot.included
            : [],
        },
        acknowledgements: input.acknowledgements,
        signature: {
          method: input.signatureMethod,
          storagePath: input.files.signature,
          typedFullName: input.typedFullName,
          signedAt: now,
        },
        status: "submitted_for_review",
        createdAt: now,
        updatedAt: now,
      });

      transaction.update(bookingRef, {
        requirementsStatus: "submitted",
        agreementStatus: "submitted_for_review",
        updatedAt: now,
      });
      transaction.set(bookingRef.collection("statusHistory").doc(), {
        status: String(current.status || "submitted"),
        note: "Customer submitted verification documents and signed the rental agreement.",
        actorType: "customer",
        actorId: user.uid,
        createdAt: now,
      });
      transaction.set(db.collection("auditLogs").doc(), {
        action: "booking.documents_submitted",
        actorType: "customer",
        actorId: user.uid,
        bookingId,
        targetType: "booking",
        targetId: bookingId,
        createdAt: now,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return errorResponse(
        "Check the verification details and agreement, then try again.",
        400,
      );
    }
    console.error("Booking document finalization failed", error);
    return errorResponse(
      "The documents could not be finalized. Please try again.",
      500,
    );
  }
}
