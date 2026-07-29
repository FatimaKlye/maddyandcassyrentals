import { Timestamp, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/src/lib/firebase/config";
import type { Product } from "@/types/product";
import type { ReservationDraft } from "@/src/types/reservationDraft";
import { getDayCount } from "@/src/types/reservationDraft";
import { toDateKey } from "@/src/services/availabilityService";
import { DatesUnavailableError } from "@/src/services/inventoryService";
import { TERMS_VERSION } from "@/components/reservation/AgreementDocument";
import { getAppCheckHeaders } from "@/src/lib/firebase/appCheckClient";

async function uploadFile(path: string, file: File): Promise<string> {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  // Confirms the upload actually landed before we reference the path elsewhere.
  await getDownloadURL(storageRef);
  return path;
}

async function uploadSignature(userId: string, bookingId: string, draft: ReservationDraft): Promise<string> {
  const path = `private/users/${userId}/bookings/${bookingId}/signatures/signature.png`;
  const storageRef = ref(storage, path);

  if (draft.agreement.signatureFile) {
    await uploadBytes(storageRef, draft.agreement.signatureFile);
  } else if (draft.agreement.signatureDataUrl) {
    const response = await fetch(draft.agreement.signatureDataUrl);
    const blob = await response.blob();
    await uploadBytes(storageRef, blob);
  } else {
    throw new Error("Missing signature.");
  }

  return path;
}

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
  product: Product,
  userId: string,
  bookingId: string,
  bookingNumber: string,
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

  const dayCount = getDayCount(draft.startDate, draft.endDate);

  const requirementsPath = `private/users/${userId}/bookings/${bookingId}/requirements`;
  const [idOnePath, idTwoPath, selfiePath, emergencyIdPath, signaturePath] = await Promise.all([
    uploadFile(`${requirementsPath}/id-one.${extensionOf(requirements.idOneFile)}`, requirements.idOneFile),
    uploadFile(`${requirementsPath}/id-two.${extensionOf(requirements.idTwoFile)}`, requirements.idTwoFile),
    uploadFile(`${requirementsPath}/selfie.${extensionOf(requirements.selfieFile)}`, requirements.selfieFile),
    uploadFile(
      `${requirementsPath}/emergency-contact-id.${extensionOf(requirements.emergencyContact.idFile)}`,
      requirements.emergencyContact.idFile
    ),
    uploadSignature(userId, bookingId, draft),
  ]);

  const batch = writeBatch(db);

  batch.update(doc(db, "bookings", bookingId), {
    requirementsStatus: "submitted",
    agreementStatus: "submitted_for_review",
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, "bookings", bookingId, "requirements", "main"), {
    bookingId,
    userId,
    idOneStoragePath: idOnePath,
    idTwoStoragePath: idTwoPath,
    selfieWithIdStoragePath: selfiePath,
    facebookLink: requirements.facebookLink,
    instagramLink: requirements.instagramLink,
    emergencyContact: {
      fullName: requirements.emergencyContact.fullName,
      relationship: requirements.emergencyContact.relationship,
      phone: requirements.emergencyContact.phone,
      facebookLink: requirements.emergencyContact.facebookLink,
      idStoragePath: emergencyIdPath,
    },
    status: "submitted",
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, "bookings", bookingId, "agreement", "main"), {
    bookingId,
    userId,
    bookingRef: bookingNumber,
    generatedTermsVersion: TERMS_VERSION,
    agreementSnapshot: {
      customerName: draft.customerInfo.fullName,
      productName: product.name,
      startDate: Timestamp.fromDate(draft.startDate!),
      endDate: Timestamp.fromDate(draft.endDate!),
      dayCount,
      fulfillmentMethod: draft.fulfillmentMethod!,
      customerLocation: draft.customerLocation,
      pricePerDay: product.pricePerDay,
      currency: product.currency,
      includedAccessories: product.included,
    },
    acknowledgements: {
      infoAccurate: draft.agreement.infoAccurate,
      agreedToTerms: draft.agreement.agreedToTerms,
      understoodRentalRules: draft.agreement.understoodRentalRules,
      authorizedESignature: draft.agreement.authorizedESignature,
      readPrivacyNotice: draft.agreement.readPrivacyNotice,
      emergencyContactAuthorized: draft.agreement.emergencyContactAuthorized,
    },
    signature: {
      method: draft.agreement.signatureMethod,
      storagePath: signaturePath,
      typedFullName: draft.agreement.typedFullName,
      signedAt: serverTimestamp(),
    },
    status: "submitted_for_review",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Your session expired before the agreement was finalized.");
  const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/documents/agreement`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await currentUser.getIdToken()}`,
      ...(await getAppCheckHeaders()),
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
    product,
    userId,
    reservation.bookingId,
    reservation.bookingNumber ?? reservation.bookingId,
    draft,
  );
  return reservation;
}

function extensionOf(file: File): string {
  const parts = file.name.split(".");
  if (parts.length > 1) return parts[parts.length - 1].toLowerCase();
  if (file.type === "application/pdf") return "pdf";
  return "jpg";
}
