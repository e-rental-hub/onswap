// components/wallet/PiWalletPicker.tsx

import { useAuth }  from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { piWalletsApi } from '@/lib/api';
import { logger }   from '@/lib/logger';
import { NewPiWalletAddress, PiWalletAddress } from '@/types';
import React, { SetStateAction, useCallback, useEffect, useState } from 'react';

// ─── Module-level constants (not recreated on every render) ───────────────────

const STELLAR_RE = /^G[A-Z2-7]{55}$/;

interface NewWallet {
  tag:       string;
  address:   string;
  isDefault: boolean;
}

const BLANK_WALLET: NewWallet = { address: '', tag: '', isDefault: false };

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  setSelectedPiWalletId: React.Dispatch<SetStateAction<string | null>>;
  selectedPiWalletId:    string | null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Shared label + optional hint row used above each section */
function SectionHeader({ label, hint, required }: { label: string; hint?: string; required?: boolean }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}{required && <span style={{ color: '#f87171' }}> *</span>}
      </label>
      {hint && (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {hint}
        </span>
      )}
    </div>
  );
}

/** Single saved-wallet radio row */
function WalletRow({
  wallet,
  selected,
  onSelect,
}: {
  wallet:   PiWalletAddress;
  selected: boolean;
  onSelect: () => void;
}) {

  const shortAddress =
  `${wallet.address.slice(0, 6)}...${wallet.address.slice(-6)}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left rounded-xl p-4 transition-all"
      style={{
        background:  selected ? 'rgba(240,160,60,0.1)' : 'var(--bg-elevated)',
        border:      `1px solid ${selected ? 'rgba(240,160,60,0.4)' : 'var(--border)'}`,
      }}
    >
      <div className="flex items-center gap-3">
        {/* Radio indicator */}
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

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="font-semibold text-sm"
              style={{ color: selected ? 'var(--pi-gold)' : 'var(--text-primary)' }}
            >
              {wallet.tag}
            </span>
            {wallet.isDefault && (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(240,160,60,0.15)', color: 'var(--pi-gold)' }}
              >
                Default
              </span>
            )}
          </div>
          <p
            className="text-xs mt-0.5 truncate"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            {shortAddress}
          </p>
        </div>
      </div>
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const PiWalletPicker: React.FC<Props> = ({ setSelectedPiWalletId, selectedPiWalletId }) => {
  const { isAuthenticated, addPiWalletAddress } = useAuth();
  const { showToast } = useToast();

  const [showNewWallet,  setShowNewWallet]  = useState(false);
  const [newWallet,      setNewWallet]      = useState<NewWallet>(BLANK_WALLET);
  const [savingWallet,   setSavingWallet]   = useState(false);
  const [savedWallets,   setSavedWallets]   = useState<PiWalletAddress[]>([]);
  const [loadingWallets, setLoadingWallets] = useState(false);

  // ── Fetch saved wallets ────────────────────────────────────────────────────
  const fetchSavedWallets = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingWallets(true);
    try {
      const res     = await piWalletsApi.getAll();
      const wallets = res.data.piWalletAddresses as PiWalletAddress[];
      setSavedWallets(wallets);
      // Auto-select default, then first
      const def = wallets.find((w) => w.isDefault) ?? wallets[0];
      if (def) setSelectedPiWalletId(def._id);
    } catch (e) {
      logger.error('fetchSavedWallets error:', e);
    } finally {
      setLoadingWallets(false);
    }
  }, [isAuthenticated, setSelectedPiWalletId]);

  useEffect(() => { fetchSavedWallets(); }, [fetchSavedWallets]);

  // ── Add new wallet ─────────────────────────────────────────────────────────
  const handleAddNewWallet = async () => {
    if (!newWallet.address.trim() || !newWallet.tag.trim()) {
      showToast('Address and tag name are required', true);
      return;
    }
    if (!STELLAR_RE.test(newWallet.address.trim())) {
      showToast('Invalid Pi wallet address — must start with G and be 56 characters', true);
      return;
    }
    setSavingWallet(true);
    try {
      const payload: NewPiWalletAddress = {
        address:   newWallet.address.trim(),
        tag:       newWallet.tag.trim(),
        isDefault: newWallet.isDefault,
      };
      await addPiWalletAddress(payload);
      const r       = await piWalletsApi.getAll();
      const updated = r.data.piWalletAddresses as PiWalletAddress[];
      setSavedWallets(updated);
      const newest  = updated[updated.length - 1];
      if (newest) setSelectedPiWalletId(newest._id);
      setNewWallet(BLANK_WALLET);
      setShowNewWallet(false);
      showToast('Wallet address saved and selected');
    } catch (e) {
      showToast('Failed to save wallet address', true);
      logger.error('addPiWalletAddress error:', e);
    } finally {
      setSavingWallet(false);
    }
  };

  const handleCancelNew = () => {
    setShowNewWallet(false);
    setNewWallet(BLANK_WALLET);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <SectionHeader
        label="Receiving Pi Wallet"
        hint="Pi will be sent here when trade completes"
        required
      />

      {/* Loading */}
      {loadingWallets && (
        <div className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
          Loading your wallets…
        </div>
      )}

      {/* Empty state */}
      {!loadingWallets && savedWallets.length === 0 && !showNewWallet && (
        <div
          className="rounded-xl p-5 text-center mb-3"
          style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border)' }}
        >
          <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
            No saved Pi wallet addresses yet.
          </p>
          <button
            type="button"
            onClick={() => setShowNewWallet(true)}
            className="btn-pi text-sm px-4 py-2 rounded-lg"
          >
            + Add Pi Wallet
          </button>
        </div>
      )}

      {/* Saved wallets list */}
      {!loadingWallets && savedWallets.length > 0 && (
        <div className="space-y-2 mb-3">
          {savedWallets.map((w) => (
            <WalletRow
              key={w._id}
              wallet={w}
              selected={selectedPiWalletId === w._id}
              onSelect={() => setSelectedPiWalletId(w._id)}
            />
          ))}

          {/* Add new — shown when no inline form is open */}
          {!showNewWallet && (
            <button
              type="button"
              onClick={() => setShowNewWallet(true)}
              className="w-full rounded-xl p-3 text-sm transition-all"
              style={{
                background:  'transparent',
                border:      '1px dashed var(--border)',
                color:       'var(--text-muted)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(240,160,60,0.3)'; e.currentTarget.style.color = 'var(--pi-gold)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)';         e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              + Add new Pi wallet address
            </button>
          )}
        </div>
      )}

      {/* ── New wallet inline form ── */}
      {showNewWallet && (
        <div
          className="rounded-xl p-5 mt-2"
          style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(240,160,60,0.2)' }}
        >
          {/* Form header */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold" style={{ color: 'var(--pi-gold)' }}>
              Add Pi Wallet Address
            </p>
            <button
              type="button"
              onClick={handleCancelNew}
              className="text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
          </div>

          {/* Fields */}
          <div className="space-y-3 mb-4">
            {/* Tag */}
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                Tag *
              </label>
              <input
                className="input-dark text-sm"
                placeholder="My Pi Wallet"
                value={newWallet.tag}
                onChange={(e) =>
                  setNewWallet((w) => ({ ...w, tag: e.target.value }))
                }
              />
            </div>

            {/* Address */}
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                Wallet Address (G…)
              </label>
              <input
                className="input-dark text-sm w-full"
                style={{ fontFamily: 'var(--font-mono)' }}
                maxLength={56}
                placeholder="G…"
                value={newWallet.address}
                onChange={(e) =>
                  setNewWallet((w) => ({ ...w, address: e.target.value.trim() }))
                }
              />
              {newWallet.address && !STELLAR_RE.test(newWallet.address) && (
                <p className="text-xs mt-1" style={{ color: '#f87171' }}>
                  Invalid address format
                </p>
              )}
            </div>
          </div>

          {/* Default toggle */}
          <button
            type="button"
            onClick={() => setNewWallet((w) => ({ ...w, isDefault: !w.isDefault }))}
            className="text-sm mb-4 flex items-center gap-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            <div
              className="w-9 h-5 rounded-full relative transition-colors flex-shrink-0"
              style={{ background: newWallet.isDefault ? 'var(--pi-gold)' : 'var(--border)' }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                style={{ left: newWallet.isDefault ? '18px' : '2px' }}
              />
            </div>
            {newWallet.isDefault ? 'Default Wallet' : 'Set as default'}
          </button>

          {/* Submit */}
          <button
            type="button"
            onClick={handleAddNewWallet}
            disabled={
              savingWallet ||
              !newWallet.tag.trim() ||
              !STELLAR_RE.test(newWallet.address)
            }
            className="btn-pi w-full py-2.5 rounded-xl text-sm"
          >
            {savingWallet ? 'Saving…' : 'Save Wallet'}
          </button>
        </div>
      )}
    </div>
  );
};

export default PiWalletPicker;