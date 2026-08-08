"use client";

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
import { useInventoryMap } from "@/hooks/useInventory";
import {
  createUnitCountsFromAvailability,
  useProductAvailability,
} from "@/hooks/useProductAvailability";
import styles from "./details.module.css";

interface ProductDetailsClientProps {
  product: Product;
  similarProducts: Product[];
}

export default function ProductDetailsClient({
  product,
  similarProducts,
}: ProductDetailsClientProps) {
  const currentAvailability = useProductAvailability(product.id, product.totalUnits);

  const defaultsById: Record<string, UnitCounts> = {};
  for (const item of similarProducts) {
    defaultsById[item.id] = {
      totalUnits: item.totalUnits,
      availableUnits: item.availableUnits,
      reservedUnits: item.reservedUnits,
      rentedUnits: item.rentedUnits,
    };
  }

  const unitsByProductId = useInventoryMap(defaultsById);
  const units = createUnitCountsFromAvailability(product.totalUnits, currentAvailability.availableUnits);

  const images = product.images.length ? product.images.map((image) => image.url) : [product.image];
  const specificationEntries = Object.entries(product.specs);

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
          <p className={styles.category}>{[product.brand, product.category].filter(Boolean).join(" · ")}</p>
          <h1 className={styles.name}>{product.name}</h1>
          {specificationEntries.length > 0 ? (
            <dl className={styles.specificationPills} aria-label="Product specifications">
              {specificationEntries.map(([label, value]) => (
                <div key={label} className={styles.specificationPill}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {product.reviewCount > 0 ? (
            <p className={styles.rating}>
              {product.rating.toFixed(1)} ★{" "}
              <span className={styles.reviewCount}>({product.reviewCount} reviews)</span>
            </p>
          ) : null}

          {product.description ? <p className={styles.description}>{product.description}</p> : null}

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
                mode="summary"
              />
            </div>
            <div className={styles.infoCard}>
              <p className={styles.infoCardLabel}>Refundable Deposit</p>
              <p className={styles.infoCardValue}>
                {product.currency}{product.refundableDeposit.toLocaleString()}
              </p>
            </div>
          </div>

          <div className={styles.detailsSplit}>
            {product.included.length > 0 ? (
              <section className={styles.includedCard} aria-labelledby="included-heading">
                <div className={styles.panelHeadingRow}>
                  <div>
                    <p className={styles.panelEyebrow}>RENTAL KIT</p>
                    <h2 id="included-heading">What comes with it</h2>
                  </div>
                  <span>{product.included.length} items</span>
                </div>
                <ul className={styles.includedGrid}>
                  {product.included.map((item) => (
                    <li key={item}><span aria-hidden="true">✓</span>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className={styles.reserveCard} aria-labelledby="reserve-heading">
              <div className={styles.favoriteRow}>
                <FavoriteButton productId={product.id} productName={product.name} />
              </div>
              <p className={styles.panelEyebrow}>NEXT STEP</p>
              <h2 id="reserve-heading" className={styles.reserveHeading}>Build your reservation</h2>
              <p className={styles.reserveCopy}>
                Choose exact dates, pickup or delivery, then pay 50% or the full amount.
              </p>
              <ReserveAction product={product} units={units} />
            </section>
          </div>
        </div>
      </div>

      <ProductTabs
        specs={{}}
        included={[]}
        reviews={product.reviews}
        rating={product.rating}
        reviewCount={product.reviewCount}
      />

      <SimilarProducts products={similarProducts} unitsByProductId={unitsByProductId} />
    </>
  );
}
