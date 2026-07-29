import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/src/lib/firebase/admin";
import {
  parseCatalogInput,
  reconcileInventoryUnits,
} from "@/src/lib/server/catalog";
import {
  enforceRateLimit,
  requireAdmin,
  RequestSecurityError,
} from "@/src/lib/server/requestSecurity";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    enforceRateLimit(request, "admin-catalog", 30, 60_000);
    const db = getAdminDb();
    const admin = await requireAdmin(request, db);
    const input = parseCatalogInput(await request.json());
    const productRef = db.collection("products").doc();
    const now = Timestamp.now();
    await productRef.set({
      id: productRef.id,
      ...input,
      availableUnits: input.totalUnits,
      reservedUnits: 0,
      rentedUnits: 0,
      rating: 0,
      reviewCount: 0,
      specs: {},
      reviews: [],
      status: input.isActive ? "Available" : "Inactive",
      createdAt: now,
      updatedAt: now,
    });
    await reconcileInventoryUnits(db, productRef.id, input.name, input.totalUnits);
    const batch = db.batch();
    batch.set(productRef.collection("priceHistory").doc(), {
      previousPrice: null,
      newPrice: input.pricePerDay,
      changedBy: admin.uid,
      reason: "Initial catalog price",
      createdAt: now,
    });
    batch.set(db.collection("auditLogs").doc(), {
      action: "catalog.product_created",
      actorType: "admin",
      actorId: admin.uid,
      targetType: "product",
      targetId: productRef.id,
      metadata: { name: input.name, pricePerDay: input.pricePerDay },
      createdAt: now,
    });
    await batch.commit();
    return NextResponse.json({ success: true, productId: productRef.id }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message === "INVALID_CATALOG_INPUT") {
      return NextResponse.json({ error: "Check the product details and try again." }, { status: 400 });
    }
    console.error("Catalog product creation failed", error);
    return NextResponse.json({ error: "The product could not be created." }, { status: 500 });
  }
}
