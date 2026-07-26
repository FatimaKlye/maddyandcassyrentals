"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import type { UserNotification } from "@/src/types/notification";
import { markNotificationRead, subscribeToUserNotifications } from "@/src/services/notificationService";
import styles from "./NotificationList.module.css";

export default function NotificationList({ uid }: { uid: string }) {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);

  useEffect(() => {
    return subscribeToUserNotifications(uid, setNotifications);
  }, [uid]);

  if (notifications.length === 0) {
    return <p className={styles.empty}>You have no notifications yet.</p>;
  }

  return (
    <ul className={styles.list}>
      {notifications.map((notification) => (
        <li
          key={notification.id}
          className={`${styles.item} ${notification.isRead ? "" : styles.unread}`}
        >
          <div>
            <p className={styles.title}>{notification.title}</p>
            <p className={styles.message}>{notification.message}</p>
            <p className={styles.time}>
              {notification.createdAt
                ? formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true })
                : ""}
            </p>
          </div>
          {!notification.isRead ? (
            <button
              type="button"
              className={styles.markReadButton}
              onClick={() => markNotificationRead(uid, notification.id)}
            >
              Mark as read
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
