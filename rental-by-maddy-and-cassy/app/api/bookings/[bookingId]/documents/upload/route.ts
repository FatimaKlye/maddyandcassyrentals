import { NextResponse } from "next/server";
import { getAdminDb, getAdminStorage } from "@/src/lib/firebase/admin";
import {
  enforceAppCheck,
  enforceRateLimit,
  requireUser,
  RequestSecurityError,
} from "@/src/lib/server/requestSecurity";

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
const UPLOAD_KINDS = {
  idOne: { fileName: "id-one", folder: "requirements", signature: false },
  idTwo: { fileName: "id-two", folder: "requirements", signature: false },
  selfie: { fileName: "selfie", folder: "requirements", signature: false },
  emergencyId: {
    fileName: "emergency-contact-id",
    folder: "requirements",
    signature: false,
  },
  signature: { fileName: "signature", folder: "signatures", signature: true },
} as const;

type UploadKind = keyof typeof UPLOAD_KINDS;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function extensionFor(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "application/pdf") return "pdf";
  return "jpg";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    enforceRateLimit(request, "booking-document-upload", 30, 10 * 60_000);
    await enforceAppCheck(request);
    const user = await requireUser(request);
    const { bookingId } = await params;
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") as UploadKind | null;
    const submissionId = url.searchParams.get("submissionId") ?? "";
    if (!kind || !(kind in UPLOAD_KINDS)) {
      throw new RequestSecurityError("The document type is invalid.", 400);
    }
    if (!/^[0-9a-f-]{36}$/i.test(submissionId)) {
      throw new RequestSecurityError("The upload session is invalid.", 400);
    }

    const db = getAdminDb();
    const bookingSnapshot = await db.collection("bookings").doc(bookingId).get();
    const booking = bookingSnapshot.data();
    if (!bookingSnapshot.exists || !booking) {
      return errorResponse("The booking could not be found.", 404);
    }
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

    const formData = await request.formData();
    const value = formData.get("file");
    if (!(value instanceof File) || value.size === 0) {
      throw new RequestSecurityError("Choose a file to upload.", 400);
    }
    if (value.size > MAX_FILE_SIZE) {
      throw new RequestSecurityError("Each file must be 8MB or smaller.", 400);
    }
    const uploadKind = UPLOAD_KINDS[kind];
    const allowedTypes = uploadKind.signature
      ? SIGNATURE_CONTENT_TYPES
      : ID_CONTENT_TYPES;
    if (!allowedTypes.has(value.type)) {
      throw new RequestSecurityError("The selected file type is not supported.", 400);
    }

    const path =
      `private/users/${user.uid}/bookings/${bookingId}/${uploadKind.folder}/` +
      `${uploadKind.fileName}-${submissionId}.${extensionFor(value.type)}`;
    await getAdminStorage()
      .bucket()
      .file(path)
      .save(Buffer.from(await value.arrayBuffer()), {
        resumable: false,
        metadata: {
          contentType: value.type,
          cacheControl: "private, no-store, max-age=0",
        },
      });

    return NextResponse.json({ success: true, path });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return errorResponse(error.message, error.status);
    }
    console.error("Private booking document upload failed", error);
    return errorResponse("This file could not be securely uploaded.", 500);
  }
}
