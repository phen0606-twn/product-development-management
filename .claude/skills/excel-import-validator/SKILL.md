# Excel 匯入驗證規範 — 商品開發管理系統

每次修改 `import_sales.py` 的解析邏輯，或匯入新的業績 Excel 時，必須參照本規範執行全套驗證流程。

---

## 一、已知正確的 Excel 格式

### 1-A  各部門業績明細表（`*各部門業績明細表*.xlsx`）

**格式類型：通路優先（Store-First）**

```
Row 0: 商品 | 銷售總數量 | 實售總金額 | 銷售總成本 | 銷售總毛利   ← 表頭
Row 1: A000 網路官網    | 385 | 330037 | …             ← store header
Row 2:   石墨烯發熱衣BigRed  | 1 | 590 | …            ← 商品分類行（跳過）
Row 3:     網路官網           | 1 | 590 | …            ← 子通路行（跳過）
Row 4:       AH1HC0005BK3 黑圓領 男L … | 1 | 590 | … ← 個別 SKU 行 ✅
...
Row 97: A002 中壢中原   | 65 | 56284 | …              ← 下一個 store header
Row 98:   輕摺疊UV帽 BigRed | 3 | 1770 | …
Row 99:     中壢中原          | 3 | 1770 | …
Row 100:      AS1SB0020BK4 … | 1 | 590 | …            ← 個別 SKU 行 ✅
```

**關鍵識別規則：**

| 列的類型 | 識別方式 | 處理方式 |
|---------|---------|---------|
| Store header | 開頭符合 `A\d{3}` / `E\d{3}` / `000\d{3}` 後接空格 | 設定 `current_store`，記入 store_totals |
| 商品分類行 | 純中文，無英數前綴（如「石墨烯發熱衣BigRed」） | 跳過 |
| 子通路行 | 純中文，無英數前綴（如「網路官網」、「中壢中原」） | 跳過 |
| 個別 SKU 行 | 開頭符合 `[A-Za-z]{2}\d`（如 `AH1…`、`AS1…`、`AD1…`） | 建立 product_store_rows，累計至 sku_totals |

**欄位對應（col index 從 0 起算）：**

| 欄位 | Index | 說明 |
|------|-------|------|
| 商品/門市名稱 | 0 | Store header 或 SKU 代碼 + 品名 |
| 銷售總數量 | 1 | `int`；退貨為負數 |
| 實售總金額 | 2 | `int`；退貨為負數；某些調整列為 `None` |
| 銷售總成本 | 3 | 可忽略 |
| 銷售總毛利 | 4 | 可忽略 |

**⚠ 常見誤判（勿混淆）：**
- 表頭確實在 Row 0（`header_index == 0`），但第一筆資料仍是 store header，**不是** SKU 行
- 舊格式（商品優先）的表頭不在 Row 0，需靠 `period_end_date` 從 Row 0 讀週期文字
- 格式偵測方法：讀取 `data_start` 後第一筆非空列，若符合 store header pattern → store-first format

---

### 1-B  通路代碼 → 通路分類對照

```python
def classify_store(label: str) -> str:
    if re.search(r'000|E\d{3}|網路|平台|MOMO|大紅哥|團購|暫存倉', label):
        return '網路官網／平台'
    if re.search(r'捷運|M6', label):
        return '捷運門市'
    if re.search(r'高雄|台南|台中|新竹|宜蘭', label):
        return '加盟門市'
    return '街邊店'
```

**已知特殊通路代碼（2026-05 資料）：**

| 代碼 | 門市名稱 | 通路分類 |
|------|---------|---------|
| A000 | 網路官網 | 網路官網／平台 |
| E006 | MOMO | 網路官網／平台 |
| E009 | 蝦皮倉 | 網路官網／平台 |
| E012 | 公關品倉 | 網路官網／平台（revenue=None）|
| E014 | 大紅哥的 | 網路官網／平台（revenue=None）|
| 000000 | 總倉 | 網路官網／平台（revenue=None）|
| 000014 | 團購倉 | 網路官網／平台（qty 可為負）|
| 000022 | 平台暫存倉 | 網路官網／平台（qty 可為負）|
| A040–A065 | 各捷運門市 | 捷運門市 |
| A010、A011、A013 等 | 高雄/台南/台中/新竹/宜蘭各店 | 加盟門市 |
| A002、A004、A007 等 | 台北/桃園/基隆等店 | 街邊店 |

---

### 1-C  已知的特殊情況

#### 輔大捷運店 / 蝦皮倉 重複問題

**現象：** Excel 中 A057（輔大捷運店）和 E009（蝦皮倉）各出現兩次。  
同一 SKU × 同一門市因此有兩筆記錄，與 `product_store_sales` 的 unique constraint 衝突。

