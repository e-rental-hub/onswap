import { CurrencyEnum, PaymentMethodType } from "@/types";

export const ALL_PAYMENT_TYPES: PaymentMethodType[] = [
  'bank_transfer',
];

export const CURRENCIES = [
  { code: CurrencyEnum.NGN, symbol: '₦',  flag: '🇳🇬', label: 'Nigerian Naira' },
  { code: CurrencyEnum.KES, symbol: 'KSh', flag: '🇰🇪', label: 'Kenyan Shilling' },
  { code: CurrencyEnum.CFA, symbol: 'FCFA', flag: '🇨🇲', label: 'Central African CFA franc' },
  { code: CurrencyEnum.CDF, symbol: 'FC',  flag: '🇨🇩', label: 'Congolese Franc' },
  { code: CurrencyEnum.TZS, symbol: 'TSh', flag: '🇹🇿', label: 'Tanzanian Shilling' },
  { code: CurrencyEnum.UGX, symbol: 'USh', flag: '🇺🇬', label: 'Ugandan Shilling' },
  { code: CurrencyEnum.RWF, symbol: 'FRw', flag: '🇷🇼', label: 'Rwandan Franc' },
  { code: CurrencyEnum.ETB, symbol: 'Br',  flag: '🇪🇹', label: 'Ethiopian Birr' },
  { code: CurrencyEnum.ZMK, symbol: 'ZK',  flag: '🇿🇲', label: 'Zambian Kwacha' },
];

export type MarketMode = 'express' | 'p2p';

export const PAYMENT_OPTIONS: { value: PaymentMethodType | ''; label: string }[] = [
  { value: '', label: 'All Methods' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

export const PLATFORM_FEE = 0.01; // 1%