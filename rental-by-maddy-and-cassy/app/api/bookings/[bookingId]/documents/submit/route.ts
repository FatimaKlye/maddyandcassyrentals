import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
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
const ID_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const SIGNATURE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const metadataSchema = z.object({
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

function requireUpload(
  formData: FormData,
  key: string,
  label: string,
  allowedTypes: Set<string>,
): File {
  const value = formData.get(key);
  if (!(value instanceof File) || value.size === 0) {
    throw new RequestSecurityError(`${label} is required.`, 400);
  }
  if (value.size > MAX_FILE_SIZE) {
    throw new RequestSecurityError(`${label} must be 8MB or smaller.`, 400);
  }
  if (!allowedTypes.has(value.type)) {
    throw new RequestSecurityError(`${label} has an unsupported file type.`, 400);
  }
  return value;
}

function extensionFor(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "application/pdf") return "pdf";
  return "jpg";
}

async function savePrivateFile(
  bucket: ReturnType<ReturnType<typeof getAdminStorage>["bucket"]>,
  path: string,
  file: File,
): Promise<void> {
  await bucket.file(path).save(Buffer.from(await file.arrayBuffer()), {
    resumable: false,
    metadata: {
      contentType: file.type,
      cacheControl: "private, no-store, max-age=0",
    },
  });
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const uploadedPaths: string[] = [];

  try {
    enforceRateLimit(request, "booking-document-submit", 6, 10 * 60_000);
    await enforceAppCheck(request);
    const user = await requireUser(request);
    const { bookingId } = await params;
    const formData = await request.formData();
    const rawMetadata = formData.get("metadata");
    if (typeof rawMetadata !== "string") {
      throw new RequestSecurityError("The document details are missing.", 400);
    }

    const metadata = metadataSchema.parse(JSON.parse(rawMetadata));
    const idOne = requireUpload(
      formData,
      "idOne",
      "First valid ID",
      ID_CONTENT_TYPES,
    );
    const idTwo = requireUpload(
      formData,
      "idTwo",
      "Second valid ID",
      ID_CONTENT_TYPES,
    );
    const selfie = requireUpload(
      formData,
      "selfie",
      "Selfie holding a valid ID",
      ID_CONTENT_TYPES,
    );
    const emergencyId = requireUpload(
      formData,
      "emergencyId",
      "Emergency contact ID",
      ID_CONTENT_TYPES,
    );
    const signature = requireUpload(
      formData,
      "signature",
      "Electronic signature",
      SIGNATURE_CONTENT_TYPES,
    );

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
      return errorResponse("Complete the reservation payment before submitting documents.", 409);
    }
    if (String(booking.requirementsStatus) !== "not_submitted") {
      return errorResponse("Verification documents have already been submitted.", 409);
    }

    const submissionId = randomUUID();
    const requirementsBase =
      `private/users/${user.uid}/bookings/${bookingId}/requirements`;
    const signaturePath =
      `private/users/${user.uid}/bookings/${bookingId}/signatures/signature-${submissionId}.${extensionFor(signature.type)}`;
    const paths = {
      idOne: `${requirementsBase}/id-one-${submissionId}.${extensionFor(idOne.type)}`,
      idTwo: `${requirementsBase}/id-two-${submissionId}.${extensionFor(idTwo.type)}`,
      selfie: `${requirementsBase}/selfie-${submissionId}.${extensionFor(selfie.type)}`,
      emergencyId:
        `${requirementsBase}/emergency-contact-id-${submissionId}.${extensionFor(emergencyId.type)}`,
      signature: signaturePath,
    };
    uploadedPaths.push(...Object.values(paths));

    const bucket = getAdminStorage().bucket();
    await Promise.all([
      savePrivateFile(bucket, paths.idOne, idOne),
      savePrivateFile(bucket, paths.idTwo, idTwo),
      savePrivateFile(bucket, paths.selfie, selfie),
      savePrivateFile(bucket, paths.emergencyId, emergencyId),
      savePrivateFile(bucket, paths.signature, signature),
    ]);

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
        idOneStoragePath: paths.idOne,
        idTwoStoragePath: paths.idTwo,
        selfieWithIdStoragePath: paths.selfie,
        facebookLink: metadata.facebookLink,
        instagramLink: metadata.instagramLink,
        emergencyContact: {
          ...metadata.emergencyContact,
          idStoragePath: paths.emergencyId,
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
          customerName: String(current.customerSnapshot?.fullName || metadata.typedFullName),
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
        acknowledgements: metadata.acknowledgements,
        signature: {
          method: metadata.signatureMethod,
          storagePath: paths.signature,
          typedFullName: metadata.typedFullName,
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
    if (uploadedPaths.length) {
      const bucket = getAdminStorage().bucket();
      await Promise.allSettled(
        uploadedPaths.map((path) =>
          bucket.file(path).delete({ ignoreNotFound: true }),
        ),
      );
    }
    if (error instanceof RequestSecurityError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return errorResponse(
        "Check the verification details and agreement, then try again.",
        400,
      );
    }
    console.error("Booking document submission failed", error);
    return errorResponse(
      "The documents could not be securely submitted. Please try again.",
      500,
    );
  }
}
