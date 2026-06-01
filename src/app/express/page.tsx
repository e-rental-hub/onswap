'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import BottomNav from '@/components/layout/BottomNav';
import { DepositModal } from '@/components/p2p/DepositModal';
import PiWalletPicker from '@/components/p2p/PiWalletAddressPicker';
import PaymentAccountPicker from '@/components/p2p/paymentAccountPicker';
// import { walletApi, expressApi } from '@/lib/api';  // add expressApi to your api lib
import { useAuth } from '@/hooks/useAuth';
import { WalletSummary, PaymentMethodDetail } from '@/types';
import { logger } from '@/lib/logger';
import { PLATFORM_FEE } from '@/lib/constants';

// ── Types ─────────────────────────────────────────────────────────────────────

type Side  = 'buy' | 'sell';
type Step  = 'configure' | 'confirm' | 'processing' | 'done';

const CURRENCIES = [
  { code: 'NGN', symbol: '₦', flag: '🇳🇬', rate: 8250  },
  { code: 'KES', symbol: 'KSh', flag: '🇰🇪', rate: 1680  },
  // { code: 'GHS', symbol: '₵', flag: '🇬🇭', rate: 12.4  },
//   { code: 'ZAR', symbol: 'R',  flag: '🇿🇦', rate: 230   },
//   { code: 'USD', symbol: '$',  flag: '🇺🇸', rate: 5.1   },
];

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div style={{
      padding: '10px 14px', borderRadius: '12px', marginBottom: '16px', fontSize: '13px',
      background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)',
    }}>
      {message}
    </div>
  );
}

function SummaryRow({ label, value, highlight, last }: { label: string; value: string; highlight?: boolean; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 16px',
      borderBottom: last ? 'none' : '1px solid var(--border)',
      background: 'var(--bg-elevated)',
    }}>
      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: 700, color: highlight ? '#f4a017' : 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)' }}>
        {value}
      </span>
    </div>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────
