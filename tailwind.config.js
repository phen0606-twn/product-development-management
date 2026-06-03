/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Noto Sans TC', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        ink:      '#1a1229',   // 深紫黑（文字標題）
        mist:     '#f8f7fc',   // 近白帶紫（頁面底色）
        sun:      '#86B926',   // 萊姆綠（正面指標、剩餘庫存）
        leaf:     '#984696',   // Plum（主要按鈕、連結、active）
        coral:    '#C5AAE1',   // Tropical Violet（次要強調、hover 背景）
        sakura:   '#9DD0E0',   // Pale Cerulean（淺藍背景區塊、drilldown 條）
        cream:    '#C5AAE1',   // 同 coral
        navy:     '#572A87',   // Purple（側邊欄背景）
        navydark: '#3E651C',   // Dark Moss Green（強調數字、深色標記）
        moss:     '#3E651C',   // Dark Moss Green（重要數字）
        lime:     '#86B926',   // 同 sun
      },
      boxShadow: {
        soft: '0 16px 40px rgba(87, 42, 135, 0.08)',
      },
    },
  },
  plugins: [],
};
