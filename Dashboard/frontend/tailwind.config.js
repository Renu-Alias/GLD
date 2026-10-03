/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-green': 'glowGreen 2s ease-in-out infinite alternate',
        'glow-amber': 'glowAmber 2s ease-in-out infinite alternate',
        'glow-red':   'glowRed 1.2s ease-in-out infinite alternate',
      },
      keyframes: {
        glowGreen: {
          '0%':   { boxShadow: '0 0 4px 1px rgba(34,197,94,0.4)' },
          '100%': { boxShadow: '0 0 12px 4px rgba(34,197,94,0.7)' },
        },
        glowAmber: {
          '0%':   { boxShadow: '0 0 4px 1px rgba(245,158,11,0.4)' },
          '100%': { boxShadow: '0 0 12px 4px rgba(245,158,11,0.7)' },
        },
        glowRed: {
          '0%':   { boxShadow: '0 0 6px 2px rgba(239,68,68,0.5)' },
          '100%': { boxShadow: '0 0 18px 6px rgba(239,68,68,0.85)' },
        },
      },
    },
  },
  plugins: [],
};
