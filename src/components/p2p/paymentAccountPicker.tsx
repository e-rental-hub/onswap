// components/p2p/PaymentAccountPicker.tsx
//
// Reusable payment-account selector used in two modes:
//   Single (default) — radio selection, returns a full PaymentMethodDetail object.
//                      Used in AdDetailPage so a Pi seller can pick the bank account
//                      they want to receive Naira payment on.
//   Multi            — checkbox selection, returns a set of account _ids.
//                      Used in PostAdPage so a sell-ad creator can attach multiple
//                      accounts to an ad.

import React, { SetStateAction, useCallback, useEffect, useState } from 'react';
import { useAuth }  from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { paymentMethodsApi } from '@/lib/api';
import { logger }   from '@/lib/logger';
import {
  PaymentMethodDetail,
  NewPaymentMethodDetail,
  PaymentMethodType,
  PAYMENT_METHOD_LABELS,
} from '@/types';

// ─── Module-level constants ───────────────────────────────────────────────────

const ALL_PAYMENT_TYPES: PaymentMethodType[] = [
  'bank_transfer', 'opay', 'palmpay', 'kuda', 'moniepoint',
];

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

// ─── Props — discriminated union on `multi` ───────────────────────────────────

interface SingleProps {
  multi?:              false;
  selectedAccount:     PaymentMethodDetail | null;
  setSelectedAccount:  React.Dispatch<SetStateAction<PaymentMethodDetail | null>>;
  label?:              string;
  hint?:               string;
  required?:           boolean;
}

interface MultiProps {
  multi:        true;
  selectedIds:  string[];
  onToggle:     (id: string) => void;
  /** Called after a new account is saved so parent can auto-select it */
  onNewSaved?:  (account: PaymentMethodDetail) => void;
  label?:       string;
  hint?:        string;
  required?:    boolean;
}

type Props = SingleProps | MultiProps;

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

/** Single account row — renders as radio (single) or checkbox (multi) */
function AccountRow({
  account,
  selected,
  multi,
  onSelect,
}: {
  account:  PaymentMethodDetail;
  selected: boolean;
  multi:    boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left rounded-xl p-4 transition-all"
      style={{
        background:  selected ? 'rgba(240,160,60,0.1)'             : 'var(--bg-elevated)',
        border:      `1px solid ${selected ? 'rgba(240,160,60,0.4)' : 'var(--border)'}`,
      }}
    >
      <div className="flex items-center gap-3">
        {/* Indicator — circle for radio, square for checkbox */}
        {multi ? (
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
        ) : (
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              border: `2px solid ${selected ? 'var(--pi-gold)' : 'var(--border)'}`,
            }}
          >
            {selected && (
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: 'var(--pi-gold)' }}
              />
            )}
          </div>
        )}

        {/* Account details */}
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

      {/* Fields */}
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

// ─── Main component ───────────────────────────────────────────────────────────

const PaymentAccountPicker: React.FC<Props> = (props) => {
  const {
    label,
    hint,
    required,
  } = props;

  const isMulti = props.multi === true;

  const { addPaymentMethod } = useAuth();
  const { showToast }        = useToast();

  const [accounts,       setAccounts]       = useState<PaymentMethodDetail[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccount,     setNewAccount]     = useState<NewAccountDraft>(BLANK_ACCOUNT);
  const [saving,         setSaving]         = useState(false);

  // ── Fetch saved accounts ─────────────────────────────────────────────────
  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const r        = await paymentMethodsApi.getAll();
      const list     = r.data.paymentMethods as PaymentMethodDetail[];
      setAccounts(list);

      // Auto-select default (or first) for single mode only
      if (!isMulti && list.length > 0) {
        const singleProps = props as SingleProps;
        // Only auto-select if nothing is already selected
        if (!singleProps.selectedAccount) {
          const def = list.find((a) => a.isDefault) ?? list[0];
          singleProps.setSelectedAccount(def);
        }
      }
    } catch (e) {
      logger.error('PaymentAccountPicker fetchAccounts error:', e);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMulti]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  // ── Save new account ─────────────────────────────────────────────────────
  const handleSaveNew = async () => {
    if (!newAccount.accountName.trim() || !newAccount.accountNumber.trim()) {
      showToast('Account name and number are required', true);
      return;
    }
    if (newAccount.type === 'bank_transfer' && !newAccount.bankName.trim()) {
      showToast('Bank name is required for bank transfers', true);
      return;
    }
    setSaving(true);
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

      // Refresh the list
      const r       = await paymentMethodsApi.getAll();
      const updated = r.data.paymentMethods as PaymentMethodDetail[];
      setAccounts(updated);
      const newest  = updated[updated.length - 1];

      if (newest) {
        if (!isMulti) {
          // Single mode: auto-select the new account
          (props as SingleProps).setSelectedAccount(newest);
        } else {
          // Multi mode: notify parent to auto-toggle the new account
          (props as MultiProps).onNewSaved?.(newest);
        }
      }

      setNewAccount(BLANK_ACCOUNT);
      setShowNewAccount(false);
      showToast('Account saved and selected');
    } catch (e) {
      showToast('Failed to save account', true);
      logger.error('PaymentAccountPicker handleSaveNew error:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelNew = () => {
    setShowNewAccount(false);
    setNewAccount(BLANK_ACCOUNT);
  };

  // ── Helpers to check selection state ────────────────────────────────────
  const isSelected = (account: PaymentMethodDetail): boolean => {
    if (isMulti) {
      return (props as MultiProps).selectedIds.includes(account._id);
    }
    return (props as SingleProps).selectedAccount?._id === account._id;
  };

  const handleSelect = (account: PaymentMethodDetail) => {
    if (isMulti) {
      (props as MultiProps).onToggle(account._id);
    } else {
      (props as SingleProps).setSelectedAccount(account);
    }
  };

  // ── Defaults for label/hint based on mode ───────────────────────────────
  const resolvedLabel = label ?? (isMulti ? 'Payment Accounts' : 'Receiving Payment Account');
  const resolvedHint  = hint  ?? (isMulti
    ? 'Buyers will pay to these accounts'
    : 'Buyer will send Naira to this account');

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <SectionHeader label={resolvedLabel} hint={resolvedHint} required={required} />

      {/* Loading */}
      {loading && (
        <div className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
          Loading your accounts…
        </div>
      )}

      {/* Empty state */}
      {!loading && accounts.length === 0 && !showNewAccount && (
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

      {/* Account list */}
      {!loading && accounts.length > 0 && (
        <div className="space-y-2 mb-3">
          {accounts.map((account) => (
            <AccountRow
              key={account._id}
              account={account}
              selected={isSelected(account)}
              multi={isMulti}
              onSelect={() => handleSelect(account)}
            />
          ))}

          {/* Add new — shown when no inline form is open */}
          {!showNewAccount && (
            <button
              type="button"
              onClick={() => setShowNewAccount(true)}
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

      {/* Inline new account form */}
      {showNewAccount && (
        <NewAccountForm
          account={newAccount}
          saving={saving}
          onChange={(patch) => setNewAccount((a) => ({ ...a, ...patch }))}
          onSave={handleSaveNew}
          onCancel={handleCancelNew}
        />
      )}

      {/* Multi-mode validation hint */}
      {isMulti &&
        (props as MultiProps).selectedIds.length === 0 &&
        !showNewAccount &&
        accounts.length > 0 && (
          <p className="text-xs mt-2" style={{ color: '#f87171' }}>
            Select at least one account for buyers to pay to.
          </p>
        )}
    </div>
  );
};

export default PaymentAccountPicker;