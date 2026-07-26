import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, getAdminStorage } from "@/src/lib/firebase/admin";
import {
  createBookingReportPdf,
  type BookingReportAttachment,
  type BookingReportField,
  type BookingReportSection,
} from "@/src/lib/pdf/bookingReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length).trim() || null;
}

function asText(value: unknown, fallback = "Not provided"): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function asDate(value: unknown): Date | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

function formatDate(value: unknown, includeTime = false): string {
  const date = asDate(value);
  if (!date) return "Not recorded";
  return date.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(includeTime
      ? { hour: "numeric", minute: "2-digit", hour12: true }
      : {}),
  });
}

function formatStatus(value: unknown): string {
  return asText(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function yesNo(value: unknown): string {
  return value === true ? "Yes" : "No";
}

function asList(value: unknown): string {
  if (!Array.isArray(value)) return "None listed";
  const items = value.filter((item): item is string => typeof item === "string" && !!item.trim());
  return items.length ? items.join(", ") : "None listed";
}

function fileNameFromPath(path: string): string {
  return path.split("/").pop() || "attachment";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const token = getBearerToken(request);
  if (!token) return errorResponse("Administrator authentication is required.", 401);

  const { bookingId } = await params;
  if (!bookingId || bookingId.length > 150) {
    return errorResponse("The selected booking is invalid.", 400);
  }

  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    let adminUid: string;
    try {
      adminUid = (await adminAuth.verifyIdToken(token)).uid;
    } catch {
      return errorResponse("Your administrator session is invalid or expired.", 401);
    }

    const [adminSnapshot, bookingSnapshot] = await Promise.all([
      adminDb.collection("admins").doc(adminUid).get(),
      adminDb.collection("bookings").doc(bookingId).get(),
    ]);

    if (!adminSnapshot.exists || adminSnapshot.data()?.active !== true) {
      return errorResponse("Active administrator access is required.", 403);
    }
    if (!bookingSnapshot.exists) {
      return errorResponse("The selected booking no longer exists.", 404);
    }

    const booking = bookingSnapshot.data() ?? {};
    const userId = asText(booking.userId, "");
    const bookingRef = bookingSnapshot.ref;

    const [profileSnapshot, requirementsSnapshot, agreementSnapshot, historySnapshot] =
      await Promise.all([
        userId ? adminDb.collection("users").doc(userId).get() : Promise.resolve(null),
        bookingRef.collection("requirements").doc("main").get(),
        bookingRef.collection("agreement").doc("main").get(),
        bookingRef.collection("statusHistory").orderBy("createdAt", "asc").get(),
      ]);

    const profile = profileSnapshot?.exists ? profileSnapshot.data() ?? {} : {};
    const customer =
      typeof booking.customerSnapshot === "object" && booking.customerSnapshot !== null
        ? (booking.customerSnapshot as Record<string, unknown>)
        : {};
    const requirements = requirementsSnapshot.exists ? requirementsSnapshot.data() ?? {} : {};
    const emergency =
      typeof requirements.emergencyContact === "object" &&
      requirements.emergencyContact !== null
        ? (requirements.emergencyContact as Record<string, unknown>)
        : {};
    const agreement = agreementSnapshot.exists ? agreementSnapshot.data() ?? {} : {};
    const agreementDetails =
      typeof agreement.agreementSnapshot === "object" &&
      agreement.agreementSnapshot !== null
        ? (agreement.agreementSnapshot as Record<string, unknown>)
        : {};
    const acknowledgements =
      typeof agreement.acknowledgements === "object" &&
      agreement.acknowledgements !== null
        ? (agreement.acknowledgements as Record<string, unknown>)
        : {};
    const signature =
      typeof agreement.signature === "object" && agreement.signature !== null
        ? (agreement.signature as Record<string, unknown>)
        : {};
    const product =
      typeof booking.productSnapshot === "object" && booking.productSnapshot !== null
        ? (booking.productSnapshot as Record<string, unknown>)
        : {};

    const customerValue = (snapshotKey: string, profileKey: string) =>
      asText(customer[snapshotKey], asText(profile[profileKey]));

    const sections: BookingReportSection[] = [
      {
        title: "Booking Overview",
        fields: [
          { label: "Booking reference", value: asText(booking.bookingRef, bookingId) },
          { label: "Booking status", value: formatStatus(booking.status) },
          { label: "Requirements status", value: formatStatus(booking.requirementsStatus) },
          { label: "Agreement status", value: formatStatus(booking.agreementStatus) },
          { label: "Submitted", value: formatDate(booking.submittedAt, true) },
          { label: "Administrator remarks", value: asText(booking.adminRemarks, "None") },
        ],
      },
      {
        title: "Customer Information",
        fields: [
          { label: "Full name", value: customerValue("fullName", "displayName") },
          { label: "Email address", value: customerValue("email", "email") },
          { label: "Phone number", value: customerValue("phone", "phoneNumber") },
          { label: "Complete address", value: customerValue("address", "fullAddress") },
          { label: "Facebook profile", value: customerValue("facebookLink", "facebookLink") },
          { label: "Instagram profile", value: customerValue("instagramLink", "instagramLink") },
        ],
      },
      {
        title: "Rental Details",
        fields: [
          { label: "Product", value: asText(product.name) },
          { label: "Brand and category", value: `${asText(product.brand)} / ${asText(product.category)}` },
          { label: "Daily rate", value: `PHP ${Number(booking.pricePerDaySnapshot ?? 0).toLocaleString("en-PH")}` },
          { label: "Rental dates", value: `${formatDate(booking.startDate)} to ${formatDate(booking.endDate)}` },
          { label: "Duration", value: `${asText(booking.dayCount)} day(s)` },
          { label: "Handover method", value: formatStatus(booking.fulfillmentMethod) },
          { label: "Customer location", value: asText(booking.customerLocation) },
          {
            label: "Estimated rental amount",
            value: `PHP ${Number(booking.estimatedRentalAmount ?? 0).toLocaleString("en-PH")}`,
          },
          { label: "Assigned physical unit", value: asText(booking.assignedUnitId) },
          { label: "Included accessories", value: asList(product.included) },
        ],
      },
      {
        title: "Rental Requirements",
        fields: [
          { label: "Customer Facebook", value: asText(requirements.facebookLink) },
          { label: "Customer Instagram", value: asText(requirements.instagramLink) },
          { label: "Requirements submitted", value: formatDate(requirements.submittedAt, true) },
          { label: "Requirements review status", value: formatStatus(requirements.status) },
        ],
      },
      {
        title: "Emergency Contact",
        fields: [
          { label: "Full name", value: asText(emergency.fullName) },
          { label: "Relationship", value: asText(emergency.relationship) },
          { label: "Phone number", value: asText(emergency.phone) },
          { label: "Facebook profile", value: asText(emergency.facebookLink) },
        ],
      },
      {
        title: "Rental Agreement",
        fields: [
          { label: "Terms version", value: asText(agreement.generatedTermsVersion) },
          { label: "Agreement customer name", value: asText(agreementDetails.customerName) },
          { label: "Signed name", value: asText(signature.typedFullName) },
          { label: "Signature method", value: formatStatus(signature.method) },
          { label: "Signed at", value: formatDate(signature.signedAt, true) },
          { label: "Information accurate", value: yesNo(acknowledgements.infoAccurate) },
          { label: "Terms accepted", value: yesNo(acknowledgements.agreedToTerms) },
          { label: "Rental rules understood", value: yesNo(acknowledgements.understoodRentalRules) },
          { label: "Electronic signature authorized", value: yesNo(acknowledgements.authorizedESignature) },
          { label: "Privacy notice read", value: yesNo(acknowledgements.readPrivacyNotice) },
          { label: "Emergency contact authorized", value: yesNo(acknowledgements.emergencyContactAuthorized) },
        ],
      },
      {
        title: "Status History",
        fields: historySnapshot.docs.map((historyDocument, index): BookingReportField => {
          const entry = historyDocument.data();
          return {
            label: `Action ${index + 1} - ${formatDate(entry.createdAt, true)}`,
            value: `${formatStatus(entry.previousStatus)} -> ${formatStatus(entry.newStatus)}. ${asText(entry.message, "")}`.trim(),
          };
        }),
      },
    ];

    const attachmentEntries: Array<{ label: string; path: unknown }> = [
      { label: "First valid ID", path: requirements.idOneStoragePath },
      { label: "Second valid ID", path: requirements.idTwoStoragePath },
      { label: "Selfie holding valid ID", path: requirements.selfieWithIdStoragePath },
      { label: "Emergency contact ID", path: emergency.idStoragePath },
      { label: "Customer signature", path: signature.storagePath },
    ];

    const bucket = getAdminStorage().bucket();
    const attachments: BookingReportAttachment[] = await Promise.all(
      attachmentEntries
        .filter((entry): entry is { label: string; path: string } => typeof entry.path === "string" && !!entry.path)
        .map(async (entry) => {
          const file = bucket.file(entry.path);
          try {
            const [[bytes], [metadata]] = await Promise.all([
              file.download(),
              file.getMetadata(),
            ]);
            const contentType = metadata.contentType?.toLowerCase() ?? "";
            const supported =
              contentType.includes("pdf") ||
              contentType.includes("png") ||
              contentType.includes("jpeg") ||
              contentType.includes("jpg");
            return {
              label: entry.label,
              fileName: fileNameFromPath(entry.path),
              bytes: supported ? new Uint8Array(bytes) : undefined,
              contentType: metadata.contentType,
            };
          } catch {
            return {
              label: entry.label,
              fileName: fileNameFromPath(entry.path),
            };
          }
        }),
    );

    const pdfBytes = await createBookingReportPdf({
      bookingReference: asText(booking.bookingRef, bookingId),
      generatedAt: new Date().toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "long",
        timeStyle: "short",
      }),
      status: formatStatus(booking.status),
      sections,
      attachments,
    });

    const safeReference = asText(booking.bookingRef, bookingId).replace(/[^a-zA-Z0-9_-]/g, "_");

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="booking-${safeReference}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Admin booking PDF export failed", error);
    return errorResponse("The booking PDF could not be generated. Please try again.", 500);
  }
}
