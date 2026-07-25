import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase/config";
import type { UnitCounts } from "@/lib/availability";
import { updateBookingStatus } from "@/src/services/bookingService";

const INVENTORY_COLLECTION = "inventory";

export class InsufficientUnitsError extends Error {
  constructor(productId: string) {
    super(`No available units left for product "${productId}".`);
    this.name = "InsufficientUnitsError";
  }
}

export async function ensureInventoryDoc(
  productId: string,
  defaults: UnitCounts
): Promise<void> {
  const ref = doc(db, INVENTORY_COLLECTION, productId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    await setDoc(ref, { ...defaults, updatedAt: serverTimestamp() });
  }
}

export function subscribeToInventory(
  productId: string,
  callback: (units: UnitCounts | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, INVENTORY_COLLECTION, productId),
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }
      const data = snapshot.data();
      callback({
        totalUnits: data.totalUnits,
        availableUnits: data.availableUnits,
        reservedUnits: data.reservedUnits,
        rentedUnits: data.rentedUnits,
      });
    },
    () => callback(null)
  );
}

export function subscribeToAllInventory(
  callback: (unitsByProductId: Map<string, UnitCounts>) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, INVENTORY_COLLECTION),
    (snapshot: QuerySnapshot<DocumentData>) => {
      const map = new Map<string, UnitCounts>();
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        map.set(docSnapshot.id, {
          totalUnits: data.totalUnits,
          availableUnits: data.availableUnits,
          reservedUnits: data.reservedUnits,
          rentedUnits: data.rentedUnits,
        });
      });
      callback(map);
    },
    () => callback(new Map())
  );
}

interface SubmitReservationInput {
  productId: string;
  days: number;
  totalPrice: number;
  currency: string;
}

export async function submitReservation({
  productId,
  days,
  totalPrice,
  currency,
}: SubmitReservationInput): Promise<string> {
  const inventoryRef = doc(db, INVENTORY_COLLECTION, productId);

  const bookingId = await runTransaction(db, async (transaction) => {
    const inventorySnapshot = await transaction.get(inventoryRef);
    if (!inventorySnapshot.exists()) {
      throw new InsufficientUnitsError(productId);
    }

    const inventory = inventorySnapshot.data();
    if (inventory.availableUnits <= 0) {
      throw new InsufficientUnitsError(productId);
    }

    transaction.update(inventoryRef, {
      availableUnits: inventory.availableUnits - 1,
      reservedUnits: inventory.reservedUnits + 1,
      updatedAt: serverTimestamp(),
    });

    const bookingRef = doc(collection(db, "bookings"));
    transaction.set(bookingRef, {
      productId,
      days,
      totalPrice,
      currency,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return bookingRef.id;
  });

  return bookingId;
}

export async function approveReservation(productId: string, bookingId: string): Promise<void> {
  const inventoryRef = doc(db, INVENTORY_COLLECTION, productId);
  await runTransaction(db, async (transaction) => {
    const inventorySnapshot = await transaction.get(inventoryRef);
    if (!inventorySnapshot.exists()) return;
    const inventory = inventorySnapshot.data();
    transaction.update(inventoryRef, {
      reservedUnits: Math.max(0, inventory.reservedUnits - 1),
      rentedUnits: inventory.rentedUnits + 1,
      updatedAt: serverTimestamp(),
    });
  });
  await updateBookingStatus(bookingId, "confirmed");
}

export async function completeRental(productId: string, bookingId: string): Promise<void> {
  const inventoryRef = doc(db, INVENTORY_COLLECTION, productId);
  await runTransaction(db, async (transaction) => {
    const inventorySnapshot = await transaction.get(inventoryRef);
    if (!inventorySnapshot.exists()) return;
    const inventory = inventorySnapshot.data();
    transaction.update(inventoryRef, {
      rentedUnits: Math.max(0, inventory.rentedUnits - 1),
      availableUnits: inventory.availableUnits + 1,
      updatedAt: serverTimestamp(),
    });
  });
  await updateBookingStatus(bookingId, "completed");
}

export async function cancelReservation(
  productId: string,
  bookingId: string,
  fromStatus: "reserved" | "rented"
): Promise<void> {
  const inventoryRef = doc(db, INVENTORY_COLLECTION, productId);
  await runTransaction(db, async (transaction) => {
    const inventorySnapshot = await transaction.get(inventoryRef);
    if (!inventorySnapshot.exists()) return;
    const inventory = inventorySnapshot.data();
    const isFromReserved = fromStatus === "reserved";
    transaction.update(inventoryRef, {
      reservedUnits: isFromReserved
        ? Math.max(0, inventory.reservedUnits - 1)
        : inventory.reservedUnits,
      rentedUnits: isFromReserved
        ? inventory.rentedUnits
        : Math.max(0, inventory.rentedUnits - 1),
      availableUnits: inventory.availableUnits + 1,
      updatedAt: serverTimestamp(),
    });
  });
  await updateBookingStatus(bookingId, "cancelled");
}

export async function expireReservation(productId: string, bookingId: string): Promise<void> {
  const inventoryRef = doc(db, INVENTORY_COLLECTION, productId);
  await runTransaction(db, async (transaction) => {
    const inventorySnapshot = await transaction.get(inventoryRef);
    if (!inventorySnapshot.exists()) return;
    const inventory = inventorySnapshot.data();
    transaction.update(inventoryRef, {
      reservedUnits: Math.max(0, inventory.reservedUnits - 1),
      availableUnits: inventory.availableUnits + 1,
      updatedAt: serverTimestamp(),
    });
  });
  await updateBookingStatus(bookingId, "expired");
}
