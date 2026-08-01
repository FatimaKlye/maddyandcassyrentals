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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
): Promise<NextResponse> {
  try {
    enforceRateLimit(request, "admin-catalog", 30, 60_000);
    const db = getAdminDb();
    const admin = await requireAdmin(request, db);
    const { productId } = await params;
    const input = parseCatalogInput(await request.json());
    const productRef = db.collection("products").doc(productId);
    const snapshot = await productRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: "The product no longer exists." }, { status: 404 });
    }
    const previousPrice = snapshot.data()?.pricePerDay;
    const now = Timestamp.now();
    await productRef.update({
      ...input,
      status: input.isActive ? "Available" : "Inactive",
      updatedAt: now,
    });
    await reconcileInventoryUnits(db, productId, input.name, input.totalUnits);
    const batch = db.batch();
    if (previousPrice !== input.pricePerDay) {
      batch.set(productRef.collection("priceHistory").doc(), {
        previousPrice,
        newPrice: input.pricePerDay,
        changedBy: admin.uid,
        reason: "Catalog pricing update",
        createdAt: now,
      });
    }
    batch.set(db.collection("auditLogs").doc(), {
      action: "catalog.product_updated",
      actorType: "admin",
      actorId: admin.uid,
      targetType: "product",
      targetId: productId,
      metadata: {
        name: input.name,
        previousPrice,
        pricePerDay: input.pricePerDay,
        totalUnits: input.totalUnits,
        isActive: input.isActive,
      },
      createdAt: now,
    });
    await batch.commit();
    return NextResponse.json({ success: true, productId });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message === "INVALID_CATALOG_INPUT") {
      return NextResponse.json({ error: "Check the product details and try again." }, { status: 400 });
    }
    console.error("Catalog product update failed", error);
    return NextResponse.json({ error: "The product could not be updated." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
): Promise<NextResponse> {
  try {
    const db = getAdminDb();
    const admin = await requireAdmin(request, db);
    const { productId } = await params;
    const productRef = db.collection("products").doc(productId);
    const snapshot = await productRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: "The product no longer exists." }, { status: 404 });
    }
    const now = Timestamp.now();
    await productRef.update({ isActive: false, status: "Inactive", updatedAt: now });
    await reconcileInventoryUnits(
      db,
      productId,
      snapshot.data()?.name ?? "Rental item",
      0,
    );
    await db.collection("auditLogs").add({
      action: "catalog.product_deactivated",
      actorType: "admin",
      actorId: admin.uid,
      targetType: "product",
      targetId: productId,
      metadata: { name: snapshot.data()?.name ?? "" },
      createdAt: now,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Catalog product deactivation failed", error);
    return NextResponse.json({ error: "The product could not be deactivated." }, { status: 500 });
  }
}
