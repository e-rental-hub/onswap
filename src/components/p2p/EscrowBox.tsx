'use client';
import { Escrow } from '@/types';

interface Props {
  escrow: Escrow;
  nairaAmount: number;
}

const statusConfig = {
  pending: { icon: '⏳', label: 'Pending Lock', color: 'text-yellow-400', bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.2)' },
  locked: { icon: '🔒', label: 'Pi Locked in Escrow', color: 'text-orange-400', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)', pulse: true },
  released: { icon: '✅', label: 'Pi Released', color: 'text-green-400', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.25)' },
  refunded: { icon: '↩️', label: 'Pi Refunded', color: 'text-gray-400', bg: 'rgba(113,113,122,0.08)', border: 'rgba(113,113,122,0.25)' },
};

export default function EscrowBox({ escrow, nairaAmount }: Props) {
  const cfg = statusConfig[escrow.status];

  return (
    <div className="rounded-xl p-4" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${cfg.pulse ? 'escrow-pulse' : ''}`}
          style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
          {cfg.icon}
        </div>
        <div>
          <div className={`font-semibold text-sm ${cfg.color}`}>{cfg.label}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Escrow Protection Active</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Pi Locked</div>
          <div className="font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--pi-gold)' }}>π {escrow.piAmount.toLocaleString()}</div>
        </div>
        <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Naira Value</div>
          <div className="font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>₦{nairaAmount.toLocaleString()}</div>
        </div>
      </div>

      {escrow.txId && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: cfg.border }}>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            TX ID: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{escrow.txId}</span>
          </div>
        </div>
      )}

      <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
        {escrow.status === 'locked'
          ? 'Pi is safely held in escrow. It will be released once the seller confirms payment receipt.'
          : escrow.status === 'released'
          ? 'Pi has been successfully transferred to the buyer.'
          : escrow.status === 'refunded'
          ? 'Pi has been returned to the seller.'
          : 'Pi escrow is being set up.'}
      </p>
    </div>
  );
}
