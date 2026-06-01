'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { ThemeToggle, ThemeToggleIcon } from './Themetoggle';
import Image from 'next/image';

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
    <nav className="sticky top-0 z-50 border-b" style={{backdropFilter: 'blur(20px)', borderColor: 'var(--border-subtle)' }}>
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden"
          >
            <Image
              src="/logo.png"
              alt="Logo"
              width={50}
              height={50}
              className="object-contain w-full h-full p-0.5"
              priority
            />
          </div>
          <span className="font-bold text-lg" style={{ fontFamily: 'var(--font-display)' }}>
            on<span className="pi-text">Swap</span>
          </span>
        </Link>

        {/* Auth section */}
        <div className="flex items-center gap-3">
          <ThemeToggleIcon />
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
        </div>
      </div>
    </nav>
  );
}
