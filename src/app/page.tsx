import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import PiPriceTicker from '@/components/PiPriceTicker';

export default function HomePage() {
  const features = [
    { icon: '🔒', title: 'Escrow Protection', desc: 'Pi is locked in escrow until payment is confirmed by both parties.' },
    { icon: '⚡', title: 'Fast Settlement', desc: 'Complete trades in minutes using Naira bank transfer and mobile money.' },
    { icon: '🛡️', title: 'Dispute Resolution', desc: 'Our admin team resolves disputes fairly with full trade history.' },
    { icon: '📊', title: 'Best Rates', desc: 'Competitive rates set by pioneers — not exchanges. You control the price.' },
  ];

  const steps = [
    { n: '01', title: 'Browse Ads', desc: 'Find buy or sell ads that match your preferred price and payment method.' },
    { n: '02', title: 'Start Trade', desc: 'Click trade — Pi is instantly locked in our secure escrow system.' },
    { n: '03', title: 'Send Payment', desc: 'Transfer Naira to the seller via bank transfer or mobile money.' },
    { n: '04', title: 'Receive Pi', desc: 'Seller confirms payment and Pi is released from escrow to your wallet.' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(240,160,60,0.12) 0%, transparent 70%)'
        }} />
        <div className="max-w-4xl mx-auto px-4 py-10 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6"
            style={{ background: 'rgba(240,160,60,0.1)', border: '1px solid rgba(240,160,60,0.2)', color: 'var(--pi-gold)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
            Live African Pi Exchange
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold mb-6 leading-none tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}>
            Trade Pi<br />
            <span className="pi-text">with Confidence</span>
          </h1>

          <p className="text-lg md:text-xl max-w-xl mx-auto mb-10 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Peer-to-peer Pi trading with escrow protection. Buy or sell Pi using African currency — safe, fast, and fully in your control.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/p2p">
              <button className="btn-pi text-base px-8 py-3.5 rounded-xl">Browse Market →</button>
            </Link>
            <Link href="/p2p/ads">
              <button className="btn-ghost text-base px-8 py-3.5 rounded-xl">Post an Ad</button>
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 pb-4">
        <PiPriceTicker />
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f) => (
            <div key={f.title} className="card p-6" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12" style={{ fontFamily: 'var(--font-display)' }}>
          How It <span className="pi-text">Works</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div key={s.n} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-6 left-full w-full h-px z-0" style={{ background: 'linear-gradient(90deg, rgba(240,160,60,0.3), transparent)' }} />
              )}
              <div className="relative z-10 text-center">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 font-bold text-sm"
                  style={{ background: 'rgba(240,160,60,0.1)', border: '1px solid rgba(240,160,60,0.2)', color: 'var(--pi-gold)', fontFamily: 'var(--font-mono)' }}>
                  {s.n}
                </div>
                <h3 className="font-bold mb-2 text-sm" style={{ color: 'var(--text-primary)' }}>{s.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="card p-10 pi-glow" style={{ borderColor: 'rgba(240,160,60,0.2)' }}>
          <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>Ready to trade?</h2>
          <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>Join thousands of pioneers trading Pi securely.</p>
          <Link href="/auth/login">
            <button className="btn-pi text-base px-8 py-3.5 rounded-xl">Create Free Account</button>
          </Link>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-xs" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
        onSwap · Not affiliated with Pi Network Core Team · Trade at your own discretion
      </footer>
    </div>
  );
}
