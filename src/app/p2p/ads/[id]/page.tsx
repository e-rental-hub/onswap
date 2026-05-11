'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar         from '@/components/layout/Navbar';
import { DepositModal } from '@/components/p2p/DepositModal';
import { adsApi, ordersApi, walletApi, piWalletsApi } from '@/lib/api';
import { useAuth }    from '@/hooks/useAuth';
import {
  Ad, AdPaymentDetail, PaymentMethodType,
  PAYMENT_METHOD_LABELS, WalletSummary, PiWalletAddress,
} from '@/types';
import { logger } from '@/lib/logger';

// ─── View state machine ───────────────────────────────────────────────────────
// configure  — user entering Pi / Naira amount + choosing payment method
// summary    — pre-trade summary, confirm to create order
// depositing — deposit modal open (buy-ad flow, insufficient balance)
// done       — order created, redirect pending

type Step = 'configure' | 'summary' | 'depositing' | 'done';

// ─── Input mode ───────────────────────────────────────────────────────────────
type InputMode = 'pi' | 'ngn';

// ─── InlineWalletForm ─────────────────────────────────────────────────────────
// Shared sub-component used both when user has no saved wallets (standalone)
// and when adding a new wallet to an existing list (with cancel).

interface InlineWalletFormProps {
  newWalletAddr:    string;
  setNewWalletAddr: (v: string) => void;
  newWalletTag:     string;
  setNewWalletTag:  (v: string) => void;
  stellarRe:        RegExp;
  saving:           boolean;
  onCancel:         (() => void) | undefined;
  onSave:           (() => Promise<void>) | undefined;
}

