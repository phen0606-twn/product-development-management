import { Component, Fragment, FormEvent, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { BarChart3, Boxes, DollarSign, LayoutDashboard, Package, Pencil, Plus, TrendingUp, Trash2, Upload, Users } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import { hasSupabaseConfig, supabase } from './lib/supabase';
import { formatCurrency, formatFullDate, monthEnd } from './lib/format';

type Row = Record<string, any>;

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <p className="font-semibold">頁面發生錯誤</p>
        <pre className="mt-2 whitespace-pre-wrap text-xs">{this.state.error}</pre>
        <button onClick={() => this.setState({ error: '' })} className="mt-3 rounded-md bg-red-100 px-3 py-1 text-xs">重試</button>
      </div>
    );
    return this.props.children;
  }
}

const nav = [
  ['/', 'Dashboard', LayoutDashboard, false],
  ['/products', '商品管理', Boxes, true],
  ['/vendors', '廠商管理', Users, true],
  ['/costs', '費用管理', DollarSign, true],
  ['/sales', '業績追蹤', BarChart3, false],
  ['/channel-analysis', '通路分析', TrendingUp, false],
  ['/inventory', '庫存追蹤', Package, false],
  ['/import', '資料匯入', Upload, true],
] as const;

// Routes marked adminOnly=true are hidden from viewer role
const ADMIN_ROUTES = new Set(['/products', '/vendors', '/costs', '/sales-import']);

const statusOptions = [
  ['planning', '提案'],
  ['quoting', '報價中'],
  ['in_development', '開發中'],
  ['mass_production', '大貨中'],
  ['delayed', '延遲'],
  ['launched', '已上架'],
  ['completed', '完成'],
  ['cancelled', '取消'],
] as const;

const stageOptions = ['提案', '報價中', '打樣', '修改', '確認樣', '下單', '大貨中', '生產', '驗貨', '出貨', '上架', '完成'];
const costTypes: [string, string][] = [
  ['sample_fee', '打樣費'], ['mold_fee', '模具費'], ['shipping_fee', '運費'],
  ['duty_fee', '關稅'], ['design_fee', '設計費'], ['deposit', '訂金'],
  ['final_payment', '尾款'], ['bank_fee', '手續費'], ['other', '其他'],
];

