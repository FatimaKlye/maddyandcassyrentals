import type { Product } from "@/types/product";
import type { BookingStatus } from "@/src/types/booking";
import type { PaymentRecord, PayMongoWebhookEvent } from "@/src/types/payment";
import type { AuditLogEntry } from "@/src/types/admin";

export interface AdminDashboardData {
  metrics: {
    customerAccounts: number;
    verifiedRevenue: number;
    successfulPayments: number;
    failedPayments: number;
    pendingVerification: number;
    activeBookings: number;
    catalogProducts: number;
    completedRentals: number;
    popularProductName: string | null;
    popularProductBookings: number;
  };
  recentBookings: Array<{
    id: string;
    bookingRef: string;
    customerName: string;
    productName: string;
    status: BookingStatus;
    createdAt: string | null;
  }>;
}

export type AdminAuditLog = AuditLogEntry;

export interface AdminPriceHistoryEntry {
  id: string;
  productId: string;
  previousPrice: number | null;
  newPrice: number;
  changedBy: string | null;
  reason: string;
  createdAt: string | null;
}

export interface AdminCatalogData {
  products: Product[];
  priceHistory: AdminPriceHistoryEntry[];
}

export interface AdminPaymentsData {
  payments: PaymentRecord[];
  events: PayMongoWebhookEvent[];
}

async function getAdminData<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store" });
  const body = (await response.json().catch(() => null)) as (T & { error?: unknown }) | null;
  if (!response.ok) {
    throw new Error(typeof body?.error === "string" ? body.error : "Administrator data could not be loaded.");
  }
  if (!body) throw new Error("Administrator data could not be loaded.");
  return body;
}

export function getAdminDashboard(): Promise<AdminDashboardData> {
  return getAdminData("/api/admin/dashboard");
}

export function getAdminCatalog(): Promise<AdminCatalogData> {
  return getAdminData("/api/admin/catalog");
}

export async function getAdminAuditLogs(): Promise<AdminAuditLog[]> {
  const data = await getAdminData<{ logs: AdminAuditLog[] }>("/api/admin/audit");
  return data.logs;
}

export function getAdminPayments(): Promise<AdminPaymentsData> {
  return getAdminData("/api/admin/payments");
}
