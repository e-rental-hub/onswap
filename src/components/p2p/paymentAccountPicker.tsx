// components/p2p/PaymentAccountPicker.tsx
//
// Reusable payment-account selector (single mode — radio selection).
// Returns a full PaymentMethodDetail object via setSelectedPaymentAccount.
// Used in AdDetailPage so a Pi seller can pick the bank account
// they want to receive Naira payment on.

import React, { SetStateAction, useCallback, useEffect, useState } from 'react';
import { paymentMethodsApi } from '@/lib/api';
import { logger }   from '@/lib/logger';
import {
  PaymentMethodDetail,
  PAYMENT_METHOD_LABELS,
} from '@/types';
import { AccountDetailsModal } from './AccountDetailsModal';


// FIX 1: Removed the `multi?: false` stub left over from a stripped-out feature.
interface Props {
  selectedPaymentAccount:    PaymentMethodDetail | null;
  setSelectedPaymentAccount: React.Dispatch<SetStateAction<PaymentMethodDetail | null>>;
  label?:    string;
  hint?:     string;
  required?: boolean;
}

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

// ─── Main component ───────────────────────────────────────────────────────────

const PaymentAccountPicker: React.FC<Props> = ({
  label,
  hint,
  required,
  selectedPaymentAccount,
  setSelectedPaymentAccount,
}) => {

  const [accounts,       setAccounts]       = useState<PaymentMethodDetail[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);

  // ── Fetch saved accounts ──────────────────────────────────────────────────
  //
  // FIX 2: The original dep array was [], causing selectedPaymentAccount to be
  // permanently stale inside the callback (always null). The auto-select guard
  // `if (!selectedPaymentAccount)` therefore always passed, resetting the
  // user's pick on every re-fetch.
  //
  // Fix: use a functional updater in setSelectedPaymentAccount so the callback
  // reads live state without needing selectedPaymentAccount as a dep. The
  // setter itself is stable and safe to depend on.
  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const r    = await paymentMethodsApi.getAll();
      const list = (r.data.userAccountDetails ?? []) as PaymentMethodDetail[];
      setAccounts(list);

      // Auto-select the default (or first) account, but only when the user
      // has not already made a selection.
      setSelectedPaymentAccount((current) => {
        if (current || !list?.length) return current;
        return list.find((a) => a.isDefault) ?? list[0];
      });
    } catch (e) {
      logger.error('PaymentAccountPicker fetchAccounts error:', e);
    } finally {
      setLoading(false);
    }
  }, [setSelectedPaymentAccount]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  // ── Selection helpers ─────────────────────────────────────────────────────

  // FIX 6: Use _id comparison instead of reference equality (===).
  // After a re-fetch every object is a new allocation, so === always returns
  // false even when the same account is logically selected.
  const isSelected = (account: PaymentMethodDetail): boolean =>
    !!selectedPaymentAccount && selectedPaymentAccount._id === account._id;

  const handleSelect = (account: PaymentMethodDetail) => {
    setSelectedPaymentAccount(account);
  };

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
            onSelect={() => handleSelect(selectedPaymentAccount)}
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
              + Change Selected Account
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
        />
      )}
    </div>
  );
};

export default PaymentAccountPicker;