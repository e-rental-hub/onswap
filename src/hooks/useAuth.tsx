'use client';
import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
  useRef,
} from 'react';
import { authApi, notificationsApi, paymentMethodsApi, piWalletsApi, setAuthToken } from '@/lib/api';
import { logger } from '@/lib/logger';
import { User, PaymentMethodDetail, NewPaymentMethodDetail, PiWalletAddress, NewPiWalletAddress, CurrencyEnum } from '@/types';
import { CURRENCIES } from '@/lib/constants';
import { registerPushNotifications } from '@/lib/pushNotifications';

// ─── Context shape ────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isDevMode: boolean;
  preferredCurrency: (typeof CURRENCIES)[number];

  /** Called by PiAuthButton after a successful Pi.authenticate() */
  loginWithPi: (
    accessToken: string,
    uid: string,
    username: string,
    displayName?: string
  ) => Promise<void>;

  logout: () => void;
  refreshUser: () => Promise<void>;

  // Payment method convenience helpers (keep UI code thin)
  addPaymentMethod: (data: NewPaymentMethodDetail) => Promise<void>;
  updatePaymentMethod: (pmId: string, data: Partial<NewPaymentMethodDetail>) => Promise<void>;
  removePaymentMethod: (pmId: string) => Promise<void>;
  setDefaultPaymentMethod: (pmId: string) => Promise<void>;
  // Pi wallet addresses
  addPiWalletAddress: (data: NewPiWalletAddress) => Promise<void>;
  updatePiWalletAddress: (waId: string, data: Partial<Pick<NewPiWalletAddress, 'tag' | 'isDefault'>>) => Promise<void>;
  removePiWalletAddress: (waId: string) => Promise<void>;
  setDefaultPiWalletAddress: (waId: string) => Promise<void>;
  setUserCurrency: (selectedCurrency: CurrencyEnum) =>Promise<void>;
  setPreferredCurrency: (currency: (typeof CURRENCIES)[number]) => void;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

