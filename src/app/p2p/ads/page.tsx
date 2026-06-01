'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter }        from 'next/navigation';
import Navbar               from '@/components/layout/Navbar';
import { WalletCard }       from '@/components/p2p/WalletCard';
import { DepositModal }     from '@/components/p2p/DepositModal';
import PiWalletPicker       from '@/components/p2p/PiWalletAddressPicker';
import PaymentAccountPicker from '@/components/p2p/paymentAccountPicker';
import { adsApi, walletApi, paymentMethodsApi } from '@/lib/api';
import { useAuth }          from '@/hooks/useAuth';
import {
  Ad, AdType, AdStatus, PaymentMethodType, PaymentMethodDetail,
  PAYMENT_METHOD_LABELS, WalletSummary, PiWalletAddress,
} from '@/types';
import { logger }   from '@/lib/logger';
import { useToast } from '@/hooks/useToast';
import { ALL_PAYMENT_TYPES } from '@/lib/constants';
import BottomNav from '@/components/layout/BottomNav';
import { useCurrency } from '@/hooks/useCurrency';

// ─── Constants ────────────────────────────────────────────────────────────────

type View = 'list' | 'create' | 'edit';

// ─── Form shape ───────────────────────────────────────────────────────────────
// Sell ads: payment account is held in selectedPaymentAccount (separate state),
// not inside the form, so the form only tracks non-account fields.

interface AdFormState {
  type:          AdType;
  piAmount:      string;
  minLimit:      string;
  maxLimit:      string;
  pricePerPi:    string;
  /** Buy ads: payment types the counterparty may use to pay */
  acceptedTypes: PaymentMethodType[];
  paymentWindow: string;
  terms:         string;
  autoReply:     string;
}

const BLANK_FORM: AdFormState = {
  type: 'buy', piAmount: '', minLimit: '', maxLimit: '', pricePerPi: '',
  acceptedTypes: [],
  paymentWindow: '15', terms: '', autoReply: '',
};

// ─── Reusable sub-components ──────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      className="mb-4 px-4 py-3 rounded-lg text-sm"
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

function EmptyState({
  emoji, title, body, cta, onCta,
}: {
  emoji: string; title: string; body: string; cta: string; onCta: () => void;
}) {
  return (
    <div className="card p-16 text-center">
      <div className="text-4xl mb-4">{emoji}</div>
      <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{title}</p>
      <p className="text-sm mb-6"      style={{ color: 'var(--text-muted)' }}>{body}</p>
      <button onClick={onCta} className="btn-pi px-6 py-2.5">{cta}</button>
    </div>
  );
}

function MenuItem({
  children, color, hoverBg = 'var(--bg-elevated)', onClick, suffix,
}: {
  children: React.ReactNode; color: string; hoverBg?: string;
  onClick: () => void; suffix?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2"
      style={{ color }}
      onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
      {suffix && <span className="ml-auto text-xs opacity-60">{suffix}</span>}
    </button>
  );
}

