'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { notificationsApi } from '@/lib/api';
import { logger } from '@/lib/logger';
import { INotificationSettings } from '@/types';

interface UseNotificationSettingsResult {
  settings: INotificationSettings | null;
  setSettings: (settings: INotificationSettings | null) => void;
}

function deriveConfigured(settings: INotificationSettings | null): boolean {
  return !!(settings && settings.emailEnabled && settings.email);
}

export function useNotificationSettings(): UseNotificationSettingsResult {
  const { user, setIsNotificationConfigured } = useAuth();
  const [settings, setSettingsState] = useState<INotificationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards against a stale response landing after a newer request/user change.
  const requestIdRef = useRef(0);

  const fetchSettings = useCallback(async (): Promise<INotificationSettings | null> => {
    if (!user) {
      setSettingsState(null);
      setIsNotificationConfigured(false);
      return null;
    }

    if (isLoading) return null

    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const res = await notificationsApi.getSettings();
      // Tolerate either { settings: {...} } or a flat settings object —
      // confirm which one your API actually returns and drop the fallback.
      const fetched = (res.data?.settings ?? null) as INotificationSettings | null;

      if (requestId !== requestIdRef.current) return null; // superseded by a newer call
      setSettingsState(fetched);
      setIsNotificationConfigured(deriveConfigured(fetched));
      return fetched;
    } catch (err) {
      if (requestId !== requestIdRef.current) return null;
      logger.error('notification settings error:', err);
      setError('Failed to load notification settings');
      return null;
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Lets callers (e.g. after a successful save) update local state optimistically
  // without forcing a full refetch.
  const setSettings = useCallback((next: INotificationSettings | null) => {
    setSettingsState(next);
    setIsNotificationConfigured(deriveConfigured(next));
  }, []);

  return { settings, setSettings };
}