'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';
import { PiAuthButton } from '@/components/PiAuthButton';

export default function LoginPage() {
  const { loginWithPi } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (accessToken: string, piUid: string, piUsername: string) => {
    setError('');
    setLoading(true);
    try {
      await loginWithPi(accessToken, piUid, piUsername);
      router.push('/p2p');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Login failed';
      setError(msg);
      logger.error('Login failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(240,160,60,0.08) 0%, transparent 60%)' }} />

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold" style={{ background: 'linear-gradient(135deg,#f0a03c,#ec8518)', color: '#0a0a0b' }}>π</div>
            <span className="font-bold text-xl" style={{ fontFamily: 'var(--font-display)' }}>on<span className="pi-text">Swap</span></span>
          </Link>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Welcome back</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Sign in or Register by:</p>
        </div>

        <div className="card p-8" style={{ borderColor: 'var(--border)' }}>
          <p style={{ fontSize: 16, color: "#4b5563", lineHeight: 1.6 }} className='text-center mb-6'>
            To use your Pi Wallet and Identity, you must be browsing within the Pi Browser app.
          </p>
          
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              {error}
            </div>
          )}

          {/* Auth CTA */}
          <div className="mb-4 text-center">
            <PiAuthButton
              onAuthSuccess={handle}
              showToast={()=>{}}
            />
          </div>

          <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
            Authenticated securely via Pi Network SDK
          </p>
          {/* Version */}
          <p className="splash-version text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
            onSwap v1.0 · haycoder
          </p>
        </div>
      </div>
    </div>
  );
}
