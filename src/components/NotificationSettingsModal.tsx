'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { registerPushNotifications, getEnvironmentInfo, PushSupport } from '@/lib/pushNotifications';
import { logger } from '@/lib/logger';
import { notificationsApi } from '@/lib/api';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { INotificationSettings } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationSettingsModalProps {
  onClose: () => void;
}

type ChannelId = 'email' | 'push' | 'whatsapp';
type PushPermState = 'granted' | 'denied' | 'default' | 'unsupported';

interface ChannelMeta {
  id: ChannelId;
  label: string;
  description: string;
  icon: string;
}

const CHANNELS: ChannelMeta[] = [
  { id: 'email',    label: 'Email',    description: 'Get alerts sent to your inbox',        icon: '✉️' },
  { id: 'push',     label: 'Push',     description: 'Instant alerts on this device',         icon: '🔔' },
  { id: 'whatsapp', label: 'WhatsApp', description: 'Get alerts sent to your WhatsApp',      icon: '💬' },
];

// ─── Validation helpers ────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Requires a leading + and country code, e.g. +2348012345678 (8-15 digits after +)
const WHATSAPP_RE = /^\+[1-9]\d{7,14}$/;

function validateEmail(value: string): string | null {
  if (!value.trim()) return 'Email address is required';
  if (!EMAIL_RE.test(value.trim())) return 'Enter a valid email address';
  return null;
}

function validateWhatsapp(value: string): string | null {
  if (!value.trim()) return 'WhatsApp number is required';
  if (!WHATSAPP_RE.test(value.trim())) return 'Include country code, e.g. +234 801 234 5678';
  return null;
}

// ─── Push-only banners ─────────────────────────────────────────────────────────

function PushUnsupportedBanner({ support }: { support: PushSupport | null }) {
  if (support === 'android-webview') return (
    <div
      className="rounded-lg p-3 mt-2 text-xs"
      style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}
    >
      <p className="font-medium mb-0.5" style={{ color: '#fbbf24' }}>
        Limited support in Pi Browser (Android)
      </p>
      <p style={{ color: 'var(--text-muted)' }}>
        Open this site in <strong>Chrome for Android</strong> to receive push alerts.
      </p>
    </div>
  );

  if (support === 'ios-webview') return (
    <div
      className="rounded-lg p-3 mt-2 text-xs"
      style={{ background: 'rgba(100,100,100,0.1)', border: '1px solid var(--border)' }}
    >
      <p className="font-medium mb-0.5" style={{ color: 'var(--text-primary)' }}>
        Not available in Pi Browser on iPhone
      </p>
      <p style={{ color: 'var(--text-muted)' }}>
        Open this app in <strong>Safari</strong>, tap Share →{' '}
        <strong>Add to Home Screen</strong>, then enable notifications from there.
      </p>
    </div>
  );

  return (
    <div
      className="rounded-lg p-3 mt-2 text-xs"
      style={{ background: 'rgba(100,100,100,0.1)', border: '1px solid var(--border)' }}
    >
      <p style={{ color: 'var(--text-muted)' }}>Push notifications aren't supported in this environment.</p>
    </div>
  );
}

function PushBlockedBanner() {
  return (
    <div
      className="rounded-lg p-3 mt-2 text-xs"
      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
    >
      <p className="font-medium mb-0.5" style={{ color: '#f87171' }}>Push notifications are blocked</p>
      <p style={{ color: 'var(--text-muted)' }}>
        Update this site's notification permission to <strong>Allow</strong> in your browser settings.
      </p>
    </div>
  );
}

// ─── Toggle switch (standalone, reusable) ──────────────────────────────────────

