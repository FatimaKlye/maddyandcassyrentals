"use client";

import { useState } from "react";
import Link from "next/link";
import type { Product } from "@/types/product";
import type { UnitCounts } from "@/lib/availability";
import ArrowLeftIcon from "@/components/icons/ArrowLeftIcon";
import FavoriteButton from "@/components/favorite-button/FavoriteButton";
import ReserveAction from "@/components/reserve-action/ReserveAction";
import AvailabilityBadge from "@/components/availability-badge/AvailabilityBadge";
import ImageGallery from "@/components/image-gallery/ImageGallery";
import ProductTabs from "@/components/product-tabs/ProductTabs";
import SimilarProducts from "@/components/similar-products/SimilarProducts";
import RentalDurationSelector from "@/components/rental-duration-selector/RentalDurationSelector";
import QuickEstimate from "@/components/quick-estimate/QuickEstimate";
import { useInventoryMap } from "@/hooks/useInventory";
import styles from "./details.module.css";

interface ProductDetailsClientProps {
  product: Product;
  similarProducts: Product[];
}

export default function ProductDetailsClient({
  product,
  similarProducts,
}: ProductDetailsClientProps) {
  const [estimateDays, setEstimateDays] = useState(1);

  const defaultsById: Record<string, UnitCounts> = {
    [product.id]: {
      totalUnits: product.totalUnits,
      availableUnits: product.availableUnits,
      reservedUnits: product.reservedUnits,
      rentedUnits: product.rentedUnits,
    },
  };
  for (const item of similarProducts) {
    defaultsById[item.id] = {
      totalUnits: item.totalUnits,
      availableUnits: item.availableUnits,
      reservedUnits: item.reservedUnits,
      rentedUnits: item.rentedUnits,
    };
  }

  const unitsByProductId = useInventoryMap(defaultsById);
  const units = unitsByProductId.get(product.id) ?? {
    totalUnits: product.totalUnits,
    availableUnits: product.availableUnits,
    reservedUnits: product.reservedUnits,
    rentedUnits: product.rentedUnits,
  };

  const images = product.images.length ? product.images.map((image) => image.url) : [product.image];

  return (
    <>
      <Link href="/catalog" className={styles.backLink}>
        <ArrowLeftIcon size={16} />
        Back to Listings
      </Link>

      <div className={styles.layout}>
        <div className={styles.left}>
          <ImageGallery images={images} productName={product.name} badge={product.badge} />
        </div>

        <div className={styles.info}>
          <p className={styles.category}>
            {product.brand} · {product.category}
          </p>
          <h1 className={styles.name}>{product.name}</h1>
          <p className={styles.rating}>
            {product.rating.toFixed(1)} ★{" "}
            <span className={styles.reviewCount}>({product.reviewCount} reviews)</span>
          </p>

          <p className={styles.description}>{product.description}</p>

          <div className={styles.infoCards}>
            <div className={styles.infoCard}>
              <p className={styles.infoCardLabel}>Daily Rate</p>
              <p className={styles.infoCardValue}>
                {product.currency}
                {product.pricePerDay.toLocaleString()}
                <span className={styles.perDay}>/day</span>
              </p>
            </div>
            <div className={styles.infoCard}>
              <p className={styles.infoCardLabel}>Availability Status</p>
              <AvailabilityBadge
                totalUnits={units.totalUnits}
                availableUnits={units.availableUnits}
                variant="detailed"
              />
            </div>
          </div>

          <div className={styles.actionsRow}>
            <FavoriteButton productId={product.id} productName={product.name} />
          </div>

          <div className={styles.reserveCard}>
            <h2 className={styles.reserveHeading}>Ready to rent this?</h2>
            <RentalDurationSelector days={estimateDays} onChange={setEstimateDays} />
            <QuickEstimate
              pricePerDay={product.pricePerDay}
              currency={product.currency}
              days={estimateDays}
            />
            <p className={styles.estimateNote}>
              This is a non-binding estimate. You&apos;ll choose your exact rental dates in the
              next step.
            </p>
            <ReserveAction product={product} units={units} />
          </div>
        </div>
      </div>

      <ProductTabs
        specs={product.specs}
        included={product.included}
        reviews={product.reviews}
        rating={product.rating}
        reviewCount={product.reviewCount}
      />

      <SimilarProducts products={similarProducts} unitsByProductId={unitsByProductId} />
    </>
  );
}
