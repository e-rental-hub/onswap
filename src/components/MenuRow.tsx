// MenuRow.tsx
import Link from 'next/link';
import { ReactNode, Children, isValidElement  } from 'react';

export type MenuRowProps = {
  icon?: ReactNode;
  iconBg?: string;       // override icon bubble background
  iconColor?: string;    // override icon color
  label: string;
  sublabel?: string;
  badge?: string;
  badgeTone?: 'success' | 'accent' | 'warning';
  trailing?: ReactNode;  // custom right-side content (overrides chevron)
  chevron?: boolean;
  danger?: boolean;
  href?: string;
  onClick?: () => void;
};

const Icon = {
  chevron: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m9 18 6-6-6-6" />
    </svg>
  ),
};

const badgeStyles: Record<string, { bg: string; color: string; border: string }> = {
  success: { bg: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' },
  accent:  { bg: 'rgba(244,160,23,0.15)', color: '#f4a017', border: '1px solid rgba(244,160,23,0.25)' },
  warning: { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(244,160,23,0.25)' },
};

export function MenuRow({
  icon, iconBg, iconColor, label, sublabel, badge, badgeTone = 'accent',
  trailing, chevron, danger, href, onClick,
}: MenuRowProps) {
  const tone = badgeStyles[badge?.includes('✓') ? 'success' : badgeTone];

  const content = (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        padding: '15px 18px',
        cursor: href || onClick ? 'pointer' : 'default',
        transition: 'background 0.12s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {icon && (
        <div style={{
          width: '38px', height: '38px', borderRadius: '11px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: iconBg ?? (danger ? 'rgba(239,68,68,0.1)' : 'rgba(244,160,23,0.08)'),
          color: iconColor ?? (danger ? '#f87171' : '#f4a017'),
        }}>
          {icon}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: '14px', fontWeight: 600,
          color: danger ? '#f87171' : 'var(--text-primary)',
          lineHeight: 1.2,
        }}>
          {label}
        </p>
        {sublabel && (
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            {sublabel}
          </p>
        )}
      </div>

      {badge && (
        <span style={{
          fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px',
          whiteSpace: 'nowrap',
          background: tone.bg, color: tone.color, border: tone.border,
        }}>
          {badge}
        </span>
      )}

      {trailing}

      {chevron && !trailing && (
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          {Icon.chevron}
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
        {content}
      </Link>
    );
  }
  return content;
}

// MenuSection.tsx — add divider logic
export function MenuSection({ title, children }: { title?: string; children: ReactNode }) {
  const items = Children.toArray(children);
  return (
    <div style={{ marginBottom: '24px' }}>
      {title && (
        <p style={{
          margin: '0 4px 8px', fontSize: '12px', fontWeight: 700,
          color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {title}
        </p>
      )}
      <div style={{
        borderRadius: '18px', border: '1px solid var(--border)',
        background: 'var(--bg-card)', overflow: 'hidden',
      }}>
        {items.map((child, idx) => (
          <div key={idx} style={{ borderBottom: idx === items.length - 1 ? 'none' : '1px solid var(--border)' }}>
            {isValidElement(child) ? child : null}
          </div>
        ))}
      </div>
    </div>
  );
}