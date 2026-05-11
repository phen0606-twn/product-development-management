import { FormEvent, useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { BarChart3, Boxes, DollarSign, LayoutDashboard, Upload, Users } from 'lucide-react';
import { hasSupabaseConfig, supabase } from './lib/supabase';
import { formatCurrency, formatFullDate, monthEnd } from './lib/format';

type Row = Record<string, any>;

const nav = [
  ['/', 'Dashboard', LayoutDashboard],
  ['/products', '商品', Boxes],
  ['/vendors', '廠商', Users],
  ['/costs', '費用', DollarSign],
  ['/sales', '業績', BarChart3],
  ['/sales-import', '業績匯入', Upload],
] as const;

export default function App() {
  const [ready, setReady] = useState(!hasSupabaseConfig);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
      setReady(true);
    });
    return supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
      setReady(true);
    }).data.subscription.unsubscribe;
  }, []);

  if (!ready) return <div className="p-8">載入中...</div>;
  if (hasSupabaseConfig && !email) return <Login />;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[230px_1fr]">
      <aside className="border-r border-slate-200 bg-white p-5">
        <h1 className="text-lg font-semibold">商品開發管理</h1>
        <nav className="mt-6 space-y-1">
          {nav.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm ${isActive ? 'bg-leaf text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        {email && <button onClick={() => supabase?.auth.signOut()} className="mt-8 text-sm text-slate-500">登出 {email}</button>}
      </aside>
      <main className="p-5 lg:p-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<SimpleTable table="products" title="商品管理" columns={['sku', 'name', 'category', 'color', 'size', 'status']} />} />
          <Route path="/vendors" element={<SimpleTable table="vendors" title="廠商管理" columns={['name', 'contact_name', 'phone', 'email', 'payment_terms']} />} />
          <Route path="/costs" element={<Costs />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/sales-import" element={<SalesImport />} />
        </Routes>
      </main>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setMessage(error ? error.message : '登入連結已寄出，請到信箱收信。');
  }
  return (
    <main className="grid min-h-screen place-items-center bg-mist p-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
        <h1 className="text-2xl font-semibold">商品開發管理系統</h1>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="mt-5 w-full rounded-md border border-slate-200 px-3 py-2" required />
        <button className="mt-4 w-full rounded-md bg-leaf px-4 py-2 text-white">寄送登入連結</button>
        {message && <p className="mt-4 text-sm text-slate-600">{message}</p>}
      </form>
    </main>
  );
}

function useRows(table: string) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  async function load() {
    if (!supabase) return setLoading(false);
    const { data } = await supabase.from(table).select('*').limit(2000);
    setRows(data ?? []);
    setLoading(false);
  }
  useEffect(() => void load(), [table]);
  return { rows, loading, reload: load };
}

function Dashboard() {
  const products = useRows('products');
  const costs = useRows('development_costs');
  const sales = useRows('sales_records');
  const month = new Date().toISOString().slice(0, 7);
  const active = products.rows.filter((p) => ['planning', 'quoting', 'in_development', 'mass_production'].includes(p.status)).length;
  const delayed = products.rows.filter((p) => p.status === 'delayed').length;
  const monthCost = costs.rows.filter((c) => String(c.paid_at ?? c.created_at).startsWith(month)).reduce((s, c) => s + costTotal(c), 0);
  const monthSales = sales.rows.filter((s) => String(s.sold_at).startsWith(month)).reduce((s, r) => s + Number(r.revenue ?? 0), 0);
  return <Page title="Dashboard" subtitle="系統總覽"><div className="grid gap-4 md:grid-cols-4"><Card label="開發中商品" value={String(active)} /><Card label="延遲商品" value={String(delayed)} tone="coral" /><Card label="本月費用" value={formatCurrency(monthCost)} /><Card label="本月業績" value={formatCurrency(monthSales)} /></div></Page>;
}

function SimpleTable({ table, title, columns }: { table: string; title: string; columns: string[] }) {
  const { rows, loading } = useRows(table);
  return <Page title={title} subtitle="資料來自 Supabase。"><Table columns={columns}>{loading ? <tr><td className="p-4">載入中...</td></tr> : rows.map((row) => <tr key={row.id} className="border-t">{columns.map((c) => <td key={c} className="p-3">{String(row[c] ?? '')}</td>)}</tr>)}</Table></Page>;
}

