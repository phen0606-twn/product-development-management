export type Vendor = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  address: string | null;
  payment_terms: string | null;
  bank_info: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  vendor_id: string | null;
  sku: string | null;
  name: string;
  color: string | null;
  size: string | null;
  category: string;
  season: string | null;
  target_launch_date: string | null;
  current_stage: string;
  status: string;
  owner: string | null;
  spec_summary: string | null;
  estimated_retail_price: number | null;
  created_at: string;
  updated_at: string;
  vendors?: Pick<Vendor, 'id' | 'name'> | null;
};

export type DevelopmentCost = {
  id: string;
  batch_id: string | null;
  product_id: string;
  vendor_id: string | null;
  type: string;
  custom_type: string | null;
  description: string | null;
  amount: number;
  paid_amount: number;
  currency: string;
  exchange_rate_to_twd: number;
  bank_fee_twd: number;
  payment_status: string | null;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
};

export type SalesRecord = {
  id: string;
  product_id: string | null;
  external_product_name: string | null;
  external_sku: string | null;
  sold_at: string;
  quantity: number;
  revenue: number;
  channel: string | null;
  notes: string | null;
  created_at: string;
};

export type SalesTarget = {
  id: string;
  target_month: string;
  group_name: string;
  category: string | null;
  target_amount: number;
  created_at: string;
  updated_at: string;
};

export type ChannelSalesRecord = {
  id: string;
  sales_month: string;
  channel_category: string;
  quantity: number;
  revenue: number;
  source_name: string | null;
  created_at: string;
  updated_at: string;
};

export type ChannelStoreSalesRecord = {
  id: string;
  sales_month: string;
  channel_category: string;
  store_name: string;
  quantity: number;
  revenue: number;
  source_name: string | null;
  created_at: string;
  updated_at: string;
};
