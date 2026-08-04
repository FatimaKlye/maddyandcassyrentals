/** public.website_content */
export interface WebsiteContent {
  id: string;
  contentKey: string;
  section: string;
  content: Record<string, unknown>;
  isPublished: boolean;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}
