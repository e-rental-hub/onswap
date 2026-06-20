'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { WalletCard } from '@/components/p2p/WalletCard';
import { CurrencyEnum, PAYMENT_METHOD_LABELS, PaymentMethodDetail, WalletSummary } from '@/types';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/lib/logger';
import { authApi, notificationsApi, walletApi } from '@/lib/api';
import { ALL_PAYMENT_TYPES, CURRENCIES } from '@/lib/constants';
import PaymentAccountPicker from '@/components/p2p/paymentAccountPicker';
import BottomNav from '@/components/layout/BottomNav';
import PiWalletPicker from '@/components/p2p/PiWalletAddressPicker';
import { CurrencyModal } from '@/components/CurrencyModal';
import { NotificationSettingsModal } from '@/components/NotificationSettingsModal';
import { MenuRow, MenuSection } from '@/components/MenuRow';

// ── types ────────────────────────────────────────────────────────────────────
type MenuSection = {
  title: string;
  items: MenuItem[];
};

type MenuItem = {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  name?: string;
  href?: string;
  onClick?: () => void;
  badge?: string;
  danger?: boolean;
  chevron?: boolean;
};

// ── icons (inline SVG keeps zero deps) ──────────────────────────────────────
const Icon = {
  user: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  ),
  wallet: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
      <path d="M16 3H8L4 7h16l-4-4z" /><circle cx="16" cy="13" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  deposit: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v14M5 10l7 7 7-7" /><line x1="3" y1="21" x2="21" y2="21" />
    </svg>
  ),
  switch: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 4l4 4-4 4" /><path d="M3 8h18" /><path d="M7 20l-4-4 4-4" /><path d="M21 16H3" />
    </svg>
  ),
  shield: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L3 7v7c0 5 9 8 9 8s9-3 9-8V7l-9-5z" />
    </svg>
  ),
  bell: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  help: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none" /><circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  terms: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="12" y2="17" />
    </svg>
  ),
  logout: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  chevron: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  verified: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  star: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
};

// ── logout modal ─────────────────────────────────────────────────────────────
function LogoutModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: '0 0 env(safe-area-inset-bottom)',
    }}>
      <div style={{
        width: '100%', maxWidth: '480px',
        background: 'var(--bg-card)', borderRadius: '24px 24px 0 0',
        border: '1px solid var(--border)', borderBottom: 'none',
        padding: '32px 24px 28px',
        animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'rgba(239,68,68,0.12)', margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#f87171',
          }}>
            {Icon.logout}
          </div>
          <p style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)', marginBottom: '6px' }}>
            Log out?
          </p>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            You'll need to sign in again to access your account and trades.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '14px', borderRadius: '12px',
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', fontWeight: 600, fontSize: '15px', cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '14px', borderRadius: '12px',
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171', fontWeight: 700, fontSize: '15px', cursor: 'pointer',
          }}>
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

