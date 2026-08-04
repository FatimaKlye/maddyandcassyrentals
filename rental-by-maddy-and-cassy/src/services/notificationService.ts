import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/src/lib/supabase/database.types";
import type { UserNotification } from "@/src/types/notification";

function mapNotification(row: Tables<"notifications">): UserNotification {
  return {
    id: row.id,
    userId: row.user_id,
    bookingId: row.booking_id ?? undefined,
    type: row.notification_type,
    title: row.title,
    message: row.message,
    actionUrl: row.action_url ?? undefined,
    isRead: row.is_read,
    createdAt: row.created_at,
    readAt: row.read_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
  };
}

/**
 * Loads existing notifications, then keeps them live via Supabase Realtime
 * (notifications is enabled on the supabase_realtime publication — see the
 * PayMongo/audit migration). Replaces the old Firestore onSnapshot listener.
 */
export function subscribeToUserNotifications(
  supabase: SupabaseClient<Database>,
  uid: string,
  callback: (notifications: UserNotification[]) => void,
): () => void {
  let current: UserNotification[] = [];

  supabase
    .from("notifications")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .then(({ data }) => {
      current = (data ?? []).map(mapNotification);
      callback(current);
    });

  const channel = supabase
    .channel(`notifications-${uid}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
      (payload) => {
        if (payload.eventType === "INSERT") {
          current = [mapNotification(payload.new as Tables<"notifications">), ...current];
        } else if (payload.eventType === "UPDATE") {
          const updated = mapNotification(payload.new as Tables<"notifications">);
          current = current.map((item) => (item.id === updated.id ? updated : item));
        } else if (payload.eventType === "DELETE") {
          const oldRow = payload.old as Tables<"notifications">;
          current = current.filter((item) => item.id !== oldRow.id);
        }
        callback(current);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function markNotificationRead(
  supabase: SupabaseClient<Database>,
  notificationId: string,
): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId);
  if (error) throw new Error(error.message);
}
