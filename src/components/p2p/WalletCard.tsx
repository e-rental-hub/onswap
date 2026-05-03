'use client';
import { useState } from 'react';
import { WalletSummary } from '@/types';
import { DepositModal }  from './DepositModal';

interface Props {
  summary:      WalletSummary | null;
  accessToken:  string | null;
  onDeposited:  (newBalance: number) => void;
  showToast:    (msg: string) => void;
  compact?:     boolean;
}

export function WalletCard({ summary, accessToken, onDeposited, showToast, compact = false }: Props) {
  const [showDeposit, setShowDeposit] = useState(false);

  if (compact) {
    return (
      <>
        <button
          onClick={() => setShowDeposit(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
          style={{ background: 'rgba(240,160,60,0.1)', border: '1px solid rgba(240,160,60,0.2)', color: 'var(--pi-gold)' }}>
          <span>π</span>
          <span>{summary ? summary.piBalance.toFixed(4) : '—'}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>+ Add</span>
        </button>

        {showDeposit && (
          <DepositModal
            accessToken={accessToken}
            onDepositComplete={(bal) => { onDeposited(bal); setShowDeposit(false); }}
            onClose={() => setShowDeposit(false)}
            showToast={showToast}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="card p-5" style={{ borderColor: 'rgba(240,160,60,0.15)' }}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold tracking-widest" style={{ color: 'var(--text-muted)' }}>
            WALLET
          </span>
          <button onClick={() => setShowDeposit(true)} className="btn-pi text-xs px-3 py-1.5 rounded-lg">
            + Deposit Pi
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Available',  value: summary?.piBalance     ?? 0, color: 'var(--pi-gold)',   highlight: true },
            { label: 'Locked',     value: summary?.lockedBalance ?? 0, color: '#facc15',          highlight: false },
            { label: 'Total Held', value: summary?.totalHeld     ?? 0, color: 'var(--text-primary)', highlight: false },
          ].map((item) => (
            <div key={item.label} className="rounded-xl p-3"
              style={{ background: item.highlight ? 'rgba(240,160,60,0.07)' : 'var(--bg-elevated)', border: `1px solid ${item.highlight ? 'rgba(240,160,60,0.15)' : 'var(--border)'}` }}>
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</div>
              <div className="font-bold text-sm" style={{ fontFamily: 'var(--font-mono)', color: item.color }}>
                π{item.value.toFixed(4)}
              </div>
            </div>
          ))}
        </div>

        {summary && summary.lockedBalance > 0 && (
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
            🔒 π{summary.lockedBalance.toFixed(4)} locked in active sell ads
          </p>
        )}
      </div>

      {showDeposit && (
        <DepositModal
          accessToken={accessToken}
          onDepositComplete={(bal) => { onDeposited(bal); setShowDeposit(false); }}
          onClose={() => setShowDeposit(false)}
          showToast={showToast}
        />
      )}
    </>
  );
}
