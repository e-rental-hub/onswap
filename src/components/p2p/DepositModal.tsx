'use client';
import { useState, useEffect } from 'react';
import { PiPayButton }    from './PiPayButton';
import { walletApi }      from '@/lib/api';
import { DepositInfo }    from '@/types';
import { logger }         from '@/lib/logger';

interface Props {
  accessToken:       string | null;
  onDepositComplete: (newBalance: number, netAmount: number, fee: number) => void;
  onClose:           () => void;
  /** Pre-fill the amount if we know how much more is needed */
  suggestedAmount?:  number;
  showToast:         (msg: string) => void;
}

export function DepositModal({
  accessToken,
  onDepositComplete,
  onClose,
  suggestedAmount,
  showToast,
}: Props) {
  const [amount,      setAmount]      = useState(suggestedAmount?.toString() ?? '');
  const [depositInfo, setDepositInfo] = useState<DepositInfo | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [depositing,  setDepositing]  = useState(false);
  const [result,      setResult]      = useState<{ newBalance: number; netAmount: number; fee: number } | null>(null);

  useEffect(() => {
    walletApi.getDepositInfo()
      .then((r) => setDepositInfo(r.data))
      .catch((e) => logger.error('getDepositInfo error:', e))
      .finally(() => setLoading(false));
  }, []);

  const numAmount = Number(amount) || 0;
  const fee       = depositInfo ? Math.round(numAmount * depositInfo.feeRate * 10_000) / 10_000 : 0;
  const netAmount = Math.max(0, Math.round((numAmount - fee) * 10_000) / 10_000);
  const isValid   = numAmount >= (depositInfo?.minDeposit ?? 1);

  const handlePaymentComplete = async () => {
    // PiPayButton calls onPaymentComplete after its full cycle.
    // At that point completeDeposit has already been called inside the button callbacks.
    // We just need to refresh the balance.
    try {
      const res = await walletApi.getBalance();
      const newBalance = res.data.piBalance;
      setResult({ newBalance, netAmount, fee });
      onDepositComplete(newBalance, netAmount, fee);
      setDepositing(false);
      showToast(`✅ Deposited ${netAmount}π successfully`);
    } catch (err) {
      logger.error('Post-deposit balance refresh error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-2xl p-6 relative animate-slide-up"
        style={{ background: 'var(--bg-card)', border: '1px solid rgba(240,160,60,0.2)' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              Deposit <span className="pi-text">Pi</span>
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Add Pi to your in-app wallet
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>✕</button>
        </div>

        {result ? (
          // ── Success state ──
          <div className="text-center py-6">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-lg font-bold mb-1" style={{ color: '#4ade80' }}>Deposit Confirmed!</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--pi-gold)' }}>π{result.netAmount}</span> added to your wallet
            </p>
            <div className="rounded-xl p-4 mb-6 text-sm space-y-2"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Deposited</span>
                <span>π{numAmount}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Platform fee</span>
                <span style={{ color: '#f87171' }}>−π{result.fee}</span>
              </div>
              <div className="flex justify-between font-bold pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <span>New balance</span>
                <span style={{ color: 'var(--pi-gold)' }}>π{result.newBalance}</span>
              </div>
            </div>
            <button onClick={onClose} className="btn-pi w-full py-3 rounded-xl">Done</button>
          </div>
        ) : (
          <>
            {/* Amount input */}
            <div className="mb-5">
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Amount (π)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold"
                  style={{ color: 'var(--pi-gold)' }}>π</span>
                <input
                  type="number"
                  min={depositInfo?.minDeposit ?? 1}
                  step="0.0001"
                  className="input-dark pl-9 text-lg font-bold w-full"
                  placeholder={`Min ${depositInfo?.minDeposit ?? 1}`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={depositing}
                />
              </div>

              {/* Quick amounts */}
              <div className="flex gap-2 mt-2">
                {[5, 10, 25, 50, 100].map((v) => (
                  <button key={v} type="button" onClick={() => setAmount(String(v))}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: Number(amount) === v ? 'rgba(240,160,60,0.15)' : 'var(--bg-elevated)',
                      color:      Number(amount) === v ? 'var(--pi-gold)'          : 'var(--text-muted)',
                      border:     `1px solid ${Number(amount) === v ? 'rgba(240,160,60,0.3)' : 'var(--border)'}`,
                    }}>
                    {v}π
                  </button>
                ))}
              </div>
            </div>

            {/* Fee breakdown */}
            {!loading && depositInfo && numAmount > 0 && (
              <div className="rounded-xl p-4 mb-5 text-sm space-y-2"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>You send</span>
                  <span className="font-medium">π{numAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Platform fee ({depositInfo.feePercent})</span>
                  <span style={{ color: '#f87171' }}>−π{fee}</span>
                </div>
                <div className="flex justify-between font-bold pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span>You receive</span>
                  <span style={{ color: 'var(--pi-gold)' }}>π{netAmount}</span>
                </div>
              </div>
            )}

            {/* Deposit button */}
            <PiPayButton
              paymentData={{ amount: numAmount, memo: `onSwap deposit ${numAmount}π`, metadata: { type: 'deposit' } }}
              accessToken={accessToken}
              onPaymentComplete={handlePaymentComplete}
              onError={(err) => { showToast(err.message); setDepositing(false); }}
              showToast={showToast}
              disabled={!isValid || depositing}
              className="btn-pi w-full py-3.5 rounded-xl text-base font-bold"
            >
              {depositing ? 'Processing…' : `Deposit π${numAmount || '0'} →`}
            </PiPayButton>

            {!accessToken && (
              <p className="text-xs text-center mt-3" style={{ color: '#f87171' }}>
                Connect your Pi wallet first to make a deposit.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
