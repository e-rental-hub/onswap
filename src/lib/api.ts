import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { logger } from './logger';
import { NewPaymentMethodDetail, PaymentMethodDetail, PaymentInfo } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('pi_p2p_token');
      if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
    }
    logger.debug(`→ ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => { logger.error('Request error:', error); return Promise.reject(error); }
);

apiClient.interceptors.response.use(
  (response) => { logger.debug(`← ${response.status} ${response.config.url}`); return response; },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      logger.warn('Session expired');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('pi_p2p_token');
        localStorage.removeItem('pi_p2p_user');
        window.location.href = '/';
      }
    }
    const msg = (error.response?.data as { message?: string })?.message || error.message;
    logger.error(`API Error [${error.response?.status ?? 'network'}]: ${msg}`);
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  piAuth: (data: { accessToken: string; uid: string; username: string; displayName?: string; phone?: string }) =>
    apiClient.post('/auth/pi', data),
  getMe:         () => apiClient.get('/auth/me'),
  updateProfile: (data: { displayName?: string; phone?: string }) =>
    apiClient.patch('/auth/profile', data),
};

// ─── Saved payment methods ────────────────────────────────────────────────────

export const paymentMethodsApi = {
  getAll:     () =>
    apiClient.get<{ success: boolean; paymentMethods: PaymentMethodDetail[] }>('/auth/payment-methods'),
  add:        (data: NewPaymentMethodDetail) =>
    apiClient.post<{ success: boolean; paymentMethods: PaymentMethodDetail[] }>('/auth/payment-methods', data),
  update:     (pmId: string, data: Partial<NewPaymentMethodDetail>) =>
    apiClient.patch<{ success: boolean; paymentMethods: PaymentMethodDetail[] }>(`/auth/payment-methods/${pmId}`, data),
  remove:     (pmId: string) =>
    apiClient.delete<{ success: boolean; paymentMethods: PaymentMethodDetail[] }>(`/auth/payment-methods/${pmId}`),
  setDefault: (pmId: string) =>
    apiClient.patch<{ success: boolean; paymentMethods: PaymentMethodDetail[] }>(`/auth/payment-methods/${pmId}/set-default`),
};

// ─── Wallet ───────────────────────────────────────────────────────────────────

export const walletApi = {
  getBalance:     () => apiClient.get('/wallet/balance'),
  getTransactions:(params?: Record<string, string | number>) =>
    apiClient.get('/wallet/transactions', { params }),
  getDepositInfo: () => apiClient.get('/wallet/deposit-info'),

  // Pi payment handshake endpoints
  approveDeposit:    (paymentId: string) =>
    apiClient.post('/wallet/deposit/approve', { paymentId }),
  completeDeposit:   (paymentId: string, txid: string) =>
    apiClient.post('/wallet/deposit/complete', { paymentId, txid }),
  cancelDeposit:     (paymentId: string) =>
    apiClient.post('/wallet/deposit/cancel', { paymentId }),
  incompleteDeposit: (paymentInfo: PaymentInfo) =>
    apiClient.post('/wallet/deposit/incomplete', { paymentInfo }),
};

// ─── Ads ──────────────────────────────────────────────────────────────────────

export const adsApi = {
  getAds:    (params?: Record<string, string | number>) => apiClient.get('/ads', { params }),
  getAdById: (id: string) => apiClient.get(`/ads/${id}`),
  getMyAds:  () => apiClient.get('/ads/my'),
  createAd:  (data: unknown) => apiClient.post('/ads', data),
  updateAd:  (id: string, data: unknown) => apiClient.patch(`/ads/${id}`, data),
  deleteAd:  (id: string) => apiClient.delete(`/ads/${id}`),
  hardDeleteAd: (id: string) => apiClient.delete(`/ads/${id}/hard`),
};

// ─── Orders ───────────────────────────────────────────────────────────────────

export const ordersApi = {
  createOrder: (data: { adId: string; piAmount: number; paymentMethod: string }) =>
    apiClient.post('/orders', data),
  getOrders:   (params?: Record<string, string>) => apiClient.get('/orders', { params }),
  getOrderById:(id: string) => apiClient.get(`/orders/${id}`),
  updateStatus:(id: string, data: { action: string; reason?: string }) =>
    apiClient.patch(`/orders/${id}/status`, data),
  sendMessage: (id: string, data: { content: string; type?: string; imageUrl?: string }) =>
    apiClient.post(`/orders/${id}/messages`, data),
};

// ─── Incomplete payment (used by PiAuthButton) ────────────────────────────────

export const payment = {
  approve:    (data: { paymentId: string }) =>
    apiClient.post('/wallet/deposit/approve', data),
  complete:   (data: { paymentId: string; txid: string }) =>
    apiClient.post('/wallet/deposit/complete', data),
  cancel:     (data: { paymentId: string }) =>
    apiClient.post('/wallet/deposit/cancel', data),
  incomplete: (data: { paymentInfo: PaymentInfo }) =>
    apiClient.post('/wallet/deposit/incomplete', data),
  error: (_data: { paymentInfo: PaymentInfo }) => Promise.resolve(), // client-side only
};