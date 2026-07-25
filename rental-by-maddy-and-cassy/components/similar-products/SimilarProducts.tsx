"use client";

import type { Product } from "@/types/product";
import type { UnitCounts } from "@/lib/availability";
import CatalogProductCard from "@/components/catalog-product-card/CatalogProductCard";
import { useFavorites } from "@/hooks/useFavorites";
import styles from "./SimilarProducts.module.css";

interface SimilarProductsProps {
  products: Product[];
  unitsByProductId: Map<string, UnitCounts>;
}

export default function SimilarProducts({ products, unitsByProductId }: SimilarProductsProps) {
  const { toggleFavorite, isFavorite } = useFavorites();

  if (products.length === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Similar Products</h2>
      <div className={styles.grid}>
        {products.map((product) => {
          const units = unitsByProductId.get(product.id) ?? {
            totalUnits: product.totalUnits,
            availableUnits: product.availableUnits,
            reservedUnits: product.reservedUnits,
            rentedUnits: product.rentedUnits,
          };
          return (
            <CatalogProductCard
              key={product.id}
              product={product}
              units={units}
              isFavorite={isFavorite(product.id)}
              onToggleFavorite={toggleFavorite}
              ctaLabel="Rent Now"
            />
          );
        })}
      </div>
    </section>
  );
}
