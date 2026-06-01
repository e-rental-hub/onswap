'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import AdCard from '@/components/p2p/AdCard';
import { adsApi } from '@/lib/api';
import { Ad, AdType, PaymentMethodType } from '@/types';
import { logger } from '@/lib/logger';
import BottomNav from '@/components/layout/BottomNav';
import { CURRENCIES, MarketMode, PAYMENT_OPTIONS } from '@/lib/constants';
import { CurrencyModal } from '@/components/CurrencyModal';

// ── Mode Switcher ─────────────────────────────────────────────────────────────
function ModeSwitcher({ mode, onChange }: { mode: MarketMode; onChange: (m: MarketMode) => void }) {
  return (
    <div style={{
      display: 'inline-flex', borderRadius: '16px', padding: '4px',
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      position: 'relative',
    }}>
      {(['express', 'p2p'] as MarketMode[]).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            style={{
              position: 'relative', zIndex: 1,
              padding: '9px 22px', borderRadius: '12px',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              border: 'none', transition: 'all 0.18s',
              background: active ? (m === 'express' ? 'linear-gradient(135deg,#f4a017,#e07b00)' : 'rgba(244,160,23,0.12)') : 'transparent',
              color: active ? (m === 'express' ? '#000' : '#f4a017') : 'var(--text-muted)',
              boxShadow: active && m === 'express' ? '0 2px 12px rgba(244,160,23,0.4)' : 'none',
              letterSpacing: '0.03em',
            }}
          >
            {m === 'express' ? '⚡ Express' : '🏪 P2P Market'}
          </button>
        );
      })}
    </div>
  );
}

