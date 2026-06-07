// src/lib/pushNotifications.ts

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
// ✅ Import getToken from the correct modular subpath — fixes the deprecated overload warning
import { getMessaging, onMessage, Messaging } from "firebase/messaging";
import { getToken } from "firebase/messaging";
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

export interface EnvironmentInfo {
  ua: string;
  hasServiceWorker: boolean;
  hasNotificationAPI: boolean;
  notificationPermission: 'granted' | 'denied' | 'default';
  isIOS: boolean;
  isIOSWebView: boolean;
  isAndroid: boolean;
  isAndroidWebView: boolean;
}

export function getEnvironmentInfo(): EnvironmentInfo {
  const ua = navigator.userAgent;

  const isIOS     = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  // Real Mobile Safari always includes "Version/X.X" — WKWebView / Pi Browser omit it
  // Also catch explicit PiBrowser token just in case
  const isIOSWebView =
    isIOS && (/PiBrowser/i.test(ua) || !/Version\/[\d.]+/.test(ua));

  // Android WebView carries the "wv" token per Google's spec
  const isAndroidWebView = isAndroid && /\bwv\b/.test(ua);

  const hasNotificationAPI = typeof Notification !== 'undefined';

  return {
    ua,
    hasServiceWorker:      'serviceWorker' in navigator,
    hasNotificationAPI,
    // Safe read — never throws
    notificationPermission: hasNotificationAPI
      ? (Notification.permission as 'granted' | 'denied' | 'default')
      : 'default',
    isIOS,
    isIOSWebView,
    isAndroid,
    isAndroidWebView,
  };
}

// ─── Register ─────────────────────────────────────────────────────────────────

export async function registerPushNotifications(userId: string): Promise<string | null> {
  const env = getEnvironmentInfo();

  // Always log — helps debug across devices
  console.log('[Push] env:', JSON.stringify(env, null, 2));

  if (!env.hasServiceWorker) {
    logger.warn('[Push] Service workers not supported');
    return null;
  }

  if (env.isIOSWebView) {
    logger.warn('[Push] iOS WebView — push not supported');
    return null;
  }

  // Only hard-block when the API exists AND is explicitly denied
  if (env.hasNotificationAPI && env.notificationPermission === 'denied') {
    logger.warn('[Push] Notifications blocked by user');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js',
      { scope: '/' }
    );
    console.log('[Push] SW registered:', registration.scope);

    const msg   = getFirebaseMessaging();
    // ✅ Pass messaging instance as first arg — this is the non-deprecated signature
    const token = await getToken(msg, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      logger.warn('[Push] No token returned — user likely denied the prompt');
      return null;
    }

    await notificationsApi.saveTokenToServer(userId, token);
    logger.info('[Push] Registered ✓', token.slice(0, 12) + '…');
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