"use client";

import { useFavorites } from "@/hooks/useFavorites";
import HeartIcon from "@/components/icons/HeartIcon";
import styles from "./FavoriteButton.module.css";

interface FavoriteButtonProps {
  productId: string;
  productName: string;
}

export default function FavoriteButton({ productId, productName }: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(productId);

  return (
    <button
      type="button"
      className={`${styles.button} ${active ? styles.active : ""}`}
      onClick={() => toggleFavorite(productId)}
      aria-pressed={active}
      aria-label={active ? `Remove ${productName} from favorites` : `Add ${productName} to favorites`}
    >
      <HeartIcon size={18} filled={active} />
      {active ? "Saved" : "Save"}
    </button>
  );
}
