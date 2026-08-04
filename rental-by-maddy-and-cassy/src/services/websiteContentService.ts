import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/lib/supabase/database.types";
import type { WebsiteContent } from "@/src/types/websiteContent";

// public.website_content was NOT carried over by the 2026-08-04 schema
// normalization — it only still exists in legacy_v1_20260804.website_content
// (verified via information_schema.tables) and there is no equivalent CMS
// table anywhere in the new public schema. Nothing else in the app currently
// consumes this service, so rather than invent a replacement table, every
// export below degrades to an empty/no-op state so any future caller gets a
// safe "no content configured" result instead of a crash.

export async function getPublishedWebsiteContent(section?: string): Promise<WebsiteContent[]> {
  void section;
  return [];
}

export async function getWebsiteContentByKey(contentKey: string): Promise<WebsiteContent | null> {
  void contentKey;
  return null;
}

/** Admin editing: kept for call-site compatibility; there is nothing to load. */
export async function getAllWebsiteContentForAdmin(
  supabase: SupabaseClient<Database>,
): Promise<WebsiteContent[]> {
  void supabase;
  return [];
}

export async function upsertWebsiteContent(
  supabase: SupabaseClient<Database>,
  input: { contentKey: string; section: string; content: Record<string, unknown>; isPublished: boolean },
): Promise<void> {
  void supabase;
  void input;
  throw new Error("Website content editing is unavailable: public.website_content no longer exists.");
}
