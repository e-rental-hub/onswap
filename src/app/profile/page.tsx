'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// ── mock user – replace with your auth context ──────────────────────────────
const MOCK_USER = {
  displayName: 'Chukwuemeka O.',
  username: '@chukspi',
  piUid: 'PI-8821-XXXX',
  avatarInitials: 'CO',
  completedTrades: 47,
  rating: 4.9,
  memberSince: 'Jan 2024',
  verifiedKyc: true,
  piBalance: 320.5,
};

// ── types ────────────────────────────────────────────────────────────────────
type MenuSection = {
  title: string;
  items: MenuItem[];
};

type MenuItem = {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
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
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><dot cx="12" cy="17" r="1" /><circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none" />
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
  const u = MOCK_USER;

  const handleLogout = () => {
    // call your auth logout here
    router.push('/login');
  };

  const sections: MenuSection[] = [
    {
      title: 'Account',
      items: [
        {
          icon: Icon.user, label: 'Account Details',
          sublabel: 'Name, phone, bank info',
          href: '/profile/account', chevron: true,
        },
        {
          icon: Icon.switch, label: 'Pi Wallet Picker',
          sublabel: 'Switch your connected Pi wallet',
          href: '/profile/wallet-picker', chevron: true,
        },
        {
          icon: Icon.deposit, label: 'Deposit Pi',
          sublabel: 'Add Pi to your escrow balance',
          href: '/profile/deposit', chevron: true,
          badge: 'New',
        },
        {
          icon: Icon.wallet, label: 'Payment Methods',
          sublabel: 'Bank accounts & mobile money',
          href: '/profile/payment-methods', chevron: true,
        },
      ],
    },
    {
      title: 'Security',
      items: [
        {
          icon: Icon.shield, label: 'KYC & Verification',
          sublabel: u.verifiedKyc ? 'Fully verified' : 'Complete your identity check',
          href: '/profile/kyc', chevron: true,
          badge: u.verifiedKyc ? '✓ Verified' : 'Pending',
        },
        {
          icon: Icon.bell, label: 'Notifications',
          sublabel: 'Trade alerts, promotions',
          href: '/profile/notifications', chevron: true,
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: Icon.help, label: 'Help & FAQ',
          sublabel: 'How P2P trading works',
          href: '/help', chevron: true,
        },
        {
          icon: Icon.terms, label: 'Terms & Privacy',
          href: '/terms', chevron: true,
        },
        {
          icon: Icon.logout, label: 'Log Out',
          onClick: () => setShowLogout(true),
          danger: true,
        },
      ],
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: '88px' }}>

      {/* ── hero header ───────────────────────────────────────────── */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-elevated) 100%)',
        borderBottom: '1px solid var(--border)',
        padding: '48px 24px 32px',
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

        {/* Pi balance strip */}
        <div style={{
          marginTop: '24px',
          padding: '16px 20px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(244,160,23,0.12) 0%, rgba(244,160,23,0.05) 100%)',
          border: '1px solid rgba(244,160,23,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Escrow Balance
            </p>
            <p style={{
              fontSize: '26px', fontWeight: 800, color: '#f4a017', margin: 0,
              fontFamily: 'var(--font-display, Georgia, serif)',
            }}>
              π {u.piBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <Link href="/profile/deposit" style={{
            padding: '10px 18px', borderRadius: '12px',
            background: 'rgba(244,160,23,0.2)', border: '1px solid rgba(244,160,23,0.4)',
            color: '#f4a017', fontWeight: 700, fontSize: '13px', textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: '6px',
            transition: 'background 0.15s',
          }}>
            {Icon.deposit} Deposit
          </Link>
        </div>
      </div>

      {/* ── menu sections ─────────────────────────────────────────── */}
      <div style={{ padding: '16px', maxWidth: '640px', margin: '0 auto' }}>
        {sections.map((section) => (
          <div key={section.title} style={{ marginBottom: '24px' }}>
            <p style={{
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'var(--text-muted)',
              padding: '0 4px', marginBottom: '8px',
            }}>
              {section.title}
            </p>

            <div style={{
              borderRadius: '18px',
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              overflow: 'hidden',
            }}>
              {section.items.map((item, idx) => {
                const isLast = idx === section.items.length - 1;
                const inner = (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '15px 18px',
                    borderBottom: isLast ? 'none' : '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'background 0.12s',
                  }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* icon bubble */}
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '11px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: item.danger
                        ? 'rgba(239,68,68,0.1)'
                        : 'rgba(244,160,23,0.08)',
                      color: item.danger ? '#f87171' : '#f4a017',
                    }}>
                      {item.icon}
                    </div>

                    {/* text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        margin: 0, fontSize: '14px', fontWeight: 600,
                        color: item.danger ? '#f87171' : 'var(--text-primary)',
                        lineHeight: 1.2,
                      }}>
                        {item.label}
                      </p>
                      {item.sublabel && (
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                          {item.sublabel}
                        </p>
                      )}
                    </div>

                    {/* badge */}
                    {item.badge && (
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px',
                        background: item.badge.includes('✓')
                          ? 'rgba(74,222,128,0.12)'
                          : item.badge === 'New'
                            ? 'rgba(244,160,23,0.15)'
                            : 'rgba(251,191,36,0.12)',
                        color: item.badge.includes('✓')
                          ? '#4ade80'
                          : item.badge === 'New'
                            ? '#f4a017'
                            : '#fbbf24',
                        border: item.badge.includes('✓')
                          ? '1px solid rgba(74,222,128,0.25)'
                          : '1px solid rgba(244,160,23,0.25)',
                        whiteSpace: 'nowrap',
                      }}>
                        {item.badge}
                      </span>
                    )}

                    {/* chevron */}
                    {item.chevron && (
                      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                        {Icon.chevron}
                      </span>
                    )}
                  </div>
                );

                if (item.href) {
                  return (
                    <Link key={item.label} href={item.href} style={{ textDecoration: 'none', display: 'block' }}>
                      {inner}
                    </Link>
                  );
                }
                return (
                  <div key={item.label} onClick={item.onClick}>
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* version stamp */}
        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', paddingBottom: '8px' }}>
          PiXchange v1.0.0 · Escrow-protected P2P
        </p>
      </div>

      {/* ── logout confirm modal ───────────────────────────────────── */}
      {showLogout && (
        <LogoutModal
          onConfirm={handleLogout}
          onCancel={() => setShowLogout(false)}
        />
      )}
    </div>
  );
}