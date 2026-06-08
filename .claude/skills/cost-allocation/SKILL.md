# 配件費用歸屬規範 — 商品開發管理系統

新增或修改費用相關功能時，必須參照本規範。

---

## 核心概念

**費用歸屬（Cost Attribution）** 是指某一商品（配件、包材、耗材）的費用，
要被計入另一個主商品批次的完整成本中。

### 典型場景
- MINI隨身包 for O款 的訂金/尾款 → 歸入 AS1SG0002 某批次
- 包材費用 → 歸入主商品批次

---

## 資料庫欄位（`development_costs` 表）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `product_id` | uuid | 費用直接歸屬的商品（配件本身） |
| `batch_id` | uuid | 費用直接歸屬的批次（配件本身的批次） |
| `attributed_to_batch_id` | uuid | **主要歸屬欄位**：費用計入哪個主商品批次的成本 |
| `attributed_to_product_id` | uuid | 舊版商品層級歸屬（廢棄中，只留給舊資料相容） |

### 欄位填寫規則
- `attributed_to_batch_id` 是主要機制，**新功能只讀寫此欄位**
- 若 `attributed_to_batch_id` 未設定，費用只計入自己商品的成本
- 若 `attributed_to_batch_id === batch_id`，等同「不歸入其他商品」
- 同一筆費用只能歸屬一個批次（`attributed_to_batch_id` 是單值）

---

## 成本計算邏輯

### 批次完整成本
```
批次完整成本 = 直接費用（batch_id = 此批次）
             + 歸入配件費用（attributed_to_batch_id = 此批次，product_id ≠ 此商品）
```

### 批次完整單位成本
```
完整單位成本 = 批次完整成本 ÷ 批次訂購數量
```

### 商品完整單位成本（商品列表顯示用）
```
商品完整單位成本 = (所有批次直接費用 + 歸入配件費用) ÷ 全部批次總訂購數量
```

---

## 前端元件規範

### CostForm（費用表單）
- **歸屬批次欄位**：可搜尋選擇任何商品的任何批次
  - 搜尋支援：商品名稱、SKU、批次名稱
  - 預設值：費用自身的 `batch_id`（若有）
  - 選了不同批次後，顯示 `✓ 此費用將歸入「商品名」批次「批次名」的完整成本`
- **儲存時**：寫入 `attributed_to_batch_id = 選擇的 batch id`（若未選則填入 `batch_id`）

### ProductDetailPage（商品詳情）
- 每個批次 header 右側：
  - 有歸入費用時，顯示「直接費用 + 配件 = 完整成本」分解
  - 單位成本欄位改為「完整單位成本」
- 批次費用表格最後一行（tbody）：顯示「▼ 歸入配件費用」子段落
  - 來源商品（連結）/ 說明 / 金額
  - tfoot 改為 `直接費用 + 配件 = 合計`
- 底部舊版商品層級區塊：只顯示有 `attributed_to_product_id` 且無 `attributed_to_batch_id` 的費用

### ProductsPage（商品列表）
- 「單位成本」欄位 = 商品完整單位成本
- 資料來源：`unitCostByProduct` Map（由 costs + batches 計算）
- 載入中顯示 `…`，無成本資料顯示 `—`

### CostsPage（費用管理月份表）
- 「歸屬批次」欄位：
  - `已歸入：商品名 / 批次名`（綠色 badge）— 歸入其他商品的批次
  - `批次名`（灰色）— 歸入自身批次
  - `—` — 未設定

---

## 防止重複計算規則

1. 一筆費用的 `attributed_to_batch_id` 只能有一個值
2. 配件商品本身的成本計算**不受影響**（只看 `product_id / batch_id`）
3. 在 CostsPage 月份表中，「已歸入」badge 提示使用者此費用已被其他批次計算
4. ProductDetailPage 的歸入費用（`attributed_to_batch_id` 指向此商品批次）
   和直接費用（`product_id === 此商品`）**不會重疊**（filter 條件互斥）

---

## 四層防護架構

### 第一層：資料庫觸發器（最底層）
PostgreSQL BEFORE INSERT/UPDATE trigger 確保：
若同時設定了 `batch_id` 和 `product_id`，則 `batch_id` 對應的批次必須屬於同一個 `product_id`。

```sql
CREATE OR REPLACE FUNCTION check_batch_product_consistency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.batch_id IS NOT NULL AND NEW.product_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM product_batches
      WHERE id = NEW.batch_id AND product_id = NEW.product_id
    ) THEN
      RAISE EXCEPTION 'batch_id 和 product_id 不一致：批次不屬於指定商品';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 第二層：表單防護（CostForm）
- **採購批次選單**：只顯示選定商品的批次（`b.product_id === data.product_id`），防止跨商品指定
- **歸屬批次提示**：若歸屬批次指向其他商品，顯示警告：
  > ⚠ 此費用將只計入目標商品成本，不會出現在本商品的費用明細

### 第三層：顯示層偵測（ProductDetailPage）
頁面載入時自動計算 `crossProductCosts`：

```typescript
const crossProductCosts = productCosts.filter((c) => {
  if (!c.attributed_to_batch_id) return false;
  const attrBatch = batches.rows.find((b) => b.id === c.attributed_to_batch_id);
  return attrBatch && attrBatch.product_id !== id;
});
```

若 `crossProductCosts.length > 0`，在「批次費用明細」上方顯示警告橫幅：
> ⚠️ 偵測到重複計算，請確認以下費用的歸屬

### 第四層：邏輯互斥（`attributedCostIds` Set）
`attributedByBatch`（其他商品歸入本商品的費用）與 `productCosts`（本商品直接費用）使用
`attributedCostIds` Set 確保完全互斥，不會在兩個區塊重複顯示同一筆費用。

---

## 版本記錄

| 日期 | 變更 |
|------|------|
| 2026-06-08 | 初版：從 product 層級歸屬升級為 batch 層級歸屬 |
| 2026-06-08 | 保留 `attributed_to_product_id` 舊版欄位相容 |
| 2026-06-08 | 新增四層防護架構（DB trigger、表單篩選、提示文字、顯示層偵測） |
