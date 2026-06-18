-- customs_calculations 新增運費計算欄位
ALTER TABLE customs_calculations
  ADD COLUMN IF NOT EXISTS unit_weight_kg   numeric(10,3),
  ADD COLUMN IF NOT EXISTS freight_type     text CHECK (freight_type IN ('sea_normal','sea_express','air')),
  ADD COLUMN IF NOT EXISTS freight_rate_twd numeric(10,2),
  ADD COLUMN IF NOT EXISTS freight_min_twd  numeric(10,2);

-- 常用運費設定主檔
CREATE TABLE IF NOT EXISTS freight_rate_presets (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name             text NOT NULL,
  freight_type     text NOT NULL CHECK (freight_type IN ('sea_normal','sea_express','air')),
  rate_per_kg_twd  numeric(10,2) NOT NULL DEFAULT 0,
  min_charge_twd   numeric(10,2),
  notes            text,
  is_default       boolean DEFAULT false,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE freight_rate_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "freight_presets_all" ON freight_rate_presets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 預設內建三筆
INSERT INTO freight_rate_presets (name, freight_type, rate_per_kg_twd, min_charge_twd, notes) VALUES
  ('海運（一般）', 'sea_normal',   8,   2000, '含稅'),
  ('海快',        'sea_express',  45,   300,  '含稅'),
  ('空運',        'air',         120,   500,  '含稅');
