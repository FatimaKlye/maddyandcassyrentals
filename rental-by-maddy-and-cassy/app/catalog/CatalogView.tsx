"use client";

import { useMemo, useState } from "react";
import { products } from "@/data/products";
import type { UnitCounts } from "@/lib/availability";
import CatalogFilters, {
  type CategoryFilter,
  type SortOption,
} from "@/components/catalog-filters/CatalogFilters";
import CatalogProductCard from "@/components/catalog-product-card/CatalogProductCard";
import { useFavorites } from "@/hooks/useFavorites";
import { useInventoryMap } from "@/hooks/useInventory";
import styles from "./catalog.module.css";

const DEFAULTS_BY_PRODUCT_ID: Record<string, UnitCounts> = Object.fromEntries(
  products.map((product) => [
    product.id,
    {
      totalUnits: product.totalUnits,
      availableUnits: product.availableUnits,
      reservedUnits: product.reservedUnits,
      rentedUnits: product.rentedUnits,
    },
  ])
);

export default function CatalogView() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [sort, setSort] = useState<SortOption>("featured");
  const [availableOnly, setAvailableOnly] = useState(false);
  const { toggleFavorite, isFavorite } = useFavorites();
  const unitsByProductId = useInventoryMap(DEFAULTS_BY_PRODUCT_ID);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = products.filter((product) => {
      const units = unitsByProductId.get(product.id);
      const matchesCategory = category === "All" || product.category === category;
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.brand.toLowerCase().includes(query);
      const matchesAvailability = !availableOnly || (units?.availableUnits ?? 0) > 0;
      return matchesCategory && matchesSearch && matchesAvailability;
    });

    const sorted = [...filtered];
    if (sort === "price-asc") {
      sorted.sort((a, b) => a.pricePerDay - b.pricePerDay);
    } else if (sort === "price-desc") {
      sorted.sort((a, b) => b.pricePerDay - a.pricePerDay);
    } else if (sort === "name-asc") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }

    return sorted;
  }, [search, category, sort, availableOnly, unitsByProductId]);

  return (
    <section className={styles.catalog}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>RENTAL ITEM CATALOG</p>
        <h1 className={styles.heading}>Browse Our Gear</h1>
        <p className={styles.subheading}>
          Premium iPhones and cameras available for daily rental. Find your
          perfect gear below.
        </p>
      </div>

      <CatalogFilters
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        sort={sort}
        onSortChange={setSort}
        availableOnly={availableOnly}
        onAvailableOnlyChange={setAvailableOnly}
        resultCount={filteredProducts.length}
      />

      {filteredProducts.length > 0 ? (
        <div className={styles.grid}>
          {filteredProducts.map((product) => (
            <CatalogProductCard
              key={product.id}
              product={product}
              units={
                unitsByProductId.get(product.id) ?? {
                  totalUnits: product.totalUnits,
                  availableUnits: product.availableUnits,
                  reservedUnits: product.reservedUnits,
                  rentedUnits: product.rentedUnits,
                }
              }
              isFavorite={isFavorite(product.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <p>No products match your filters.</p>
          <button
            type="button"
            className={styles.resetButton}
            onClick={() => {
              setSearch("");
              setCategory("All");
              setAvailableOnly(false);
            }}
          >
            Reset filters
          </button>
        </div>
      )}
    </section>
  );
}
