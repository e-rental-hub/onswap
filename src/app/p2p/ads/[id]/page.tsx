'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar               from '@/components/layout/Navbar';
import { DepositModal }     from '@/components/p2p/DepositModal';
import PiWalletPicker       from '@/components/p2p/PiWalletAddressPicker';
import PaymentAccountPicker from '@/components/p2p/paymentAccountPicker';
import { adsApi, ordersApi, walletApi } from '@/lib/api';
import { useAuth }          from '@/hooks/useAuth';
import {
  Ad, AdPaymentDetail, PaymentMethodDetail, PaymentMethodType,
  PAYMENT_METHOD_LABELS, WalletSummary, PiWalletAddress,
  PaymentMethodEnum,
} from '@/types';
import { logger } from '@/lib/logger';

// ─── State machine / input mode ───────────────────────────────────────────────
type Step      = 'configure' | 'summary' | 'depositing' | 'done';
type InputMode = 'pi' | 'ngn';

// ─── Sub-components ───────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      className="mb-4 px-3 py-2.5 rounded-lg text-sm"
      style={{
        background: 'rgba(239,68,68,0.1)',
        color:      '#f87171',
        border:     '1px solid rgba(239,68,68,0.2)',
      }}
    >
      {message}
    </div>
  );
}

function SummaryRow({
  label, value, mono = false, highlight = false, last = false,
}: {
  label: string; value: string;
  mono?: boolean; highlight?: boolean; last?: boolean;
}) {
  return (
    <div
      className="flex justify-between items-center px-4 py-3"
      style={{
        borderBottom: last ? 'none' : '1px solid var(--border-subtle)',
        background:   'var(--bg-elevated)',
      }}
    >
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span
        className="text-sm font-semibold"
        style={{
          color:      highlight ? 'var(--pi-gold)' : 'var(--text-primary)',
          fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        }}
      >
        {value}
      </span>
    </div>
  );
}