**處理方式（已實作）：** `_parse_store_first` 結尾對 `product_store_rows` 去重合併：
```python
ps_agg: dict = {}
for row in product_store_rows:
    key = (row["external_sku"], row["channel_category"], row["store_name"])
    if key not in ps_agg:
        ps_agg[key] = row.copy()
    else:
        ps_agg[key]["quantity"] += row["quantity"]
        ps_agg[key]["revenue"]  += row["revenue"]
product_store_rows = list(ps_agg.values())
```

**預期結果（2026-05）：**

| 資料表 | 預期筆數 |
|--------|---------|
| sales_records | 118 筆（119 個唯一 SKU，其中 1 筆 qty/rev=0 被過濾）|
| channel_sales_records | 4 筆（4 個通路）|
| channel_store_sales_records | 41 筆（41 個門市）|
| product_store_sales | 1,257 筆（1,273 個 SKU×門市，去重後）|
| 業績總計 | qty = 2,458 件，revenue = $2,064,424 |

---

## 二、每次匯入前必須執行的驗證清單

### Step 1：解析前先確認 Excel 結構

執行以下檢查，印出前 10 筆非空資料行：

```python
def validate_excel_structure(rows: list) -> dict:
    """
    回傳 {ok: bool, format: str, header_index: int, first_data_rows: list, warnings: list}
    """
    # 1. 找表頭
    header_index = -1
    for i, row in enumerate(rows):
        cells = [str(c).strip() for c in row if c is not None]
        if "商品" in cells and "實售總金額" in cells:
            header_index = i
            break

    if header_index < 0:
        return {"ok": False, "error": "找不到表頭列（需包含「商品」和「實售總金額」）"}

    data_start = header_index + 1
    preview_rows = []
    for row in rows[data_start:]:
        label = str(row[0] or "").strip() if row else ""
        if label and label != "總計":
            preview_rows.append(row[:5])
        if len(preview_rows) >= 10:
            break

    print(f"\n  [結構預覽] 表頭在第 {header_index} 列，資料從第 {data_start} 列開始")
    print(f"  前 {len(preview_rows)} 筆非空資料行：")
    for i, r in enumerate(preview_rows):
        print(f"    [{i}] {r}")

    # 2. 偵測格式
    import re
    STORE_RE = re.compile(r"^(A\d{3}|E\d{3}|000\d{3})\s+")
    first_data_label = ""
    for row in rows[data_start:]:
        label = str(row[0] or "").strip() if row else ""
        if label:
            first_data_label = label
            break

    fmt = "store-first" if STORE_RE.match(first_data_label) else "product-first"
    print(f"  偵測格式：{fmt}（第一筆資料：{first_data_label!r}）")

    warnings = []
    if fmt not in ("store-first", "product-first"):
        warnings.append(f"未知格式：{first_data_label!r}")

    return {
        "ok": True,
        "format": fmt,
        "header_index": header_index,
        "first_data_rows": preview_rows,
        "warnings": warnings,
    }
```

**若格式與預期不符，立即停止並回報**（見第三節）。

---

### Step 2：解析後金額一致性驗證

```python
def validate_parsed_totals(parsed: dict) -> bool:
    """
    1. sales_rows 業績總計 == channel_rows 業績總計
    2. channel_rows 業績總計 == store_rows 業績總計
    3. product_store_rows 業績總計 == store_rows 業績總計
    """
    sales_rev   = sum(r["revenue"]  for r in parsed["sales_rows"])
    channel_rev = sum(r["revenue"]  for r in parsed["channel_rows"])
    store_rev   = sum(r["revenue"]  for r in parsed["store_rows"])
    ps_rev      = sum(r["revenue"]  for r in parsed["product_store_rows"])

    tolerance = 1  # 允許 $1 以內的浮點誤差

    ok = True
    checks = [
        ("sales_rows vs channel_rows", sales_rev, channel_rev),
        ("channel_rows vs store_rows", channel_rev, store_rev),
        ("product_store_rows vs store_rows", ps_rev, store_rev),
    ]
    for label, a, b in checks:
        diff = abs(a - b)
        if diff > tolerance:
            print(f"  ❌ {label}：{a:,.0f} vs {b:,.0f}（差 {diff:,.0f}）")
            ok = False
        else:
            print(f"  ✅ {label}：{a:,.0f} 一致")
    return ok
```

---

### Step 3：SKU 數量合理範圍檢查

根據 2026-05 基準值：

```python
def validate_sku_counts(parsed: dict) -> bool:
    n_skus   = len(parsed["sales_rows"])
    n_stores = len(parsed["store_rows"])
    n_ps     = len(parsed["product_store_rows"])

    EXPECT = {
        "skus":   (50, 300),    # 預期 SKU 數量範圍
        "stores": (20, 80),     # 預期門市數量範圍
        "ps_rows": (500, 5000), # 預期 SKU×門市 組合數量範圍
    }
    ok = True
    for key, (lo, hi), actual in [
        ("skus",    EXPECT["skus"],    n_skus),
        ("stores",  EXPECT["stores"],  n_stores),
        ("ps_rows", EXPECT["ps_rows"], n_ps),
    ]:
        if not (lo <= actual <= hi):
            print(f"  ⚠ {key} 數量異常：{actual}（合理範圍 {lo}–{hi}）")
            ok = False
        else:
            print(f"  ✅ {key}：{actual}")
    return ok
```

