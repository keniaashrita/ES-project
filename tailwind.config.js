/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        charcoal: {
          950: '#07090e',
          900: '#0c0f17',
          850: '#111522',
          800: '#171d2e',
          700: '#232b42',
          600: '#344062',
        },
        lavender: {
          400: '#c4b5fd',
          500: '#a78bfa',
          600: '#8b5cf6',
          700: '#7c3aed',
        },
        cyber: {
          cyan: '#38bdf8',
          green: '#34d399',
          amber: '#fbbf24',
          rose: '#f43f5e'
        }
      },
      fontFamily: {
        mono: ['Fira Code', 'JetBrains Mono', 'Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [],
}