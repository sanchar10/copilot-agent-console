/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'JetBrains Mono', 'SF Mono', 'Menlo', 'monospace'],
      },
      colors: {
        // Quiet Doc design tokens, exposed as Tailwind named colors so
        // `bg-qd-bg`, `text-qd-text`, `border-qd-border` etc. work.
        qd: {
          bg:           'var(--bg)',
          'bg-elev':    'var(--bg-elev)',
          panel:        'var(--panel)',
          'panel-deep': 'var(--panel-deep)',
          border:       'var(--border)',
          'border-soft':'var(--border-soft)',
          text:         'var(--text)',
          'text-dim':   'var(--text-dim)',
          'text-muted': 'var(--text-muted)',
          'text-inv':   'var(--text-inv)',
          accent:       'var(--accent)',
          'accent-soft':'var(--accent-soft)',
          'accent-soft-hover':'var(--accent-soft-hover)',
          'accent-text':'var(--accent-text)',
          'accent-border':'var(--accent-border)',
          'agent-mark': 'var(--agent-mark)',
          'status-running': 'var(--status-running)',
          'status-active':  'var(--status-active)',
          'status-error':   'var(--status-error)',
          'status-new':     'var(--status-new)',
        },
      },
      borderRadius: {
        'qd-sm': '5px',
        'qd-md': '7px',
        'qd-lg': '10px',
        'qd-xl': '14px',
      },
      boxShadow: {
        'qd-sm':  'var(--shadow-sm)',
        'qd-md':  'var(--shadow-md)',
        'qd-pop': 'var(--shadow-pop)',
      },
      transitionTimingFunction: {
        'qd-ease': 'cubic-bezier(.2, .8, .2, 1)',
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            code: {
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              color: '#7c3aed',
              padding: '0.125rem 0.25rem',
              borderRadius: '0.25rem',
              fontWeight: '400',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

