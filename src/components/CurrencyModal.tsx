import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { CURRENCIES } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { CurrencyEnum } from "@/types";

// ── Currency Picker Modal ─────────────────────────────────────────────────────
export function CurrencyModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const { setUserCurrency, setPreferredCurrency, preferredCurrency } = useAuth();
  const { showToast } = useToast();

  // ── Save selected Currency ─────────────────────────────────────────────────────────
  const handleSaveCurrency = async (currency: CurrencyEnum) => {
    if (!currency) {
      return;
    }
    
    try {
      await setUserCurrency(currency);
      showToast('selected currency saved as default')
    } catch (e) {
      showToast('Failed to save selected currency', true);
      logger.error('error changing currency:', e);
    } finally {
      const selectedCurrency = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];
      setPreferredCurrency(selectedCurrency);
      onClose();
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '480px',
          background: 'var(--bg-card)',
          borderRadius: '24px 24px 0 0',
          border: '1px solid var(--border)', borderBottom: 'none',
          padding: '28px 20px calc(28px + env(safe-area-inset-bottom))',
          animation: 'slideUp 0.22s cubic-bezier(0.34,1.4,0.64,1)',
        }}
      >
        <style>{`@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <p style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>Select Currency</p>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: '20px', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {CURRENCIES.map((c) => {
            const active = c.code === preferredCurrency.code;
            return (
              <button
                key={c.code}
                onClick={()=>handleSaveCurrency(c.code)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px 16px', borderRadius: '14px', cursor: 'pointer',
                  background: active ? 'rgba(244,160,23,0.1)' : 'var(--bg-elevated)',
                  border: active ? '1px solid rgba(244,160,23,0.35)' : '1px solid var(--border)',
                  transition: 'all 0.14s',
                }}
              >
                <span style={{ fontSize: '24px' }}>{c.flag}</span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <p style={{ fontWeight: 700, fontSize: '14px', color: active ? '#f4a017' : 'var(--text-primary)', margin: 0 }}>{c.code}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{c.label}</p>
                </div>
                <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-muted)' }}>{c.symbol}</span>
                {active && <span style={{ color: '#f4a017', fontWeight: 800, fontSize: '14px' }}>✓</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
