import type { PaymentStatus } from "@/src/types/payment";

// Mirrors public.bookings and its related tables exactly (see
// maddy_cassy_supabase_schema.sql). Booking status values and transitions
// are enforced server-side by public.create_booking / admin_set_booking_status
// / confirm_booking — this file only mirrors that vocabulary for the client.

export type BookingStatus =
  | "pending"
  | "approved"
  | "confirmed"
  | "released"
  | "returned"
  | "cancelled";

export type FulfillmentMethod = "pickup" | "delivery";

export interface BookingProductSnapshot {
  name: string;
  brand: string;
  category: string;
  image: string;
  pricePerDay: number;
  currency: string;
  included: string[];
}

export interface BookingCustomerSnapshot {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  facebookLink: string;
  instagramLink: string;
}

export type RequirementsStatus =
  | "not_submitted"
  | "pending_review"
  | "approved"
  | "rejected";

export type AgreementStatus =
  | "not_created"
  | "awaiting_customer_signature"
  | "awaiting_business_signature"
  | "completed"
  | "rejected";

export interface Booking {
  id: string;
  bookingRef: string;
  userId: string;
  productId: string;
  inventoryUnitId: string | null;
  status: BookingStatus;
  fulfillmentMethod: FulfillmentMethod;
  startDate: string;
  endDate: string;
  dayCount: number;
  dailyRate: number;
  refundableDeposit: number;
  rentalSubtotal: number;
  deliveryFee: number;
  totalAmount: number;
  location?: string;
  customerNotes?: string;
  adminNotes?: string;
  productSnapshot: BookingProductSnapshot;
  customerSnapshot: BookingCustomerSnapshot;
  requirementsStatus: RequirementsStatus;
  agreementStatus: AgreementStatus;
  paymentStatus?: PaymentStatus;
  approvedAt?: string;
  confirmedAt?: string;
  releasedAt?: string;
  returnedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmergencyContact {
  id?: string;
  bookingId?: string;
  fullName: string;
  relationship: string;
  phoneNumber: string;
  address?: string;
}

/** One row of public.booking_documents — a single uploaded verification file. */
export type BookingDocumentType =
  | "government_id"
  | "secondary_id"
  | "selfie_with_id"
  | "proof_of_address"
  | "authorization_letter"
  | "other";

export type RequirementReviewStatus = "pending" | "approved" | "rejected";

export interface BookingDocument {
  id: string;
  bookingId: string;
  userId: string;
  documentType: BookingDocumentType | string;
  requirementKey?: string;
  storageBucket: string;
  storagePath: string;
  originalFilename?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  reviewStatus: RequirementReviewStatus;
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** public.requirement_document_reviews — review history entry for one document. */
export interface RequirementDocumentReview {
  id: string;
  bookingDocumentId: string;
  status: RequirementReviewStatus;
  notes?: string;
  reviewedBy?: string;
  reviewedAt: string;
  createdAt: string;
}

export interface AgreementSnapshot {
  customerName: string;
  productName: string;
  startDate: string;
  endDate: string;
  dayCount: number;
  fulfillmentMethod: FulfillmentMethod;
  customerLocation: string;
  pricePerDay: number;
  currency: string;
  includedAccessories: string[];
}

/** One row of public.agreement_acknowledgements. */
export type AcknowledgementKey =
  | "infoAccurate"
  | "agreedToTerms"
  | "understoodRentalRules"
  | "authorizedESignature"
  | "readPrivacyNotice"
  | "emergencyContactAuthorized";

export interface AgreementAcknowledgement {
  id: string;
  agreementId: string;
  userId: string;
  acknowledgementKey: AcknowledgementKey | string;
  acknowledged: boolean;
  acknowledgedAt?: string;
}

/** One row of public.agreement_signatures (unique per agreement + role). */
export interface AgreementSignature {
  id: string;
  agreementId: string;
  signerUserId?: string;
  signerRole: "customer" | "business";
  signerName: string;
  signaturePath?: string;
  signatureData: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  signedAt: string;
}

/** public.booking_agreements — the current version; see booking_agreement_versions for history. */
export interface AgreementDoc {
  id: string;
  bookingId: string;
  status: AgreementStatus;
  agreementVersion?: string;
  versionNumber: number;
  agreementSnapshot: AgreementSnapshot;
  generatedDocumentPath?: string;
  finalDocumentPath?: string;
  generatedAt?: string;
  completedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  acknowledgements?: AgreementAcknowledgement[];
  signatures?: AgreementSignature[];
}

export interface AgreementVersion {
  id: string;
  agreementId: string;
  bookingId: string;
  versionNumber: number;
  status: string;
  agreementVersion?: string;
  agreementSnapshot: AgreementSnapshot;
  generatedDocumentPath?: string;
  finalDocumentPath?: string;
  generatedAt?: string;
  completedAt?: string;
  archivedAt: string;
  archivedReason?: string;
}

export interface StatusHistoryEntry {
  id: string;
  bookingId: string;
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  note?: string;
  changedByUserId?: string;
  createdAt: string;
}