function Costs() {
  const costs = useRows('development_costs');
  const total = costs.rows.reduce((s, c) => s + costTotal(c), 0);
  const paid = costs.rows.reduce((s, c) => s + Number(c.paid_amount ?? 0) * Number(c.exchange_rate_to_twd || 1), 0);
  return <Page title="費用管理" subtitle="開發費用與付款狀態。"><div className="mb-6 grid gap-4 md:grid-cols-3"><Card label="總成本" value={formatCurrency(total)} /><Card label="已付款" value={formatCurrency(paid)} /><Card label="未付款" value={formatCurrency(total - paid)} tone="coral" /></div><Table columns={['type', 'description', 'amount', 'paid_amount', 'currency', 'paid_at']}>{costs.rows.map((r) => <tr key={r.id} className="border-t"><td className="p-3">{r.custom_type || r.type}</td><td className="p-3">{r.description}</td><td className="p-3">{formatCurrency(costTotal(r))}</td><td className="p-3">{formatCurrency(r.paid_amount)}</td><td className="p-3">{r.currency}</td><td className="p-3">{r.paid_at}</td></tr>)}</Table></Page>;
}

function Sales() {
  const sales = useRows('sales_records');
  const targets = useRows('sales_targets');
  const channelSales = useRows('channel_sales_records');
  const stores = useRows('channel_store_sales_records');
  const [start, setStart] = useState(`${new Date().toISOString().slice(0, 7)}-01`);
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const records = sales.rows.filter((r) => r.sold_at >= start && r.sold_at <= end);
  const months = monthsInRange(start, end);
  const revenue = sum(records, 'revenue');
  const qty = sum(records, 'quantity');
  const target = targets.rows.filter((t) => months.includes(String(t.target_month).slice(0, 7))).reduce((s, t) => s + Number(t.target_amount ?? 0), 0);
  const prevMonth = sumSales(sales.rows, shiftMonth(start, -1), shiftMonth(end, -1));
  const prevYear = sumSales(sales.rows, shiftYear(start, -1), shiftYear(end, -1));
  const productRows = rank(group(records, (r) => r.external_product_name || r.external_sku || '未建檔商品')).slice(0, 10);
  const channelRows = channelData(channelSales.rows, records, months);
  const street = rank(group(stores.rows.filter((r) => r.channel_category === '街邊店' && months.includes(String(r.sales_month).slice(0, 7))), (r) => r.store_name)).slice(0, 5);
  const mrt = rank(group(stores.rows.filter((r) => r.channel_category === '捷運門市' && months.includes(String(r.sales_month).slice(0, 7))), (r) => r.store_name)).slice(0, 5);
  return (
    <Page title="業績追蹤" subtitle="月目標、年度目標、MOM、YOY、通路與排行。">
      <div className="mb-6 grid gap-3 md:grid-cols-3"><Field label="起日" value={start} onChange={setStart} /><Field label="迄日" value={end} onChange={setEnd} /></div>
      <div className="mb-6 space-y-3">
        <div className="grid gap-3 md:grid-cols-3"><Card label="區間業績" value={formatCurrency(revenue)} compact /><Card label="區間銷售數量" value={qty.toLocaleString('zh-TW')} compact /><Card label="平均單價" value={formatCurrency(qty ? revenue / qty : 0)} compact /></div>
        <div className="grid gap-3 md:grid-cols-5"><Card label="月目標" value={formatCurrency(target)} compact /><Card label="月達成率" value={`${(target ? revenue / target * 100 : 0).toFixed(1)}%`} compact /><Card label="年度目標" value={formatCurrency(sum(targets.rows.filter((t) => String(t.target_month).startsWith(start.slice(0, 4))), 'target_amount'))} compact /><Card label="年度業績" value={formatCurrency(sum(sales.rows.filter((r) => String(r.sold_at).startsWith(start.slice(0, 4))), 'revenue'))} compact /><Card label="年度達成率" value={`${growth(sum(sales.rows.filter((r) => String(r.sold_at).startsWith(start.slice(0, 4))), 'revenue'), sum(targets.rows.filter((t) => String(t.target_month).startsWith(start.slice(0, 4))), 'target_amount'), false)}`} compact /></div>
        <div className="grid gap-3 md:grid-cols-2"><Card label="MOM" value={growth(revenue, prevMonth)} helper={`前月 ${formatCurrency(prevMonth)}`} compact /><Card label="YOY" value={growth(revenue, prevYear)} helper={`去年同期 ${formatCurrency(prevYear)}`} compact /></div>
      </div>
      <section className="grid gap-6 xl:grid-cols-2"><Summary title="商品業績排行" rows={productRows} /><ChannelSummary rows={channelRows} /></section>
      <section className="mt-6 grid gap-6 xl:grid-cols-2"><Summary title="街邊店前五名" rows={street} /><Summary title="捷運門市前五名" rows={mrt} /></section>
      <div className="mt-6"><Table columns={['日期', '商品', '通路', '數量', '業績金額']}>{records.map((r) => <tr key={r.id} className="border-t"><td className="p-3">{formatFullDate(r.sold_at)}</td><td className="p-3">{r.external_product_name || r.external_sku}</td><td className="p-3">{r.channel}</td><td className="p-3">{r.quantity}</td><td className="p-3">{formatCurrency(r.revenue)}</td></tr>)}</Table></div>
    </Page>
  );
}

