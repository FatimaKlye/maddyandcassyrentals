import type { Timestamp } from "firebase/firestore";

export type { Product, ProductStatus, ProductCategory, ProductReview } from "@/types/product";
export type {
  Booking,
  BookingStatus,
  FulfillmentMethod,
  BookingProductSnapshot,
  BookingCustomerSnapshot,
  RequirementsStatus,
  AgreementStatus,
  RequirementsDoc,
  EmergencyContact,
  AgreementDoc,
  AgreementSnapshot,
  AgreementAcknowledgements,
  AgreementSignature,
  StatusHistoryEntry,
  BookingDocument,
  BookingDocumentType,
} from "@/src/types/booking";
export type { UserNotification, NotificationType } from "@/src/types/notification";
export type { Admin } from "@/src/types/admin";
export type {
  InventoryUnit,
  InventoryUnitStatus,
  AvailabilityCalendarEntry,
  CalendarEntryStatus,
} from "@/src/types/inventoryUnit";
export type { WebsiteContent } from "@/src/types/websiteContent";

// Legacy display-only role. Authorization decisions must go through the
// admins/{uid} collection (see isActiveAdmin() in firestore.rules /
// storage.rules) — this field is kept for UI labeling only.
export type UserRole = "customer" | "admin";

export type AccountStatus = "active" | "suspended";

export interface UserProfile {
  id: string;
  uid: string;
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
  photoURL?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Review {
  id: string;
  bookingId: string;
  productId: string;
  userId: string;
  rating: number;
  comment?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
}