---

### Step 4：負數金額（退貨）列出

```python
def report_negative_revenue(parsed: dict):
    negatives = [
        r for r in parsed["product_store_rows"]
        if float(r.get("revenue") or 0) < 0 or float(r.get("quantity") or 0) < 0
    ]
    if not negatives:
        print("  ✅ 無負數金額（無退貨記錄）")
        return
    print(f"  ⚠ 發現 {len(negatives)} 筆退貨 / 負數記錄：")
    for r in negatives:
        print(f"    {r['external_sku']:<25} | {r['channel_category']:<12} | "
              f"{r['store_name']:<15} | qty={r['quantity']:>6}  rev={r['revenue']:>10,.0f}")
```

---

## 三、格式異常時的停止與說明流程

當偵測到格式異常，**立即停止匯入**並輸出以下診斷資訊：

```python
def abort_with_format_error(issue: str, first_data_rows: list):
    print(f"""
╔══════════════════════════════════════════════════════════════╗
║  ❌  匯入中止：Excel 格式異常                                ║
╠══════════════════════════════════════════════════════════════╣
║  問題：{issue:<54}║
╠══════════════════════════════════════════════════════════════╣
║  上次正確格式（通路優先）：                                  ║
║    Row 0: 商品 | 銷售總數量 | 實售總金額 | ...（表頭）       ║
║    Row 1: A000 網路官網 | 385 | 330037 | ...（store header） ║
║    Row 4: AH1HC0005BK3 黑圓領 男L | 1 | 590  （SKU 行）     ║
╠══════════════════════════════════════════════════════════════╣
║  目前讀到的前幾行：                                          ║
""")
    for i, r in enumerate(first_data_rows[:5]):
        print(f"║    [{i}] {str(r[:4]):<56}║")
    print("""╠══════════════════════════════════════════════════════════════╣
║  建議修正方式：                                              ║
║  1. 確認 Excel 表頭在第 0 列（含「商品」和「實售總金額」）   ║
║  2. 第 1 列應為 store header（A### / E### / 000### 開頭）    ║
║  3. 若格式已改版，請同步更新 import_sales.py 的解析邏輯     ║
║     並更新本 SKILL.md 的格式說明                             ║
╚══════════════════════════════════════════════════════════════╝
""")
    raise SystemExit(1)
```

### 觸發條件對照表

| 異常情況 | 說明 | 建議 |
|---------|------|------|
| 找不到表頭 | Excel 沒有包含「商品」和「實售總金額」的列 | 確認是否選錯 sheet 或檔案版本 |
| 第一筆資料不是 store header 也不是 SKU | 格式完全不符 | 手動查看 Excel 前 5 列 |
| sales_rows 業績 ≠ channel_rows 業績 | 解析器邏輯錯誤或格式改版 | 比對 A000 是否被正確解析 |
| SKU 數量 < 50 | 解析嚴重不足 | 確認 SKU 識別正則 `^[A-Za-z]{2}\d` 是否正確 |
| SKU 數量 > 300 | 可能把分類行誤判為 SKU | 確認分類行過濾邏輯 |
| store_rows 數量 < 20 | store header 識別失敗 | 確認通路代碼格式是否新增（P###、M### 等）|

---

## 四、格式變更時的更新程序

若供應商修改了 Excel 格式，依下列步驟更新：

1. **確認新格式**：用 Python 印出前 60 列，觀察 store/SKU/分類行的排列方式
2. **更新解析器**：
   - `import_sales.py` → `_parse_store_first()` 或新增 `_parse_new_format()`
   - `src/App.tsx` → `_parseStoreFirst()` 或對應函式（需與 Python 版本邏輯一致）
3. **更新本 SKILL.md**：修改第一節的格式說明與欄位對應
4. **重新執行驗證清單**（第二節所有 Step），確認四張表數字完全一致
5. **確認一致性警告消失**：`SalesPage` 和 `ChannelAnalysisPage` 的 `DataConsistencyWarning` 不再出現

---

## 五、版本記錄

| 日期 | 版本 | 說明 |
|------|------|------|
| 2026-06-03 | v1.0 | 初版，基於 `20260501-0531各部門業績明細表.xlsx` 建立 |

**關鍵修復記錄（2026-06-03）：**
- 舊解析器誤判格式為「商品優先」，導致 A000 網路官網（$330,037）被跳過
- channel_sales_records 網路官網/平台 從 $205,465 修正為 $535,502
- 一致性警告從 16% 差異降為 0%
- 輔大捷運店、蝦皮倉重複 16 筆問題透過去重合併解決
