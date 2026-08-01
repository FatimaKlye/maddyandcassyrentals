import type { Timestamp } from "firebase/firestore";
import type { PaymentOption, PaymentStatus } from "@/src/types/payment";

export type BookingStatus =
  | "submitted"
  | "under_review"
  | "correction_required"
  | "approved"
  | "confirmed"
  | "ready"
  | "active"
  | "completed"
  | "cancelled"
  | "rejected";

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
  | "submitted"
  | "correction_required"
  | "verified";

export type AgreementStatus =
  | "awaiting_customer_signature"
  | "submitted_for_review"
  | "correction_required"
  | "awaiting_admin_signature"
  | "completed";

export interface Booking {
  id: string;
  // Human-readable booking reference (e.g. "MC-20260726-ABCDE"), equivalent
  // to what the CMS spec calls "bookingNumber".
  bookingRef: string;
  userId: string;
  productId: string;
  customerSnapshot?: BookingCustomerSnapshot;
  // The specific physical unit locked for this booking's date range, set
  // once the reservation transaction succeeds — see
  // src/services/reservationService.ts. Null until assigned.
  assignedUnitId: string | null;
  productSnapshot: BookingProductSnapshot;
  startDate: Timestamp;
  endDate: Timestamp;
  dayCount: number;
  fulfillmentMethod: FulfillmentMethod;
  customerLocation: string;
  // Snapshot of the daily rate at booking time, plus the resulting
  // informational estimate (pricePerDaySnapshot * dayCount). Neither field
  // is a payment amount — no payment/deposit workflow exists in this CMS.
  pricePerDaySnapshot: number;
  estimatedRentalAmount: number;
  amountDue?: number;
  amountPaid?: number;
  balanceDue?: number;
  paymentChoice?: PaymentOption;
  demoPayment?: boolean;
  paymentRequired?: boolean;
  paymentStatus?: PaymentStatus;
  status: BookingStatus;
  requirementsStatus: RequirementsStatus;
  agreementStatus: AgreementStatus;
  adminRemarks?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  submittedAt: Timestamp;
}

export interface EmergencyContact {
  fullName: string;
  relationship: string;
  phone: string;
  facebookLink: string;
  idStoragePath: string;
}

export interface RequirementsDoc {
  bookingId: string;
  userId: string;
  idOneStoragePath: string;
  idTwoStoragePath: string;
  selfieWithIdStoragePath: string;
  facebookLink: string;
  instagramLink: string;
  emergencyContact: EmergencyContact;
  status: RequirementsStatus;
  correctionNotes?: string;
  submittedAt: Timestamp;
  updatedAt: Timestamp;
  reviews?: Partial<Record<RequirementDocumentKey, RequirementDocumentReview>>;
}

export type RequirementDocumentKey =
  | "idOneStoragePath"
  | "idTwoStoragePath"
  | "selfieWithIdStoragePath"
  | "emergencyContactIdStoragePath";

export type RequirementReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "replacement_requested";

export interface RequirementDocumentReview {
  status: RequirementReviewStatus;
  reason?: string;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
}

export interface AgreementSnapshot {
  customerName: string;
  productName: string;
  startDate: Timestamp;
  endDate: Timestamp;
  dayCount: number;
  fulfillmentMethod: FulfillmentMethod;
  customerLocation: string;
  pricePerDay: number;
  currency: string;
  includedAccessories: string[];
}

export interface AgreementAcknowledgements {
  infoAccurate: boolean;
  agreedToTerms: boolean;
  understoodRentalRules: boolean;
  authorizedESignature: boolean;
  readPrivacyNotice: boolean;
  emergencyContactAuthorized: boolean;
}

export interface AgreementSignature {
  method: "drawn" | "uploaded";
  storagePath: string;
  typedFullName: string;
  signedAt: Timestamp;
}

export interface AgreementDoc {
  bookingId: string;
  userId: string;
  bookingRef: string;
  generatedTermsVersion: string;
  agreementSnapshot: AgreementSnapshot;
  acknowledgements: AgreementAcknowledgements;
  // Customer's own signature — captured at submission time.
  signature: AgreementSignature;
  status: AgreementStatus;
  // Set once an admin reviews and countersigns (future admin flow).
  adminSignaturePath?: string;
  adminTypedName?: string;
  adminSignedAt?: Timestamp;
  // Set once the admin approves the booking and the system generates the
  // final, combined Rental Agreement + Booking Confirmation document.
  finalAgreementPath?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StatusHistoryEntry {
  id: string;
  previousStatus: BookingStatus | null;
  newStatus: BookingStatus;
  changedBy: "customer" | "admin" | "system";
  changedByUserId?: string;
  message?: string;
  createdAt: Timestamp;
}

export type BookingDocumentType =
  | "final_rental_agreement"
  | "booking_confirmation"
  | "pickup_delivery_instructions"
  | "invoice"
  | "receipt"
  | "payment_proof";

export interface BookingDocument {
  id: string;
  type: BookingDocumentType;
  storagePath: string;
  title: string;
  generatedAt: Timestamp;
}
