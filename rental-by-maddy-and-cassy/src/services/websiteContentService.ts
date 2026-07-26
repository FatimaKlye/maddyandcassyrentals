import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase/config";
import type { WebsiteContent } from "@/src/types/websiteContent";

const WEBSITE_CONTENT_COLLECTION = "websiteContent";

function mapContent(snapshot: QueryDocumentSnapshot<DocumentData>): WebsiteContent {
  return { id: snapshot.id, ...snapshot.data() } as WebsiteContent;
}

export async function getPublishedWebsiteContent(): Promise<WebsiteContent[]> {
  const contentQuery = query(
    collection(db, WEBSITE_CONTENT_COLLECTION),
    where("isPublished", "==", true),
    orderBy("displayOrder", "asc")
  );
  const snapshot = await getDocs(contentQuery);
  return snapshot.docs.map(mapContent);
}

export async function getWebsiteContentById(contentId: string): Promise<WebsiteContent | null> {
  const snapshot = await getDoc(doc(db, WEBSITE_CONTENT_COLLECTION, contentId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as WebsiteContent;
}
