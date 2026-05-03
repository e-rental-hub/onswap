// ─── Pi SDK ───────────────────────────────────────────────────────────────────

export interface PiAuthResult {
  accessToken: string;
  user: { uid: string; username: string };
}

export interface PaymentInfo {
  identifier: string;
  transaction?: { txid: string; _link: string };
}

export interface PiPaymentData {
  amount:    number;
  memo:      string;
  metadata?: Record<string, unknown>;
}

// ─── Payment methods ──────────────────────────────────────────────────────────

export type PaymentMethodType =
  | 'bank_transfer' | 'opay' | 'palmpay' | 'kuda' | 'moniepoint';

export interface PaymentMethodDetail {
  _id:           string;
  type:          PaymentMethodType;
  label:         string;
  accountName:   string;
  accountNumber: string;
  bankName?:     string;
  isDefault:     boolean;
  createdAt:     string;
}

export type NewPaymentMethodDetail = Omit<PaymentMethodDetail, '_id' | 'createdAt'>;

// ─── Wallet ───────────────────────────────────────────────────────────────────

export type TxType =
  | 'deposit' | 'deposit_charge'
  | 'escrow_lock' | 'escrow_release' | 'escrow_refund'
  | 'withdraw';

export type TxStatus = 'pending' | 'confirmed' | 'failed';

export interface WalletTransaction {
  _id:           string;
  type:          TxType;
  amount:        number;
  fee:           number;
  netAmount:     number;
  balanceBefore: number;
  balanceAfter:  number;
  status:        TxStatus;
  piPaymentId?:  string;
  piTxId?:       string;
  orderId?:      string;
  memo:          string;
  createdAt:     string;
}

export interface WalletSummary {
  piBalance:     number;
  lockedBalance: number;
  totalHeld:     number;
}

export interface DepositInfo {
  minDeposit:  number;
  feeRate:     number;
  feePercent:  string;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id:              string;
  piUid:           string;
  username:        string;
  displayName:     string;
  phone?:          string;
  kycVerified:     boolean;
  rating:          number;
  totalTrades:     number;
  completedTrades: number;
  completionRate:  number;
  piBalance:       number;
  lockedBalance:   number;
  paymentMethods:  PaymentMethodDetail[];
  createdAt:       string;
}

// ─── Ads ──────────────────────────────────────────────────────────────────────

export type AdType   = 'buy' | 'sell';
export type AdStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export interface AdPaymentDetail {
  type:          PaymentMethodType;
  label:         string;
  accountName?:  string;
  accountNumber?: string;
  bankName?:     string;
}

export interface Ad {
  _id:             string;
  creator:         User;
  type:            AdType;
  piAmount:        number;
  availableAmount: number;
  minLimit:        number;
  maxLimit:        number;
  pricePerPi:      number;
  currency:        string;
  paymentMethods:  PaymentMethodType[];
  paymentDetails:  AdPaymentDetail[];
  paymentWindow:   number;
  terms?:          string;
  autoReply?:      string;
  status:          AdStatus;
  completedOrders: number;
  reservedPi:      number;
  createdAt:       string;
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending' | 'payment_pending' | 'payment_sent' | 'escrow_locked'
  | 'completed' | 'disputed' | 'cancelled' | 'refunded';

export interface Escrow {
  piAmount:    number;
  status:      'pending' | 'locked' | 'released' | 'refunded';
  lockedAt?:   string;
  releasedAt?: string;
  txId?:       string;
}

export interface Message {
  _id:       string;
  sender:    string | User;
  content:   string;
  timestamp: string;
  type:      'text' | 'system' | 'payment_proof';
  imageUrl?: string;
}

export interface Order {
  _id:            string;
  ad:             Ad;
  buyer:          User;
  seller:         User;
  piAmount:       number;
  nairaAmount:    number;
  pricePerPi:     number;
  currency:       string;
  paymentMethod:  PaymentMethodType;
  status:         OrderStatus;
  escrow:         Escrow;
  messages:       Message[];
  paymentDeadline?: string;
  completedAt?:   string;
  cancelledAt?:   string;
  cancelReason?:  string;
  disputeReason?: string;
  createdAt:      string;
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  bank_transfer: 'Bank Transfer',
  opay:          'OPay',
  palmpay:       'PalmPay',
  kuda:          'Kuda Bank',
  moniepoint:    'Moniepoint',
};

export const TX_TYPE_LABELS: Record<TxType, string> = {
  deposit:        'Deposit',
  deposit_charge: 'Deposit Fee',
  escrow_lock:    'Escrow Locked',
  escrow_release: 'Escrow Released',
  escrow_refund:  'Escrow Refunded',
  withdraw:       'Withdrawal',
};

export const TX_TYPE_COLORS: Record<TxType, string> = {
  deposit:        'text-green-400',
  deposit_charge: 'text-red-400',
  escrow_lock:    'text-yellow-400',
  escrow_release: 'text-green-400',
  escrow_refund:  'text-blue-400',
  withdraw:       'text-red-400',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending:         'Pending',
  payment_pending: 'Awaiting Payment',
  payment_sent:    'Payment Sent',
  escrow_locked:   'Escrow Locked',
  completed:       'Completed',
  disputed:        'Disputed',
  cancelled:       'Cancelled',
  refunded:        'Refunded',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending:         'text-yellow-400 bg-yellow-400/10',
  payment_pending: 'text-yellow-400 bg-yellow-400/10',
  payment_sent:    'text-blue-400 bg-blue-400/10',
  escrow_locked:   'text-orange-400 bg-orange-400/10',
  completed:       'text-green-400 bg-green-400/10',
  disputed:        'text-red-400 bg-red-400/10',
  cancelled:       'text-gray-400 bg-gray-400/10',
  refunded:        'text-gray-400 bg-gray-400/10',
};
