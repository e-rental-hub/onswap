'use client';
import Link from 'next/link';
import { Ad, PAYMENT_METHOD_LABELS } from '@/types';

interface AdCardProps { ad: Ad; }

export default function AdCard({ ad }: AdCardProps) {
  const isBuy = ad.type === 'buy';

  return (
    <div className="card p-5 hover:border-opacity-50 transition-all duration-200 group"
      style={{ borderColor: 'var(--border-subtle)' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(240,160,60,0.25)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}>

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
            style={{ background: 'linear-gradient(135deg,#f0a03c22,#ec851822)', border: '1px solid rgba(240,160,60,0.2)', color: 'var(--pi-gold)' }}>
            {ad.creator.displayName[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{ad.creator.displayName}</span>
              {ad.creator.kycVerified && (
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>✓ KYC</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                ⭐ {ad.creator.rating.toFixed(1)} · {ad.creator.totalTrades} trades
              </span>
            </div>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isBuy ? 'badge-buy' : 'badge-sell'}`}>
          {isBuy ? 'BUY AD' : 'SELL AD'}
        </span>
      </div>

      {/* Price */}
      <div className="mb-4">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--pi-gold)' }}>
            ₦{ad.pricePerPi.toLocaleString()}
          </span>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/ π</span>
        </div>
        <div className="flex items-center gap-4 mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Limit: <span style={{ color: 'var(--text-primary)' }}>₦{ad.minLimit.toLocaleString()} – ₦{ad.maxLimit.toLocaleString()}</span></span>
        </div>
        <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Available: <span style={{ color: 'var(--pi-gold-bright)' }}>{ad.availableAmount.toLocaleString()} π</span>
        </div>
      </div>

      {/* Payment methods */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {ad.paymentMethods.map((pm) => (
          <span key={pm} className="text-xs px-2 py-1 rounded border" style={{ background: 'rgba(240,160,60,0.07)', color: 'var(--text-secondary)', borderColor: 'rgba(240,160,60,0.15)' }}>
            {PAYMENT_METHOD_LABELS[pm]}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          ⏱ {ad.paymentWindow} min window
        </span>
        <Link href={`/p2p/ads/${ad._id}`}>
          <button className={isBuy ? 'btn-sell text-sm px-5 py-2' : 'btn-buy text-sm px-5 py-2'}>
            {isBuy ? 'Sell Pi' : 'Buy Pi'} →
          </button>
        </Link>
      </div>
    </div>
  );
}
