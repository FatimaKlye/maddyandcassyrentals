import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, requireUser, RequestSecurityError } from "@/src/lib/server/requestSecurity";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { RENTAL_TERMS_VERSION } from "@/src/lib/rentalAgreement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function expectedPrefix(userId: string, bookingId: string, fileName: string, submissionId: string): string {
  return `${userId}/${bookingId}/${fileName}-${submissionId}.`;
}

async function verifyUploadedFile(
  admin: ReturnType<typeof createAdminClient>,
  bucket: "booking-documents" | "customer-documents",
  path: string,
  expectedPathPrefix: string,
): Promise<void> {
  if (!path.startsWith(expectedPathPrefix) || path.slice(expectedPathPrefix.length).includes("/")) {
    throw new RequestSecurityError("An uploaded document reference is invalid.", 400);
  }
  const folder = path.slice(0, path.lastIndexOf("/"));
  const fileName = path.slice(path.lastIndexOf("/") + 1);
  const { data } = await admin.storage.from(bucket).list(folder, { search: fileName });
  if (!data?.some((entry) => entry.name === fileName)) {
    throw new RequestSecurityError("An uploaded document could not be verified.", 400);
  }
}

<<<<<<< HEAD
export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
=======
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
>>>>>>> 33630b5409c8d7d7f3ae7359564ad097aa42a444
  try {
    enforceRateLimit(request, "booking-document-submit", 8, 10 * 60_000);
    const { user } = await requireUser();
    const { bookingId } = await params;
    const input = metadataSchema.parse(await request.json());
    const admin = createAdminClient();

<<<<<<< HEAD
    await Promise.all([
      verifyUploadedFile(admin, "booking-documents", input.files.idOne, expectedPrefix(user.id, bookingId, "id-one", input.submissionId)),
      verifyUploadedFile(admin, "booking-documents", input.files.idTwo, expectedPrefix(user.id, bookingId, "id-two", input.submissionId)),
      verifyUploadedFile(admin, "booking-documents", input.files.selfie, expectedPrefix(user.id, bookingId, "selfie", input.submissionId)),
      verifyUploadedFile(admin, "booking-documents", input.files.emergencyId, expectedPrefix(user.id, bookingId, "emergency-contact-id", input.submissionId)),
      verifyUploadedFile(admin, "customer-documents", input.files.signature, expectedPrefix(user.id, bookingId, "signature", input.submissionId)),
    ]);
=======
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
>>>>>>> 33630b5409c8d7d7f3ae7359564ad097aa42a444

    const { data: booking } = await admin.from("bookings").select("*").eq("id", bookingId).maybeSingle();
    if (!booking) return errorResponse("The booking could not be found.", 404);
    if (booking.user_id !== user.id) return errorResponse("You do not have access to this booking.", 403);
    if (booking.requirements_status !== "not_submitted") {
      return errorResponse("Verification documents have already been submitted.", 409);
    }
    const { data: verifiedPayment } = await admin
      .from("payment_records")
      .select("id")
      .eq("booking_id", bookingId)
      .in("status", ["paid", "verified"])
      .limit(1)
      .maybeSingle();
    if (!verifiedPayment) {
      return errorResponse("Complete the reservation payment before submitting documents.", 409);
    }

    const now = new Date().toISOString();
    const documentRows = [
      { type: "government_id" as const, path: input.files.idOne, name: "id-one" },
      { type: "secondary_id" as const, path: input.files.idTwo, name: "id-two" },
      { type: "selfie_with_id" as const, path: input.files.selfie, name: "selfie" },
      { type: "authorization_letter" as const, path: input.files.emergencyId, name: "emergency-contact-id" },
    ];

    const { error: docsError } = await admin.from("booking_documents").insert(
      documentRows.map((doc) => ({
        booking_id: bookingId,
        user_id: user.id,
        document_type: doc.type,
        storage_bucket: "booking-documents",
        storage_path: doc.path,
        original_filename: doc.name,
        review_status: "pending" as const,
      })),
    );
    if (docsError) throw new Error(docsError.message);

    const productSnapshot = booking.product_snapshot as { name?: string; pricePerDay?: number; currency?: string; included?: string[] };
    const agreementSnapshot = {
      customerName: (booking.customer_snapshot as { fullName?: string })?.fullName || input.typedFullName,
      productName: productSnapshot?.name || "Rental item",
      startDate: booking.rental_start_date,
      endDate: booking.rental_end_date,
      dayCount: booking.rental_days ?? 1,
      fulfillmentMethod: booking.fulfillment_method,
      customerLocation: booking.location || "",
      pricePerDay: booking.daily_rate,
      currency: "PHP",
      includedAccessories: productSnapshot?.included ?? [],
    };

    const { data: agreement, error: agreementError } = await admin
      .from("booking_agreements")
      .insert({
        booking_id: bookingId,
        status: "awaiting_business_signature",
        agreement_version: RENTAL_TERMS_VERSION,
        agreement_snapshot: agreementSnapshot,
        version_number: 1,
      })
      .select("id")
      .single();
    if (agreementError || !agreement) throw new Error(agreementError?.message ?? "Agreement could not be created.");

    await admin.from("agreement_acknowledgements").insert(
      (Object.keys(input.acknowledgements) as Array<keyof typeof input.acknowledgements>).map((key) => ({
        agreement_id: agreement.id,
        user_id: user.id,
        acknowledgement_key: key,
        acknowledged: true,
        acknowledged_at: now,
      })),
    );

    await admin.from("agreement_signatures").insert({
      agreement_id: agreement.id,
      signer_user_id: user.id,
      signer_role: "customer",
      signer_name: input.typedFullName,
      signature_path: input.files.signature,
      signature_data: { method: input.signatureMethod },
      signed_at: now,
    });

    await admin.from("booking_emergency_contacts").upsert(
      {
        booking_id: bookingId,
        full_name: input.emergencyContact.fullName,
        relationship: input.emergencyContact.relationship,
        phone_number: input.emergencyContact.phone,
        address: "",
      },
      { onConflict: "booking_id" },
    );

    await admin
      .from("bookings")
      .update({ requirements_status: "pending_review", agreement_status: "awaiting_business_signature" })
      .eq("id", bookingId);

    await admin.from("booking_status_history").insert({
      booking_id: bookingId,
      from_status: booking.status,
      to_status: booking.status,
      note: "Customer submitted verification documents and signed the rental agreement.",
      changed_by: user.id,
    });

    await admin.rpc("log_audit_event", {
      p_action: "booking.documents_submitted",
      p_entity_type: "booking",
      p_entity_id: bookingId,
      p_booking_id: bookingId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RequestSecurityError) return errorResponse(error.message, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return errorResponse("Check the verification details and agreement, then try again.", 400);
    }
    console.error("Booking document finalization failed", error);
    return errorResponse("The documents could not be finalized. Please try again.", 500);
  }
}