function Switch({
  checked, disabled, loading, onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  loading?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      aria-checked={checked}
      role="checkbox"
      className="flex-shrink-0 w-11 h-6 rounded-full relative focus:outline-none"
      style={{
        background: checked ? 'var(--pi-gold)' : 'var(--bg-card)',
        border:     `1.5px solid ${checked ? 'var(--pi-gold)' : 'var(--border)'}`,
        cursor:     disabled ? 'not-allowed' : 'pointer',
        opacity:    disabled && !checked ? 0.5 : loading ? 0.7 : 1,
        transition: 'background 0.2s, border-color 0.2s',
      }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full flex items-center justify-center"
        style={{
          background: checked ? '#fff' : 'var(--text-muted)',
          left:       checked ? 'calc(100% - 18px)' : '2px',
          transition: 'left 0.2s ease, background 0.2s',
          fontSize:   '8px',
        }}
      >
        {loading ? '⟳' : ''}
      </span>
    </button>
  );
}

// ─── Channel card (header + collapsible sub-content) ───────────────────────────

function ChannelCard({
  meta, enabled, loading, disabled, onToggle, children,
}: {
  meta: ChannelMeta;
  enabled: boolean;
  loading?: boolean;
  disabled?: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-3 transition-all"
      style={{
        background: enabled ? 'rgba(240,160,60,0.06)' : 'var(--bg-elevated)',
        border:     `1px solid ${enabled ? 'rgba(240,160,60,0.25)' : 'var(--border)'}`,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            {meta.icon}
          </span>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{meta.label}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{meta.description}</p>
          </div>
        </div>
        <Switch checked={enabled} disabled={disabled} loading={loading} onChange={onToggle} />
      </div>

      {/* Sub-content (input fields / banners) — only rendered when toggle is on */}
      {enabled && children && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function NotificationSettingsModal({ onClose }: NotificationSettingsModalProps) {
  const { user } = useAuth();
  const { settings, setSettings } = useNotificationSettings();

  const [channels, setChannels] = useState<Record<ChannelId, boolean>>({
    email: false,
    push: false,
    whatsapp: false,
  });

  const [pushSupport, setPushSupport]   = useState<PushSupport | null>(null);
  const [pushPerm,    setPushPerm]      = useState<PushPermState>('default');
  const [pushLoading, setPushLoading]   = useState(false);
  const [fcmToken,    setFcmToken]      = useState<string | null>(null);

  const [email, setEmail]               = useState('');
  const [emailTouched, setEmailTouched] = useState(false);

  const [whatsapp, setWhatsapp]               = useState('');
  const [whatsappTouched, setWhatsappTouched] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const env = getEnvironmentInfo();
    setPushSupport(env.support);
    if (env.support === 'supported') {
      setPushPerm(env.notificationPermission);
      setChannels((c) => ({ ...c, push: env.notificationPermission === 'granted' }));
    } else {
      setPushPerm('unsupported');
    }
  }, []);

  // Seed the form from the shared settings instead of fetching again.
  // Re-runs (idempotently) whenever `settings` is updated elsewhere, e.g. after save.
  useEffect(() => {
    if (!settings) return;
    setChannels((c) => ({
      ...c,
      email:    !!settings.emailEnabled,
      whatsapp: !!settings.whatsappEnabled,
    }));
    setEmail(settings.email || '');
    setWhatsapp(settings.whatsapp || '');
  }, [settings]);

  const emailError    = useMemo(() => (channels.email    ? validateEmail(email)       : null), [channels.email, email]);
  const whatsappError = useMemo(() => (channels.whatsapp  ? validateWhatsapp(whatsapp) : null), [channels.whatsapp, whatsapp]);

  const pushBlocked     = pushPerm === 'denied';
  const pushUnsupported = pushPerm === 'unsupported';

  const toggleEmail = () => setChannels((c) => ({ ...c, email: !c.email }));
  const toggleWhatsapp = () => setChannels((c) => ({ ...c, whatsapp: !c.whatsapp }));

  const togglePush = useCallback(async () => {
    if (pushUnsupported) return;

    if (channels.push) {
      setPushLoading(true);
      try {
        if (fcmToken) await notificationsApi.unregisterPushNotifications(fcmToken);
        setFcmToken(null);
        setChannels((c) => ({ ...c, push: false }));
      } catch (err) {
        logger.error('[NotificationModal] Push disable failed:', err);
      } finally {
        setPushLoading(false);
      }
      return;
    }

    if (pushBlocked) return;
    if (!user) return;

    setPushLoading(true);
    try {
      const token = await registerPushNotifications(user.id);
      if (token) {
        setFcmToken(token);
        setChannels((c) => ({ ...c, push: true }));
        setPushPerm('granted');
      } else {
        const env = getEnvironmentInfo();
        if (env.hasNotificationAPI) setPushPerm(env.notificationPermission);
      }
    } catch (err) {
      logger.error('[NotificationModal] Push enable failed:', err);
    } finally {
      setPushLoading(false);
    }
  }, [channels.push, pushBlocked, pushUnsupported, fcmToken, user]);

  const canSave =
    (!channels.email    || !emailError) &&
    (!channels.whatsapp || !whatsappError);

  const handleSave = async () => {
    if (!canSave) {
      setEmailTouched(true);
      setWhatsappTouched(true);
      return;
    }

    // Prevent turning off email notification - to be removed later
    if (!channels.email) return

    setSaving(true);
    try {
      const res = await notificationsApi.savePreferences({
        emailEnabled:    channels.email,
        email:           channels.email ? email.trim() : undefined,
        whatsappEnabled: channels.whatsapp,
        whatsapp:        channels.whatsapp ? whatsapp.trim() : undefined,
        pushEnabled:     channels.push,
      });
      const saved = (res.data?.settings ?? res.data) as INotificationSettings;
      setSettings(saved); // propagates the new configured-state to every consumer of the hook
      onClose();
    } catch (err) {
      logger.error('[NotificationModal] Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 relative animate-slide-up max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--bg-card)', border: '1px solid rgba(240,160,60,0.2)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Notifications</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Choose how you want to hear from us
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >✕</button>
        </div>

        <div className="space-y-3 mb-5">

          {/* ── Email channel ──────────────────────────────────────────── */}
          <ChannelCard
            meta={CHANNELS[0]}
            enabled={channels.email}
            onToggle={toggleEmail}
          >
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Email address
            </label>
            <input
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
              placeholder="you@example.com"
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${emailTouched && emailError ? '#f87171' : 'var(--border)'}`,
                color: 'var(--text-primary)',
              }}
            />
            {emailTouched && emailError && (
              <p className="text-xs mt-1" style={{ color: '#f87171' }}>{emailError}</p>
            )}
          </ChannelCard>

          {/* ── WhatsApp channel ───────────────────────────────────────── */}
          {/* <ChannelCard
            meta={CHANNELS[2]}
            enabled={false} // channels.whatsapp
            onToggle={toggleWhatsapp}
          >
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
              WhatsApp number (with country code)
            </label>
            <input
              type="tel"
              inputMode="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              onBlur={() => setWhatsappTouched(true)}
              placeholder="+234 801 234 5678"
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${whatsappTouched && whatsappError ? '#f87171' : 'var(--border)'}`,
                color: 'var(--text-primary)',
              }}
            />
            {whatsappTouched && whatsappError && (
              <p className="text-xs mt-1" style={{ color: '#f87171' }}>{whatsappError}</p>
            )}
          </ChannelCard> */}
          
          {/* ── Push channel ───────────────────────────────────────────── */}
          {/* <ChannelCard
            meta={CHANNELS[1]}
            enabled={false}  // channels.push
            loading={pushLoading}
            disabled={pushUnsupported || (pushBlocked && !channels.push)}
            onToggle={togglePush}
          >
            {pushBlocked && <PushBlockedBanner />}
          </ChannelCard> */}
          {/* Unsupported banner sits outside the card content area so it shows
              even when the toggle itself is forced off/disabled */}
          {/* {pushUnsupported && <PushUnsupportedBanner support={pushSupport} />} */}
        </div>

        {/* Footer actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl py-3 text-sm font-medium"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !canSave}
            className="flex-1 rounded-xl py-3 text-sm font-semibold"
            style={{
              background: canSave ? 'var(--pi-gold)' : 'var(--bg-elevated)',
              color:      canSave ? '#000' : 'var(--text-muted)',
              opacity:    saving ? 0.7 : 1,
              cursor:     canSave ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? 'Saving…' : 'Save preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}