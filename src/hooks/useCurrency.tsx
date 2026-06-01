'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { CURRENCIES } from '@/lib/constants';

export type CurrencyCode = typeof CURRENCIES[number]['code'];
export type Currency     = typeof CURRENCIES[number];

const STORAGE_KEY = 'pixchange_currency';

interface CurrencyCtx {
  currency:   Currency;
  setCode:    (code: CurrencyCode) => void;
  allCurrencies: typeof CURRENCIES;
}

const CurrencyContext = createContext<CurrencyCtx>({
  currency:      CURRENCIES[0],
  setCode:       () => {},
  allCurrencies: CURRENCIES,
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [code, setCodeState] = useState<CurrencyCode>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved && CURRENCIES.find((c) => c.code === saved)) return saved as CurrencyCode;
    }
    return CURRENCIES[0].code as CurrencyCode;
  });

  const setCode = useCallback((c: CurrencyCode) => {
    setCodeState(c);
    try { sessionStorage.setItem(STORAGE_KEY, c); } catch {}
  }, []);

  const currency = CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];

  return (
    <CurrencyContext.Provider value={{ currency, setCode, allCurrencies: CURRENCIES }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => useContext(CurrencyContext);