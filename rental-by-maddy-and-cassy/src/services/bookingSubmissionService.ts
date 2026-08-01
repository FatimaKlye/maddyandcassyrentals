import { auth, storage } from "@/src/lib/firebase/config";
import { ref, uploadBytes } from "firebase/storage";
import type { Product } from "@/types/product";
import type { ReservationDraft } from "@/src/types/reservationDraft";
import { getDayCount } from "@/src/types/reservationDraft";
import { toDateKey } from "@/src/services/availabilityService";
import { DatesUnavailableError } from "@/src/services/inventoryService";
import { getAppCheckHeaders } from "@/src/lib/firebase/appCheckClient";

interface SubmitBookingApiResponse {
  success: boolean;
  bookingId?: string;
  bookingNumber?: string;
  code?: string;
  message?: string;
}

async function callSubmitBookingApi(input: {
  productId: string;
  startDate: string;
  endDate: string;
  dayCount: number;
  fulfillmentMethod: string;
  customerLocation: string;
  customerSnapshot: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    facebookLink: string;
    instagramLink: string;
  };
}): Promise<{ bookingId: string; bookingNumber: string }> {
  if (!auth.currentUser) {
    throw new Error("You must be signed in to submit a booking.");
  }
  const idToken = await auth.currentUser.getIdToken();

  const response = await fetch("/api/bookings/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(input),
  });

  const data = (await response.json()) as SubmitBookingApiResponse;

  if (!response.ok || !data.success || !data.bookingId || !data.bookingNumber) {
    if (data.code === "fully-booked" || data.code === "booking-conflict") {
      throw new DatesUnavailableError();
    }
    throw new Error(data.message ?? "We couldn't submit your booking request. Please try again.");
  }

  return { bookingId: data.bookingId, bookingNumber: data.bookingNumber };
}

export interface SubmitBookingResult {
  bookingId: string;
  bookingNumber?: string;
}

function validateReservationDetails(draft: ReservationDraft): void {
  if (!draft.startDate || !draft.endDate || !draft.fulfillmentMethod) {
    throw new Error("Missing rental details.");
  }

  const { customerInfo } = draft;
  if (
    !customerInfo.fullName.trim() ||
    !customerInfo.email.trim() ||
    !customerInfo.phone.trim() ||
    !customerInfo.address.trim() ||
    !customerInfo.facebookLink.trim() ||
    !customerInfo.instagramLink.trim()
  ) {
    throw new Error("Missing required customer information.");
  }
}

export async function createBookingReservation(
  product: Product,
  draft: ReservationDraft
): Promise<SubmitBookingResult> {
  validateReservationDetails(draft);
  const { customerInfo } = draft;
  const startDate = draft.startDate!;
  const endDate = draft.endDate!;
  const fulfillmentMethod = draft.fulfillmentMethod!;
  const dayCount = getDayCount(startDate, endDate);

  const { bookingId, bookingNumber } = await callSubmitBookingApi({
    productId: product.id,
    startDate: toDateKey(startDate),
    endDate: toDateKey(endDate),
    dayCount,
    fulfillmentMethod,
    customerLocation: draft.customerLocation,
    customerSnapshot: {
      fullName: customerInfo.fullName.trim(),
      email: customerInfo.email.trim(),
      phone: customerInfo.phone.trim(),
      address: customerInfo.address.trim(),
      facebookLink: customerInfo.facebookLink.trim(),
      instagramLink: customerInfo.instagramLink.trim(),
    },
  });

  return { bookingId, bookingNumber };
}