function SalesImport() {
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    const file = form.get('file');
    const month = String(form.get('month'));
    if (!(file instanceof File)) return;
    const XLSX = await import(/* @vite-ignore */ 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const rows = parseSales(workbook, XLSX.utils, month);
    await supabase.from('sales_records').insert(rows);
    setMessage(`已匯入 ${rows.length} 筆。`);
  }
  return <Page title="業績匯入" subtitle="可匯入商品業績或年度橫式表。"><form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft"><div className="grid gap-3 md:grid-cols-3"><label className="text-sm">匯入月份<input name="month" type="month" defaultValue={new Date().toISOString().slice(0, 7)} className="mt-1 w-full rounded-md border px-3 py-2" /></label><label className="text-sm md:col-span-2">Excel 檔案<input name="file" type="file" accept=".xlsx,.xls,.csv" className="mt-1 w-full rounded-md border px-3 py-2" /></label></div><button className="mt-4 rounded-md bg-leaf px-4 py-2 text-white">匯入</button>{message && <p className="mt-3 text-sm text-slate-600">{message}</p>}</form></Page>;
}

function Page({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <div className="space-y-6"><div><h2 className="text-2xl font-semibold">{title}</h2><p className="mt-1 text-slate-500">{subtitle}</p></div>{children}</div>;
}

function Card({ label, value, helper, compact, tone = 'ink' }: { label: string; value: string; helper?: string; compact?: boolean; tone?: 'ink' | 'coral' }) {
  return <section className={`rounded-lg border border-slate-200 bg-white ${compact ? 'p-4' : 'p-5'} shadow-soft`}><p className="text-sm text-slate-500">{label}</p><p className={`${compact ? 'text-lg' : 'text-2xl'} mt-1 font-semibold ${tone === 'coral' ? 'text-coral' : 'text-ink'}`}>{value}</p>{helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}</section>;
}

function Table({ columns, children }: { columns: string[]; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{columns.map((c) => <th className="p-3 font-medium" key={c}>{c}</th>)}</tr></thead><tbody>{children}</tbody></table></div></section>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm">{label}<input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" /></label>;
}

function Summary({ title, rows }: { title: string; rows: Array<{ label: string; quantity: number; revenue: number; rank?: number }> }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft"><h3 className="mb-4 font-semibold">{title}</h3><div className="space-y-3">{rows.length === 0 && <p className="text-sm text-slate-500">尚無資料</p>}{rows.map((r) => <div key={r.label} className="grid grid-cols-[1fr_auto] gap-3 rounded-md border border-slate-100 p-3 text-sm"><div className="flex gap-3">{r.rank && <span className={`min-w-8 text-2xl font-bold ${r.rank <= 3 ? 'text-coral' : 'text-slate-400'}`}>{r.rank}</span>}<div><p className="font-medium">{r.label}</p><p className="mt-1 text-slate-500">{r.quantity.toLocaleString('zh-TW')} 件</p></div></div><p className="font-semibold text-leaf">{formatCurrency(r.revenue)}</p></div>)}</div></section>;
}

function ChannelSummary({ rows }: { rows: Array<{ label: string; quantity: number; revenue: number }> }) {
  const colors = ['#4f8f72', '#ef6f61', '#3b82f6'];
  const total = sum(rows, 'revenue');
  let cursor = 0;
  const gradient = rows.map((r, i) => { const start = cursor; cursor += total ? r.revenue / total * 100 : 0; return `${colors[i % colors.length]} ${start}% ${cursor}%`; }).join(', ') || '#e2e8f0 0 100%';
  return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft"><h3 className="mb-4 font-semibold">通路業績</h3><div className="space-y-3">{rows.map((r, i) => <div key={r.label} className="grid grid-cols-[1fr_auto] gap-3 rounded-md border p-3 text-sm"><p><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />{r.label}<span className="ml-2 text-slate-500">{total ? (r.revenue / total * 100).toFixed(1) : 0}%</span></p><p className="font-semibold text-leaf">{formatCurrency(r.revenue)}</p></div>)}<div className="grid gap-5 border-t pt-5 md:grid-cols-[240px_1fr] md:items-center"><div className="mx-auto grid h-56 w-56 place-items-center rounded-full" style={{ background: `conic-gradient(${gradient})` }}><div className="grid h-28 w-28 place-items-center rounded-full bg-white shadow-sm"><p className="text-center text-sm font-semibold">{formatCurrency(total)}</p></div></div><div>{rows.map((r, i) => <p key={r.label} className="mb-2 text-sm"><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />{r.label}</p>)}</div></div></div></section>;
}

function costTotal(row: Row) { return Number(row.amount ?? 0) * Number(row.exchange_rate_to_twd || 1) + Number(row.bank_fee_twd ?? 0); }
function sum(rows: Row[], key: string) { return rows.reduce((s, r) => s + Number(r[key] ?? 0), 0); }
function sumSales(rows: Row[], start: string, end: string) { return sum(rows.filter((r) => r.sold_at >= start && r.sold_at <= end), 'revenue'); }
function monthsInRange(start: string, end: string) { const out: string[] = []; const d = new Date(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, 1); const e = new Date(Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1, 1); while (d <= e) { out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); d.setMonth(d.getMonth() + 1); } return out; }
function shiftMonth(date: string, offset: number) { const [y, m, d] = date.split('-').map(Number); const n = new Date(y, m - 1 + offset, 1); const last = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`; }
function shiftYear(date: string, offset: number) { const [y, m, d] = date.split('-').map(Number); const last = new Date(y + offset, m, 0).getDate(); return `${y + offset}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`; }
function growth(current: number, previous: number, signed = true) { const rate = previous ? ((current - previous) / Math.abs(previous)) * 100 : current ? 100 : 0; return `${signed && rate > 0 ? '+' : ''}${rate.toFixed(1)}%`; }
function group(rows: Row[], getLabel: (row: Row) => string) { return Object.values(rows.reduce((acc, row) => { const label = getLabel(row); acc[label] ??= { label, quantity: 0, revenue: 0 }; acc[label].quantity += Number(row.quantity ?? 0); acc[label].revenue += Number(row.revenue ?? 0); return acc; }, {} as Record<string, { label: string; quantity: number; revenue: number }>)); }
function rank(rows: Array<{ label: string; quantity: number; revenue: number }>) { return rows.sort((a, b) => b.revenue - a.revenue).map((r, i) => ({ ...r, rank: i + 1 })); }
function channelData(channelRows: Row[], salesRows: Row[], months: string[]) { const rows = group(channelRows.filter((r) => months.includes(String(r.sales_month).slice(0, 7))), (r) => r.channel_category); return rows.length ? rank(rows) : rank(group(salesRows, (r) => r.channel || '未指定')); }
function parseNumber(value: unknown) { const n = Number(String(value ?? '').replace(/,/g, '').replace(/%/g, '')); return Number.isFinite(n) ? n : 0; }
function parseSales(workbook: any, utils: any, fallbackMonth: string) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as unknown[][];
  const headerIndex = rows.findIndex((r) => r.some((c) => ['商品', '商品名稱', '品名', '型號'].includes(String(c).trim())));
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex].map(String);
  const skuCol = headers.findIndex((h) => ['型號', 'SKU', 'sku', '品號'].includes(h.trim()));
  const nameCol = headers.findIndex((h) => ['品名', '商品名稱', '商品'].includes(h.trim()));
  const annualCols = headers.map((h, i) => ({ i, m: String(h).replace(/\s+/g, '').match(/'?(\d{2})-(\d{2})銷額/) })).filter((x) => x.m);
  if (annualCols.length) {
    return rows.slice(headerIndex + 1).flatMap((r) => annualCols.flatMap(({ i, m }: any) => {
      const revenue = parseNumber(r[i]);
      if (!revenue) return [];
      const sku = skuCol >= 0 ? String(r[skuCol] ?? '') : '';
      const name = `${sku} ${nameCol >= 0 ? String(r[nameCol] ?? '') : ''}`.trim();
      const month = `20${m[1]}-${m[2]}`;
      return [{ product_id: null, external_sku: sku, external_product_name: name, sold_at: monthEnd(month), quantity: 0, revenue, channel: null, notes: '年度業績明細匯入' }];
    }));
  }
  const revCol = headers.findIndex((h) => ['業績金額', '實售總金額', '銷售金額', '營業額'].includes(h.trim()));
  const qtyCol = headers.findIndex((h) => ['銷售數量', '銷售總數量', '數量'].includes(h.trim()));
  return rows.slice(headerIndex + 1).flatMap((r) => {
    const name = nameCol >= 0 ? String(r[nameCol] ?? '') : '';
    const sku = skuCol >= 0 ? String(r[skuCol] ?? '') : name.split(/\s+/)[0];
    const revenue = revCol >= 0 ? parseNumber(r[revCol]) : 0;
    const quantity = qtyCol >= 0 ? parseNumber(r[qtyCol]) : 0;
    if ((!name && !sku) || (!revenue && !quantity)) return [];
    return [{ product_id: null, external_sku: sku, external_product_name: name, sold_at: monthEnd(fallbackMonth), quantity, revenue, channel: null, notes: null }];
  });
}
