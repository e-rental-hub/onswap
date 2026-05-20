'use client';
import { useTheme } from '@/hooks/useTheme';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <button onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className={`theme-toggle ${className}`} data-active={theme === 'dark' ? 'false' : 'true'}>
      <span className="theme-toggle-knob" />
    </button>
  );
}

export function ThemeToggleIcon({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <button onClick={toggleTheme} aria-label="Toggle theme"
      className={`rounded-lg px-2 py-1.5 text-base transition-colors ${className}`}
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}