// ── Express Panel (inline teaser — full page is ExpressPage.tsx) ──────────────
function ExpressPanel({ currency }: { currency: typeof CURRENCIES[0] }) {
  const router = useRouter();
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [piInput, setPiInput] = useState('');
  const MOCK_RATE = { NGN: 8250, GHS: 12.4, KES: 1680, ZAR: 230, USD: 5.1 }[currency.code] ?? 8250;
  const piNum = parseFloat(piInput) || 0;
  const fiatOut = piNum * MOCK_RATE;

  return (
    <div style={{
      maxWidth: '440px', margin: '0 auto',
      animation: 'fadeIn 0.25s ease',
    }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Rate banner */}
      <div style={{
        borderRadius: '20px', padding: '20px 24px',
        background: 'linear-gradient(135deg, rgba(244,160,23,0.14) 0%, rgba(244,160,23,0.04) 100%)',
        border: '1px solid rgba(244,160,23,0.25)',
        marginBottom: '20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Live Rate</p>
          <p style={{ fontSize: '28px', fontWeight: 800, color: '#f4a017', margin: 0, fontFamily: 'var(--font-display, Georgia, serif)' }}>
            {currency.symbol}{MOCK_RATE.toLocaleString()}
            <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 500 }}> /π</span>
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '4px 10px', borderRadius: '20px',
            background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.2)',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
            <span style={{ fontSize: '11px', color: '#4ade80', fontWeight: 700 }}>Live</span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>Updated just now</p>
        </div>
      </div>

      {/* Trade card */}
      <div style={{
        borderRadius: '20px', overflow: 'hidden',
        border: '1px solid var(--border)', background: 'var(--bg-card)',
      }}>
        {/* Buy / Sell toggle */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {(['buy', 'sell'] as const).map((s) => (
            <button key={s} onClick={() => setSide(s)} style={{
              flex: 1, padding: '14px', fontSize: '14px', fontWeight: 700,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: side === s
                ? (s === 'buy' ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)')
                : 'transparent',
              color: side === s
                ? (s === 'buy' ? '#4ade80' : '#f87171')
                : 'var(--text-muted)',
              borderBottom: side === s
                ? `2px solid ${s === 'buy' ? '#4ade80' : '#f87171'}`
                : '2px solid transparent',
            }}>
              {s === 'buy' ? '🟢 Buy Pi' : '🔴 Sell Pi'}
            </button>
          ))}
        </div>

        <div style={{ padding: '24px' }}>
          {/* You pay / receive */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
              {side === 'buy' ? 'You Send' : 'You Sell'}
            </label>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '14px 16px', borderRadius: '14px',
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#f4a017', fontFamily: 'var(--font-display, Georgia, serif)' }}>π</span>
              <input
                type="number"
                min={0}
                step="0.0001"
                placeholder="0.0000"
                value={piInput}
                onChange={(e) => setPiInput(e.target.value)}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              />
              <span style={{
                padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                background: 'rgba(244,160,23,0.12)', color: '#f4a017',
              }}>PI</span>
            </div>
          </div>

          {/* Arrow */}
          <div style={{ textAlign: 'center', margin: '8px 0', color: 'var(--text-muted)', fontSize: '18px' }}>⇅</div>

          {/* You receive */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
              {side === 'buy' ? 'You Receive' : 'You Get'}
            </label>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '14px 16px', borderRadius: '14px',
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              opacity: 0.85,
            }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-secondary)' }}>{currency.flag}</span>
              <span style={{
                flex: 1, fontSize: '20px', fontWeight: 700, color: piNum > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono, monospace)',
              }}>
                {piNum > 0 ? `${currency.symbol}${fiatOut.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '0.00'}
              </span>
              <span style={{
                padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)',
              }}>{currency.code}</span>
            </div>
          </div>

          {/* Fee row */}
          {piNum > 0 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 12px', borderRadius: '10px',
              background: 'rgba(244,160,23,0.05)', border: '1px solid rgba(244,160,23,0.1)',
              marginBottom: '16px', fontSize: '12px',
            }}>
              <span style={{ color: 'var(--text-muted)' }}>Platform fee (1%)</span>
              <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>π{(piNum * 0.01).toFixed(4)}</span>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={() => router.push('/express')}
            style={{
              width: '100%', padding: '16px', borderRadius: '14px',
              fontSize: '15px', fontWeight: 800, cursor: 'pointer', border: 'none',
              background: side === 'buy'
                ? 'linear-gradient(135deg, #4ade80, #16a34a)'
                : 'linear-gradient(135deg, #f87171, #dc2626)',
              color: '#fff',
              boxShadow: side === 'buy'
                ? '0 4px 16px rgba(74,222,128,0.3)'
                : '0 4px 16px rgba(239,68,68,0.3)',
              letterSpacing: '0.02em',
            }}
          >
            {side === 'buy' ? '⚡ Buy Pi Instantly' : '⚡ Sell Pi Instantly'}
          </button>

          <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px' }}>
            No counterparty wait · Instant settlement · Escrow protected
          </p>
        </div>
      </div>

      {/* Express perks */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: '10px', marginTop: '16px',
      }}>
        {[
          { icon: '⚡', label: 'Instant', sub: 'No waiting' },
          { icon: '🔒', label: 'Secure', sub: 'Escrow' },
          { icon: '💰', label: 'Best Rate', sub: 'Live price' },
        ].map((p) => (
          <div key={p.label} style={{
            textAlign: 'center', padding: '14px 8px', borderRadius: '14px',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{p.icon}</div>
            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px' }}>{p.label}</p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>{p.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function P2PMarketPage() {
  const [mode, setMode] = useState<MarketMode>('express');
  const [tab, setTab] = useState<AdType>('buy');
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethodType | ''>('');
  const [amountFilter, setAmountFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [currencyCode, setCurrencyCode] = useState('NGN');
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);

  const currency = CURRENCIES.find((c) => c.code === currencyCode) ?? CURRENCIES[0];

  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { type: tab, currency: currencyCode };
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
  }, [tab, paymentFilter, amountFilter, currencyCode]);

  useEffect(() => { if (mode === 'p2p') fetchAds(); }, [fetchAds, mode]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ── Top bar: title + currency picker ─────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 3px', fontFamily: 'var(--font-display, Georgia, serif)', color: 'var(--text-primary)' }}>
              Pi <span style={{ color: '#f4a017' }}>Exchange</span>
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              {mode === 'p2p' ? `${total} active ads · Escrow protected` : 'Instant Pi trading at live rates'}
            </p>
          </div>

          {/* Currency picker button */}
          <button
            onClick={() => setShowCurrencyModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 16px', borderRadius: '14px', cursor: 'pointer',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(244,160,23,0.4)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <span style={{ fontSize: '20px' }}>{currency.flag}</span>
            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{currency.code}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>▾</span>
          </button>
        </div>

        {/* ── Mode switcher ─────────────────────────────────────────────── */}
        <div style={{ marginBottom: '24px' }}>
          <ModeSwitcher mode={mode} onChange={setMode} />
        </div>

        {/* ── EXPRESS MODE ─────────────────────────────────────────────── */}
        {mode === 'express' && <ExpressPanel currency={currency} />}

        {/* ── P2P MODE ─────────────────────────────────────────────────── */}
        {mode === 'p2p' && (
          <>
            {/* Tab + Filters row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              {/* Buy / Sell tabs */}
              <div style={{
                display: 'flex', borderRadius: '14px', padding: '4px',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
              }}>
                {(['buy', 'sell'] as AdType[]).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    style={{
                      padding: '8px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
                      cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                      background: tab === t
                        ? (t === 'buy' ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)')
                        : 'transparent',
                      color: tab === t
                        ? (t === 'buy' ? '#4ade80' : '#f87171')
                        : 'var(--text-muted)',
                      outline: tab === t
                        ? `1px solid ${t === 'buy' ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`
                        : '1px solid transparent',
                    }}>
                    {t === 'buy' ? '🟢 Buy Pi' : '🔴 Sell Pi'}
                  </button>
                ))}
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto', flexWrap: 'wrap' }}>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value as PaymentMethodType | '')}
                  className="input-dark text-sm"
                  style={{ width: 'auto', padding: '8px 12px', borderRadius: '10px' }}
                >
                  {PAYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input
                  value={amountFilter}
                  onChange={(e) => setAmountFilter(e.target.value)}
                  className="input-dark text-sm"
                  placeholder={`Min (${currency.symbol})`}
                  style={{ width: '140px', padding: '8px 12px', borderRadius: '10px' }}
                  type="number"
                />
              </div>
            </div>

            {/* Ad Grid */}
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
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>📭</div>
                <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No ads found</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Try adjusting your filters or switching to Express mode.
                </p>
                <button
                  onClick={() => setMode('express')}
                  style={{
                    marginTop: '16px', padding: '10px 24px', borderRadius: '12px',
                    background: 'rgba(244,160,23,0.12)', border: '1px solid rgba(244,160,23,0.3)',
                    color: '#f4a017', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                  }}
                >
                  ⚡ Try Express Instead
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
                {ads.map((ad) => <AdCard key={ad._id} ad={ad} />)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Currency modal */}
      {showCurrencyModal && (
        <CurrencyModal
          selected={currencyCode}
          onSelect={setCurrencyCode}
          onClose={() => setShowCurrencyModal(false)}
        />
      )}

      <BottomNav />
    </div>
  );
}