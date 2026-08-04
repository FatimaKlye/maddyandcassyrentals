import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/src/lib/supabase/public";
import type { Database, Tables } from "@/src/lib/supabase/database.types";
import { toJson } from "@/src/lib/supabase/types";
import type { WebsiteContent } from "@/src/types/websiteContent";

function mapContent(row: Tables<"website_content">): WebsiteContent {
  return {
    id: row.id,
    contentKey: row.content_key,
    section: row.section,
    content: row.content as Record<string, unknown>,
    isPublished: row.is_published,
    updatedBy: row.updated_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getPublishedWebsiteContent(section?: string): Promise<WebsiteContent[]> {
  let query = createPublicClient().from("website_content").select("*").eq("is_published", true);
  if (section) query = query.eq("section", section);
  const { data, error } = await query.order("content_key", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapContent);
}

export async function getWebsiteContentByKey(contentKey: string): Promise<WebsiteContent | null> {
  const { data, error } = await createPublicClient()
    .from("website_content")
    .select("*")
    .eq("content_key", contentKey)
    .eq("is_published", true)
    .maybeSingle();
  if (error || !data) return null;
  return mapContent(data);
}

/** Admin editing: pass a session-bound client so RLS reveals unpublished content too. */
export async function getAllWebsiteContentForAdmin(
  supabase: SupabaseClient<Database>,
): Promise<WebsiteContent[]> {
  const { data, error } = await supabase.from("website_content").select("*").order("section");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapContent);
}

export async function upsertWebsiteContent(
  supabase: SupabaseClient<Database>,
  input: { contentKey: string; section: string; content: Record<string, unknown>; isPublished: boolean },
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("website_content").upsert(
    {
      content_key: input.contentKey,
      section: input.section,
      content: toJson(input.content),
      is_published: input.isPublished,
      updated_by: user?.id,
    },
    { onConflict: "content_key" },
  );
  if (error) throw new Error(error.message);
}