// ── main page ────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter();
  const [showLogout, setShowLogout] = useState(false);
  const { user, preferredCurrency, logout, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [wallet,      setWallet]      = useState<WalletSummary | null>(null);
  const [selectedSellerAccount, setSelectedSellerAccount] = useState<PaymentMethodDetail | null>(null);
  const [selectedPiWalletId, setSelectedPiWalletId] = useState<string | null>(null);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showNotification, setShowNotification] = useState<boolean>(false)

  const u = {
    displayName: user?.displayName || user?.username,
    username: `@${user?.username}`,
    piUid: user?.piUid,
    avatarInitials: user?.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
    completedTrades: user?.completedTrades ?? 0,
    rating: user?.rating ?? 0,
    memberSince: user ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '',
    verifiedKyc: user?.kycVerified ?? false,
    piBalance: user?.piBalance ?? 0,
    preferredCurrency: CURRENCIES.find(c => c.code === user?.preferredCurrency)?.label || 'Set your currency',
  }

  // ── Loaders ─────────── ───────────────────────────────────────────────────── 
  const loadWallet = useCallback(async () => {
    try {
      const r = await walletApi.getBalance();
      setWallet(r.data);
    } catch (e) { logger.error('loadWallet error:', e); }
  }, []);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const sections: MenuSection[] = [
    {
      title: 'Support',
      items: [
        {
          icon: Icon.help, label: 'Help & FAQ',
          sublabel: 'How P2P trading works',
          href: '#', chevron: true,
        },
        {
          icon: Icon.terms, label: 'Terms & Privacy',
          href: '#', chevron: true,
        },
        {
          icon: Icon.logout, label: 'Log Out',
          onClick: () => setShowLogout(true),
          danger: true,
        },
      ],
    },
  ];

  if (!isAuthenticated || !user) {
    return router.push('/auth/login');
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: '88px' }}>

      {/* ── hero header ───────────────────────────────────────────── */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-elevated) 100%)',
        borderBottom: '1px solid var(--border)',
        padding: '16px',
        maxWidth: '700px',
        margin: '0 auto'
      }}>
        {/* decorative orb */}
        <div style={{
          position: 'absolute', top: '-40px', right: '-40px',
          width: '180px', height: '180px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(244,160,23,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-20px', left: '30%',
          width: '120px', height: '120px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(244,160,23,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* avatar + info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', position: 'relative' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: '68px', height: '68px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #f4a017, #e07b00)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', fontWeight: 800, color: '#000',
              fontFamily: 'var(--font-display, Georgia, serif)',
              boxShadow: '0 0 0 3px rgba(244,160,23,0.3)',
            }}>
              {u.avatarInitials}
            </div>
            {u.verifiedKyc && (
              <div style={{
                position: 'absolute', bottom: '-2px', right: '-2px',
                width: '22px', height: '22px', borderRadius: '50%',
                background: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid var(--bg-card)', color: '#000',
              }}>
                {Icon.verified}
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{
              fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)',
              fontFamily: 'var(--font-display, Georgia, serif)',
              margin: 0, lineHeight: 1.2,
            }}>
              {u.displayName}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '3px 0 6px' }}>
              {u.username} · {u.piUid}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                fontSize: '12px', color: '#f4a017', fontWeight: 600,
              }}>
                {Icon.star} {u.rating}
              </span>
              <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--border)' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {u.completedTrades} trades
              </span>
              <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--border)' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Since {u.memberSince}
              </span>
            </div>
          </div>
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
      </div>

      {/* ── menu sections ─────────────────────────────────────────── */}
      <div className='flex-col space-y-4'  style={{ padding: '16px', maxWidth: '640px', margin: '0 auto' }}>
        <p style={{
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--text-muted)',
          padding: '0 4px', marginBottom: '8px',
        }}>
          Account
        </p>
        <PaymentAccountPicker
          selectedPaymentAccount={selectedSellerAccount}
          setSelectedPaymentAccount={setSelectedSellerAccount}
          isEditMode={true}
          label="Your Payment Account"
          hint="Buyers will pay to this account"
          required
        />

        {/* Payment methods */}
        <div className="mt-5">
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
            PAYMENT METHODS
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_PAYMENT_TYPES.map((pm) => (
              <span
                key={pm}
                className="text-xs px-3 py-1.5 rounded-lg border"
                style={{
                  background:  'rgba(240,160,60,0.07)',
                  color:       'var(--text-secondary)',
                  borderColor: 'rgba(240,160,60,0.15)',
                }}
              >
                {PAYMENT_METHOD_LABELS[pm]}
              </span>
            ))}
          </div>
        </div>

        <PiWalletPicker
          selectedPiWalletId={selectedPiWalletId}
          setSelectedPiWalletId={setSelectedPiWalletId}
          isEditMode={true}
        />

        {/* Currency picker button */}
        <MenuSection title="Preferences">
          <MenuRow
            icon={Icon.bell}
            label="Notification settings"
            sublabel="WhatsApp, email, trade alerts"
            onClick={() => setShowNotification(true)}
            chevron
          />
          <MenuRow
            icon={<span style={{ fontSize: '18px' }}>{preferredCurrency.flag}</span>}
            label="Currency"
            sublabel="Preferred currency for prices"
            onClick={() => setShowCurrencyModal(true)}
            trailing={
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                  {preferredCurrency.code}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>▾</span>
              </span>
            }
          />
        </MenuSection>

        <MenuSection title="Support">
          <MenuRow icon={Icon.help} label="Help & FAQ" sublabel="How P2P trading works" href="#" chevron />
          <MenuRow icon={Icon.terms} label="Terms & Privacy" href="#" chevron />
          <MenuRow icon={Icon.logout} label="Log Out" onClick={() => setShowLogout(true)} danger />
        </MenuSection>

        {/* version stamp */}
        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', paddingBottom: '8px' }}>
          PiXchange v1.0.0 · Escrow-protected P2P
        </p>
      </div>

      {/* ── logout confirm modal ───────────────────────────────────── */}
      {showLogout && (
        <LogoutModal
          onConfirm={logout}
          onCancel={() => setShowLogout(false)}
        />
      )}

      {/* Currency modal */}
      {showCurrencyModal && (
        <CurrencyModal
          onClose={() => setShowCurrencyModal(false)}
        />
      )}
      
      {showNotification && (
        <NotificationSettingsModal onClose={() => setShowNotification(false)} />
      )}
      <BottomNav />
    </div>
  );
}