'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ username: '', email: '', password: '', displayName: '', piUid: '', phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      router.push('/p2p');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Registration failed';
      setError(msg);
      logger.error('Register failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: 'var(--bg-primary)' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(240,160,60,0.08) 0%, transparent 60%)' }} />

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold" style={{ background: 'linear-gradient(135deg,#f0a03c,#ec8518)', color: '#0a0a0b' }}>π</div>
            <span className="font-bold text-xl" style={{ fontFamily: 'var(--font-display)' }}>Pi<span className="pi-text">P2P</span></span>
          </Link>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Join Pi P2P</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Create your trading account</p>
        </div>

        <div className="card p-8" style={{ borderColor: 'var(--border)' }}>
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              {error}
            </div>
          )}

          <form onSubmit={handle} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Display Name</label>
                <input className="input-dark" placeholder="John Pi" value={form.displayName} onChange={set('displayName')} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Username</label>
                <input className="input-dark" placeholder="johnpi" value={form.username} onChange={set('username')} required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
              <input className="input-dark" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Pi UID</label>
              <input className="input-dark" placeholder="Your Pi Network UID" value={form.piUid} onChange={set('piUid')} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Phone (optional)</label>
              <input className="input-dark" type="tel" placeholder="+234..." value={form.phone} onChange={set('phone')} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Password</label>
              <input className="input-dark" type="password" placeholder="Min. 6 characters" value={form.password} onChange={set('password')} required minLength={6} />
            </div>
            <button type="submit" disabled={loading} className="btn-pi w-full py-3 rounded-xl mt-2">
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Already have an account? <Link href="/auth/login" className="font-medium" style={{ color: 'var(--pi-gold)' }}>Sign in →</Link>
        </p>
      </div>
    </div>
  );
}
