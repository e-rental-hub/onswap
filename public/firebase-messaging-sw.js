// public/firebase-messaging-sw.js
// Place this file at the ROOT of your public directory.
// Pi Browser loads this as a service worker for background push handling.

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            self.__FIREBASE_API_KEY__       || "YOUR_API_KEY",
  authDomain:        self.__FIREBASE_AUTH_DOMAIN__   || "YOUR_AUTH_DOMAIN",
  projectId:         self.__FIREBASE_PROJECT_ID__    || "YOUR_PROJECT_ID",
  storageBucket:     self.__FIREBASE_STORAGE_BUCKET__|| "YOUR_STORAGE_BUCKET",
  messagingSenderId: self.__FIREBASE_SENDER_ID__     || "YOUR_SENDER_ID",
  appId:             self.__FIREBASE_APP_ID__        || "YOUR_APP_ID",
});

const messaging = firebase.messaging();

// ─── Background message handler ───────────────────────────────────────────────
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] Background message:", payload);

  const { title, body, image } = payload.notification ?? {};
  const data = payload.data ?? {};

  self.registration.showNotification(title ?? "New Notification", {
    body:    body ?? "",
    icon:    "/icons/icon-192x192.png",
    badge:   "/icons/badge-72x72.png",
    image,
    data:    { url: data.url ?? "/" },
    actions: data.actionLabel
      ? [{ action: "open", title: data.actionLabel }]
      : [],
    // Keep notification until user interacts (good for payment alerts)
    requireInteraction: data.requireInteraction === "true",
  });
});

// ─── Notification click handler ───────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url ?? "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // If app is already open, focus it and navigate
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
