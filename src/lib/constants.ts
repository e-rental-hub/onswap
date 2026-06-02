import { CurrencyEnum, PaymentMethodType } from "@/types";

export const ALL_PAYMENT_TYPES: PaymentMethodType[] = [
  'bank_transfer',
];

export const CURRENCIES = [
  { code: CurrencyEnum.NGN, symbol: '₦', flag: '🇳🇬', label: 'Naira' },
  { code: CurrencyEnum.KES, symbol: 'KSh', flag: '🇰🇪', label: 'Ke Shilling' },
//   { code: 'GHS', symbol: '₵', flag: '🇬🇭', label: 'Ghanaian Cedi' },
//   { code: 'ZAR', symbol: 'R',  flag: '🇿🇦', label: 'South African Rand' },
//   { code: 'USD', symbol: '$',  flag: '🇺🇸', label: 'US Dollar' },
];

export type MarketMode = 'express' | 'p2p';

export const PAYMENT_OPTIONS: { value: PaymentMethodType | ''; label: string }[] = [
  { value: '', label: 'All Methods' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

export const PLATFORM_FEE = 0.01; // 1%