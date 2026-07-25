"use client";

import { useState, type KeyboardEvent } from "react";
import type { ProductReview } from "@/types/product";
import styles from "./ProductTabs.module.css";

interface ProductTabsProps {
  specs: Record<string, string>;
  included: string[];
  reviews: ProductReview[];
  rating: number;
  reviewCount: number;
}

type TabId = "specifications" | "included" | "reviews";

const TABS: { id: TabId; label: string }[] = [
  { id: "specifications", label: "Specifications" },
  { id: "included", label: "What's Included" },
  { id: "reviews", label: "Reviews" },
];

export default function ProductTabs({
  specs,
  included,
  reviews,
  rating,
  reviewCount,
}: ProductTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("specifications");

  function handleKeyDown(event: KeyboardEvent) {
    const currentIndex = TABS.findIndex((tab) => tab.id === activeTab);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setActiveTab(TABS[(currentIndex + 1) % TABS.length].id);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActiveTab(TABS[(currentIndex - 1 + TABS.length) % TABS.length].id);
    }
  }

  return (
    <div className={styles.card}>
      <div
        className={styles.tabList}
        role="tablist"
        aria-label="Product information"
        onKeyDown={handleKeyDown}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="panel-specifications"
        aria-labelledby="tab-specifications"
        hidden={activeTab !== "specifications"}
        className={styles.panel}
      >
        <dl className={styles.specGrid}>
          {Object.entries(specs).map(([key, value]) => (
            <div key={key} className={styles.specRow}>
              <dt className={styles.specKey}>{key}</dt>
              <dd className={styles.specValue}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div
        role="tabpanel"
        id="panel-included"
        aria-labelledby="tab-included"
        hidden={activeTab !== "included"}
        className={styles.panel}
      >
        <ul className={styles.includedList}>
          {included.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div
        role="tabpanel"
        id="panel-reviews"
        aria-labelledby="tab-reviews"
        hidden={activeTab !== "reviews"}
        className={styles.panel}
      >
        <p className={styles.reviewSummary}>
          <strong>{rating.toFixed(1)}</strong> average rating from {reviewCount} reviews
        </p>
        <ul className={styles.reviewList}>
          {reviews.map((review) => (
            <li key={review.id} className={styles.reviewItem}>
              <div className={styles.reviewHeader}>
                <span className={styles.reviewAuthor}>{review.author}</span>
                <span className={styles.reviewRating}>{review.rating.toFixed(1)} ★</span>
              </div>
              <p className={styles.reviewComment}>{review.comment}</p>
              <span className={styles.reviewDate}>{review.date}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
