# Chart Style Guidelines — 商品開發管理系統

每次新增或修改圖表時，必須參照本規範，保持全系統視覺一致。

---

## 顏色規範

| 用途 | 顏色名稱 | Hex 值 | 說明 |
|------|----------|--------|------|
| 主色（單一折線／主要數列） | 珊瑚紅 | `#E8705A` | 業績折線、主要長條 |
| 次色（副數列、輔助折線） | 淺珊瑚 | `#F4A090` | 銷量折線（虛線）、次要數列 |
| 格線 | 淺藍灰 | `#f1f5f9` | CartesianGrid stroke |
| 座標軸文字 | 灰藍 | `#94a3b8` | XAxis / YAxis tick fill |

### 多通路折線圖專用顏色（CHANNEL_COLORS）
當一張圖需要同時呈現多條折線時，每條線使用各通路專屬顏色：

```typescript
const CHANNEL_COLORS: Record<string, string> = {
  '網路官網／平台': '#E8705A',  // 主色
  '街邊店':        '#F4A090',  // 次色
  '捷運門市':      '#fddf98',  // 奶黃
  '加盟門市':      '#4ECDC4',  // 藍綠
};
```

---

## 圖表類型規範

### 折線圖（LineChart）
- 套件：Recharts `LineChart` + `ResponsiveContainer`
- 高度：單一數列 240px；多數列 260px
- 線條粗細：`strokeWidth={2.5}`
- 圓點大小：`dot={{ r: 4, fill: <color> }}`
- 互動圓點：`activeDot={{ r: 6 }}`
- 虛線副數列：`strokeDasharray="5 3"`, strokeWidth=2
- 連接空值：多通路折線加 `connectNulls`

### 長條圖（BarChart）
- 套件：Recharts `BarChart` + `ResponsiveContainer` 或 HTML progress-bar 風格
- HTML 風格（庫存分佈類）：高度 `h-4`，圓角 `rounded-full`，顏色 `bg-coral`（`#fd8391`）
- Recharts 風格：`fill={CHART_PRIMARY}`, `radius={[4,4,0,0]}`

---

## 共用樣式設定

以下值在每一張圖表中必須統一，**不可硬編碼不同數字**：

```typescript
// src/App.tsx 頂部宣告
const CHART_PRIMARY   = '#E8705A';
const CHART_SECONDARY = '#F4A090';
const CHART_GRID      = '#f1f5f9';
const CHART_TICK      = { fontSize: 11, fill: '#94a3b8' } as const;
const CHART_TICK_MD   = { fontSize: 12, fill: '#94a3b8' } as const;
const CHART_TOOLTIP   = { borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 } as const;
const CHART_LEGEND    = { fontSize: 12 } as const;
const CHART_MARGIN    = { top: 4, right: 16, left: 0, bottom: 0 } as const;
const CHART_STROKE_W  = 2.5;
const CHART_ACTIVE_DOT = { r: 6 } as const;
```

---

## 背景與外框

- 圖表容器背景：**透明**（由外層 `<section>` 的 `bg-white` 提供白底）
- 圖表本身：**無外框**（不加 `stroke` 或 `border` 在 SVG 層）
- ResponsiveContainer：`width="100%"`，height 由各圖明確指定

---

## Y 軸格式化

| 場景 | 格式範例 | formatter 寫法 |
|------|----------|----------------|
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

每次載入頁面，`SalesPage`（業績追蹤）與 `ChannelAnalysisPage`（通路分析）
對同一個月份的「月度總業績」**必須一致**。

- `SalesPage` 來源：`sales_records`（逐 SKU 明細，`sold_at` 日期欄）
- `ChannelAnalysisPage` 來源：`channel_sales_records`（通路彙總，`sales_month` 欄）

差異超過 **0.5%** 時，在畫面頂部顯示 `DataConsistencyWarning` 警告橫幅。

```typescript
// 驗證 hook：useDataConsistencyCheck(month: string)
// 回傳 { salesTotal, channelTotal, diff, pct, ok } | null
```