function StepDots({ step }: { step: Step }) {
  const steps: Step[] = ['configure', 'confirm', 'processing', 'done'];
  const idx = steps.indexOf(step);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', marginBottom: '24px' }}>
      {steps.slice(0, 3).map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: i < idx ? '10px' : i === idx ? '28px' : '10px',
            height: '6px', borderRadius: '3px',
            background: i <= idx ? '#f4a017' : 'var(--bg-elevated)',
            transition: 'all 0.25s ease',
          }} />
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ExpressPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const [side,         setSide]         = useState<Side>('buy');
  const [currencyCode, setCurrencyCode] = useState('NGN');
  const [piInput,      setPiInput]      = useState('');
  const [step,         setStep]         = useState<Step>('configure');
  const [wallet,       setWallet]       = useState<WalletSummary | null>(null);
  const [walletLoaded, setWalletLoaded] = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState('');
  const [showDeposit,  setShowDeposit]  = useState(false);
  const [orderId,      setOrderId]      = useState('');

  // sell-Pi flow: user must provide a Naira receiving account
  const [paymentAccount, setPaymentAccount] = useState<PaymentMethodDetail | null>(null);
  // buy-Pi flow: user provides a Pi wallet to receive Pi
  const [piWalletId,     setPiWalletId]     = useState<string | null>(null);

  const currency = CURRENCIES.find((c) => c.code === currencyCode) ?? CURRENCIES[0];
  const piNum    = parseFloat(piInput) || 0;
  const fee      = piNum * PLATFORM_FEE;
  const netPi    = side === 'buy' ? piNum - fee : piNum - fee;
  const fiatAmt  = piNum * currency.rate;
  const fiatNet  = netPi * currency.rate;

  // ── Fetch wallet ───────────────────────────────────────────────────────────
  // const fetchWallet = useCallback(async () => {
  //   if (!isAuthenticated) return;
  //   try {
  //     const res = await walletApi.getBalance();
  //     setWallet(res.data);
  //   } catch (e) {
  //     logger.error('fetchWallet:', e);
  //   } finally {
  //     setWalletLoaded(true);
  //   }
  // }, [isAuthenticated]);

  // useEffect(() => { fetchWallet(); }, [fetchWallet]);

  // ── Validation ─────────────────────────────────────────────────────────────
  const MIN_PI = 1;
  const MAX_PI = 10000;

  function validate(): string {
    if (!isAuthenticated)      return 'Log in to trade';
    if (piNum <= 0)            return 'Enter an amount';
    if (piNum < MIN_PI)        return `Minimum is π${MIN_PI}`;
    if (piNum > MAX_PI)        return `Maximum is π${MAX_PI.toLocaleString()}`;
    if (side === 'sell') {
      if (!walletLoaded)       return 'Checking wallet…';
      if (!wallet || wallet.piBalance < piNum) return `Insufficient balance — need π${piNum.toFixed(4)}`;
      if (!paymentAccount)     return 'Select your Naira receiving account';
    }
    if (side === 'buy' && !piWalletId) return 'Select a Pi wallet to receive Pi';
    return '';
  }

  const validationError = validate();

  // ── Proceed to confirm ─────────────────────────────────────────────────────
  const handleProceed = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');

    if (side === 'sell' && wallet && wallet.piBalance < piNum) {
      setShowDeposit(true);
      return;
    }
    setStep('confirm');
  };

  // ── Submit order ───────────────────────────────────────────────────────────
  // const handleSubmit = async () => {
  //   setSubmitting(true);
  //   setError('');
  //   setStep('processing');
  //   try {
  //     const res = await expressApi.createOrder({
  //       side,
  //       piAmount:      piNum,
  //       currency:      currencyCode,
  //       paymentAccountId: side === 'sell' ? paymentAccount?._id : undefined,
  //       piWalletAddressId: side === 'buy' ? piWalletId ?? undefined : undefined,
  //     });
  //     setOrderId(res.data.orderId);
  //     setStep('done');
  //     logger.info('Express order created:', res.data.orderId);
  //   } catch (err: unknown) {
  //     const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  //     setError(msg ?? 'Something went wrong. Please try again.');
  //     setStep('configure');
  //   } finally {
  //     setSubmitting(false);
  //   }
  // };

  // ── Colours ────────────────────────────────────────────────────────────────
  const accentColor = side === 'buy' ? '#4ade80' : '#f87171';
  const accentBg    = side === 'buy' ? 'rgba(74,222,128,0.12)' : 'rgba(239,68,68,0.12)';
  const accentBorder = side === 'buy' ? 'rgba(74,222,128,0.3)'  : 'rgba(239,68,68,0.3)';
  const ctaBg       = side === 'buy'
    ? 'linear-gradient(135deg,#4ade80,#16a34a)'
    : 'linear-gradient(135deg,#f87171,#dc2626)';
  const ctaShadow   = side === 'buy'
    ? '0 4px 20px rgba(74,222,128,0.35)'
    : '0 4px 20px rgba(239,68,68,0.35)';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />

      {/* Deposit modal */}
      {showDeposit && (
        <DepositModal
          accessToken={user?.piUid ?? null}
          suggestedAmount={Math.ceil((piNum - (wallet?.piBalance ?? 0)) * 1.015 * 10000) / 10000}
          onDepositComplete={(newBal) => {
            setWallet((w) => w ? { ...w, piBalance: newBal } : w);
            if (newBal >= piNum) { setShowDeposit(false); setStep('confirm'); }
          }}
          onClose={() => setShowDeposit(false)}
          showToast={(msg) => setError(msg)}
        />
      )}

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px 100px' }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <button
              onClick={() => router.push('/p2p')}
              style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: 0, lineHeight: 1 }}
            >
              ←
            </button>
            <h1 style={{
              fontSize: '22px', fontWeight: 800, margin: 0,
              fontFamily: 'var(--font-display, Georgia, serif)', color: 'var(--text-primary)',
            }}>
              ⚡ <span style={{ color: '#f4a017' }}>Express</span> Trade
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 0 28px' }}>
            Instant settlement · No counterparty wait
          </p>
        </div>

        {/* ── Step dots ───────────────────────────────────────────────── */}
        {step !== 'done' && <StepDots step={step} />}

        {/* ══════════════════════════════════════════════════════════════
            CONFIGURE
        ══════════════════════════════════════════════════════════════ */}
        {step === 'configure' && (
          <>
            {/* Live rate banner */}
            <div style={{
              borderRadius: '18px', padding: '16px 20px',
              background: 'linear-gradient(135deg, rgba(244,160,23,0.12), rgba(244,160,23,0.04))',
              border: '1px solid rgba(244,160,23,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '20px',
            }}>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 2px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Express Rate</p>
                <p style={{ fontSize: '24px', fontWeight: 800, color: '#f4a017', margin: 0, fontFamily: 'var(--font-display, Georgia, serif)' }}>
                  {currency.symbol}{currency.rate.toLocaleString()}
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>/π</span>
                </p>
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '6px 12px', borderRadius: '20px',
                background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)',
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#4ade80' }}>Live</span>
              </div>
            </div>
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

            {/* Trade card */}
            <div style={{
              borderRadius: '20px', overflow: 'hidden',
              border: '1px solid var(--border)', background: 'var(--bg-card)',
              marginBottom: '20px',
            }}>
              {/* Buy / Sell tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                {(['buy', 'sell'] as Side[]).map((s) => (
                  <button key={s} onClick={() => { setSide(s); setError(''); }} style={{
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

              <div style={{ padding: '22px' }}>
                <ErrorBanner message={error} />

                {/* Pi amount input */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                    Pi Amount
                  </label>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '14px 16px', borderRadius: '14px',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: '20px', fontWeight: 800, color: '#f4a017' }}>π</span>
                    <input
                      type="number" min={0} step="0.0001" placeholder="0.0000"
                      value={piInput}
                      onChange={(e) => { setPiInput(e.target.value); setError(''); }}
                      style={{
                        flex: 1, background: 'transparent', border: 'none', outline: 'none',
                        fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)',
                        fontFamily: 'var(--font-mono, monospace)',
                      }}
                    />
                    <button
                      onClick={() => wallet && setPiInput(String(wallet.piBalance))}
                      style={{
                        padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                        background: 'rgba(244,160,23,0.1)', color: '#f4a017', border: 'none', cursor: 'pointer',
                        display: side === 'sell' ? 'block' : 'none',
                      }}
                    >
                      MAX
                    </button>
                  </div>
                </div>

                {/* Conversion output */}
                {piNum > 0 && (
                  <div style={{
                    padding: '12px 16px', borderRadius: '12px', marginBottom: '16px',
                    background: accentBg, border: `1px solid ${accentBorder}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 2px' }}>
                        {side === 'buy' ? 'You pay' : 'You receive'}
                      </p>
                      <p style={{ fontSize: '20px', fontWeight: 800, color: accentColor, margin: 0, fontFamily: 'var(--font-mono, monospace)' }}>
                        {currency.symbol}{fiatNet.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 2px' }}>Fee (1%)</p>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, fontFamily: 'var(--font-mono, monospace)' }}>
                        π{fee.toFixed(4)}
                      </p>
                    </div>
                  </div>
                )}

                {/* sell: wallet balance */}
                {side === 'sell' && walletLoaded && wallet && (
                  <div style={{
                    padding: '10px 14px', borderRadius: '12px', marginBottom: '16px', fontSize: '12px',
                    background: wallet.piBalance >= piNum ? 'rgba(74,222,128,0.06)' : 'rgba(239,68,68,0.06)',
                    border: `1px solid ${wallet.piBalance >= piNum ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ color: 'var(--text-muted)' }}>Available balance</span>
                    <span style={{ fontWeight: 700, color: wallet.piBalance >= piNum ? '#4ade80' : '#f87171', fontFamily: 'var(--font-mono, monospace)' }}>
                      π{wallet.piBalance.toFixed(4)}
                    </span>
                  </div>
                )}

                {/* sell: insufficient → deposit nudge */}
                {side === 'sell' && walletLoaded && wallet && piNum > 0 && wallet.piBalance < piNum && (
                  <button
                    onClick={() => setShowDeposit(true)}
                    style={{
                      width: '100%', padding: '10px', borderRadius: '12px', marginBottom: '12px',
                      background: 'rgba(244,160,23,0.1)', border: '1px solid rgba(244,160,23,0.3)',
                      color: '#f4a017', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                    }}
                  >
                    ⬇ Deposit Pi to continue
                  </button>
                )}
              </div>
            </div>

            {/* sell: payment account picker */}
            {side === 'sell' && (
              <div style={{ marginBottom: '20px' }}>
                <PaymentAccountPicker
                  selectedPaymentAccount={paymentAccount}
                  setSelectedPaymentAccount={setPaymentAccount}
                  label="Naira Receiving Account"
                  hint="We'll send Naira here after settlement"
                  required
                />
              </div>
            )}

            {/* buy: Pi wallet picker */}
            {side === 'buy' && (
              <div style={{ marginBottom: '20px' }}>
                <PiWalletPicker
                  selectedPiWalletId={piWalletId}
                  setSelectedPiWalletId={setPiWalletId}
                />
              </div>
            )}

            {/* Limits note */}
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '16px' }}>
              Limits: π{MIN_PI} – π{MAX_PI.toLocaleString()} per trade
            </p>

            {/* CTA */}
            {!isAuthenticated ? (
              <button
                onClick={() => router.push('/auth/login')}
                style={{
                  width: '100%', padding: '17px', borderRadius: '16px', fontSize: '16px', fontWeight: 800,
                  cursor: 'pointer', background: 'rgba(244,160,23,0.15)',
                  color: '#f4a017', border: '1px solid rgba(244,160,23,0.3)',
                }}
              >
                🔐 Log In to Trade
              </button>
            ) : (
              <button
                onClick={handleProceed}
                disabled={!!validationError}
                style={{
                  width: '100%', padding: '17px', borderRadius: '16px', fontSize: '16px', fontWeight: 800,
                  border: 'none', cursor: validationError ? 'not-allowed' : 'pointer',
                  background: validationError ? 'var(--bg-elevated)' : ctaBg,
                  color: validationError ? 'var(--text-muted)' : '#fff',
                  boxShadow: validationError ? 'none' : ctaShadow,
                  transition: 'all 0.2s',
                }}
              >
                {side === 'buy' ? '⚡ Buy Pi Instantly →' : '⚡ Sell Pi Instantly →'}
              </button>
            )}

            {validationError && piNum > 0 && (
              <p style={{ textAlign: 'center', fontSize: '12px', color: '#f87171', marginTop: '8px' }}>{validationError}</p>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════
            CONFIRM
        ══════════════════════════════════════════════════════════════ */}
        {step === 'confirm' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <button onClick={() => setStep('configure')} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>←</button>
              <h2 style={{ fontWeight: 800, fontSize: '18px', margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-display, Georgia, serif)' }}>
                Confirm Order
              </h2>
            </div>

            <ErrorBanner message={error} />

            {/* Summary table */}
            <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '20px' }}>
              <SummaryRow label="Action"        value={side === 'buy' ? 'Buy Pi' : 'Sell Pi'} />
              <SummaryRow label="Pi Amount"     value={`π${piNum.toFixed(4)}`} highlight />
              <SummaryRow label="Platform Fee"  value={`π${fee.toFixed(4)} (1%)`} />
              <SummaryRow label="Net Pi"        value={`π${netPi.toFixed(4)}`} />
              <SummaryRow label="Rate"          value={`${currency.symbol}${currency.rate.toLocaleString()}/π`} />
              <SummaryRow label={side === 'buy' ? 'You Pay' : 'You Receive'} value={`${currency.symbol}${fiatNet.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
              <SummaryRow label="Currency"      value={`${currency.flag} ${currency.code}`} />
              {side === 'sell' && paymentAccount && (
                <SummaryRow label="Pay To" value={`${paymentAccount.accountNumber} · ${paymentAccount.bankName ?? ''}`} last />
              )}
              {side === 'buy' && (
                <SummaryRow label="Settlement" value="Instant (< 30s)" last />
              )}
            </div>

            {/* sell: bank card */}
            {side === 'sell' && paymentAccount && (
              <div style={{
                borderRadius: '16px', padding: '18px', marginBottom: '20px',
                background: 'rgba(244,160,23,0.07)', border: '1px solid rgba(244,160,23,0.2)',
              }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#f4a017', marginBottom: '10px', letterSpacing: '0.08em' }}>
                  💳 NAIRA WILL BE SENT TO
                </p>
                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px' }}>{paymentAccount.accountName}</p>
                <p style={{ fontSize: '18px', fontWeight: 800, color: '#f4a017', fontFamily: 'var(--font-mono, monospace)', margin: '0 0 2px' }}>{paymentAccount.accountNumber}</p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>{paymentAccount.bankName}</p>
              </div>
            )}

            {/* buy: Pi wallet card */}
            {side === 'buy' && piWalletId && (
              <div style={{
                borderRadius: '16px', padding: '18px', marginBottom: '20px',
                background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)',
              }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#4ade80', marginBottom: '8px', letterSpacing: '0.08em' }}>
                  🔑 PI WILL BE SENT TO
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                  Wallet ID: {piWalletId}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setStep('configure')}
                style={{
                  flex: 1, padding: '15px', borderRadius: '14px', fontWeight: 700, fontSize: '14px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', cursor: 'pointer',
                }}
              >
                Edit
              </button>
              <button
                // onClick={handleSubmit}
                disabled={submitting}
                style={{
                  flex: 2, padding: '15px', borderRadius: '14px', fontWeight: 800, fontSize: '15px',
                  background: ctaBg, color: '#fff', border: 'none', cursor: 'pointer',
                  boxShadow: ctaShadow, transition: 'opacity 0.15s',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Submitting…' : side === 'buy' ? '⚡ Confirm Buy' : '⚡ Confirm Sell'}
              </button>
            </div>

            <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px' }}>
              By confirming you agree to the Express Trade terms.
            </p>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════
            PROCESSING
        ══════════════════════════════════════════════════════════════ */}
        {step === 'processing' && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              border: '4px solid var(--border)', borderTopColor: '#f4a017',
              margin: '0 auto 24px', animation: 'spin 0.9s linear infinite',
            }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <h3 style={{ fontWeight: 800, fontSize: '20px', color: 'var(--text-primary)', margin: '0 0 8px', fontFamily: 'var(--font-display, Georgia, serif)' }}>
              Processing Trade
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              Matching your order with the express pool…
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            DONE
        ══════════════════════════════════════════════════════════════ */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: side === 'buy' ? 'rgba(74,222,128,0.15)' : 'rgba(244,160,23,0.15)',
              margin: '0 auto 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '40px',
              animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
            }}>
              🎉
            </div>
            <style>{`@keyframes popIn{from{transform:scale(0.4);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
            <h3 style={{ fontWeight: 800, fontSize: '22px', margin: '0 0 8px', color: accentColor, fontFamily: 'var(--font-display, Georgia, serif)' }}>
              Trade Complete!
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Your {side === 'buy' ? 'Pi has been sent' : 'Naira is on its way'}.
            </p>
            {orderId && (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)', marginBottom: '28px' }}>
                Order: {orderId}
              </p>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => router.push('/p2p/orders')}
                style={{
                  padding: '12px 22px', borderRadius: '14px', fontWeight: 700, fontSize: '14px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', cursor: 'pointer',
                }}
              >
                View Orders
              </button>
              <button
                onClick={() => { setStep('configure'); setPiInput(''); setPaymentAccount(null); setPiWalletId(null); }}
                style={{
                  padding: '12px 22px', borderRadius: '14px', fontWeight: 700, fontSize: '14px',
                  background: 'rgba(244,160,23,0.12)', border: '1px solid rgba(244,160,23,0.3)',
                  color: '#f4a017', cursor: 'pointer',
                }}
              >
                Trade Again
              </button>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}