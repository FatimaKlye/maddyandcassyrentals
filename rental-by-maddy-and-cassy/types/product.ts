export type ProductStatus = "draft" | "active" | "inactive" | "archived";

export interface ProductReview {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date: string;
}

export interface ProductImage {
  id: string;
  storagePath: string;
  url: string;
  altText?: string;
  sortOrder: number;
  isPrimary: boolean;
}

/**
 * public.products + public.product_images + public.product_availability_summary.
 * Alongside the schema-accurate fields, this keeps a handful of UI-ergonomic
 * aliases (pricePerDay, image, included, badge, specs, isActive) so the
 * existing catalog/reservation components don't need a full rewrite just to
 * rename fields — they're plain derived values computed once in
 * productService.mapProduct, not a separate data source.
 */
export interface Product {
  id: string;
  slug: string;
  name: string;
  brand?: string;
  category: string;
  shortDescription?: string;
  description?: string;
  dailyRate: number;
  refundableDeposit: number;
  currency: "PHP";
  status: ProductStatus;
  isFeatured: boolean;
  specifications: Record<string, string>;
  images: ProductImage[];
  totalUnits: number;
  availableUnits: number;
  reservedUnits: number;
  rentedUnits: number;
  maintenanceUnits: number;
  rating: number;
  reviewCount: number;
  reviews: ProductReview[];
  createdAt: string;
  updatedAt: string;

  /** Alias for dailyRate. */
  pricePerDay: number;
  /** Alias for images[0]?.url ?? "". */
  image: string;
  /** Parsed from specifications.included (comma-separated), if present. */
  included: string[];
  /** "Featured" when isFeatured, otherwise undefined. */
  badge?: string;
  /** Alias for specifications. */
  specs: Record<string, string>;
  /** Alias for status === "active". */
  isActive: boolean;
}
