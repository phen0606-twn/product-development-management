# 商品開發管理系統 MVP

零售業商品開發用的內部系統，聚焦夏季非雨具類防曬商品，包含商品、廠商、開發進度、費用與附件管理。

## 技術

- React
- TypeScript
- Tailwind CSS
- Supabase

## 啟動

1. 安裝依賴：`npm install`
2. 複製環境變數：`cp .env.example .env`
3. 填入 Supabase URL 與 anon key
4. 到 Supabase SQL Editor 執行 `supabase/schema.sql`
5. 啟動：`npm run dev`

目前前端若未設定 Supabase 環境變數，會自動使用內建範例資料，方便先預覽 MVP 介面。

## 資料庫 Schema

`supabase/schema.sql` 會建立：

- `vendors`：廠商基本資料、付款條件、銀行資訊
- `products`：商品資料、目前階段、開發狀態、目標上架日
- `development_events`：商品開發 timeline
- `product_batches`：商品採購批次，用來區分首單、追單並計算各批次單價
- `development_costs`：開發費用與付款狀態
- `attachments`：商品或廠商附件 metadata
- `sales_records`：商品每週、每月業績追蹤紀錄
- `product_cost_summary`：商品成本彙總 view
- `dashboard_metrics`：Dashboard 指標 view

MVP 的 SQL 已啟用 Row Level Security，政策預設給已登入使用者管理資料。若要先做內部 demo 而尚未接登入，可暫時調整政策；正式環境建議保留登入控管。

## 主要功能

- Dashboard：開發中商品、延遲商品、本月費用、商品狀態統計
- 商品管理：列表、建立、編輯、詳細頁
- 廠商管理：廠商資料、合作商品、付款資訊
- 開發進度：提案到上架的 timeline
- 費用管理：各類開發費用、已付款與未付款計算
- 採購批次：同一商品可建立首單與追單批次，費用可指定批次並計算當批單價
- 業績追蹤：記錄商品銷售日期、數量、業績金額，依週與月份查看統計

## 限制登入 Email

若已經執行過 `supabase/schema.sql`，再到 Supabase SQL Editor 執行 `supabase/email-allowlist.sql`，接著新增允許登入的 email：

```sql
insert into allowed_user_emails (email, note)
values ('你的email@example.com', 'owner')
on conflict (email) do update set note = excluded.note;
```

前端會使用 Supabase email magic link 登入。登入後，資料庫端會再次檢查 email 是否在 `allowed_user_emails`，不在名單內就無法讀寫商品、廠商、費用與附件資料。

## 已有資料庫新增欄位

如果你已經先建立過資料庫，後續新增欄位可以到 Supabase SQL Editor 執行對應檔案：

- `supabase/add-vendor-address.sql`：替廠商新增地址欄位
- `supabase/add-cost-payment-types.sql`：替費用類型新增訂金、尾款、其他與其他費用名稱
- `supabase/add-cost-currencies.sql`：替費用新增幣別匯率，並讓成本彙總以台幣計算
- `supabase/add-cost-bank-fee.sql`：替費用新增外匯手續費，並納入台幣總支出
- `supabase/add-product-batches.sql`：替商品新增採購批次，費用可指定批次並計算每批單價
- `supabase/change-product-category-to-text.sql`：讓商品分類可使用防曬、保暖、配件、包裝等更多類別
- `supabase/add-mass-production-status.sql`：替商品狀態新增「大貨中」
- `supabase/allow-duplicate-product-sku.sql`：讓商品 SKU 可以重複
- `supabase/add-quoting-stage.sql`：替商品目前階段新增「報價中」
- `supabase/add-quoting-status.sql`：替商品狀態新增「報價中」
- `supabase/add-sales-records.sql`：新增商品業績追蹤資料表
- `supabase/add-product-color-size.sql`：替商品新增顏色與尺寸欄位，方便 Excel 批次匯入
- `supabase/allow-unmatched-sales-records.sql`：讓未建檔商品也可以匯入業績
