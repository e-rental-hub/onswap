import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';

// ── Spread config ─────────────────────────────────────────────────────────────
// Express buy:  platform charges +2% above market (user pays more)
// Express sell: platform pays   -2% below market (user gets less)
// Net: 4% spread total, ~2% each side — standard for instant exchange
export const EXPRESS_BUY_SPREAD  = 0.02;   // +2%
export const EXPRESS_SELL_SPREAD = 0.02;   // -2%
export const PLATFORM_FEE        = 0.01;   // 1% additional service fee

export interface PiPrice {
  usdPrice:   number;   // raw CMC price in USD
  fiatPrice:  number;   // converted to selected currency
  buyPrice:   number;   // express buy rate (user pays this)
  sellPrice:  number;   // express sell rate (user receives this)
  change24h:  number;   // % change
  lastUpdated: number;  // timestamp ms
  loading:    boolean;
  error:      string | null;
}

// CMC currency conversion IDs
const CMC_CONVERT: Record<string, string> = {
  NGN: 'NGN',
  KES: 'KES',
  USD: 'USD',
};

// Fallback rates vs USD (used when CMC is unavailable)
const FALLBACK_USD_RATES: Record<string, number> = {
  NGN: 1610,
  KES: 130,
  USD: 1,
};

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

const cache: Map<string, { price: PiPrice; ts: number }> = new Map();

export function usePiPrice(): PiPrice {
  const { preferredCurrency } = useAuth();
  const [price, setPrice] = useState<PiPrice>({
    usdPrice: 0, fiatPrice: 0, buyPrice: 0, sellPrice: 0,
    change24h: 0, lastUpdated: 0, loading: true, error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const fetchPrice = useCallback(async () => {
    const code      =   preferredCurrency.code;
    const cacheKey  = `pi_${code}`;
    const cached    = cache.get(cacheKey);

    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setPrice(cached.price);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setPrice((p) => ({ ...p, loading: true, error: null }));

    try {
      // Route through your Next.js API route to keep CMC key server-side
      const res = await fetch(
        `/api/pi-price?currency=${CMC_CONVERT[code] ?? 'USD'}`,
        { signal: abortRef.current.signal },
      );

      if (!res.ok) throw new Error('Price fetch failed');
      const data = await res.json();

      // Expected shape from /api/pi-price:
      // { usdPrice: number, fiatPrice: number, change24h: number }
      const usdPrice  = data.usdPrice  ?? 0;
      const fiatPrice = data.fiatPrice ?? usdPrice * (FALLBACK_USD_RATES[code] ?? 1);
      const change24h = data.change24h ?? 0;

      // Apply spreads for express rates
      const buyPrice  = fiatPrice * (1 + EXPRESS_BUY_SPREAD);
      const sellPrice = fiatPrice * (1 - EXPRESS_SELL_SPREAD);

      const result: PiPrice = {
        usdPrice, fiatPrice, buyPrice, sellPrice,
        change24h, lastUpdated: Date.now(),
        loading: false, error: null,
      };

      cache.set(cacheKey, { price: result, ts: Date.now() });
      setPrice(result);
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;

      // Graceful fallback: use last known price if available
      const prev = cache.get(cacheKey);
      if (prev) {
        setPrice({ ...prev.price, loading: false, error: 'Using cached rate' });
        return;
      }

      // Last resort: synthetic fallback rate (Pi was ~$0.60–0.80 at time of writing)
      const fallbackUsd   = 0.70;
      const fallbackFiat  = fallbackUsd * (FALLBACK_USD_RATES[code] ?? 1);
      setPrice({
        usdPrice:  fallbackUsd,
        fiatPrice: fallbackFiat,
        buyPrice:  fallbackFiat * (1 + EXPRESS_BUY_SPREAD),
        sellPrice: fallbackFiat * (1 - EXPRESS_SELL_SPREAD),
        change24h: 0,
        lastUpdated: Date.now(),
        loading: false,
        error: 'Live rate unavailable — using estimated rate',
      });
    }
  }, [preferredCurrency.code]);

  useEffect(() => {
    fetchPrice();
    const interval = setInterval(fetchPrice, CACHE_TTL_MS);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [fetchPrice]);

  return price;
}