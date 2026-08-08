import type { Metadata } from "next";
import Navbar from "@/components/navbar/Navbar";
import { getActiveProducts } from "@/src/services/productService";
import FavoritesView from "./FavoritesView";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Favorite Rentals | Rental by Maddy & Cassy",
  description: "Review the cameras and phones you saved while browsing the rental catalog.",
};

export default async function FavoritesPage() {
  const products = await getActiveProducts();

  return (
    <div>
      <Navbar />
      <main>
        <FavoritesView products={products} />
      </main>
    </div>
  );
}
