import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/navbar/Navbar";
import { getProductById, products } from "@/data/products";
import ProductDetailsClient from "./ProductDetailsClient";
import styles from "./details.module.css";

interface ProductDetailsPageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return products.map((product) => ({ id: product.id }));
}

export async function generateMetadata({
  params,
}: ProductDetailsPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = getProductById(id);

  if (!product) {
    return { title: "Product Not Found | Rental by Maddy & Cassy" };
  }

  return {
    title: `${product.name} | Rental by Maddy & Cassy`,
    description: product.description,
  };
}

export default async function ProductDetailsPage({ params }: ProductDetailsPageProps) {
  const { id } = await params;
  const product = getProductById(id);

  if (!product) {
    notFound();
  }

  const similarProducts = products.filter(
    (item) => item.category === product.category && item.id !== product.id
  );

  return (
    <div>
      <Navbar />
      <main className={styles.main}>
        <ProductDetailsClient product={product} similarProducts={similarProducts} />
      </main>
    </div>
  );
}
