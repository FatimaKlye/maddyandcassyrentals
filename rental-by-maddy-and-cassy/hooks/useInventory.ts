"use client";

import { useEffect, useRef, useState } from "react";
import type { UnitCounts } from "@/lib/availability";
import {
  ensureInventoryDoc,
  subscribeToAllInventory,
} from "@/src/services/inventoryService";

export function useInventoryMap(
  defaultsById: Record<string, UnitCounts>
): Map<string, UnitCounts> {
  const [liveUnits, setLiveUnits] = useState<Map<string, UnitCounts>>(new Map());
  const ensuredIds = useRef(new Set<string>());
  const defaultsRef = useRef(defaultsById);

  useEffect(() => {
    defaultsRef.current = defaultsById;
  });

  useEffect(() => {
    const unsubscribe = subscribeToAllInventory((unitsByProductId) => {
      setLiveUnits(new Map(unitsByProductId));

      for (const [productId, defaults] of Object.entries(defaultsRef.current)) {
        if (!unitsByProductId.has(productId) && !ensuredIds.current.has(productId)) {
          ensuredIds.current.add(productId);
          void ensureInventoryDoc(productId, defaults);
        }
      }
    });

    return unsubscribe;
  }, []);

  const merged = new Map<string, UnitCounts>();
  for (const [productId, defaults] of Object.entries(defaultsById)) {
    merged.set(productId, liveUnits.get(productId) ?? defaults);
  }
  return merged;
}
