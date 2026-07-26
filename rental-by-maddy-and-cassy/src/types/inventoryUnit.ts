import type { Timestamp } from "firebase/firestore";

export type InventoryUnitStatus = "available" | "maintenance" | "retired";

/**
 * inventoryUnits/{unitId} — one document per physical camera or phone.
 * This is the source of truth for real-world unit counts and is what the
 * reservation transaction locks against; `products/{id}.totalUnits` /
 * `availableUnits` remain a denormalized display cache for the catalog UI.
 */
export interface InventoryUnit {
  id: string;
  productId: string;
  unitCode: string;
  status: InventoryUnitStatus;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CalendarEntryStatus = "pending" | "confirmed" | "active" | "blocked";

/**
 * inventoryUnits/{unitId}/calendar/{dateKey} — a per-day lock on a specific
 * physical unit. `dateKey` is a "YYYY-MM-DD" string, doubling as the document
 * id, so a transactional read/write on this doc is what prevents two
 * customers from reserving the same unit on the same day.
 */
export interface AvailabilityCalendarEntry {
  unitId: string;
  productId: string;
  bookingId: string | null;
  dateKey: string;
  status: CalendarEntryStatus;
  startAt: Timestamp;
  endAt: Timestamp;
  createdAt: Timestamp;
  expiresAt?: Timestamp;
}
