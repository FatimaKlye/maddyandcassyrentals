import { Timestamp, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/src/lib/firebase/config";
import type { Product } from "@/types/product";
import type { ReservationDraft } from "@/src/types/reservationDraft";
import { getDayCount } from "@/src/types/reservationDraft";
import { toDateKey } from "@/src/services/availabilityService";
import { DatesUnavailableError } from "@/src/services/inventoryService";
import { TERMS_VERSION } from "@/components/reservation/AgreementDocument";

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
}

export async function submitBooking(
  product: Product,
  userId: string,
  draft: ReservationDraft
): Promise<SubmitBookingResult> {
  if (!draft.startDate || !draft.endDate || !draft.fulfillmentMethod) {
    throw new Error("Missing rental details.");
  }

  const { requirements } = draft;
  if (
    !requirements.idOneFile ||
    !requirements.idTwoFile ||
    !requirements.selfieFile ||
    !requirements.emergencyContact.idFile
  ) {
    throw new Error("Missing required documents.");
  }

  const dayCount = getDayCount(draft.startDate, draft.endDate);

  const { bookingId, bookingNumber } = await callSubmitBookingApi({
    productId: product.id,
    startDate: toDateKey(draft.startDate),
    endDate: toDateKey(draft.endDate),
    dayCount,
    fulfillmentMethod: draft.fulfillmentMethod,
    customerLocation: draft.customerLocation,
  });

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
      startDate: Timestamp.fromDate(draft.startDate),
      endDate: Timestamp.fromDate(draft.endDate),
      dayCount,
      fulfillmentMethod: draft.fulfillmentMethod,
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

  return { bookingId };
}

function extensionOf(file: File): string {
  const parts = file.name.split(".");
  if (parts.length > 1) return parts[parts.length - 1].toLowerCase();
  if (file.type === "application/pdf") return "pdf";
  return "jpg";
}
