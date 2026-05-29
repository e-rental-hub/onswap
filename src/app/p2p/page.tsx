'use client';
import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/layout/Navbar';
import AdCard from '@/components/p2p/AdCard';
import { adsApi } from '@/lib/api';
import { Ad, AdType, PaymentMethodType, PAYMENT_METHOD_LABELS } from '@/types';
import { logger } from '@/lib/logger';

const PAYMENT_OPTIONS: { value: PaymentMethodType | ''; label: string }[] = [
  { value: '', label: 'All Methods' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  // { value: 'opay', label: 'OPay' },
  // { value: 'palmpay', label: 'PalmPay' },
  // { value: 'kuda', label: 'Kuda Bank' },
  // { value: 'moniepoint', label: 'Moniepoint' },
];

export default function P2PMarketPage() {
  const [tab, setTab] = useState<AdType>('buy');
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethodType | ''>('');
  const [amountFilter, setAmountFilter] = useState('');
  const [total, setTotal] = useState(0);

  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { type: tab };
      if (paymentFilter) params.paymentMethod = paymentFilter;
      if (amountFilter) params.minAmount = Number(amountFilter);
      const res = await adsApi.getAds(params);
      setAds(res.data.ads);
      setTotal(res.data.total);
    } catch (err) {
      logger.error('Failed to fetch ads:', err);
    } finally {
      setLoading(false);
    }
  }, [tab, paymentFilter, amountFilter]);

  useEffect(() => { fetchAds(); }, [fetchAds]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>
            P2P <span className="pi-text">Market</span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {total} active ads · NGN · Escrow protected
          </p>
        </div>

        {/* Tabs + Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          {/* Tab toggle */}
          <div className="flex rounded-xl p-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            {(['buy', 'sell'] as AdType[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className="px-6 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: tab === t ? (t === 'buy' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)') : 'transparent',
                  color: tab === t ? (t === 'buy' ? '#4ade80' : '#f87171') : 'var(--text-muted)',
                  border: tab === t ? `1px solid ${t === 'buy' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` : '1px solid transparent',
                }}>
                {t === 'buy' ? '🟢 Buy Pi' : '🔴 Sell Pi'}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 sm:ml-auto">
            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value as PaymentMethodType | '')}
              className="input-dark text-sm" style={{ width: 'auto', padding: '8px 12px' }}>
              {PAYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input value={amountFilter} onChange={(e) => setAmountFilter(e.target.value)}
              className="input-dark text-sm" placeholder="Min amount (₦)" style={{ width: '150px', padding: '8px 12px' }} type="number" />
          </div>
        </div>

        {/* Ad grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full" style={{ background: 'var(--bg-elevated)' }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 rounded" style={{ background: 'var(--bg-elevated)', width: '60%' }} />
                    <div className="h-2 rounded" style={{ background: 'var(--bg-elevated)', width: '40%' }} />
                  </div>
                </div>
                <div className="h-8 rounded mb-3" style={{ background: 'var(--bg-elevated)' }} />
                <div className="h-4 rounded" style={{ background: 'var(--bg-elevated)', width: '70%' }} />
              </div>
            ))}
          </div>
        ) : ads.length === 0 ? (
          <div className="card p-16 text-center">
            <div className="text-4xl mb-4">📭</div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No ads found</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Try adjusting your filters or post an ad yourself.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
            {ads.map((ad) => <AdCard key={ad._id} ad={ad} />)}
          </div>
        )}
      </div>
    </div>
  );
}
