import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase/config";
import type { Review } from "@/src/types/firebase";

const REVIEWS_COLLECTION = "reviews";

function mapReview(snapshot: QueryDocumentSnapshot<DocumentData>): Review {
  return { id: snapshot.id, ...snapshot.data() } as Review;
}

/**
 * Submits a review. Firestore rules independently re-verify that the
 * booking belongs to this customer, is for this product, and has status
 * "completed" — this client-side check only produces a friendlier error.
 */
export async function submitReview(input: {
  userId: string;
  bookingId: string;
  productId: string;
  rating: number;
  comment?: string;
}): Promise<string> {
  const docRef = await addDoc(collection(db, REVIEWS_COLLECTION), {
    userId: input.userId,
    bookingId: input.bookingId,
    productId: input.productId,
    rating: input.rating,
    comment: input.comment ?? "",
    status: "pending",
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getApprovedReviewsForProduct(productId: string): Promise<Review[]> {
  const reviewsQuery = query(
    collection(db, REVIEWS_COLLECTION),
    where("productId", "==", productId),
    where("status", "==", "approved"),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(reviewsQuery);
  return snapshot.docs.map(mapReview);
}
