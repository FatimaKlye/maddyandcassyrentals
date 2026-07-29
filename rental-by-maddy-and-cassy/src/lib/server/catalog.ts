import { Timestamp, type Firestore } from "firebase-admin/firestore";

export interface CatalogInput {
  name: string;
  brand: string;
  category: "Phones" | "Cameras";
  description: string;
  pricePerDay: number;
  currency: "PHP";
  image: string;
  included: string[];
  totalUnits: number;
  isActive: boolean;
}

export function parseCatalogInput(value: unknown): CatalogInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("INVALID_CATALOG_INPUT");
  }
  const input = value as Record<string, unknown>;
  const string = (key: string, max: number) => {
    const result = typeof input[key] === "string" ? input[key].trim() : "";
    if (!result || result.length > max) throw new Error("INVALID_CATALOG_INPUT");
    return result;
  };
  const pricePerDay = Number(input.pricePerDay);
  const totalUnits = Number(input.totalUnits);
  if (!Number.isFinite(pricePerDay) || pricePerDay <= 0 || pricePerDay > 1_000_000) {
    throw new Error("INVALID_CATALOG_INPUT");
  }
  if (!Number.isInteger(totalUnits) || totalUnits < 0 || totalUnits > 1000) {
    throw new Error("INVALID_CATALOG_INPUT");
  }
  if (input.category !== "Phones" && input.category !== "Cameras") {
    throw new Error("INVALID_CATALOG_INPUT");
  }
  return {
    name: string("name", 150),
    brand: string("brand", 100),
    category: input.category,
    description: string("description", 3000),
    pricePerDay,
    currency: "PHP",
    image: string("image", 2000),
    included: Array.isArray(input.included)
      ? input.included
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 50)
      : [],
    totalUnits,
    isActive: input.isActive !== false,
  };
}

export async function reconcileInventoryUnits(
  db: Firestore,
  productId: string,
  productName: string,
  totalUnits: number,
): Promise<void> {
  const snapshot = await db
    .collection("inventoryUnits")
    .where("productId", "==", productId)
    .get();
  const units = snapshot.docs;
  const batch = db.batch();
  const now = Timestamp.now();

  for (let index = units.length; index < totalUnits; index += 1) {
    const ref = db.collection("inventoryUnits").doc();
    batch.set(ref, {
      id: ref.id,
      productId,
      name: `${productName} Unit ${index + 1}`,
      serialNumber: "",
      status: "available",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  units.forEach((unit, index) => {
    const shouldBeActive = index < totalUnits;
    if (unit.data().isActive !== shouldBeActive) {
      batch.update(unit.ref, {
        isActive: shouldBeActive,
        status: shouldBeActive ? "available" : "inactive",
        updatedAt: now,
      });
    }
  });

  batch.set(
    db.collection("inventory").doc(productId),
    {
      productId,
      totalUnits,
      availableUnits: totalUnits,
      reservedUnits: 0,
      rentedUnits: 0,
      updatedAt: now,
    },
    { merge: true },
  );
  await batch.commit();
}