export default function App() {
  const [ready, setReady] = useState(!hasSupabaseConfig);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string>('admin');
  const [resetPassword, setResetPassword] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const url = new URL(window.location.href);
    if (url.hash.includes('type=recovery') || url.searchParams.get('type') === 'recovery') {
      setResetPassword(true);
    }
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
      setRole(data.session?.user.user_metadata?.role ?? 'admin');
      setReady(true);
    });
    return supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setResetPassword(true);
      setEmail(session?.user.email ?? null);
      setRole(session?.user.user_metadata?.role ?? 'admin');
      setReady(true);
    }).data.subscription.unsubscribe;
  }, []);

  if (!ready) return <div className="p-8">載入中...</div>;
  if (hasSupabaseConfig && !email) return <Login />;
  if (hasSupabaseConfig && resetPassword) return <PasswordReset onDone={() => setResetPassword(false)} />;

  const isViewer = role === 'viewer';

  function Guard({ children }: { children: ReactNode }) {
    return isViewer ? <Navigate to="/" replace /> : <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-mist lg:grid lg:grid-cols-[238px_1fr]">
      <aside className="border-r border-navydark/40 bg-navy p-5">
        <h1 className="text-lg font-semibold text-white">商品開發管理</h1>
        <p className="mt-1 text-xs text-white/60">防曬 / 天氣商品開發系統</p>
        <nav className="mt-6 space-y-1">
          {nav.filter(([to, , , adminOnly]) => !(isViewer && adminOnly)).map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm ${isActive ? 'bg-leaf text-white shadow-sm' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        {email && (
          <div className="mt-8">
            {isViewer && <span className="mb-2 block rounded-md bg-white/10 px-2 py-1 text-center text-xs text-white/70">檢視者</span>}
            <button onClick={() => supabase?.auth.signOut()} className="text-left text-xs text-white/50 hover:text-white/80">登出<br />{email}</button>
          </div>
        )}
      </aside>
      <main className="p-5 lg:p-8">
        <Routes>
          <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
          <Route path="/products" element={<Guard><ErrorBoundary><ProductsPage /></ErrorBoundary></Guard>} />
          <Route path="/products/:id" element={<Guard><ErrorBoundary><ProductDetailPage /></ErrorBoundary></Guard>} />
          <Route path="/vendors" element={<Guard><ErrorBoundary><VendorsPage /></ErrorBoundary></Guard>} />
          <Route path="/costs" element={<Guard><ErrorBoundary><CostsPage /></ErrorBoundary></Guard>} />
          <Route path="/sales" element={<ErrorBoundary><SalesPage /></ErrorBoundary>} />
          <Route path="/channel-analysis" element={<ErrorBoundary><ChannelAnalysisPage /></ErrorBoundary>} />
          <Route path="/inventory" element={<ErrorBoundary><InventoryPage /></ErrorBoundary>} />
          <Route path="/import" element={<Guard><ErrorBoundary><ImportPage /></ErrorBoundary></Guard>} />
          <Route path="/sales-import" element={<Navigate to="/import" replace />} />
          <Route path="/inventory-import" element={<Navigate to="/import" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function PasswordReset({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setMessage('密碼至少需要 8 個字。');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('兩次輸入的密碼不一樣。');
      return;
    }
    const { error } = await supabase!.auth.updateUser({ password });
    if (error) {
      setMessage(`設定失敗：${error.message}`);
      return;
    }
    window.history.replaceState({}, document.title, window.location.origin);
    setMessage('密碼已設定完成。');
    onDone();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-mist p-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
        <h1 className="text-2xl font-semibold">設定新密碼</h1>
        <p className="mt-2 text-sm text-slate-500">請設定之後登入系統要使用的密碼。</p>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="新密碼，至少 8 個字" className="mt-5 w-full rounded-md border border-slate-200 px-3 py-2" required />
        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="再輸入一次新密碼" className="mt-3 w-full rounded-md border border-slate-200 px-3 py-2" required />
        <button className="mt-4 w-full rounded-md bg-leaf px-4 py-2 text-white">設定密碼</button>
        {message && <p className="mt-4 text-sm text-slate-600">{message}</p>}
      </form>
    </main>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sendingLink, setSendingLink] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    const { error } = await supabase!.auth.signInWithPassword({ email, password });
    setMessage(error ? `登入失敗：${error.message}` : '登入成功。');
  }

  async function sendMagicLink() {
    if (!email) {
      setMessage('請先輸入 Email。');
      return;
    }
    setSendingLink(true);
    const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setMessage(error ? `寄送失敗：${error.message}` : '登入連結已寄出，請到信箱收信。');
    setSendingLink(false);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-mist p-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
        <h1 className="text-2xl font-semibold">商品開發管理系統</h1>
        <p className="mt-2 text-sm text-slate-500">請使用已授權的 Email 與密碼登入。</p>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="mt-5 w-full rounded-md border border-slate-200 px-3 py-2" required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密碼" className="mt-3 w-full rounded-md border border-slate-200 px-3 py-2" required />
        <button className="mt-4 w-full rounded-md bg-leaf px-4 py-2 text-white">登入</button>
        <button type="button" onClick={sendMagicLink} disabled={sendingLink} className="mt-3 w-full rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 disabled:opacity-50">
          {sendingLink ? '寄送中...' : '改用 Email 登入連結'}
        </button>
        {message && <p className="mt-4 text-sm text-slate-600">{message}</p>}
      </form>
    </main>
  );
}

function useRows(table: string, order = 'created_at') {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() {
    if (!supabase) return setLoading(false);
    setLoading(true);
    const PAGE = 1000;
    const all: Row[] = [];
    let from = 0;
    while (true) {
      const q = supabase.from(table).select('*').range(from, from + PAGE - 1);
      const { data, error: err } = order ? await q.order(order, { ascending: false }) : await q;
      if (err) { setError(err.message); setLoading(false); return; }
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    setRows(all);
    setError('');
    setLoading(false);
  }
  useEffect(() => void load(), [table]);
  return { rows, loading, error, reload: load };
}

/** 比對 sales_records（明細）與 channel_sales_records（通路彙總）的月度總業績是否一致。
 *  差異 > 0.5% 時 ok=false，畫面應顯示 DataConsistencyWarning。 */
function useDataConsistencyCheck(month: string) {
  const [check, setCheck] = useState<{
    salesTotal: number; channelTotal: number; diff: number; pct: number; ok: boolean;
  } | null>(null);

  useEffect(() => {
    if (!supabase || !month) return;
    setCheck(null);
    const start = `${month}-01`;
    const end = monthEnd(month);
    Promise.all([
      supabase.from('sales_records').select('revenue').gte('sold_at', start).lte('sold_at', end).limit(10000),
      supabase.from('channel_sales_records').select('revenue').gte('sales_month', start).lte('sales_month', end),
    ]).then(([sRes, cRes]) => {
      const salesTotal   = (sRes.data ?? []).reduce((s, r) => s + Number(r.revenue ?? 0), 0);
      const channelTotal = (cRes.data ?? []).reduce((s, r) => s + Number(r.revenue ?? 0), 0);
      const diff = Math.abs(salesTotal - channelTotal);
      const pct  = salesTotal > 0 ? diff / salesTotal * 100 : 0;
      setCheck({ salesTotal, channelTotal, diff, pct, ok: pct < 0.5 });
    });
  }, [month]);

  return check;
}

function DataConsistencyWarning({ check }: {
  check: { salesTotal: number; channelTotal: number; diff: number; pct: number };
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
      <span className="mt-0.5 text-amber-500">⚠</span>
      <div>
        <p className="font-medium text-amber-800">資料一致性警告</p>
        <p className="mt-1 text-amber-700">
          業績追蹤（明細表）合計 <strong>{formatCurrency(check.salesTotal)}</strong>，
          通路分析（通路彙總）合計 <strong>{formatCurrency(check.channelTotal)}</strong>，
          差異 {formatCurrency(check.diff)}（{check.pct.toFixed(1)}%）。
        </p>
        <p className="mt-1 text-xs text-amber-600">
          可能原因：Excel 明細行加總與通路彙總欄位不符。建議重新確認來源資料後重新匯入。
        </p>
      </div>
    </div>
  );
}

function Dashboard() {
  const products = useRows('products');
  const costs = useRows('development_costs');
  const sales = useRows('sales_records');
  const inventory = useRows('inventory_records', 'recorded_at');
  const month = new Date().toISOString().slice(0, 7);
  const active = products.rows.filter((p) => ['planning', 'quoting', 'in_development', 'mass_production'].includes(p.status)).length;
  const delayed = products.rows.filter((p) => p.status === 'delayed').length;
  const monthCost = costs.rows.filter((c) => String(c.paid_at ?? c.created_at).startsWith(month)).reduce((s, c) => s + costTotal(c), 0);
  const monthSales = sales.rows.filter((s) => String(s.sold_at).startsWith(month)).reduce((s, r) => s + Number(r.revenue ?? 0), 0);
  const statusRows = groupProductsByStatus(products.rows);

  const latestSnapshotDate = useMemo(() => {
    let d = '';
    for (const r of inventory.rows) { const date = String(r.recorded_at || '').slice(0, 10); if (date > d) d = date; }
    return d;
  }, [inventory.rows]);

  const latestBySku = useMemo(() => {
    const latestDate = new Map<string, string>();
    for (const r of inventory.rows) {
      const sku = String(r.external_sku || '');
      const date = String(r.recorded_at || '').slice(0, 10);
      if (sku && (!latestDate.has(sku) || date > latestDate.get(sku)!)) latestDate.set(sku, date);
    }
    const totals = new Map<string, { external_sku: string; product_name: string; quantity: number }>();
    for (const r of inventory.rows) {
      const sku = String(r.external_sku || '');
      const date = String(r.recorded_at || '').slice(0, 10);
      if (!sku || date !== latestDate.get(sku)) continue;
      const entry = totals.get(sku) ?? { external_sku: sku, product_name: String(r.product_name || sku), quantity: 0 };
      entry.quantity += Number(r.quantity ?? 0);
      totals.set(sku, entry);
    }
    return [...totals.values()];
  }, [inventory.rows]);

  const currentBySku = useMemo(() => {
    const soldMap = new Map<string, number>();
    if (latestSnapshotDate) {
      for (const r of sales.rows) {
        if (String(r.sold_at || '').slice(0, 10) <= latestSnapshotDate) continue;
        const sku = String(r.external_sku || '');
        if (sku) soldMap.set(sku, (soldMap.get(sku) ?? 0) + Number(r.quantity ?? 0));
      }
    }
    return latestBySku.map((inv) => ({ ...inv, quantity: Math.max(0, inv.quantity - (soldMap.get(inv.external_sku) ?? 0)) }));
  }, [latestBySku, latestSnapshotDate, sales.rows]);

  const dashboardAlerts = useMemo(() => {
    const allMonths = [...new Set(sales.rows.map((r) => String(r.sold_at || '').slice(0, 7)).filter(Boolean))].sort();
    const recent2 = allMonths.slice(-2);
    const prior3 = allMonths.slice(-5, -2);
    const last3 = allMonths.slice(-3);
    const bySkuMonth = new Map<string, Map<string, number>>();
    for (const r of sales.rows) {
      const sku = String(r.external_sku || '');
      const mo = String(r.sold_at || '').slice(0, 7);
      if (!sku || !mo) continue;
      const m = bySkuMonth.get(sku) ?? new Map<string, number>();
      m.set(mo, (m.get(mo) ?? 0) + Number(r.quantity ?? 0));
      bySkuMonth.set(sku, m);
    }
    const stockMap = new Map(currentBySku.map((inv) => [inv.external_sku, inv.quantity]));
    // Build name map: prefer sales records (has Chinese name), fall back to inventory product_name
    const nameMap = new Map<string, string>();
    for (const r of sales.rows) {
      const sku = String(r.external_sku || '');
      const pname = String(r.external_product_name || '');
      if (sku && pname && !nameMap.has(sku)) nameMap.set(sku, pname);
    }
    for (const inv of currentBySku) {
      if (!nameMap.has(inv.external_sku)) nameMap.set(inv.external_sku, String(inv.product_name || inv.external_sku));
    }
    const alerts: Array<{ sku: string; name: string; stock: number; daysRemaining: number; spike: boolean; recentAvg: number; prevAvg: number }> = [];
    for (const [sku, monthMap] of bySkuMonth) {
      const recentAvg = recent2.length ? recent2.reduce((s, m) => s + (monthMap.get(m) ?? 0), 0) / recent2.length : 0;
      const prevAvg = prior3.length ? prior3.reduce((s, m) => s + (monthMap.get(m) ?? 0), 0) / prior3.length : 0;
      const last3Total = last3.reduce((s, m) => s + (monthMap.get(m) ?? 0), 0);
      const avgDaily = last3.length ? last3Total / last3.length / 30 : 0;
      const stock = stockMap.get(sku) ?? 0;
      const daysRemaining = avgDaily > 0 ? Math.round(stock / avgDaily) : Infinity;
      const spike = prevAvg > 0 && recentAvg > prevAvg * 1.5;
      if (daysRemaining < 60 || spike) {
        alerts.push({ sku, name: nameMap.get(sku) || sku, stock, daysRemaining, spike, recentAvg, prevAvg });
      }
    }
    return alerts.sort((a, b) => (a.daysRemaining === Infinity ? 9999 : a.daysRemaining) - (b.daysRemaining === Infinity ? 9999 : b.daysRemaining)).slice(0, 5);
  }, [sales.rows, currentBySku]);

  const today = new Date().toISOString().slice(0, 10);
  const in60days = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  const arrivingSoon = products.rows
    .filter((p) => p.estimated_arrival_date && p.estimated_arrival_date >= today && p.estimated_arrival_date <= in60days)
    .sort((a, b) => String(a.estimated_arrival_date).localeCompare(String(b.estimated_arrival_date)));

  return (
    <Page title="Dashboard" subtitle="開發商品、費用與業績總覽">
      <div className="grid gap-4 md:grid-cols-4">
        <Card label="開發中商品" value={String(active)} />
        <Card label="延遲商品" value={String(delayed)} tone="coral" />
        <Card label="本月費用" value={formatCurrency(monthCost)} />
        <Card label="本月業績" value={formatCurrency(monthSales)} />
      </div>
      <StatusSummary rows={statusRows} />
      {arrivingSoon.length > 0 && (
        <section className="rounded-lg border border-blue-200 bg-blue-50 p-5">
          <h3 className="mb-3 font-semibold text-blue-800">即將到貨（60 天內）</h3>
          <div className="space-y-2">
            {arrivingSoon.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md bg-white px-4 py-2.5 shadow-sm">
                <div>
                  <span className="font-mono text-xs text-slate-400">{p.sku || '-'}</span>
                  <span className="ml-2 text-sm text-slate-700">{p.name}</span>
                </div>
                <span className="text-sm font-semibold text-blue-700">{p.estimated_arrival_date}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      {dashboardAlerts.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h3 className="mb-3 font-semibold text-amber-800">補貨警示 Top 5</h3>
          <div className="space-y-2">
            {dashboardAlerts.map(({ sku, name, stock, daysRemaining, spike, recentAvg, prevAvg }) => {
              const urgent = daysRemaining < 30;
              const caution = daysRemaining >= 30 && daysRemaining < 60;
              return (
                <div key={sku} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-4 py-2.5 shadow-sm">
                  <div>
                    <span className="font-mono text-xs text-slate-400">{sku}</span>
                    <span className="ml-2 text-sm text-slate-700">{name.startsWith(sku) ? name.slice(sku.length).trim() : name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {spike && (
                      <span className="rounded-full bg-leaf/10 px-2.5 py-0.5 font-medium text-leaf">
                        📈 銷量突增（近期 {recentAvg.toFixed(0)} 件/月 vs 前期 {prevAvg.toFixed(0)} 件/月）
                      </span>
                    )}
                    <span className={`rounded-full px-2.5 py-0.5 font-semibold ${urgent ? 'bg-red-100 text-red-600' : caution ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                      {daysRemaining === Infinity ? '無銷售紀錄' : `剩約 ${daysRemaining} 天庫存`}
                    </span>
                    <span className="text-slate-400">現貨 {stock.toLocaleString('zh-TW')} 件</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </Page>
  );
}

function ProductsPage() {
  const products = useRows('products');
  const vendors = useRows('vendors');
  const progress = useRows('development_progress');
  const events = useRows('development_events');
  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [filterVendor, setFilterVendor] = useState('');

  const filteredProducts = useMemo(() =>
    filterVendor ? products.rows.filter((p) => p.vendor_id === filterVendor) : products.rows,
    [products.rows, filterVendor],
  );

  async function save(data: Row) {
    const payload = clean({
      sku: data.sku,
      name: data.name,
      category: data.category,
      color: data.color,
      size: data.size,
      season: data.season,
      owner: data.owner,
      current_stage: data.current_stage,
      vendor_id: data.vendor_id || null,
      status: data.status || 'planning',
      target_launch_date: data.target_launch_date || null,
      estimated_arrival_date: data.estimated_arrival_date || null,
      estimated_retail_price: data.estimated_retail_price ? Number(data.estimated_retail_price) : null,
      spec_summary: data.spec_summary,
      specification_summary: data.spec_summary,
      attachment_url: data.attachment_url,
      notes: data.notes,
    });
    if (editing?.id) {
      const { error } = await supabase!.from('products').update(payload).eq('id', editing.id);
      if (error) { setMessage(`商品更新失敗：${error.message}`); return; }
    } else {
      const { error } = await supabase!.from('products').insert(payload);
      if (error) { setMessage(`商品新增失敗：${error.message}`); return; }
    }
    setOpen(false);
    setEditing(null);
    setMessage('');
    products.reload();
  }

  async function remove(row: Row) {
    if (!supabase) return;
    const { count } = await supabase
      .from('development_progress')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', row.id);
    const progressNote = count ? `\n此操作將同時刪除 ${count} 筆開發進度記錄，無法還原。` : '';
    if (confirm(`確定刪除「${row.name}」嗎？${progressNote}`)) {
      await supabase.from('products').delete().eq('id', row.id);
      products.reload();
    }
  }

  return (
    <Page title="商品管理" subtitle="建立商品、編輯商品、查看詳情與進度">
      <div className="flex flex-wrap items-end gap-3">
        <Toolbar onAdd={() => { setEditing(null); setOpen(true); }} label="新增商品" />
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">篩選廠商</span>
          <select value={filterVendor} onChange={(e) => setFilterVendor(e.target.value)} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
            <option value="">全部廠商</option>
            {vendors.rows.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
        {filterVendor && <p className="self-end pb-2 text-sm text-slate-500">共 {filteredProducts.length} 件商品</p>}
      </div>
      {message && <Notice tone="error">{message}</Notice>}
      {products.error && <Notice tone="error">商品資料讀取失敗：{products.error}</Notice>}
      {(progress.error || events.error) && <Notice tone="error">進度資料讀取失敗：{progress.error || events.error}</Notice>}
      {open && <ProductForm row={editing} vendors={vendors.rows} onCancel={() => setOpen(false)} onSave={save} />}
      <Table columns={['SKU', '商品名稱', '分類', '狀態', '最近進度', '廠商', '操作']}>
        {products.loading ? <LoadingRow /> : filteredProducts.map((row) => (
          <tr key={row.id} className="border-t align-top">
            <td className="p-3">{row.sku}</td>
            <td className="p-3"><Link to={`/products/${row.id}`} className="font-medium text-leaf hover:underline">{row.name}</Link><p className="mt-1 text-xs text-slate-500">{[row.color, row.size].filter(Boolean).join(' / ')}</p></td>
            <td className="p-3">{row.category}</td>
            <td className="p-3">{statusText(row.status)}</td>
            <td className="p-3"><LatestProgress product={row} progress={mergeProgressRows(row.id, progress.rows, events.rows)} /></td>
            <td className="p-3">{vendors.rows.find((v) => v.id === row.vendor_id)?.name}</td>
            <td className="p-3"><ActionButtons onEdit={() => { setEditing(row); setOpen(true); }} onDelete={() => remove(row)} /></td>
          </tr>
        ))}
      </Table>
    </Page>
  );
}

function ProductDetailPage() {
  const { id } = useParams();
  const products = useRows('products');
  const vendors = useRows('vendors');
  const progress = useRows('development_progress');
  const events = useRows('development_events');
  const costs = useRows('development_costs');
  const batches = useRows('product_batches', 'ordered_at');
  const product = products.rows.find((p) => p.id === id);
  const productProgress = mergeProgressRows(id, progress.rows, events.rows).sort((a, b) => String(b.started_at || b.created_at).localeCompare(String(a.started_at || a.created_at)));
  const productBatches = batches.rows
    .filter((b) => b.product_id === id)
    .sort((a, b) => String(a.ordered_at || '').localeCompare(String(b.ordered_at || '')));
  const productBatchIds = new Set(productBatches.map((b) => b.id));
  const productCosts = costs.rows.filter((c) => c.product_id === id || (c.batch_id && productBatchIds.has(c.batch_id)));
  const costsByBatch = productCosts.reduce<Record<string, Row[]>>((acc, c) => {
    const key = c.batch_id ?? '__none__';
    acc[key] = acc[key] ?? [];
    acc[key].push(c);
    return acc;
  }, {});
  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchData, setBatchData] = useState<Row>({});
  const [batchSaving, setBatchSaving] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const [costSaveError, setCostSaveError] = useState('');

  async function saveCost(data: Row) {
    if (!supabase) return;
    setCostSaveError('');
    const payload = clean({
      product_id: id,
      batch_id: data.batch_id || null,
      vendor_id: data.vendor_id || null,
      type: data.type || null,
      custom_type: data.type === 'other' ? data.custom_type : null,
      description: data.description,
      amount: parseNumber(data.amount),
      paid_amount: parseNumber(data.paid_amount),
      currency: data.currency || 'TWD',
      exchange_rate_to_twd: parseNumber(data.exchange_rate_to_twd) || 1,
      bank_fee_twd: parseNumber(data.bank_fee_twd),
      paid_at: data.paid_at || null,
      due_date: data.due_date || null,
      notes: data.notes,
    });
    const { error } = await supabase.from('development_costs').insert(payload);
    if (error) { setCostSaveError(`儲存失敗：${error.message}`); return; }
    setCostOpen(false);
    costs.reload();
  }

  async function saveBatch() {
    if (!batchData.name?.trim() || !supabase) return;
    setBatchSaving(true);
    await supabase.from('product_batches').insert(clean({
      product_id: id,
      name: batchData.name.trim(),
      ordered_at: batchData.ordered_at || null,
      quantity: parseNumber(batchData.quantity) || null,
      notes: batchData.notes || null,
    }));
    setBatchOpen(false);
    setBatchData({});
    setBatchSaving(false);
    batches.reload();
  }

  async function saveProgress(data: Row) {
    const eventPayload = clean({
      product_id: id,
      stage: data.stage,
      title: data.title,
      note: data.content,
      started_at: data.started_at || null,
      due_date: data.expected_completed_at || null,
      completed_at: data.completed_at || null,
    });
    const progressPayload = clean({
      product_id: id,
      stage: data.stage,
      title: data.title,
      content: data.content,
      started_at: data.started_at || null,
      expected_completed_at: data.expected_completed_at || null,
      completed_at: data.completed_at || null,
      is_completed: Boolean(data.completed_at),
      image_url: data.image_url ?? null,
      image_urls: data.image_urls ?? null,
    });
    let error: any = null;
    if (editing?.id) {
      if (editing._source === 'development_events') {
        // Migrate legacy development_events record to development_progress to avoid enum constraint
        const { error: delErr } = await supabase!.from('development_events').delete().eq('id', editing.id);
        if (delErr) { setMessage(`進度儲存失敗：${delErr.message}`); return; }
        ({ error } = await supabase!.from('development_progress').insert(progressPayload));
      } else {
        ({ error } = await supabase!.from('development_progress').update(progressPayload).eq('id', editing.id));
      }
    } else {
      ({ error } = await supabase!.from('development_progress').insert(progressPayload));
    }
    if (error) {
      setMessage(`進度儲存失敗：${error.message}`);
      return;
    }
    setEditing(null);
    setOpen(false);
    setMessage('');
    progress.reload();
    events.reload();
  }

  async function removeProgress(row: Row) {
    if (confirm('確定刪除這筆進度嗎？')) {
      await supabase?.from(row._source || 'development_events').delete().eq('id', row.id);
      progress.reload();
      events.reload();
    }
  }

  if (!product && products.loading) return <Page title="商品詳情" subtitle="載入中..."><p>載入中...</p></Page>;
  if (!product) return <Page title="商品詳情" subtitle="找不到商品"><Link className="text-leaf" to="/products">返回商品列表</Link></Page>;

  return (
    <Page title={product.name} subtitle={`${product.sku || '無 SKU'} / ${product.category || '未分類'}`}>
      <Link to="/products" className="inline-flex w-fit items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">返回商品總表</Link>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <div className="grid gap-4 md:grid-cols-3">
            <Info label="狀態" value={statusText(product.status)} />
            <Info label="目前階段" value={product.current_stage || '-'} />
            <Info label="廠商" value={vendors.rows.find((v) => v.id === product.vendor_id)?.name || '-'} />
            <Info label="顏色" value={product.color || '-'} />
            <Info label="尺寸" value={product.size || '-'} />
            <Info label="預計上架" value={product.target_launch_date || '-'} />
          </div>
          <div className="mt-5">
            <p className="text-sm text-slate-500">規格摘要</p>
            <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-6">{product.spec_summary || product.specification_summary || '尚未填寫'}</p>
          </div>
          {product.attachment_url && <a href={product.attachment_url} target="_blank" className="mt-4 inline-block text-sm text-leaf hover:underline">開啟附件連結</a>}
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <p className="text-sm text-slate-500">此商品總費用（台幣）</p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(productCosts.reduce((s, c) => s + costTotal(c), 0))}</p>
          <p className="mt-2 text-sm text-slate-500">費用筆數：{productCosts.length}　批次數：{productBatches.length}</p>
          <p className="mt-1 text-xs text-slate-400">各批次單位成本詳見下方明細</p>
        </section>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">批次費用明細</h3>
          <div className="flex gap-3">
            <button type="button" onClick={() => { setCostOpen(!costOpen); }} className="rounded-md bg-leaf px-3 py-1.5 text-sm text-white hover:opacity-90">＋ 新增費用</button>
            <button type="button" onClick={() => { setBatchOpen(!batchOpen); setBatchData({}); }} className="rounded-md border border-leaf px-3 py-1.5 text-sm text-leaf hover:bg-leaf hover:text-white">＋ 新增批次</button>
            <Link to="/costs" className="text-sm text-leaf hover:underline self-center">費用管理 →</Link>
          </div>
        </div>
        {batchOpen && (
          <div className="mb-4 rounded-lg border border-leaf/30 bg-green-50 p-4">
            <p className="mb-3 text-sm font-medium text-leaf">新增採購批次</p>
            <div className="grid gap-3 md:grid-cols-4">
              <label className="text-sm md:col-span-2">批次名稱（必填）
                <input value={batchData.name ?? ''} onChange={(e) => setBatchData({ ...batchData, name: e.target.value })} placeholder="例：2025 第一批" className="mt-1 w-full rounded-md border px-3 py-2" />
              </label>
              <label className="text-sm">下單日期
                <input type="date" value={batchData.ordered_at ?? ''} onChange={(e) => setBatchData({ ...batchData, ordered_at: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2" />
              </label>
              <label className="text-sm">採購數量
                <input type="number" value={batchData.quantity ?? ''} onChange={(e) => setBatchData({ ...batchData, quantity: e.target.value })} placeholder="件數" className="mt-1 w-full rounded-md border px-3 py-2" />
              </label>
              <label className="text-sm md:col-span-4">備註
                <input value={batchData.notes ?? ''} onChange={(e) => setBatchData({ ...batchData, notes: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2" />
              </label>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={saveBatch} disabled={!batchData.name?.trim() || batchSaving} className="rounded-md bg-leaf px-4 py-1.5 text-sm text-white disabled:opacity-40">{batchSaving ? '建立中...' : '建立批次'}</button>
              <button type="button" onClick={() => setBatchOpen(false)} className="text-sm text-slate-400">取消</button>
            </div>
          </div>
        )}
        {costOpen && (
          <div className="mb-4">
            {costSaveError && <p className="mb-2 text-sm text-red-500">{costSaveError}</p>}
            <CostForm
              row={{ product_id: id }}
              products={products.rows}
              batches={batches.rows.filter((b) => b.product_id === id)}
              onSave={saveCost}
              onCancel={() => { setCostOpen(false); setCostSaveError(''); }}
            />
          </div>
        )}
        {(batches.loading || costs.loading) && <p className="text-sm text-slate-400">載入中...</p>}
        {!batches.loading && !costs.loading && (
          <div className="space-y-4">
            {(costsByBatch['__none__'] ?? []).length > 0 && (
              <div className="overflow-hidden rounded-lg border border-blue-200 bg-blue-50/40">
                <div className="border-b border-blue-100 bg-blue-50 px-5 py-3">
                  <p className="font-medium text-blue-700">開發費用（未關聯批次）</p>
                  <p className="text-xs text-blue-500 mt-0.5">打樣、設計、模具等開發階段費用</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="bg-white text-slate-500">
                      <tr className="border-b border-slate-100">
                        {['類型', '說明', '幣別', '金額', '匯率', '手續費', '台幣小計', '狀態'].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(costsByBatch['__none__'] ?? []).map((c) => (
                        <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium">{c.custom_type || costTypeLabel(c.type)}</td>
                          <td className="px-4 py-2.5 text-slate-600">{c.description || '-'}</td>
                          <td className="px-4 py-2.5">{c.currency}</td>
                          <td className="px-4 py-2.5">{Number(c.amount ?? 0).toLocaleString('zh-TW', { maximumFractionDigits: 2 })}</td>
                          <td className="px-4 py-2.5 text-slate-500">{c.exchange_rate_to_twd}</td>
                          <td className="px-4 py-2.5">{Number(c.bank_fee_twd ?? 0) > 0 ? formatCurrency(c.bank_fee_twd) : '-'}</td>
                          <td className="px-4 py-2.5 font-semibold">{formatCurrency(costTotal(c))}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${c.payment_status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-600'}`}>
                              {c.payment_status === 'paid' ? '已付款' : '待付款'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {productBatches.map((batch) => {
              const batchCosts = costsByBatch[batch.id] ?? [];
              const totalTWD = batchCosts.reduce((s, c) => s + costTotal(c), 0);
              const paidTWD = batchCosts.filter((c) => c.payment_status === 'paid').reduce((s, c) => s + costTotal(c), 0);
              const qty = Number(batch.quantity) || 0;
              const unitCost = qty > 0 ? totalTWD / qty : 0;
              return (
                <div key={batch.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 bg-slate-50 px-5 py-4">
                    <div>
                      <p className="font-semibold text-ink">{batch.name}</p>
                      <p className="mt-0.5 text-sm text-slate-500">
                        下單日：{batch.ordered_at || '-'}　／　數量：<span className="font-medium text-ink">{qty.toLocaleString('zh-TW')} 件</span>
                      </p>
                      {batch.notes && <p className="mt-1 text-xs text-slate-400">{batch.notes}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">批次總成本（台幣）</p>
                      <p className="text-xl font-bold text-ink">{formatCurrency(totalTWD)}</p>
                      <p className="mt-1 text-sm text-slate-600">單位成本：<span className="font-semibold text-leaf">{formatCurrency(unitCost)}</span></p>
                      {paidTWD < totalTWD && (
                        <p className="mt-0.5 text-xs text-amber-500">待付：{formatCurrency(totalTWD - paidTWD)}</p>
                      )}
                    </div>
                  </div>
                  {batchCosts.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-slate-400">此批次尚無費用紀錄，請至費用管理新增。</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead className="bg-white text-slate-500">
                          <tr className="border-b border-slate-100">
                            {['類型', '說明', '幣別', '金額', '匯率', '手續費', '台幣小計', '狀態'].map((h) => (
                              <th key={h} className="px-4 py-2.5 text-left font-medium">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {batchCosts.map((c) => (
                            <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                              <td className="px-4 py-2.5 font-medium">{c.custom_type || costTypeLabel(c.type)}</td>
                              <td className="px-4 py-2.5 text-slate-600">{c.description || '-'}</td>
                              <td className="px-4 py-2.5">{c.currency}</td>
                              <td className="px-4 py-2.5">{Number(c.amount ?? 0).toLocaleString('zh-TW', { maximumFractionDigits: 2 })}</td>
                              <td className="px-4 py-2.5 text-slate-500">{c.exchange_rate_to_twd}</td>
                              <td className="px-4 py-2.5">{Number(c.bank_fee_twd ?? 0) > 0 ? formatCurrency(c.bank_fee_twd) : '-'}</td>
                              <td className="px-4 py-2.5 font-semibold">{formatCurrency(costTotal(c))}</td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${c.payment_status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-600'}`}>
                                  {c.payment_status === 'paid' ? '已付款' : '待付款'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                          <tr>
                            <td colSpan={6} className="px-4 py-2.5 text-right text-sm font-medium text-slate-600">批次合計</td>
                            <td className="px-4 py-2.5 font-bold text-ink">{formatCurrency(totalTWD)}</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
            {productBatches.length === 0 && (costsByBatch['__none__'] ?? []).length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
                尚無費用紀錄。點擊上方「＋ 新增費用」開始記錄開發費用。
              </p>
            )}
          </div>
        )}
      </section>

      <section>
        <Toolbar onAdd={() => { setEditing(null); setOpen(true); }} label="新增進度" />
        {message && <Notice tone="error">{message}</Notice>}
        {(progress.error || events.error) && <Notice tone="error">進度資料讀取失敗：{progress.error || events.error}</Notice>}
        {open && <ProgressForm row={editing} onCancel={() => setOpen(false)} onSave={saveProgress} />}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <h3 className="mb-4 font-semibold">進度追蹤 Timeline</h3>
          <div className="space-y-4">
            {productProgress.length === 0 && <p className="text-sm text-slate-500">尚無進度紀錄</p>}
            {productProgress.map((row) => {
              const progressOverdue = !row.completed_at && dueDateStatus(row.expected_completed_at) === 'overdue';
              const progressSoon = !row.completed_at && dueDateStatus(row.expected_completed_at) === 'soon';
              return (
                <div key={row.id} className={`grid gap-3 border-l-4 p-4 md:grid-cols-[1fr_auto] ${progressOverdue ? 'border-red-400 bg-red-50' : progressSoon ? 'border-amber-400 bg-amber-50' : 'border-leaf bg-slate-50'}`}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{row.stage}{row.title ? ` / ${row.title}` : ''}</p>
                      {progressOverdue && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">進度逾期</span>}
                      {progressSoon && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">即將到期</span>}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{row.content}</p>
                    {(() => {
                      const imgs = parseImgUrls(row);
                      if (!imgs.length) return null;
                      const gc = imgs.length === 1 ? '' : imgs.length === 2 ? 'grid grid-cols-2 gap-1' : 'grid grid-cols-3 gap-1';
                      return (
                        <div className={`mt-2 ${gc}`}>
                          {imgs.map((src, i) => (
                            <img key={i} src={src} alt={`附圖${i + 1}`}
                              className="w-full rounded-md object-contain bg-slate-50 cursor-zoom-in"
                              style={{ maxHeight: imgs.length === 1 ? '160px' : imgs.length === 2 ? '120px' : '100px' }}
                              onClick={() => window.open(src, '_blank')} />
                          ))}
                        </div>
                      );
                    })()}
                    <p className="mt-2 text-xs text-slate-500">日期：{row.started_at || '-'}　預計完成：{row.expected_completed_at || '-'}　完成日：{row.completed_at || '-'}</p>
                  </div>
                  <ActionButtons onEdit={() => { setEditing(row); setOpen(true); }} onDelete={() => removeProgress(row)} />
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </Page>
  );
}

function VendorsPage() {
  const vendors = useRows('vendors');
  const products = useRows('products');
  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);

  async function save(data: Row) {
    const payload = clean({
      name: data.name,
      contact_name: data.contact_name,
      phone: data.phone,
      email: data.email,
      address: data.address,
      payment_terms: data.payment_terms,
      bank_info: data.bank_info,
      notes: data.notes,
    });
    if (editing?.id) await supabase?.from('vendors').update(payload).eq('id', editing.id);
    else await supabase?.from('vendors').insert(payload);
    setOpen(false);
    setEditing(null);
    vendors.reload();
  }

  async function remove(row: Row) {
    if (confirm(`確定刪除廠商「${row.name}」嗎？`)) {
      await supabase?.from('vendors').delete().eq('id', row.id);
      vendors.reload();
    }
  }

  return (
    <Page title="廠商管理" subtitle="廠商資料、合作商品與付款資訊">
      <Toolbar onAdd={() => { setEditing(null); setOpen(true); }} label="新增廠商" />
      {open && <VendorForm row={editing} onCancel={() => setOpen(false)} onSave={save} />}
      <div className="grid gap-4">
        {vendors.rows.map((vendor) => {
          const vendorProducts = dedupeByName(products.rows.filter((p) => p.vendor_id === vendor.id));
          return (
            <section key={vendor.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <div>
                  <h3 className="text-lg font-semibold">{vendor.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{vendor.contact_name || '-'} / {vendor.phone || '-'} / {vendor.email || '-'}</p>
                  <p className="mt-2 text-sm text-slate-600">{vendor.address}</p>
                </div>
                <ActionButtons onEdit={() => { setEditing(vendor); setOpen(true); }} onDelete={() => remove(vendor)} />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Info label="付款資訊" value={vendor.payment_terms || vendor.bank_info || '尚未填寫'} />
                <div>
                  <p className="text-sm text-slate-500">合作商品</p>
                  {vendorProducts.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {vendorProducts.map((product) => <Link key={product.id} to={`/products/${product.id}`} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-leaf hover:bg-slate-50">{product.name}</Link>)}
                    </div>
                  ) : <p className="mt-1 text-sm font-medium text-ink">尚無合作商品</p>}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </Page>
  );
}

function CostsPage() {
  const costs = useRows('development_costs');
  const products = useRows('products');
  const batches = useRows('product_batches', 'ordered_at');
  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showUnpaid, setShowUnpaid] = useState(false);
  const monthRows = costs.rows.filter((c) => String(c.paid_at ?? c.created_at).startsWith(month));
  const total = monthRows.reduce((s, c) => s + costTotal(c), 0);
  const paid = monthRows.reduce((s, c) => s + Number(c.paid_amount ?? 0) * Number(c.exchange_rate_to_twd || 1), 0);
  const unpaidRows = costs.rows.filter((c) => c.payment_status !== 'paid').sort((a, b) => String(a.due_date || a.created_at).localeCompare(String(b.due_date || b.created_at)));

  const [saveError, setSaveError] = useState('');

  async function save(data: Row) {
    setSaveError('');
    const payload = clean({
      product_id: data.product_id || null,
      batch_id: data.batch_id || null,
      vendor_id: data.vendor_id || null,
      type: data.type || null,
      custom_type: data.type === 'other' ? data.custom_type : null,
      description: data.description,
      amount: parseNumber(data.amount),
      paid_amount: parseNumber(data.paid_amount),
      currency: data.currency || 'TWD',
      exchange_rate_to_twd: parseNumber(data.exchange_rate_to_twd) || 1,
      bank_fee_twd: parseNumber(data.bank_fee_twd),
      paid_at: data.paid_at || null,
      due_date: data.due_date || null,
      notes: data.notes,
    });
    const { error } = editing?.id
      ? await supabase!.from('development_costs').update(payload).eq('id', editing.id)
      : await supabase!.from('development_costs').insert(payload);
    if (error) { setSaveError(`儲存失敗：${error.message}`); return; }
    setOpen(false);
    setEditing(null);
    costs.reload();
  }

  async function remove(row: Row) {
    if (confirm('確定刪除這筆費用嗎？')) {
      await supabase?.from('development_costs').delete().eq('id', row.id);
      costs.reload();
    }
  }

  return (
    <Page title="費用管理" subtitle="依付款日統計，支援台幣、美金、人民幣與手續費">
      <TopLinks links={[['/products', '商品總表'], ['/vendors', '廠商總表']]} />
      <div className="grid gap-3 md:grid-cols-[220px_1fr]">
        <label className="text-sm">選擇月份<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" /></label>
        <Toolbar onAdd={() => { setEditing(null); setOpen(true); }} label="新增費用" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card label="本月總成本" value={formatCurrency(total)} />
        <Card label="本月已付款" value={formatCurrency(paid)} />
        <button type="button" onClick={() => setShowUnpaid(!showUnpaid)} className="text-left">
          <Card label={`全部未付款${unpaidRows.length ? `（${unpaidRows.length} 筆，點擊查看）` : ''}`} value={formatCurrency(unpaidRows.reduce((s, c) => s + costTotal(c) - Number(c.paid_amount ?? 0) * Number(c.exchange_rate_to_twd || 1), 0))} tone="coral" />
        </button>
      </div>

      {showUnpaid && (
        <section className="rounded-lg border border-coral/30 bg-white p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-coral">未付款明細（共 {unpaidRows.length} 筆）</h3>
            <button type="button" onClick={() => setShowUnpaid(false)} className="text-sm text-slate-400 hover:text-slate-600">關閉 ✕</button>
          </div>
          {unpaidRows.length === 0 ? (
            <p className="text-sm text-slate-400">目前無未付款項目</p>
          ) : (
            <Table columns={['到期日', '商品', '類型', '說明', '台幣金額', '已付', '尚欠', '操作']}>
              {unpaidRows.map((row) => {
                const totalTWD = costTotal(row);
                const paidTWD = Number(row.paid_amount ?? 0) * Number(row.exchange_rate_to_twd || 1);
                const owingTWD = totalTWD - paidTWD;
                const dueStatus = dueDateStatus(row.due_date);
                const dueCls = dueStatus === 'overdue' ? 'text-red-600 font-semibold' : dueStatus === 'soon' ? 'text-amber-600 font-semibold' : 'text-slate-700';
                return (
                  <tr key={row.id} className={`border-t align-top ${dueStatus === 'overdue' ? 'bg-red-50' : dueStatus === 'soon' ? 'bg-amber-50' : ''}`}>
                    <td className={`p-3 text-sm ${dueCls}`}>
                      {row.due_date || '-'}
                      {dueStatus === 'overdue' && <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-xs text-red-700">逾期</span>}
                      {dueStatus === 'soon' && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">即將到期</span>}
                    </td>
                    <td className="p-3 text-sm">{products.rows.find((p) => p.id === row.product_id)?.name || '-'}</td>
                    <td className="p-3 text-sm">{row.custom_type || row.type}</td>
                    <td className="p-3 text-sm">{row.description || '-'}</td>
                    <td className="p-3 text-sm">{formatCurrency(totalTWD)}</td>
                    <td className="p-3 text-sm text-green-600">{formatCurrency(paidTWD)}</td>
                    <td className="p-3 text-sm font-semibold text-coral">{formatCurrency(owingTWD)}</td>
                    <td className="p-3"><ActionButtons onEdit={() => { setEditing(row); setOpen(true); setShowUnpaid(false); }} onDelete={() => remove(row)} /></td>
                  </tr>
                );
              })}
            </Table>
          )}
        </section>
      )}
      {saveError && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">{saveError}</p>}
      {open && <CostForm row={editing} products={products.rows} batches={batches.rows} onCancel={() => { setOpen(false); setSaveError(''); }} onSave={save} />}
      <Table columns={['付款日', '商品', '類型', '說明', '金額', '匯率', '手續費', '台幣總額', '操作']}>
        {monthRows.map((row) => (
          <tr key={row.id} className="border-t align-top">
            <td className="p-3">{row.paid_at}</td>
            <td className="p-3">{products.rows.find((p) => p.id === row.product_id)?.name}</td>
            <td className="p-3">{row.custom_type || row.type}</td>
            <td className="p-3">{row.description}</td>
            <td className="p-3">{row.currency} {Number(row.amount ?? 0).toLocaleString('zh-TW')}</td>
            <td className="p-3">{row.exchange_rate_to_twd}</td>
            <td className="p-3">{formatCurrency(row.bank_fee_twd)}</td>
            <td className="p-3 font-medium">{formatCurrency(costTotal(row))}</td>
            <td className="p-3"><ActionButtons onEdit={() => { setEditing(row); setOpen(true); }} onDelete={() => remove(row)} /></td>
          </tr>
        ))}
      </Table>
    </Page>
  );
}

function ProductForm({ row, vendors, onSave, onCancel }: { row: Row | null; vendors: Row[]; onSave: (data: Row) => void; onCancel: () => void }) {
  return <DataForm title={row ? '編輯商品' : '新增商品'} row={row} onSave={onSave} onCancel={onCancel} fields={[
    ['sku', 'SKU'], ['name', '商品名稱', 'required'], ['category', '分類'], ['color', '顏色'], ['size', '尺寸'],
    ['season', '季節'], ['owner', '負責人'],
    ['vendor_id', '廠商', 'select', vendors.map((v) => [v.id, v.name])],
    ['status', '狀態', 'select', statusOptions.map(([v, l]) => [v, l])],
    ['current_stage', '目前階段', 'select', stageOptions.map((s) => [s, s])],
    ['target_launch_date', '預計上架日', 'date'],
    ['estimated_arrival_date', '預估到貨日', 'date'],
    ['estimated_retail_price', '定價', 'number'],
    ['attachment_url', '附件連結'],
    ['spec_summary', '規格摘要', 'textarea'],
    ['notes', '備註', 'textarea'],
  ]} />;
}

function VendorForm({ row, onSave, onCancel }: { row: Row | null; onSave: (data: Row) => void; onCancel: () => void }) {
  return <DataForm title={row ? '重新編輯廠商' : '新增廠商'} row={row} onSave={onSave} onCancel={onCancel} fields={[
    ['name', '廠商名稱', 'required'], ['contact_name', '聯絡人'], ['phone', '電話'], ['email', 'Email'], ['address', '地址', 'textarea'],
    ['payment_terms', '付款條件'], ['bank_info', '付款資訊', 'textarea'], ['notes', '備註', 'textarea'],
  ]} />;
}

async function resizeImage(file: File, maxPx = 1200, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('圖片讀取失敗')); };
    img.src = url;
  });
}

function parseImgUrls(row: Row | null): string[] {
  if (!row) return [];
  if (row.image_urls) { try { return JSON.parse(String(row.image_urls)); } catch {} }
  if (row.image_url) return [String(row.image_url)];
  return [];
}

function ProgressForm({ row, onSave, onCancel }: { row: Row | null; onSave: (data: Row) => void; onCancel: () => void }) {
  const [data, setData] = useState<Row>(row ?? {});
  const [images, setImages] = useState<string[]>(parseImgUrls(row));
  const [resizing, setResizing] = useState(false);

  // Max px shrinks as image count grows: 1→1200, 2→900, 3→720
  const maxPx = [1200, 900, 720][Math.min(images.length, 2)];

  async function handleImg(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || images.length >= 3) return;
    e.target.value = '';
    setResizing(true);
    try { setImages((prev) => { const next = [...prev]; next.push('__loading__'); return next; });
      const b64 = await resizeImage(file, maxPx);
      setImages((prev) => { const next = [...prev]; next[next.indexOf('__loading__')] = b64; return next; });
    } catch { setImages((prev) => prev.filter((s) => s !== '__loading__')); }
    setResizing(false);
  }

  function removeImg(idx: number) { setImages((prev) => prev.filter((_, i) => i !== idx)); }

  const field = (key: string, label: string, type = 'text', span = 1) => (
    <label key={key} className={`text-sm ${span === 3 ? 'md:col-span-3' : ''}`}>{label}
      {type === 'textarea'
        ? <textarea value={data[key] ?? ''} onChange={(e) => setData((d) => ({ ...d, [key]: e.target.value }))} className="mt-1 min-h-24 w-full rounded-md border px-3 py-2" />
        : <input type={type} value={data[key] ?? ''} onChange={(e) => setData((d) => ({ ...d, [key]: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2" />}
    </label>
  );

  const gridCls = images.length === 0 ? 'grid-cols-1' : images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...data, image_urls: images.length ? JSON.stringify(images) : null, image_url: images[0] || null }); }} className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <h3 className="mb-4 font-semibold">{row ? '編輯進度' : '新增進度'}</h3>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm">階段
          <select value={data.stage ?? ''} onChange={(e) => setData((d) => ({ ...d, stage: e.target.value }))} className="mt-1 w-full rounded-md border px-3 py-2">
            <option value="">請選擇</option>{stageOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        {field('started_at', '日期', 'date')}
        {field('title', '標題')}
        {field('content', '內容', 'textarea', 3)}
        {field('expected_completed_at', '預計完成日', 'date')}
        {field('completed_at', '完成日', 'date')}
        <div className="md:col-span-3">
          <p className="mb-2 text-sm text-slate-600">附圖（最多 3 張，自動壓縮；圖愈多壓愈小）</p>
          <div className={`grid gap-2 ${gridCls}`}>
            {images.map((src, i) => (
              <div key={i} className="relative">
                {src === '__loading__'
                  ? <div className="flex aspect-video items-center justify-center rounded-md bg-slate-100 text-xs text-slate-400">壓縮中...</div>
                  : <>
                      <img src={src} alt={`附圖${i + 1}`} className="aspect-video w-full rounded-md object-cover" />
                      <button type="button" onClick={() => removeImg(i)} className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white leading-none">✕</button>
                    </>}
              </div>
            ))}
            {images.length < 3 && !resizing && (
              <label className="flex aspect-video cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-slate-300 text-sm text-slate-400 hover:border-leaf hover:text-leaf">
                <input type="file" accept="image/*" onChange={handleImg} className="hidden" />
                + 新增圖片
              </label>
            )}
          </div>
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <button className="rounded-md bg-leaf px-4 py-2 text-sm text-white">儲存</button>
        <button type="button" onClick={onCancel} className="rounded-md border border-slate-200 px-4 py-2 text-sm">取消</button>
      </div>
    </form>
  );
}

function CostForm({ row, products, batches, onSave, onCancel }: { row: Row | null; products: Row[]; batches: Row[]; onSave: (data: Row) => void; onCancel: () => void }) {
  const [data, setData] = useState<Row>(row ?? {});
  const [addingProduct, setAddingProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductSku, setNewProductSku] = useState('');
  const [saving, setSaving] = useState(false);

  async function createProduct() {
    if (!newProductName.trim() || !supabase) return;
    setSaving(true);
    const { data: created } = await supabase.from('products').insert({ name: newProductName.trim(), sku: newProductSku.trim() || null }).select().single();
    if (created) {
      setData({ ...data, product_id: created.id });
      setAddingProduct(false);
      setNewProductName('');
      setNewProductSku('');
    }
    setSaving(false);
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(data); }} className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <h3 className="mb-4 font-semibold">{row ? '重新編輯費用' : '新增費用'}</h3>
      <div className="grid gap-4 md:grid-cols-3">
        {/* 商品選擇 + 新增商品 */}
        <label className="text-sm">商品
          <div className="mt-1 flex gap-2">
            <select value={data.product_id ?? ''} onChange={(e) => setData({ ...data, product_id: e.target.value })} className="flex-1 rounded-md border px-3 py-2">
              <option value="">請選擇</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.sku ? `${p.sku} ` : ''}{p.name}</option>)}
            </select>
            <button type="button" onClick={() => setAddingProduct(!addingProduct)} className="rounded-md border border-leaf px-2 text-leaf text-sm hover:bg-leaf hover:text-white">＋</button>
          </div>
          {addingProduct && (
            <div className="mt-2 rounded-md border border-leaf/30 bg-green-50 p-3 space-y-2">
              <p className="text-xs font-medium text-leaf">新增商品</p>
              <input placeholder="商品名稱（必填）" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
              <input placeholder="貨號（選填）" value={newProductSku} onChange={(e) => setNewProductSku(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
              <div className="flex gap-2">
                <button type="button" onClick={createProduct} disabled={!newProductName.trim() || saving} className="rounded bg-leaf px-3 py-1 text-xs text-white disabled:opacity-40">{saving ? '建立中...' : '建立並選取'}</button>
                <button type="button" onClick={() => setAddingProduct(false)} className="text-xs text-slate-400">取消</button>
              </div>
            </div>
          )}
        </label>

        {/* 採購批次 */}
        <label className="text-sm">採購批次
          <select value={data.batch_id ?? ''} onChange={(e) => setData({ ...data, batch_id: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2">
            <option value="">請選擇</option>
            {batches.map((b) => {
                const prod = products.find((p) => p.id === b.product_id);
                const prodLabel = prod ? `${prod.sku ? prod.sku + ' ' : ''}${prod.name}` : '';
                return <option key={b.id} value={b.id}>{prodLabel ? `${prodLabel}｜` : ''}{b.name || b.batch_no}</option>;
              })}
          </select>
        </label>

        {/* 費用類型 */}
        <label className="text-sm">費用類型
          <select value={data.type ?? ''} onChange={(e) => setData({ ...data, type: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2">
            <option value="">請選擇</option>
            {costTypes.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </label>

        {[['custom_type', '其他類型'], ['description', '說明']].map(([key, label]) => (
          <label key={key} className="text-sm">{label}<input value={data[key] ?? ''} onChange={(e) => setData({ ...data, [key]: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2" /></label>
        ))}

        {/* 幣別 */}
        <label className="text-sm">幣別
          <select value={data.currency ?? 'TWD'} onChange={(e) => setData({ ...data, currency: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2">
            {[['TWD', '台幣'], ['USD', '美金'], ['CNY', '人民幣']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>

        {[['amount', '金額'], ['exchange_rate_to_twd', '匯率'], ['bank_fee_twd', '手續費台幣'], ['paid_amount', '已付款金額']].map(([key, label]) => (
          <label key={key} className="text-sm">{label}<input type="number" value={data[key] ?? ''} onChange={(e) => setData({ ...data, [key]: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2" /></label>
        ))}

        {[['paid_at', '付款日'], ['due_date', '到期日']].map(([key, label]) => (
          <label key={key} className="text-sm">{label}<input type="date" value={data[key] ?? ''} onChange={(e) => setData({ ...data, [key]: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2" /></label>
        ))}

        <label className="text-sm md:col-span-3">備註<textarea value={data.notes ?? ''} onChange={(e) => setData({ ...data, notes: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2" rows={2} /></label>
      </div>
      <div className="mt-4 flex gap-2">
        <button className="rounded-md bg-leaf px-4 py-2 text-sm text-white">儲存</button>
        <button type="button" onClick={onCancel} className="rounded-md border border-slate-200 px-4 py-2 text-sm">取消</button>
      </div>
    </form>
  );
}

function DataForm({ title, row, fields, onSave, onCancel }: { title: string; row: Row | null; fields: any[]; onSave: (data: Row) => void; onCancel: () => void }) {
  const [data, setData] = useState<Row>(row ?? {});
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(data); }} className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <h3 className="mb-4 font-semibold">{title}</h3>
      <div className="grid gap-4 md:grid-cols-3">
        {fields.map(([key, label, type, options]) => (
          <label key={key} className={`text-sm ${type === 'textarea' ? 'md:col-span-3' : ''}`}>{label}
            {type === 'select' ? (
              <select value={data[key] ?? ''} onChange={(e) => setData({ ...data, [key]: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2">
                <option value="">請選擇</option>{options.map(([value, text]: string[]) => <option key={value} value={value}>{text}</option>)}
              </select>
            ) : type === 'textarea' ? (
              <textarea value={data[key] ?? ''} onChange={(e) => setData({ ...data, [key]: e.target.value })} className="mt-1 min-h-24 w-full rounded-md border px-3 py-2" />
            ) : (
              <input required={type === 'required'} type={type === 'date' || type === 'number' ? type : 'text'} step="0.0001" value={data[key] ?? ''} onChange={(e) => setData({ ...data, [key]: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} className="mt-1 w-full rounded-md border px-3 py-2" />
            )}
          </label>
        ))}
      </div>
      <div className="mt-5 flex gap-2">
        <button className="rounded-md bg-leaf px-4 py-2 text-sm text-white">儲存</button>
        <button type="button" onClick={onCancel} className="rounded-md border border-slate-200 px-4 py-2 text-sm">取消</button>
      </div>
    </form>
  );
}

function SalesPage() {
  const sales = useRows('sales_records', 'sold_at');
  const targets = useRows('sales_targets');
  const [start, setStart] = useState(`${new Date().toISOString().slice(0, 7)}-01`);
  const [end, setEnd] = useState(monthEnd(new Date().toISOString().slice(0, 7)));
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [recentMonths, setRecentMonths] = useState<string[]>(() => readRecentMonths());
  const availableMonths = useMemo(() => [...new Set(sales.rows.map((r) => String(r.sold_at).slice(0, 7)).filter(Boolean))].sort().reverse(), [sales.rows]);
  const monthShortcuts = useMemo(() => {
    const merged = [...recentMonths, ...availableMonths];
    return [...new Set(merged.filter(Boolean))].slice(0, 6);
  }, [availableMonths, recentMonths]);
  function chooseMonth(month: string) {
    setSelectedMonth(month);
    setStart(`${month}-01`);
    setEnd(monthEnd(month));
    const next = [month, ...recentMonths.filter((item) => item !== month)].slice(0, 6);
    setRecentMonths(next);
    localStorage.setItem('salesRecentMonths', JSON.stringify(next));
  }
  const records = sales.rows.filter((r) => r.sold_at >= start && r.sold_at <= end);
  const months = monthsInRange(start, end);
  const revenue = sum(records, 'revenue');
  const qty = sum(records, 'quantity');
  const target = targets.rows.filter((t) => months.includes(String(t.target_month).slice(0, 7))).reduce((s, t) => s + Number(t.target_amount ?? 0), 0);
  const annualTarget = sum(targets.rows.filter((t) => String(t.target_month).startsWith(start.slice(0, 4))), 'target_amount');
  const annualSales = sum(sales.rows.filter((r) => String(r.sold_at).startsWith(start.slice(0, 4))), 'revenue');
  const prevMonth = sumSales(sales.rows, shiftMonth(start, -1), shiftMonth(end, -1));
  const prevYear = sumSales(sales.rows, shiftYear(start, -1), shiftYear(end, -1));
  const [productSearchKw, setProductSearchKw] = useState('');
  const productSearchResults = useMemo(() => {
    const kw = productSearchKw.trim();
    if (kw.length < 2) return null;
    const matched = records.filter((r) =>
      String(r.external_product_name || '').includes(kw) || String(r.external_sku || '').includes(kw)
    );
    if (matched.length === 0) return { total: { qty: 0, revenue: 0 }, skus: [] };
    const skuMap = new Map<string, { label: string; qty: number; revenue: number }>();
    for (const r of matched) {
      const key = String(r.external_sku || r.external_product_name || '');
      const entry = skuMap.get(key) ?? { label: salesProductLabel(r), qty: 0, revenue: 0 };
      entry.qty += Number(r.quantity ?? 0);
      entry.revenue += Number(r.revenue ?? 0);
      skuMap.set(key, entry);
    }
    const skus = [...skuMap.values()].sort((a, b) => b.revenue - a.revenue);
    const total = { qty: skus.reduce((s, x) => s + x.qty, 0), revenue: skus.reduce((s, x) => s + x.revenue, 0) };
    return { total, skus };
  }, [records, productSearchKw]);
  const productRows = rank(group(records, salesProductLabel)).slice(0, 10);

  // 近 6 個月業績趨勢（折線圖）
  const trendData = useMemo(() => {
    const allMonths = [...new Set(sales.rows.map((r) => String(r.sold_at || '').slice(0, 7)).filter(Boolean))].sort();
    return allMonths.slice(-6).map((month) => {
      const rows = sales.rows.filter((r) => String(r.sold_at || '').slice(0, 7) === month);
      return { month: month.replace('-', '/'), revenue: sum(rows, 'revenue'), qty: sum(rows, 'quantity') };
    });
  }, [sales.rows]);

  // 資料一致性驗證（明細表 vs 通路彙總）
  const consistencyCheck = useDataConsistencyCheck(selectedMonth);

  return (
    <Page title="業績追蹤" subtitle="依日期區間查看業績、目標、MOM、YOY 與排行">
      {consistencyCheck && !consistencyCheck.ok && (
        <DataConsistencyWarning check={consistencyCheck} />
      )}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block text-sm">依月份選擇業績
            <input type="month" value={selectedMonth} onChange={(e) => chooseMonth(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" />
          </label>
          <Field label="起日" value={start} onChange={(value) => { setStart(value); setSelectedMonth(value.slice(0, 7)); }} />
          <Field label="迄日" value={end} onChange={setEnd} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {monthShortcuts.map((month) => (
            <button key={month} type="button" onClick={() => chooseMonth(month)} className={`rounded-md border px-3 py-1.5 text-sm ${month === selectedMonth ? 'border-leaf bg-leaf text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {month.replace('-', '/')}
            </button>
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <h3 className="mb-1 font-semibold text-sm">商品業績查詢</h3>
        <p className="mb-3 text-xs text-slate-400">輸入品名或貨號關鍵字（2字以上），查詢上方選定區間內不分尺寸／顏色的業績合計</p>
        <input
          type="text"
          value={productSearchKw}
          onChange={(e) => setProductSearchKw(e.target.value)}
          placeholder="例：涼感衣、AS1SG..."
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-leaf"
        />
        {productSearchResults !== null && (
          <div className="mt-4">
            {productSearchResults.skus.length === 0
              ? <p className="text-sm text-slate-400">區間內找不到「{productSearchKw}」的銷售紀錄</p>
              : <>
                  <div className="mb-3 flex gap-6 rounded-lg bg-slate-50 px-4 py-3">
                    <div><p className="text-xs text-slate-500">區間總業績</p><p className="text-lg font-bold text-leaf">{formatCurrency(productSearchResults.total.revenue)}</p></div>
                    <div><p className="text-xs text-slate-500">區間總數量</p><p className="text-lg font-bold text-ink">{productSearchResults.total.qty.toLocaleString('zh-TW')} 件</p></div>
                    <div><p className="text-xs text-slate-500">符合規格數</p><p className="text-lg font-bold text-ink">{productSearchResults.skus.length} 個</p></div>
                  </div>
                  <div className="space-y-1.5">
                    {productSearchResults.skus.map((s, i) => (
                      <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md border border-slate-100 px-3 py-2 text-sm">
                        <p className="break-words text-slate-700">{s.label}</p>
                        <p className="text-slate-500">{s.qty > 0 ? `${s.qty.toLocaleString('zh-TW')} 件` : '-'}</p>
                        <p className="font-semibold text-leaf">{formatCurrency(s.revenue)}</p>
                      </div>
                    ))}
                  </div>
                </>
            }
          </div>
        )}
      </section>
      <div className="mb-6 space-y-3">
        <div className="grid gap-3 md:grid-cols-3"><Card label="區間業績" value={formatCurrency(revenue)} compact /><Card label="區間銷售數量" value={qty.toLocaleString('zh-TW')} compact /><Card label="平均單價" value={formatCurrency(qty ? revenue / qty : 0)} compact /></div>
        <div className="grid gap-3 md:grid-cols-5"><Card label="月目標" value={formatCurrency(target)} compact /><Card label="月達成率" value={`${(target ? revenue / target * 100 : 0).toFixed(1)}%`} compact /><Card label="年度目標" value={formatCurrency(annualTarget)} compact /><Card label="年度業績" value={formatCurrency(annualSales)} compact /><Card label="年度進度" value={`${annualTarget ? (annualSales / annualTarget * 100).toFixed(1) : '0.0'}%`} compact /></div>
        <div className="grid gap-3 md:grid-cols-2"><Card label="MOM" value={growth(revenue, prevMonth)} helper={`前月 ${formatCurrency(prevMonth)}`} compact /><Card label="YOY" value={growth(revenue, prevYear)} helper={`去年同期 ${formatCurrency(prevYear)}`} compact /></div>
      </div>
      {/* 近 6 個月業績趨勢折線圖（.claude/skills/chart-style 規範） */}
      {trendData.length >= 2 && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <h3 className="mb-4 font-semibold">近 6 個月業績趨勢</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendData} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
              <XAxis dataKey="month" tick={CHART_TICK_MD} />
              <YAxis yAxisId="rev" tickFormatter={(v) => `$${(v / 10000).toFixed(0)}萬`} tick={CHART_TICK} width={60} />
              <YAxis yAxisId="qty" orientation="right" tick={CHART_TICK} width={40} />
              <Tooltip
                formatter={(value: number, name: string) =>
                  name === '業績' ? [formatCurrency(value), name] : [`${value.toLocaleString('zh-TW')} 件`, name]
                }
                contentStyle={CHART_TOOLTIP}
              />
              <Legend wrapperStyle={CHART_LEGEND} />
              <Line yAxisId="rev" type="monotone" dataKey="revenue" name="業績" stroke={CHART_PRIMARY} strokeWidth={CHART_STROKE_W} dot={{ r: 4, fill: CHART_PRIMARY }} activeDot={CHART_ACTIVE_DOT} />
              <Line yAxisId="qty" type="monotone" dataKey="qty" name="銷量（件）" stroke={CHART_SECONDARY} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: CHART_SECONDARY }} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      <Summary title="商品業績排行" rows={productRows} />
      <SalesRecordsTable records={records} />
    </Page>
  );
}

const CHANNELS = ['網路官網／平台', '街邊店', '捷運門市', '加盟門市'] as const;

// 貨號前5碼 → 品項名稱（源自貨號分類表.xlsx）
const SKU_PREFIX_MAP: Record<string, string> = {
  AB1BA:'飲料袋', AB1BB:'購物袋', AB1BC:'旅行袋', AB1BZ:'其他袋品',
  AD1DA:'帳篷/野餐墊', AD1DB:'口罩', AD1DC:'夾扇', AD1DI:'杯子', AD1DL:'面罩', AD1DS:'眼鏡', AD1DZ:'日常其他',
  AG123:'好神包23吋', AG127:'好神包27吋', AG130:'好神包長傘',
  AH1HA:'保暖手套', AH1HB:'保暖帽子', AH1HC:'發熱衣物', AH1HD:'圍巾', AH1HE:'保暖衣物', AH1HZ:'保暖其他',
  AO2OZ:'配件其他',
  AS1SA:'防曬袖套', AS1SB:'遮陽帽', AS1SC:'防曬衣物', AS1SD:'涼感袖套', AS1SE:'涼感其他', AS1SF:'防曬乳', AS1SG:'太陽眼鏡',
  AU1UA:'傘頂', AU1UB:'傘架', AU1UC:'傘帽',
  AW1WA:'防水手套', AW1WB:'防水包', AW1WZ:'防水其他',
  CD1DC:'電器', CD1DD:'行李箱', CD1DE:'電玩', CD1DF:'包包', CD1DG:'鞋類', CD1DH:'衛生棉',
  CD1DI:'杯子', CD1DJ:'生活用品', CD1DM:'冷水壺', CD1DN:'保溫瓶', CD1DO:'美妝保養', CD1DP:'身體用品', CD1DS:'眼鏡', CD1DZ:'其他',
  CF1DB:'口罩',
  CH1SD:'涼感袖套', CH1SE:'涼感其他', CH2HC:'發熱衣物',
  CN1CT:'茶', CN1GZ:'果汁', CN1LS:'零食', CN1SP:'食品',
  CS1SC:'防曬衣物', CS1SF:'防曬乳',
  CS3ST:'踝船型襪', CS3SU:'短襪', CS3SV:'中筒襪',
  GG2GW:'贈品',
  HD1DJ:'生活用品', HD1DK:'文具用品', HD1DY:'制服',
  HP2PA:'物流箱', HP2PB:'膠帶', HP2PC:'包裝貼紙', HP2PD:'物流袋', HP2PE:'包裝工具', HP2PF:'包裝盒', HP2PG:'包裝袋', HP2YF:'運費',
  HS4SY:'文宣品', HS4SZ:'陳列用品',
  J3119:'租傘19吋', J3220:'租傘20吋', J3321:'租傘21吋', J3422:'租傘22吋',
  JO1SY:'文宣品', JO1Z2:'租賃費用', JZ223:'租傘23吋',
  L2119:'長傘19吋', L2121:'長傘21吋', L2123:'長傘23吋', L2125:'長傘25吋', L2127:'長傘27吋', L2130:'長傘30吋', L2133:'長傘33吋', L2135:'長傘35吋',
  L2219:'手開長傘19吋', L2221:'手開長傘21吋', L2223:'手開長傘23吋', L2225:'手開長傘25吋', L2227:'手開長傘27吋', L2230:'手開長傘30吋', L2232:'手開長傘32吋', L2233:'手開長傘33吋',
  L2419:'電動長傘19吋', L2420:'電動長傘20吋', L2421:'電動長傘21吋', L2423:'電動長傘23吋', L2425:'電動長傘25吋', L2427:'電動長傘27吋',
  MM1MM:'傘骨', MM1MS:'中棒',
  RC1C1:'連身雨衣', RC1C2:'兩件式雨衣', RC1C3:'風雨衣', RC1C4:'斗篷雨衣', RC1C5:'反穿雨衣', RC1C6:'兒童雨衣',
  RO1O1:'手套', RO1O2:'背包套', RO1O3:'安全帽套', RO1O4:'機車套', RO1O5:'傘桶',
  RP1P1:'雨褲', RP1P2:'兩件式雨褲',
  RS2S1:'雨鞋', RS2S2:'兒童雨鞋', RS2S3:'有底鞋套', RS2S4:'無底鞋套',
  SA0SM:'配件樣品', SC0PS:'合作商品樣品', SH0CU:'物料樣品',
  U1119:'自動折傘19吋', U1120:'自動折傘20吋', U1121:'自動折傘21吋', U1122:'自動折傘22吋', U1123:'自動折傘23吋', U1125:'自動折傘25吋', U1127:'自動折傘27吋',
  U1219:'手開折傘19吋', U1220:'手開折傘20吋', U1221:'手開折傘21吋', U1222:'手開折傘22吋', U1223:'手開折傘23吋', U1225:'手開折傘25吋', U1227:'手開折傘27吋',
  U1319:'安全自動19吋', U1320:'安全自動20吋', U1321:'安全自動21吋', U1322:'安全自動22吋', U1323:'安全自動23吋', U1325:'安全自動25吋', U1327:'安全自動27吋',
  U1419:'電動折傘19吋', U1420:'電動折傘20吋', U1421:'電動折傘21吋', U1423:'電動折傘23吋', U1425:'電動折傘25吋', U1427:'電動折傘27吋',
  USLSL:'特賣商品',
  ZZ1ZA:'季節折價券', ZZ1ZB:'開卡禮', ZZ1ZC:'首下載禮', ZZ1ZD:'升等禮', ZZ1ZF:'常態折價券',
};

function skuToLabel(sku: string): string {
  const prefix = sku.toUpperCase().slice(0, 5);
  const name = SKU_PREFIX_MAP[prefix];
  return name ? `${prefix} ${name}` : `${prefix} 未知品項`;
}

// ─── Chart style constants (.claude/skills/chart-style/SKILL.md) ─────────────
const CHART_PRIMARY    = '#E8705A';
const CHART_SECONDARY  = '#F4A090';
const CHART_GRID       = '#f1f5f9';
const CHART_TICK       = { fontSize: 11, fill: '#94a3b8' } as const;
const CHART_TICK_MD    = { fontSize: 12, fill: '#94a3b8' } as const;
const CHART_TOOLTIP    = { borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 } as const;
const CHART_LEGEND     = { fontSize: 12 } as const;
const CHART_MARGIN     = { top: 4, right: 16, left: 0, bottom: 0 } as const;
const CHART_STROKE_W   = 2.5;
const CHART_ACTIVE_DOT = { r: 6 } as const;
// ─────────────────────────────────────────────────────────────────────────────

const CHANNEL_COLORS: Record<string, string> = {
  '網路官網／平台': '#E8705A',
  '街邊店': '#F4A090',
  '捷運門市': '#fddf98',
  '加盟門市': '#4ECDC4',
};

function ChannelAnalysisPage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedSku, setSelectedSku] = useState('');
  const [storeSearchKw, setStoreSearchKw] = useState('');
  const [monthRows, setMonthRows] = useState<Row[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [recentMonths, setRecentMonths] = useState<string[]>(() => readRecentMonths());
  const [loading, setLoading] = useState(false);
  const [productKeyword, setProductKeyword] = useState('');
  const [productStoreRows, setProductStoreRows] = useState<Row[] | null>(null);
  const [productSearching, setProductSearching] = useState(false);
  const [crossStart, setCrossStart] = useState('');
  const [crossEnd, setCrossEnd] = useState('');
  const [channelTrendRows, setChannelTrendRows] = useState<Row[]>([]);

  const monthShortcuts = useMemo(() => {
    const merged = [...recentMonths, ...availableMonths];
    return [...new Set(merged.filter(Boolean))].slice(0, 6);
  }, [recentMonths, availableMonths]);

  function chooseMonth(month: string) {
    setSelectedMonth(month);
    const next = [month, ...recentMonths.filter((m) => m !== month)].slice(0, 6);
    setRecentMonths(next);
    localStorage.setItem('salesRecentMonths', JSON.stringify(next));
  }

  // Fetch distinct months on mount
  useEffect(() => {
    if (!supabase) return;
    supabase.from('product_store_sales').select('sales_month').order('sales_month', { ascending: false }).limit(5000)
      .then(({ data }) => {
        if (data) setAvailableMonths([...new Set(data.map((r) => String(r.sales_month).slice(0, 7)))].sort().reverse());
      });
  }, []);

  // 各通路近 6 個月趨勢（from channel_sales_records）
  useEffect(() => {
    if (!supabase || availableMonths.length === 0) return;
    const last6 = [...availableMonths].sort().slice(-6);
    const earliest = `${last6[0]}-01`;
    const latest = monthEnd(last6[last6.length - 1]);
    supabase.from('channel_sales_records')
      .select('sales_month,channel_category,quantity,revenue')
      .gte('sales_month', earliest).lte('sales_month', latest).limit(2000)
      .then(({ data }) => setChannelTrendRows(data ?? []));
  }, [availableMonths]);

  // Fetch data for the selected month directly — avoids the global 3000-row cap
  useEffect(() => {
    if (!supabase) return;
    setLoading(true);
    setSelectedSku('');
    supabase.from('product_store_sales').select('*').gte('sales_month', `${selectedMonth}-01`).lte('sales_month', monthEnd(selectedMonth)).limit(5000)
      .then(({ data }) => { setMonthRows(data ?? []); setLoading(false); });
  }, [selectedMonth]);

  const topByChannel = useMemo(
    () => CHANNELS.map((ch) => {
      const chRows = monthRows.filter((r) => r.channel_category === ch);
      const storeCount = new Set(chRows.map((r) => String(r.store_name || ''))).size;
      return {
        channel: ch,
        storeCount,
        products: rank(group(chRows, (r) => String(r.external_product_name || r.external_sku || '未知'))).slice(0, 3),
      };
    }),
    [monthRows],
  );

  // Channel revenue summary for pie chart (aggregated from product_store_sales)
  const channelRevenueSummary = useMemo(() => {
    // 優先使用 channel_sales_records（channelTrendRows），數字最準確
    // 因為 product_store_sales 在部分月份可能沒有完整的門市分解資料
    const trendMonthRows = channelTrendRows.filter(
      (r) => String(r.sales_month || '').slice(0, 7) === selectedMonth
    );
    if (trendMonthRows.length > 0) {
      return CHANNELS
        .map((ch) => {
          const row = trendMonthRows.find((r) => r.channel_category === ch);
          return { label: ch, quantity: row ? Number(row.quantity) : 0, revenue: row ? Number(row.revenue) : 0 };
        })
        .filter((c) => c.revenue > 0 || c.quantity > 0);
    }
    // Fallback：若 channelTrendRows 尚未載入此月，改用 product_store_sales 彙總
    const map = new Map<string, { quantity: number; revenue: number }>();
    for (const r of monthRows) {
      const ch = String(r.channel_category || '');
      const entry = map.get(ch) ?? { quantity: 0, revenue: 0 };
      entry.quantity += Number(r.quantity ?? 0);
      entry.revenue += Number(r.revenue ?? 0);
      map.set(ch, entry);
    }
    return CHANNELS
      .map((ch) => ({ label: ch, ...(map.get(ch) ?? { quantity: 0, revenue: 0 }) }))
      .filter((c) => c.revenue > 0 || c.quantity > 0);
  }, [channelTrendRows, monthRows, selectedMonth]);

  // Top 5 stores per physical channel
  const storeTop5 = useMemo(() => {
    const result = new Map<string, Array<{ label: string; quantity: number; revenue: number; rank: number }>>();
    for (const ch of ['街邊店', '捷運門市', '加盟門市']) {
      const chRows = monthRows.filter((r) => r.channel_category === ch);
      result.set(ch, rank(group(chRows, (r) => String(r.store_name || ''))).slice(0, 5));
    }
    return result;
  }, [monthRows]);

  // 通路趨勢折線圖資料：每個月一個點，每條線代表一個通路
  const channelTrendChartData = useMemo(() => {
    const months = [...new Set(channelTrendRows.map((r) => String(r.sales_month || '').slice(0, 7)).filter(Boolean))].sort();
    return months.map((month) => {
      const mRows = channelTrendRows.filter((r) => String(r.sales_month || '').startsWith(month));
      const point: Record<string, string | number> = { month: month.replace('-', '/') };
      for (const ch of CHANNELS) {
        const row = mRows.find((r) => r.channel_category === ch);
        point[ch] = row ? Math.round(Number(row.revenue)) : 0;
      }
      return point;
    });
  }, [channelTrendRows]);

  const skuOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of monthRows) {
      const sku = String(r.external_sku || '');
      if (sku && !seen.has(sku)) seen.set(sku, String(r.external_product_name || sku));
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [monthRows]);

  const topStores = useMemo(() => {
    if (!selectedSku) return [];
    const rows = monthRows.filter((r) => String(r.external_sku || '') === selectedSku);
    return rank(group(rows, (r) => `[${r.channel_category}] ${r.store_name}`)).slice(0, 10);
  }, [monthRows, selectedSku]);

  const storeSearchResults = useMemo(() => {
    const kw = storeSearchKw.trim();
    if (!kw) return null;
    const rows = monthRows.filter((r) =>
      String(r.external_product_name || '').includes(kw) || String(r.external_sku || '').includes(kw)
    );
    return rank(group(rows, (r) => `[${r.channel_category}] ${r.store_name}`)).slice(0, 15);
  }, [monthRows, storeSearchKw]);

  async function searchProductStores() {
    if (!supabase || productKeyword.trim().length < 2) return;
    setProductSearching(true);
    setProductStoreRows(null);
    const kw = productKeyword.trim();
    let query = supabase
      .from('product_store_sales')
      .select('channel_category,store_name,quantity,revenue,sales_month')
      .ilike('external_product_name', `%${kw}%`)
      .limit(10000);
    if (crossStart) query = query.gte('sales_month', crossStart);
    if (crossEnd) query = query.lte('sales_month', crossEnd);
    const { data } = await query;
    setProductStoreRows(data ?? []);
    setProductSearching(false);
  }

  const productStoreRanking = useMemo(() => {
    if (!productStoreRows) return [];
    return rank(group(productStoreRows, (r) => `[${r.channel_category}] ${r.store_name}`));
  }, [productStoreRows]);

  // 資料一致性驗證（明細表 vs 通路彙總）
  const consistencyCheck = useDataConsistencyCheck(selectedMonth);

  return (
    <Page title="通路分析" subtitle="各通路商品銷售前三名、各商品最佳門市排行">
      <TopLinks links={[['/sales', '返回業績追蹤']]} />
      {consistencyCheck && !consistencyCheck.ok && (
        <DataConsistencyWarning check={consistencyCheck} />
      )}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <label className="block text-sm">選擇月份
          <input type="month" value={selectedMonth} onChange={(e) => chooseMonth(e.target.value)} className="mt-1 w-full max-w-xs rounded-md border border-slate-200 px-3 py-2" />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          {monthShortcuts.map((m) => (
            <button key={m} type="button" onClick={() => chooseMonth(m)}
              className={`rounded-md border px-3 py-1.5 text-sm ${m === selectedMonth ? 'border-leaf bg-leaf text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {m.replace('-', '/')}
            </button>
          ))}
          {monthShortcuts.length === 0 && <p className="text-sm text-slate-400">尚無資料，請先匯入業績</p>}
        </div>
      </section>

      {loading && <p className="text-sm text-slate-400">載入中...</p>}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <h3 className="mb-1 font-semibold">商品跨規格門市查詢</h3>
        <p className="mb-4 text-xs text-slate-400">輸入商品名稱關鍵字，自動彙總所有符合的 SKU（不分尺寸／顏色），顯示各門市銷售排行</p>
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <input
            type="text"
            value={productKeyword}
            onChange={(e) => setProductKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchProductStores()}
            placeholder="例：防曬帽、涼感上衣..."
            className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-leaf"
          />
          <label className="text-sm">
            <span className="text-slate-500 text-xs block mb-1">起日</span>
            <input type="date" value={crossStart} onChange={(e) => setCrossStart(e.target.value)} className="rounded-md border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm">
            <span className="text-slate-500 text-xs block mb-1">迄日</span>
            <input type="date" value={crossEnd} onChange={(e) => setCrossEnd(e.target.value)} className="rounded-md border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <button
            type="button"
            onClick={searchProductStores}
            disabled={productKeyword.trim().length < 2 || productSearching}
            className="self-end rounded-md bg-leaf px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {productSearching ? '查詢中...' : '查詢'}
          </button>
        </div>

        {productStoreRows !== null && (
          <div className="mt-4">
            {productStoreRanking.length === 0
              ? <p className="text-sm text-slate-400">找不到符合「{productKeyword}」的銷售記錄</p>
              : <>
                  <p className="mb-3 text-xs text-slate-400">共找到 {productStoreRanking.length} 間門市的銷售資料{crossStart || crossEnd ? `（${crossStart || '最早'} ～ ${crossEnd || '最新'}）` : '（全期累計）'}</p>
                  <div className="space-y-2">
                    {productStoreRanking.map((s) => (
                      <div key={s.label} className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-3 rounded-md border border-slate-100 p-3 text-sm">
                        <span className={`text-xl font-bold ${s.rank <= 3 ? 'text-coral' : 'text-slate-300'}`}>{s.rank}</span>
                        <p className="break-words">{s.label}</p>
                        <p className="text-slate-500">{s.quantity.toLocaleString('zh-TW')} 件</p>
                        <p className="font-semibold text-leaf">{formatCurrency(s.revenue)}</p>
                      </div>
                    ))}
                  </div>
                </>
            }
          </div>
        )}
      </section>

      {/* 各通路業績趨勢折線圖（.claude/skills/chart-style 規範） */}
      {channelTrendChartData.length >= 2 && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <h3 className="mb-1 font-semibold">各通路業績趨勢（近 6 個月）</h3>
          <p className="mb-4 text-xs text-slate-400">可對比不同通路在各月份的業績變化</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={channelTrendChartData} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
              <XAxis dataKey="month" tick={CHART_TICK_MD} />
              <YAxis tickFormatter={(v) => `$${(v / 10000).toFixed(0)}萬`} tick={CHART_TICK} width={60} />
              <Tooltip
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
                contentStyle={CHART_TOOLTIP}
              />
              <Legend wrapperStyle={CHART_LEGEND} />
              {CHANNELS.map((ch) => (
                <Line key={ch} type="monotone" dataKey={ch} stroke={CHANNEL_COLORS[ch]} strokeWidth={CHART_STROKE_W}
                  dot={{ r: 4, fill: CHANNEL_COLORS[ch] }} activeDot={CHART_ACTIVE_DOT} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {channelRevenueSummary.length > 0 && <ChannelSummary rows={channelRevenueSummary} />}

      {(['街邊店', '捷運門市', '加盟門市'] as const).some((ch) => (storeTop5.get(ch) ?? []).length > 0) && (
        <section className="grid gap-6 md:grid-cols-3">
          {(['街邊店', '捷運門市', '加盟門市'] as const).map((ch) => (
            <Summary key={ch} title={`${ch}前五名`} rows={storeTop5.get(ch) ?? []} />
          ))}
        </section>
      )}

      <section>
        <h3 className="mb-3 font-semibold">各通路商品前三名</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {topByChannel.map(({ channel, storeCount, products }) => (
            <div key={channel} className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
              <p className="mb-3 font-semibold text-leaf">{channel}{storeCount > 0 && channel !== '網路官網／平台' && <span className="ml-1.5 text-sm font-normal text-slate-400">／{storeCount} 間</span>}</p>
              {products.length === 0
                ? <p className="text-sm text-slate-400">無資料</p>
                : products.map((p) => (
                  <div key={p.label} className="mb-2 flex items-start gap-2 rounded-md border border-slate-100 p-2.5 text-sm">
                    <span className={`min-w-6 text-xl font-bold leading-none ${p.rank <= 3 ? 'text-coral' : 'text-slate-300'}`}>{p.rank}</span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-medium leading-snug">{p.label}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{p.quantity.toLocaleString('zh-TW')} 件</p>
                    </div>
                    <p className="whitespace-nowrap font-semibold text-leaf">{formatCurrency(p.revenue)}</p>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <h3 className="mb-1 font-semibold">各商品門市銷售排行</h3>
        <p className="mb-4 text-xs text-slate-400">輸入品名或貨號關鍵字，自動彙總符合商品的各門市銷售排行（當月資料）</p>
        <input
          type="text"
          value={storeSearchKw}
          onChange={(e) => setStoreSearchKw(e.target.value)}
          placeholder="例：墨鏡、AS1SG..."
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-leaf"
        />
        {storeSearchResults !== null && (
          <div className="mt-4 space-y-2">
            {storeSearchResults.length === 0
              ? <p className="text-sm text-slate-400">找不到符合「{storeSearchKw}」的當月銷售資料</p>
              : <>
                  <p className="text-xs text-slate-400">共 {storeSearchResults.length} 間門市有銷售紀錄</p>
                  {storeSearchResults.map((s) => (
                    <div key={s.label} className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-3 rounded-md border border-slate-100 p-3 text-sm">
                      <span className={`text-xl font-bold ${s.rank <= 3 ? 'text-coral' : 'text-slate-300'}`}>{s.rank}</span>
                      <p className="break-words">{s.label}</p>
                      <p className="text-slate-500">{s.quantity.toLocaleString('zh-TW')} 件</p>
                      <p className="font-semibold text-leaf">{formatCurrency(s.revenue)}</p>
                    </div>
                  ))}
                </>
            }
          </div>
        )}
      </section>
    </Page>
  );
}

function classifyInventoryLocation(loc: string): string {
  // 舊格式：以代碼前綴開頭（如 "000000 總倉"、"E001 平台"）
  if (/^000002\s/.test(loc)) return '退貨倉';
  if (/^000025\s/.test(loc)) return '報廢倉';
  if (/^000/.test(loc)) return '總倉';
  if (/^0ZZZZ/.test(loc)) return '在途';
  if (/^E\d{3}/.test(loc)) return '網路／平台';
  if (/^P002\s|^A000\s/.test(loc)) return '網路／平台';
  if (/^P003\s/.test(loc)) return '總倉';
  // 新格式：純中文地點名稱（如 "總倉"、"祥丰官網倉"、"在途"）
  if (/退貨/.test(loc)) return '退貨倉';
  if (/報廢/.test(loc)) return '報廢倉';
  if (/在途/.test(loc)) return '在途';
  if (/官網倉|平台倉/.test(loc)) return '網路／平台';
  if (/總倉|產品倉/.test(loc)) return '總倉';
  if (/捷運|M6/.test(loc)) return '捷運門市';
  if (/高雄|台南|台中|新竹|宜蘭/.test(loc)) return '加盟門市';
  return '街邊店';
}

/** 尺寸序號對照表（末碼數字 → 尺碼標籤） */
const SIZE_MAP: Record<string, string> = {
  '9': 'XXS', '0': 'XS', '1': 'S', '2': 'M', '3': 'L',
  '4': 'XL', '5': '2L', '6': '3L', '7': '4L', '8': '5L',
};

/** 顏色代碼對照表（英文代碼 → 中文） */
const COLOR_MAP: Record<string, string> = {
  BK: '黑', WT: '白', PK: '粉', GN: '綠', YL: '黃',
  PL: '紫', RD: '紅', BN: '咖/棕', GY: '灰', CO: '膚',
  KK: '卡其', RB: '彩虹', MC: '迷彩', LP: '豹紋', NO: '無分色',
  OG: '橘', GD: '金', SV: '銀', MIX: '混色', BL: '藍', TO: '玳瑁',
};

/** 從 SKU 或商品名稱中解析顏色與尺寸。
 *  支援格式：
 *   1. 連接式：AS1SE0004WT4 → 末尾 2 大寫英文(顏色) + 1 數字(尺寸)
 *   2. 破折號：AS1SE-黑色-M → BASE-COLOR-SIZE
 *   3. 空白：AS1SE 黑色 M → 取最後一個尺寸 token */
function parseSkuColorSize(sku: string, name: string): { color: string; size: string } {
  const sizeWordRe = /^(ONESIZE|FREE|OS|XXL|XL|2XL|3XL|XS|[SML]|\d{2,3}(?:cm|號)?)$/i;

  // 格式 1：連接式末尾「色碼(2–3 大寫英文) + 1 數字(尺寸)」
  // 例：AS1SE0004WT4 → WT=白, 4=XL　　AS1SE0004MIX3 → MIX=混色, 3=L
  // 先嘗試 3 碼（如 MIX），再嘗試 2 碼（如 WT/BK）
  const lastChar = sku[sku.length - 1];
  if (lastChar && /\d/.test(lastChar)) {
    const code3 = sku.slice(-4, -1);   // 倒數第 2–4 碼
    const code2 = sku.slice(-3, -1);   // 倒數第 2–3 碼
    if (/^[A-Z]{3}$/.test(code3) && code3 in COLOR_MAP) {
      return { color: COLOR_MAP[code3], size: SIZE_MAP[lastChar] ?? lastChar };
    }
    if (/^[A-Z]{2}$/.test(code2)) {
      return { color: COLOR_MAP[code2] ?? code2, size: SIZE_MAP[lastChar] ?? lastChar };
    }
  }

  // 格式 2：破折號分隔 BASE-COLOR-SIZE
  const dashParts = sku.split('-');
  if (dashParts.length >= 3 && sizeWordRe.test(dashParts[dashParts.length - 1])) {
    const colorRaw = dashParts.slice(1, -1).join('-');
    const color = COLOR_MAP[colorRaw.toUpperCase()] ?? colorRaw;
    return { color, size: dashParts[dashParts.length - 1].toUpperCase() };
  }

  // 格式 3：商品名稱空白分隔，取最後一個尺寸 token
  const tokens = name.split(/[\s\-　]+/).filter(Boolean);
  for (let i = tokens.length - 1; i >= 1; i--) {
    if (sizeWordRe.test(tokens[i])) {
      const colorRaw = tokens.slice(1, i).join('');
      const color = COLOR_MAP[colorRaw.toUpperCase()] ?? (colorRaw || '-');
      return { color, size: tokens[i].toUpperCase() };
    }
  }

  return { color: '-', size: '-' };
}

function InventoryPage() {
  const inventory = useRows('inventory_records', 'recorded_at');
  const sales = useRows('sales_records', 'sold_at');
  const products = useRows('products', 'created_at');
  const skuCosts = useRows('sku_costs', 'external_sku');
  const productStoreSales = useRows('product_store_sales', 'sales_month');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [message, setMessage] = useState('');
  const [recentMonths, setRecentMonths] = useState<string[]>(() => readRecentMonths());
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [expandedSku, setExpandedSku] = useState<string | null>(null);
  // 門市庫存查詢
  const [storeQuery, setStoreQuery] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [selectedTrendStore, setSelectedTrendStore] = useState<string | null>(null);

  const availableMonths = useMemo(
    () => [...new Set(sales.rows.map((r) => String(r.sold_at).slice(0, 7)).filter(Boolean))].sort().reverse(),
    [sales.rows],
  );
  const monthShortcuts = useMemo(() => {
    const merged = [...recentMonths, ...availableMonths];
    return [...new Set(merged.filter(Boolean))].slice(0, 6);
  }, [recentMonths, availableMonths]);
  function chooseMonth(month: string) {
    setSelectedMonth(month);
    const next = [month, ...recentMonths.filter((m) => m !== month)].slice(0, 6);
    setRecentMonths(next);
    localStorage.setItem('salesRecentMonths', JSON.stringify(next));
  }

  // Find the single global latest snapshot date, then sum all SKUs on that date only.
  // Using per-SKU latest dates causes totals to mix multiple snapshot dates
  // (e.g. old orphaned SKUs + new import = inflated total).
  const latestBySku = useMemo(() => {
    let globalLatest = '';
    for (const r of inventory.rows) {
      const date = String(r.recorded_at || '').slice(0, 10);
      if (date > globalLatest) globalLatest = date;
    }
    const totals = new Map<string, { external_sku: string; product_name: string; quantity: number; recorded_at: string }>();
    for (const r of inventory.rows) {
      const sku = String(r.external_sku || '');
      const date = String(r.recorded_at || '').slice(0, 10);
      if (!sku || date !== globalLatest) continue;
      const entry = totals.get(sku) ?? { external_sku: sku, product_name: String(r.product_name || sku), quantity: 0, recorded_at: date };
      entry.quantity += Number(r.quantity ?? 0);
      totals.set(sku, entry);
    }
    return [...totals.values()];
  }, [inventory.rows]);

  // Per-location breakdown for each SKU (global latest snapshot date only)
  const skuLocations = useMemo(() => {
    let globalLatest = '';
    for (const r of inventory.rows) {
      const date = String(r.recorded_at || '').slice(0, 10);
      if (date > globalLatest) globalLatest = date;
    }
    const map = new Map<string, Array<{ location: string; quantity: number }>>();
    for (const r of inventory.rows) {
      const sku = String(r.external_sku || '');
      if (!sku || String(r.recorded_at || '').slice(0, 10) !== globalLatest) continue;
      const arr = map.get(sku) ?? [];
      arr.push({ location: String(r.location || '未知'), quantity: Number(r.quantity ?? 0) });
      map.set(sku, arr);
    }
    return map;
  }, [inventory.rows]);

  const latestSnapshotDate = useMemo(() => {
    let d = '';
    for (const r of inventory.rows) {
      const date = String(r.recorded_at || '').slice(0, 10);
      if (date > d) d = date;
    }
    return d;
  }, [inventory.rows]);

  // Sales after the snapshot date — subtracted to keep stock current
  const postSnapshotSoldMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!latestSnapshotDate) return map;
    // Sales data is stored at month-end granularity, so compare by month only
    // to avoid deducting same-month sales that are already reflected in the snapshot
    const snapshotMonth = latestSnapshotDate.slice(0, 7);
    for (const r of sales.rows) {
      if (String(r.sold_at || '').slice(0, 7) <= snapshotMonth) continue;
      const sku = String(r.external_sku || '');
      if (sku) map.set(sku, (map.get(sku) ?? 0) + Number(r.quantity ?? 0));
    }
    return map;
  }, [sales.rows, latestSnapshotDate]);

  const currentBySku = useMemo(() =>
    latestBySku.map((inv) => ({
      ...inv,
      quantity: Math.max(0, inv.quantity - (postSnapshotSoldMap.get(inv.external_sku) ?? 0)),
    })),
    [latestBySku, postSnapshotSoldMap],
  );

  // Sold quantity per SKU for the selected month
  const soldMap = useMemo(() => {
    const start = `${selectedMonth}-01`;
    const end = monthEnd(selectedMonth);
    const map = new Map<string, number>();
    for (const r of sales.rows.filter((r) => r.sold_at >= start && r.sold_at <= end)) {
      const sku = String(r.external_sku || '');
      if (sku) map.set(sku, (map.get(sku) ?? 0) + Number(r.quantity ?? 0));
    }
    return map;
  }, [sales.rows, selectedMonth]);

  const chartData = useMemo(() => {
    const rows = currentBySku.map((inv) => {
      const sku = String(inv.external_sku || '');
      const stock = Number(inv.quantity ?? 0);
      const sold = soldMap.get(sku) ?? 0;
      const total = stock + sold;
      return { sku, name: String(inv.product_name || sku), stock, sold, total, rate: total ? sold / total * 100 : 0 };
    }).filter((d) => d.stock > 0 || d.sold > 0);
    return rows.sort((a, b) => b.rate - a.rate);
  }, [currentBySku, soldMap]);

  const skuToCategory = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products.rows) {
      const sku = String(p.sku || '').trim();
      if (sku) map.set(sku, String(p.category || '未分類'));
    }
    return map;
  }, [products.rows]);

  const maxTotal = useMemo(() => Math.max(...chartData.map((d) => d.total), 1), [chartData]);
  const snapshotTotal = useMemo(() => latestBySku.reduce((s, r) => s + Number(r.quantity ?? 0), 0), [latestBySku]);
  const totalDeducted = useMemo(() => [...postSnapshotSoldMap.values()].reduce((s, v) => s + v, 0), [postSnapshotSoldMap]);
  const deductedMonths = useMemo(() => [...new Set(sales.rows.filter((r) => String(r.sold_at || '').slice(0, 7) > latestSnapshotDate.slice(0, 7)).map((r) => String(r.sold_at || '').slice(0, 7)))].sort(), [sales.rows, latestSnapshotDate]);
  const totalStock = useMemo(() => currentBySku.reduce((s, r) => s + Number(r.quantity ?? 0), 0), [currentBySku]);
  const totalSold = useMemo(() => chartData.reduce((s, d) => s + d.sold, 0), [chartData]);
  const avgRate = useMemo(() => chartData.length ? chartData.reduce((s, d) => s + d.rate, 0) / chartData.length : 0, [chartData]);

  // 各 SKU 單位成本（從 sku_costs 表）— 必須在 categoryStats 之前宣告
  const skuCostMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of skuCosts.rows) {
      map.set(String(r.external_sku || ''), Number(r.unit_cost ?? 0));
    }
    return map;
  }, [skuCosts.rows]);

  const totalInventoryValue = useMemo(() =>
    currentBySku.reduce((s, r) => {
      const sku = String(r.external_sku || '');
      const cost = skuCostMap.get(sku) ?? 0;
      return s + Number(r.quantity ?? 0) * cost;
    }, 0),
    [currentBySku, skuCostMap],
  );

  const categoryStats = useMemo(() => {
    const allMonths = [...new Set(sales.rows.map((r) => String(r.sold_at || '').slice(0, 7)).filter(Boolean))].sort();
    const last3 = allMonths.slice(-3);
    // avg monthly sales per prefix (品項) over last 3 months
    const prefixAvgSales = new Map<string, number>();
    for (const r of sales.rows) {
      const prefix = String(r.external_sku || '').toUpperCase().slice(0, 5);
      const month = String(r.sold_at || '').slice(0, 7);
      if (!prefix || !last3.includes(month)) continue;
      prefixAvgSales.set(prefix, (prefixAvgSales.get(prefix) ?? 0) + Number(r.quantity ?? 0));
    }
    for (const [p, total] of prefixAvgSales) prefixAvgSales.set(p, last3.length ? total / last3.length : 0);

    // Aggregate by 5-char SKU prefix
    const catMap = new Map<string, { label: string; stock: number; value: number; monthlySales: number }>();
    for (const inv of currentBySku) {
      const sku = String(inv.external_sku || '');
      const prefix = sku.toUpperCase().slice(0, 5);
      const label = skuToLabel(sku);
      const qty = Number(inv.quantity ?? 0);
      const entry = catMap.get(prefix) ?? { label, stock: 0, value: 0, monthlySales: prefixAvgSales.get(prefix) ?? 0 };
      entry.stock += qty;
      entry.value += qty * (skuCostMap.get(sku) ?? 0);
      catMap.set(prefix, entry);
    }
    const total = [...catMap.values()].reduce((s, v) => s + v.stock, 0) || 1;
    return [...catMap.values()]
      .map((v) => ({
        category: v.label,
        stock: v.stock,
        value: v.value,
        monthlySales: Math.round(v.monthlySales),
        turnoverDays: v.monthlySales > 0 ? Math.round(v.stock / (v.monthlySales / 30)) : Infinity,
        pct: v.stock / total * 100,
      }))
      .filter((v) => v.stock > 0)
      .sort((a, b) => b.stock - a.stock);
  }, [currentBySku, skuCostMap, sales.rows]);

  const channelDist = useMemo(() => {
    const map = new Map<string, { channel: string; quantity: number; locations: Map<string, number> }>();
    for (const r of inventory.rows) {
      if (String(r.recorded_at || '').slice(0, 10) !== latestSnapshotDate) continue;
      const loc = String(r.location || '');
      const ch = classifyInventoryLocation(loc);
      const entry = map.get(ch) ?? { channel: ch, quantity: 0, locations: new Map() };
      entry.quantity += Number(r.quantity ?? 0);
      entry.locations.set(loc, (entry.locations.get(loc) ?? 0) + Number(r.quantity ?? 0));
      map.set(ch, entry);
    }
    const SHOWN = new Set(['總倉', '街邊店', '捷運門市', '網路／平台', '加盟門市']);
    return [...map.values()].filter((c) => SHOWN.has(c.channel)).sort((a, b) => b.quantity - a.quantity);
  }, [inventory.rows, latestSnapshotDate]);

  const channelDrilldown = useMemo(() => {
    if (!selectedChannel) return [];
    const ch = channelDist.find((c) => c.channel === selectedChannel);
    if (!ch) return [];
    return [...ch.locations.entries()].map(([loc, qty]) => ({ loc, qty })).sort((a, b) => b.qty - a.qty);
  }, [channelDist, selectedChannel]);

  const maxChannelQty = useMemo(() => Math.max(...channelDist.map((c) => c.quantity), 1), [channelDist]);
  const maxDrilldownQty = useMemo(() => Math.max(...channelDrilldown.map((c) => c.qty), 1), [channelDrilldown]);

  // Velocity & turnover days per SKU
  const skuVelocity = useMemo(() => {
    // Group sales quantity by SKU × month
    const bySkuMonth = new Map<string, Map<string, number>>();
    for (const r of sales.rows) {
      const sku = String(r.external_sku || '');
      const month = String(r.sold_at || '').slice(0, 7);
      if (!sku || !month) continue;
      const m = bySkuMonth.get(sku) ?? new Map<string, number>();
      m.set(month, (m.get(month) ?? 0) + Number(r.quantity ?? 0));
      bySkuMonth.set(sku, m);
    }
    const allMonths = [...new Set(sales.rows.map((r) => String(r.sold_at || '').slice(0, 7)).filter(Boolean))].sort();
    // Recent 2 months vs prior 3 months for spike detection; last 3 months for daily rate
    const recent2 = allMonths.slice(-2);
    const prior3 = allMonths.slice(-5, -2);
    const last3 = allMonths.slice(-3);
    const stockMap = new Map(currentBySku.map((inv) => [inv.external_sku, inv.quantity]));

    const result = new Map<string, { daysRemaining: number; spike: boolean; recentAvg: number; prevAvg: number }>();
    for (const [sku, monthMap] of bySkuMonth) {
      const recentTotal = recent2.reduce((s, m) => s + (monthMap.get(m) ?? 0), 0);
      const recentAvg = recent2.length ? recentTotal / recent2.length : 0;
      const prevTotal = prior3.reduce((s, m) => s + (monthMap.get(m) ?? 0), 0);
      const prevAvg = prior3.length ? prevTotal / prior3.length : 0;
      const last3Total = last3.reduce((s, m) => s + (monthMap.get(m) ?? 0), 0);
      const avgDaily = last3.length ? last3Total / last3.length / 30 : 0;
      const stock = stockMap.get(sku) ?? 0;
      const daysRemaining = avgDaily > 0 ? Math.round(stock / avgDaily) : Infinity;
      const spike = prevAvg > 0 && recentAvg > prevAvg * 1.5;
      result.set(sku, { daysRemaining, spike, recentAvg, prevAvg });
    }
    return result;
  }, [sales.rows, currentBySku]);

  // ── 門市庫存查詢 ──────────────────────────────────────────────────────────────

  // 下拉選單：所有有庫存的地點
  const allLocations = useMemo(() => {
    const locs = new Set<string>();
    for (const locs2 of skuLocations.values())
      for (const { location, quantity } of locs2)
        if (quantity > 0 && location) locs.add(location);
    return [...locs].sort((a, b) => a.localeCompare(b, 'zh-TW'));
  }, [skuLocations]);

  // 符合搜尋關鍵字的 SKU 集合
  const matchedSkusForStore = useMemo(() => {
    const kw = storeQuery.trim().toLowerCase();
    if (kw.length < 2) return new Set<string>();
    const matched = new Set<string>();
    for (const inv of currentBySku) {
      const sku  = String(inv.external_sku || '').toLowerCase();
      const name = String(inv.product_name || '').toLowerCase();
      if (sku.includes(kw) || name.includes(kw)) matched.add(String(inv.external_sku || ''));
    }
    return matched;
  }, [storeQuery, currentBySku]);

  // 各地點庫存彙總（依搜尋結果過濾）
  const storeInvResults = useMemo(() => {
    if (matchedSkusForStore.size === 0) return [];
    const locMap = new Map<string, number>();
    for (const [sku, locs] of skuLocations) {
      if (!matchedSkusForStore.has(sku)) continue;
      for (const { location, quantity } of locs) {
        if (storeFilter && location !== storeFilter) continue;
        locMap.set(location, (locMap.get(location) ?? 0) + quantity);
      }
    }
    const arr = [...locMap.entries()]
      .filter(([, q]) => q > 0)
      .map(([location, quantity]) => ({ location, quantity }))
      .sort((a, b) => b.quantity - a.quantity);
    return arr;
  }, [matchedSkusForStore, skuLocations, storeFilter]);

  const storeInvTotal = useMemo(() => storeInvResults.reduce((s, r) => s + r.quantity, 0), [storeInvResults]);
  const storeInvMax   = useMemo(() => storeInvResults[0]?.quantity ?? 0, [storeInvResults]);
  const storeInvMin   = useMemo(() => storeInvResults[storeInvResults.length - 1]?.quantity ?? 0, [storeInvResults]);

  // 近3個月銷售趨勢（點選門市後）
  const storeSalesTrend = useMemo(() => {
    if (!selectedTrendStore || matchedSkusForStore.size === 0) return [];
    const allMonths = [...new Set(
      productStoreSales.rows.map((r) => String(r.sales_month || '').slice(0, 7)).filter(Boolean)
    )].sort();
    const last3 = allMonths.slice(-3);
    return last3.map((month) => {
      let qty = 0, rev = 0;
      for (const r of productStoreSales.rows) {
        if (String(r.sales_month || '').slice(0, 7) !== month) continue;
        if (String(r.store_name || '') !== selectedTrendStore) continue;
        if (!matchedSkusForStore.has(String(r.external_sku || ''))) continue;
        qty += Number(r.quantity ?? 0);
        rev += Number(r.revenue ?? 0);
      }
      return { month, quantity: qty, revenue: rev };
    });
  }, [selectedTrendStore, matchedSkusForStore, productStoreSales.rows]);

  // 查詢結果：各 SKU 庫存量（依搜尋 + 門市篩選）
  const storeSkuDetail = useMemo(() => {
    if (matchedSkusForStore.size === 0) return [];
    const nameMap = new Map(currentBySku.map((r) => [String(r.external_sku), String(r.product_name || r.external_sku)]));
    const result: { sku: string; name: string; color: string; size: string; quantity: number }[] = [];
    for (const [sku, locs] of skuLocations) {
      if (!matchedSkusForStore.has(sku)) continue;
      let qty = 0;
      for (const { location, quantity } of locs) {
        if (storeFilter && location !== storeFilter) continue;
        qty += quantity;
      }
      if (qty > 0) {
        const name = nameMap.get(sku) || sku;
        const { color, size } = parseSkuColorSize(sku, name);
        // 品名：去除 SKU 前綴（若 product_name 以 SKU 開頭）
        const productName = name.startsWith(sku) ? name.slice(sku.length).trim() : name;
        result.push({ sku, name, productName, color, size, quantity: qty });
      }
    }
    return result.sort((a, b) => b.quantity - a.quantity);
  }, [matchedSkusForStore, skuLocations, storeFilter, currentBySku]);

  // 選定門市後：各 SKU 在該門市的庫存明細
  const storeInvDetail = useMemo(() => {
    if (!selectedTrendStore || matchedSkusForStore.size === 0) return [];
    const nameMap = new Map(currentBySku.map((r) => [String(r.external_sku), String(r.product_name || r.external_sku)]));
    const result: { sku: string; name: string; quantity: number }[] = [];
    for (const [sku, locs] of skuLocations) {
      if (!matchedSkusForStore.has(sku)) continue;
      for (const { location, quantity } of locs) {
        if (location === selectedTrendStore && quantity > 0) {
          result.push({ sku, name: nameMap.get(sku) || sku, quantity });
        }
      }
    }
    return result.sort((a, b) => b.quantity - a.quantity);
  }, [selectedTrendStore, matchedSkusForStore, skuLocations, currentBySku]);

  // ── end 門市庫存查詢 ──────────────────────────────────────────────────────────

  const reorderAlerts = useMemo(() => {
    return chartData
      .map((d) => ({ ...d, v: skuVelocity.get(d.sku) }))
      .filter(({ v }) => v && (v.daysRemaining < 60 || v.spike))
      .sort((a, b) => {
        const da = a.v!.daysRemaining === Infinity ? 9999 : a.v!.daysRemaining;
        const db = b.v!.daysRemaining === Infinity ? 9999 : b.v!.daysRemaining;
        return da - db;
      });
  }, [chartData, skuVelocity]);

  const trimSearch = search.trim();
  const filteredMerged = useMemo(() => {
    if (trimSearch.length < 2) return chartData;
    const keywords = trimSearch.split(/\s+/).filter((k) => k.length > 0);
    return chartData.filter((d) => keywords.some((k) => d.sku.includes(k) || d.name.includes(k)));
  }, [chartData, trimSearch]);
  const visibleMerged = showAll ? filteredMerged : filteredMerged.slice(0, 15);

  async function exportInventoryExcel() {
    const XLSX = await import(/* @vite-ignore */ 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
    const nameMap = new Map(currentBySku.map((r) => [String(r.external_sku), String(r.product_name || r.external_sku)]));

    const dataRows: unknown[][] = [['SKU', '品名', '顏色', '尺寸', '庫存量', '門市名稱']];

    if (storeFilter) {
      // 已選擇特定門市：直接用 storeSkuDetail
      for (const d of storeSkuDetail) {
        dataRows.push([d.sku, d.productName || '-', d.color, d.size, d.quantity, storeFilter]);
      }
    } else {
      // 全部門市：展開為每筆 SKU × 門市
      const expanded: unknown[][] = [];
      for (const [sku, locs] of skuLocations) {
        if (!matchedSkusForStore.has(sku)) continue;
        const name = nameMap.get(sku) || sku;
        const productName = name.startsWith(sku) ? name.slice(sku.length).trim() : name;
        const { color, size } = parseSkuColorSize(sku, name);
        for (const { location, quantity } of locs) {
          if (quantity <= 0) continue;
          expanded.push([sku, productName, color, size, quantity, location]);
        }
      }
      expanded.sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'zh-TW'));
      dataRows.push(...expanded);
    }

    const ws = XLSX.utils.aoa_to_sheet(dataRows);
    // 欄寬
    ws['!cols'] = [{ wch: 16 }, { wch: 24 }, { wch: 8 }, { wch: 6 }, { wch: 8 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '庫存明細');
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const storeName = storeFilter || '全部門市';
    XLSX.writeFile(wb, `庫存明細_${storeName}_${today}.xlsx`);
  }

  async function save(data: Row) {
    if (!supabase) return;
    const payload = {
      external_sku: data.external_sku,
      product_name: data.product_name,
      location: data.location || '總倉',
      quantity: Number(data.quantity ?? 0),
      recorded_at: data.recorded_at || new Date().toISOString().slice(0, 10),
      notes: data.notes || null,
    };
    const { error } = editing?.id
      ? await supabase.from('inventory_records').update(payload).eq('id', editing.id)
      : await supabase.from('inventory_records').insert(payload);
    if (error) { setMessage(`儲存失敗：${error.message}`); return; }
    setOpen(false); setEditing(null); setMessage(''); inventory.reload();
  }

  async function del(id: string) {
    if (!supabase || !confirm('確定刪除此庫存紀錄？')) return;
    await supabase.from('inventory_records').delete().eq('id', id);
    inventory.reload();
  }

  return (
    <Page title="庫存追蹤" subtitle="各商品庫存分佈與銷售率連動分析">
      {message && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">{message}</p>}

      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setShowAll(false); }}
        placeholder="搜尋商品名稱或貨號（輸入 2 字以上）"
        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-soft placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-leaf"
      />

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <p className="mb-3 text-sm font-medium text-slate-500">選擇銷量對比月份</p>
        <div className="flex flex-wrap gap-2">
          {monthShortcuts.map((m) => (
            <button key={m} type="button" onClick={() => chooseMonth(m)}
              className={`rounded-md border px-3 py-1.5 text-sm ${m === selectedMonth ? 'border-leaf bg-leaf text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {m.replace('-', '/')}
            </button>
          ))}
          <input type="month" value={selectedMonth} onChange={(e) => chooseMonth(e.target.value)} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600" />
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-4">
        <Card label={`目前庫存量${latestSnapshotDate ? `（${latestSnapshotDate} 快照後自動扣銷）` : ''}`} value={`${totalStock.toLocaleString('zh-TW')} 件`} compact />
        <Card label="庫存成本金額" value={formatCurrency(totalInventoryValue)} compact />
        <Card label={`${selectedMonth.replace('-', '/')} 銷量`} value={`${totalSold.toLocaleString('zh-TW')} 件`} compact />
        <Card label="平均銷售率" value={`${avgRate.toFixed(1)}%`} compact />
      </div>

      {categoryStats.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <h3 className="mb-1 font-semibold">分類庫存總覽</h3>
          <p className="mb-4 text-xs text-slate-400">月均銷量與週轉天數以近 3 個月平均計算；🔴 &gt;365天 橘色 180–365天 🟢 ≤180天</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400">
                  <th className="pb-2 text-left font-medium">分類</th>
                  <th className="pb-2 text-right font-medium">庫存量</th>
                  <th className="pb-2 text-right font-medium">庫存金額</th>
                  <th className="pb-2 text-right font-medium">月均銷量</th>
                  <th className="pb-2 text-right font-medium">週轉天數</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {categoryStats.map((c) => {
                  // >365 天 → 紅色（滯銷）；180–365 天 → 橘色（偏慢）；≤180 天 → 綠色（健康）
                  const turnRed = c.turnoverDays > 365;
                  const turnOrange = c.turnoverDays >= 180 && c.turnoverDays <= 365;
                  return (
                    <tr key={c.category} className="group hover:bg-slate-50">
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-700">{c.category}</span>
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                            <div style={{ width: `${c.pct}%` }} className="h-full bg-leaf/40 transition-all" />
                          </div>
                          <span className="text-xs text-slate-400">{c.pct.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-slate-700">{c.stock.toLocaleString('zh-TW')} 件</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-700">{c.value > 0 ? formatCurrency(c.value) : <span className="text-slate-300">—</span>}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-600">{c.monthlySales > 0 ? `${c.monthlySales.toLocaleString('zh-TW')} 件` : <span className="text-slate-300">—</span>}</td>
                      <td className="py-2.5 text-right">
                        {c.turnoverDays === Infinity
                          ? <span className="text-xs text-slate-300">無銷售</span>
                          : <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${turnRed ? 'bg-red-100 text-red-600' : turnOrange ? 'bg-orange-100 text-orange-600' : 'bg-emerald-50 text-emerald-600'}`}>
                              {c.turnoverDays} 天
                            </span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── 門市庫存查詢 ────────────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <h3 className="mb-4 font-semibold">門市庫存查詢</h3>

        {/* 查詢條件 */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={storeQuery}
            onChange={(e) => { setStoreQuery(e.target.value); setSelectedTrendStore(null); }}
            placeholder="輸入商品名稱或 SKU（2 字以上）"
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-soft placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-leaf"
          />
          <select
            value={storeFilter}
            onChange={(e) => { setStoreFilter(e.target.value); setSelectedTrendStore(null); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-soft focus:outline-none focus:ring-2 focus:ring-leaf"
          >
            <option value="">全部門市</option>
            {allLocations.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
          </select>
        </div>

        {storeQuery.trim().length < 2 ? (
          <p className="py-6 text-center text-sm text-slate-400">輸入關鍵字開始查詢門市庫存分佈</p>
        ) : storeInvResults.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">找不到符合「{storeQuery.trim()}」的庫存記錄</p>
        ) : (
          <>
            {/* 長條圖 */}
            <div className="mb-5">
              <ResponsiveContainer width="100%" height={Math.max(200, storeInvResults.length * 28)}>
                <BarChart
                  layout="vertical"
                  data={storeInvResults}
                  margin={{ top: 4, right: 48, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
                  <XAxis type="number" tick={CHART_TICK} tickFormatter={(v) => v.toLocaleString('zh-TW')} />
                  <YAxis type="category" dataKey="location" tick={CHART_TICK} width={80} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP}
                    formatter={(v: number) => [`${v.toLocaleString('zh-TW')} 件`, '庫存量']}
                  />
                  <Bar dataKey="quantity" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {storeInvResults.map((entry) => (
                      <Cell
                        key={entry.location}
                        fill={
                          entry.quantity === storeInvMax && storeInvMax !== storeInvMin
                            ? '#10b981'
                            : entry.quantity === storeInvMin && storeInvMax !== storeInvMin
                            ? '#ef4444'
                            : CHART_PRIMARY
                        }
                        cursor="pointer"
                        onClick={() => setSelectedTrendStore(selectedTrendStore === entry.location ? null : entry.location)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* SKU 庫存明細表 */}
            {storeSkuDetail.length > 0 && (
              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-500">
                    庫存明細（共 {storeSkuDetail.length} 個款式）
                  </p>
                  <button
                    type="button"
                    onClick={exportInventoryExcel}
                    className="inline-flex items-center gap-1.5 rounded-md border border-leaf px-3 py-1 text-xs font-medium text-leaf hover:bg-leaf hover:text-white transition-colors"
                  >
                    ↓ 匯出 Excel
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs text-slate-400">
                        <th className="pb-2 text-left font-medium">SKU</th>
                        <th className="pb-2 text-left font-medium">品名</th>
                        <th className="pb-2 text-left font-medium">顏色</th>
                        <th className="pb-2 text-left font-medium">尺寸</th>
                        <th className="pb-2 text-right font-medium">庫存量</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {storeSkuDetail.map((d) => (
                        <tr key={d.sku} className="hover:bg-slate-50">
                          <td className="py-2 pr-4 font-mono text-xs text-slate-500">{d.sku}</td>
                          <td className="py-2 pr-4 text-slate-700">{d.productName || '-'}</td>
                          <td className="py-2 pr-4 text-slate-600">{d.color}</td>
                          <td className="py-2 pr-4 text-slate-600">{d.size}</td>
                          <td className="py-2 text-right tabular-nums font-semibold text-slate-700">
                            {d.quantity.toLocaleString('zh-TW')} 件
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50">
                        <td colSpan={4} className="py-2 font-semibold text-slate-600">合計</td>
                        <td className="py-2 text-right tabular-nums font-bold text-slate-800">
                          {storeSkuDetail.reduce((s, d) => s + d.quantity, 0).toLocaleString('zh-TW')} 件
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* 各門市庫存分佈 */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-400">
                    <th className="pb-2 text-left font-medium">門市</th>
                    <th className="pb-2 text-right font-medium">庫存量</th>
                    <th className="pb-2 text-right font-medium">佔比</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {storeInvResults.map((r) => {
                    const isMax = r.quantity === storeInvMax && storeInvMax !== storeInvMin;
                    const isMin = r.quantity === storeInvMin && storeInvMax !== storeInvMin;
                    const pct   = storeInvTotal > 0 ? r.quantity / storeInvTotal * 100 : 0;
                    const isSelected = selectedTrendStore === r.location;
                    return (
                      <tr
                        key={r.location}
                        onClick={() => setSelectedTrendStore(isSelected ? null : r.location)}
                        className={`cursor-pointer transition-colors hover:bg-slate-50 ${isSelected ? 'bg-slate-50' : ''}`}
                      >
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            {isMax && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">最高</span>}
                            {isMin && <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-600">最低</span>}
                            <span className={`font-medium ${isMax ? 'text-emerald-700' : isMin ? 'text-red-600' : 'text-slate-700'}`}>
                              {r.location}
                            </span>
                            {isSelected && <span className="text-xs text-slate-400">▲ 查看銷售趨勢</span>}
                          </div>
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-slate-700 font-medium">
                          {r.quantity.toLocaleString('zh-TW')} 件
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-slate-500">
                          {pct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200">
                    <td className="py-2.5 pr-4 text-sm font-semibold text-slate-600">合計</td>
                    <td className="py-2.5 text-right tabular-nums font-semibold text-slate-700">
                      {storeInvTotal.toLocaleString('zh-TW')} 件
                    </td>
                    <td className="py-2.5 text-right text-sm text-slate-400">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 近3個月銷售趨勢（點選門市後展開）*/}
            {selectedTrendStore && (
              <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-leaf" />
                  <h4 className="text-sm font-semibold text-slate-700">
                    {selectedTrendStore}　近 3 個月銷售趨勢
                  </h4>
                  <button
                    type="button"
                    onClick={() => setSelectedTrendStore(null)}
                    className="ml-auto text-xs text-slate-400 hover:text-slate-600"
                  >
                    ✕ 收起
                  </button>
                </div>
                {/* 庫存明細 */}
                {storeInvDetail.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 text-xs font-medium text-slate-500">庫存明細</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400">
                            <th className="pb-1.5 text-left font-medium">SKU</th>
                            <th className="pb-1.5 text-left font-medium">商品名稱</th>
                            <th className="pb-1.5 text-right font-medium">庫存量</th>
                            <th className="pb-1.5 text-right font-medium">佔該門市%</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {storeInvDetail.map((d) => {
                            const detailTotal = storeInvDetail.reduce((s, r) => s + r.quantity, 0);
                            const pct = detailTotal > 0 ? d.quantity / detailTotal * 100 : 0;
                            return (
                              <tr key={d.sku} className="hover:bg-white/60">
                                <td className="py-1.5 pr-3 font-mono text-slate-400">{d.sku}</td>
                                <td className="py-1.5 pr-3 text-slate-600">{d.name}</td>
                                <td className="py-1.5 text-right font-semibold tabular-nums text-slate-700">{d.quantity.toLocaleString('zh-TW')} 件</td>
                                <td className="py-1.5 text-right tabular-nums text-slate-400">{pct.toFixed(1)}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-slate-200">
                            <td colSpan={2} className="py-1.5 font-semibold text-slate-600">合計</td>
                            <td className="py-1.5 text-right font-semibold tabular-nums text-slate-700">
                              {storeInvDetail.reduce((s, r) => s + r.quantity, 0).toLocaleString('zh-TW')} 件
                            </td>
                            <td className="py-1.5 text-right text-slate-400">100%</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* 近3個月銷售趨勢 */}
                <p className="mb-2 text-xs font-medium text-slate-500">近 3 個月銷售趨勢</p>
                {storeSalesTrend.every((d) => d.quantity === 0) ? (
                  <p className="py-4 text-center text-xs text-slate-400">此門市無對應銷售記錄</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={storeSalesTrend} margin={CHART_MARGIN}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                      <XAxis dataKey="month" tick={CHART_TICK_MD} />
                      <YAxis yAxisId="qty" tick={CHART_TICK} tickFormatter={(v) => `${v}件`} />
                      <YAxis yAxisId="rev" orientation="right" tick={CHART_TICK} tickFormatter={(v) => `$${(v / 10000).toFixed(0)}萬`} />
                      <Tooltip
                        contentStyle={CHART_TOOLTIP}
                        formatter={(value: number, name: string) =>
                          name === '銷售金額'
                            ? [formatCurrency(value), name]
                            : [`${value.toLocaleString('zh-TW')} 件`, name]
                        }
                      />
                      <Legend wrapperStyle={CHART_LEGEND} />
                      <Line yAxisId="qty" type="monotone" dataKey="quantity" name="銷售件數" stroke={CHART_PRIMARY} strokeWidth={CHART_STROKE_W} dot={{ r: 4, fill: CHART_PRIMARY }} activeDot={CHART_ACTIVE_DOT} connectNulls />
                      <Line yAxisId="rev" type="monotone" dataKey="revenue" name="銷售金額" stroke={CHART_SECONDARY} strokeWidth={CHART_STROKE_W} strokeDasharray="5 3" dot={{ r: 4, fill: CHART_SECONDARY }} activeDot={CHART_ACTIVE_DOT} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {channelDist.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="font-semibold">各通路庫存分佈</h3>
            {latestSnapshotDate && <span className="text-xs text-slate-400">快照日期：{latestSnapshotDate}</span>}
          </div>
          <p className="mb-4 text-xs text-slate-400">點擊通路列可展開各門市明細</p>
          <div className="space-y-2">
            {channelDist.map((c) => (
              <div key={c.channel}>
                <button type="button" onClick={() => setSelectedChannel(selectedChannel === c.channel ? null : c.channel)} className="w-full text-left">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{c.channel}</span>
                    <span className="text-slate-500">{c.quantity.toLocaleString('zh-TW')} 件 {selectedChannel === c.channel ? '▲' : '▼'}</span>
                  </div>
                  <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100">
                    <div style={{ width: `${c.quantity / maxChannelQty * 100}%` }} className="h-full bg-coral transition-all" />
                  </div>
                </button>
                {selectedChannel === c.channel && (
                  <div className="mt-3 space-y-1.5 border-l-2 border-coral pl-3">
                    {channelDrilldown.map((d) => (
                      <div key={d.loc}>
                        <div className="mb-0.5 flex items-center justify-between text-xs">
                          <span className="truncate text-slate-600">{d.loc}</span>
                          <span className="ml-2 shrink-0 text-slate-500">{d.qty.toLocaleString('zh-TW')} 件</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div style={{ width: `${d.qty / maxDrilldownQty * 100}%` }} className="h-full bg-sakura transition-all" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-semibold">庫存明細</h3>
        <button onClick={() => { setEditing(null); setOpen(true); }} className="inline-flex items-center gap-2 rounded-md bg-leaf px-4 py-2 text-sm text-white">
          <Plus className="h-4 w-4" />新增庫存
        </button>
      </div>

      {reorderAlerts.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h3 className="mb-3 font-semibold text-amber-800">補貨警示（{reorderAlerts.length} 個 SKU）</h3>
          <div className="space-y-2">
            {(showAllAlerts ? reorderAlerts : reorderAlerts.slice(0, 8)).map(({ sku, name, stock, v }) => {
              const days = v!.daysRemaining;
              const urgent = days < 30;
              const caution = days >= 30 && days < 60;
              return (
                <div key={sku} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-4 py-2.5 shadow-sm">
                  <div>
                    <span className="font-mono text-xs text-slate-400">{sku}</span>
                    <span className="ml-2 text-sm text-slate-700">{name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {v!.spike && (
                      <span className="rounded-full bg-leaf/10 px-2.5 py-0.5 font-medium text-leaf">
                        📈 銷量突增（近期 {v!.recentAvg.toFixed(0)} 件/月 vs 前期 {v!.prevAvg.toFixed(0)} 件/月）
                      </span>
                    )}
                    <span className={`rounded-full px-2.5 py-0.5 font-semibold ${urgent ? 'bg-red-100 text-red-600' : caution ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                      {days === Infinity ? '無銷售紀錄' : `剩約 ${days} 天庫存`}
                    </span>
                    <span className="text-slate-400">現貨 {stock.toLocaleString('zh-TW')} 件</span>
                  </div>
                </div>
              );
            })}
          </div>
          {reorderAlerts.length > 8 && (
            <button type="button" onClick={() => setShowAllAlerts(!showAllAlerts)}
              className="mt-3 w-full rounded-md border border-amber-300 py-2 text-xs text-amber-700 hover:bg-amber-100">
              {showAllAlerts ? '收起' : `展開全部（共 ${reorderAlerts.length} 個 SKU）`}
            </button>
          )}
        </section>
      )}

      {open && (
        <DataForm
          title={editing ? '編輯庫存紀錄' : '新增庫存紀錄'}
          row={editing}
          onSave={save}
          onCancel={() => { setOpen(false); setEditing(null); }}
          fields={[
            ['external_sku', 'SKU', 'required'],
            ['product_name', '商品名稱', 'required'],
            ['location', '位置（倉庫／門市）'],
            ['quantity', '數量', 'number'],
            ['recorded_at', '盤點日期', 'date'],
            ['notes', '備註', 'textarea'],
          ]}
        />
      )}

      {trimSearch.length >= 2 && filteredMerged.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
          <p className="text-xs text-slate-400 mb-1">「{trimSearch}」查詢結果 — 共 {filteredMerged.length} 個 SKU</p>
          <div className="flex gap-6">
            <div>
              <p className="text-xs text-slate-500">目前庫存合計</p>
              <p className="text-2xl font-bold text-ink">{filteredMerged.reduce((s, d) => s + d.stock, 0).toLocaleString('zh-TW')} <span className="text-sm font-normal text-slate-400">件</span></p>
            </div>
            <div>
              <p className="text-xs text-slate-500">本月銷量合計</p>
              <p className="text-2xl font-bold text-leaf">{filteredMerged.reduce((s, d) => s + d.sold, 0).toLocaleString('zh-TW')} <span className="text-sm font-normal text-slate-400">件</span></p>
            </div>
          </div>
        </div>
      )}

      {filteredMerged.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-sm text-slate-400">
          {trimSearch.length >= 2 ? `找不到符合「${trimSearch}」的商品` : '尚無庫存資料，請新增庫存紀錄'}
        </div>
      ) : (
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
          <div className="flex items-center gap-4 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-leaf" />本月銷量</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-sun" />剩餘庫存</span>
            <span className="ml-auto text-slate-400">點商品名稱展開位置明細</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="p-3 text-left font-medium">SKU / 商品名稱</th>
                <th className="p-3 text-right font-medium">目前庫存</th>
                <th className="p-3 text-right font-medium">本月銷量</th>
                <th className="p-3 text-right font-medium">銷售率</th>
                <th className="w-32 p-3 font-medium">分佈</th>
              </tr>
            </thead>
            <tbody>
              {visibleMerged.map((d) => (
                <Fragment key={d.sku}>
                  <tr className="border-t hover:bg-slate-50">
                    <td className="p-3">
                      <button type="button" onClick={() => setExpandedSku(expandedSku === d.sku ? null : d.sku)} className="text-left">
                        <p className="font-mono text-xs text-slate-400">{d.sku}</p>
                        <p className="text-sm text-leaf hover:underline">
                          {d.name}
                          {skuVelocity.get(d.sku)?.spike && <span className="ml-1 text-xs text-leaf">📈</span>}
                          <span className="text-slate-300 text-xs"> {expandedSku === d.sku ? '▲' : '▼'}</span>
                        </p>
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <p className="text-sm font-semibold">{d.stock.toLocaleString('zh-TW')}</p>
                      {(() => { const v = skuVelocity.get(d.sku); if (!v || v.daysRemaining === Infinity) return null; const urgent = v.daysRemaining < 30; const caution = v.daysRemaining < 60; return <p className={`text-xs mt-0.5 ${urgent ? 'text-red-500 font-semibold' : caution ? 'text-amber-500' : 'text-slate-400'}`}>≈ {v.daysRemaining} 天</p>; })()}
                    </td>
                    <td className="p-3 text-right text-sm text-slate-500">{d.sold.toLocaleString('zh-TW')}</td>
                    <td className="p-3 text-right text-sm">
                      <span className={`font-semibold ${d.rate >= 50 ? 'text-leaf' : 'text-slate-500'}`}>{d.rate.toFixed(1)}%</span>
                    </td>
                    <td className="p-3">
                      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                        <div style={{ width: `${d.sold / maxTotal * 100}%` }} className="bg-leaf transition-all" />
                        <div style={{ width: `${d.stock / maxTotal * 100}%` }} className="bg-sun transition-all" />
                      </div>
                    </td>
                  </tr>
                  {expandedSku === d.sku && (
                    <tr>
                      <td colSpan={5} className="bg-slate-50 px-6 pb-4 pt-2">
                        <p className="mb-2 text-xs font-medium text-slate-400">各位置庫存（快照 {latestSnapshotDate}）</p>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-slate-400">
                              <th className="pb-1 text-left font-normal">位置</th>
                              <th className="pb-1 text-right font-normal">快照數量</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(skuLocations.get(d.sku) ?? []).sort((a, b) => b.quantity - a.quantity).map((loc) => (
                              <tr key={loc.location} className="border-t border-slate-100">
                                <td className="py-1.5 pr-4 text-slate-600">{loc.location}</td>
                                <td className="py-1.5 text-right font-medium text-slate-700">{loc.quantity.toLocaleString('zh-TW')}</td>
                              </tr>
                            ))}
                            {(() => {
                              const locs = skuLocations.get(d.sku) ?? [];
                              const snapshotTotal = locs.reduce((s, l) => s + l.quantity, 0);
                              const postSales = snapshotTotal - d.stock;
                              return (
                                <>
                                  <tr className="border-t border-slate-200 bg-slate-100">
                                    <td className="py-1.5 pr-4 font-semibold text-slate-700">快照合計</td>
                                    <td className="py-1.5 text-right font-semibold text-slate-700">{snapshotTotal.toLocaleString('zh-TW')}</td>
                                  </tr>
                                  {postSales > 0 && (
                                    <tr className="border-t border-slate-100">
                                      <td className="py-1.5 pr-4 text-slate-400">扣除盤後銷售</td>
                                      <td className="py-1.5 text-right text-coral">－{postSales.toLocaleString('zh-TW')}</td>
                                    </tr>
                                  )}
                                  <tr className="border-t border-slate-200 bg-amber-50">
                                    <td className="py-1.5 pr-4 font-semibold text-slate-800">目前估算庫存</td>
                                    <td className="py-1.5 text-right font-bold text-slate-800">{d.stock.toLocaleString('zh-TW')}</td>
                                  </tr>
                                </>
                              );
                            })()}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {filteredMerged.length > 15 && (
            <div className="border-t p-3">
              <button type="button" onClick={() => setShowAll(!showAll)}
                className="w-full rounded-md border border-slate-200 py-2 text-sm text-slate-500 hover:bg-slate-50">
                {showAll ? '收起' : `展開全部（共 ${filteredMerged.length} 個 SKU）`}
              </button>
            </div>
          )}
        </section>
      )}
    </Page>
  );
}

function parseInventoryExcel(data: unknown[][]): Row[] {
  if (data.length === 0) return [];

  // ── 格式自動偵測 ──────────────────────────────────────────────────────────
  // 格式 A（平面表格）：header = ['商品型號', '品名規格', '庫點', '單價', '折扣', '庫存', ...]
  //   → col[0]=SKU, col[1]=商品名, col[2]=庫點, col[5]=庫存量
  // 格式 B（層級格式）：header = ['商品', '庫存', ...]
  //   → SKU 行後接各庫點明細行
  const header = (data[0] as unknown[]).map((c) => String(c ?? '').trim());
  const isTabular = header[0] === '商品型號' && header[2] === '庫點';

  if (isTabular) {
    // ── 格式 A：每行 = 一筆 (SKU, 庫點, 數量) ────────────────────────────
    const records: Row[] = [];
    for (const row of data.slice(1)) {
      const sku  = String(row[0] ?? '').trim().toUpperCase();
      const name = String(row[1] ?? '').trim();
      const loc  = String(row[2] ?? '').trim();
      const qty  = Number(row[5] ?? 0);
      if (!sku || sku === '商品型號' || !isFinite(qty) || qty === 0) continue;
      records.push({ external_sku: sku, product_name: `${sku} ${name}`.trim(), location: loc, quantity: qty });
    }
    return records;
  }

  // ── 格式 B：舊式層級格式（SKU 標頭 + 各庫點明細行）─────────────────────
  const records: Row[] = [];
  let currentSku = '';
  let currentName = '';
  let currentSkuQty = 0;
  let locRows: Row[] = [];

  function flush() {
    if (!currentSku) return;
    records.push(...(locRows.length > 0
      ? locRows
      : [{ external_sku: currentSku, product_name: `${currentSku} ${currentName}`, location: '', quantity: currentSkuQty }]
    ));
    locRows = [];
  }

  for (const row of data) {
    const label  = String(row[0] ?? '').trim();
    const rawQty = row[1];
    // Guard: only accept numeric values; text (e.g. product name in wrong column) → skip
    const qty = typeof rawQty === 'number' && isFinite(rawQty) ? rawQty : 0;
    if (!label || label === '商品') continue;
    const firstWord = label.split(/\s+/)[0] ?? '';
    if (/^[A-Za-z]{2,}\d/.test(firstWord)) {
      flush();
      currentSku  = firstWord.toUpperCase();
      currentName = label.slice(firstWord.length).trim();
      // Only use numeric qty for SKU header total; text values mean wrong format
      currentSkuQty = typeof rawQty === 'number' && isFinite(rawQty) ? rawQty : 0;
    } else if (currentSku && qty !== 0 && /^\d{4,6}$|^[A-Z]\d{3}|^0ZZZZ/.test(firstWord)) {
      locRows.push({ external_sku: currentSku, product_name: `${currentSku} ${currentName}`, location: label, quantity: qty });
    }
  }
  flush();
  return records.filter((r) => isFinite(Number(r.quantity)) && r.quantity !== null);
}

function ImportPage() {
  // ── 業績 state ──
  const [salesMsg, setSalesMsg] = useState('');
  const [salesRows, setSalesRows] = useState<Row[]>([]);
  const [channelRows, setChannelRows] = useState<Row[]>([]);
  const [storeRows, setStoreRows] = useState<Row[]>([]);
  const [productStoreRows, setProductStoreRows] = useState<Row[]>([]);
  const [salesFile, setSalesFile] = useState('');
  const [importMonth, setImportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [salesImporting, setSalesImporting] = useState(false);
  const totalRevenue = salesRows.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
  const totalQty = salesRows.reduce((s, r) => s + Number(r.quantity ?? 0), 0);

  // ── 庫存 state ──
  const [invMsg, setInvMsg] = useState('');
  const [invRows, setInvRows] = useState<Row[]>([]);
  const [invFile, setInvFile] = useState('');
  const [recordDate, setRecordDate] = useState(new Date().toISOString().slice(0, 10));
  const [invImporting, setInvImporting] = useState(false);

  async function previewSales(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get('file');
    const month = String(form.get('month'));
    if (!(file instanceof File)) return;
    setImportMonth(month);
    const XLSX = await import(/* @vite-ignore */ 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const parsed = parseSalesImport(workbook, XLSX.utils, month);
    setSalesRows(parsed.salesRows); setChannelRows(parsed.channelRows);
    setStoreRows(parsed.storeRows); setProductStoreRows(parsed.productStoreRows);
    setSalesFile(file.name);
    if (!parsed.salesRows.length) { setSalesMsg('沒有解析到資料，請確認格式。'); return; }

    // ── 冪等性預檢：查詢 DB 是否已有相同日期資料 ──
    let baseMsg = `已解析 ${parsed.salesRows.length} 筆商品業績、${parsed.storeRows.length} 筆門市業績，請確認後匯入。`;
    if (supabase) {
      const dates = [...new Set(parsed.salesRows.map((r) => String(r.sold_at || '')).filter(Boolean))];
      const checks = await Promise.all(
        dates.map((d) => supabase!.from('sales_records').select('id', { count: 'exact', head: true }).eq('sold_at', d))
      );
      const existing = dates.map((d, i) => ({ date: d, count: checks[i].count ?? 0 })).filter((x) => x.count > 0);
      if (existing.length > 0) {
        const warn = existing.map((x) => `${x.date}（${x.count} 筆）`).join('、');
        baseMsg += ` ⚠ 資料庫已有相同日期：${warn}，匯入將自動覆蓋，不會重複計算。`;
      }
    }
    setSalesMsg(baseMsg);
  }

  async function doSalesImport() {
    if (!supabase || salesRows.length === 0) return;
    setSalesImporting(true);
    const soldDates = [...new Set(salesRows.map((r) => String(r.sold_at || '')).filter(Boolean))];

    // ── 防線 1：逐一刪除並檢查 error，任一失敗立即中止 ──
    const TABLES_TO_DELETE = [
      { table: 'sales_records',              col: 'sold_at'     },
      { table: 'channel_sales_records',       col: 'sales_month' },
      { table: 'channel_store_sales_records', col: 'sales_month' },
      { table: 'product_store_sales',         col: 'sales_month' },
    ] as const;
    for (const date of soldDates) {
      for (const { table, col } of TABLES_TO_DELETE) {
        const { error: delErr } = await supabase.from(table).delete().eq(col, date);
        if (delErr) {
          setSalesMsg(`❌ 刪除失敗（${table} / ${date}）：${delErr.message}。匯入已中止，資料未變動。`);
          setSalesImporting(false);
          return;
        }
      }
    }

    // ── 插入 ──
    const { error } = await supabase.from('sales_records').insert(salesRows);
    if (error) { setSalesMsg(`❌ 匯入失敗：${error.message}`); setSalesImporting(false); return; }
    if (channelRows.length) await supabase.from('channel_sales_records').insert(channelRows);
    if (storeRows.length) await supabase.from('channel_store_sales_records').insert(storeRows);
    if (productStoreRows.length) await supabase.from('product_store_sales').insert(productStoreRows);

    // ── 防線 2：驗證 DB 計數與預期一致 ──
    const { count: dbCount } = await supabase
      .from('sales_records').select('id', { count: 'exact', head: true }).in('sold_at', soldDates);
    const dateLabel = soldDates.join('、') || importMonth;
    if (dbCount !== salesRows.length) {
      setSalesMsg(`⚠ 匯入完成但數量異常：預期 ${salesRows.length} 筆，資料庫實際 ${dbCount} 筆（${dateLabel}）。請聯絡管理員確認。`);
    } else {
      setSalesMsg(`✓ 已匯入並驗證 ${dateLabel} 業績（${dbCount} 筆），數量正確。`);
    }
    setSalesRows([]); setChannelRows([]); setStoreRows([]); setProductStoreRows([]);
    setSalesImporting(false);
  }

  async function previewInv(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get('file');
    const date = String(form.get('date'));
    if (!(file instanceof File)) return;
    setRecordDate(date);
    setInvMsg('解析中...');
    const XLSX = await import(/* @vite-ignore */ 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
    const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
    // 優先找含「各倉」或「庫存」的 sheet（例如「0531各倉庫存」），
    // 若沒有則用第一個 sheet（舊格式工作表1 等）
    const invSheetName: string =
      workbook.SheetNames.find((n: string) => /各倉|庫存/.test(n)) ??
      workbook.SheetNames[0];
    const sheet = workbook.Sheets[invSheetName];
    const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const rows = parseInventoryExcel(data);
    setInvRows(rows); setInvFile(file.name);
    const sheetNote = invSheetName !== workbook.SheetNames[0] ? `（sheet：${invSheetName}）` : '';
    setInvMsg(rows.length
      ? `已解析 ${rows.length} 筆（${new Set(rows.map((r) => r.external_sku)).size} 個 SKU）${sheetNote}，請確認後匯入。`
      : `未解析到資料${sheetNote}，請確認格式。`);
  }

  async function doInvImport() {
    if (!supabase || invRows.length === 0) return;
    setInvImporting(true);
    const skus = [...new Set(invRows.map((r) => String(r.external_sku || '')).filter(Boolean))];

    // ── 冪等性預檢：若同日已有資料則提示 ──
    const { count: existingCount } = await supabase
      .from('inventory_records').select('id', { count: 'exact', head: true }).eq('recorded_at', recordDate);
    if ((existingCount ?? 0) > 0) {
      setInvMsg(`ℹ️ ${recordDate} 已有 ${existingCount} 筆庫存記錄，將覆蓋同日同貨號資料...`);
    }

    // ── 防線 1：逐批刪除，檢查 error ──
    for (let i = 0; i < skus.length; i += 100) {
      const chunk = skus.slice(i, i + 100);
      const { error: delErr } = await supabase
        .from('inventory_records').delete().eq('recorded_at', recordDate).in('external_sku', chunk);
      if (delErr) { setInvMsg(`❌ 刪除失敗：${delErr.message}。匯入已中止。`); setInvImporting(false); return; }
    }

    // ── 插入 ──
    const rowsWithDate = invRows.map((r) => ({ ...r, recorded_at: recordDate }));
    for (let i = 0; i < rowsWithDate.length; i += 500) {
      const { error } = await supabase.from('inventory_records').insert(rowsWithDate.slice(i, i + 500));
      if (error) { setInvMsg(`❌ 匯入失敗：${error.message}`); setInvImporting(false); return; }
    }

    // ── 防線 2：驗證計數 ──
    const { count: dbCount } = await supabase
      .from('inventory_records').select('id', { count: 'exact', head: true }).eq('recorded_at', recordDate);
    if ((dbCount ?? 0) < invRows.length) {
      setInvMsg(`⚠ 匯入完成但數量異常：預期 ${invRows.length} 筆，資料庫實際 ${dbCount} 筆。`);
    } else {
      setInvMsg(`✓ 已匯入並驗證 ${recordDate} 共 ${invRows.length} 筆（${skus.length} 個 SKU），數量正確。`);
    }
    setInvRows([]);
    setInvImporting(false);
  }

  return (
    <Page title="資料匯入" subtitle="業績與庫存資料匯入，同期舊資料自動覆蓋">
      {/* ── 業績匯入 ── */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <h3 className="mb-4 font-semibold">業績匯入</h3>
        <form onSubmit={previewSales}>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm">匯入月份<input name="month" type="month" defaultValue={importMonth} className="mt-1 w-full rounded-md border px-3 py-2" /></label>
            <label className="text-sm md:col-span-2">Excel 檔案<input name="file" type="file" accept=".xlsx,.xls,.csv" className="mt-1 w-full rounded-md border px-3 py-2" required /></label>
          </div>
          <button className="mt-4 rounded-md bg-leaf px-4 py-2 text-sm text-white">預覽業績資料</button>
          {salesMsg && <p className="mt-3 text-sm text-slate-600">{salesMsg}</p>}
        </form>
        {salesRows.length > 0 && (
          <div className="mt-4 rounded-lg border border-slate-100 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">{salesFile}｜{salesRows.length.toLocaleString('zh-TW')} 筆｜{totalQty.toLocaleString('zh-TW')} 件｜{formatCurrency(totalRevenue)}</p>
                <p className="mt-1 text-xs text-amber-600">⚠ 確認後將覆蓋相同週期舊資料，其他週資料保留</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setSalesRows([])} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm">取消</button>
                <button type="button" onClick={doSalesImport} disabled={salesImporting} className="rounded-md bg-leaf px-3 py-1.5 text-sm text-white disabled:opacity-50">{salesImporting ? '匯入中...' : '確認匯入'}</button>
              </div>
            </div>
            <Table columns={['日期', 'SKU', '商品', '通路', '數量', '金額']}>
              {salesRows.slice(0, 20).map((row, i) => (
                <tr key={i} className="border-t">
                  <td className="p-3">{formatFullDate(row.sold_at)}</td>
                  <td className="p-3">{row.external_sku}</td>
                  <td className="p-3">{row.external_product_name}</td>
                  <td className="p-3">{row.channel}</td>
                  <td className="p-3">{Number(row.quantity ?? 0).toLocaleString('zh-TW')}</td>
                  <td className="p-3">{formatCurrency(row.revenue)}</td>
                </tr>
              ))}
            </Table>
            {salesRows.length > 20 && <p className="mt-2 text-xs text-slate-400">只顯示前 20 筆</p>}
          </div>
        )}
      </section>

      {/* ── 庫存匯入 ── */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <h3 className="mb-4 font-semibold">庫存匯入</h3>
        <form onSubmit={previewInv}>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm">盤點日期<input name="date" type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" required /></label>
            <label className="text-sm md:col-span-2">Excel 檔案（新事業銷售庫存統計格式）<input name="file" type="file" accept=".xlsx,.xls" className="mt-1 w-full rounded-md border px-3 py-2" required /></label>
          </div>
          <button className="mt-4 rounded-md bg-leaf px-4 py-2 text-sm text-white">預覽庫存資料</button>
          {invMsg && <p className="mt-3 text-sm text-slate-600">{invMsg}</p>}
        </form>
        {invRows.length > 0 && (
          <div className="mt-4 rounded-lg border border-slate-100 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">{invFile}｜盤點日期 {recordDate}｜{new Set(invRows.map((r) => r.external_sku)).size} 個 SKU｜{invRows.length.toLocaleString('zh-TW')} 筆</p>
                <p className="mt-1 text-xs text-amber-600">⚠ 同日期同貨號的舊資料將覆蓋，其他日期與其他貨號不受影響</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setInvRows([])} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm">取消</button>
                <button type="button" onClick={doInvImport} disabled={invImporting} className="rounded-md bg-leaf px-3 py-1.5 text-sm text-white disabled:opacity-50">{invImporting ? '匯入中...' : '確認匯入'}</button>
              </div>
            </div>
            <div className="mt-3 max-h-56 overflow-y-auto rounded-md border border-slate-100">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50"><tr><th className="p-2 text-left">SKU</th><th className="p-2 text-left">位置</th><th className="p-2 text-right">數量</th></tr></thead>
                <tbody>
                  {invRows.slice(0, 100).map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="p-2 font-mono text-slate-400">{r.external_sku}</td>
                      <td className="p-2 text-slate-600">{r.location}</td>
                      <td className="p-2 text-right">{Number(r.quantity).toLocaleString('zh-TW')}</td>
                    </tr>
                  ))}
                  {invRows.length > 100 && <tr><td colSpan={3} className="p-2 text-center text-slate-400">...僅顯示前 100 筆</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </Page>
  );
}

function Page({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <div className="space-y-6"><div><h2 className="text-2xl font-semibold text-ink">{title}</h2><p className="mt-1 text-slate-500">{subtitle}</p></div>{children}</div>;
}

function Toolbar({ onAdd, label }: { onAdd: () => void; label: string }) {
  return <div className="mb-4 flex justify-end"><button onClick={onAdd} className="inline-flex items-center gap-2 rounded-md bg-leaf px-4 py-2 text-sm text-white"><Plus className="h-4 w-4" />{label}</button></div>;
}

function Notice({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'error' }) {
  return <div className={`rounded-md border px-4 py-3 text-sm ${tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-600'}`}>{children}</div>;
}

function TopLinks({ links }: { links: Array<[string, string]> }) {
  return <div className="flex flex-wrap gap-2">{links.map(([to, label]) => <Link key={to} to={to} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">{label}</Link>)}</div>;
}

function ActionButtons({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <div className="flex gap-2"><button onClick={onEdit} className="rounded-md border border-slate-200 p-2 text-slate-600" title="重新編輯"><Pencil className="h-4 w-4" /></button><button onClick={onDelete} className="rounded-md border border-slate-200 p-2 text-coral" title="刪除"><Trash2 className="h-4 w-4" /></button></div>;
}

function Card({ label, value, helper, compact, tone = 'ink' }: { label: string; value: string; helper?: string; compact?: boolean; tone?: 'ink' | 'coral' }) {
  return <section className={`rounded-lg border border-slate-200 bg-white ${compact ? 'p-4' : 'p-5'} shadow-soft`}><p className="text-sm text-slate-500">{label}</p><p className={`${compact ? 'text-lg' : 'text-2xl'} mt-1 font-semibold ${tone === 'coral' ? 'text-coral' : 'text-ink'}`}>{value}</p>{helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}</section>;
}

function Table({ columns, children }: { columns: string[]; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft"><div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{columns.map((c) => <th className="p-3 font-medium" key={c}>{c}</th>)}</tr></thead><tbody>{children}</tbody></table></div></section>;
}

function LoadingRow() {
  return <tr><td className="p-4 text-slate-500">載入中...</td></tr>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm">{label}<input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" /></label>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm font-medium text-ink">{value}</p></div>;
}

function LatestProgress({ product, progress }: { product: Row; progress: Row[] }) {
  const latest = progress.sort((a, b) => String(b.started_at || b.created_at).localeCompare(String(a.started_at || a.created_at)))[0];
  if (!latest) return <span className="text-slate-400">{product.current_stage || '尚無進度'}</span>;
  return (
    <div className="max-w-sm">
      <p className="font-medium text-slate-700">{latest.stage}</p>
      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-slate-500">{latest.content || latest.title}</p>
      <p className="mt-1 text-xs text-slate-400">{latest.started_at || latest.created_at?.slice(0, 10)}</p>
    </div>
  );
}

function mergeProgressRows(productId: string | undefined, progressRows: Row[], eventRows: Row[]) {
  if (!productId) return [];
  const progress = progressRows
    .filter((row) => row.product_id === productId)
    .map((row) => ({ ...row, _source: 'development_progress', content: row.content, expected_completed_at: row.expected_completed_at }));
  const events = eventRows
    .filter((row) => row.product_id === productId)
    .map((row) => ({ ...row, _source: 'development_events', content: row.note, expected_completed_at: row.due_date }));
  return [...events, ...progress];
}

function StatusSummary({ rows }: { rows: Array<{ label: string; products: Row[] }> }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <h3 className="mb-4 font-semibold">商品狀態統計</h3>
      <div className="grid gap-3 lg:grid-cols-3">
        {rows.length === 0 && <p className="text-sm text-slate-500">尚無資料</p>}
        {rows.map((row) => (
          <div key={row.label} className="rounded-md border border-slate-100 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-slate-500">{row.label}</p>
              <p className="text-xl font-semibold text-ink">{row.products.length}<span className="ml-1 text-xs font-normal text-slate-400">件</span></p>
            </div>
            <div className="mt-3 space-y-2">
              {row.products.map((product) => (
                <Link key={product.id} to={`/products/${product.id}`} className="block rounded-md bg-slate-50 px-3 py-2 text-sm text-leaf hover:bg-slate-100">
                  <span className="font-medium">{product.name}</span>
                  {product.sku && <span className="ml-2 text-xs text-slate-400">{product.sku}</span>}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SalesRecordsTable({ records }: { records: Row[] }) {
  const [showAll, setShowAll] = useState(false);
  // Aggregate by SKU across all weeks in the range
  const aggregated = useMemo(() => {
    const map = new Map<string, { label: string; quantity: number; revenue: number }>();
    for (const r of records) {
      const key = String(r.external_sku || r.external_product_name || '');
      if (!key) continue;
      const existing = map.get(key) ?? { label: salesProductLabel(r), quantity: 0, revenue: 0 };
      existing.quantity += Number(r.quantity ?? 0);
      existing.revenue += Number(r.revenue ?? 0);
      map.set(key, existing);
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [records]);
  const visible = showAll ? aggregated : aggregated.slice(0, 10);
  return (
    <div className="mt-6">
      <p className="mb-2 text-sm font-medium text-slate-600">銷售明細（區間加總，共 {aggregated.length} 個品項）</p>
      <Table columns={['商品', '數量', '業績金額', '佔比']}>
        {visible.map((r, i) => {
          const totalRev = aggregated.reduce((s, x) => s + x.revenue, 0);
          return (
            <tr key={i} className="border-t">
              <td className="p-3">{r.label}</td>
              <td className="p-3">{r.quantity > 0 ? r.quantity.toLocaleString('zh-TW') : '-'}</td>
              <td className="p-3 font-semibold">{formatCurrency(r.revenue)}</td>
              <td className="p-3 text-slate-500">{totalRev ? (r.revenue / totalRev * 100).toFixed(1) : '0.0'}%</td>
            </tr>
          );
        })}
      </Table>
      {aggregated.length > 10 && (
        <button type="button" onClick={() => setShowAll(!showAll)}
          className="mt-2 w-full rounded-md border border-slate-200 py-2 text-sm text-slate-500 hover:bg-slate-50">
          {showAll ? '收起' : `展開全部（共 ${aggregated.length} 個品項）`}
        </button>
      )}
    </div>
  );
}

function Summary({ title, rows, valueLabel }: { title: string; rows: Array<{ label: string; quantity: number; revenue: number; rank?: number }>; valueLabel?: string }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft"><h3 className="mb-4 font-semibold">{title}</h3><div className="space-y-3">{rows.length === 0 && <p className="text-sm text-slate-500">尚無資料</p>}{rows.map((r) => <div key={r.label} className="grid grid-cols-[1fr_auto] gap-3 rounded-md border border-slate-100 p-3 text-sm"><div className="flex gap-3">{r.rank && <span className={`min-w-8 text-2xl font-bold ${r.rank <= 3 ? 'text-coral' : 'text-slate-400'}`}>{r.rank}</span>}<div><p className="font-medium">{r.label}</p><p className="mt-1 text-slate-500">{r.quantity.toLocaleString('zh-TW')} 件</p></div></div><p className="font-semibold text-leaf">{valueLabel ? `${r.revenue} ${valueLabel}` : formatCurrency(r.revenue)}</p></div>)}</div></section>;
}

function ChannelSummary({ rows }: { rows: Array<{ label: string; quantity: number; revenue: number }> }) {
  const colors = ['#fd5e4b', '#fecf00', '#fd8391', '#fddf98', '#fedbdf'];
  const total = sum(rows, 'revenue');
  let cursor = 0;
  const gradient = rows.map((r, i) => { const start = cursor; cursor += total ? r.revenue / total * 100 : 0; return `${colors[i % colors.length]} ${start}% ${cursor}%`; }).join(', ') || '#e2e8f0 0 100%';
  return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft"><h3 className="mb-4 font-semibold">通路業績</h3><div className="space-y-3">{rows.map((r, i) => <div key={r.label} className="grid grid-cols-[1fr_auto] gap-3 rounded-md border p-3 text-sm"><p><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />{r.label}<span className="ml-2 text-slate-500">{total ? (r.revenue / total * 100).toFixed(1) : 0}%</span></p><p className="font-semibold text-leaf">{formatCurrency(r.revenue)}</p></div>)}<div className="grid gap-5 border-t pt-5 md:grid-cols-[260px_1fr] md:items-center"><div className="mx-auto grid h-60 w-60 place-items-center rounded-full" style={{ background: `conic-gradient(${gradient})` }}><div className="grid h-28 w-28 place-items-center rounded-full bg-white shadow-sm"><p className="text-center text-sm font-semibold">{formatCurrency(total)}</p></div></div><div>{rows.map((r, i) => <p key={r.label} className="mb-2 text-sm"><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />{r.label}</p>)}</div></div></div></section>;
}

function statusText(value: string) {
  return statusOptions.find(([v]) => v === value)?.[1] ?? value ?? '-';
}

function groupProductsByStatus(products: Row[]) {
  const groups = products.reduce((acc, product) => {
    const label = statusText(product.status);
    acc[label] ??= { label, products: [] as Row[] };
    acc[label].products.push(product);
    return acc;
  }, {} as Record<string, { label: string; products: Row[] }>);
  return Object.values(groups).sort((a, b) => b.products.length - a.products.length);
}

function readRecentMonths() {
  try {
    const parsed = JSON.parse(localStorage.getItem('salesRecentMonths') || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string').slice(0, 6) : [];
  } catch {
    return [];
  }
}

function clean(row: Row) {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}

function dedupeByName(rows: Row[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const name = String(row.name || '').trim();
    if (!name || seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

function costTotal(row: Row) {
  return Number(row.amount ?? 0) * Number(row.exchange_rate_to_twd || 1) + Number(row.bank_fee_twd ?? 0);
}

function dueDateStatus(dateStr: string | null | undefined): 'overdue' | 'soon' | 'ok' | 'none' {
  if (!dateStr) return 'none';
  const today = new Date().toISOString().slice(0, 10);
  if (dateStr < today) return 'overdue';
  const sevenDaysLater = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  if (dateStr <= sevenDaysLater) return 'soon';
  return 'ok';
}

function costTypeLabel(type: string) {
  const map: Record<string, string> = {
    deposit: '訂金', final_payment: '尾款', shipping_fee: '運費',
    duty_fee: '關稅', sample_fee: '打樣費', mold_fee: '模具費',
    design_fee: '設計費', bank_fee: '手續費', other: '其他',
  };
  return map[type] ?? type;
}

function sum(rows: Row[], key: string) {
  return rows.reduce((s, r) => s + Number(r[key] ?? 0), 0);
}

function sumSales(rows: Row[], start: string, end: string) {
  return sum(rows.filter((r) => r.sold_at >= start && r.sold_at <= end), 'revenue');
}

function monthsInRange(start: string, end: string) {
  const out: string[] = [];
  const d = new Date(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, 1);
  const e = new Date(Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1, 1);
  while (d <= e) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

function shiftMonth(date: string, offset: number) {
  const [y, m, d] = date.split('-').map(Number);
  const n = new Date(y, m - 1 + offset, 1);
  const last = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

function shiftYear(date: string, offset: number) {
  const [y, m, d] = date.split('-').map(Number);
  const last = new Date(y + offset, m, 0).getDate();
  return `${y + offset}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

function growth(current: number, previous: number, signed = true) {
  const rate = previous ? ((current - previous) / Math.abs(previous)) * 100 : current ? 100 : 0;
  return `${signed && rate > 0 ? '+' : ''}${rate.toFixed(1)}%`;
}

function group(rows: Row[], getLabel: (row: Row) => string) {
  return Object.values(rows.reduce((acc, row) => {
    const label = getLabel(row) || '未分類';
    acc[label] ??= { label, quantity: 0, revenue: 0 };
    acc[label].quantity += Number(row.quantity ?? 1);
    acc[label].revenue += Number(row.revenue ?? 0);
    return acc;
  }, {} as Record<string, { label: string; quantity: number; revenue: number }>));
}

function rank(rows: Array<{ label: string; quantity: number; revenue: number }>) {
  return rows.sort((a, b) => b.revenue - a.revenue).map((r, i) => ({ ...r, rank: i + 1 }));
}

function channelData(channelRows: Row[], salesRows: Row[], months: string[]) {
  const rows = group(channelRows.filter((r) => months.includes(String(r.sales_month).slice(0, 7))), (r) => r.channel_category);
  return rows.length ? rank(rows) : rank(group(salesRows, (r) => r.channel || '未指定'));
}

function salesProductLabel(row: Row) {
  const name = String(row.external_product_name || row.product_name || row.name || '').trim();
  const sku = String(row.external_sku || row.sku || '').trim();
  const label = name || sku || '未建檔商品';
  if (name && sku && !name.includes(sku)) return `${sku} ${name}`;
  return label;
}

function parseNumber(value: unknown) {
  const n = Number(String(value ?? '').replace(/,/g, '').replace(/%/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function parseSalesImport(workbook: any, utils: any, fallbackMonth: string) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as unknown[][];
  const headerIndex = rows.findIndex((r) => r.some((c) => String(c).trim() === '商品') && r.some((c) => String(c).trim() === '實售總金額'));
  const headers = headerIndex >= 0 ? rows[headerIndex].map((c) => String(c).trim()) : [];
  if (headers.includes('銷售總成本') && headers.some((h) => h.includes('毛利'))) {
    return parseDepartmentSales(rows, fallbackMonth, headerIndex);
  }
  return { salesRows: parseSales(workbook, utils, fallbackMonth), channelRows: [], storeRows: [], productStoreRows: [] };
}

const STORE_HEADER_RE = /^(A\d{3}|E\d{3}|000\d{3})\s+/;
const SKU_PREFIX_RE   = /^[A-Za-z]{2}\d/;

function parseDepartmentSales(rows: unknown[][], fallbackMonth: string, headerIndex = -1) {
  const periodText = headerIndex === 0 ? '' : String(rows[0]?.[1] || '');
  const soldAt  = periodEndDate(periodText) || monthEnd(fallbackMonth);
  const dataStart = headerIndex >= 0 ? headerIndex + 1 : 3;

  // 格式自動偵測：第一筆非空列是否為 store header
  const isStoreFirst = (() => {
    for (const row of rows.slice(dataStart)) {
      const label = String(row[0] || '').trim();
      if (!label) continue;
      return STORE_HEADER_RE.test(label);
    }
    return false;
  })();

  return isStoreFirst
    ? _parseStoreFirst(rows.slice(dataStart), soldAt)
    : _parseProductFirst(rows.slice(dataStart), soldAt, headerIndex === 0);
}

/** 新格式（通路優先）：A### store section → 商品分類行（跳過）→ SKU 行 */
function _parseStoreFirst(dataRows: unknown[][], soldAt: string) {
  let currentStore: { channel: string; storeName: string } | null = null;
  const skuTotals   = new Map<string, { name: string; quantity: number; revenue: number }>();
  const storeTotals = new Map<string, Row>();
  const productStoreRows: Row[] = [];

  for (const row of dataRows) {
    const label = String(row[0] || '').trim();
    if (!label || label === '總計') continue;
    const quantity = parseNumber(row[1]);
    const revenue  = parseNumber(row[2]);

    // store header → 新 section 開始
    if (STORE_HEADER_RE.test(label)) {
      const channel   = classifyStore(label);
      const storeName = label.replace(/^\S+\s*/, '').trim();
      currentStore = { channel, storeName };
      continue;
    }
    if (!currentStore) continue;

    // 商品分類行 / 子通路行（跳過）
    const firstToken = label.split(/\s+/)[0] || '';
    if (!SKU_PREFIX_RE.test(firstToken)) continue;
    if (!quantity && !revenue) continue;

    // 個別 SKU 行
    const sku  = firstToken.toUpperCase();
    const name = (sku + ' ' + label.split(/\s+/).slice(1).join(' ')).trim();
    const { channel, storeName } = currentStore;

    // 跨門市 SKU 彙總 → sales_records
    const prev = skuTotals.get(sku) ?? { name, quantity: 0, revenue: 0 };
    prev.quantity += quantity;
    prev.revenue  += revenue;
    skuTotals.set(sku, prev);

    // 門市彙總 → channel_store_sales_records
    const storeKey = `${channel}::${storeName}`;
    const storeRow = storeTotals.get(storeKey) ?? { sales_month: soldAt, channel_category: channel, store_name: storeName, quantity: 0, revenue: 0 };
    storeRow.quantity += quantity;
    storeRow.revenue  += revenue;
    storeTotals.set(storeKey, storeRow);

    // SKU × 門市明細 → product_store_sales
    productStoreRows.push({ sales_month: soldAt, external_sku: sku, external_product_name: name, channel_category: channel, store_name: storeName, quantity, revenue });
  }

  const salesRows: Row[] = [...skuTotals.entries()]
    .filter(([, v]) => v.quantity || v.revenue)
    .map(([sku, v]) => ({ product_id: null, external_sku: sku, external_product_name: v.name, sold_at: soldAt, quantity: v.quantity, revenue: v.revenue, channel: '全通路', notes: '各部門業績明細匯入' }));

  // product_store_rows 去重合併：同一 SKU × 門市在 Excel 出現多次時加總
  const psAgg = new Map<string, Row>();
  for (const r of productStoreRows) {
    const k = `${r.external_sku}::${r.channel_category}::${r.store_name}`;
    const e = psAgg.get(k);
    if (!e) { psAgg.set(k, { ...r }); }
    else { e.quantity = Number(e.quantity ?? 0) + Number(r.quantity ?? 0); e.revenue = Number(e.revenue ?? 0) + Number(r.revenue ?? 0); }
  }
  const dedupedProductStoreRows = [...psAgg.values()];

  const storeRows = [...storeTotals.values()];
  const channelRows = Object.values(storeRows.reduce((acc, row) => {
    const key = String(row.channel_category);
    acc[key] ??= { sales_month: soldAt, channel_category: key, quantity: 0, revenue: 0 };
    acc[key].quantity += Number(row.quantity ?? 0);
    acc[key].revenue  += Number(row.revenue  ?? 0);
    return acc;
  }, {} as Record<string, Row>));

  return { salesRows, channelRows, storeRows, productStoreRows: dedupedProductStoreRows };
}

/** 舊格式（商品優先）：SKU 行在外層，門市 sub-row（A### / E### / 000###）在底下 */
function _parseProductFirst(dataRows: unknown[][], soldAt: string, hasCategoryRows: boolean) {
  const salesRows: Row[] = [];
  const storeTotals = new Map<string, Row>();
  let currentProduct: Row | null = null;
  const accumulatingProducts = new Set<Row>();
  const productStoreRows: Row[] = [];

  for (const row of dataRows) {
    const label = String(row[0] || '').trim();
    if (!label || label === '總計') continue;
    const quantity = parseNumber(row[1]);
    const revenue  = parseNumber(row[2]);

    if (STORE_HEADER_RE.test(label)) {
      if (!currentProduct || (!quantity && !revenue)) continue;
      const channel   = classifyStore(label);
      const storeName = label.replace(/^\S+\s*/, '');
      const key = `${channel}::${storeName}`;
      const existing = storeTotals.get(key) || { sales_month: soldAt, channel_category: channel, store_name: storeName, quantity: 0, revenue: 0 };
      existing.quantity += quantity;
      existing.revenue  += revenue;
      storeTotals.set(key, existing);
      productStoreRows.push({ sales_month: soldAt, external_sku: String(currentProduct.external_sku || ''), external_product_name: String(currentProduct.external_product_name || ''), channel_category: channel, store_name: storeName, quantity, revenue });
      if (accumulatingProducts.has(currentProduct)) { currentProduct.quantity += quantity; currentProduct.revenue += revenue; }
      continue;
    }
    if (hasCategoryRows && !SKU_PREFIX_RE.test(label.split(/\s+/)[0] || '')) continue;
    if (!hasCategoryRows && !quantity && !revenue) continue;

    const skuParts = label.split(/\s+/);
    const sku = (skuParts[0] || '').toUpperCase();
    const productName = (sku + ' ' + skuParts.slice(1).join(' ')).trim();
    currentProduct = { product_id: null, external_sku: sku, external_product_name: productName, sold_at: soldAt, quantity, revenue, channel: '全通路', notes: '各部門業績明細匯入' };
    if (!quantity && !revenue) accumulatingProducts.add(currentProduct);
    salesRows.push(currentProduct);
  }

  const storeRows = [...storeTotals.values()];
  const channelRows = Object.values(storeRows.reduce((acc, row) => {
    const key = String(row.channel_category);
    acc[key] ??= { sales_month: soldAt, channel_category: key, quantity: 0, revenue: 0 };
    acc[key].quantity += Number(row.quantity ?? 0);
    acc[key].revenue  += Number(row.revenue  ?? 0);
    return acc;
  }, {} as Record<string, Row>));

  return { salesRows: salesRows.filter((r) => r.quantity || r.revenue), channelRows, storeRows, productStoreRows };
}

function isStoreName(label: string) {
  return /^(A\d{3}|E\d{3}|000\d{3})\s+/.test(label.trim());
}

function classifyStore(label: string) {
  if (/^000|^E\d{3}|網路|平台|MOMO|大紅哥|團購|暫存倉/.test(label)) return '網路官網／平台';
  if (/捷運|M6/.test(label)) return '捷運門市';
  if (/高雄|台南|台中|新竹|宜蘭/.test(label)) return '加盟門市';
  return '街邊店';
}

function periodEndDate(text: string) {
  const match = text.replace(/\D/g, '').match(/^(\d{4})(\d{2})(\d{2})(\d{4})?(\d{2})(\d{2})$/);
  if (!match) return '';
  const year = match[4] ? match[4] : match[1];
  return `${year}-${match[5]}-${match[6]}`;
}

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