function InlineWalletForm({
  newWalletAddr, setNewWalletAddr,
  newWalletTag,  setNewWalletTag,
  stellarRe, saving, onCancel, onSave,
}: InlineWalletFormProps) {
  const addrValid = stellarRe.test(newWalletAddr.trim());
  const canSave   = !!newWalletTag.trim() && addrValid;

  return (
    <div className="rounded-xl p-4 space-y-3"
      style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(240,160,60,0.2)' }}>
      {onCancel && (
        <div className="flex justify-between items-center">
          <p className="text-xs font-semibold" style={{ color: 'var(--pi-gold)' }}>New Wallet Address</p>
          <button type="button" onClick={onCancel}
            className="text-xs" style={{ color: 'var(--text-muted)' }}>Cancel</button>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
          Tag / Label *
        </label>
        <input className="input-dark text-sm w-full"
          placeholder="e.g. My Pi Wallet, Main Wallet"
          value={newWalletTag}
          onChange={(e) => setNewWalletTag(e.target.value)} />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
          Pi Wallet Address (G…) *
        </label>
        <input
          className="input-dark text-sm w-full"
          style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}
          placeholder="G… (56 characters)"
          maxLength={56}
          spellCheck={false}
          value={newWalletAddr}
          onChange={(e) => setNewWalletAddr(e.target.value.trim())}
        />
        {newWalletAddr && !addrValid && (
          <p className="text-xs mt-1" style={{ color: '#f87171' }}>
            Must start with G and be exactly 56 characters
          </p>
        )}
        {newWalletAddr && addrValid && (
          <p className="text-xs mt-1" style={{ color: '#4ade80' }}>✓ Valid Pi wallet address</p>
        )}
      </div>

      {onSave && (
        <button type="button" onClick={onSave}
          disabled={saving || !canSave}
          className="btn-pi w-full py-2 rounded-xl text-sm">
          {saving ? 'Saving…' : 'Save & Select'}
        </button>
      )}
    </div>
  );
}

export default function AdDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { user, isAuthenticated, isDevMode } = useAuth();

  const [ad,          setAd]          = useState<Ad | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [step,        setStep]        = useState<Step>('configure');
  const [inputMode,   setInputMode]   = useState<InputMode>('pi');
  const [rawInput,    setRawInput]    = useState('');
  const [selectedPm,  setSelectedPm]  = useState<PaymentMethodType | ''>('');
  const [wallet,      setWallet]      = useState<WalletSummary | null>(null);
  const [creating,       setCreating]       = useState(false);
  const [error,          setError]          = useState('');
  // Pi wallet address selection for order creation
  const [savedWallets,   setSavedWallets]   = useState<PiWalletAddress[]>([]);
  const [loadingWallets, setLoadingWallets] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState('');
  // Inline add-new-wallet state
  const [showNewWallet,  setShowNewWallet]  = useState(false);
  const [newWalletAddr,  setNewWalletAddr]  = useState('');
  const [newWalletTag,   setNewWalletTag]   = useState('');
  const [savingWallet,   setSavingWallet]   = useState(false);

  const STELLAR_RE = /^G[A-Z2-7]{55}$/;

  // ── Load ad ─────────────────────────────────────────────────────────────────
  const fetchAd = useCallback(async () => {
    try {
      const res = await adsApi.getAdById(id);
      setAd(res.data.ad);
      // Pre-select payment method if only one option
      if (res.data.ad.paymentMethods.length === 1) {
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
    }
  }, [isAuthenticated]);

  const fetchSavedWallets = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingWallets(true);
    try {
      const res = await piWalletsApi.getAll();
      const wallets = res.data.piWalletAddresses;
      setSavedWallets(wallets);
      // Auto-select default wallet
      const def = wallets.find((w) => w.isDefault) ?? wallets[0];
      if (def) setSelectedWalletId(def._id);
    } catch (e) {
      logger.error('fetchSavedWallets error:', e);
    } finally {
      setLoadingWallets(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { fetchAd(); fetchWallet(); fetchSavedWallets(); }, [fetchAd, fetchWallet, fetchSavedWallets]);

  // ── Derived amounts ──────────────────────────────────────────────────────────
  const pricePerPi  = ad?.pricePerPi ?? 0;
  const rawNum      = parseFloat(rawInput) || 0;
  const piAmount    = inputMode === 'pi'  ? rawNum : rawNum / pricePerPi;
  const nairaAmount = inputMode === 'ngn' ? rawNum : rawNum * pricePerPi;

  // Round for display / submission
  const piRounded    = Math.floor(piAmount * 10000) / 10000;
  const nairaRounded = Math.round(nairaAmount * 100) / 100;

  // ── Validation ───────────────────────────────────────────────────────────────
  function validate(): string {
    if (!ad) return 'Ad not loaded';
    if (!isAuthenticated) return 'Log in to trade';
    if (piRounded <= 0) return 'Enter an amount';
    if (piRounded > ad.availableAmount) return `Only ${ad.availableAmount}π available`;
    if (nairaRounded < ad.minLimit) return `Minimum is ₦${ad.minLimit.toLocaleString()}`;
    if (nairaRounded > ad.maxLimit) return `Maximum is ₦${ad.maxLimit.toLocaleString()}`;
    if (!selectedPm) return 'Choose a payment method';
    return '';
  }

  function validateWalletSelection(): string {
    if (!selectedWalletId && savedWallets.length > 0) return 'Select a Pi wallet to receive Pi';
    if (savedWallets.length === 0 && !newWalletAddr.trim()) return 'Add a Pi wallet address to receive Pi';
    if (savedWallets.length === 0 && newWalletAddr.trim() && !STELLAR_RE.test(newWalletAddr.trim())) {
      return 'Invalid Pi wallet address';
    }
    return '';
  }

  /** The wallet address that will actually be submitted with the order */
  const resolvedWalletAddress = selectedWalletId
    ? savedWallets.find((w) => w._id === selectedWalletId)?.address ?? ''
    : newWalletAddr.trim();

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

    // const walErr = validateWalletSelection();
    // if (walErr) { setError(walErr); return; }

    // Buy-ad: current user is the Pi seller — check their in-app balance
    if (ad!.type === 'buy') {
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
    setCreating(true);
    setError('');
    try {
      // Save the new wallet if user typed one inline (no saved wallets)
      if (savedWallets.length === 0 && newWalletAddr.trim() && STELLAR_RE.test(newWalletAddr.trim())) {
        try {
          await piWalletsApi.add({
            address:   newWalletAddr.trim(),
            tag:       newWalletTag.trim() || 'My Pi Wallet',
            isDefault: true,
          });
        } catch {
          logger.warn('Could not save new wallet address to profile');
        }
      }

      const res = await ordersApi.createOrder({
        adId:               id,
        piAmount:           piRounded,
        paymentMethod:      selectedPm as string,
        buyerWalletAddress: resolvedWalletAddress,
      });
      setStep('done');
      logger.info(`Order created: ${res.data.order._id}`);
      setTimeout(() => router.push(`/p2p/orders/${res.data.order._id}`), 1200);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string; needsDeposit?: boolean } } })?.response?.data;
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
            <div key={i} className="rounded-lg" style={{ height: h, background: 'var(--bg-elevated)', width: i % 2 === 0 ? '60%' : '40%' }} />
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

  const isBuyAd  = ad.type === 'buy';   // ad creator wants to buy Pi
  const isSellAd = ad.type === 'sell';  // ad creator wants to sell Pi

  // Action labels from the viewer's perspective
  const actionLabel  = isBuyAd ? 'Sell Pi'     : 'Buy Pi';
  const ctaColor     = isBuyAd ? 'btn-sell'    : 'btn-buy';
  const accentColor  = isBuyAd ? '#f87171'     : '#4ade80';
  const badgeClass   = isBuyAd ? 'badge-sell'  : 'badge-buy';

  // Payment detail to show in summary (for sell ads — buyer pays seller's account)
  const matchedDetail: AdPaymentDetail | undefined = isSellAd
    ? ad.paymentDetails.find((d) => d.type === selectedPm)
    : undefined;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />

      {/* Deposit modal — triggered when buy-ad user has insufficient balance */}
      {step === 'depositing' && (
        <DepositModal
          accessToken={user?.piUid ?? null}
          suggestedAmount={Math.ceil(((piRounded - (wallet?.piBalance ?? 0)) / (1 - 0.01)) * 10000) / 10000}
          onDepositComplete={(newBal) => {
            setWallet((w) => w ? { ...w, piBalance: newBal } : w);
            // If now sufficient, go to summary; else keep modal open
            if (newBal >= piRounded) {
              setStep('summary');
            }
          }}
          onClose={() => setStep('configure')}
          showToast={(msg) => setError(msg)}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        <button onClick={() => router.back()} className="text-sm mb-6 flex items-center gap-1"
          style={{ color: 'var(--text-secondary)' }}>
          ← Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ══════════════════════════════════════════════════════════════
              LEFT — Ad info
          ══════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-3 space-y-4">

            {/* Header card */}
            <div className="card p-6">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold"
                    style={{ background: 'rgba(240,160,60,0.12)', border: '1px solid rgba(240,160,60,0.2)', color: 'var(--pi-gold)' }}>
                    {ad.creator.displayName?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                        {ad.creator.displayName}
                      </span>
                      {ad.creator.kycVerified && (
                        <span className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>
                          ✓ KYC
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      ⭐ {ad.creator.rating?.toFixed(1)} · {ad.creator.totalTrades} trades · {ad.creator.completionRate}% completion
                    </p>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeClass}`}>
                  {ad.type.toUpperCase()}
                </span>
              </div>

              {/* Price */}
              <div className="mb-5">
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>PRICE PER π</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold pi-text" style={{ fontFamily: 'var(--font-display)' }}>
                    ₦{ad.pricePerPi.toLocaleString()}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>/π</span>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Available',    value: `π${ad.availableAmount.toLocaleString()}`,  color: 'var(--pi-gold)' },
                  { label: 'Min (₦)',      value: `₦${ad.minLimit.toLocaleString()}`,          color: 'var(--text-primary)' },
                  { label: 'Max (₦)',      value: `₦${ad.maxLimit.toLocaleString()}`,          color: 'var(--text-primary)' },
                  { label: 'Pay Window',   value: `${ad.paymentWindow} min`,                   color: 'var(--text-primary)' },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl p-3 text-center"
                    style={{ background: 'var(--bg-elevated)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                    <p className="font-bold text-sm" style={{ color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Payment methods */}
              <div className="mt-5">
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>PAYMENT METHODS</p>
                <div className="flex flex-wrap gap-2">
                  {ad.paymentMethods.map((pm) => (
                    <span key={pm} className="text-xs px-3 py-1.5 rounded-lg border"
                      style={{ background: 'rgba(240,160,60,0.07)', color: 'var(--text-secondary)', borderColor: 'rgba(240,160,60,0.15)' }}>
                      {PAYMENT_METHOD_LABELS[pm]}
                    </span>
                  ))}
                </div>
              </div>

              {/* Terms */}
              {ad.terms && (
                <div className="mt-5 rounded-xl p-4"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>TERMS</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{ad.terms}</p>
                </div>
              )}
            </div>

            {/* Sell-ad: show seller's account details (visible to buyers upfront) */}
            {isSellAd && ad.paymentDetails.length > 0 && (
              <div className="card p-6">
                <p className="text-xs font-medium mb-4" style={{ color: 'var(--text-muted)' }}>
                  SELLER PAYMENT ACCOUNTS
                </p>
                <div className="space-y-3">
                  {ad.paymentDetails.map((d, i) => (
                    <div key={i} className="rounded-xl p-4"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs px-2 py-0.5 rounded font-medium"
                          style={{ background: 'rgba(240,160,60,0.12)', color: 'var(--pi-gold)' }}>
                          {PAYMENT_METHOD_LABELS[d.type]}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm">
                        {d.accountName   && <p><span style={{ color: 'var(--text-muted)' }}>Name: </span><span style={{ color: 'var(--text-primary)' }}>{d.accountName}</span></p>}
                        {d.accountNumber && <p><span style={{ color: 'var(--text-muted)' }}>Account: </span><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--pi-gold)' }}>{d.accountNumber}</span></p>}
                        {d.bankName      && <p><span style={{ color: 'var(--text-muted)' }}>Bank: </span><span style={{ color: 'var(--text-primary)' }}>{d.bankName}</span></p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════
              RIGHT — Trade box
          ══════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-2">
            <div className="card p-6 sticky top-24">

              {/* Own ad — no self-trade */}
              {isOwn && (
                <div className="text-center py-10">
                  <p className="text-3xl mb-3">🚫</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>This is your own ad.</p>
                </div>
              )}

              {/* Not logged in */}
              {!isOwn && !isAuthenticated && (
                <div className="text-center py-10">
                  <p className="text-3xl mb-3">🔐</p>
                  <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Log in to trade Pi.</p>
                  <button onClick={() => router.push('/auth/login')} className="btn-pi px-6 py-2.5 rounded-xl">
                    Log In
                  </button>
                </div>
              )}

              {/* ── CONFIGURE step ── */}
              {!isOwn && isAuthenticated && step === 'configure' && (
                <>
                  <h2 className="font-bold text-lg mb-5" style={{ fontFamily: 'var(--font-display)' }}>
                    {actionLabel}
                  </h2>

                  {error && (
                    <div className="mb-4 px-3 py-2.5 rounded-lg text-sm"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                      {error}
                    </div>
                  )}

                  {/* Input mode toggle */}
                  <div className="flex rounded-xl p-1 mb-4"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    {(['pi', 'ngn'] as InputMode[]).map((mode) => (
                      <button key={mode} type="button"
                        onClick={() => { setInputMode(mode); setRawInput(''); }}
                        className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                        style={{
                          background: inputMode === mode ? 'var(--bg-card)' : 'transparent',
                          color:      inputMode === mode ? 'var(--text-primary)' : 'var(--text-muted)',
                          border:     inputMode === mode ? '1px solid var(--border)' : '1px solid transparent',
                        }}>
                        {mode === 'pi' ? 'Enter π' : 'Enter ₦'}
                      </button>
                    ))}
                  </div>

                  {/* Amount input */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                      {inputMode === 'pi' ? 'Pi Amount' : 'Naira Amount'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-sm"
                        style={{ color: inputMode === 'pi' ? 'var(--pi-gold)' : 'var(--text-secondary)' }}>
                        {inputMode === 'pi' ? 'π' : '₦'}
                      </span>
                      <input
                        className="input-dark pl-8 pr-3 text-base font-semibold w-full"
                        type="number"
                        step={inputMode === 'pi' ? '0.0001' : '1'}
                        min={0}
                        placeholder={inputMode === 'pi' ? '0.0000' : '0'}
                        value={rawInput}
                        onChange={(e) => { setRawInput(e.target.value); setError(''); }}
                      />
                    </div>
                  </div>

                  {/* Live conversion */}
                  {rawNum > 0 && (
                    <div className="rounded-xl p-3 mb-4 text-sm space-y-1.5"
                      style={{ background: 'rgba(240,160,60,0.06)', border: '1px solid rgba(240,160,60,0.15)' }}>
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--text-muted)' }}>Pi amount</span>
                        <span style={{ color: 'var(--pi-gold)', fontFamily: 'var(--font-mono)' }}>π{piRounded.toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--text-muted)' }}>Naira amount</span>
                        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>₦{nairaRounded.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--text-muted)' }}>Rate</span>
                        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>₦{pricePerPi.toLocaleString()}/π</span>
                      </div>
                    </div>
                  )}

                  {/* Remaining in ad */}
                  <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                    {ad.availableAmount.toFixed(4)}π remaining · Limit ₦{ad.minLimit.toLocaleString()}–₦{ad.maxLimit.toLocaleString()}
                  </p>

                  {/* Payment method */}
                  <div className="mb-5">
                    <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                      Payment Method
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ad.paymentMethods.map((pm) => {
                        const active = selectedPm === pm;
                        return (
                          <button key={pm} type="button"
                            onClick={() => setSelectedPm(pm)}
                            className="px-3 py-2 rounded-lg border text-sm transition-all"
                            style={{
                              background:  active ? 'rgba(240,160,60,0.15)' : 'var(--bg-elevated)',
                              color:       active ? 'var(--pi-gold)'         : 'var(--text-secondary)',
                              borderColor: active ? 'rgba(240,160,60,0.4)'   : 'var(--border)',
                            }}>
                            {active && '✓ '}{PAYMENT_METHOD_LABELS[pm]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Buy-ad: show current wallet balance */}
                  {isBuyAd && wallet && (
                    <div className="rounded-xl p-3 mb-5 text-sm"
                      style={{
                        background:  wallet.piBalance >= piRounded && piRounded > 0 ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                        border:      `1px solid ${wallet.piBalance >= piRounded && piRounded > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                      }}>
                      <p className="text-xs font-medium mb-0.5"
                        style={{ color: wallet.piBalance >= piRounded && piRounded > 0 ? '#4ade80' : '#f87171' }}>
                        {piRounded > 0
                          ? wallet.piBalance >= piRounded
                            ? '✅ Sufficient balance'
                            : `⚠ Need ${(piRounded - wallet.piBalance).toFixed(4)}π more`
                          : 'Your wallet balance'}
                      </p>
                      <p style={{ color: 'var(--text-muted)' }}>
                        π{wallet.piBalance.toFixed(4)} available
                      </p>
                    </div>
                  )}

                  {/* CTA */}
                  <button
                    onClick={handleProceed}
                    disabled={!!validationError}
                    className={`${ctaColor} w-full py-3.5 rounded-xl font-bold text-base`}>
                    {isBuyAd ? 'Proceed to Sell →' : 'Proceed to Buy →'}
                  </button>

                  {validationError && rawNum > 0 && (
                    <p className="text-xs text-center mt-2" style={{ color: '#f87171' }}>{validationError}</p>
                  )}
                </>
              )}

              {/* ── SUMMARY step ── */}
              {!isOwn && isAuthenticated && step === 'summary' && (
                <>
                  <div className="flex items-center gap-2 mb-5">
                    <button onClick={() => setStep('configure')} className="text-sm" style={{ color: 'var(--text-secondary)' }}>←</button>
                    <h2 className="font-bold text-lg" style={{ fontFamily: 'var(--font-display)' }}>
                      Order Summary
                    </h2>
                  </div>

                  {error && (
                    <div className="mb-4 px-3 py-2.5 rounded-lg text-sm"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                      {error}
                    </div>
                  )}

                  {/* Summary rows */}
                  <div className="rounded-xl overflow-hidden mb-5"
                    style={{ border: '1px solid var(--border)' }}>
                    {[
                      { label: 'Pi Amount',    value: `π${piRounded.toFixed(4)}`,          mono: true,  highlight: true },
                      { label: 'Naira Amount', value: `₦${nairaRounded.toLocaleString()}`,  mono: true,  highlight: false },
                      { label: 'Rate',         value: `₦${pricePerPi.toLocaleString()}/π`,  mono: false, highlight: false },
                      { label: 'Payment',      value: PAYMENT_METHOD_LABELS[selectedPm as PaymentMethodType], mono: false, highlight: false },
                      { label: 'Pay Window',   value: `${ad.paymentWindow} min`,            mono: false, highlight: false },
                    ].map((row, i) => (
                      <div key={i} className="flex justify-between items-center px-4 py-3"
                        style={{ borderBottom: i < 4 ? '1px solid var(--border-subtle)' : 'none', background: 'var(--bg-elevated)' }}>
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                        <span className="text-sm font-semibold"
                          style={{
                            color:      row.highlight ? 'var(--pi-gold)' : 'var(--text-primary)',
                            fontFamily: row.mono ? 'var(--font-mono)' : 'inherit',
                          }}>
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Sell-ad: payment instructions for buyer */}
                  {isSellAd && matchedDetail && (
                    <div className="rounded-xl p-4 mb-5"
                      style={{ background: 'rgba(240,160,60,0.07)', border: '1px solid rgba(240,160,60,0.2)' }}>
                      <p className="text-xs font-bold mb-3" style={{ color: 'var(--pi-gold)' }}>
                        💳 YOU WILL PAY TO
                      </p>
                      <div className="space-y-1.5 text-sm">
                        {matchedDetail.accountName   && <p><span style={{ color: 'var(--text-muted)' }}>Name: </span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{matchedDetail.accountName}</span></p>}
                        {matchedDetail.accountNumber && <p><span style={{ color: 'var(--text-muted)' }}>Account: </span><span style={{ color: 'var(--pi-gold)', fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700 }}>{matchedDetail.accountNumber}</span></p>}
                        {matchedDetail.bankName      && <p><span style={{ color: 'var(--text-muted)' }}>Bank: </span><span style={{ color: 'var(--text-primary)' }}>{matchedDetail.bankName}</span></p>}
                      </div>
                      <p className="text-xs mt-3 p-2 rounded-lg"
                        style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--text-secondary)' }}>
                        After placing the order, Pi will be locked in escrow. Transfer exactly <strong style={{ color: 'var(--pi-gold)' }}>₦{nairaRounded.toLocaleString()}</strong> and then click "I've Paid".
                      </p>
                    </div>
                  )}

                  {/* Buy-ad: confirm they're locking their Pi */}
                  {isBuyAd && (
                    <div className="rounded-xl p-4 mb-5"
                      style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <p className="text-xs font-bold mb-2" style={{ color: '#f87171' }}>
                        🔒 PI WILL BE LOCKED
                      </p>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        π{piRounded.toFixed(4)} will be locked from your wallet balance while waiting for the buyer to send ₦{nairaRounded.toLocaleString()}.
                      </p>
                      <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                        Wallet balance after lock: π{((wallet?.piBalance ?? 0) - piRounded).toFixed(4)}
                      </p>
                    </div>
                  )}

                  {/* Pi wallet address — pick from saved or add inline */}
                  <div className="rounded-xl overflow-hidden"
                    style={{ border: '1px solid var(--border)' }}>
                    <div className="px-4 py-3 flex items-center justify-between"
                      style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <p className="text-xs font-bold" style={{ color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>
                        YOUR PI RECEIVING WALLET
                      </p>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Pi released here on completion
                      </span>
                    </div>

                    <div className="p-4 space-y-2" style={{ background: 'var(--bg-card)' }}>
                      {loadingWallets ? (
                        <p className="text-sm text-center py-2" style={{ color: 'var(--text-muted)' }}>
                          Loading wallets…
                        </p>
                      ) : savedWallets.length > 0 ? (
                        <>
                          {savedWallets.map((w) => {
                            const sel = selectedWalletId === w._id;
                            return (
                              <button key={w._id} type="button"
                                onClick={() => setSelectedWalletId(w._id)}
                                className="w-full text-left rounded-xl p-3 transition-all"
                                style={{
                                  background: sel ? 'rgba(240,160,60,0.1)' : 'var(--bg-elevated)',
                                  border:     `1px solid ${sel ? 'rgba(240,160,60,0.4)' : 'var(--border)'}`,
                                }}>
                                <div className="flex items-center gap-3">
                                  <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                                    style={{ border: `2px solid ${sel ? 'var(--pi-gold)' : 'var(--border)'}` }}>
                                    {sel && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--pi-gold)' }} />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-sm"
                                        style={{ color: sel ? 'var(--pi-gold)' : 'var(--text-primary)' }}>
                                        {w.tag}
                                      </span>
                                      {w.isDefault && (
                                        <span className="text-xs px-1.5 py-0.5 rounded"
                                          style={{ background: 'rgba(240,160,60,0.12)', color: 'var(--pi-gold)' }}>
                                          Default
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs truncate mt-0.5"
                                      style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                      {w.address}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            );
                          })}

                          {/* Add new inline */}
                          {!showNewWallet ? (
                            <button type="button" onClick={() => setShowNewWallet(true)}
                              className="w-full rounded-xl p-3 text-sm transition-all"
                              style={{ background: 'transparent', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(240,160,60,0.3)'; e.currentTarget.style.color = 'var(--pi-gold)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                              + Add another Pi wallet
                            </button>
                          ) : (
                            <InlineWalletForm
                              newWalletAddr={newWalletAddr} setNewWalletAddr={setNewWalletAddr}
                              newWalletTag={newWalletTag}   setNewWalletTag={setNewWalletTag}
                              stellarRe={STELLAR_RE}
                              saving={savingWallet}
                              onCancel={() => { setShowNewWallet(false); setNewWalletAddr(''); setNewWalletTag(''); }}
                              onSave={async () => {
                                if (!newWalletTag.trim() || !STELLAR_RE.test(newWalletAddr.trim())) return;
                                setSavingWallet(true);
                                try {
                                  await piWalletsApi.add({ address: newWalletAddr.trim(), tag: newWalletTag.trim(), isDefault: false });
                                  const r = await piWalletsApi.getAll();
                                  const updated = r.data.piWalletAddresses;
                                  setSavedWallets(updated);
                                  const newest = updated[updated.length - 1];
                                  if (newest) setSelectedWalletId(newest._id);
                                  setShowNewWallet(false); setNewWalletAddr(''); setNewWalletTag('');
                                } catch { logger.error('save wallet error'); }
                                finally { setSavingWallet(false); }
                              }}
                            />
                          )}
                        </>
                      ) : (
                        /* No saved wallets — single inline form */
                        <InlineWalletForm
                          newWalletAddr={newWalletAddr} setNewWalletAddr={setNewWalletAddr}
                          newWalletTag={newWalletTag}   setNewWalletTag={setNewWalletTag}
                          stellarRe={STELLAR_RE}
                          saving={savingWallet}
                          onCancel={undefined}
                          onSave={undefined}
                        />
                      )}
                    </div>

                    {/* Selected address preview */}
                    {resolvedWalletAddress && (
                      <div className="px-4 py-3"
                        style={{ background: 'rgba(240,160,60,0.05)', borderTop: '1px solid rgba(240,160,60,0.15)' }}>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Pi will be sent to:
                        </p>
                        <p className="text-xs mt-0.5 break-all"
                          style={{ color: 'var(--pi-gold)', fontFamily: 'var(--font-mono)' }}>
                          {resolvedWalletAddress}
                        </p>
                      </div>
                    )}

                    <div className="px-4 py-3"
                      style={{ background: 'rgba(239,68,68,0.04)', borderTop: '1px solid rgba(239,68,68,0.12)' }}>
                      <p className="text-xs leading-relaxed" style={{ color: '#fca5a5' }}>
                        ⚠️ <strong>Verify address carefully.</strong> Pi sent to a wrong address cannot be recovered.
                      </p>
                    </div>
                  </div>

                  {/* Confirm button */}
                  <button
                    onClick={handleCreateOrder}
                    disabled={creating || !!validateWalletSelection() || !resolvedWalletAddress}
                    className={`${ctaColor} w-full py-3.5 rounded-xl font-bold text-base`}>
                    {creating ? 'Creating order…' : isBuyAd ? '🔒 Lock Pi & Notify Buyer' : '💳 Place Order'}
                  </button>

                  <p className="text-xs text-center mt-3" style={{ color: 'var(--text-muted)' }}>
                    By confirming, you agree to complete the trade within {ad.paymentWindow} minutes.
                  </p>
                </>
              )}

              {/* ── DONE step ── */}
              {step === 'done' && (
                <div className="text-center py-10">
                  <div className="text-5xl mb-4">🎉</div>
                  <h3 className="font-bold text-lg mb-2" style={{ color: accentColor }}>Order Created!</h3>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Redirecting to your order…</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}