import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase/config";
import { storage } from "@/src/lib/firebase/config";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import type { Product } from "@/types/product";

const PRODUCTS_COLLECTION = "products";

function serializeTimestamps(data: DocumentData): DocumentData {
  const result: DocumentData = { ...data };
  for (const key of ["createdAt", "updatedAt"]) {
    const value = result[key];
    if (value instanceof Timestamp) {
      result[key] = value.toDate().toISOString();
    }
  }
  return result;
}

function mapProduct(snapshot: QueryDocumentSnapshot<DocumentData>): Product {
  return { id: snapshot.id, ...serializeTimestamps(snapshot.data()) } as Product;
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
  return { id: snapshot.id, ...serializeTimestamps(snapshot.data()) } as Product;
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

export interface CatalogEditorInput {
  name: string;
  brand: string;
  category: "Phones" | "Cameras";
  description: string;
  pricePerDay: number;
  image: string;
  included: string[];
  totalUnits: number;
  isActive: boolean;
}

async function adminCatalogRequest(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  idToken: string,
  input?: CatalogEditorInput,
): Promise<void> {
  const response = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...(input ? { "Content-Type": "application/json" } : {}),
    },
    body: input ? JSON.stringify(input) : undefined,
  });
  if (response.ok) return;
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  throw new Error(
    typeof body?.error === "string" ? body.error : "The catalog change could not be saved.",
  );
}

export async function createCatalogProductAsAdmin(
  input: CatalogEditorInput,
  idToken: string,
): Promise<void> {
  return adminCatalogRequest("/api/admin/catalog", "POST", idToken, input);
}

export async function updateCatalogProductAsAdmin(
  productId: string,
  input: CatalogEditorInput,
  idToken: string,
): Promise<void> {
  return adminCatalogRequest(
    `/api/admin/catalog/${encodeURIComponent(productId)}`,
    "PATCH",
    idToken,
    input,
  );
}

export async function deactivateCatalogProductAsAdmin(
  productId: string,
  idToken: string,
): Promise<void> {
  return adminCatalogRequest(
    `/api/admin/catalog/${encodeURIComponent(productId)}`,
    "DELETE",
    idToken,
  );
}

export async function uploadCatalogImage(
  productId: string,
  file: File,
): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const storageRef = ref(
    storage,
    `products/${productId}/catalog-${Date.now()}.${extension}`,
  );
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export interface PriceHistoryEntry {
  id: string;
  productId: string;
  previousPrice: number | null;
  newPrice: number;
  changedBy: string;
  reason: string;
  createdAt: Timestamp;
}

export async function getPriceHistory(): Promise<PriceHistoryEntry[]> {
  const snapshot = await getDocs(collectionGroup(db, "priceHistory"));
  return snapshot.docs.map((item) => ({
    id: item.id,
    productId: item.ref.parent.parent?.id ?? "",
    ...item.data(),
  })) as PriceHistoryEntry[];
}
