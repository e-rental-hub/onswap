'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { registerPushNotifications } from '@/lib/pushNotifications';
import { logger } from '@/lib/logger';
import { notificationsApi } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationSettingsModalProps {
  onClose: () => void;
}

type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

// ─── Notification row item ────────────────────────────────────────────────────

interface NotificationItem {
  id: string;
  label: string;
  description: string;
  icon: string;
}

const NOTIFICATION_TYPES: NotificationItem[] = [
  {
    id: 'payments',
    label: 'Payment Alerts',
    description: 'Incoming and outgoing Pi payment notifications',
    icon: '₿',
  },
  {
    id: 'orders',
    label: 'Order Updates',
    description: 'Status changes on your buy and sell orders',
    icon: '📦',
  },
  {
    id: 'messages',
    label: 'New Messages',
    description: 'Messages from buyers, sellers, and support',
    icon: '💬',
  },
  {
    id: 'promotions',
    label: 'Platform Updates',
    description: 'New features, announcements, and promos',
    icon: '📣',
  },
];

// ─── Checkbox row ─────────────────────────────────────────────────────────────

function NotificationRow({
  item,
  enabled,
  masterEnabled,
  onChange,
}: {
  item: NotificationItem;
  enabled: boolean;
  masterEnabled: boolean;
  onChange: (id: string, val: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-xl p-3 transition-all"
      style={{
        background: enabled && masterEnabled ? 'rgba(240,160,60,0.06)' : 'var(--bg-elevated)',
        border: `1px solid ${enabled && masterEnabled ? 'rgba(240,160,60,0.25)' : 'var(--border)'}`,
        opacity: masterEnabled ? 1 : 0.45,
        transition: 'all 0.2s ease',
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          {item.icon}
        </span>
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {item.label}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {item.description}
          </p>
        </div>
      </div>

      {/* Custom checkbox */}
      <button
        type="button"
        disabled={!masterEnabled}
        onClick={() => onChange(item.id, !enabled)}
        aria-checked={enabled}
        role="checkbox"
        className="flex-shrink-0 w-11 h-6 rounded-full relative transition-all focus:outline-none"
        style={{
          background: enabled && masterEnabled ? 'var(--pi-gold)' : 'var(--bg-card)',
          border: `1.5px solid ${enabled && masterEnabled ? 'var(--pi-gold)' : 'var(--border)'}`,
          cursor: masterEnabled ? 'pointer' : 'not-allowed',
          transition: 'background 0.2s, border-color 0.2s',
        }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full"
          style={{
            background: enabled && masterEnabled ? '#fff' : 'var(--text-muted)',
            left: enabled && masterEnabled ? 'calc(100% - 18px)' : '2px',
            transition: 'left 0.2s ease, background 0.2s',
          }}
        />
      </button>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function NotificationSettingsModal({ onClose }: NotificationSettingsModalProps) {
  const { user } = useAuth();

  const [permissionState, setPermissionState] = useState<PermissionState>('default');
  const [masterEnabled,   setMasterEnabled]   = useState(false);
  const [fcmToken,        setFcmToken]        = useState<string | null>(null);
  const [loading,         setLoading]         = useState(false);
  const [preferences, setPreferences] = useState<Record<string, boolean>>(
    () => Object.fromEntries(NOTIFICATION_TYPES.map((n) => [n.id, true]))
  );
  const [unsupportedReason, setUnsupportedReason] = useState<'ios-webview' | 'no-sw' | null>(null);

  // ── Detect current permission state on mount ──────────────────────────────
  useEffect(() => {
    const ua            = navigator.userAgent;
    const isIOS         = /iPhone|iPad|iPod/i.test(ua);
    const isIOSWebView  = isIOS && !/Safari\//.test(ua);

    if (!('serviceWorker' in navigator)) {
      setPermissionState('unsupported');
      setUnsupportedReason('no-sw');
      return;
    }

    if (isIOSWebView) {
      setPermissionState('unsupported');
      setUnsupportedReason('ios-webview');
      return;
    }

    // Android WebView + any env where Notification API is absent
    // — treat as "default" so the user can still attempt to enable
    if (!('Notification' in window)) {
      setPermissionState('default');
      return;
    }

    const p = Notification.permission as PermissionState;
    setPermissionState(p);
    setMasterEnabled(p === 'granted');
  }, []);

  // ── Enable push notifications ─────────────────────────────────────────────
  const handleEnable = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await registerPushNotifications(user.id);
      if (token) {
        setFcmToken(token);
        setMasterEnabled(true);
        setPermissionState('granted');
      } else {
        setPermissionState(Notification.permission as PermissionState);
      }
    } catch (err) {
      logger.error('[NotificationModal] Enable failed:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ── Disable push notifications ────────────────────────────────────────────
  const handleDisable = useCallback(async () => {
    setLoading(true);
    try {
      if (fcmToken) await notificationsApi.unregisterPushNotifications(fcmToken);
      setMasterEnabled(false);
      setFcmToken(null);
    } catch (err) {
      logger.error('[NotificationModal] Disable failed:', err);
    } finally {
      setLoading(false);
    }
  }, [fcmToken]);

  // ── Toggle master switch ──────────────────────────────────────────────────
  const handleMasterToggle = () => {
    if (masterEnabled) {
      handleDisable();
    } else {
      handleEnable();
    }
  };

  const handlePrefChange = (id: string, val: boolean) => {
    setPreferences((prev) => ({ ...prev, [id]: val }));
    // TODO: persist preference to backend if needed
  };

  // ── Permission blocked banner ─────────────────────────────────────────────
  const isBlocked = permissionState === 'denied';
  const isUnsupported = permissionState === 'unsupported';

  // Replace the unsupported banner JSX:
  {isUnsupported && (
    <div
      className="rounded-xl p-4 mb-4 text-sm"
      style={{
        background: 'rgba(100,100,100,0.1)',
        border: '1px solid var(--border)',
      }}
    >
      {unsupportedReason === 'ios-webview' ? (
        <>
          <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
            Not available in Pi Browser on iPhone
          </p>
          <p style={{ color: 'var(--text-muted)' }}>
            Apple restricts web push to Safari only. To receive notifications,
            open this app in <strong>Safari</strong>, tap the Share button, and
            select <strong>"Add to Home Screen"</strong> — then enable
            notifications from your Home Screen app.
          </p>
        </>
      ) : (
        <p style={{ color: 'var(--text-muted)' }}>
          Push notifications are not supported in this environment.
        </p>
      )}
    </div>
  )}

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 relative animate-slide-up"
        style={{ background: 'var(--bg-card)', border: '1px solid rgba(240,160,60,0.2)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              Push <span className="pi-text">Notifications</span>
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Manage your notification preferences
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>

        {/* Blocked banner */}
        {isBlocked && (
          <div
            className="rounded-xl p-4 mb-4 text-sm"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: 'var(--text-primary)',
            }}
          >
            <p className="font-medium mb-1" style={{ color: '#f87171' }}>
              Notifications are blocked
            </p>
            <p style={{ color: 'var(--text-muted)' }}>
              Open your browser settings, find this site under Notifications, and set it to{' '}
              <strong>Allow</strong> to enable push alerts.
            </p>
          </div>
        )}

        {/* Unsupported banner */}
        {isUnsupported && (
          <div
            className="rounded-xl p-4 mb-4 text-sm"
            style={{
              background: 'rgba(100,100,100,0.1)',
              border: '1px solid var(--border)',
            }}
          >
            {unsupportedReason === 'ios-webview' ? (
              <>
                <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  Not available in Pi Browser on iPhone
                </p>
                <p style={{ color: 'var(--text-muted)' }}>
                  Apple restricts web push to Safari only. To receive notifications,
                  open this app in <strong>Safari</strong>, tap the Share button, and
                  select <strong>"Add to Home Screen"</strong> — then enable
                  notifications from your Home Screen app.
                </p>
              </>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>
                Push notifications are not supported in this environment.
              </p>
            )}
          </div>
        )}

        {/* Master toggle */}
        {!isUnsupported && (
          <div
            className="flex items-center justify-between rounded-xl p-4 mb-4"
            style={{
              background: masterEnabled ? 'rgba(240,160,60,0.08)' : 'var(--bg-elevated)',
              border: `1px solid ${masterEnabled ? 'rgba(240,160,60,0.3)' : 'var(--border)'}`,
              transition: 'all 0.2s ease',
            }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Enable Push Notifications
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {masterEnabled
                  ? 'You will receive alerts on this device'
                  : isBlocked
                  ? 'Blocked — update browser settings to enable'
                  : 'Tap to allow notifications on this device'}
              </p>
            </div>

            <button
              type="button"
              disabled={loading || isBlocked}
              onClick={handleMasterToggle}
              aria-checked={masterEnabled}
              role="checkbox"
              className="flex-shrink-0 w-12 h-7 rounded-full relative focus:outline-none"
              style={{
                background: masterEnabled ? 'var(--pi-gold)' : 'var(--bg-card)',
                border: `1.5px solid ${masterEnabled ? 'var(--pi-gold)' : 'var(--border)'}`,
                cursor: loading || isBlocked ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'background 0.25s, border-color 0.25s',
              }}
            >
              <span
                className="absolute top-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                style={{
                  background: masterEnabled ? '#fff' : 'var(--text-muted)',
                  left: masterEnabled ? 'calc(100% - 22px)' : '2px',
                  transition: 'left 0.25s ease',
                  fontSize: '9px',
                }}
              >
                {loading ? '⟳' : ''}
              </span>
            </button>
          </div>
        )}

        {/* Notification type preferences */}
        {!isUnsupported && (
          <div className="space-y-2 mb-4">
            {NOTIFICATION_TYPES.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                enabled={preferences[item.id]}
                masterEnabled={masterEnabled}
                onChange={handlePrefChange}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl py-3 text-sm font-medium transition-all"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}