// components/p2p/PaymentAccountPicker.tsx

import React, { SetStateAction, useCallback, useEffect, useState } from 'react';
import { paymentMethodsApi } from '@/lib/api';
import { logger }   from '@/lib/logger';
import {
  PaymentMethodDetail,
  PAYMENT_METHOD_LABELS,
  NewPaymentMethodDetail,
  PaymentMethodEnum,
  PaymentMethodType,
  CurrencyEnum,
} from '@/types';
import { ALL_PAYMENT_TYPES, CURRENCIES } from '@/lib/constants';
import { useAuth }  from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { prefetchDNS } from 'react-dom';

// ─── Props ────────────────────────────────────────────────────────────────────

// FIX: Removed the duplicate `interface Props` declaration (one inside the
// file had an extra `accounts / setAccounts / onClose` which belonged only on
// the modal, not on the public picker API).  Each interface is now declared
// exactly once.

interface Props {
  selectedPaymentAccount:    PaymentMethodDetail | null;
  setSelectedPaymentAccount: React.Dispatch<SetStateAction<PaymentMethodDetail | null>>;
  label?:      string;
  hint?:       string;
  required?:   boolean;
  /** When true, enables editing and deleting of saved accounts */
  isEditMode?: boolean;
}

interface ModalProps {
  accounts:                  PaymentMethodDetail[];
  setAccounts:               React.Dispatch<SetStateAction<PaymentMethodDetail[]>>;
  selectedPaymentAccount:    PaymentMethodDetail | null;
  setSelectedPaymentAccount: React.Dispatch<SetStateAction<PaymentMethodDetail | null>>;
  onClose:                   () => void;
  isEditMode?:               boolean;
}

interface NewAccountDraft {
  type:          PaymentMethodType;
  accountName:   string;
  accountNumber: string;
  bankName:      string;
  isDefault:     boolean;
  currency:      CurrencyEnum;
}

const BLANK_ACCOUNT: NewAccountDraft = {
  type:          PaymentMethodEnum.bankTransfer,
  accountName:   '',
  accountNumber: '',
  bankName:      '',
  isDefault:     false,
  currency:      CurrencyEnum.NGN,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  label,
  hint,
  required,
}: {
  label:     string;
  hint?:     string;
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

function AccountRow({
  account,
  selected,
  onSelect,
  isEditMode,
  onEdit,
  onRemove,
}: {
  account:     PaymentMethodDetail;
  selected:    boolean;
  onSelect:    () => void;
  isEditMode?: boolean;
  onEdit?:     (account: PaymentMethodDetail) => void;
  onRemove?:   (accountId: string) => void;
}) {
  return (
    <div
      className="w-full text-left rounded-xl p-4 transition-all"
      style={{
        background: selected ? 'rgba(240,160,60,0.1)'              : 'var(--bg-elevated)',
        border:     `1px solid ${selected ? 'rgba(240,160,60,0.4)' : 'var(--border)'}`,
      }}
    >
      <div className="flex items-center gap-3">
        {/* Radio dot */}
        <button
          type="button"
          onClick={onSelect}
          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ border: `2px solid ${selected ? 'var(--pi-gold)' : 'var(--border)'}` }}
        >
          {selected && (
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--pi-gold)' }} />
          )}
        </button>

        {/* Label */}
        <button type="button" onClick={onSelect} className="flex-1 min-w-0 text-left">
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
        </button>

        {/* Edit / Remove — only in edit mode */}
        {isEditMode && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {onEdit && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEdit(account); }}
                className="text-xs px-2 py-1 rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)', background: 'var(--bg-card)' }}
                title="Edit account"
              >
                ✎
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(account._id); }}
                className="text-xs px-2 py-1 rounded-lg transition-colors"
                style={{ color: '#f87171', background: 'var(--bg-card)' }}
                title="Remove account"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── New account form ─────────────────────────────────────────────────────────

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

      {/* Account type picker */}
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

// ─── Edit account form ────────────────────────────────────────────────────────

