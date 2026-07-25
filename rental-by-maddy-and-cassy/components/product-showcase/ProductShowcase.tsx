import ProductCard from "@/components/product-card/ProductCard";
import { products } from "@/data/products";
import styles from "./ProductShowcase.module.css";

export default function ProductShowcase() {
  const [firstProduct, secondProduct] = products;

  return (
    <div id="showcase" className={styles.showcase} aria-label="Featured rental gear">
      <div className={styles.glow} aria-hidden="true" />

      {firstProduct ? (
        <ProductCard product={firstProduct} className={styles.cardTop} />
      ) : null}

      {secondProduct ? (
        <ProductCard product={secondProduct} className={styles.cardBottom} />
      ) : null}
    </div>
  );
}
