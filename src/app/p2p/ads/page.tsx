'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter }              from 'next/navigation';
import Navbar                     from '@/components/layout/Navbar';
import { WalletCard }             from '@/components/p2p/WalletCard';
import { DepositModal }           from '@/components/p2p/DepositModal';
import PiWalletPicker             from '@/components/p2p/PiWalletAddressPicker';
import { adsApi, walletApi, paymentMethodsApi } from '@/lib/api';
import { useAuth }                from '@/hooks/useAuth';
import {
  Ad, AdType, AdStatus, PaymentMethodType, PaymentMethodDetail,
  NewPaymentMethodDetail, PAYMENT_METHOD_LABELS, WalletSummary,
  PiWalletAddress,
} from '@/types';
import { logger }    from '@/lib/logger';
import { useToast }  from '@/hooks/useToast';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_PAYMENT_TYPES: PaymentMethodType[] = [
  'bank_transfer', 'opay', 'palmpay', 'kuda', 'moniepoint',
];

type View = 'list' | 'create' | 'edit';

// ─── Form shape ───────────────────────────────────────────────────────────────

interface AdFormState {
  type:          AdType;
  piAmount:      string;
  minLimit:      string;
  maxLimit:      string;
  pricePerPi:    string;
  /** Sell ads: selected saved-account _ids (drives paymentDetails) */
  selectedPmIds: string[];
  /** Buy ads: payment types accepted from counterparty */
  acceptedTypes: PaymentMethodType[];
  paymentWindow: string;
  terms:         string;
  autoReply:     string;
}

const BLANK_FORM: AdFormState = {
  type: 'buy', piAmount: '', minLimit: '', maxLimit: '', pricePerPi: '',
  selectedPmIds: [], acceptedTypes: [],
  paymentWindow: '15', terms: '', autoReply: '',
};

// ─── Inline new-account draft ─────────────────────────────────────────────────

interface NewAccountDraft {
  type:          PaymentMethodType;
  accountName:   string;
  accountNumber: string;
  bankName:      string;
  isDefault:     boolean;
}

const BLANK_ACCOUNT: NewAccountDraft = {
  type: 'bank_transfer',
  accountName: '', accountNumber: '', bankName: '', isDefault: false,
};

// ─── Payload builders ─────────────────────────────────────────────────────────

function buildPaymentDetails(ids: string[], saved: PaymentMethodDetail[]) {
  return ids
    .map((id) => saved.find((pm) => pm._id === id))
    .filter(Boolean)
    .map((pm) => ({
      type:          pm!.type,
      label:         pm!.label,
      accountName:   pm!.accountName,
      accountNumber: pm!.accountNumber,
      bankName:      pm!.bankName,
    }));
}

function buildPaymentMethodTypes(
  ids:   string[],
  saved: PaymentMethodDetail[],
): PaymentMethodType[] {
  const types = ids
    .map((id) => saved.find((pm) => pm._id === id)?.type)
    .filter(Boolean) as PaymentMethodType[];
  return [...new Set(types)];
}

// ─── Reusable sub-components ──────────────────────────────────────────────────

/** Label + optional hint row used above form sections */
function SectionHeader({
  label,
  hint,
  required,
}: {
  label:    string;
  hint?:    string;
  required?: boolean;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
        {required && <span style={{ color: '#f87171' }}> *</span>}
      </label>
      {hint && (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {hint}
        </span>
      )}
    </div>
  );
}

/** Inline error banner */
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

/** Generic empty state card */
function EmptyState({
  emoji,
  title,
  body,
  cta,
  onCta,
}: {
  emoji: string;
  title: string;
  body:  string;
  cta:   string;
  onCta: () => void;
}) {
  return (
    <div className="card p-16 text-center">
      <div className="text-4xl mb-4">{emoji}</div>
      <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        {title}
      </p>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        {body}
      </p>
      <button onClick={onCta} className="btn-pi px-6 py-2.5">
        {cta}
      </button>
    </div>
  );
}

