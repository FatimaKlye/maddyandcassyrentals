self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Notification", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Rental by Maddy & Cassy", {
      body: data.body || "",
      icon: data.icon || "/images/maddy-cassy-rentals-icon.png",
      data: { actionUrl: data.actionUrl || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const actionUrl = (event.notification.data && event.notification.data.actionUrl) || "/";
  event.waitUntil(clients.openWindow(actionUrl));
});
