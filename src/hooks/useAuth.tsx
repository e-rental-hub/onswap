'use client';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { authApi, paymentMethodsApi } from '@/lib/api';
import { logger } from '@/lib/logger';
import { User, PaymentMethodDetail, NewPaymentMethodDetail } from '@/types';

// ─── Context shape ────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isDevMode: boolean;

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
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const TOKEN_KEY = 'pi_p2p_token';
const USER_KEY = 'pi_p2p_user';

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isDevMode = process.env.NODE_ENV === "development";

  // Restore session from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        logger.warn('Corrupt stored user — clearing');
        localStorage.removeItem(USER_KEY);
      }
    }
    setLoading(false);
  }, []);

  // ── Pi login / register ──────────────────────────────────────────────────────

  const loginWithPi = useCallback(
    async (
      accessToken: string,
      uid: string,
      username: string,
      displayName?: string
    ) => {
      const res = await authApi.piAuth({ accessToken, uid, username, displayName });
      const { token: t, user: u } = res.data as { token: string; user: User };

      localStorage.setItem(TOKEN_KEY, t);
      localStorage.setItem(USER_KEY, JSON.stringify(u));
      setToken(t);
      setUser(u);
      logger.info(`Pi auth success: ${u.username} (uid=${u.piUid})`);
    },
    []
  );

  // ── Logout ───────────────────────────────────────────────────────────────────

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    logger.info('Logged out');
    window.location.href = '/';
  }, []);

  // ── Refresh user from server ──────────────────────────────────────────────────

  const refreshUser = useCallback(async () => {
    try {
      const res = await authApi.getMe();
      const u = res.data.user as User;
      setUser(u);
      localStorage.setItem(USER_KEY, JSON.stringify(u));
    } catch (err) {
      logger.error('refreshUser failed:', err);
    }
  }, []);

  // ── Payment method helpers ────────────────────────────────────────────────────

  const syncPaymentMethods = (methods: PaymentMethodDetail[]) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, paymentMethods: methods };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const addPaymentMethod = useCallback(async (data: NewPaymentMethodDetail) => {
    const res = await paymentMethodsApi.add(data);
    syncPaymentMethods(res.data.paymentMethods);
    logger.info(`Payment method added: ${data.type}`);
  }, []);

  const updatePaymentMethod = useCallback(
    async (pmId: string, data: Partial<NewPaymentMethodDetail>) => {
      const res = await paymentMethodsApi.update(pmId, data);
      syncPaymentMethods(res.data.paymentMethods);
      logger.info(`Payment method updated: ${pmId}`);
    },
    []
  );

  const removePaymentMethod = useCallback(async (pmId: string) => {
    const res = await paymentMethodsApi.remove(pmId);
    syncPaymentMethods(res.data.paymentMethods);
    logger.info(`Payment method removed: ${pmId}`);
  }, []);

  const setDefaultPaymentMethod = useCallback(async (pmId: string) => {
    const res = await paymentMethodsApi.setDefault(pmId);
    syncPaymentMethods(res.data.paymentMethods);
    logger.info(`Default payment method set: ${pmId}`);
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
        loginWithPi,
        logout,
        refreshUser,
        addPaymentMethod,
        updatePaymentMethod,
        removePaymentMethod,
        setDefaultPaymentMethod,
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