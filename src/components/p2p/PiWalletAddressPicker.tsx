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
  /** When true, enables editing and deleting of saved wallets */
  isEditMode?:           boolean;
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
  isEditMode,
  onEdit,
  onRemove,
}: {
  wallet:      PiWalletAddress;
  selected:    boolean;
  onSelect:    () => void;
  isEditMode?: boolean;
  onEdit?:     (wallet: PiWalletAddress) => void;
  onRemove?:   (walletId: string) => void;
}) {
  const shortAddress =
    `${wallet.address.slice(0, 6)}...${wallet.address.slice(-6)}`;

  return (
    <div
      className="w-full text-left rounded-xl p-4 transition-all"
      style={{
        background:  selected ? 'rgba(240,160,60,0.1)' : 'var(--bg-elevated)',
        border:      `1px solid ${selected ? 'rgba(240,160,60,0.4)' : 'var(--border)'}`,
      }}
    >
      <div className="flex items-center gap-3">
        {/* Radio indicator — clicking it selects the wallet */}
        <button
          type="button"
          onClick={onSelect}
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
        </button>

        {/* Label + address — clicking also selects */}
        <button type="button" onClick={onSelect} className="flex-1 min-w-0 text-left">
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
        </button>

        {/* Edit / Remove actions — only rendered in edit mode */}
        {isEditMode && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {onEdit && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEdit(wallet); }}
                className="text-xs px-2 py-1 rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)', background: 'var(--bg-card)' }}
                title="Edit wallet"
              >
                ✎
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(wallet._id); }}
                className="text-xs px-2 py-1 rounded-lg transition-colors"
                style={{ color: '#f87171', background: 'var(--bg-card)' }}
                title="Remove wallet"
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

// ─── Edit wallet form ─────────────────────────────────────────────────────────

