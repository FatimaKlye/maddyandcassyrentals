import type { Timestamp } from "firebase/firestore";

/**
 * websiteContent/{contentId} — CMS-managed static content blocks (booking
 * process, rental requirements, terms & conditions, FAQs, pickup/delivery
 * info). `content` holds placeholder text until the client supplies
 * approved final wording — see scripts/seedFirebase.ts.
 */
export interface WebsiteContent {
  id: string;
  title: string;
  content: string;
  version?: string;
  displayOrder: number;
  isPublished: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
