// src/lib/pushNotifications.ts
// Works inside Pi Browser (Chromium-based WebView with PWA/SW support).

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";
import { notificationsApi } from "./api";
import { logger } from "./logger";

// ─── Firebase config (use env vars / build-time injection) ────────────────────

const firebaseConfig = {
  apiKey:            process.env.FIREBASE_API_KEY,
  authDomain:        process.env.FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.FIREBASE_PROJECT_ID,
  storageBucket:     process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_SENDER_ID,
  appId:             process.env.FIREBASE_APP_ID,
};

const VAPID_KEY = process.env.FIREBASE_VAPID_KEY;

// ─── Singleton setup ──────────────────────────────────────────────────────────

let app: FirebaseApp;
let messaging: Messaging;

function getFirebaseMessaging(): Messaging {
  if (!app) app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  if (!messaging) messaging = getMessaging(app);
  return messaging;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Request notification permission, register the service worker, obtain the
 * FCM token, then POST it to your backend.
 *
 * Call this after the user logs in (Pi SDK auth completes).
 *
 * @param userId  Your platform user ID (Pi username, DB ObjectId, etc.)
 * @returns       The FCM token, or null if permission was denied.
 */
export async function registerPushNotifications(userId: string): Promise<string | null> {
  // ── Environment audit ──────────────────────────────────────────────
  console.log('[Push] Notification in window:', "Notification" in window);
  console.log('[Push] ServiceWorker in navigator:', "serviceWorker" in navigator);
  console.log('[Push] Current permission:', Notification.permission);
  console.log('[Push] User agent:', navigator.userAgent);
  // ──────────────────────────────────────────────────────────────────

  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    logger.warn("[Push] Not supported in this environment");
    return null;
  }
  
  if (!("serviceWorker" in navigator)) {
    logger.warn("[Push] Service workers not supported");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" }
    );

    const msg = getFirebaseMessaging();

    // Let Firebase handle the permission request internally —
    // getToken() will trigger the prompt if needed
    const token = await getToken(msg, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.warn("[Push] No token returned — permission likely denied by WebView");
      return null;
    }

    await notificationsApi.saveTokenToServer(userId, token);
    console.info("[Push] Registered ✓");
    return token;

  } catch (err) {
    console.error("[Push] Registration failed:", err);
    return null;
  }
}

/**
 * Listen for foreground messages (app is open).
 * Typically you'd show an in-app toast instead of a system notification.
 *
 * @param onReceive  Callback invoked with { title, body, data }
 * @returns          Unsubscribe function
 */
export function onForegroundMessage(
  onReceive: (msg: { title: string; body: string; data?: Record<string, string> }) => void
): () => void {
  const msg = getFirebaseMessaging();
  return onMessage(msg, (payload) => {
    onReceive({
      title: payload.notification?.title ?? "",
      body:  payload.notification?.body  ?? "",
      data:  payload.data as Record<string, string> | undefined,
    });
  });
}

/**
 * Remove the FCM token from the backend (call on logout).
 */
// export async function unregisterPushNotifications(fcmToken: string): Promise<void> {
//   await fetch("/notifications/token", {
//     method:  "DELETE",
//     headers: { "Content-Type": "application/json" },
//     body:    JSON.stringify({ fcmToken }),
//   });
// }

// ─── Internal ─────────────────────────────────────────────────────────────────

// async function saveTokenToServer(userId: string, fcmToken: string): Promise<void> {
//   const res = await fetch("/notifications/token", {
//     method:  "POST",
//     headers: { "Content-Type": "application/json" },
//     body:    JSON.stringify({ userId, fcmToken, platform: "web" }),
//   });

//   if (!res.ok) {
//     const err = await res.text();
//     throw new Error(`[Push] Token save failed: ${err}`);
//   }
// }