/** Balance badge — hidden while wallet is still loading (wallet === null) */
function WalletBalanceBadge({
  wallet,
  piRequired,
}: {
  wallet:     WalletSummary | null;
  piRequired: number;
}) {
  if (!wallet) return null;
  const sufficient = piRequired <= 0 || wallet.piBalance >= piRequired;
  const shortfall  = Math.max(0, piRequired - wallet.piBalance);
  return (
    <div
      className="rounded-xl p-3 mb-5 text-sm"
      style={{
        background: sufficient ? 'rgba(34,197,94,0.06)'  : 'rgba(239,68,68,0.06)',
        border:     `1px solid ${sufficient ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
      }}
    >
      <p
        className="text-xs font-medium mb-0.5"
        style={{ color: sufficient ? '#4ade80' : '#f87171' }}
      >
        {piRequired > 0
          ? sufficient
            ? '✅ Sufficient balance'
            : `⚠ Need ${shortfall.toFixed(4)}π more`
          : 'Your wallet balance'}
      </p>
      <p style={{ color: 'var(--text-muted)' }}>
        π{wallet.piBalance.toFixed(4)} available
      </p>
    </div>
  );
}

/**
 * Shown in sell-ad summary: tells the Pi buyer exactly where to send Naira.
 */
function SellerPaymentCard({
  detail,
  nairaAmount,
}: {
  detail:      AdPaymentDetail;
  nairaAmount: number;
}) {
  return (
    <div
      className="rounded-xl p-4 mb-5"
      style={{ background: 'rgba(240,160,60,0.07)', border: '1px solid rgba(240,160,60,0.2)' }}
    >
      <p className="text-xs font-bold mb-3" style={{ color: 'var(--pi-gold)' }}>
        💳 YOU WILL PAY TO
      </p>
      <div className="space-y-1.5 text-sm">
        {detail.accountName && (
          <p>
            <span style={{ color: 'var(--text-muted)' }}>Name: </span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {detail.accountName}
            </span>
          </p>
        )}
        {detail.accountNumber && (
          <p>
            <span style={{ color: 'var(--text-muted)' }}>Account: </span>
            <span
              style={{
                color:      'var(--pi-gold)',
                fontFamily: 'var(--font-mono)',
                fontSize:   '1rem',
                fontWeight: 700,
              }}
            >
              {detail.accountNumber}
            </span>
          </p>
        )}
        {detail.bankName && (
          <p>
            <span style={{ color: 'var(--text-muted)' }}>Bank: </span>
            <span style={{ color: 'var(--text-primary)' }}>{detail.bankName}</span>
          </p>
        )}
      </div>
      <p
        className="text-xs mt-3 p-2 rounded-lg"
        style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--text-secondary)' }}
      >
        After placing the order, Pi will be locked in escrow. Transfer exactly{' '}
        <strong style={{ color: 'var(--pi-gold)' }}>₦{nairaAmount.toLocaleString()}</strong>{' '}
        and then click "I've Paid".
      </p>
    </div>
  );
}

/**
 * Shown in buy-ad summary: confirms to the Pi seller which account
 * the ad creator (buyer) will send Naira to.
 */
function SellerAccountConfirmCard({ account }: { account: PaymentMethodDetail }) {
  return (
    <div
      className="rounded-xl p-4 mb-5"
      style={{ background: 'rgba(240,160,60,0.07)', border: '1px solid rgba(240,160,60,0.2)' }}
    >
      <p className="text-xs font-bold mb-3" style={{ color: 'var(--pi-gold)' }}>
        💳 BUYER WILL PAY TO YOUR ACCOUNT
      </p>
      <div className="space-y-1.5 text-sm">
        <p>
          <span style={{ color: 'var(--text-muted)' }}>Name: </span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {account.accountName}
          </span>
        </p>
        <p>
          <span style={{ color: 'var(--text-muted)' }}>Account: </span>
          <span
            style={{
              color:      'var(--pi-gold)',
              fontFamily: 'var(--font-mono)',
              fontSize:   '1rem',
              fontWeight: 700,
            }}
          >
            {account.accountNumber}
          </span>
        </p>
        {account.bankName && (
          <p>
            <span style={{ color: 'var(--text-muted)' }}>Bank: </span>
            <span style={{ color: 'var(--text-primary)' }}>{account.bankName}</span>
          </p>
        )}
        <p>
          <span style={{ color: 'var(--text-muted)' }}>Type: </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {PAYMENT_METHOD_LABELS[account.type]}
          </span>
        </p>
      </div>
      <p
        className="text-xs mt-3 p-2 rounded-lg"
        style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--text-secondary)' }}
      >
        The ad creator will send{' '}
        <strong style={{ color: 'var(--pi-gold)' }}>Naira</strong> to this account after you
        lock Pi in escrow. Ensure these details are correct before confirming.
      </p>
    </div>
  );
}

/** Shown in buy-ad summary: warns Pi seller their Pi will be locked. */
function EscrowLockNotice({
  piAmount,
  nairaAmount,
  balanceAfterLock,
}: {
  piAmount:         number;
  nairaAmount:      number;
  balanceAfterLock: number;
}) {
  return (
    <div
      className="rounded-xl p-4 mb-5"
      style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
    >
      <p className="text-xs font-bold mb-2" style={{ color: '#f87171' }}>
        🔒 PI WILL BE LOCKED
      </p>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        π{piAmount.toFixed(4)} will be locked from your wallet balance while waiting
        for the buyer to send ₦{nairaAmount.toLocaleString()}.
      </p>
      <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
        Wallet balance after lock: π{balanceAfterLock.toFixed(4)}
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { user, isAuthenticated, isDevMode } = useAuth();

  const [ad,             setAd]             = useState<Ad | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [step,           setStep]           = useState<Step>('configure');
  const [inputMode,      setInputMode]      = useState<InputMode>('pi');
  const [rawInput,       setRawInput]       = useState('');
  const [wallet,         setWallet]         = useState<WalletSummary | null>(null);
  const [walletLoaded,   setWalletLoaded]   = useState(false);
  const [creating,       setCreating]       = useState(false);
  const [error,          setError]          = useState('');

  // ── sell-ad viewer (buyer): which payment method type they'll use ──────────
  // The buyer pays to the ad creator's pre-set accounts, so only a type chip
  // selection is needed — not their own account details.
  const [selectedPm, setSelectedPm] = useState<PaymentMethodType>(PaymentMethodEnum.bankTransfer);

  // ── buy-ad viewer (Pi seller): their own Naira receiving account ──────────
  // The ad creator (buyer) will send Naira here.
  const [selectedSellerAccountDetail, setSelectedSellerAccountDetail] =
    useState<PaymentMethodDetail | null>(null);

  // ── Pi destination wallet (used by both flows) ────────────────────────────
  // - sell-ad viewer: Pi buyer — Pi is released TO their wallet after paying.
  // - buy-ad viewer:  Pi seller — Pi is released FROM escrow TO their wallet
  //   after the buyer's Naira is confirmed.
  // Shown in the summary step so configure stays uncluttered.
  const [selectedPiWalletId, setSelectedPiWalletId] = useState<string | null>(null);

  // ── Load ad ─────────────────────────────────────────────────────────────────
  const fetchAd = useCallback(async () => {
    try {
      const res = await adsApi.getAdById(id);
      setAd(res.data.ad);
      logger.info('Ad loaded:', res.data.ad);
      if (res.data.ad.paymentMethods && res.data.ad.paymentMethods.length === 1) {
        setSelectedPm(res.data.ad.paymentMethods[0]);
      }
    } catch (e) {
      logger.error('fetchAd error:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchWallet = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await walletApi.getBalance();
      setWallet(res.data);
    } catch (e) {
      logger.error('fetchWallet error:', e);
    } finally {
      // Always mark loaded so a null wallet doesn't prematurely
      // trigger the deposit modal in handleProceed.
      setWalletLoaded(true);
    }
  }, [isAuthenticated]);

  useEffect(() => { fetchAd(); fetchWallet(); }, [fetchAd, fetchWallet]);

  // ── Derived amounts ──────────────────────────────────────────────────────────
  const pricePerPi   = ad?.pricePerPi ?? 0;
  const rawNum       = parseFloat(rawInput) || 0;
  const piAmount     = inputMode === 'pi'  ? rawNum : rawNum / pricePerPi;
  const nairaAmount  = inputMode === 'ngn' ? rawNum : rawNum * pricePerPi;
  const piRounded    = Math.floor(piAmount  * 10000) / 10000;
  const nairaRounded = Math.round(nairaAmount * 100)  / 100;

  // ── Validation ───────────────────────────────────────────────────────────────
  function validate(): string {
    if (!ad)              return 'Ad not loaded';
    if (!isAuthenticated) return 'Log in to trade';
    if (piRounded <= 0)   return 'Enter an amount';
    if (piRounded > ad.availableAmount)
      return `Only ${ad.availableAmount}π available`;
    if (nairaRounded < ad.minLimit)
      return `Minimum is ₦${ad.minLimit.toLocaleString()}`;
    if (nairaRounded > ad.maxLimit)
      return `Maximum is ₦${ad.maxLimit.toLocaleString()}`;
    // sell-ad viewer (buyer): must choose a payment method type
    if (ad.type === 'sell' && !selectedPm)
      return 'Choose a payment method';
    // buy-ad viewer (Pi seller): must pick a Naira receiving account
    if (ad.type === 'sell' && !selectedPiWalletId)
      return 'Select a wallet to receive Pi';
    if (ad.type === 'buy' && !selectedSellerAccountDetail)
      return 'Select a payment account to receive Naira';      
    return '';
  }

  // Pi wallet required at order creation for both flows.
  // function validatePiWallet(): string {
  //   if (isSellAd && !selectedPiWalletId) return 'Select or add a Pi wallet address to receive Pi';
  //   return '';
  // }

  const validationError = validate();

  const isOwn = !isDevMode && !!user && !!ad && (
    ad.creator.id === user.id ||
    (ad.creator as unknown as { _id: string })._id === user.id
  );

  // ── Proceed to summary ───────────────────────────────────────────────────────
  const handleProceed = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');

    // buy-ad: viewer is Pi seller — they must have sufficient in-app balance.
    // Guard against acting on a null wallet while it's still loading.
    if (ad!.type === 'buy') {
      if (!walletLoaded) {
        setError('Checking your wallet balance…');
        return;
      }
      if (!wallet || wallet.piBalance < piRounded) {
        setStep('depositing');
        return;
      }
    }

    setStep('summary');
  };

  // ── Create order ─────────────────────────────────────────────────────────────
  const handleCreateOrder = async () => {
    const err = validate();
    if (err) { setError(err); return; }

    // const walletErr = validatePiWallet();
    // if (walletErr) { setError(walletErr); return; }

    setCreating(true);
    setError('');
    try {
      const res = await ordersApi.createOrder({
        adId:          id,
        piAmount:      piRounded,
        // For buy-ads use the selected account's type; for sell-ads use the chosen chip.
        paymentMethod: selectedPm,
        // buy-ad only: the Pi seller's Naira receiving account details.
        sellerAccountDetailId: isBuyAd ? selectedSellerAccountDetail?._id : undefined,
        // Pi is released to this wallet on trade completion.
        buyerWalletAddressId: isSellAd ? selectedPiWalletId as string : undefined,
      });
      setStep('done');
      logger.info(`Order created: ${res.data.order._id}`);
      setTimeout(() => router.push(`/p2p/orders/${res.data.order._id}`), 1200);
    } catch (err: unknown) {
      const data = (err as {
        response?: { data?: { message?: string; needsDeposit?: boolean } };
      })?.response?.data;
      if (data?.needsDeposit) {
        setStep('depositing');
      } else {
        setError(data?.message ?? 'Failed to create order');
        setStep('configure');
      }
      logger.error('createOrder error:', err);
    } finally {
      setCreating(false);
    }
  };

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="card p-8 animate-pulse space-y-4">
          {[40, 24, 32, 20].map((h, i) => (
            <div
              key={i}
              className="rounded-lg"
              style={{
                height:     h,
                background: 'var(--bg-elevated)',
                width:      i % 2 === 0 ? '60%' : '40%',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  if (!ad) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />
      <div className="flex items-center justify-center h-64">
        <p style={{ color: 'var(--text-muted)' }}>Ad not found.</p>
      </div>
    </div>
  );

  const isBuyAd  = ad.type === 'buy';   // ad creator wants to buy Pi  → viewer sells Pi
  const isSellAd = ad.type === 'sell';  // ad creator wants to sell Pi → viewer buys Pi

  const actionLabel = isBuyAd ? 'Sell Pi'    : 'Buy Pi';
  const ctaColor    = isBuyAd ? 'btn-sell'   : 'btn-buy';
  const accentColor = isBuyAd ? '#f87171'    : '#4ade80';
  const badgeClass  = isBuyAd ? 'badge-buy' : 'badge-sell';

  // sell-ad summary: the ad creator's payment detail that matches the viewer's choice
  const matchedDetail: AdPaymentDetail | undefined = isSellAd
    ? ad.sellerAccountDetail
    : selectedSellerAccountDetail as PaymentMethodDetail;

  // Deposit suggestion: shortfall grossed up for the 1 % fee
  const piShortfall      = Math.max(0, piRounded - (wallet?.piBalance ?? 0));
  const suggestedDeposit = Math.ceil((piShortfall / (1 - 0.01)) * 10000) / 10000;

  // Label shown in the summary table's "Payment" row
  const summaryPaymentLabel = isBuyAd && selectedSellerAccountDetail
    ? PAYMENT_METHOD_LABELS[selectedSellerAccountDetail.type]
    : (PAYMENT_METHOD_LABELS[selectedPm as PaymentMethodType] ?? '—');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />

      {/* ── Deposit modal (buy-ad, insufficient balance) ──────────────────── */}
      {step === 'depositing' && (
        <DepositModal
          accessToken={user?.piUid ?? null}
          suggestedAmount={suggestedDeposit}
          onDepositComplete={(newBal) => {
            setWallet((w) => w ? { ...w, piBalance: newBal } : w);
            if (newBal >= piRounded) setStep('summary');
            // Still insufficient → modal stays open
          }}
          onClose={() => setStep('configure')}
          showToast={(msg) => setError(msg)}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        <button
          onClick={() => router.back()}
          className="text-sm mb-6 flex items-center gap-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          ← Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ════════════════════════════════════════════════════════════════
              LEFT — Ad info
          ════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-3 space-y-4">

            {/* Header card */}
            <div className="card p-6">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center font-bold"
                    style={{
                      background: 'rgba(240,160,60,0.12)',
                      border:     '1px solid rgba(240,160,60,0.2)',
                      color:      'var(--pi-gold)',
                    }}
                  >
                    {ad.creator.displayName?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="font-semibold text-sm"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {ad.creator.displayName}
                      </span>
                      {ad.creator.kycVerified && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{
                            background: 'rgba(34,197,94,0.1)',
                            color:      '#4ade80',
                            border:     '1px solid rgba(34,197,94,0.2)',
                          }}
                        >
                          ✓ KYC
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      ⭐ {ad.creator.rating?.toFixed(1)} · {ad.creator.totalTrades} trades ·{' '}
                      {ad.creator.completionRate}% completion
                    </p>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeClass}`}>
                  {ad.type.toUpperCase()} AD
                </span>
              </div>

              {/* Price */}
              <div className="mb-5">
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  PRICE PER π
                </p>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-4xl font-bold pi-text"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    ₦{ad.pricePerPi.toLocaleString()}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>/π</span>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Available',  value: `π${ad.availableAmount.toLocaleString()}`, color: 'var(--pi-gold)' },
                  { label: 'Min (₦)',    value: `₦${ad.minLimit.toLocaleString()}`,         color: 'var(--text-primary)' },
                  { label: 'Max (₦)',    value: `₦${ad.maxLimit.toLocaleString()}`,         color: 'var(--text-primary)' },
                  { label: 'Pay Window', value: `${ad.paymentWindow} min`,                  color: 'var(--text-primary)' },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl p-3 text-center"
                    style={{ background: 'var(--bg-elevated)' }}
                  >
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                      {s.label}
                    </p>
                    <p
                      className="font-bold text-sm"
                      style={{ color: s.color, fontFamily: 'var(--font-mono)' }}
                    >
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Payment methods */}
              <div className="mt-5">
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                  PAYMENT METHODS
                </p>
                <div className="flex flex-wrap gap-2">
                  {ad.paymentMethods.map((pm) => (
                    <span
                      key={pm}
                      className="text-xs px-3 py-1.5 rounded-lg border"
                      style={{
                        background:  'rgba(240,160,60,0.07)',
                        color:       'var(--text-secondary)',
                        borderColor: 'rgba(240,160,60,0.15)',
                      }}
                    >
                      {PAYMENT_METHOD_LABELS[pm]}
                    </span>
                  ))}
                </div>
              </div>

              {/* Terms */}
              {ad.terms && (
                <div
                  className="mt-5 rounded-xl p-4"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                >
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                    TERMS
                  </p>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {ad.terms}
                  </p>
                </div>
              )}
            </div>

            {/* sell-ad: show seller's accounts upfront so buyer can verify */}
            {isSellAd && ad.sellerAccountDetail && (
              <div className="card p-6">
                <p className="text-xs font-medium mb-4" style={{ color: 'var(--text-muted)' }}>
                  SELLER PAYMENT ACCOUNTS
                </p>
                <div className="space-y-3">
                  <div
                    className="rounded-xl p-4"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-xs px-2 py-0.5 rounded font-medium"
                        style={{ background: 'rgba(240,160,60,0.12)', color: 'var(--pi-gold)' }}
                      >
                        {PAYMENT_METHOD_LABELS[ad.sellerAccountDetail.type]}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm">
                      {ad.sellerAccountDetail.accountName   && <p><span style={{ color: 'var(--text-muted)' }}>Name: </span><span style={{ color: 'var(--text-primary)' }}>{ad.sellerAccountDetail.accountName}</span></p>}
                      {ad.sellerAccountDetail.accountNumber && <p><span style={{ color: 'var(--text-muted)' }}>Account: </span><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--pi-gold)' }}>{ad.sellerAccountDetail.accountNumber}</span></p>}
                      {ad.sellerAccountDetail.bankName      && <p><span style={{ color: 'var(--text-muted)' }}>Bank: </span><span style={{ color: 'var(--text-primary)' }}>{ad.sellerAccountDetail.bankName}</span></p>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════════
              RIGHT — Trade box
          ════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-2">
            <div className="card p-6 sticky top-24">

              {/* Own ad */}
              {isOwn && (
                <div className="text-center py-10">
                  <p className="text-3xl mb-3">🚫</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    This is your own ad.
                  </p>
                </div>
              )}

              {/* Not logged in */}
              {!isOwn && !isAuthenticated && (
                <div className="text-center py-10">
                  <p className="text-3xl mb-3">🔐</p>
                  <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                    Log in to trade Pi.
                  </p>
                  <button
                    onClick={() => router.push('/auth/login')}
                    className="btn-pi px-6 py-2.5 rounded-xl"
                  >
                    Log In
                  </button>
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════
                  CONFIGURE STEP
                  ─ sell-ad viewer (buyer): pick payment method type
                  ─ buy-ad viewer (Pi seller): pick their Naira account
                  Pi wallet is collected in the summary step (both flows).
              ══════════════════════════════════════════════════════════ */}
              {!isOwn && isAuthenticated && step === 'configure' && (
                <>
                  <h2
                    className="font-bold text-lg mb-5"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {actionLabel}
                  </h2>

                  <ErrorBanner message={error} />

                  {/* Input mode toggle */}
                  <div
                    className="flex rounded-xl p-1 mb-4"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                  >
                    {(['pi', 'ngn'] as InputMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => { setInputMode(mode); setRawInput(''); }}
                        className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                        style={{
                          background: inputMode === mode ? 'var(--bg-card)'      : 'transparent',
                          color:      inputMode === mode ? 'var(--text-primary)' : 'var(--text-muted)',
                          border:     inputMode === mode ? '1px solid var(--border)' : '1px solid transparent',
                        }}
                      >
                        {mode === 'pi' ? 'Enter π' : 'Enter ₦'}
                      </button>
                    ))}
                  </div>

                  {/* Amount input */}
                  <div
                    className="flex items-center rounded-xl overflow-hidden"
                    style={{
                      border: '1px solid var(--border)',
                      background: 'var(--bg-input)',
                    }}
                  >
                    <div
                      className="px-3 font-bold text-sm flex-shrink-0"
                      style={{
                        color: inputMode === 'pi'
                          ? 'var(--pi-gold)'
                          : 'var(--text-secondary)',
                      }}
                    >
                      {inputMode === 'pi' ? 'π' : '₦'}
                    </div>

                    <input
                      className="input-dark border-0 rounded-none flex-1 text-base font-semibold"
                      type="number"
                      step={inputMode === 'pi' ? '0.0001' : '1'}
                      min={0}
                      placeholder={inputMode === 'pi' ? '0.0000' : '0'}
                      value={rawInput}
                      onChange={(e) => {
                        setRawInput(e.target.value);
                        setError('');
                      }}
                    />
                  </div>

                  {/* Live conversion */}
                  {rawNum > 0 && (
                    <div
                      className="rounded-xl p-3 mb-4 text-sm space-y-1.5"
                      style={{
                        background: 'rgba(240,160,60,0.06)',
                        border:     '1px solid rgba(240,160,60,0.15)',
                      }}
                    >
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--text-muted)' }}>Pi amount</span>
                        <span style={{ color: 'var(--pi-gold)', fontFamily: 'var(--font-mono)' }}>
                          π{piRounded.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--text-muted)' }}>Naira amount</span>
                        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                          ₦{nairaRounded.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--text-muted)' }}>Rate</span>
                        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          ₦{pricePerPi.toLocaleString()}/π
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Remaining / limits */}
                  <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                    {ad.availableAmount.toFixed(4)}π remaining · Limit ₦{ad.minLimit.toLocaleString()}–₦{ad.maxLimit.toLocaleString()}
                  </p>

                  {/* sell-ad: buyer picks a payment method type */}
                  {isSellAd && (
                    <div className="mb-5">
                      <label
                        className="block text-xs font-medium mb-2"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Payment Method
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {ad.paymentMethods.map((pm) => {
                          const active = selectedPm === pm;
                          return (
                            <button
                              key={pm}
                              type="button"
                              onClick={() => setSelectedPm(pm)}
                              className="px-3 py-2 rounded-lg border text-sm transition-all"
                              style={{
                                background:  active ? 'rgba(240,160,60,0.15)' : 'var(--bg-elevated)',
                                color:       active ? 'var(--pi-gold)'         : 'var(--text-secondary)',
                                borderColor: active ? 'rgba(240,160,60,0.4)'   : 'var(--border)',
                              }}
                            >
                              {active && '✓ '}{PAYMENT_METHOD_LABELS[pm]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* buy-ad: Pi seller picks their Naira receiving account */}
                  {isBuyAd ?
                  (
                    <div className="mb-5">
                      <PaymentAccountPicker
                        selectedPaymentAccount={selectedSellerAccountDetail}
                        setSelectedPaymentAccount={setSelectedSellerAccountDetail}
                        label="Your Naira Receiving Account"
                        hint="Buyer sends Naira here"
                        required
                      />
                    </div>
                  ) : (
                    <div className="mb-5">
                      <PiWalletPicker
                        selectedPiWalletId={selectedPiWalletId}
                        setSelectedPiWalletId={setSelectedPiWalletId}
                      />
                    </div>
                  )}

                  {/* buy-ad: balance check (shown only after wallet has loaded) */}
                  {isBuyAd && (
                    <WalletBalanceBadge
                      wallet={walletLoaded ? wallet : null}
                      piRequired={piRounded}
                    />
                  )}

                  {/* CTA */}
                  <button
                    onClick={handleProceed}
                    disabled={!!validationError}
                    className={`${ctaColor} w-full py-3.5 rounded-xl font-bold text-base`}
                  >
                    {isBuyAd ? 'Proceed to Sell →' : 'Proceed to Buy →'}
                  </button>

                  {validationError && rawNum > 0 && (
                    <p className="text-xs text-center mt-2" style={{ color: '#f87171' }}>
                      {validationError}
                    </p>
                  )}
                </>
              )}

              {/* ══════════════════════════════════════════════════════════
                  SUMMARY STEP
                  ─ Review amounts
                  ─ sell-ad: show seller account to pay, collect Pi wallet
                  ─ buy-ad: confirm Pi seller's account, escrow notice,
                             collect Pi wallet
              ══════════════════════════════════════════════════════════ */}
              {!isOwn && isAuthenticated && step === 'summary' && (
                <>
                  <div className="flex items-center gap-2 mb-5">
                    <button
                      onClick={() => setStep('configure')}
                      className="text-sm"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      ←
                    </button>
                    <h2
                      className="font-bold text-lg"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      Order Summary
                    </h2>
                  </div>

                  <ErrorBanner message={error} />

                  {/* Amounts table */}
                  <div
                    className="rounded-xl overflow-hidden mb-5"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    <SummaryRow label="Pi Amount"    value={`π${piRounded.toFixed(4)}`}         mono highlight />
                    <SummaryRow label="Naira Amount" value={`₦${nairaRounded.toLocaleString()}`} mono />
                    <SummaryRow label="Rate"         value={`₦${pricePerPi.toLocaleString()}/π`} />
                    <SummaryRow label="Payment"      value={summaryPaymentLabel} />
                    <SummaryRow label="Pay Window"   value={`${ad.paymentWindow} min`}           last />
                  </div>

                  {/* sell-ad: where the Pi buyer sends Naira */}
                  {isSellAd && matchedDetail && (
                    <SellerPaymentCard detail={matchedDetail} nairaAmount={nairaRounded} />
                  )}

                  {/* buy-ad: confirm the Pi seller's Naira account */}
                  {isBuyAd && selectedSellerAccountDetail && (
                    <SellerAccountConfirmCard account={selectedSellerAccountDetail} />
                  )}

                  {/* buy-ad: escrow lock warning */}
                  {isBuyAd && (
                    <EscrowLockNotice
                      piAmount={piRounded}
                      nairaAmount={nairaRounded}
                      balanceAfterLock={(wallet?.piBalance ?? 0) - piRounded}
                    />
                  )}

                  {/* Confirm button */}
                  <button
                    onClick={handleCreateOrder}
                    disabled={creating}
                    className={`${ctaColor} w-full py-3.5 rounded-xl font-bold text-base`}
                  >
                    {creating
                      ? 'Creating order…'
                      : isBuyAd
                      ? '🔒 Lock Pi & Notify Buyer'
                      : '💳 Place Order'}
                  </button>

                  <p
                    className="text-xs text-center mt-3"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    By confirming, you agree to complete the trade within{' '}
                    {ad.paymentWindow} minutes.
                  </p>
                </>
              )}

              {/* ── DONE ── */}
              {step === 'done' && (
                <div className="text-center py-10">
                  <div className="text-5xl mb-4">🎉</div>
                  <h3
                    className="font-bold text-lg mb-2"
                    style={{ color: accentColor }}
                  >
                    Order Created!
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Redirecting to your order…
                  </p>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}