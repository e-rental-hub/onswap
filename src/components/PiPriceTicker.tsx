'use client';

import Image from 'next/image';
import { useEffect, useState, useCallback } from 'react';

interface PiTickerData {
  usdPrice:  number;
  ngnPrice:  number;
  kesPrice:  number;
  change24h: number;
  updatedAt: number;
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-white/10 ${className}`} />
  );
}

export default function PiPriceTicker() {
  const [data,     setData]     = useState<PiTickerData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [error,    setError]    = useState(false);

  const fetchPrice = useCallback(async () => {
    setSpinning(true);
    try {
      const res  = await fetch('/api/pi-price?currency=ngn');
      if (!res.ok) throw new Error();
      const json = await res.json();

      setData({
        usdPrice:  json.usdPrice,
        ngnPrice:  json.ngnPrice,
        kesPrice:  json.kesPrice,
        change24h: json.change24h,
        updatedAt: Date.now(),
      });
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setSpinning(false);
    }
  }, []);

  useEffect(() => {
    fetchPrice();
    const id = setInterval(fetchPrice, 90_000);
    return () => clearInterval(id);
  }, [fetchPrice]);

  const isUp     = (data?.change24h ?? 0) >= 0;
  const timeStr  = data ? new Date(data.updatedAt).toLocaleTimeString() : null;

  const prices = [
    {
      label: 'USD',
      value: data ? `$${data.usdPrice.toFixed(4)}` : null,
      gold:  false,
    },
    {
      label: 'NGN',
      value: data
        ? `₦${Number(data.ngnPrice.toFixed(2)).toLocaleString('en-NG')}`
        : null,
      gold: true,
    },
    {
      label: 'KES',
      value: data ? `KSh ${data.kesPrice.toFixed(2)}` : null,
      gold:  false,
    },
    {
      label: '24h change',
      value: data
        ? `${isUp ? '+' : ''}${data.change24h.toFixed(2)}%`
        : null,
      isChange: true,
    },
  ];

  return (
    <div
      className="rounded-2xl p-4 sm:p-5"
      style={{
        background:   'var(--bg-card, var(--bg-secondary))',
        border:       '1px solid rgba(240,160,60,0.2)',
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        {/* Coin identity */}
        <div className="flex items-center gap-3">
          <Image
            src="/pi_logo.png"
            alt="Pi Network"
            width={24}
            height={24}
            className="opacity-90 flex-shrink-0"
            priority
            loading="eager"
          />
          <div>
            <p className="text-base font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
              Pi Network
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              PI · CoinGecko
            </p>
          </div>
        </div>

        {/* Live badge */}
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0"
          style={{
            background: 'rgba(240,160,60,0.1)',
            border:     '1px solid rgba(240,160,60,0.2)',
            color:      'var(--pi-gold)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Live
        </span>
      </div>

      {/* Price grid — 2×2 on all sizes */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {prices.map(({ label, value, gold, isChange }) => (
          <div
            key={label}
            className="rounded-xl px-3 py-3"
            style={{ background: 'var(--bg-secondary, rgba(255,255,255,0.05))' }}
          >
            <p
              className="text-xs uppercase tracking-wide mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              {label}
            </p>

            {loading || !value ? (
              <SkeletonBlock className="h-6 w-20" />
            ) : isChange ? (
              <span
                className={`inline-block text-sm font-semibold px-2.5 py-0.5 rounded-full ${
                  isUp
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-red-500/10   text-red-600   dark:text-red-400'
                }`}
              >
                {value}
              </span>
            ) : (
              <p
                className="text-lg font-semibold font-mono leading-none"
                style={{ color: gold ? 'var(--pi-gold)' : 'var(--text-primary)' }}
              >
                {value}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between pt-3"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {error
            ? 'Using cached rate'
            : timeStr
            ? `Updated ${timeStr}`
            : 'Updating…'}
        </p>

        <button
          onClick={fetchPrice}
          disabled={spinning}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
          style={{
            border: '1px solid var(--border-subtle)',
            color:  'var(--text-secondary)',
          }}
        >
          ↻ Refresh
        </button>
      </div>
    </div>
  );
}