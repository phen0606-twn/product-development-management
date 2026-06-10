-- 新增 week_label 欄位到 sales_records
-- 請在 Supabase Dashboard → SQL Editor 執行此腳本

ALTER TABLE sales_records ADD COLUMN IF NOT EXISTS week_label text;

-- 補填現有資料的 week_label
-- 邏輯：每個 sold_at 的結束日 = 下一個 sold_at 前一天；最後一期 = 當月最後一天
WITH periods AS (
  SELECT
    sold_at,
    COALESCE(
      (LEAD(sold_at::date) OVER (ORDER BY sold_at::date) - INTERVAL '1 day')::date,
      (DATE_TRUNC('month', sold_at::date) + INTERVAL '1 month - 1 day')::date
    ) AS period_end
  FROM (SELECT DISTINCT sold_at FROM sales_records) d
)
UPDATE sales_records sr
SET week_label =
  EXTRACT(MONTH FROM p.sold_at::date)::int || '/' ||
  EXTRACT(DAY   FROM p.sold_at::date)::int || '-' ||
  EXTRACT(MONTH FROM p.period_end)::int    || '/' ||
  EXTRACT(DAY   FROM p.period_end)::int
FROM periods p
WHERE sr.sold_at = p.sold_at
  AND sr.week_label IS NULL;
