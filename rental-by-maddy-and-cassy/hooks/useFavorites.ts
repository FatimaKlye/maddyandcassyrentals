"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "maddy-cassy-favorites";
const EMPTY_FAVORITES: string[] = [];
const listeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedFavorites: string[] = EMPTY_FAVORITES;

function readFavorites(): string[] {
  if (typeof window === "undefined") return EMPTY_FAVORITES;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedFavorites;
  cachedRaw = raw;
  try {
    cachedFavorites = raw ? JSON.parse(raw) : EMPTY_FAVORITES;
  } catch {
    cachedFavorites = EMPTY_FAVORITES;
  }
  return cachedFavorites;
}

function writeFavorites(favorites: string[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  cachedRaw = JSON.stringify(favorites);
  cachedFavorites = favorites;
  listeners.forEach((listener) => listener());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cachedRaw = null;
      callback();
    }
  };
  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", handleStorage);
  };
}

function getServerSnapshot(): string[] {
  return EMPTY_FAVORITES;
}

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, readFavorites, getServerSnapshot);

  const toggleFavorite = useCallback((productId: string) => {
    const current = readFavorites();
    const next = current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId];
    writeFavorites(next);
  }, []);

  const isFavorite = useCallback(
    (productId: string) => favorites.includes(productId),
    [favorites]
  );

  const clearFavorites = useCallback(() => {
    writeFavorites([]);
  }, []);

  const removeStaleFavorites = useCallback((activeProductIds: string[]) => {
    const activeIds = new Set(activeProductIds);
    const current = readFavorites();
    const validFavorites = current.filter((id) => activeIds.has(id));
    if (validFavorites.length !== current.length) {
      writeFavorites(validFavorites);
    }
  }, []);

  return {
    favorites,
    toggleFavorite,
    isFavorite,
    clearFavorites,
    removeStaleFavorites,
  };
}
