import type { Timestamp } from "firebase/firestore";

export type UserRole = "customer" | "admin";

export interface UserProfile {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  role: UserRole;
  photoURL?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ProductStatus = "Available" | "Booked" | "Inactive";

export interface Product {
  id: string;
  name: string;
  brand: string;
  description?: string;
  category?: string;
  pricePerDay: number;
  currency: string;
  status: ProductStatus;
  isActive: boolean;
  image: string;
  images?: string[];
  totalUnits: number;
  availableUnits: number;
  reservedUnits: number;
  rentedUnits: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Inventory {
  productId: string;
  totalUnits: number;
  availableUnits: number;
  reservedUnits: number;
  rentedUnits: number;
  updatedAt: Timestamp;
}

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "expired";

export interface Booking {
  id: string;
  userId: string;
  productId: string;
  startDate: Timestamp;
  endDate: Timestamp;
  totalPrice: number;
  currency: string;
  status: BookingStatus;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface Payment {
  id: string;
  userId: string;
  bookingId: string;
  amount: number;
  currency: string;
  method?: string;
  status: PaymentStatus;
  transactionRef?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Review {
  id: string;
  userId: string;
  productId: string;
  bookingId?: string;
  rating: number;
  comment?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CustomerDocumentStatus = "pending" | "verified" | "rejected";

export interface CustomerDocument {
  id: string;
  userId: string;
  type: string;
  fileUrl: string;
  status: CustomerDocumentStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  type?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Settings {
  id: string;
  key: string;
  value: unknown;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
