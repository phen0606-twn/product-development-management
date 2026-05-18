import { Component, Fragment, FormEvent, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { BarChart3, Boxes, DollarSign, LayoutDashboard, Package, Pencil, Plus, TrendingUp, Trash2, Upload, Users } from 'lucide-react';
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
  ['cancelled', '取消'],
] as const;

const stageOptions = ['提案', '報價中', '打樣', '修改', '確認樣', '下單', '大貨中', '生產', '驗貨', '出貨', '上架'];
const costTypes = ['打樣費', '模具費', '運費', '關稅', '設計費', '訂金', '尾款', '手續費', '其他'];

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
      <aside className="border-r border-slate-200 bg-white p-5">
        <h1 className="text-lg font-semibold text-ink">商品開發管理</h1>
        <p className="mt-1 text-xs text-slate-500">防曬 / 天氣商品開發系統</p>
        <nav className="mt-6 space-y-1">
          {nav.filter(([to, , , adminOnly]) => !(isViewer && adminOnly)).map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm ${isActive ? 'bg-leaf text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        {email && (
          <div className="mt-8">
            {isViewer && <span className="mb-2 block rounded-md bg-slate-100 px-2 py-1 text-center text-xs text-slate-500">檢視者</span>}
            <button onClick={() => supabase?.auth.signOut()} className="text-left text-xs text-slate-500">登出<br />{email}</button>
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
      <Toolbar onAdd={() => { setEditing(null); setOpen(true); }} label="新增商品" />
      {message && <Notice tone="error">{message}</Notice>}
      {products.error && <Notice tone="error">商品資料讀取失敗：{products.error}</Notice>}
      {(progress.error || events.error) && <Notice tone="error">進度資料讀取失敗：{progress.error || events.error}</Notice>}
      {open && <ProductForm row={editing} vendors={vendors.rows} onCancel={() => setOpen(false)} onSave={save} />}
      <Table columns={['SKU', '商品名稱', '分類', '狀態', '最近進度', '廠商', '操作']}>
        {products.loading ? <LoadingRow /> : products.rows.map((row) => (
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
  const productCosts = costs.rows.filter((c) => c.product_id === id);
  const productBatches = batches.rows
    .filter((b) => b.product_id === id)
    .sort((a, b) => String(a.ordered_at || '').localeCompare(String(b.ordered_at || '')));
  const costsByBatch = productCosts.reduce<Record<string, Row[]>>((acc, c) => {
    const key = c.batch_id ?? '__none__';
    acc[key] = acc[key] ?? [];
    acc[key].push(c);
    return acc;
  }, {});
  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

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
          <Link to="/costs" className="text-sm text-leaf hover:underline">前往費用管理 →</Link>
        </div>
        {(batches.loading || costs.loading) && <p className="text-sm text-slate-400">載入中...</p>}
        {!batches.loading && !costs.loading && (
          <div className="space-y-4">
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
            {(costsByBatch['__none__'] ?? []).length > 0 && (
              <div className="overflow-hidden rounded-lg border border-dashed border-slate-300 bg-white">
                <div className="border-b border-slate-100 px-5 py-3">
                  <p className="font-medium text-slate-500">未分配批次的費用</p>
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
            {productBatches.length === 0 && (costsByBatch['__none__'] ?? []).length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
                尚無批次或費用紀錄。請至「費用管理」頁面新增費用並指定批次。
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

  async function save(data: Row) {
    const payload = clean({
      product_id: data.product_id || null,
      batch_id: data.batch_id || null,
      type: data.type,
      custom_type: data.type === '其他' ? data.custom_type : null,
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
    if (editing?.id) await supabase?.from('development_costs').update(payload).eq('id', editing.id);
    else await supabase?.from('development_costs').insert(payload);
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
      {open && <CostForm row={editing} products={products.rows} batches={batches.rows} onCancel={() => setOpen(false)} onSave={save} />}
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
  return <DataForm title={row ? '重新編輯費用' : '新增費用'} row={row} onSave={onSave} onCancel={onCancel} fields={[
    ['product_id', '商品', 'select', products.map((p) => [p.id, `${p.sku || ''} ${p.name}`])],
    ['batch_id', '採購批次', 'select', batches.map((b) => [b.id, b.name || b.batch_no])],
    ['type', '費用類型', 'select', costTypes.map((t) => [t, t])],
    ['custom_type', '其他類型'], ['description', '說明'], ['currency', '幣別', 'select', [['TWD', '台幣'], ['USD', '美金'], ['CNY', '人民幣']]],
    ['amount', '金額', 'number'], ['exchange_rate_to_twd', '匯率', 'number'], ['bank_fee_twd', '手續費台幣', 'number'],
    ['paid_amount', '已付款金額', 'number'], ['paid_at', '付款日', 'date'], ['due_date', '到期日', 'date'], ['notes', '備註', 'textarea'],
  ]} />;
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
              <input required={type === 'required'} type={type === 'date' || type === 'number' ? type : 'text'} step="0.0001" value={data[key] ?? ''} onChange={(e) => setData({ ...data, [key]: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2" />
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
  const channelSales = useRows('channel_sales_records');
  const stores = useRows('channel_store_sales_records');
  const [start, setStart] = useState(`${new Date().toISOString().slice(0, 7)}-01`);
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
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
  const productRows = rank(group(records, salesProductLabel)).slice(0, 10);
  const channelRows = channelData(channelSales.rows, records, months);
  const street = rank(group(stores.rows.filter((r) => r.channel_category === '街邊店' && months.includes(String(r.sales_month).slice(0, 7))), (r) => r.store_name)).slice(0, 5);
  const mrt = rank(group(stores.rows.filter((r) => r.channel_category === '捷運門市' && months.includes(String(r.sales_month).slice(0, 7))), (r) => r.store_name)).slice(0, 5);
  return (
    <Page title="業績追蹤" subtitle="依日期區間查看業績、目標、MOM、YOY 與排行">
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
      <div className="mb-6 space-y-3">
        <div className="grid gap-3 md:grid-cols-3"><Card label="區間業績" value={formatCurrency(revenue)} compact /><Card label="區間銷售數量" value={qty.toLocaleString('zh-TW')} compact /><Card label="平均單價" value={formatCurrency(qty ? revenue / qty : 0)} compact /></div>
        <div className="grid gap-3 md:grid-cols-5"><Card label="月目標" value={formatCurrency(target)} compact /><Card label="月達成率" value={`${(target ? revenue / target * 100 : 0).toFixed(1)}%`} compact /><Card label="年度目標" value={formatCurrency(annualTarget)} compact /><Card label="年度業績" value={formatCurrency(annualSales)} compact /><Card label="年度達成率" value={growth(annualSales, annualTarget, false)} compact /></div>
        <div className="grid gap-3 md:grid-cols-2"><Card label="MOM" value={growth(revenue, prevMonth)} helper={`前月 ${formatCurrency(prevMonth)}`} compact /><Card label="YOY" value={growth(revenue, prevYear)} helper={`去年同期 ${formatCurrency(prevYear)}`} compact /></div>
      </div>
      <section className="grid gap-6 xl:grid-cols-2"><Summary title="商品業績排行" rows={productRows} /><ChannelSummary rows={channelRows} /></section>
      <section className="mt-6 grid gap-6 xl:grid-cols-2"><Summary title="街邊店前五名" rows={street} /><Summary title="捷運門市前五名" rows={mrt} /></section>
      <SalesRecordsTable records={records} />
    </Page>
  );
}

const CHANNELS = ['網路官網／平台', '街邊店', '捷運門市'] as const;

function ChannelAnalysisPage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedSku, setSelectedSku] = useState('');
  const [monthRows, setMonthRows] = useState<Row[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [recentMonths, setRecentMonths] = useState<string[]>(() => readRecentMonths());
  const [loading, setLoading] = useState(false);
  const [productKeyword, setProductKeyword] = useState('');
  const [productStoreRows, setProductStoreRows] = useState<Row[] | null>(null);
  const [productSearching, setProductSearching] = useState(false);

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

  const [debugMsg, setDebugMsg] = useState('');
  // Fetch data for the selected month directly — avoids the global 3000-row cap
  useEffect(() => {
    if (!supabase) return;
    setLoading(true);
    setSelectedSku('');
    supabase.from('product_store_sales').select('*').gte('sales_month', `${selectedMonth}-01`).lte('sales_month', monthEnd(selectedMonth)).limit(5000)
      .then(({ data, error }) => {
        setMonthRows(data ?? []);
        setDebugMsg(error ? `錯誤：${error.message}` : `查詢到 ${data?.length ?? 0} 筆（${selectedMonth}-01 ～ ${monthEnd(selectedMonth)}）`);
        setLoading(false);
      });
  }, [selectedMonth]);

  const topByChannel = useMemo(
    () => CHANNELS.map((ch) => ({
      channel: ch,
      products: rank(group(monthRows.filter((r) => r.channel_category === ch), (r) => String(r.external_product_name || r.external_sku || '未知'))).slice(0, 3),
    })),
    [monthRows],
  );

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

  async function searchProductStores() {
    if (!supabase || productKeyword.trim().length < 2) return;
    setProductSearching(true);
    setProductStoreRows(null);
    const kw = productKeyword.trim();
    const { data } = await supabase
      .from('product_store_sales')
      .select('channel_category,store_name,quantity,revenue')
      .ilike('external_product_name', `%${kw}%`)
      .limit(10000);
    setProductStoreRows(data ?? []);
    setProductSearching(false);
  }

  const productStoreRanking = useMemo(() => {
    if (!productStoreRows) return [];
    return rank(group(productStoreRows, (r) => `[${r.channel_category}] ${r.store_name}`));
  }, [productStoreRows]);

  return (
    <Page title="通路分析" subtitle="各通路商品銷售前三名、各商品最佳門市排行">
      <TopLinks links={[['/sales', '返回業績追蹤']]} />
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
      {debugMsg && <p className="text-xs text-slate-400 -mt-2">{debugMsg}　通路分布：{[...new Set(monthRows.map(r => String(r.channel_category)))].map(ch => `${ch}(${monthRows.filter(r => r.channel_category === ch).length})`).join('、') || '（無）'}</p>}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <h3 className="mb-1 font-semibold">商品跨規格門市查詢</h3>
        <p className="mb-4 text-xs text-slate-400">輸入商品名稱關鍵字，自動彙總所有符合的 SKU（不分尺寸／顏色），顯示各門市歷史累計銷售排行</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={productKeyword}
            onChange={(e) => setProductKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchProductStores()}
            placeholder="例：防曬帽、涼感上衣..."
            className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-leaf"
          />
          <button
            type="button"
            onClick={searchProductStores}
            disabled={productKeyword.trim().length < 2 || productSearching}
            className="rounded-md bg-leaf px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {productSearching ? '查詢中...' : '查詢'}
          </button>
        </div>

        {productStoreRows !== null && (
          <div className="mt-4">
            {productStoreRanking.length === 0
              ? <p className="text-sm text-slate-400">找不到符合「{productKeyword}」的銷售記錄</p>
              : <>
                  <p className="mb-3 text-xs text-slate-400">共找到 {productStoreRanking.length} 間門市的銷售資料（歷史累計）</p>
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

      <section>
        <h3 className="mb-3 font-semibold">各通路商品前三名</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {topByChannel.map(({ channel, products }) => (
            <div key={channel} className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
              <p className="mb-3 font-semibold text-leaf">{channel}</p>
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
        <h3 className="mb-4 font-semibold">各商品門市銷售排行</h3>
        <label className="block text-sm">選擇商品 SKU
          <select value={selectedSku} onChange={(e) => setSelectedSku(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2">
            <option value="">-- 請選擇商品 --</option>
            {skuOptions.map(([sku, name]) => <option key={sku} value={sku}>{sku}　{name}</option>)}
          </select>
        </label>
        {selectedSku && (
          <div className="mt-4 space-y-2">
            {topStores.length === 0
              ? <p className="text-sm text-slate-400">此商品無門市資料</p>
              : topStores.map((s) => (
                <div key={s.label} className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-3 rounded-md border border-slate-100 p-3 text-sm">
                  <span className={`text-xl font-bold ${s.rank <= 3 ? 'text-coral' : 'text-slate-300'}`}>{s.rank}</span>
                  <p className="break-words">{s.label}</p>
                  <p className="text-slate-500">{s.quantity.toLocaleString('zh-TW')} 件</p>
                  <p className="font-semibold text-leaf">{formatCurrency(s.revenue)}</p>
                </div>
              ))}
          </div>
        )}
      </section>
    </Page>
  );
}

function classifyInventoryLocation(loc: string): string {
  if (/^000002\s/.test(loc)) return '退貨倉';
  if (/^000025\s/.test(loc)) return '報廢倉';
  if (/^000/.test(loc)) return '總倉';
  if (/^0ZZZZ/.test(loc)) return '在途';
  if (/^E\d{3}/.test(loc)) return '網路／平台';
  if (/捷運|M6/.test(loc)) return '捷運門市';
  return '街邊店';
}

function InventoryPage() {
  const inventory = useRows('inventory_records', 'recorded_at');
  const sales = useRows('sales_records', 'sold_at');
  const products = useRows('products', 'created_at');
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

  // Latest snapshot date per SKU, then sum all locations for that date
  const latestBySku = useMemo(() => {
    const latestDate = new Map<string, string>();
    for (const r of inventory.rows) {
      const sku = String(r.external_sku || '');
      const date = String(r.recorded_at || '').slice(0, 10);
      if (sku && (!latestDate.has(sku) || date > latestDate.get(sku)!)) latestDate.set(sku, date);
    }
    const totals = new Map<string, { external_sku: string; product_name: string; quantity: number; recorded_at: string }>();
    for (const r of inventory.rows) {
      const sku = String(r.external_sku || '');
      const date = String(r.recorded_at || '').slice(0, 10);
      if (!sku || date !== latestDate.get(sku)) continue;
      const entry = totals.get(sku) ?? { external_sku: sku, product_name: String(r.product_name || sku), quantity: 0, recorded_at: date };
      entry.quantity += Number(r.quantity ?? 0);
      totals.set(sku, entry);
    }
    return [...totals.values()];
  }, [inventory.rows]);

  // Per-location breakdown for each SKU (latest snapshot date only)
  const skuLocations = useMemo(() => {
    const latestDate = new Map<string, string>();
    for (const r of inventory.rows) {
      const sku = String(r.external_sku || '');
      const date = String(r.recorded_at || '').slice(0, 10);
      if (sku && (!latestDate.has(sku) || date > latestDate.get(sku)!)) latestDate.set(sku, date);
    }
    const map = new Map<string, Array<{ location: string; quantity: number }>>();
    for (const r of inventory.rows) {
      const sku = String(r.external_sku || '');
      if (!sku || String(r.recorded_at || '').slice(0, 10) !== latestDate.get(sku)) continue;
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

  const categoryDist = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of currentBySku) {
      const sku = String(inv.external_sku || '');
      const cat = skuToCategory.get(sku) || '未分類';
      map.set(cat, (map.get(cat) ?? 0) + Number(inv.quantity ?? 0));
    }
    const total = [...map.values()].reduce((s, v) => s + v, 0) || 1;
    return [...map.entries()]
      .map(([category, quantity]) => ({ category, quantity, pct: quantity / total * 100 }))
      .sort((a, b) => b.quantity - a.quantity);
  }, [currentBySku, skuToCategory]);

  const maxTotal = useMemo(() => Math.max(...chartData.map((d) => d.total), 1), [chartData]);
  const snapshotTotal = useMemo(() => latestBySku.reduce((s, r) => s + Number(r.quantity ?? 0), 0), [latestBySku]);
  const totalDeducted = useMemo(() => [...postSnapshotSoldMap.values()].reduce((s, v) => s + v, 0), [postSnapshotSoldMap]);
  const deductedMonths = useMemo(() => [...new Set(sales.rows.filter((r) => String(r.sold_at || '').slice(0, 7) > latestSnapshotDate.slice(0, 7)).map((r) => String(r.sold_at || '').slice(0, 7)))].sort(), [sales.rows, latestSnapshotDate]);
  const totalStock = useMemo(() => currentBySku.reduce((s, r) => s + Number(r.quantity ?? 0), 0), [currentBySku]);
  const totalSold = useMemo(() => chartData.reduce((s, d) => s + d.sold, 0), [chartData]);
  const avgRate = useMemo(() => chartData.length ? chartData.reduce((s, d) => s + d.rate, 0) / chartData.length : 0, [chartData]);

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
    const SHOWN = new Set(['總倉', '街邊店', '捷運門市', '網路／平台']);
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
    return chartData.filter((d) => d.sku.includes(trimSearch) || d.name.includes(trimSearch));
  }, [chartData, trimSearch]);
  const visibleMerged = showAll ? filteredMerged : filteredMerged.slice(0, 15);

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

      <div className="grid gap-3 md:grid-cols-3">
        <Card label={`目前庫存量${latestSnapshotDate ? `（${latestSnapshotDate} 快照後自動扣銷）` : ''}`} value={`${totalStock.toLocaleString('zh-TW')} 件`} compact />
        <Card label={`${selectedMonth.replace('-', '/')} 銷量`} value={`${totalSold.toLocaleString('zh-TW')} 件`} compact />
        <Card label="平均銷售率" value={`${avgRate.toFixed(1)}%`} compact />
      </div>

      {categoryDist.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <h3 className="mb-4 font-semibold">分類庫存佔比</h3>
          <div className="space-y-2.5">
            {categoryDist.map((c) => (
              <div key={c.category}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{c.category}</span>
                  <span className="text-slate-500">共 {c.quantity.toLocaleString('zh-TW')} 件／佔比 <span className="font-semibold text-leaf">{c.pct.toFixed(1)}%</span></span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div style={{ width: `${c.pct}%` }} className="h-full bg-cream transition-all" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
  const records: Row[] = [];
  let currentSku = '';
  let currentName = '';
  let currentSkuQty = 0;
  let locRows: Row[] = [];

  function flush() {
    if (!currentSku) return;
    // Use per-location rows when available; fall back to SKU header total
    records.push(...(locRows.length > 0 ? locRows : [{ external_sku: currentSku, product_name: `${currentSku} ${currentName}`, location: '', quantity: currentSkuQty }]));
    locRows = [];
  }

  for (const row of data) {
    const label = String(row[0] ?? '').trim();
    const qty = Number(row[1] ?? 0);
    if (!label || label === '商品') continue;
    const firstWord = label.split(/\s+/)[0] ?? '';
    if (/^[A-Z]{2,}\d/.test(firstWord)) {
      flush();
      currentSku = firstWord;
      currentName = label.slice(firstWord.length).trim();
      currentSkuQty = qty;
    } else if (currentSku && qty !== 0 && /^\d{4,6}$|^[A-Z]\d{3}|^0ZZZZ/.test(firstWord)) {
      locRows.push({ external_sku: currentSku, product_name: `${currentSku} ${currentName}`, location: label, quantity: qty });
    }
  }
  flush();
  return records;
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
    setSalesMsg(parsed.salesRows.length ? `已解析 ${parsed.salesRows.length} 筆商品業績、${parsed.storeRows.length} 筆門市業績，請確認後匯入。` : '沒有解析到資料，請確認格式。');
  }

  async function doSalesImport() {
    if (!supabase || salesRows.length === 0) return;
    setSalesImporting(true);
    // Delete only the specific sold_at dates from this import (preserves other weeks)
    const soldDates = [...new Set(salesRows.map((r) => String(r.sold_at || '')).filter(Boolean))];
    for (const date of soldDates) {
      await supabase.from('sales_records').delete().eq('sold_at', date);
      await supabase.from('channel_sales_records').delete().eq('sales_month', date);
      await supabase.from('channel_store_sales_records').delete().eq('sales_month', date);
      await supabase.from('product_store_sales').delete().eq('sales_month', date);
    }
    const { error } = await supabase.from('sales_records').insert(salesRows);
    if (!error && channelRows.length) await supabase.from('channel_sales_records').insert(channelRows);
    if (!error && storeRows.length) await supabase.from('channel_store_sales_records').insert(storeRows);
    if (!error && productStoreRows.length) await supabase.from('product_store_sales').insert(productStoreRows);
    const dateLabel = soldDates.join('、') || importMonth;
    setSalesMsg(error ? `匯入失敗：${error.message}` : `✓ 已匯入 ${dateLabel} 業績（${salesRows.length} 筆），其餘週資料不受影響。`);
    if (!error) { setSalesRows([]); setChannelRows([]); setStoreRows([]); setProductStoreRows([]); }
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
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const rows = parseInventoryExcel(data);
    setInvRows(rows); setInvFile(file.name);
    setInvMsg(rows.length ? `已解析 ${rows.length} 筆（${new Set(rows.map((r) => r.external_sku)).size} 個 SKU），請確認後匯入。` : '未解析到資料，請確認格式。');
  }

  async function doInvImport() {
    if (!supabase || invRows.length === 0) return;
    setInvImporting(true);
    // Delete ALL inventory records so stale imports from other dates don't contaminate results
    const { error: delErr } = await supabase.from('inventory_records').delete().gte('recorded_at', '2000-01-01');
    if (delErr) { setInvMsg(`刪除失敗：${delErr.message}`); setInvImporting(false); return; }
    const rowsWithDate = invRows.map((r) => ({ ...r, recorded_at: recordDate }));
    for (let i = 0; i < rowsWithDate.length; i += 500) {
      const { error } = await supabase.from('inventory_records').insert(rowsWithDate.slice(i, i + 500));
      if (error) { setInvMsg(`匯入失敗：${error.message}`); setInvImporting(false); return; }
    }
    setInvMsg(`✓ 已清除舊庫存，匯入 ${recordDate} 共 ${invRows.length} 筆（${new Set(invRows.map((r) => r.external_sku)).size} 個 SKU）。`);
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
                <p className="mt-1 text-xs text-amber-600">⚠ 確認後 {recordDate} 舊庫存將全部覆蓋</p>
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
  const visible = showAll ? records : records.slice(0, 10);
  return (
    <div className="mt-6">
      <Table columns={['日期', '商品', '通路', '數量', '業績金額']}>
        {visible.map((r) => (
          <tr key={r.id} className="border-t">
            <td className="p-3">{formatFullDate(r.sold_at)}</td>
            <td className="p-3">{salesProductLabel(r)}</td>
            <td className="p-3">{r.channel}</td>
            <td className="p-3">{r.quantity}</td>
            <td className="p-3">{formatCurrency(r.revenue)}</td>
          </tr>
        ))}
      </Table>
      {records.length > 10 && (
        <button type="button" onClick={() => setShowAll(!showAll)}
          className="mt-2 w-full rounded-md border border-slate-200 py-2 text-sm text-slate-500 hover:bg-slate-50">
          {showAll ? '收起' : `展開全部（共 ${records.length} 筆）`}
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
    duty_fee: '關稅', sample_fee: '打樣費', other: '其他',
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

function parseDepartmentSales(rows: unknown[][], fallbackMonth: string, headerIndex = -1) {
  // If header is at row 0, there's no period text row; data starts at row 1
  const periodText = headerIndex === 0 ? '' : String(rows[0]?.[1] || '');
  const soldAt = periodEndDate(periodText) || monthEnd(fallbackMonth);
  const salesMonth = `${soldAt.slice(0, 7)}-01`;
  const salesRows: Row[] = [];
  const storeTotals = new Map<string, Row>();
  let currentProduct: Row | null = null;
  // When header is at row 0, data starts at row 1; otherwise skip 3 metadata rows
  const dataStart = headerIndex >= 0 ? headerIndex + 1 : 3;
  // When header is first row, file has product-line summary rows that must be skipped
  const hasCategoryRows = headerIndex === 0;

  const accumulatingProducts = new Set<Row>();
  const productStoreRows: Row[] = [];

  for (const row of rows.slice(dataStart)) {
    const label = String(row[0] || '').trim();
    if (!label || label === '總計') continue;
    const quantity = parseNumber(row[1]);
    const revenue = parseNumber(row[2]);
    if (isStoreName(label)) {
      if (!currentProduct || (!quantity && !revenue)) continue;
      const channel = classifyStore(label);
      const storeName = label.replace(/^\S+\s*/, '');
      const key = `${channel}::${storeName}`;
      const existing = storeTotals.get(key) || { sales_month: soldAt, channel_category: channel, store_name: storeName, quantity: 0, revenue: 0, source_name: '各部門業績明細匯入' };
      existing.quantity += quantity;
      existing.revenue += revenue;
      storeTotals.set(key, existing);
      productStoreRows.push({
        sales_month: soldAt,
        external_sku: String(currentProduct.external_sku || ''),
        external_product_name: String(currentProduct.external_product_name || ''),
        channel_category: channel,
        store_name: storeName,
        quantity,
        revenue,
      });
      if (accumulatingProducts.has(currentProduct)) {
        currentProduct.quantity += quantity;
        currentProduct.revenue += revenue;
      }
      continue;
    }
    // Skip product-line category summary rows (e.g. "石墨烯發熱衣BigRed", "PRO折疊套鏡")
    // These appear in the new format and are summaries of the SKU rows that follow them.
    // SKU rows always start with a 2-uppercase-letter + digit product code (e.g. AH1..., AS1...).
    if (hasCategoryRows && !/^[A-Z]{2}\d/.test(label.split(/\s+/)[0] || '')) continue;
    // Skip zero-revenue rows in the old format (no category rows); in the new format SKU rows
    // may have null revenue when sales data only appears on child store rows — still track them.
    if (!hasCategoryRows && !quantity && !revenue) continue;
    const sku = label.split(/\s+/)[0] || '';
    currentProduct = {
      product_id: null,
      external_sku: sku,
      external_product_name: label,
      sold_at: soldAt,
      quantity,
      revenue,
      channel: '全通路',
      notes: '各部門業績明細匯入',
    };
    if (!quantity && !revenue) accumulatingProducts.add(currentProduct);
    salesRows.push(currentProduct);
  }

  const storeRows = [...storeTotals.values()];
  const channelRows = Object.values(storeRows.reduce((acc, row) => {
    const key = row.channel_category;
    acc[key] ??= { sales_month: soldAt, channel_category: key, quantity: 0, revenue: 0, source_name: '各部門業績明細匯入' };
    acc[key].quantity += Number(row.quantity ?? 0);
    acc[key].revenue += Number(row.revenue ?? 0);
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
