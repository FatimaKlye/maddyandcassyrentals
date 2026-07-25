"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./ImageGallery.module.css";

interface ImageGalleryProps {
  images: string[];
  productName: string;
  badge?: string;
}

export default function ImageGallery({ images, productName, badge }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"photo" | "360">("photo");
  const activeImage = images[activeIndex] ?? images[0];

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.mainImageWrapper} ${viewMode === "360" ? styles.spinMode : ""}`}>
        <Image
          src={activeImage}
          alt={`${productName} available for rent`}
          fill
          sizes="(max-width: 900px) 90vw, 480px"
          className={styles.mainImage}
          priority
        />

        {badge ? <span className={styles.productBadge}>{badge}</span> : null}

        <button
          type="button"
          className={`${styles.viewToggle} ${viewMode === "360" ? styles.viewToggleActive : ""}`}
          onClick={() => setViewMode((mode) => (mode === "photo" ? "360" : "photo"))}
          aria-pressed={viewMode === "360"}
          aria-label="Toggle between photo and 360 degree / 3D view"
        >
          360° | 3D View
        </button>
      </div>

      {images.length > 1 ? (
        <div className={styles.thumbnailRow} role="tablist" aria-label={`${productName} images`}>
          {images.map((image, index) => (
            <button
              key={image + index}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              className={`${styles.thumbnail} ${index === activeIndex ? styles.thumbnailActive : ""}`}
              onClick={() => setActiveIndex(index)}
            >
              <Image
                src={image}
                alt={`${productName} view ${index + 1}`}
                fill
                sizes="80px"
                className={styles.thumbnailImage}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
