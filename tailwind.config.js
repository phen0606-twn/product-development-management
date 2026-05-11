/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Noto Sans TC', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        ink: '#17202a',
        mist: '#eef5f4',
        sun: '#f4b942',
        leaf: '#3c8f7c',
        coral: '#dc6b56',
      },
      boxShadow: {
        soft: '0 16px 40px rgba(23, 32, 42, 0.08)',
      },
    },
  },
  plugins: [],
};
