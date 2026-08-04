export type InventoryUnitStatus =
  | "available"
  | "reserved"
  | "rented"
  | "maintenance"
  | "inactive";

/**
 * public.inventory_units — one row per physical unit; the source of truth
 * for real-world counts. Never exposed to renters directly (admin-only RLS
 * read) — public.product_availability_summary is the public-facing cache.
 */
export interface InventoryUnit {
  id: string;
  productId: string;
  unitCode: string;
  serialNumber?: string;
  status: InventoryUnitStatus;
  conditionNotes?: string;
  acquiredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type CalendarEntryStatus = "available" | "reserving" | "booked" | "blocked";

/** public.availability_calendar_entries */
export interface AvailabilityCalendarEntry {
  id: string;
  productId: string;
  inventoryUnitId?: string;
  startDate: string;
  endDate: string;
  status: CalendarEntryStatus;
  publicNote?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductAvailabilitySummary {
  productId: string;
  totalUnits: number;
  availableUnits: number;
  reservedUnits: number;
  rentedUnits: number;
  maintenanceUnits: number;
  updatedAt: string;
}
