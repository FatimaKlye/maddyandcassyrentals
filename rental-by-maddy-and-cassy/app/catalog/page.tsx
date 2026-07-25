import type { Metadata } from "next";
import Navbar from "@/components/navbar/Navbar";
import CatalogView from "./CatalogView";

export const metadata: Metadata = {
  title: "Rental Item Catalog | Rental by Maddy & Cassy",
  description:
    "Browse premium iPhones and cameras available for daily rental in Metro Manila.",
};

export default function CatalogPage() {
  return (
    <div>
      <Navbar />
      <main>
        <CatalogView />
      </main>
    </div>
  );
}
