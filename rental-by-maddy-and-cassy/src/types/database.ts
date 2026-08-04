// Central domain-type barrel re-exporting the app's Supabase-backed domain types.

export type { Product, ProductStatus, ProductReview, ProductImage } from "@/types/product";
export type {
  Booking,
  BookingStatus,
  FulfillmentMethod,
  BookingProductSnapshot,
  BookingCustomerSnapshot,
  RequirementsStatus,
  AgreementStatus,
  EmergencyContact,
  AgreementDoc,
  AgreementVersion,
  AgreementSnapshot,
  AcknowledgementKey,
  AgreementAcknowledgement,
  AgreementSignature,
  StatusHistoryEntry,
  BookingDocument,
  BookingDocumentType,
  RequirementDocumentReview,
  RequirementReviewStatus,
} from "@/src/types/booking";
export type {
  PaymentStatus,
  PaymentType,
  RefundStatus,
  PaymentRecord,
  InvoiceStatus,
  InvoiceLineItem,
  BookingInvoice,
  BookingReceipt,
  PaymentEventLog,
  PayMongoWebhookEvent,
} from "@/src/types/payment";
export type { UserNotification, NotificationType } from "@/src/types/notification";
export type { Admin, AuditLogEntry } from "@/src/types/admin";
export type {
  InventoryUnit,
  InventoryUnitStatus,
  AvailabilityCalendarEntry,
  CalendarEntryStatus,
  ProductAvailabilitySummary,
} from "@/src/types/inventoryUnit";
export type { WebsiteContent } from "@/src/types/websiteContent";

// Legacy display-only role. Authorization decisions must go through the
// admins table (see private.is_active_admin() in the Supabase schema) —
// this field is kept for UI labeling only.
export type UserRole = "customer" | "admin";

export type AccountStatus = "active" | "suspended";

/** public.profiles, joined 1:1 with auth.users. */
export interface UserProfile {
  id: string;
  firebaseUid?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  phoneNumber?: string;
  fullAddress?: string;
  facebookLink?: string;
  instagramLink?: string;
  role: UserRole;
  accountStatus: AccountStatus;
  photoPath?: string;
  createdAt: string;
  updatedAt: string;
}

/** public.reviews */
export interface Review {
  id: string;
  bookingId: string;
  productId: string;
  userId: string;
  rating: number;
  comment?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}
