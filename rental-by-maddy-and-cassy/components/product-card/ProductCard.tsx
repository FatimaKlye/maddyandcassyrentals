import Image from "next/image";
import type { Product } from "@/types/product";
import AvailabilityBadge from "@/components/availability-badge/AvailabilityBadge";
import styles from "./ProductCard.module.css";

interface ProductCardProps {
  product: Product;
  className?: string;
}

export default function ProductCard({ product, className }: ProductCardProps) {
  const cardClassName = className
    ? `${styles.card} ${className}`
    : styles.card;

  return (
    <article className={cardClassName}>
      <div className={styles.imageWrapper}>
        <Image
          src={product.image || "/images/product-placeholder.png"}
          alt={`${product.name} available for rent`}
          fill
          sizes="(max-width: 640px) 90vw, 320px"
          className={styles.image}
        />
        <AvailabilityBadge
          totalUnits={product.totalUnits}
          availableUnits={product.availableUnits}
          className={styles.badge}
        />
      </div>

      <div className={styles.info}>
        <p className={styles.brand}>{product.brand}</p>
        <h3 className={styles.name}>{product.name}</h3>
        <p className={styles.price}>
          {product.currency}
          {product.pricePerDay.toLocaleString()}
          <span className={styles.perDay}>/day</span>
        </p>
      </div>
    </article>
  );
}
