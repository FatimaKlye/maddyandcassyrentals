"use client";

import { useEffect, useState } from "react";
import type { UnitCounts } from "@/lib/availability";
import { subscribeToAllInventory } from "@/src/services/inventoryService";
import { createClient } from "@/src/lib/supabase/client";

export function useInventoryMap(defaultsById: Record<string, UnitCounts>): Map<string, UnitCounts> {
  const [liveUnits, setLiveUnits] = useState<Map<string, UnitCounts>>(new Map());

  useEffect(() => {
    const supabase = createClient();
    return subscribeToAllInventory(supabase, setLiveUnits);
  }, []);

  const merged = new Map<string, UnitCounts>();
  for (const [productId, defaults] of Object.entries(defaultsById)) {
    merged.set(productId, liveUnits.get(productId) ?? defaults);
  }
  return merged;
}