function EditAccountForm({
  account,
  saving,
  onSave,
  onCancel,
}: {
  account:  PaymentMethodDetail;
  saving:   boolean;
  onSave:   (accountId: string, patch: Partial<NewPaymentMethodDetail>) => void;
  onCancel: () => void;
}) {
  const { preferredCurrency } = useAuth();

  const [accountName,   setAccountName]   = useState(account.accountName);
  const [accountNumber, setAccountNumber] = useState(account.accountNumber);
  const [bankName,      setBankName]      = useState(account.bankName ?? '');
  const [isDefault,     setIsDefault]     = useState(account.isDefault);

  return (
    <div
      className="rounded-xl p-5 mt-2"
      style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(240,160,60,0.2)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold" style={{ color: 'var(--pi-gold)' }}>
          Edit Account
        </p>
        <button type="button" onClick={onCancel} className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Cancel
        </button>
      </div>

      {/* Type is read-only when editing */}
      <div className="mb-3">
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
          Account Type
        </label>
        <p
          className="text-xs px-3 py-2 rounded-lg"
          style={{
            color: 'var(--text-muted)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
        >
          {PAYMENT_METHOD_LABELS[account.type]}
        </p>
      </div>

      <div className="mb-3">
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
          Account Currency
        </label>
        <p
          className="text-xs px-3 py-2 rounded-lg"
          style={{
            color: 'var(--text-muted)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
        >
          {account.currency? CURRENCIES.find((c) => c.code === account.currency)?.label : preferredCurrency.label}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Account Name *
          </label>
          <input
            className="input-dark text-sm"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Account Number *
          </label>
          <input
            className="input-dark text-sm"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Bank Name{account.type === 'bank_transfer' ? ' *' : ' (optional)'}
          </label>
          <input
            className="input-dark text-sm"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
        <div
          onClick={() => setIsDefault((v) => !v)}
          className="w-10 h-6 rounded-full relative transition-colors flex-shrink-0"
          style={{ background: isDefault ? 'var(--pi-gold)' : 'var(--border)' }}
        >
          <div
            className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
            style={{ left: isDefault ? '22px' : '4px' }}
          />
        </div>
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Set as default account
        </span>
      </label>

      <button
        type="button"
        onClick={() =>
          onSave(account._id, {
            accountName:   accountName.trim(),
            accountNumber: accountNumber.trim(),
            currency:      account.currency || preferredCurrency.code,
            bankName:      bankName.trim() || undefined,
            isDefault,
          })
        }
        disabled={saving || !accountName.trim() || !accountNumber.trim()}
        className="btn-pi w-full py-2.5 rounded-xl text-sm"
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function AccountDetailsModal({
  selectedPaymentAccount,
  setSelectedPaymentAccount,
  accounts,
  setAccounts,
  onClose,
  isEditMode,
}: ModalProps) {

  const { addPaymentMethod, preferredCurrency, updatePaymentMethod, removePaymentMethod } = useAuth();
  const { showToast } = useToast();

  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccount,     setNewAccount]     = useState<NewAccountDraft>(BLANK_ACCOUNT);
  const [saving,         setSaving]         = useState(false);
  const [step,           setStep]           = useState<'list' | 'new' | 'edit'>('list');
  const [editingAccount, setEditingAccount] = useState<PaymentMethodDetail | null>(null);

  // ── Refresh helper ─────────────────────────────────────────────────────────
  const refreshAccounts = async (): Promise<PaymentMethodDetail[]> => {
    const params: Record<string, string | number> = { currency: preferredCurrency.code };
    const r       = await paymentMethodsApi.getAll(params);
    const updated = (r.data.userAccountDetails ?? []) as PaymentMethodDetail[];
    setAccounts(updated);
    return updated;
  };

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

    // FIX: Hoist payload above try/catch so the catch block can reference it
    const payload: NewPaymentMethodDetail = {
      type:          newAccount.type,
      currency:      preferredCurrency.code,
      label:         PAYMENT_METHOD_LABELS[newAccount.type],
      accountName:   newAccount.accountName.trim(),
      accountNumber: newAccount.accountNumber.trim(),
      bankName:      newAccount.bankName.trim() || undefined,
      isDefault:     newAccount.isDefault,
    };

    setSaving(true);
    try {
      await addPaymentMethod(payload);
      const updated = await refreshAccounts();

      if (!updated.length) {
        showToast('Failed to load accounts after saving', true);
        return;
      }

      // FIX: Match by submitted values, not array position
      const justSaved =
        (payload.isDefault && updated.find((a) => a.isDefault)) ||
        updated.find(
          (a) =>
            a.accountNumber === payload.accountNumber &&
            a.accountName   === payload.accountName &&
            a.currency      === payload.currency
        ) ||
        updated[updated.length - 1];

      if (justSaved) setSelectedPaymentAccount(justSaved);

      setNewAccount(BLANK_ACCOUNT);
      setShowNewAccount(false);
      setStep('list');
      showToast('Account saved and selected');
    } catch (e: unknown) {
      // FIX: Handle 409 (account already exists) gracefully
      const status  = (e as { response?: { status?: number } })?.response?.status;
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;

      if (status === 409) {
        setNewAccount(BLANK_ACCOUNT);
        setShowNewAccount(false);
        try {
          const updated = await refreshAccounts();
          if (updated.length) {
            const existing = updated.find(
              (a) =>
                a.accountNumber === payload.accountNumber &&
                a.accountName   === payload.accountName &&
                a.currency      === payload.currency
            );
            if (existing) setSelectedPaymentAccount(existing);
          }
        } catch {
          // Non-fatal — list may be stale but the user can select manually
        }
        showToast(message ?? 'This account is already saved — selecting it for you', true);
      } else {
        showToast(message ?? 'Failed to save account', true);
      }
      logger.error('AccountDetailsModal handleSaveNew error:', e);
    } finally {
      setSaving(false);
    }
  };

  // ── Update existing account ───────────────────────────────────────────────
  const handleUpdateAccount = async (
    accountId: string,
    patch: Partial<NewPaymentMethodDetail>
  ) => {
    setSaving(true);
    try {
      await updatePaymentMethod(accountId, patch);
      const updated = await refreshAccounts();

      const stillExists = updated.find((a) => a._id === accountId);
      if (stillExists) setSelectedPaymentAccount(stillExists);

      setEditingAccount(null);
      setStep('list');
      showToast('Account updated');
    } catch (e) {
      showToast('Failed to update account', true);
      logger.error('AccountDetailsModal handleUpdateAccount error:', e);
    } finally {
      setSaving(false);
    }
  };

  // ── Remove account ────────────────────────────────────────────────────────
  const handleRemoveAccount = async (accountId: string) => {
    if (!window.confirm('Remove this payment account?')) return;
    try {
      await removePaymentMethod(accountId);
      const updated = await refreshAccounts();

      // If removed account was selected, fall back to default or first
      setSelectedPaymentAccount((current) => {
        if (!current || current._id !== accountId) return current;
        return updated.find((a) => a.isDefault) ?? updated[0] ?? null;
      });

      showToast('Account removed');
    } catch (e) {
      showToast('Failed to remove account', true);
      logger.error('AccountDetailsModal handleRemoveAccount error:', e);
    }
  };

  const handleCancelNew = () => {
    setShowNewAccount(false);
    setNewAccount(BLANK_ACCOUNT);
    setStep('list');
  };

  // FIX: Use _id comparison — after a re-fetch every object is a new
  // allocation, so === always returns false even when logically the same item.
  const isSelected = (account: PaymentMethodDetail): boolean =>
    !!selectedPaymentAccount && selectedPaymentAccount._id === account._id;

  const handleSelect = (account: PaymentMethodDetail) => {
    setSelectedPaymentAccount(account);
    if (!isEditMode) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 relative animate-slide-up"
        style={{ background: 'var(--bg-card)', border: '1px solid rgba(240,160,60,0.2)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              {isEditMode ? 'Manage' : 'Select or Add'}{' '}
              <span className="pi-text">Account Details</span>
            </h2>
            {/* FIX: Corrected typo "prferred" → "preferred" */}
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {isEditMode ? 'Edit or remove saved accounts' : 'Set preferred account as default'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>

        {/* Empty state */}
        {accounts.length === 0 && !showNewAccount && step === 'list' && (
          <div
            className="rounded-xl p-5 text-center mb-3"
            style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border)' }}
          >
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
              No saved payment accounts yet.
            </p>
            <button
              type="button"
              onClick={() => { setShowNewAccount(true); setStep('new'); }}
              className="btn-pi text-sm px-4 py-2 rounded-lg"
            >
              + Add Account
            </button>
          </div>
        )}

        {/* Accounts list */}
        {accounts.length > 0 && step === 'list' && (
          <div className="space-y-2 mb-3">
            {accounts.map((account) => (
              <AccountRow
                key={account._id}
                account={account}
                selected={isSelected(account)}
                onSelect={() => handleSelect(account)}
                isEditMode={isEditMode}
                onEdit={isEditMode ? (a) => { setEditingAccount(a); setStep('edit'); } : undefined}
                onRemove={isEditMode ? handleRemoveAccount : undefined}
              />
            ))}

            {!showNewAccount && (
              <button
                type="button"
                onClick={() => { setShowNewAccount(true); setStep('new'); }}
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

        {/* New account form */}
        {showNewAccount && step === 'new' && (
          <NewAccountForm
            account={newAccount}
            saving={saving}
            onChange={(patch) => setNewAccount((a) => ({ ...a, ...patch }))}
            onSave={handleSaveNew}
            onCancel={handleCancelNew}
          />
        )}

        {/* Edit account form */}
        {step === 'edit' && editingAccount && (
          <EditAccountForm
            account={editingAccount}
            saving={saving}
            onSave={handleUpdateAccount}
            onCancel={() => { setEditingAccount(null); setStep('list'); }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const PaymentAccountPicker: React.FC<Props> = ({
  label,
  hint,
  required,
  isEditMode,
  selectedPaymentAccount,
  setSelectedPaymentAccount,
}) => {

  const { preferredCurrency } = useAuth();

  const [accounts,          setAccounts]          = useState<PaymentMethodDetail[]>([]);
  const [loading,           setLoading]           = useState(false);
  const [showAccountModal,  setShowAccountModal]  = useState(false);

  // ── Fetch saved accounts ──────────────────────────────────────────────────
  // FIX: Use functional updater so we never reset a selection the user has
  // already made (stale-closure bug with dep array []).
  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { currency: preferredCurrency.code };
      const r    = await paymentMethodsApi.getAll(params);
      const list = (r.data.userAccountDetails ?? []) as PaymentMethodDetail[];
      setAccounts(list);

      setSelectedPaymentAccount((current) => {
        if (current || !list.length) return current;
        return list.find((a) => a.isDefault) ?? list[0];
      });
    } catch (e) {
      logger.error('PaymentAccountPicker fetchAccounts error:', e);
    } finally {
      setLoading(false);
    }
  }, [setSelectedPaymentAccount]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts, preferredCurrency]);

  // FIX: Use _id comparison
  const isSelected = (account: PaymentMethodDetail): boolean =>
    !!selectedPaymentAccount && selectedPaymentAccount._id === account._id;

  const resolvedLabel = label ?? 'Receiving Payment Account';
  const resolvedHint  = hint  ?? 'Buyer will send Naira to this account';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <SectionHeader label={resolvedLabel} hint={resolvedHint} required={required} />

      {loading && (
        <div className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
          Loading your accounts…
        </div>
      )}

      {!loading && accounts.length === 0 && (
        <div
          className="rounded-xl p-5 text-center mb-3"
          style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border)' }}
        >
          <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
            No saved payment accounts yet.
          </p>
          <button
            type="button"
            onClick={() => setShowAccountModal(true)}
            className="btn-pi text-sm px-4 py-2 rounded-lg"
          >
            + Add Account
          </button>
        </div>
      )}

      {!loading && selectedPaymentAccount && (
        <div className="space-y-2 mb-3">
          <AccountRow
            key={selectedPaymentAccount._id}
            account={selectedPaymentAccount}
            selected={isSelected(selectedPaymentAccount)}
            // Clicking the row in the summary just opens the modal
            onSelect={() => setShowAccountModal(true)}
            isEditMode={isEditMode}
            onEdit={isEditMode ? () => setShowAccountModal(true) : undefined}
            onRemove={isEditMode ? () => setShowAccountModal(true) : undefined}
          />

          {!showAccountModal && (
            <button
              type="button"
              onClick={() => setShowAccountModal(true)}
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
              {isEditMode ? '✎ Manage payment accounts' : '+ Change Selected Account'}
            </button>
          )}
        </div>
      )}

      {showAccountModal && (
        <AccountDetailsModal
          accounts={accounts}
          setAccounts={setAccounts}
          selectedPaymentAccount={selectedPaymentAccount}
          setSelectedPaymentAccount={setSelectedPaymentAccount}
          onClose={() => setShowAccountModal(false)}
          isEditMode={isEditMode}
        />
      )}
    </div>
  );
};

export default PaymentAccountPicker;