import type { Config } from 'tailwindcss';

// Design tokens mirrored from shared/src/tokens.ts (PRD section 7.1).
// Kept as a literal object here (rather than importing shared) so the
// Tailwind config stays a plain CJS/ESM-safe file for the build toolchain.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#06090D',
        panel: '#0E141C',
        line: '#1D2836',
        cyan: '#2FE6D2',
        violet: '#8B7CF6',
        amber: '#FFB454',
        magenta: '#FF4D6D',
        green: '#4ADE80',
        saffron: '#FF9933',
        'india-green': '#138808',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      keyframes: {
        'idle-bob': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.55', transform: 'scale(1.25)' },
        },
        'envelope-fly': {
          '0%': { offsetDistance: '0%', opacity: '0' },
          '8%': { opacity: '1' },
          '92%': { opacity: '1' },
          '100%': { offsetDistance: '100%', opacity: '0' },
        },
        // --- modern-UI motion additions ---
        'fade-slide-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.85)' },
          '60%': { opacity: '1', transform: 'scale(1.08)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 0px 0px currentColor' },
          '50%': { boxShadow: '0 0 8px 1px currentColor' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'cursor-blink': {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
      },
      animation: {
        'idle-bob': 'idle-bob 2.4s ease-in-out infinite',
        'pulse-dot': 'pulse-dot 1.6s ease-in-out infinite',
        'fade-slide-up': 'fade-slide-up 320ms cubic-bezier(0.16,1,0.3,1) both',
        'pop-in': 'pop-in 360ms cubic-bezier(0.34,1.56,0.64,1) both',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        shimmer: 'shimmer 3.5s linear infinite',
        'cursor-blink': 'cursor-blink 1s step-end infinite',
      },
    },
  },
  plugins: [],
};

export default config;
