import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0a0a0f',
          900: '#0e0e15',
          800: '#15151f',
          700: '#1c1c28',
          600: '#272735',
          500: '#3a3a4c',
          400: '#5a5a72',
          300: '#8a8aa3',
          200: '#b8b8cc',
          100: '#e6e6ef',
        },
        ember: {
          DEFAULT: '#ff7a1a',
          50: '#fff4ec',
          100: '#ffe5d1',
          200: '#ffc69a',
          300: '#ffa05f',
          400: '#ff8a3a',
          500: '#ff7a1a',
          600: '#e85f00',
          700: '#b84a00',
          800: '#8a3700',
          900: '#5c2500',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      animation: {
        'fade-in': 'fadeIn 240ms ease-out',
        'rise-in': 'riseIn 320ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        shimmer: 'shimmer 1.8s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
