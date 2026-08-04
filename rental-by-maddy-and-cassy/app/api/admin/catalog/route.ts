import { NextResponse } from "next/server";
import { parseCatalogInput, reconcileInventoryUnits } from "@/src/lib/server/catalog";
import { enforceRateLimit, requireActiveAdmin, RequestSecurityError } from "@/src/lib/server/requestSecurity";
import { getAllProductsForAdmin, getPriceHistory } from "@/src/services/productService";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    enforceRateLimit(request, "admin-catalog-read", 60, 60_000);
    const { supabase } = await requireActiveAdmin();

    const [products, priceHistory] = await Promise.all([
      getAllProductsForAdmin(supabase),
      getPriceHistory(supabase),
    ]);

    return NextResponse.json({ products, priceHistory });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Admin catalog read failed", error);
    return NextResponse.json({ error: "The catalog could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    enforceRateLimit(request, "admin-catalog", 30, 60_000);
    const { supabase, user } = await requireActiveAdmin();
    const input = parseCatalogInput(await request.json());

    const slug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 100);

    const { data: product, error } = await supabase
      .from("products")
      .insert({
        name: input.name,
        slug: `${slug}-${Date.now().toString(36)}`,
        brand: input.brand || null,
        category: input.category,
        short_description: input.shortDescription || null,
        description: input.description || null,
        daily_rate: input.dailyRate,
        refundable_deposit: input.refundableDeposit,
        status: input.status,
        is_featured: input.isFeatured,
        specifications: input.specifications,
        created_by: user.id,
        updated_by: user.id,
      })
      .select("id")
      .single();

    if (error || !product) throw new Error(error?.message ?? "Product could not be created.");

    await reconcileInventoryUnits(supabase, product.id, input.totalUnits);

    await supabase.rpc("log_audit_event", {
      p_action: "catalog.product_created",
      p_entity_type: "product",
      p_entity_id: product.id,
      p_new_values: { name: input.name, dailyRate: input.dailyRate },
    });

    return NextResponse.json({ success: true, productId: product.id }, { status: 201 });
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
