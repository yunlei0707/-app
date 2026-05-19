/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'var(--color-bg-secondary)',
          100: 'var(--color-warm-light)',
          200: 'var(--color-warm)',
          300: 'var(--color-primary-light)',
          400: 'var(--color-primary)',
          500: 'var(--color-primary)',
          600: 'var(--color-primary-dark)',
          700: 'var(--color-primary-dark)',
          800: '#B91C1C',
          900: '#991B1B',
        },
        warm: {
          50: 'var(--color-bg)',
          100: 'var(--color-bg-secondary)',
          200: 'var(--color-warm-light)',
          300: 'var(--color-warm)',
          400: '#F59E0B',
          500: '#D97706',
          600: '#B45309',
          700: '#92400E',
          800: '#78350F',
          900: '#451A03',
        },
        cream: {
          50: 'var(--color-bg)',
          100: 'var(--color-bg-secondary)',
          200: '#FFF1E6',
          300: '#FFEBDB',
          400: '#FFE5D0',
          500: '#FFDCC4',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', 'sans-serif'],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'card': '0 4px 20px -2px rgba(255, 127, 112, 0.15)',
      }
    },
  },
  plugins: [],
}