export async function submitBookingDocuments(
  bookingId: string,
  draft: ReservationDraft,
): Promise<void> {
  validateReservationDetails(draft);
  const { requirements } = draft;
  if (
    !requirements.idOneFile ||
    !requirements.idTwoFile ||
    !requirements.selfieFile ||
    !requirements.facebookLink.trim() ||
    !requirements.instagramLink.trim() ||
    !requirements.emergencyContact.fullName.trim() ||
    !requirements.emergencyContact.relationship.trim() ||
    !requirements.emergencyContact.phone.trim() ||
    !requirements.emergencyContact.facebookLink.trim() ||
    !requirements.emergencyContact.idFile
  ) {
    throw new Error("Missing required rental information or documents.");
  }

  const { agreement } = draft;
  if (
    !agreement.infoAccurate ||
    !agreement.agreedToTerms ||
    !agreement.understoodRentalRules ||
    !agreement.authorizedESignature ||
    !agreement.readPrivacyNotice ||
    !agreement.emergencyContactAuthorized ||
    !agreement.typedFullName.trim() ||
    !agreement.signatureDataUrl
  ) {
    throw new Error("Complete and sign the rental agreement before submitting.");
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Your session expired. Sign in again before submitting.");
  }
  const userId = currentUser.uid;

  const signatureBlob = dataUrlToBlob(agreement.signatureDataUrl);
  const signatureFile = new File(
    [signatureBlob],
    `signature.${extensionFromContentType(signatureBlob.type)}`,
    { type: signatureBlob.type || "image/png" },
  );
  const idToken = await currentUser.getIdToken();
  const appCheckHeaders = await getAppCheckHeaders();
  const submissionId = crypto.randomUUID();

  async function uploadDocument(
    kind: "idOne" | "idTwo" | "selfie" | "emergencyId" | "signature",
    file: File,
    label: string,
  ): Promise<string> {
    const directUpload = async (): Promise<string> => {
      const uploadTarget = {
        idOne: { folder: "requirements", fileName: "id-one" },
        idTwo: { folder: "requirements", fileName: "id-two" },
        selfie: { folder: "requirements", fileName: "selfie" },
        emergencyId: { folder: "requirements", fileName: "emergency-contact-id" },
        signature: { folder: "signatures", fileName: "signature" },
      }[kind];
      const path =
        `private/users/${userId}/bookings/${bookingId}/${uploadTarget.folder}/` +
        `${uploadTarget.fileName}-${submissionId}.${extensionFromContentType(file.type)}`;
      await uploadBytes(ref(storage, path), file, {
        contentType: file.type,
        cacheControl: "private, no-store, max-age=0",
      });
      return path;
    };

    const formData = new FormData();
    formData.append("file", file);
    let response: Response;
    try {
      response = await fetch(
        `/api/bookings/${encodeURIComponent(bookingId)}/documents/upload` +
          `?kind=${encodeURIComponent(kind)}&submissionId=${encodeURIComponent(submissionId)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            ...appCheckHeaders,
          },
          body: formData,
        },
      );
    } catch {
      try {
        return await directUpload();
      } catch (error) {
        console.error("Direct private document upload failed", error);
        throw new Error(
          `${label} could not reach the upload server. Check your connection and try again.`,
        );
      }
    }
    const body = (await response.json().catch(() => null)) as
      | { path?: unknown; error?: unknown }
      | null;
    if (response.ok && typeof body?.path === "string") {
      return body.path;
    }
    // During local development the server's Admin Storage connection can be
    // reset by the network. The same user-owned Storage path is safely
    // writable from the browser under storage.rules, so use that path as a
    // fallback only for server-side failures.
    if (response.status >= 500) {
      try {
        return await directUpload();
      } catch (error) {
        console.error("Direct private document upload failed", error);
      }
    }
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : `${label} could not be uploaded.`,
    );
  }

  const uploadedFiles = {
    idOne: await uploadDocument(
      "idOne",
      requirements.idOneFile,
      "First valid ID",
    ),
    idTwo: await uploadDocument(
      "idTwo",
      requirements.idTwoFile,
      "Second valid ID",
    ),
    selfie: await uploadDocument(
      "selfie",
      requirements.selfieFile,
      "Selfie with ID",
    ),
    emergencyId: await uploadDocument(
      "emergencyId",
      requirements.emergencyContact.idFile,
      "Emergency contact ID",
    ),
    signature: await uploadDocument(
      "signature",
      signatureFile,
      "Electronic signature",
    ),
  };

  const submitResponse = await fetch(
    `/api/bookings/${encodeURIComponent(bookingId)}/documents/submit`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
        ...appCheckHeaders,
      },
      body: JSON.stringify({
        submissionId,
        files: uploadedFiles,
      facebookLink: requirements.facebookLink.trim(),
      instagramLink: requirements.instagramLink.trim(),
      emergencyContact: {
        fullName: requirements.emergencyContact.fullName.trim(),
        relationship: requirements.emergencyContact.relationship.trim(),
        phone: requirements.emergencyContact.phone.trim(),
        facebookLink: requirements.emergencyContact.facebookLink.trim(),
      },
      acknowledgements: {
        infoAccurate: agreement.infoAccurate,
        agreedToTerms: agreement.agreedToTerms,
        understoodRentalRules: agreement.understoodRentalRules,
        authorizedESignature: agreement.authorizedESignature,
        readPrivacyNotice: agreement.readPrivacyNotice,
        emergencyContactAuthorized: agreement.emergencyContactAuthorized,
      },
      signatureMethod: agreement.signatureMethod,
      typedFullName: agreement.typedFullName.trim(),
      }),
    },
  );
  if (!submitResponse.ok) {
    const body = (await submitResponse.json().catch(() => null)) as
      | { error?: unknown }
      | null;
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : "The documents could not be securely submitted.",
    );
  }

  const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/documents/agreement`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        ...appCheckHeaders,
      },
  });
  if (!response.ok) {
    console.warn("Documents were submitted, but the signed agreement PDF is still being prepared.");
  }
}

export async function submitBooking(
  product: Product,
  userId: string,
  draft: ReservationDraft
): Promise<SubmitBookingResult> {
  const reservation = await createBookingReservation(product, draft);
  await submitBookingDocuments(
    reservation.bookingId,
    draft,
  );
  return reservation;
}

function extensionFromContentType(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "application/pdf") return "pdf";
  return "jpg";
}

function dataUrlToBlob(dataUrl: string): Blob {
  const separatorIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || separatorIndex < 0) {
    throw new Error("The electronic signature is invalid. Please sign again.");
  }

  const header = dataUrl.slice(5, separatorIndex);
  const encoded = dataUrl.slice(separatorIndex + 1);
  const isBase64 = header.endsWith(";base64");
  const contentType = header.replace(/;base64$/, "") || "image/png";

  try {
    if (isBase64) {
      const binary = window.atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return new Blob([bytes], { type: contentType });
    }

    return new Blob([decodeURIComponent(encoded)], { type: contentType });
  } catch {
    throw new Error("The electronic signature is invalid. Please sign again.");
  }
}
