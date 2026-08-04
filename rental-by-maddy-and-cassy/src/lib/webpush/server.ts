import "server-only";

import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/lib/supabase/database.types";

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT?.trim() || "mailto:support@example.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

/**
 * Replaces Firebase Cloud Messaging with the standard Web Push API. Sends to
 * every stored subscription for a user (public.push_subscriptions) and
 * prunes any endpoint the push service reports as gone (410/404), mirroring
 * the old FCM invalid-token cleanup.
 */
export async function sendPushNotification(
  admin: SupabaseClient<Database>,
  input: { userId: string; title: string; body: string; actionUrl: string },
): Promise<void> {
  if (!ensureConfigured()) return;

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", input.userId);

  if (!subscriptions?.length) return;

  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    actionUrl: input.actionUrl,
    icon: "/images/maddy-cassy-rentals-icon.png",
  });

  const staleEndpoints: string[] = [];

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh_key, auth: subscription.auth_key },
          },
          payload,
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          staleEndpoints.push(subscription.endpoint);
        } else {
          console.error("Web push delivery failed", error);
        }
      }
    }),
  );

  if (staleEndpoints.length) {
    await admin.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
  }
}
