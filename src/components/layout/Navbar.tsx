'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { href: '/p2p', label: 'Market' },
    { href: '/p2p/ads', label: 'Post Ad' },
    { href: '/p2p/orders', label: 'My Orders' },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b" style={{ background: 'rgba(10,10,11,0.92)', backdropFilter: 'blur(20px)', borderColor: 'var(--border-subtle)' }}>
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'linear-gradient(135deg,#f0a03c,#ec8518)', color: '#0a0a0b' }}>
            π
          </div>
          <span className="font-bold text-lg" style={{ fontFamily: 'var(--font-display)' }}>
            on<span className="pi-text">Swap</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                color: pathname.startsWith(link.href) ? 'var(--pi-gold)' : 'var(--text-secondary)',
                background: pathname.startsWith(link.href) ? 'rgba(240,160,60,0.08)' : 'transparent',
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Auth section */}
        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'linear-gradient(135deg,#f0a03c,#ec8518)', color: '#0a0a0b' }}>
                  {user.displayName[0].toUpperCase()}
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user.displayName}</span>
              </div>
              <button onClick={logout} className="btn-ghost text-sm px-3 py-1.5">
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/auth/login" className="btn-ghost text-sm px-4 py-2">Login</Link>
            </div>
          )}

          {/* Mobile hamburger */}
          <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)} style={{ color: 'var(--text-secondary)' }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2}>
              {menuOpen
                ? <><line x1="4" y1="4" x2="16" y2="16"/><line x1="16" y1="4" x2="4" y2="16"/></>
                : <><line x1="3" y1="6" x2="17" y2="6"/><line x1="3" y1="10" x2="17" y2="10"/><line x1="3" y1="14" x2="17" y2="14"/></>
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t px-4 py-3 space-y-1" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
              className="block px-4 py-2.5 rounded-lg text-sm font-medium"
              style={{ color: pathname.startsWith(link.href) ? 'var(--pi-gold)' : 'var(--text-secondary)' }}>
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
