import type { Product } from "@/types/product";
import type { BookingStatus } from "@/src/types/booking";

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

export interface AdminAuditLog {
  id: string;
  action: string;
  actorType: "admin" | "customer" | "system";
  actorId: string;
  bookingId?: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  createdAt: string | null;
}

export interface AdminPriceHistoryEntry {
  id: string;
  productId: string;
  previousPrice: number | null;
  newPrice: number;
  changedBy: string;
  reason: string;
  createdAt: string | null;
}

export interface AdminCatalogData {
  products: Product[];
  priceHistory: AdminPriceHistoryEntry[];
}

export interface AdminPaymentRecord {
  id: string;
  bookingId: string;
  bookingRef: string;
  amount: number;
  status: string;
  paymentId?: string;
  referenceNumber: string;
  paymentMethod?: string;
  isDemo?: boolean;
  createdAt: string | null;
}

export interface AdminPaymentEvent {
  id: string;
  type: string;
  livemode: boolean;
  status: string;
  bookingId?: string;
  createdAt: string | null;
}

export interface AdminPaymentsData {
  payments: AdminPaymentRecord[];
  events: AdminPaymentEvent[];
}

async function getAdminData<T>(path: string, idToken: string): Promise<T> {
  const response = await fetch(path, {
    headers: { Authorization: `Bearer ${idToken}` },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as
    | (T & { error?: unknown })
    | null;
  if (!response.ok) {
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : "Administrator data could not be loaded.",
    );
  }
  if (!body) throw new Error("Administrator data could not be loaded.");
  return body;
}

export function getAdminDashboard(idToken: string): Promise<AdminDashboardData> {
  return getAdminData("/api/admin/dashboard", idToken);
}

export function getAdminCatalog(idToken: string): Promise<AdminCatalogData> {
  return getAdminData("/api/admin/catalog", idToken);
}

export async function getAdminAuditLogs(
  idToken: string,
): Promise<AdminAuditLog[]> {
  const data = await getAdminData<{ logs: AdminAuditLog[] }>(
    "/api/admin/audit",
    idToken,
  );
  return data.logs;
}

export function getAdminPayments(idToken: string): Promise<AdminPaymentsData> {
  return getAdminData("/api/admin/payments", idToken);
}
