import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          yellow: '#F0B420',
          'yellow-dark': '#C8930D',
          'yellow-light': '#FEF3CC',
          red: '#BC2934',
          'red-dark': '#96202A',
          'red-light': '#FAEAEA',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          2: '#ECEAE4',
          3: '#E0DDD5',
        },
        'surface-dark': {
          DEFAULT: '#0d1117',
          2: '#161b22',
          3: '#1c2129',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '14px',
        lg: '20px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.05)',
        DEFAULT: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)',
        md: '0 8px 24px rgba(0,0,0,0.10)',
        lg: '0 20px 48px rgba(0,0,0,0.13)',
      },
      transitionTimingFunction: {
        brand: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'page-in': 'fade-in-up 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config