-- 新增「暫停」狀態到 product_status enum
-- 請在 Supabase Dashboard → SQL Editor 執行此腳本

ALTER TYPE product_status ADD VALUE IF NOT EXISTS 'paused';
