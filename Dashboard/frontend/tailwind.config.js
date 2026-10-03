/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  safelist: [
    // Severity row backgrounds (dynamically composed in IncidentHistory)
    'bg-rose-500/10', 'bg-amber-500/10', 'bg-emerald-500/5',
    // Severity border accents
    'border-l-rose-500', 'border-l-amber-500', 'border-l-emerald-500/40',
    // KPI top-border accents (dynamically composed in StatusBanner)
    'border-t-rose-500', 'border-t-amber-500', 'border-t-emerald-500',
    'border-t-indigo-500', 'border-t-slate-300',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'led-green': 'ledGreen 2s ease-in-out infinite alternate',
        'led-amber': 'ledAmber 2s ease-in-out infinite alternate',
        'led-red':   'ledRed 1s ease-in-out infinite alternate',
      },
      keyframes: {
        ledGreen: {
          '0%':   { boxShadow: '0 0 4px 2px rgba(16,185,129,0.35)' },
          '100%': { boxShadow: '0 0 16px 6px rgba(16,185,129,0.75)' },
        },
        ledAmber: {
          '0%':   { boxShadow: '0 0 4px 2px rgba(245,158,11,0.35)' },
          '100%': { boxShadow: '0 0 16px 6px rgba(245,158,11,0.75)' },
        },
        ledRed: {
          '0%':   { boxShadow: '0 0 6px 2px rgba(244,63,94,0.45)' },
          '100%': { boxShadow: '0 0 22px 8px rgba(244,63,94,0.90)' },
        },
      },
    },
  },
  plugins: [],
};
