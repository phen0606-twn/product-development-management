-- 報關試算資料表
CREATE TABLE IF NOT EXISTS customs_calculations (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id            uuid        REFERENCES products(id) ON DELETE SET NULL,
  calc_name             text        NOT NULL,
  calc_mode             text        NOT NULL DEFAULT 'estimate' CHECK (calc_mode IN ('estimate', 'actual')),
  transport_type        text        NOT NULL DEFAULT 'sea'      CHECK (transport_type IN ('sea', 'air')),
  quantity              integer     NOT NULL DEFAULT 1,
  unit_price_usd        numeric(14,4) NOT NULL DEFAULT 0,
  exchange_rate_usd     numeric(8,4)  NOT NULL DEFAULT 32.5,
  freight_usd           numeric(14,4) NOT NULL DEFAULT 0,
  insurance_usd         numeric(14,4) NOT NULL DEFAULT 0,
  customs_broker_fee_twd numeric(14,2) NOT NULL DEFAULT 0,
  hs_code               text,
  tariff_rate           numeric(6,4)  NOT NULL DEFAULT 0,
  business_tax_rate     numeric(6,4)  NOT NULL DEFAULT 5,
  notes                 text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE customs_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customs_calc_all" ON customs_calculations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- updated_at 自動更新（若同名 function 已存在則跳過）
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_customs_calc_updated_at ON customs_calculations;
CREATE TRIGGER trg_customs_calc_updated_at
  BEFORE UPDATE ON customs_calculations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