/** A single ad card in the My Ads list */
function AdCard({
  ad,
  isMenuOpen,
  onToggleMenu,
  menuRef,
  onEdit,
  onActivate,
  onPause,
  onCancel,
  onHardDelete,
}: {
  ad:           Ad;
  isMenuOpen:   boolean;
  onToggleMenu: () => void;
  menuRef:      React.RefObject<HTMLDivElement>;
  onEdit:       () => void;
  onActivate:   () => void;
  onPause:      () => void;
  onCancel:     () => void;
  onHardDelete: () => void;
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
                  background:  'rgba(240,160,60,0.07)',
                  color:       'var(--text-muted)',
                  border:      '1px solid rgba(240,160,60,0.12)',
                }}
              >
                {PAYMENT_METHOD_LABELS[pm]}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {/* Status badge */}
          <span
            className={`text-xs px-2 py-1 rounded-full font-medium ${
              ad.status === 'active'  ? 'text-green-400 bg-green-400/10'   :
              ad.status === 'paused' ? 'text-yellow-400 bg-yellow-400/10' :
                                        'text-gray-400 bg-gray-400/10'
            }`}
          >
            {ad.status}
          </span>

          {/* Action menu */}
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
                <MenuDivider />

                {ad.status !== 'cancelled' && ad.status !== 'completed' && (
                  <MenuItem color="var(--pi-gold)" onClick={onEdit}>
                    ✏️ Edit Ad
                  </MenuItem>
                )}

                {ad.status === 'paused' && (
                  <MenuItem color="#4ade80" onClick={onActivate}>
                    ▶ Activate
                  </MenuItem>
                )}

                {ad.status === 'active' && (
                  <MenuItem color="#facc15" onClick={onPause}>
                    ⏸ Pause
                  </MenuItem>
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

/** Thin divider helper used inside action menus */
function MenuDivider() {
  return null; // semantic placeholder — actual dividers are rendered inline above
}

/** Single action menu item */
function MenuItem({
  children,
  color,
  hoverBg = 'var(--bg-elevated)',
  onClick,
  suffix,
}: {
  children: React.ReactNode;
  color:    string;
  hoverBg?: string;
  onClick:  () => void;
  suffix?:  string;
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
      {suffix && (
        <span className="ml-auto text-xs opacity-60">{suffix}</span>
      )}
    </button>
  );
}

/** Inline form for adding a new payment account */
function NewAccountForm({
  account,
  saving,
  onChange,
  onSave,
  onCancel,
}: {
  account:  NewAccountDraft;
  saving:   boolean;
  onChange: (patch: Partial<NewAccountDraft>) => void;
  onSave:   () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="rounded-xl p-5 mt-2"
      style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(240,160,60,0.2)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold" style={{ color: 'var(--pi-gold)' }}>
          New Payment Account
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          Cancel
        </button>
      </div>

      {/* Account type chips */}
      <div className="mb-3">
        <label
          className="block text-xs font-medium mb-1.5"
          style={{ color: 'var(--text-secondary)' }}
        >
          Account Type
        </label>
        <div className="flex flex-wrap gap-2">
          {ALL_PAYMENT_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ type: t })}
              className="text-xs px-3 py-1.5 rounded-lg border transition-all"
              style={{
                background:  account.type === t ? 'rgba(240,160,60,0.15)' : 'var(--bg-card)',
                color:       account.type === t ? 'var(--pi-gold)'         : 'var(--text-secondary)',
                borderColor: account.type === t ? 'rgba(240,160,60,0.4)'   : 'var(--border)',
              }}
            >
              {PAYMENT_METHOD_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Account fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div>
          <label
            className="block text-xs font-medium mb-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            Account Name *
          </label>
          <input
            className="input-dark text-sm"
            placeholder="John Doe"
            value={account.accountName}
            onChange={(e) => onChange({ accountName: e.target.value })}
          />
        </div>
        <div>
          <label
            className="block text-xs font-medium mb-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            Account Number *
          </label>
          <input
            className="input-dark text-sm"
            placeholder="0123456789"
            value={account.accountNumber}
            onChange={(e) => onChange({ accountNumber: e.target.value })}
          />
        </div>
        <div>
          <label
            className="block text-xs font-medium mb-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            Bank Name{account.type === 'bank_transfer' ? ' *' : ' (optional)'}
          </label>
          <input
            className="input-dark text-sm"
            placeholder="GTBank"
            value={account.bankName}
            onChange={(e) => onChange({ bankName: e.target.value })}
          />
        </div>
      </div>

      {/* Default toggle */}
      <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
        <div
          onClick={() => onChange({ isDefault: !account.isDefault })}
          className="w-10 h-6 rounded-full relative transition-colors flex-shrink-0"
          style={{ background: account.isDefault ? 'var(--pi-gold)' : 'var(--border)' }}
        >
          <div
            className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
            style={{ left: account.isDefault ? '22px' : '4px' }}
          />
        </div>
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Set as default account
        </span>
      </label>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="btn-pi w-full py-2.5 rounded-xl text-sm"
      >
        {saving ? 'Saving…' : 'Save & Select Account'}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PostAdPage() {
  const { isAuthenticated, user, addPaymentMethod, addPiWalletAddress } = useAuth();
  const router  = useRouter();
  const { toast, toastErr, showToast } = useToast();

  // ── State ──────────────────────────────────────────────────────────────────
  const [myAds,       setMyAds]       = useState<Ad[]>([]);
  const [view,        setView]        = useState<View>('list');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [wallet,      setWallet]      = useState<WalletSummary | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const [shortfall,   setShortfall]   = useState(0);
  const [editingAd,   setEditingAd]   = useState<Ad | null>(null);
  const [form,        setForm]        = useState<AdFormState>(BLANK_FORM);

  // Saved payment accounts
  const [savedMethods,   setSavedMethods]   = useState<PaymentMethodDetail[]>([]);
  const [loadingSaved,   setLoadingSaved]   = useState(false);
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccount,     setNewAccount]     = useState<NewAccountDraft>(BLANK_ACCOUNT);
  const [savingAccount,  setSavingAccount]  = useState(false);

  // Pi wallet for buy ads — where Pi is released when a trade completes
  const [selectedPiWallet, setSelectedPiWallet] = useState<PiWalletAddress | null>(null);

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

  const loadSavedMethods = useCallback(async () => {
    setLoadingSaved(true);
    try {
      const r = await paymentMethodsApi.getAll();
      setSavedMethods(r.data.paymentMethods);
    } catch (e) {
      logger.error('loadSavedMethods error:', e);
    } finally {
      setLoadingSaved(false);
    }
  }, []);

  useEffect(() => {
    loadMyAds();
    loadWallet();
    loadSavedMethods();
  }, [loadMyAds, loadWallet, loadSavedMethods]);

  // ── Payment account toggles ────────────────────────────────────────────────
  const toggleSavedAccount = (pmId: string) => {
    setForm((f) => ({
      ...f,
      selectedPmIds: f.selectedPmIds.includes(pmId)
        ? f.selectedPmIds.filter((id) => id !== pmId)
        : [...f.selectedPmIds, pmId],
    }));
  };

  const toggleAcceptedType = (type: PaymentMethodType) => {
    setForm((f) => ({
      ...f,
      acceptedTypes: f.acceptedTypes.includes(type)
        ? f.acceptedTypes.filter((t) => t !== type)
        : [...f.acceptedTypes, type],
    }));
  };

  // ── Add new account ────────────────────────────────────────────────────────
  const handleAddNewAccount = async () => {
    if (!newAccount.accountName.trim() || !newAccount.accountNumber.trim()) {
      showToast('Account name and number are required', true);
      return;
    }
    setSavingAccount(true);
    try {
      const payload: NewPaymentMethodDetail = {
        type:          newAccount.type,
        label:         PAYMENT_METHOD_LABELS[newAccount.type],
        accountName:   newAccount.accountName.trim(),
        accountNumber: newAccount.accountNumber.trim(),
        bankName:      newAccount.bankName.trim() || undefined,
        isDefault:     newAccount.isDefault,
      };
      await addPaymentMethod(payload);
      const r       = await paymentMethodsApi.getAll();
      const updated = r.data.paymentMethods;
      setSavedMethods(updated);
      const newest = updated[updated.length - 1];
      if (newest) {
        setForm((f) => ({ ...f, selectedPmIds: [...f.selectedPmIds, newest._id] }));
      }
      setNewAccount(BLANK_ACCOUNT);
      setShowNewAccount(false);
      showToast('Account saved and selected');
    } catch (e) {
      showToast('Failed to save account', true);
      logger.error('addPaymentMethod error:', e);
    } finally {
      setSavingAccount(false);
    }
  };

  // ── Open create / edit ─────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingAd(null);
    setForm(BLANK_FORM);
    setError('');
    setShowNewAccount(false);
    setSelectedPiWallet(null);
    setView('create');
  };

  const openEdit = (ad: Ad) => {
    setEditingAd(ad);
    const selectedIds: string[] = [];
    for (const detail of ad.paymentDetails) {
      const match = savedMethods.find(
        (pm) => pm.type === detail.type && pm.accountNumber === detail.accountNumber,
      );
      if (match) selectedIds.push(match._id);
    }
    setForm({
      type:             ad.type,
      piAmount:         String(ad.piAmount),
      minLimit:         String(ad.minLimit),
      maxLimit:         String(ad.maxLimit),
      pricePerPi:       String(ad.pricePerPi),
      selectedPmIds:    selectedIds,
      acceptedTypes:    ad.type === 'buy' ? [...ad.paymentMethods] : [],
      paymentWindow:    String(ad.paymentWindow),
      terms:            ad.terms     ?? '',
      autoReply:        ad.autoReply ?? '',
    });
    setError('');
    setShowNewAccount(false);
    setView('edit');
  };

  // ── Derived / validation ────────────────────────────────────────────────────
  const sellAdPi      = form.type === 'sell' ? Number(form.piAmount) || 0 : 0;
  const hasSufficient = !wallet || form.type !== 'sell' || wallet.piBalance >= sellAdPi;
  const balanceShort  = form.type === 'sell' && wallet ? Math.max(0, sellAdPi - wallet.piBalance) : 0;
  const isEditSell    = view === 'edit' && editingAd?.type === 'sell';
  const editMaxPi     = editingAd?.piAmount ?? Infinity;

  const sellMethodsValid  = form.type !== 'sell' || form.selectedPmIds.length > 0;
  const buyMethodsValid   = form.type !== 'buy'  || form.acceptedTypes.length > 0;
  /** Buy ads must have a Pi wallet selected so Pi can be released on completion */
  const buyWalletValid    = form.type !== 'buy'  || !!selectedPiWallet;

  // ── Payload builder ────────────────────────────────────────────────────────
  function buildPayload() {
    const isSell         = form.type === 'sell';
    const paymentDetails = isSell
      ? buildPaymentDetails(form.selectedPmIds, savedMethods)
      : [];
    const paymentMethods = isSell
      ? buildPaymentMethodTypes(form.selectedPmIds, savedMethods)
      : form.acceptedTypes;

    return {
      type:          form.type,
      piAmount:      Number(form.piAmount),
      minLimit:      Number(form.minLimit),
      maxLimit:      Number(form.maxLimit),
      pricePerPi:    Number(form.pricePerPi),
      paymentMethods,
      paymentDetails,
      paymentWindow: Number(form.paymentWindow),
      terms:         form.terms,
      autoReply:     form.autoReply,
      // For buy ads: persist the creator's Pi wallet so trades know where to release Pi
      ...(form.type === 'buy' && selectedPiWallet
        ? { piWalletAddress: { address: selectedPiWallet.address, tag: selectedPiWallet.tag } }
        : {}),
    };
  }

  // ── Submit (create) ────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!sellMethodsValid)  { setError('Select at least one payment account'); return; }
    if (!buyMethodsValid)   { setError('Select at least one accepted payment method'); return; }
    if (!buyWalletValid)    { setError('Select a Pi wallet address to receive Pi'); return; }

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
      const data = (err as { response?: { data?: { message?: string; needsDeposit?: boolean; shortfall?: number } } })?.response?.data;
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

    if (!sellMethodsValid) { setError('Select at least one payment account'); return; }
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
        paymentDetails: payload.paymentDetails,
        paymentWindow:  payload.paymentWindow,
        terms:          payload.terms,
        autoReply:      payload.autoReply,
      });
      showToast('Ad updated successfully!');
      await Promise.all([loadMyAds(), loadWallet()]);
      setView('list');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to update ad';
      setError(msg);
      showToast(msg, true);
      logger.error('updateAd error:', err);
    } finally { setSaving(false); }
  };

  // ── Ad status actions ──────────────────────────────────────────────────────
  const setAdStatus = async (ad: Ad, newStatus: AdStatus) => {
    try {
      await adsApi.updateAd(ad._id, { status: newStatus });
      setMyAds((prev) => prev.map((a) => a._id === ad._id ? { ...a, status: newStatus } : a));
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
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to delete ad';
      showToast(msg, true);
      logger.error('hardDeleteAd error:', e);
    }
  };

  // ── Action menu tracking ───────────────────────────────────────────────────
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
            <h1
              className="text-3xl font-bold"
              style={{ fontFamily: 'var(--font-display)' }}
            >
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
              <h2
                className="text-xl font-bold mb-1"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {view === 'create' ? 'Post New Ad' : 'Edit Ad'}
              </h2>

              {view === 'edit' && editingAd && (
                <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                  Editing {editingAd.type} ad · π{editingAd.availableAmount} remaining
                  {editingAd.type === 'sell' && ' · To increase Pi amount, cancel and re-create.'}
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
                          onClick={() => setForm((f) => ({ ...f, type: t }))}
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
                    {/* Balance warning — sell + create only */}
                    {view === 'create' && form.type === 'sell' && form.piAmount && !hasSufficient && (
                      <p className="mt-1.5 text-xs flex items-center gap-1" style={{ color: '#f87171' }}>
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
                      Price per Pi (₦)
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
                      Min Limit (₦)
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
                      Max Limit (₦)
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
                    SELL AD — pick from saved accounts or add new
                ════════════════════════════════════════════════════════ */}
                {form.type === 'sell' && (
                  <div>
                    <SectionHeader
                      label="Payment Accounts"
                      hint="Buyers will pay to these accounts"
                      required
                    />

                    {loadingSaved ? (
                      <div className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                        Loading your accounts…
                      </div>
                    ) : savedMethods.length === 0 && !showNewAccount ? (
                      <div
                        className="rounded-xl p-5 text-center mb-3"
                        style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border)' }}
                      >
                        <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
                          No saved payment accounts yet. Add one below.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowNewAccount(true)}
                          className="btn-pi text-sm px-4 py-2 rounded-lg"
                        >
                          + Add Account
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 mb-3">
                        {savedMethods.map((pm) => {
                          const selected = form.selectedPmIds.includes(pm._id);
                          return (
                            <button
                              key={pm._id}
                              type="button"
                              onClick={() => toggleSavedAccount(pm._id)}
                              className="w-full text-left rounded-xl p-4 transition-all"
                              style={{
                                background:  selected ? 'rgba(240,160,60,0.1)'      : 'var(--bg-elevated)',
                                border:      `1px solid ${selected ? 'rgba(240,160,60,0.4)' : 'var(--border)'}`,
                              }}
                            >
                              <div className="flex items-center gap-3">
                                {/* Checkbox indicator */}
                                <div
                                  className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                                  style={{
                                    background: selected ? 'var(--pi-gold)' : 'transparent',
                                    border:     `2px solid ${selected ? 'var(--pi-gold)' : 'var(--border)'}`,
                                  }}
                                >
                                  {selected && (
                                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                      <path
                                        d="M1 4l3 3 5-6"
                                        stroke="#0a0a0b"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="font-semibold text-sm"
                                      style={{ color: selected ? 'var(--pi-gold)' : 'var(--text-primary)' }}
                                    >
                                      {pm.accountName}
                                    </span>
                                    {pm.isDefault && (
                                      <span
                                        className="text-xs px-1.5 py-0.5 rounded"
                                        style={{ background: 'rgba(240,160,60,0.15)', color: 'var(--pi-gold)' }}
                                      >
                                        Default
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                    {PAYMENT_METHOD_LABELS[pm.type]}
                                    {pm.bankName && ` · ${pm.bankName}`}
                                    {' · '}
                                    <span style={{ fontFamily: 'var(--font-mono)' }}>
                                      {pm.accountNumber}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </button>
                          );
                        })}

                        {!showNewAccount && (
                          <button
                            type="button"
                            onClick={() => setShowNewAccount(true)}
                            className="w-full rounded-xl p-3 text-sm transition-all"
                            style={{
                              background:  'transparent',
                              border:      '1px dashed var(--border)',
                              color:       'var(--text-muted)',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(240,160,60,0.3)'; e.currentTarget.style.color = 'var(--pi-gold)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)';         e.currentTarget.style.color = 'var(--text-muted)'; }}
                          >
                            + Add new payment account
                          </button>
                        )}
                      </div>
                    )}

                    {showNewAccount && (
                      <NewAccountForm
                        account={newAccount}
                        saving={savingAccount}
                        onChange={(patch) => setNewAccount((a) => ({ ...a, ...patch }))}
                        onSave={handleAddNewAccount}
                        onCancel={() => { setShowNewAccount(false); setNewAccount(BLANK_ACCOUNT); }}
                      />
                    )}

                    {form.selectedPmIds.length === 0 && !showNewAccount && savedMethods.length > 0 && (
                      <p className="text-xs mt-2" style={{ color: '#f87171' }}>
                        Select at least one account for buyers to pay to.
                      </p>
                    )}
                  </div>
                )}

                {/* ════════════════════════════════════════════════════════
                    BUY AD — accepted payment types + Pi wallet
                ════════════════════════════════════════════════════════ */}
                {form.type === 'buy' && (
                  <div className="space-y-5">
                    <div>
                      <SectionHeader
                        label="Accepted Payment Methods"
                        hint="How you want sellers to pay you"
                        required
                      />
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

                    {/* Pi wallet picker — address Pi is released to when trade completes */}
                    <PiWalletPicker
                      selectedPiWallet={selectedPiWallet}
                      setSelectedPiWallet={setSelectedPiWallet}
                    />
                  </div>
                )}

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
    </div>
  );
}