'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import { adsApi, ordersApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Ad, PaymentMethodType, PAYMENT_METHOD_LABELS } from '@/types';
import { logger } from '@/lib/logger';

export default function AdDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [ad, setAd] = useState<Ad | null>(null);
  const [loading, setLoading] = useState(true);
  const [nairaAmount, setNairaAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType | ''>('');
  const [trading, setTrading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    adsApi.getAdById(id).then((r) => { setAd(r.data.ad); setLoading(false); }).catch((e) => { logger.error('Failed to load ad:', e); setLoading(false); });
  }, [id]);

  const piAmount = ad ? Number(nairaAmount) / ad.pricePerPi : 0;

  const handleTrade = async () => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    if (!ad || !selectedMethod || !nairaAmount) { setError('Please fill all fields'); return; }
    setError('');
    setTrading(true);
    try {
      const res = await ordersApi.createOrder({ adId: ad._id, piAmount, paymentMethod: selectedMethod });
      logger.info('Order created:', res.data.order._id);
      router.push(`/p2p/orders/${res.data.order._id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create order';
      setError(msg);
      logger.error('Trade failed:', err);
    } finally {
      setTrading(false);
    }
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />
      <div className="flex items-center justify-center h-64"><div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading ad…</div></div>
    </div>
  );

  if (!ad) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />
      <div className="flex items-center justify-center h-64"><p style={{ color: 'var(--text-muted)' }}>Ad not found.</p></div>
    </div>
  );

  const isBuy = ad.type === 'buy';
  const actionLabel = isBuy ? 'Sell Pi' : 'Buy Pi';
  const isOwn = user?.id === (ad.creator as unknown as { _id: string })._id || user?.id === ad.creator.id;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button onClick={() => router.back()} className="text-sm mb-6 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>← Back to market</button>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Ad info */}
          <div className="lg:col-span-3 space-y-4">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${isBuy ? 'badge-buy' : 'badge-sell'}`}>{isBuy ? 'BUY AD' : 'SELL AD'}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Posted {new Date(ad.createdAt).toLocaleDateString()}</span>
              </div>

              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-bold pi-text" style={{ fontFamily: 'var(--font-display)' }}>₦{ad.pricePerPi.toLocaleString()}</span>
                <span style={{ color: 'var(--text-muted)' }}>/ π</span>
              </div>

              <div className="grid grid-cols-2 gap-4 my-6">
                {[
                  { label: 'Available', value: `${ad.availableAmount.toLocaleString()} π` },
                  { label: 'Min Limit', value: `₦${ad.minLimit.toLocaleString()}` },
                  { label: 'Max Limit', value: `₦${ad.maxLimit.toLocaleString()}` },
                  { label: 'Pay Window', value: `${ad.paymentWindow} min` },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg p-3" style={{ background: 'var(--bg-elevated)' }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</div>
                    <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div className="mb-4">
                <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>PAYMENT METHODS</div>
                <div className="flex flex-wrap gap-2">
                  {ad.paymentMethods.map((pm) => (
                    <span key={pm} className="text-sm px-3 py-1.5 rounded-lg border" style={{ background: 'rgba(240,160,60,0.07)', color: 'var(--text-secondary)', borderColor: 'rgba(240,160,60,0.15)' }}>
                      {PAYMENT_METHOD_LABELS[pm]}
                    </span>
                  ))}
                </div>
              </div>

              {ad.terms && (
                <div className="rounded-lg p-4 mt-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>TERMS</div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{ad.terms}</p>
                </div>
              )}
            </div>

            {/* Seller info */}
            <div className="card p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold"
                  style={{ background: 'linear-gradient(135deg,#f0a03c22,#ec851822)', border: '1px solid rgba(240,160,60,0.2)', color: 'var(--pi-gold)' }}>
                  {ad.creator.displayName[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{ad.creator.displayName}</span>
                    {ad.creator.kycVerified && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>✓ KYC</span>}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span>⭐ {ad.creator.rating.toFixed(1)}</span>
                    <span>{ad.creator.totalTrades} trades</span>
                    <span>{ad.creator.completionRate}% completion</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trade box */}
          <div className="lg:col-span-2">
            <div className="card p-6 sticky top-24" style={{ borderColor: isOwn ? 'var(--border)' : 'rgba(240,160,60,0.2)' }}>
              <h2 className="font-bold text-lg mb-5" style={{ fontFamily: 'var(--font-display)' }}>{actionLabel}</h2>

              {isOwn ? (
                <div className="text-center py-8">
                  <div className="text-3xl mb-3">🚫</div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>This is your own ad.</p>
                </div>
              ) : (
                <>
                  {error && <div className="mb-4 px-3 py-2.5 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Amount (₦)</label>
                      <input className="input-dark" type="number" placeholder={`₦${ad.minLimit} – ₦${ad.maxLimit}`}
                        value={nairaAmount} onChange={(e) => setNairaAmount(e.target.value)} />
                    </div>

                    {nairaAmount && piAmount > 0 && (
                      <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(240,160,60,0.07)', border: '1px solid rgba(240,160,60,0.15)' }}>
                        You {isBuy ? 'get' : 'send'}: <span className="font-bold" style={{ color: 'var(--pi-gold)' }}>π {piAmount.toFixed(4)}</span>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Payment Method</label>
                      <select className="input-dark" value={selectedMethod} onChange={(e) => setSelectedMethod(e.target.value as PaymentMethodType)}>
                        <option value="">Select method</option>
                        {ad.paymentMethods.map((pm) => <option key={pm} value={pm}>{PAYMENT_METHOD_LABELS[pm]}</option>)}
                      </select>
                    </div>

                    <div className="rounded-lg p-3 text-xs" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                      🔒 Pi will be locked in escrow immediately. You have {ad.paymentWindow} minutes to complete payment.
                    </div>

                    <button onClick={handleTrade} disabled={trading || !nairaAmount || !selectedMethod}
                      className={`w-full py-3 rounded-xl font-semibold ${isBuy ? 'btn-sell' : 'btn-buy'}`}>
                      {trading ? 'Creating order…' : `${actionLabel} →`}
                    </button>

                    {!isAuthenticated && (
                      <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>You must be logged in to trade.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
