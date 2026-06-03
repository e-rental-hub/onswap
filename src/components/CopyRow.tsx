// ─── CopyRow ──────────────────────────────────────────────────────────────────

import { useState } from "react";

export function CopyRow({
  label,
  value,
  mono  = false,
  large = false,
}: {
  label: string;
  value: string;
  mono?:  boolean;
  large?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that block clipboard API
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.opacity  = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="flex justify-between items-center py-2.5 border-b"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <span className="text-sm flex-shrink-0 mr-3" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>

      <div className="flex items-center gap-2 min-w-0">
        <span
          className="font-bold truncate"
          style={{
            fontFamily: mono  ? 'var(--font-mono)' : 'inherit',
            color:      mono  ? 'var(--pi-gold)'   : 'var(--text-primary)',
            fontSize:   large ? '1.1rem'            : '0.875rem',
          }}
        >
          {value}
        </span>

        <button
          type="button"
          onClick={handleCopy}
          title={`Copy ${label}`}
          className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg transition-all"
          style={{
            background:   copied ? 'rgba(34,197,94,0.15)'  : 'var(--bg-elevated)',
            border:       `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
            color:        copied ? '#4ade80'                : 'var(--text-muted)',
          }}
        >
          {copied ? (
            // Checkmark
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            // Copy icon
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}