function AdCard({
  ad, isMenuOpen, onToggleMenu, menuRef,
  onEdit, onActivate, onPause, onCancel, onHardDelete,
}: {
  ad: Ad; isMenuOpen: boolean; onToggleMenu: () => void;
  menuRef: React.RefObject<HTMLDivElement>;
  onEdit: () => void; onActivate: () => void; onPause: () => void;
  onCancel: () => void; onHardDelete: () => void;
}) {
  const tradedPi = ad.piAmount - ad.availableAmount;
  return (
    <div className="card p-5">
      <div className="flex items-start gap-4">
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 mt-0.5 ${
            ad.type === 'buy' ? 'badge-buy' : 'badge-sell'
          }`}
        >
          {ad.type.toUpperCase()}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
              ₦{ad.pricePerPi.toLocaleString()} / π
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Limit: ₦{ad.minLimit.toLocaleString()}–₦{ad.maxLimit.toLocaleString()}
            </span>
          </div>
          <div
            className="flex flex-wrap items-center gap-3 mt-1 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            <span>
              <span style={{ color: 'var(--pi-gold)' }}>π{ad.availableAmount}</span>{' '}
              available
              {tradedPi > 0 && <span className="ml-1">(π{tradedPi} traded)</span>}
            </span>
            {ad.type === 'sell' && ad.reservedPi > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(250,204,21,0.1)',
                  color:      '#facc15',
                  border:     '1px solid rgba(250,204,21,0.2)',
                }}
              >
                🔒 π{ad.reservedPi} locked
              </span>
            )}
            <span>{ad.completedOrders} completed</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {ad.paymentMethods.map((pm) => (
              <span
                key={pm}
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  background: 'rgba(240,160,60,0.07)',
                  color:      'var(--text-muted)',
                  border:     '1px solid rgba(240,160,60,0.12)',
                }}
              >
                {PAYMENT_METHOD_LABELS[pm]}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span
            className={`text-xs px-2 py-1 rounded-full font-medium ${
              ad.status === 'active'  ? 'text-green-400 bg-green-400/10'   :
              ad.status === 'paused' ? 'text-yellow-400 bg-yellow-400/10' :
                                        'text-gray-400 bg-gray-400/10'
            }`}
          >
            {ad.status}
          </span>

          <div className="relative" ref={isMenuOpen ? menuRef : null}>
            <button
              onClick={onToggleMenu}
              className="text-xs px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5"
              style={{
                borderColor: 'var(--border)',
                color:       'var(--text-secondary)',
                background:  'var(--bg-elevated)',
              }}
            >
              Actions
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path
                  d="M2 3.5l3 3 3-3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </button>

            {isMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1 z-20 rounded-xl overflow-hidden"
                style={{
                  minWidth:   '160px',
                  background: 'var(--bg-card)',
                  border:     '1px solid var(--border)',
                  boxShadow:  '0 8px 32px rgba(0,0,0,0.4)',
                }}
              >
                {ad.status !== 'cancelled' && ad.status !== 'completed' && (
                  <MenuItem color="var(--pi-gold)" onClick={onEdit}>✏️ Edit Ad</MenuItem>
                )}
                {ad.status === 'paused' && (
                  <MenuItem color="#4ade80" onClick={onActivate}>▶ Activate</MenuItem>
                )}
                {ad.status === 'active' && (
                  <MenuItem color="#facc15" onClick={onPause}>⏸ Pause</MenuItem>
                )}
                {(ad.status === 'active' || ad.status === 'paused') && (
                  <>
                    <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '2px 0' }} />
                    <MenuItem
                      color="#f87171"
                      hoverBg="rgba(239,68,68,0.08)"
                      onClick={onCancel}
                      suffix="refunds Pi"
                    >
                      ✕ Cancel Ad
                    </MenuItem>
                  </>
                )}
                {ad.status === 'cancelled' && (
                  <>
                    <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '2px 0' }} />
                    <MenuItem
                      color="#f87171"
                      hoverBg="rgba(239,68,68,0.08)"
                      onClick={onHardDelete}
                    >
                      🗑 Delete Permanently
                    </MenuItem>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PostAdPage() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const { toast, toastErr, showToast } = useToast();
  const {currency,} = useCurrency()

  // ── Core state ─────────────────────────────────────────────────────────────
  const [myAds,       setMyAds]       = useState<Ad[]>([]);
  const [view,        setView]        = useState<View>('list');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [wallet,      setWallet]      = useState<WalletSummary | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const [shortfall,   setShortfall]   = useState(0);
  const [editingAd,   setEditingAd]   = useState<Ad | null>(null);
  const [form,        setForm]        = useState<AdFormState>(BLANK_FORM);

  // ── Sell ad: single selected payment account (managed by PaymentAccountPicker)
  //    This is the source of truth — no redundant id stored in form state.
  const [selectedSellerAccount, setSelectedSellerAccount] = useState<PaymentMethodDetail | null>(null);

  // ── Buy ad: Pi wallet where Pi is released on trade completion
  const [selectedPiWalletId, setSelectedPiWalletId] = useState<string | null>(null);

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) router.push('/auth/login');
  }, [isAuthenticated, router]);

  // ── Loaders ────────────────────────────────────────────────────────────────
  const loadMyAds = useCallback(async () => {
    try {
      const r = await adsApi.getMyAds();
      setMyAds(r.data.ads);
    } catch (e) { logger.error('getMyAds error:', e); }
  }, []);

  const loadWallet = useCallback(async () => {
    try {
      const r = await walletApi.getBalance();
      setWallet(r.data);
    } catch (e) { logger.error('loadWallet error:', e); }
  }, []);

  useEffect(() => {
    loadMyAds();
    loadWallet();
  }, [loadMyAds, loadWallet]);

  // ── Buy-ad: toggle accepted payment type ───────────────────────────────────
  const toggleAcceptedType = (type: PaymentMethodType) => {
    setForm((f) => ({
      ...f,
      acceptedTypes: f.acceptedTypes.includes(type)
        ? f.acceptedTypes.filter((t) => t !== type)
        : [...f.acceptedTypes, type],
    }));
  };

  // ── Open create ────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingAd(null);
    setForm(BLANK_FORM);
    setError('');
    setSelectedSellerAccount(null);
    setSelectedPiWalletId(null);
    setView('create');
  };

  // ── Open edit ──────────────────────────────────────────────────────────────
  // For sell ads: fetch saved accounts and pre-select the one matching the ad's
  // paymentDetail so PaymentAccountPicker reflects the current configuration.
  const openEdit = async (ad: Ad) => {
    setEditingAd(ad);
    setError('');
    setForm({
      type:          ad.type,
      piAmount:      String(ad.piAmount),
      minLimit:      String(ad.minLimit),
      maxLimit:      String(ad.maxLimit),
      pricePerPi:    String(ad.pricePerPi),
      acceptedTypes: ad.type === 'buy' ? [...ad.paymentMethods] : [],
      paymentWindow: String(ad.paymentWindow),
      terms:         ad.terms     ?? '',
      autoReply:     ad.autoReply ?? '',
    });

    // Pre-select the payment account for sell ads
    if (ad.type === 'sell' && ad.sellerAccountDetail) {
      try {
        const r       = await paymentMethodsApi.getAll();
        const saved   = r.data.userAccountDetails as PaymentMethodDetail[];
        const detail  = ad.sellerAccountDetail; // single account
        const match   = saved.find(
          (pm) => pm.type === detail.type && pm.accountNumber === detail.accountNumber,
        ) ?? null;
        setSelectedSellerAccount(match || saved[0]);
      } catch (e) {
        logger.error('openEdit fetchAccounts error:', e);
        setSelectedSellerAccount(null);
      }
    } else {
      setSelectedSellerAccount(null);
    }

    setView('edit');
  };

  // ── Derived / validation ────────────────────────────────────────────────────
  const sellAdPi      = form.type === 'sell' ? Number(form.piAmount) || 0 : 0;
  const hasSufficient = !wallet || form.type !== 'sell' || wallet.piBalance >= sellAdPi;
  const balanceShort  = form.type === 'sell' && wallet
    ? Math.max(0, sellAdPi - wallet.piBalance)
    : 0;
  const isEditSell = view === 'edit' && editingAd?.type === 'sell';
  const editMaxPi  = editingAd?.piAmount ?? Infinity;

  // Sell ad is valid when a payment account is selected
  const sellMethodsValid = form.type !== 'sell' || !!selectedSellerAccount;
  const buyMethodsValid  = form.type !== 'buy'  || form.acceptedTypes.length > 0;
  const buyWalletValid   = form.type !== 'buy'  || !!selectedPiWalletId;

  // ── Payload builder ────────────────────────────────────────────────────────
  // Sell ads: derive paymentDetails and paymentMethods directly from the
  // selected account object — no intermediate id/cache lookup needed.
  function buildPayload() {
    const isSell = form.type === 'sell';

    return {
      type:          form.type,
      piAmount:      Number(form.piAmount),
      minLimit:      Number(form.minLimit),
      maxLimit:      Number(form.maxLimit),
      pricePerPi:    Number(form.pricePerPi),
      paymentMethods: form.acceptedTypes,
      paymentWindow: Number(form.paymentWindow),
      terms:         form.terms,
      autoReply:     form.autoReply,
      buyerPiWalletId: form.type==='buy'? selectedPiWalletId as string : undefined,
      sellerAccountDetailId: form.type==='sell'? selectedSellerAccount?._id as string : undefined,
    };
  }

  // ── Submit (create) ────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!sellMethodsValid) { setError('Select a payment account for buyers to pay to'); return; }
    if (!buyMethodsValid)  { setError('Select at least one accepted payment method'); return; }
    if (!buyWalletValid)   { setError('Select a Pi wallet address to receive Pi'); return; }

    if (form.type === 'sell' && wallet && wallet.piBalance < sellAdPi) {
      setShortfall(sellAdPi - wallet.piBalance);
      setShowDeposit(true);
      return;
    }

    setSaving(true);
    try {
      await adsApi.createAd(buildPayload());
      showToast('Ad posted successfully!');
      await Promise.all([loadMyAds(), loadWallet()]);
      setView('list');
    } catch (err: unknown) {
      const data = (err as {
        response?: { data?: { message?: string; needsDeposit?: boolean; shortfall?: number } };
      })?.response?.data;
      if (data?.needsDeposit) {
        setShortfall(data.shortfall ?? 0);
        setShowDeposit(true);
      } else {
        const msg = data?.message ?? 'Failed to post ad';
        setError(msg);
        showToast(msg, true);
      }
      logger.error('createAd error:', err);
    } finally { setSaving(false); }
  };

  // ── Submit (edit) ──────────────────────────────────────────────────────────
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAd) return;
    setError('');

    if (!sellMethodsValid) { setError('Select a payment account for buyers to pay to'); return; }
    if (!buyMethodsValid)  { setError('Select at least one accepted payment method'); return; }

    const tradedAmount = editingAd.piAmount - editingAd.availableAmount;
    if (editingAd.type === 'sell' && Number(form.piAmount) < tradedAmount) {
      setError(`Cannot set Pi amount below already-traded amount (${tradedAmount}π traded).`);
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      await adsApi.updateAd(editingAd._id, {
        piAmount:       payload.piAmount,
        minLimit:       payload.minLimit,
        maxLimit:       payload.maxLimit,
        pricePerPi:     payload.pricePerPi,
        paymentMethods: payload.paymentMethods,
        paymentDetails: payload.sellerAccountDetailId,
        buyerPiWalletId: payload.buyerPiWalletId,
        paymentWindow:  payload.paymentWindow,
        terms:          payload.terms,
        autoReply:      payload.autoReply,
      });
      showToast('Ad updated successfully!');
      await Promise.all([loadMyAds(), loadWallet()]);
      setView('list');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to update ad';
      setError(msg);
      showToast(msg, true);
      logger.error('updateAd error:', err);
    } finally { setSaving(false); }
  };

  // ── Ad status actions ──────────────────────────────────────────────────────
  const setAdStatus = async (ad: Ad, newStatus: AdStatus) => {
    try {
      await adsApi.updateAd(ad._id, { status: newStatus });
      setMyAds((prev) =>
        prev.map((a) => a._id === ad._id ? { ...a, status: newStatus } : a),
      );
      showToast(`Ad ${newStatus === 'active' ? 'activated' : 'paused'}`);
    } catch (e) {
      showToast('Failed to update ad status', true);
      logger.error('setAdStatus error:', e);
    }
  };

  const cancelAd = async (adId: string) => {
    if (!confirm('Cancel this ad? Any reserved Pi will be returned to your wallet.')) return;
    try {
      await adsApi.deleteAd(adId);
      showToast('Ad cancelled — Pi returned to wallet');
      await Promise.all([loadMyAds(), loadWallet()]);
    } catch (e) {
      showToast('Failed to cancel ad', true);
      logger.error('cancelAd error:', e);
    }
  };

  const hardDeleteAd = async (adId: string) => {
    if (!confirm('Permanently delete this ad? This cannot be undone.')) return;
    try {
      await adsApi.hardDeleteAd(adId);
      showToast('Ad permanently deleted');
      setMyAds((prev) => prev.filter((a) => a._id !== adId));
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to delete ad';
      showToast(msg, true);
      logger.error('hardDeleteAd error:', e);
    }
  };

  // ── Action-menu tracking ───────────────────────────────────────────────────
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // ── Render ───────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium animate-slide-up"
          style={{
            background: toastErr ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
            border:     `1px solid ${toastErr ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
            color:      toastErr ? '#f87171' : '#4ade80',
          }}
        >
          {toast}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              My <span className="pi-text">Ads</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {myAds.filter((a) => a.status === 'active').length} active · {myAds.length} total
            </p>
          </div>
          {view === 'list'
            ? <button onClick={openCreate} className="btn-pi px-5 py-2.5">+ Post New Ad</button>
            : <button onClick={() => setView('list')} className="btn-ghost px-5 py-2.5">← My Ads</button>
          }
        </div>

        {/* Wallet strip */}
        <WalletCard
          summary={wallet}
          accessToken={user?.piUid ?? null}
          onDeposited={(bal) =>
            setWallet((w) =>
              w ? { ...w, piBalance: bal, totalHeld: bal + (w.lockedBalance ?? 0) } : w,
            )
          }
          showToast={showToast}
        />

        <div className="mt-6">

          {/* ════════════════════════════════════════════════════════════════
              AD LIST
          ════════════════════════════════════════════════════════════════ */}
          {view === 'list' && (
            <div className="space-y-3 animate-fade-in">
              {myAds.length === 0 ? (
                <EmptyState
                  emoji="📝"
                  title="No ads yet"
                  body="Post a buy or sell ad to start trading Pi."
                  cta="Post Your First Ad"
                  onCta={openCreate}
                />
              ) : (
                myAds.map((ad) => (
                  <AdCard
                    key={ad._id}
                    ad={ad}
                    isMenuOpen={openMenuId === ad._id}
                    onToggleMenu={() =>
                      setOpenMenuId(openMenuId === ad._id ? null : ad._id)
                    }
                    menuRef={menuRef}
                    onEdit={() => { openEdit(ad); setOpenMenuId(null); }}
                    onActivate={() => { setAdStatus(ad, 'active'); setOpenMenuId(null); }}
                    onPause={() => { setAdStatus(ad, 'paused'); setOpenMenuId(null); }}
                    onCancel={() => { cancelAd(ad._id); setOpenMenuId(null); }}
                    onHardDelete={() => { hardDeleteAd(ad._id); setOpenMenuId(null); }}
                  />
                ))
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              CREATE / EDIT FORM
          ════════════════════════════════════════════════════════════════ */}
          {(view === 'create' || view === 'edit') && (
            <div className="card p-8 animate-fade-in">
              <h2 className="text-xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                {view === 'create' ? 'Post New Ad' : 'Edit Ad'}
              </h2>

              {view === 'edit' && editingAd && (
                <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                  Editing {editingAd.type} ad · π{editingAd.availableAmount} remaining
                  {editingAd.type === 'sell' &&
                    ' · To increase Pi amount, cancel and re-create.'}
                </p>
              )}
              {view === 'create' && <div className="mb-6" />}

              <ErrorBanner message={error} />

              <form
                onSubmit={view === 'create' ? handleCreate : handleEdit}
                className="space-y-6"
              >

                {/* ── Ad Type (create only) ──────────────────────────────── */}
                {view === 'create' && (
                  <div>
                    <label
                      className="block text-sm font-medium mb-2"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Ad Type
                    </label>
                    <div className="flex gap-3">
                      {(['buy', 'sell'] as AdType[]).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            setForm((f) => ({ ...f, type: t }));
                            // Reset account selection when switching types
                            setSelectedSellerAccount(null);
                          }}
                          className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
                            form.type === t
                              ? t === 'buy' ? 'btn-buy' : 'btn-sell'
                              : 'btn-ghost'
                          }`}
                        >
                          {t === 'buy' ? '🟢 I want to Buy Pi' : '🔴 I want to Sell Pi'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Numeric fields ─────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Pi Amount
                      {isEditSell && (
                        <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                          (max {editMaxPi}π)
                        </span>
                      )}
                    </label>
                    <input
                      className="input-dark"
                      type="number"
                      placeholder="100"
                      value={form.piAmount}
                      min={1}
                      max={isEditSell ? editMaxPi : undefined}
                      onChange={(e) => setForm((f) => ({ ...f, piAmount: e.target.value }))}
                      required
                    />
                    {view === 'create' && form.type === 'sell' && form.piAmount && !hasSufficient && (
                      <p
                        className="mt-1.5 text-xs flex items-center gap-1"
                        style={{ color: '#f87171' }}
                      >
                        ⚠ Need π{balanceShort.toFixed(4)} more —&nbsp;
                        <button
                          type="button"
                          className="underline"
                          style={{ color: 'var(--pi-gold)' }}
                          onClick={() => { setShortfall(balanceShort); setShowDeposit(true); }}
                        >
                          Deposit now
                        </button>
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Price per Pi ({currency.symbol})
                    </label>
                    <input
                      className="input-dark"
                      type="number"
                      placeholder="5000"
                      value={form.pricePerPi}
                      onChange={(e) => setForm((f) => ({ ...f, pricePerPi: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Min Limit ({currency.symbol})
                    </label>
                    <input
                      className="input-dark"
                      type="number"
                      placeholder="1000"
                      value={form.minLimit}
                      onChange={(e) => setForm((f) => ({ ...f, minLimit: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Max Limit ({currency.symbol})
                    </label>
                    <input
                      className="input-dark"
                      type="number"
                      placeholder="500000"
                      value={form.maxLimit}
                      onChange={(e) => setForm((f) => ({ ...f, maxLimit: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                {/* ── Balance banner (sell + create) ────────────────────── */}
                {view === 'create' && form.type === 'sell' && wallet && (
                  <div
                    className="rounded-xl p-4"
                    style={{
                      background: hasSufficient ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                      border:     `1px solid ${hasSufficient ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p
                          className="text-sm font-medium"
                          style={{ color: hasSufficient ? '#4ade80' : '#f87171' }}
                        >
                          {hasSufficient ? '✅ Sufficient balance' : '⚠ Insufficient balance'}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          Wallet: π{wallet.piBalance.toFixed(4)} available
                          {sellAdPi > 0 && ` · π${sellAdPi} required`}
                        </p>
                      </div>
                      {!hasSufficient && (
                        <button
                          type="button"
                          onClick={() => { setShortfall(balanceShort); setShowDeposit(true); }}
                          className="btn-pi text-xs px-3 py-1.5 rounded-lg"
                        >
                          + Deposit π{balanceShort.toFixed(4)}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* ════════════════════════════════════════════════════════
                    SELL AD — single payment account (PaymentAccountPicker)
                ════════════════════════════════════════════════════════ */}
                {form.type === 'sell' && (
                  <PaymentAccountPicker
                    selectedPaymentAccount={selectedSellerAccount}
                    setSelectedPaymentAccount={setSelectedSellerAccount}
                    label="Payment Account"
                    hint="Buyers will pay to this account"
                    required
                  />
                )}

                {/* ════════════════════════════════════════════════════════
                    BUY AD — accepted payment types + Pi wallet
                ════════════════════════════════════════════════════════ */}
                <div className="space-y-5">
                  {/* Accepted payment method types */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label
                        className="text-sm font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Accepted Payment Methods{' '}
                        <span style={{ color: '#f87171' }}>*</span>
                      </label>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        How you want sellers to pay you
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ALL_PAYMENT_TYPES.map((t) => {
                        const active = form.acceptedTypes.includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => toggleAcceptedType(t)}
                            className="px-4 py-2 rounded-lg border text-sm transition-all"
                            style={{
                              background:  active ? 'rgba(240,160,60,0.15)' : 'var(--bg-elevated)',
                              color:       active ? 'var(--pi-gold)'         : 'var(--text-secondary)',
                              borderColor: active ? 'rgba(240,160,60,0.4)'   : 'var(--border)',
                            }}
                          >
                            {active && <span className="mr-1">✓</span>}
                            {PAYMENT_METHOD_LABELS[t]}
                          </button>
                        );
                      })}
                    </div>
                    {form.acceptedTypes.length === 0 && (
                      <p className="text-xs mt-2" style={{ color: '#f87171' }}>
                        Select at least one payment method.
                      </p>
                    )}
                  </div>

                  {/* Pi wallet where Pi is released on trade completion */}
                  {form.type === "buy" && <PiWalletPicker
                    selectedPiWalletId={selectedPiWalletId}
                    setSelectedPiWalletId={setSelectedPiWalletId}
                  />}
                </div>

                {/* ── Payment Window ─────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Payment Window
                    </label>
                    <select
                      className="input-dark"
                      value={form.paymentWindow}
                      onChange={(e) => setForm((f) => ({ ...f, paymentWindow: e.target.value }))}
                    >
                      {[10, 15, 20, 30, 45, 60].map((m) => (
                        <option key={m} value={m}>{m} minutes</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ── Terms ──────────────────────────────────────────────── */}
                <div>
                  <label
                    className="block text-sm font-medium mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Terms (optional)
                  </label>
                  <textarea
                    className="input-dark text-sm"
                    rows={3}
                    placeholder="Any special terms for traders…"
                    value={form.terms}
                    onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
                    style={{ resize: 'none' }}
                  />
                </div>

                {/* ── Auto-reply ─────────────────────────────────────────── */}
                <div>
                  <label
                    className="block text-sm font-medium mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Auto-reply (optional)
                  </label>
                  <input
                    className="input-dark text-sm"
                    placeholder="Message sent automatically when trade starts…"
                    value={form.autoReply}
                    onChange={(e) => setForm((f) => ({ ...f, autoReply: e.target.value }))}
                  />
                </div>

                {/* ── Submit ─────────────────────────────────────────────── */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setView('list')}
                    className="btn-ghost px-6 py-3 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      saving ||
                      (view === 'create' && form.type === 'sell' && !hasSufficient) ||
                      !sellMethodsValid ||
                      !buyMethodsValid  ||
                      !buyWalletValid
                    }
                    className="btn-pi flex-1 py-3 rounded-xl text-base"
                  >
                    {saving
                      ? (view === 'create' ? 'Posting…' : 'Saving…')
                      : (view === 'create' ? 'Post Ad'  : 'Save Changes')
                    }
                  </button>
                </div>

              </form>
            </div>
          )}
        </div>
      </div>

      {/* ── Deposit modal ──────────────────────────────────────────────────── */}
      {showDeposit && (
        <DepositModal
          accessToken={user?.piUid ?? null}
          suggestedAmount={
            shortfall > 0
              ? Math.ceil((shortfall / (1 - 0.01)) * 10_000) / 10_000
              : undefined
          }
          onDepositComplete={(newBal) => {
            setWallet((w) =>
              w ? { ...w, piBalance: newBal, totalHeld: newBal + (w.lockedBalance ?? 0) } : w,
            );
            setShowDeposit(false);
            showToast('Deposit confirmed — you can now post your ad');
          }}
          onClose={() => setShowDeposit(false)}
          showToast={showToast}
        />
      )}
      <BottomNav />
    </div>
  );
}