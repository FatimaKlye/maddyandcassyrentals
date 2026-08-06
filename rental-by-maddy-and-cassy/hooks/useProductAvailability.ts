"use client";

import { useEffect, useState } from "react";
import type { UnitCounts } from "@/lib/availability";
import { createPublicClient } from "@/src/lib/supabase/public";
import { toDateKey } from "@/src/services/availabilityService";

export interface ProductAvailabilityState {
  availableUnits: number;
  isChecking: boolean;
  statusText: string;
  isFullyBookedForSelectedDates: boolean;
}

export function useProductAvailability(
  productId: string,
  inventoryCount: number,
  selectedStartDate: Date | null = null,
  selectedEndDate: Date | null = null,
): ProductAvailabilityState {
  const [availableUnits, setAvailableUnits] = useState(inventoryCount);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function refreshAvailability() {
      if (!selectedStartDate || !selectedEndDate) {
        setAvailableUnits(inventoryCount);
        setIsChecking(false);
        return;
      }

      setIsChecking(true);
      const supabase = createPublicClient();
      const { data, error } = await supabase.rpc("get_product_availability", {
        p_product_id: productId,
        p_start_date: toDateKey(selectedStartDate),
        p_end_date: toDateKey(selectedEndDate),
      });

      if (cancelled) return;

      setIsChecking(false);
      if (error) {
        setAvailableUnits(inventoryCount);
        return;
      }

      setAvailableUnits(data?.[0]?.available_units ?? 0);
    }

    void refreshAvailability();

    return () => {
      cancelled = true;
    };
  }, [inventoryCount, productId, selectedEndDate, selectedStartDate]);

  const hasSelectedRange = !!selectedStartDate && !!selectedEndDate;
  const isFullyBookedForSelectedDates = hasSelectedRange && availableUnits <= 0;

  const statusText = !hasSelectedRange
    ? inventoryCount > 0
      ? "Available"
      : "Out of Stock"
    : isFullyBookedForSelectedDates
      ? "Fully Booked for Selected Dates"
      : `${availableUnits} unit${availableUnits === 1 ? "" : "s"} available for selected dates`;

  return {
    availableUnits,
    isChecking,
    statusText,
    isFullyBookedForSelectedDates,
  };
}

export function createUnitCountsFromAvailability(
  totalUnits: number,
  availableUnits: number,
): UnitCounts {
  return {
    totalUnits,
    availableUnits,
    reservedUnits: Math.max(totalUnits - availableUnits, 0),
    rentedUnits: 0,
  };
}