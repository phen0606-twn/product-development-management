# Chart Style Guidelines — 商品開發管理系統

每次新增或修改圖表時，必須參照本規範，保持全系統視覺一致。

---

## 色系主題（Dream Colors #3）

| 角色 | 名稱 | Hex | 說明 |
|------|------|-----|------|
| 圖表主色 | Purple | `#572A87` | 主要折線、主要長條、業績數列 |
| 圖表次色 | Dark Lemon Lime | `#86B926` | 副數列、銷量折線（虛線）、正面指標 |
| 第三色 | Plum | `#984696` | 第三數列、負面指標 |
| 第四色 | Dark Moss Green | `#3E651C` | 第四數列、重要強調數字 |
| 第五色 | Pale Cerulean | `#9DD0E0` | 第五數列、淺色輔助 |
| 第六色 | Tropical Violet | `#C5AAE1` | 第六數列、最淺輔助 |
| 格線 | 淡紫灰 | `#f0ecf7` | CartesianGrid stroke |
| 座標軸文字 | 中灰紫 | `#9b8bae` | XAxis / YAxis tick fill |

---

## 共用樣式常數（src/App.tsx 頂部宣告）

```typescript
const CHART_PRIMARY    = '#572A87';   // Purple
const CHART_SECONDARY  = '#86B926';   // Dark Lemon Lime
const CHART_GRID       = '#f0ecf7';
const CHART_TICK       = { fontSize: 11, fill: '#9b8bae' } as const;
const CHART_TICK_MD    = { fontSize: 12, fill: '#9b8bae' } as const;
const CHART_TOOLTIP    = { borderRadius: 8, border: '1px solid #e2d9f3', fontSize: 12 } as const;
const CHART_LEGEND     = { fontSize: 12 } as const;
const CHART_MARGIN     = { top: 4, right: 16, left: 0, bottom: 0 } as const;
const CHART_STROKE_W   = 2.5;
const CHART_ACTIVE_DOT = { r: 6 } as const;
// 多數列圖表（依序使用）
const CHART_PALETTE = ['#572A87', '#86B926', '#984696', '#3E651C', '#9DD0E0', '#C5AAE1'] as const;
```

---

## 通路專屬顏色（CHANNEL_COLORS）

```typescript
const CHANNEL_COLORS: Record<string, string> = {
  '網路官網／平台': '#572A87',   // Purple
  '街邊店':        '#86B926',   // Lemon Lime
  '捷運門市':      '#984696',   // Plum
  '加盟門市':      '#3E651C',   // Dark Moss Green
};
```

---

## 圖表類型規範

### 折線圖（LineChart）
- 套件：Recharts `LineChart` + `ResponsiveContainer`
- 高度：單一數列 240px；多數列 260px
- 線條粗細：`strokeWidth={2.5}`
- 圓點：`dot={{ r: 4, fill: <color> }}`
- 互動點：`activeDot={{ r: 6 }}`
- 副數列虛線：`strokeDasharray="5 3"`, strokeWidth=2
- 多通路空值連線：加 `connectNulls`

### 長條圖（BarChart）
- 主色：`fill={CHART_PRIMARY}` (`#572A87`)
- 圓角：`radius={[4,4,0,0]}`（垂直）或 `radius={[0,4,4,0]}`（水平）
- HTML 進度條風格：顏色用 `bg-leaf`（Plum）或 `bg-sakura`（Pale Cerulean）

---

## Tailwind 色票對照

| Token | Hex | 用途 |
|-------|-----|------|
| `navy` | `#572A87` | 側邊欄背景 |
| `leaf` | `#984696` | 主要按鈕、active 選單、連結 |
| `sun` / `lime` | `#86B926` | 正面指標、成長、確認按鈕 |
| `moss` / `navydark` | `#3E651C` | 重要數字、深色強調 |
| `coral` | `#C5AAE1` | 次要強調、hover 背景 |
| `sakura` | `#9DD0E0` | 淺藍背景區塊 |
| `ink` | `#1a1229` | 標題文字 |
| `mist` | `#f8f7fc` | 頁面底色 |

---

## 背景與外框

- 圖表容器：透明（由外層 `<section>` 的 `bg-white` 提供白底）
- 圖表 SVG 層：無外框
- ResponsiveContainer：`width="100%"`，height 由各圖明確指定

---

## Y 軸格式化

| 場景 | 格式範例 | formatter |
|------|----------|-----------|
| 業績（萬元） | `$72萬` | `` (v) => `$${(v/10000).toFixed(0)}萬` `` |
| 數量（件） | `2,458` | `(v) => v.toLocaleString('zh-TW')` |
| 百分比 | `38.5%` | `` (v) => `${v.toFixed(1)}%` `` |

---

## Tooltip 格式化

```tsx
<Tooltip
  formatter={(value: number, name: string) =>
    name === '業績' ? [formatCurrency(value), name] : [`${value.toLocaleString('zh-TW')} 件`, name]
  }
  contentStyle={CHART_TOOLTIP}
/>
```

---

## 資料一致性驗證

`SalesPage`（業績追蹤）與 `ChannelAnalysisPage`（通路分析）對同月份的月度總業績差異超過 **0.5%** 時，顯示 `DataConsistencyWarning`。

```typescript
// useDataConsistencyCheck(month: string)
// 回傳 { salesTotal, channelTotal, diff, pct, ok } | null
```

---

## 版本記錄

| 日期 | 變更 |
|------|------|
| 2026-06-03 | 從 Artcoast 珊瑚色系更新為 Dream Colors #3（紫/萊姆綠/淡藍/深綠） |
