export type ProductCategory = "Phones" | "Cameras";
export type ProductStatus = "Available" | "Booked" | "Inactive";

export interface ProductReview {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  description: string;
  pricePerDay: number;
  currency: string;
  image: string;
  images?: string[];
  badge?: string;
  coverImagePath?: string;
  totalUnits: number;
  availableUnits: number;
  reservedUnits: number;
  rentedUnits: number;
  rating: number;
  reviewCount: number;
  specs: Record<string, string>;
  included: string[];
  reviews: ProductReview[];
  status: ProductStatus;
  // Canonical "is this visible on the public catalog" flag — this is what the
  // spec's seed shape calls `isPublished`; kept as `isActive` here since every
  // existing query/rule already keys off that name.
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
