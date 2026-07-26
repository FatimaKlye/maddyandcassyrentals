import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/navbar/Navbar";
import { getProductById } from "@/src/services/productService";
import ReserveFlowClient from "./ReserveFlowClient";

interface ReservePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ReservePageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  return {
    title: product ? `Reserve ${product.name} | Rental by Maddy & Cassy` : "Reserve | Rental by Maddy & Cassy",
  };
}

export default async function ReservePage({ params }: ReservePageProps) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product || !product.isActive) {
    notFound();
  }

  return (
    <div>
      <Navbar />
      <main>
        <ReserveFlowClient
          product={product}
          units={{
            totalUnits: product.totalUnits,
            availableUnits: product.availableUnits,
            reservedUnits: product.reservedUnits,
            rentedUnits: product.rentedUnits,
          }}
        />
      </main>
    </div>
  );
}
