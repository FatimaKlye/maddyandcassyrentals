import type { Metadata } from "next";
import Navbar from "@/components/navbar/Navbar";
import { getActiveProducts } from "@/src/services/productService";
import CatalogView from "./CatalogView";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Rental Item Catalog | Rental by Maddy & Cassy",
  description:
    "Browse premium iPhones and cameras available for daily rental in Metro Manila.",
};

export default async function CatalogPage() {
  const products = await getActiveProducts();

  return (
    <div>
      <Navbar />
      <main>
        <CatalogView products={products} />
      </main>
    </div>
  );
}
