"use client";

import { useState } from "react";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { app } from "@/src/lib/firebase/config";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/ToastProvider";
import styles from "./PushNotificationButton.module.css";
import { getAppCheckHeaders } from "@/src/lib/firebase/appCheckClient";

export default function PushNotificationButton() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [enabling, setEnabling] = useState(false);
  const [enabled, setEnabled] = useState(
    typeof Notification !== "undefined" && Notification.permission === "granted",
  );

  async function enable() {
    if (!user) return;
    setEnabling(true);
    try {
      if (!(await isSupported())) throw new Error("This browser does not support push notifications.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission was not granted.");
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!vapidKey) throw new Error("Web push is not configured yet.");
      const serviceWorkerRegistration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
      );
      const token = await getToken(getMessaging(app), {
        vapidKey,
        serviceWorkerRegistration,
      });
      if (!token) throw new Error("The browser did not return a push token.");
      const response = await fetch("/api/push/register", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
          "Content-Type": "application/json",
          ...(await getAppCheckHeaders()),
        },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) throw new Error("The push token could not be registered.");
      setEnabled(true);
      showToast("Push notifications are enabled on this device.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Push notifications could not be enabled.", "error");
    } finally {
      setEnabling(false);
    }
  }

  return (
    <div className={styles.panel}>
      <div><strong>Booking push notifications</strong><span>Receive payment, review, and rental-status updates on this device.</span></div>
      <button type="button" onClick={enable} disabled={enabled || enabling}>
        {enabled ? "Enabled" : enabling ? "Enabling..." : "Enable Notifications"}
      </button>
    </div>
  );
}
