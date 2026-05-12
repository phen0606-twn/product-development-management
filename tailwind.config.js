/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Noto Sans TC', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        ink: '#2a1a1a',
        mist: '#fff3f3',
        sun: '#fecf00',
        leaf: '#fd5e4b',
        coral: '#fd8391',
        sakura: '#fedbdf',
        cream: '#fddf98',
      },
      boxShadow: {
        soft: '0 16px 40px rgba(253, 94, 75, 0.08)',
      },
    },
  },
  plugins: [],
};
