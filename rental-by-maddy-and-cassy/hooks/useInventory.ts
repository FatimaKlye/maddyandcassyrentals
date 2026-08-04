"use client";

import { useEffect, useState } from "react";
import type { UnitCounts } from "@/lib/availability";
import { subscribeToAllInventory } from "@/src/services/inventoryService";
import { createClient } from "@/src/lib/supabase/client";

export function useInventoryMap(defaultsById: Record<string, UnitCounts>): Map<string, UnitCounts> {
  const [liveUnits, setLiveUnits] = useState<Map<string, UnitCounts>>(new Map());
  const productIds = Object.keys(defaultsById);
  const productIdsKey = productIds.join(",");

  useEffect(() => {
    const supabase = createClient();
    return subscribeToAllInventory(supabase, productIds, setLiveUnits);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIdsKey]);

  const merged = new Map<string, UnitCounts>();
  for (const [productId, defaults] of Object.entries(defaultsById)) {
    merged.set(productId, liveUnits.get(productId) ?? defaults);
  }
  return merged;
}
