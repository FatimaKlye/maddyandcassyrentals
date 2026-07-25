export type ProductCategory = "Phones" | "Cameras";

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
  depositAmount: number;
  currency: string;
  image: string;
  images?: string[];
  badge?: string;
  totalUnits: number;
  availableUnits: number;
  reservedUnits: number;
  rentedUnits: number;
  rating: number;
  reviewCount: number;
  specs: Record<string, string>;
  included: string[];
  reviews: ProductReview[];
}
