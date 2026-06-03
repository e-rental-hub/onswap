import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { logger } from './logger';
import { NewPaymentMethodDetail, PaymentMethodDetail, PaymentInfo, PiWalletAddress, NewPiWalletAddress, PaymentMethodEnum, AdTypeEnum, AdType, PaymentMethodType, CurrencyEnum } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
  withCredentials: true,
});

export const setAuthToken = (token: string | null) => {
  if (token) {
    return (apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`);
  } else {
    return delete apiClient.defaults.headers.common['Authorization'];
  }
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  piAuth: (data: { accessToken: string; uid: string; username: string; displayName?: string; phone?: string }) =>
    apiClient.post('/auth/pi', data),
  getMe:         () => apiClient.get('/auth/me'),
  logout:        () => apiClient.post('/auth/logout'),
  updateProfile: (data: { displayName?: string; phone?: string }) =>
    apiClient.patch('/auth/profile', data),
  setCurrency: (data: {currency: CurrencyEnum}) => 
    apiClient.post('/auth/set-currency', data)
};

// ─── Saved account details ────────────────────────────────────────────────────

export const paymentMethodsApi = {
  getAll:     () =>
    apiClient.get<{ success: boolean; userAccountDetails: PaymentMethodDetail[] }>('/auth/account-details'),
  add:        (data: NewPaymentMethodDetail) =>
    apiClient.post<{ success: boolean; userAccountDetails: PaymentMethodDetail[] }>('/auth/account-details', data),
  update:     (pmId: string, data: Partial<NewPaymentMethodDetail>) =>
    apiClient.patch<{ success: boolean; userAccountDetails: PaymentMethodDetail[] }>(`/auth/account-details/${pmId}`, data),
  remove:     (pmId: string) =>
    apiClient.delete<{ success: boolean; userAccountDetails: PaymentMethodDetail[] }>(`/auth/account-details/${pmId}`),
  setDefault: (pmId: string) =>
    apiClient.patch<{ success: boolean; userAccountDetails: PaymentMethodDetail[] }>(`/auth/account-details/${pmId}/set-default`),
};

// ─── Pi Wallet Addresses ──────────────────────────────────────────────────────

export const piWalletsApi = {
  getAll: () =>
    apiClient.get<{ success: boolean; piWalletAddresses: PiWalletAddress[] }>('/auth/pi-wallets'),

  add: (data: NewPiWalletAddress) =>
    apiClient.post<{ success: boolean; piWalletAddresses: PiWalletAddress[] }>('/auth/pi-wallets', data),

  update: (waId: string, data: Partial<Pick<NewPiWalletAddress, 'tag' | 'isDefault'>>) =>
    apiClient.patch<{ success: boolean; piWalletAddresses: PiWalletAddress[] }>(`/auth/pi-wallets/${waId}`, data),

  remove: (waId: string) =>
    apiClient.delete<{ success: boolean; piWalletAddresses: PiWalletAddress[] }>(`/auth/pi-wallets/${waId}`),

  setDefault: (waId: string) =>
    apiClient.patch<{ success: boolean; piWalletAddresses: PiWalletAddress[] }>(`/auth/pi-wallets/${waId}/set-default`),
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
  createAd:  (data: {
    type:                 AdType;
    piAmount:             number;
    minLimit:             number;
    maxLimit:             number;
    pricePerPi:           number;
    currency?:            string;
    paymentMethods:       PaymentMethodType[];
    sellerAccountDetailId?: string;
    buyerPiWalletId?: string;
    paymentWindow:        number;
    terms?:               string;
    autoReply?:           string;
  }) => apiClient.post('/ads', data),
  getAds:    (params?: Record<string, string | number>) => apiClient.get('/ads', { params }),
  getAdById: (id: string) => apiClient.get(`/ads/${id}`),
  getMyAds:  () => apiClient.get('/ads/my'),
  updateAd:  (id: string, data: unknown) => apiClient.patch(`/ads/${id}`, data),
  deleteAd:  (id: string) => apiClient.delete(`/ads/${id}`),
  hardDeleteAd: (id: string) => apiClient.delete(`/ads/${id}/hard`),
};

// ─── Orders ───────────────────────────────────────────────────────────────────

export const ordersApi = {
  createOrder: (data: { adId: string; piAmount: number; paymentMethod: PaymentMethodType; sellerAccountDetailId?: string, buyerWalletAddressId?: string }) =>
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