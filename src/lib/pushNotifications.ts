// src/lib/pushNotifications.ts

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";
import { notificationsApi } from "./api";
import { logger } from "./logger";

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

let app: FirebaseApp;
let messaging: Messaging;

function getFirebaseMessaging(): Messaging {
  if (!app) app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  if (!messaging) messaging = getMessaging(app);
  return messaging;
}

// ─── Environment detection ────────────────────────────────────────────────────

export function getEnvironmentInfo() {
  const ua = navigator.userAgent;

  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  // Pi Browser on iOS uses WKWebView — it includes "Safari/" in the UA just
  // like mobile Safari, but it is NOT Safari. The reliable signal is the
  // absence of "Version/X.X" which real Mobile Safari always includes.
  // Pi Browser / other WKWebViews typically omit it OR include "PiBrowser".
  const isIOSWebView =
    isIOS &&
    (
      /PiBrowser/i.test(ua) ||
      !/Version\/[\d.]+/.test(ua)   // real Mobile Safari always has Version/X.X
    );

  // Android WebView carries the "wv" token
  const isAndroidWebView = !isIOS && /wv/.test(ua);

  // Whether the Notification API is available at all
  const hasNotificationAPI = typeof Notification !== 'undefined';

  return {
    hasServiceWorker:   'serviceWorker' in navigator,
    hasNotificationAPI,
    isIOS,
    isIOSWebView,
    isAndroidWebView,
    // Current browser permission — safe to read (falls back to 'default')
    notificationPermission: hasNotificationAPI
      ? (Notification.permission as 'granted' | 'denied' | 'default')
      : 'default' as const,
  };
}

// ─── Register ─────────────────────────────────────────────────────────────────

export async function registerPushNotifications(userId: string): Promise<string | null> {
  const env = getEnvironmentInfo();

  console.log('[Push] Environment:', env);
  console.log('[Push] UA:', navigator.userAgent);

  if (!env.hasServiceWorker) {
    logger.warn('[Push] Service workers not supported');
    return null;
  }

  if (env.isIOSWebView) {
    logger.warn('[Push] iOS WebView — push not supported');
    return null;
  }

  // Only hard-block if the API exists AND is explicitly denied
  if (env.hasNotificationAPI && env.notificationPermission === 'denied') {
    logger.warn('[Push] Notifications blocked by user');
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

// ─── Foreground listener ──────────────────────────────────────────────────────

export function onForegroundMessage(
  onReceive: (msg: { title: string; body: string; data?: Record<string, string> }) => void
): () => void {
  const msg = getFirebaseMessaging();
  return onMessage(msg, (payload) => {
    onReceive({
      title: payload.notification?.title ?? '',
      body:  payload.notification?.body  ?? '',
      data:  payload.data as Record<string, string> | undefined,
    });
  });
}