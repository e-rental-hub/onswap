/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        pi: {
          50: '#fef9f0',
          100: '#fdf0d5',
          200: '#faddaa',
          300: '#f6c274',
          400: '#f0a03c',
          500: '#ec8518',
          600: '#dd680e',
          700: '#b74d0e',
          800: '#923c13',
          900: '#773313',
          950: '#411806',
        },
        dark: {
          900: '#0a0a0b',
          800: '#111113',
          700: '#18181b',
          600: '#1f1f23',
          500: '#27272d',
          400: '#3a3a42',
        }
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
