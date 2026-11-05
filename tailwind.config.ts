import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: { DEFAULT: '#1d4ed8', soft: '#e0e7ff' },
        ink: '#0f172a',
      },
      keyframes: {
        pop: { from: { transform: 'scale(.94)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        flash: { '50%': { color: '#facc15', transform: 'scale(1.04)' } },
      },
      animation: {
        pop: 'pop .3s ease',
        flash: 'flash 1s ease 3',
      },
    },
  },
  plugins: [],
} satisfies Config;
