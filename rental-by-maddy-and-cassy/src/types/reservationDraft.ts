import type { FulfillmentMethod } from "@/src/types/booking";

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
  customerLocation: string;
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

export function getDayCount(startDate: Date | null, endDate: Date | null): number {
  if (!startDate || !endDate) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = Math.round(
    (new Date(endDate).setHours(0, 0, 0, 0) - new Date(startDate).setHours(0, 0, 0, 0)) / msPerDay
  );
  return diff + 1;
}
