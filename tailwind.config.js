/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Noto Sans TC', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        ink: '#1a2d3e',       // 深藍黑（標題文字）
        mist: '#f0f6fc',      // 淡藍底（頁面背景）
        sun: '#E13722',       // 深紅（庫存剩餘、警示）
        leaf: '#FD6C75',      // 珊瑚紅（主要 CTA、按鈕、連結）
        coral: '#FCC1BE',     // 淡粉（次要強調、通路色條）
        sakura: '#F8DADE',    // 極淡粉（背景色塊、drilldown 條）
        cream: '#F8DADE',     // 同 sakura
        navy: '#0070BB',      // 主藍（側邊欄背景）
        navydark: '#005786',  // 深藍（active 狀態、深色強調）
      },
      boxShadow: {
        soft: '0 16px 40px rgba(0, 112, 187, 0.08)',
      },
    },
  },
  plugins: [],
};
