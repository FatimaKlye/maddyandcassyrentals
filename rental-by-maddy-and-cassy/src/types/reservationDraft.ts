import type { FulfillmentMethod } from "@/src/types/booking";
import type { PaymentOption } from "@/src/types/payment";

export interface EmergencyContactDraft {
  fullName: string;
  relationship: string;
  phone: string;
  facebookLink: string;
  idFile: File | null;
}

export interface RequirementsDraft {
  idOneFile: File | null;
  idTwoFile: File | null;
  selfieFile: File | null;
  facebookLink: string;
  instagramLink: string;
  emergencyContact: EmergencyContactDraft;
}

export interface CustomerInfoDraft {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  facebookLink: string;
  instagramLink: string;
}

export type SignatureMethod = "drawn" | "uploaded";

export interface AgreementDraft {
  infoAccurate: boolean;
  agreedToTerms: boolean;
  understoodRentalRules: boolean;
  authorizedESignature: boolean;
  readPrivacyNotice: boolean;
  emergencyContactAuthorized: boolean;
  signatureMethod: SignatureMethod;
  signatureDataUrl: string | null;
  signatureFile: File | null;
  typedFullName: string;
}

export interface ReservationDraft {
  startDate: Date | null;
  endDate: Date | null;
  fulfillmentMethod: FulfillmentMethod | null;
  /** Street/barangay/landmark line. Only required (and only sent) when fulfillmentMethod is "delivery". */
  customerLocation: string;
  /** Required (and only sent) when fulfillmentMethod is "delivery". */
  cityMunicipality: string;
  /** Required (and only sent) when fulfillmentMethod is "delivery". */
  province: string;
  paymentOption: Exclude<PaymentOption, "balance">;
  customerInfo: CustomerInfoDraft;
  requirements: RequirementsDraft;
  agreement: AgreementDraft;
}

export function createEmptyDraft(): ReservationDraft {
  return {
    startDate: null,
    endDate: null,
    fulfillmentMethod: null,
    customerLocation: "",
    cityMunicipality: "",
    province: "",
    paymentOption: "deposit_50",
    customerInfo: {
      fullName: "",
      email: "",
      phone: "",
      address: "",
      facebookLink: "",
      instagramLink: "",
    },
    requirements: {
      idOneFile: null,
      idTwoFile: null,
      selfieFile: null,
      facebookLink: "",
      instagramLink: "",
      emergencyContact: {
        fullName: "",
        relationship: "",
        phone: "",
        facebookLink: "",
        idFile: null,
      },
    },
    agreement: {
      infoAccurate: false,
      agreedToTerms: false,
      understoodRentalRules: false,
      authorizedESignature: false,
      readPrivacyNotice: false,
      emergencyContactAuthorized: false,
      signatureMethod: "drawn",
      signatureDataUrl: null,
      signatureFile: null,
      typedFullName: "",
    },
  };
}

/**
 * Human-readable location summary used on the review step and the rental
 * agreement. Pickup never carries a delivery address (see create_booking),
 * so it always shows the fixed pickup site instead of blank fields.
 */
export function formatCustomerLocation(
  draft: Pick<ReservationDraft, "fulfillmentMethod" | "customerLocation" | "cityMunicipality" | "province">,
): string {
  if (draft.fulfillmentMethod === "pickup") {
    return "Pickup — Right Focus Off Campus, Manuel Hizon, Sta. Cruz, Manila";
  }
  return [draft.customerLocation, draft.cityMunicipality, draft.province]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

export function getDayCount(startDate: Date | null, endDate: Date | null): number {
  if (!startDate || !endDate) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = Math.round(
    (new Date(endDate).setHours(0, 0, 0, 0) - new Date(startDate).setHours(0, 0, 0, 0)) / msPerDay
  );
  return diff + 1;
}
