// src/lib/pushNotifications.ts
// Works inside Pi Browser (Chromium-based WebView with PWA/SW support).

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";
import { notificationsApi } from "./api";
import { logger } from "./logger";

// ─── Firebase config (use env vars / build-time injection) ────────────────────

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

// ─── Singleton setup ──────────────────────────────────────────────────────────

let app: FirebaseApp;
let messaging: Messaging;

function getFirebaseMessaging(): Messaging {
  if (!app) app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  if (!messaging) messaging = getMessaging(app);
  return messaging;
}

// ─── Public API ───────────────────────────────────────────────────────────────

function isPiBrowser(): boolean {
  return /PiBrowser/i.test(navigator.userAgent);
}

function getEnvironmentInfo() {
  const ua       = navigator.userAgent;
  const isIOS    = /iPhone|iPad|iPod/i.test(ua);
  // wv = Android WebView token; also catch Pi Browser which may not say PiBrowser
  const isAndroidWebView = /wv/.test(ua) || (/Android/i.test(ua) && !/Chrome\/[0-9]/.test(ua));
  const isIOSWebView = isIOS && !(/Safari\//.test(ua));

  return {
    hasServiceWorker:  'serviceWorker' in navigator,
    hasNotificationAPI: 'Notification' in window,
    isIOS,
    isIOSWebView,
    isAndroidWebView,
  };
}

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
  const env = getEnvironmentInfo();

  // Log for debugging — remove after confirmed working
  console.log('[Push] Environment:', env);
  console.log('[Push] User agent:', navigator.userAgent);

  if (!env.hasServiceWorker) {
    logger.warn('[Push] Service workers not supported');
    return null;
  }

  // iOS WebView can never do web push — bail early
  if (env.isIOSWebView) {
    logger.warn('[Push] iOS WebView — push not supported');
    return null;
  }

  // Skip Notification.permission check on Android WebView —
  // it may not expose the API but FCM via SW can still work
  if (env.hasNotificationAPI && Notification.permission === 'denied') {
    logger.warn('[Push] Notifications blocked');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js',
      { scope: '/' }
    );

    const msg   = getFirebaseMessaging();
    const token = await getToken(msg, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      logger.warn('[Push] No token returned');
      return null;
    }

    await notificationsApi.saveTokenToServer(userId, token);
    logger.info('[Push] Registered ✓');
    return token;

  } catch (err: any) {
    if (
      err?.code === 'messaging/permission-blocked' ||
      err?.code === 'messaging/permission-default'
    ) {
      logger.warn('[Push] Permission not granted:', err.code);
      return null;
    }
    logger.error('[Push] Registration failed:', err);
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
