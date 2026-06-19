// src/lib/pushNotifications.ts

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getMessaging, onMessage, Messaging, getToken } from "firebase/messaging";
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

export type PushSupport =
  | 'supported'        // Desktop browser or full PWA — can do web push
  | 'android-webview'  // Android Pi Browser — no Notification API in WebView
  | 'ios-webview'      // iPhone Pi Browser — no SW support in WKWebView
  | 'no-sw';           // anything else without service worker

export interface EnvironmentInfo {
  ua: string;
  support: PushSupport;
  hasServiceWorker: boolean;
  hasNotificationAPI: boolean;
  notificationPermission: 'granted' | 'denied' | 'default';
  isIOS: boolean;
  isAndroid: boolean;
  isAndroidWebView: boolean;
  isIOSWebView: boolean;
}

export function getEnvironmentInfo(): EnvironmentInfo {
  const ua      = navigator.userAgent;
  const isIOS   = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  // Android WebView carries the "wv" token (confirmed from real Pi Browser UA)
  const isAndroidWebView = isAndroid && /\bwv\b/.test(ua);

  // Real Mobile Safari always has Version/X.X — Pi Browser WKWebView omits it
  const isIOSWebView = isIOS && !/Version\/[\d.]+/.test(ua);

  const hasServiceWorker  = 'serviceWorker' in navigator;
  const hasNotificationAPI = typeof Notification !== 'undefined';
  const notificationPermission = hasNotificationAPI
    ? (Notification.permission as 'granted' | 'denied' | 'default')
    : 'default';

  let support: PushSupport;
  if (!hasServiceWorker)    support = isIOSWebView ? 'ios-webview' : 'no-sw';
  else if (isAndroidWebView) support = 'android-webview';
  else if (isIOSWebView)     support = 'ios-webview';
  else                       support = 'supported';

  return {
    ua,
    support,
    hasServiceWorker,
    hasNotificationAPI,
    notificationPermission,
    isIOS,
    isAndroid,
    isAndroidWebView,
    isIOSWebView,
  };
}

// ─── Register ─────────────────────────────────────────────────────────────────

export async function registerPushNotifications(userId: string): Promise<string | null> {
  const env = getEnvironmentInfo();
  console.log('[Push] env:', JSON.stringify(env, null, 2));

  if (env.support === 'ios-webview' || env.support === 'no-sw') {
    logger.warn('[Push] Not supported:', env.support);
    return null;
  }

  if (env.support === 'android-webview') {
    logger.warn('[Push] Android WebView — Notification API unavailable');
    return null;
  }

  if (env.notificationPermission === 'denied') {
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
      logger.warn('[Push] No token returned — user likely denied the prompt');
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