function EditWalletForm({
  wallet,
  saving,
  onSave,
  onCancel,
}: {
  wallet:   PiWalletAddress;
  saving:   boolean;
  onSave:   (walletId: string, patch: Partial<Pick<NewPiWalletAddress, 'tag' | 'isDefault'>>) => void;
  onCancel: () => void;
}) {
  const [tag,       setTag]       = useState(wallet.tag);
  const [isDefault, setIsDefault] = useState(wallet.isDefault);

  return (
    <div
      className="rounded-xl p-5 mt-2"
      style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(240,160,60,0.2)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold" style={{ color: 'var(--pi-gold)' }}>
          Edit Wallet
        </p>
        <button type="button" onClick={onCancel} className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Cancel
        </button>
      </div>

      {/* Address is read-only when editing */}
      <div className="mb-3">
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
          Wallet Address
        </label>
        <p
          className="text-xs px-3 py-2 rounded-lg"
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
        >
          {wallet.address}
        </p>
      </div>

      {/* Tag */}
      <div className="mb-3">
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
          Tag *
        </label>
        <input
          className="input-dark text-sm"
          placeholder="My Pi Wallet"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />
      </div>

      {/* Default toggle */}
      <button
        type="button"
        onClick={() => setIsDefault((v) => !v)}
        className="text-sm mb-4 flex items-center gap-2"
        style={{ color: 'var(--text-secondary)' }}
      >
        <div
          className="w-9 h-5 rounded-full relative transition-colors flex-shrink-0"
          style={{ background: isDefault ? 'var(--pi-gold)' : 'var(--border)' }}
        >
          <div
            className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
            style={{ left: isDefault ? '18px' : '2px' }}
          />
        </div>
        {isDefault ? 'Default Wallet' : 'Set as default'}
      </button>

      <button
        type="button"
        onClick={() => onSave(wallet._id, { tag: tag.trim(), isDefault })}
        disabled={saving || !tag.trim()}
        className="btn-pi w-full py-2.5 rounded-xl text-sm"
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  wallets:               PiWalletAddress[];
  setWallets:            React.Dispatch<SetStateAction<PiWalletAddress[]>>;
  selectedPiWalletId:    string | null;
  setSelectedPiWalletId: React.Dispatch<SetStateAction<string | null>>;
  onClose:               () => void;
  isEditMode?:           boolean;
}

function PiWalletModal({
  setSelectedPiWalletId,
  selectedPiWalletId,
  wallets,
  setWallets,
  onClose,
  isEditMode,
}: ModalProps) {

  const { addPiWalletAddress, updatePiWalletAddress, removePiWalletAddress } = useAuth();
  const { showToast } = useToast();

  const [showNewWallet,  setShowNewWallet]  = useState(false);
  const [newWallet,      setNewWallet]      = useState<NewWallet>(BLANK_WALLET);
  const [savingWallet,   setSavingWallet]   = useState(false);
  const [step,           setStep]           = useState<'list' | 'new' | 'edit'>('list');
  const [editingWallet,  setEditingWallet]  = useState<PiWalletAddress | null>(null);

  // ── Refresh helper ─────────────────────────────────────────────────────────
  const refreshWallets = async (): Promise<PiWalletAddress[]> => {
    const r = await piWalletsApi.getAll();
    const updated = r.data.piWalletAddresses as PiWalletAddress[];
    setWallets(updated);
    return updated;
  };

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
      const updated = await refreshWallets();

      // FIX: Identify saved wallet by matching values, not array position
      const saved =
        (payload.isDefault && updated.find((w) => w.isDefault)) ||
        updated.find((w) => w.address === payload.address && w.tag === payload.tag) ||
        updated[updated.length - 1];

      if (saved) setSelectedPiWalletId(saved._id);
      setNewWallet(BLANK_WALLET);
      setShowNewWallet(false);
      setStep('list');
      showToast('Wallet address saved and selected');
    } catch (e) {
      showToast('Failed to save wallet address', true);
      logger.error('addPiWalletAddress error:', e);
    } finally {
      setSavingWallet(false);
    }
  };

  // ── Update existing wallet ─────────────────────────────────────────────────
  const handleUpdateWallet = async (
    walletId: string,
    patch: Partial<Pick<NewPiWalletAddress, 'tag' | 'isDefault'>>
  ) => {
    setSavingWallet(true);
    try {
      await updatePiWalletAddress(walletId, patch);
      const updated = await refreshWallets();

      // Keep selection pointing at the same wallet after a tag/default change
      const stillExists = updated.find((w) => w._id === walletId);
      if (stillExists) setSelectedPiWalletId(stillExists._id);

      setEditingWallet(null);
      setStep('list');
      showToast('Wallet updated');
    } catch (e) {
      showToast('Failed to update wallet', true);
      logger.error('updatePiWalletAddress error:', e);
    } finally {
      setSavingWallet(false);
    }
  };

  // ── Remove wallet ──────────────────────────────────────────────────────────
  const handleRemoveWallet = async (walletId: string) => {
    if (!window.confirm('Remove this wallet address?')) return;
    try {
      await removePiWalletAddress(walletId);
      const updated = await refreshWallets();

      // If the removed wallet was selected, auto-select the default or first
      setSelectedPiWalletId((current) => {
        if (current !== walletId) return current;
        const fallback = updated.find((w) => w.isDefault) ?? updated[0];
        return fallback?._id ?? null;
      });

      showToast('Wallet removed');
    } catch (e) {
      showToast('Failed to remove wallet', true);
      logger.error('removePiWalletAddress error:', e);
    }
  };

  const handleCancelNew = () => {
    setShowNewWallet(false);
    setNewWallet(BLANK_WALLET);
    setStep('list');
  };

  const handleStartEdit = (wallet: PiWalletAddress) => {
    setEditingWallet(wallet);
    setShowNewWallet(false);
    setStep('edit');
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
              <span className="pi-text">Pi Wallet</span>
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {isEditMode ? 'Edit or remove saved wallets' : 'Set preferred Pi wallet address'}
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
        {wallets.length === 0 && !showNewWallet && step === 'list' && (
          <div
            className="rounded-xl p-5 text-center mb-3"
            style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border)' }}
          >
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
              No saved Pi wallet addresses yet.
            </p>
            <button
              type="button"
              onClick={() => { setShowNewWallet(true); setStep('new'); }}
              className="btn-pi text-sm px-4 py-2 rounded-lg"
            >
              + Add Pi Wallet
            </button>
          </div>
        )}

        {/* Saved wallets list */}
        {wallets.length > 0 && step === 'list' && (
          <div className="space-y-2 mb-3">
            {wallets.map((w) => (
              <WalletRow
                key={w._id}
                wallet={w}
                selected={selectedPiWalletId === w._id}
                onSelect={() => {
                  setSelectedPiWalletId(w._id);
                  // In non-edit mode close the modal on selection
                  if (!isEditMode) onClose();
                }}
                isEditMode={isEditMode}
                onEdit={isEditMode ? handleStartEdit : undefined}
                onRemove={isEditMode ? handleRemoveWallet : undefined}
              />
            ))}

            {!showNewWallet && step === 'list' && (
              <button
                type="button"
                onClick={() => { setShowNewWallet(true); setStep('new'); }}
                className="w-full rounded-xl p-3 text-sm transition-all"
                style={{
                  background:  'transparent',
                  border:      '1px dashed var(--border)',
                  color:       'var(--text-muted)',
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
                + Add new Pi wallet address
              </button>
            )}
          </div>
        )}

        {/* ── New wallet inline form ── */}
        {showNewWallet && step === 'new' && (
          <div
            className="rounded-xl p-5 mt-2"
            style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(240,160,60,0.2)' }}
          >
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
                  onChange={(e) => setNewWallet((w) => ({ ...w, tag: e.target.value }))}
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

        {/* ── Edit wallet inline form ── */}
        {step === 'edit' && editingWallet && (
          <EditWalletForm
            wallet={editingWallet}
            saving={savingWallet}
            onSave={handleUpdateWallet}
            onCancel={() => { setEditingWallet(null); setStep('list'); }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const PiWalletPicker: React.FC<Props> = ({
  setSelectedPiWalletId,
  selectedPiWalletId,
  isEditMode,
}) => {
  const { isAuthenticated } = useAuth();

  const [savedWallets,    setSavedWallets]    = useState<PiWalletAddress[]>([]);
  const [loadingWallets,  setLoadingWallets]  = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // ── Fetch saved wallets ────────────────────────────────────────────────────
  const fetchSavedWallets = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingWallets(true);
    try {
      const res     = await piWalletsApi.getAll();
      const wallets = res.data.piWalletAddresses as PiWalletAddress[];
      setSavedWallets(wallets);

      // FIX: Use functional updater so we never accidentally reset a selection
      // the user has already made (mirrors the PaymentAccountPicker fix).
      setSelectedPiWalletId((current) => {
        if (current || !wallets.length) return current;
        const def = wallets.find((w) => w.isDefault) ?? wallets[0];
        return def?._id ?? null;
      });
    } catch (e) {
      logger.error('fetchSavedWallets error:', e);
    } finally {
      setLoadingWallets(false);
    }
  }, [isAuthenticated, setSelectedPiWalletId]);

  useEffect(() => { fetchSavedWallets(); }, [fetchSavedWallets]);

  // Derive selected wallet object from the id
  const selectedWallet =
    savedWallets.find((w) => w._id === selectedPiWalletId) ??
    savedWallets.find((w) => w.isDefault) ??
    savedWallets[0] ??
    null;

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
      {!loadingWallets && savedWallets.length === 0 && !showWalletModal && (
        <div
          className="rounded-xl p-5 text-center mb-3"
          style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border)' }}
        >
          <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
            No saved Pi wallet addresses yet.
          </p>
          <button
            type="button"
            onClick={() => setShowWalletModal(true)}
            className="btn-pi text-sm px-4 py-2 rounded-lg"
          >
            + Add Pi Wallet
          </button>
        </div>
      )}

      {/* Saved wallets list — show selected wallet (or first) */}
      {!loadingWallets && savedWallets.length > 0 && !showWalletModal && selectedWallet && (
        <div className="space-y-2 mb-3">
          {/* FIX: Pass the correctly resolved wallet object, and fix broken
              onSelect that was passing the stale id back to itself */}
          <WalletRow
            wallet={selectedWallet}
            selected={true}
            onSelect={() => setShowWalletModal(true)}
            isEditMode={isEditMode}
            onEdit={isEditMode ? () => setShowWalletModal(true) : undefined}
            onRemove={isEditMode ? () => setShowWalletModal(true) : undefined}
          />

          <button
            type="button"
            onClick={() => setShowWalletModal(true)}
            className="w-full rounded-xl p-3 text-sm transition-all"
            style={{
              background:  'transparent',
              border:      '1px dashed var(--border)',
              color:       'var(--text-muted)',
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
            {isEditMode ? '✎ Manage Pi wallet addresses' : '+ Change Pi wallet address'}
          </button>
        </div>
      )}

      {/* Modal */}
      {showWalletModal && (
        <PiWalletModal
          wallets={savedWallets}
          setWallets={setSavedWallets}
          selectedPiWalletId={selectedPiWalletId}
          setSelectedPiWalletId={setSelectedPiWalletId}
          onClose={() => setShowWalletModal(false)}
          isEditMode={isEditMode}
        />
      )}
    </div>
  );
};

export default PiWalletPicker;