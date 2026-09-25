/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Surface layers — dark neutral base (not generic purple SaaS)
        surface: {
          0: '#08090d',   // page background
          1: '#0f1117',   // panel/sidebar
          2: '#161920',   // card/table row
          3: '#1d2029',   // elevated (modal, dropdown)
          4: '#242733',   // hover state
        },
        border: {
          subtle: '#1e2330',
          DEFAULT: '#2a2f3f',
          strong: '#3a4055',
        },
        // Text
        text: {
          primary: '#f0f2f8',
          secondary: '#a8b0c8',
          muted: '#596175',
          inverted: '#08090d',
        },
        // Brand — steel blue (precision instrument feel)
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Contact Status semantic colors (PRD §10.1)
        status: {
          'not-contacted': '#596175',    // neutral gray
          'contacted': '#3b82f6',         // blue
          'no-response': '#f59e0b',       // amber
          'call-back-later': '#8b5cf6',   // violet
          'follow-up-required': '#f97316', // orange
          'interested': '#10b981',        // emerald
          'not-interested': '#ef4444',    // red
          'registered': '#059669',        // green
          'closed': '#374151',           // dark gray
        },
        // Registration Status
        reg: {
          'not-registered': '#596175',
          'registration-pending': '#f59e0b',
          'registered': '#059669',
          'registration-cancelled': '#ef4444',
        },
        // Follow-up urgency
        urgency: {
          overdue: '#ef4444',
          today: '#f97316',
          upcoming: '#3b82f6',
          completed: '#059669',
        },
      },
      spacing: {
        // 4px base grid
        '4.5': '1.125rem',
        '13': '3.25rem',
        '15': '3.75rem',
        '18': '4.5rem',
      },
      fontSize: {
        // Table-optimized type scale
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.8125rem', { lineHeight: '1.25rem' }],
        'base': ['0.875rem', { lineHeight: '1.5rem' }],
        'lg': ['1rem', { lineHeight: '1.625rem' }],
        'xl': ['1.125rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.25rem', { lineHeight: '1.875rem' }],
        '3xl': ['1.5rem', { lineHeight: '2rem' }],
      },
      boxShadow: {
        'panel': '0 0 0 1px #1e2330, 0 4px 16px -2px rgba(0,0,0,0.4)',
        'dropdown': '0 0 0 1px #2a2f3f, 0 8px 24px -4px rgba(0,0,0,0.6)',
        'modal': '0 0 0 1px #2a2f3f, 0 16px 48px -8px rgba(0,0,0,0.7)',
        'focus': '0 0 0 2px #3b82f6',
      },
      borderRadius: {
        'sm': '4px',
        DEFAULT: '6px',
        'md': '8px',
        'lg': '10px',
        'xl': '14px',
      },
      animation: {
        'shimmer': 'shimmer 1.5s infinite linear',
        'fade-in': 'fadeIn 150ms ease-out',
        'slide-in-right': 'slideInRight 280ms cubic-bezier(0.2,0,0,1)',
        'slide-up': 'slideUp 200ms cubic-bezier(0.2,0,0,1)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideInRight: {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        slideUp: {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      transitionDuration: {
        // Motion Director tokens
        '100': '100ms',  // instant — micro feedback
        '180': '180ms',  // fast — tooltips, hover
        '280': '280ms',  // normal — dropdowns, badges
        '400': '400ms',  // relaxed — modals, drawers
      },
      transitionTimingFunction: {
        'standard': 'cubic-bezier(0.2, 0.0, 0.0, 1.0)',
        'emphasized': 'cubic-bezier(0.05, 0.7, 0.1, 1.0)',
        'exit': 'cubic-bezier(0.3, 0.0, 0.8, 0.15)',
      },
    },
  },
  plugins: [],
}
