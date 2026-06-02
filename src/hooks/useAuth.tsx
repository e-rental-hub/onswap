'use client';
import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { authApi, paymentMethodsApi, piWalletsApi, setAuthToken } from '@/lib/api';
import { logger } from '@/lib/logger';
import { User, PaymentMethodDetail, NewPaymentMethodDetail, PiWalletAddress, NewPiWalletAddress, CurrencyEnum } from '@/types';
import { CURRENCIES } from '@/lib/constants';

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

  // Restore session from localStorage on mount
  // useEffect(() => {
  //   const storedToken = localStorage.getItem(TOKEN_KEY);
  //   const storedUser = localStorage.getItem(USER_KEY);
  //   if (storedToken && storedUser) {
  //     setToken(storedToken);
  //     try {
  //       setUser(JSON.parse(storedUser));
  //     } catch {
  //       logger.warn('Corrupt stored user — clearing');
  //       localStorage.removeItem(USER_KEY);
  //     }
  //   }
  //   setLoading(false);
  // }, []);

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

      // localStorage.setItem(TOKEN_KEY, t);
      // localStorage.setItem(USER_KEY, JSON.stringify(u));
      setAuthToken(t);
      setToken(t);
      setUser(u);
      const userCurrency = CURRENCIES.find(
        (c) => c.code === user?.preferredCurrency
      ) || CURRENCIES[0];
      setPreferredCurrency(userCurrency)
      logger.info(`Pi auth success: ${u.username} (uid=${u.piUid})`);
    },
    []
  );

  // ── Logout ───────────────────────────────────────────────────────────────────

  const logout = useCallback(() => {
    // localStorage.removeItem(TOKEN_KEY);
    // localStorage.removeItem(USER_KEY);
    setAuthToken(null);
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
      const updated = { ...prev, piWalletAddresses: addresses };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
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
    const res = await authApi.setCurrency({currency: selectedCurrency});
    const currency = res.data.currency;

    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, preferredCurrency: currency };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });

    const userCurrency = CURRENCIES.find(
      (c) => c.code === currency
    ) || CURRENCIES[0];
      
    setPreferredCurrency(userCurrency)
  },[]);

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