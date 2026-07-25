"use client";

import type { ProductCategory } from "@/types/product";
import SearchIcon from "@/components/icons/SearchIcon";
import styles from "./CatalogFilters.module.css";

export type CategoryFilter = "All" | ProductCategory;
export type SortOption = "featured" | "price-asc" | "price-desc" | "name-asc";

interface CatalogFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: CategoryFilter;
  onCategoryChange: (value: CategoryFilter) => void;
  sort: SortOption;
  onSortChange: (value: SortOption) => void;
  availableOnly: boolean;
  onAvailableOnlyChange: (value: boolean) => void;
  resultCount: number;
}

const CATEGORIES: CategoryFilter[] = ["All", "Phones", "Cameras"];

export default function CatalogFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  sort,
  onSortChange,
  availableOnly,
  onAvailableOnlyChange,
  resultCount,
}: CatalogFiltersProps) {
  return (
    <div className={styles.filters}>
      <div className={styles.categoryRow} role="tablist" aria-label="Filter by category">
        {CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={category === item}
            className={`${styles.categoryPill} ${category === item ? styles.categoryPillActive : ""}`}
            onClick={() => onCategoryChange(item)}
          >
            {item === "All" ? "All Products" : item}
          </button>
        ))}
      </div>

      <div className={styles.controlsRow}>
        <label className={styles.searchField}>
          <SearchIcon size={17} className={styles.searchIcon} />
          <input
            type="text"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search products..."
            aria-label="Search products"
            className={styles.searchInput}
          />
        </label>

        <label className={styles.selectField}>
          <span className={styles.selectLabel}>Sort</span>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as SortOption)}
            className={styles.select}
            aria-label="Sort by price"
          >
            <option value="featured">Featured</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="name-asc">Name: A to Z</option>
          </select>
        </label>

        <label className={styles.checkboxField}>
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(event) => onAvailableOnlyChange(event.target.checked)}
            className={styles.checkbox}
          />
          Available only
        </label>
      </div>

      <p className={styles.resultCount}>
        {resultCount} {resultCount === 1 ? "product" : "products"} found
      </p>
    </div>
  );
}
