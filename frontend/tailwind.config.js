/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // KFL Brand Colors
        kfl: {
          blue:   '#1565C0',
          green:  '#2E7D32',
          orange: '#E64A19',
        },
        primary: {
          50:  '#E3F2FD',
          100: '#BBDEFB',
          200: '#90CAF9',
          500: '#1E88E5',
          600: '#1565C0',
          700: '#0D47A1',
        },
        success: {
          50:  '#E8F5E9',
          100: '#C8E6C9',
          500: '#43A047',
          600: '#2E7D32',
        },
        warning: {
          50:  '#FFF3E0',
          100: '#FFE0B2',
          500: '#FF9800',
          600: '#F57C00',
        },
        danger: {
          50:  '#FFEBEE',
          100: '#FFCDD2',
          500: '#EF5350',
          600: '#E53935',
        },
      },
      fontFamily: {
        sans: ['Noto Sans Thai', 'Sarabun', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
