// components/wallet/PiWalletPicker.tsx

import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { piWalletsApi } from '@/lib/api';
import { logger } from '@/lib/logger';
import { NewPiWalletAddress, PiWalletAddress } from '@/types';
import React, { SetStateAction, useCallback, useEffect, useState } from 'react';

interface NewWallet {
  tag: string;
  address: string;
  isDefault: boolean;
}

interface Props {
  setSelectedPiWallet: React.Dispatch<SetStateAction<PiWalletAddress | null>>;
  selectedPiWallet: PiWalletAddress | null
}

const PiWalletPicker: React.FC<Props> = ({setSelectedPiWallet, selectedPiWallet}) => {
  const STELLAR_RE = /^G[A-Z2-7]{55}$/;
  const BLANK_WALLET: NewWallet = { address: '', tag: '', isDefault: false };
  
  const { isAuthenticated, addPiWalletAddress } = useAuth();
  const { toast, toastErr, showToast } = useToast();

  // Inline add-new-wallet state
  const [showNewWallet,  setShowNewWallet]  = useState(false);
  const [newWallet,  setNewWallet]  = useState<NewWallet>(BLANK_WALLET);
  const [savingWallet,   setSavingWallet]   = useState(false);
  const [savedWallets,   setSavedWallets]   = useState<PiWalletAddress[]>([]);
  const [loadingWallets, setLoadingWallets] = useState(false);
    
  
  const fetchSavedWallets = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingWallets(true);
    try {
      const res = await piWalletsApi.getAll();
      const wallets = res.data.piWalletAddresses;
      setSavedWallets(wallets);
      // Auto-select default wallet
      const def = wallets.find((w) => w.isDefault) ?? wallets[0];
      if (def) setSelectedPiWallet(def);
    } catch (e) {
      logger.error('fetchSavedWallets error:', e);
    } finally {
      setLoadingWallets(false);
    }
  }, [isAuthenticated]);
  
  useEffect(() => { fetchSavedWallets(); }, [fetchSavedWallets]);

  // ── Add new Pi wallet inline ──────────────────────────────────────────────
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
      const r = await piWalletsApi.getAll();
      const updated = r.data.piWalletAddresses;
      setSavedWallets(updated);
      const newest = updated[updated.length - 1];
      if (newest) setSelectedPiWallet(newest);
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
  
  return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <label
            className="text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            Receiving Pi Wallet{' '}
            <span style={{ color: '#f87171' }}>*</span>
          </label>

          <span
            className="text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            Pi will be sent here when trade completes
          </span>
        </div>

        {/* Loading */}
        {loadingWallets ? (
          <div
            className="text-sm py-4 text-center"
            style={{ color: 'var(--text-muted)' }}
          >
            Loading your wallets…
          </div>
        ) : savedWallets.length === 0 &&
          !showNewWallet ? (
          /* Empty state */
          <div
            className="rounded-xl p-5 text-center mb-3"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px dashed var(--border)',
            }}
          >
            <p
              className="text-sm mb-3"
              style={{ color: 'var(--text-muted)' }}
            >
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
        ) : (
          <div className="space-y-2 mb-3">
            {/* Saved wallets */}
            {savedWallets.map((w) => {
              const selected = selectedPiWallet ?
                selectedPiWallet._id === w._id : null;

              return (
                <button
                  key={w._id}
                  type="button"
                  onClick={() =>
                    setSelectedPiWallet(w)
                  }
                  className="w-full text-left rounded-xl p-4 transition-all"
                  style={{
                    background: selected
                      ? 'rgba(240,160,60,0.1)'
                      : 'var(--bg-elevated)',
                    border: `1px solid ${
                      selected
                        ? 'rgba(240,160,60,0.4)'
                        : 'var(--border)'
                    }`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    {/* radio */}
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        border: `2px solid ${
                          selected
                            ? 'var(--pi-gold)'
                            : 'var(--border)'
                        }`,
                      }}
                    >
                      {selected && (
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{
                            background: 'var(--pi-gold)',
                          }}
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-semibold text-sm"
                          style={{
                            color: selected
                              ? 'var(--pi-gold)'
                              : 'var(--text-primary)',
                          }}
                        >
                          {w.tag}
                        </span>

                        {w.isDefault && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{
                              background:
                                'rgba(240,160,60,0.15)',
                              color: 'var(--pi-gold)',
                            }}
                          >
                            Default
                          </span>
                        )}
                      </div>

                      <p
                        className="text-xs mt-0.5 truncate"
                        style={{
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {w.address}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Add new */}
            {!showNewWallet && (
              <button
                type="button"
                onClick={() => setShowNewWallet(true)}
                className="w-full rounded-xl p-3 text-sm transition-all"
                style={{
                  background: 'transparent',
                  border: '1px dashed var(--border)',
                  color: 'var(--text-muted)',
                }}
              >
                + Add new Pi wallet address
              </button>
            )}
          </div>
        )}

        {/* ═════════ New wallet form ═════════ */}
        {showNewWallet && (
          <div
            className="rounded-xl p-5 mt-2"
            style={{
              background: 'var(--bg-elevated)',
              border:
                '1px solid rgba(240,160,60,0.2)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <p
                className="text-sm font-semibold"
                style={{ color: 'var(--pi-gold)' }}
              >
                Add Pi Wallet Address
              </p>

              <button
                type="button"
                onClick={() => {
                  setShowNewWallet(false);
                  setNewWallet({
                    tag: '',
                    address: '',
                    isDefault: false,
                  });
                }}
                className="text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
            </div>

            {/* Inputs */}
            <div className="space-y-3 mb-4">
              <div>
                <label
                  className="block text-xs font-medium mb-1"
                  style={{
                    color: 'var(--text-secondary)',
                  }}
                >
                  Tag *
                </label>

                <input
                  className="input-dark text-sm"
                  placeholder="My Pi Wallet"
                  value={newWallet.tag}
                  onChange={(e) =>
                    setNewWallet((w) => ({
                      ...w,
                      tag: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label
                  className="block text-xs font-medium mb-1"
                  style={{
                    color: 'var(--text-secondary)',
                  }}
                >
                  Wallet Address (G…)
                </label>

                <input
                  className="input-dark text-sm w-full"
                  style={{
                    fontFamily: 'var(--font-mono)',
                  }}
                  maxLength={56}
                  value={newWallet.address}
                  onChange={(e) =>
                    setNewWallet((w) => ({
                      ...w,
                      address: e.target.value.trim(),
                    }))
                  }
                />

                {newWallet.address &&
                  !STELLAR_RE.test(
                    newWallet.address,
                  ) && (
                    <p
                      className="text-xs mt-1"
                      style={{ color: '#f87171' }}
                    >
                      Invalid address format
                    </p>
                  )}
              </div>
            </div>

            {/* Default */}
            <button
              type="button"
              onClick={() =>
                setNewWallet((w) => ({
                  ...w,
                  isDefault: !w.isDefault,
                }))
              }
              className="text-sm mb-4"
              style={{ color: 'var(--text-secondary)' }}
            >
              {newWallet.isDefault
                ? '✓ Default Wallet'
                : 'Set as default'}
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