import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase/config";
import type { Product } from "@/src/types/firebase";

const PRODUCTS_COLLECTION = "products";

function mapProduct(snapshot: QueryDocumentSnapshot<DocumentData>): Product {
  return { id: snapshot.id, ...snapshot.data() } as Product;
}

export async function getActiveProducts(): Promise<Product[]> {
  const productsQuery = query(
    collection(db, PRODUCTS_COLLECTION),
    where("isActive", "==", true)
  );
  const snapshot = await getDocs(productsQuery);
  return snapshot.docs.map(mapProduct);
}

export async function getProductById(productId: string): Promise<Product | null> {
  const snapshot = await getDoc(doc(db, PRODUCTS_COLLECTION, productId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Product;
}

export async function getAllProducts(): Promise<Product[]> {
  const snapshot = await getDocs(collection(db, PRODUCTS_COLLECTION));
  return snapshot.docs.map(mapProduct);
}

export async function createProduct(
  product: Omit<Product, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), {
    ...product,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateProduct(
  productId: string,
  updates: Partial<Omit<Product, "id" | "createdAt" | "updatedAt">>
): Promise<void> {
  await updateDoc(doc(db, PRODUCTS_COLLECTION, productId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProduct(productId: string): Promise<void> {
  await deleteDoc(doc(db, PRODUCTS_COLLECTION, productId));
}
