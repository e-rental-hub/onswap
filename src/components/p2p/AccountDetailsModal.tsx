'use client';
import { useState, SetStateAction } from 'react';
import { paymentMethodsApi, walletApi }      from '@/lib/api';
import { NewPaymentMethodDetail, PAYMENT_METHOD_LABELS, PaymentMethodDetail, PaymentMethodEnum, PaymentMethodType }    from '@/types';
import { logger }         from '@/lib/logger';
import { ALL_PAYMENT_TYPES } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

interface NewAccountDraft {
  type:          PaymentMethodType;
  accountName:   string;
  accountNumber: string;
  bankName:      string;
  isDefault:     boolean;
}

const BLANK_ACCOUNT: NewAccountDraft = {
  type: PaymentMethodEnum.bankTransfer,
  accountName: '', accountNumber: '', bankName: '', isDefault: false,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function AccountRow({
  account,
  selected,
  onSelect,
}: {
  account:  PaymentMethodDetail;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left rounded-xl p-4 transition-all"
      style={{
        background: selected ? 'rgba(240,160,60,0.1)'              : 'var(--bg-elevated)',
        border:     `1px solid ${selected ? 'rgba(240,160,60,0.4)' : 'var(--border)'}`,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ border: `2px solid ${selected ? 'var(--pi-gold)' : 'var(--border)'}` }}
        >
          {selected && (
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--pi-gold)' }} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-semibold text-sm"
              style={{ color: selected ? 'var(--pi-gold)' : 'var(--text-primary)' }}
            >
              {account.accountName}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(240,160,60,0.1)', color: 'var(--pi-gold)' }}
            >
              {PAYMENT_METHOD_LABELS[account.type]}
            </span>
            {account.isDefault && (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(240,160,60,0.15)', color: 'var(--pi-gold)' }}
              >
                Default
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
            {account.bankName && `${account.bankName} · `}
            <span style={{ fontFamily: 'var(--font-mono)' }}>{account.accountNumber}</span>
          </p>
        </div>
      </div>
    </button>
  );
}

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
        <button type="button" onClick={onCancel} className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Cancel
        </button>
      </div>

      <div className="mb-3">
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
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
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
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
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
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

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  selectedPaymentAccount:    PaymentMethodDetail | null;
  setSelectedPaymentAccount: React.Dispatch<SetStateAction<PaymentMethodDetail | null>>;
  accounts:PaymentMethodDetail[];
  setAccounts: React.Dispatch<SetStateAction<PaymentMethodDetail[]>>;
  onClose:           () => void;
}

export function AccountDetailsModal({
  selectedPaymentAccount,
  setSelectedPaymentAccount,
  accounts,
  setAccounts,
  onClose,
}: Props) {

  const { addPaymentMethod } = useAuth();
  const { showToast }        = useToast();

  const [loading,        setLoading]        = useState(false);
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccount,     setNewAccount]     = useState<NewAccountDraft>(BLANK_ACCOUNT);
  const [saving,         setSaving]         = useState(false);
  const [step,         setStep]         = useState<'list' | 'new'>('list');
  
    // ── Save new account ──────────────────────────────────────────────────────
    const handleSaveNew = async () => {
      if (!newAccount.accountName.trim() || !newAccount.accountNumber.trim()) {
        showToast('Account name and number are required', true);
        return;
      }
      if (newAccount.type === 'bank_transfer' && !newAccount.bankName.trim()) {
        showToast('Bank name is required for bank transfers', true);
        return;
      }
  
      // FIX 3: Hoisted above try/catch so the catch block can reference it when
      // handling a 409 (payload declared inside try is out of scope in catch).
      const payload: NewPaymentMethodDetail = {
        type:          newAccount.type,
        label:         PAYMENT_METHOD_LABELS[newAccount.type],
        accountName:   newAccount.accountName.trim(),
        accountNumber: newAccount.accountNumber.trim(),
        bankName:      newAccount.bankName.trim() || undefined,
        isDefault:     newAccount.isDefault,
      };
  
      setSaving(true);
      try {
        await addPaymentMethod(payload);
  
        const r       = await paymentMethodsApi.getAll();
        const updated = (r.data.userAccountDetails ?? []) as PaymentMethodDetail[];
  
        if (!updated.length) {
          showToast('Failed to load accounts after saving', true);
          return;
        }
  
        setAccounts(updated);
  
        // FIX 4: Don't rely on array position to identify the saved account —
        // the server may sort or deduplicate the list. Match by submitted values,
        // falling back to the default account if flagged, then last element.
        const justSaved =
          (payload.isDefault && updated.find((a) => a.isDefault)) ||
          updated.find(
            (a) =>
              a.accountNumber === payload.accountNumber &&
              a.accountName   === payload.accountName
          ) ||
          updated[updated.length - 1];
  
        if (justSaved) setSelectedPaymentAccount(justSaved);
  
        setNewAccount(BLANK_ACCOUNT);
        setShowNewAccount(false);
        setStep('list');
        showToast('Account saved and selected');
      } catch (e: unknown) {
        // FIX 5: Inspect the error instead of always showing a generic toast.
        // On 409 the account already exists on the server — re-fetch so it
        // appears in the list, auto-select it, and close the form so the user
        // can proceed without re-entering anything.
        const status  = (e as { response?: { status?: number } })?.response?.status;
        const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
  
        if (status === 409) {
          setNewAccount(BLANK_ACCOUNT);
          setShowNewAccount(false);
          try {
            const r       = await paymentMethodsApi.getAll();
            const updated = (r.data.userAccountDetails ?? []) as PaymentMethodDetail[];
            if (updated.length) {
              setAccounts(updated);
              const existing = updated.find(
                (a) =>
                  a.accountNumber === payload.accountNumber &&
                  a.accountName   === payload.accountName
              );
              if (existing) setSelectedPaymentAccount(existing);
            }
          } catch {
            // Non-fatal — the list may be stale but the user can select manually.
          }
          showToast(message ?? 'This account is already saved — selecting it for you', true);
        } else {
          showToast(message ?? 'Failed to save account', true);
        }
        logger.error('PaymentAccountPicker handleSaveNew error:', e);
      } finally {
        setSaving(false);
      }
    };
  
    const handleCancelNew = () => {
      setShowNewAccount(false);
      setNewAccount(BLANK_ACCOUNT);
      setStep('list');
    };
  
    // ── Selection helpers ─────────────────────────────────────────────────────
  
    // FIX 6: Use _id comparison instead of reference equality (===).
    // After a re-fetch every object is a new allocation, so === always returns
    // false even when the same account is logically selected.
    const isSelected = (account: PaymentMethodDetail): boolean =>
      !!selectedPaymentAccount && selectedPaymentAccount._id === account._id;
  
    const handleSelect = (account: PaymentMethodDetail) => {
      setSelectedPaymentAccount(account);
      onClose();
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
              Select or Add <span className="pi-text">Account Details</span>
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Set prferred account as default
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>✕</button>
        </div>

        <div>
          {loading && (
            <div className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
              Loading your accounts…
            </div>
          )}

          {!loading && accounts.length === 0 && !showNewAccount && step === 'list' && (
            <div
              className="rounded-xl p-5 text-center mb-3"
              style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border)' }}
            >
              <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
                No saved payment accounts yet.
              </p>
              <button
                type="button"
                onClick={() => setShowNewAccount(true)}
                className="btn-pi text-sm px-4 py-2 rounded-lg"
              >
                + Add Account
              </button>
            </div>
          )}

          {!loading && accounts.length > 0  && step === 'list' && (
            <div className="space-y-2 mb-3">
              {accounts.map((account) => (
                <AccountRow
                  key={account._id}
                  account={account}
                  selected={isSelected(account)}
                  onSelect={() => handleSelect(account)}
                />
              ))}

              {!showNewAccount && (
                <button
                  type="button"
                  onClick={() => {
                    setShowNewAccount(true);
                    setStep('new');
                  }}
                  className="w-full rounded-xl p-3 text-sm transition-all"
                  style={{
                    background: 'transparent',
                    border:     '1px dashed var(--border)',
                    color:      'var(--text-muted)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(240,160,60,0.3)';
                    e.currentTarget.style.color       = 'var(--pi-gold)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.color       = 'var(--text-muted)';
                  }}
                >
                  + Add new payment account
                </button>
              )}
            </div>
          )}

          {showNewAccount && step === 'new' && (
            <NewAccountForm
              account={newAccount}
              saving={saving}
              onChange={(patch) => setNewAccount((a) => ({ ...a, ...patch }))}
              onSave={handleSaveNew}
              onCancel={handleCancelNew}
            />
          )}
        </div>

      </div>
    </div>
  );
}