// const TOKEN_KEY = 'pi_p2p_token';
const USER_KEY = 'pi_p2p_user';
const isDevMode = process.env.NODE_ENV === "development"

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [preferredCurrency, setPreferredCurrency] = useState<(typeof CURRENCIES)[number]>(CURRENCIES[0]);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationToken, setNotificationToken] = useState<string | null>(null);

  const currencyFromUser = (u: User | null) =>
    CURRENCIES.find((c) => c.code === u?.preferredCurrency) ?? CURRENCIES[0];

  // ── Rehydrate on mount — hit /getMe with the httpOnly cookie ──────────────────
  // If your backend issues a httpOnly refresh cookie, this is the only safe
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    const bootstrap = async () => {
      try {
        const res = await authApi.getMe();
        const u   = res.data.user as User;
        setUser(u);
        setPreferredCurrency(currencyFromUser(u));
      } catch {
        // unauthenticated — defaults remain
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  // ── Pi login / register ──────────────────────────────────────────────────────

  const loginWithPi = useCallback(async (
    accessToken: string,
    uid:         string,
    username:    string,
    displayName?: string,
  ) => {
    const res = await authApi.piAuth({ accessToken, uid, username, displayName });
    const { token: t, user: u } = res.data as { token: string; user: User };

    setAuthToken(t);
    setToken(t);
    setUser(u);
    setPreferredCurrency(currencyFromUser(u));
    const fcmToken = await registerPushNotifications(u.id);
    setNotificationToken(fcmToken);

    // ── TEST: trigger a notification immediately after login ──────────
    if (fcmToken) {
      await authApi.testPushNotification(u.id);
      console.log('[Push] Test notification fired');
    }
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────────

  const logout = useCallback(async () => {
    try {
      logger.info('Logging out');
      (await authApi.logout()); // clears the httpOnly cookie server-side
      notificationToken && await notificationsApi.unregisterPushNotifications(notificationToken);
    } finally {
      setAuthToken(null);
      setToken(null);
      setUser(null);
      setPreferredCurrency(CURRENCIES[0]);
      window.location.href = '/';
    }
  }, [notificationToken]);

  // ── Refresh user from server ──────────────────────────────────────────────────

  const refreshUser = useCallback(async () => {
    const res = await authApi.getMe();
    const u   = res.data.user as User;
    setUser(u);
    setPreferredCurrency(currencyFromUser(u));
  }, []);

  // ── Payment method helpers ────────────────────────────────────────────────────

  const syncPaymentMethods = (methods: PaymentMethodDetail[]) => {
    setUser((prev) => {
      if (!prev) return prev;
      return { ...prev, paymentMethods: methods };
    });
  };

  const addPaymentMethod = useCallback(async (data: NewPaymentMethodDetail) => {
    const res = await paymentMethodsApi.add(data);
    syncPaymentMethods(res.data.userAccountDetails);
    logger.info(`Payment method added: ${data.type}`);
  }, []);

  const updatePaymentMethod = useCallback(
    async (pmId: string, data: Partial<NewPaymentMethodDetail>) => {
      const res = await paymentMethodsApi.update(pmId, data);
      syncPaymentMethods(res.data.userAccountDetails);
      logger.info(`Payment method updated: ${pmId}`);
    },
    []
  );

  const removePaymentMethod = useCallback(async (pmId: string) => {
    const res = await paymentMethodsApi.remove(pmId);
    syncPaymentMethods(res.data.userAccountDetails);
    logger.info(`Payment method removed: ${pmId}`);
  }, []);

  const setDefaultPaymentMethod = useCallback(async (pmId: string) => {
    const res = await paymentMethodsApi.setDefault(pmId);
    syncPaymentMethods(res.data.userAccountDetails);
    logger.info(`Default payment method set: ${pmId}`);
  }, []);

  // ── Pi Wallet Address helpers ─────────────────────────────────────────────

  const syncPiWalletAddresses = (addresses: PiWalletAddress[]) => {
    setUser((prev) => {
      if (!prev) return prev;
      return { ...prev, piWalletAddresses: addresses };
    });
  };

  const addPiWalletAddress = useCallback(async (data: NewPiWalletAddress) => {
    const res = await piWalletsApi.add(data);
    syncPiWalletAddresses(res.data.piWalletAddresses);
    logger.info(`Pi wallet address added: ${data.tag}`);
  }, []);

  const updatePiWalletAddress = useCallback(
    async (waId: string, data: Partial<Pick<NewPiWalletAddress, 'tag' | 'isDefault'>>) => {
      const res = await piWalletsApi.update(waId, data);
      syncPiWalletAddresses(res.data.piWalletAddresses);
      logger.info(`Pi wallet address updated: ${waId}`);
    }, []
  );

  const removePiWalletAddress = useCallback(async (waId: string) => {
    const res = await piWalletsApi.remove(waId);
    syncPiWalletAddresses(res.data.piWalletAddresses);
    logger.info(`Pi wallet address removed: ${waId}`);
  }, []);

  const setDefaultPiWalletAddress = useCallback(async (waId: string) => {
    const res = await piWalletsApi.setDefault(waId);
    syncPiWalletAddresses(res.data.piWalletAddresses);
    logger.info(`Default Pi wallet address set: ${waId}`);
  }, []);

  // ── User Currency helpers ─────────────────────────────────────────────

  const setUserCurrency = useCallback(async (selectedCurrency: CurrencyEnum) => {
  const res      = await authApi.setCurrency({ currency: selectedCurrency });
  const currency = res.data.preferredCurrency;

  setUser((prev) => prev ? { ...prev, preferredCurrency: currency } : prev);
  setPreferredCurrency(CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0]);
}, []);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!token,
        isDevMode,
        preferredCurrency,
        loginWithPi,
        logout,
        refreshUser,
        addPaymentMethod,
        updatePaymentMethod,
        removePaymentMethod,
        setDefaultPaymentMethod,
        addPiWalletAddress,
        updatePiWalletAddress,
        removePiWalletAddress,
        setDefaultPiWalletAddress,
        setUserCurrency,
        setPreferredCurrency,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}