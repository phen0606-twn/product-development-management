import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Route, Routes, useParams } from 'react-router-dom';
import { BarChart3, Boxes, DollarSign, LayoutDashboard, Pencil, Plus, Trash2, Upload, Users } from 'lucide-react';
import { hasSupabaseConfig, supabase } from './lib/supabase';
import { formatCurrency, formatFullDate, monthEnd } from './lib/format';

type Row = Record<string, any>;

const nav = [
  ['/', 'Dashboard', LayoutDashboard],
  ['/products', '商品管理', Boxes],
  ['/vendors', '廠商管理', Users],
  ['/costs', '費用管理', DollarSign],
  ['/sales', '業績追蹤', BarChart3],
  ['/sales-import', '業績匯入', Upload],
] as const;

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
  const [resetPassword, setResetPassword] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const url = new URL(window.location.href);
    if (url.hash.includes('type=recovery') || url.searchParams.get('type') === 'recovery') {
      setResetPassword(true);
    }
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
      setReady(true);
    });
    return supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setResetPassword(true);
      setEmail(session?.user.email ?? null);
      setReady(true);
    }).data.subscription.unsubscribe;
  }, []);

  if (!ready) return <div className="p-8">載入中...</div>;
  if (hasSupabaseConfig && !email) return <Login />;
  if (hasSupabaseConfig && resetPassword) return <PasswordReset onDone={() => setResetPassword(false)} />;

  return (
    <div className="min-h-screen bg-mist lg:grid lg:grid-cols-[238px_1fr]">
      <aside className="border-r border-slate-200 bg-white p-5">
        <h1 className="text-lg font-semibold text-ink">商品開發管理</h1>
        <p className="mt-1 text-xs text-slate-500">防曬 / 天氣商品開發系統</p>
        <nav className="mt-6 space-y-1">
          {nav.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm ${isActive ? 'bg-leaf text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        {email && <button onClick={() => supabase?.auth.signOut()} className="mt-8 text-left text-xs text-slate-500">登出<br />{email}</button>}
      </aside>
      <main className="p-5 lg:p-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/vendors" element={<VendorsPage />} />
          <Route path="/costs" element={<CostsPage />} />
          <Route path="/sales" element={<SalesPage />} />
          <Route path="/sales-import" element={<SalesImportPage />} />
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
    const query = supabase.from(table).select('*').limit(3000);
    const { data, error } = order ? await query.order(order, { ascending: false }) : await query;
    setRows(data ?? []);
    setError(error?.message ?? '');
    setLoading(false);
  }
  useEffect(() => void load(), [table]);
  return { rows, loading, error, reload: load };
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
  const statusRows = groupProductsByStatus(products.rows);
  return (
    <Page title="Dashboard" subtitle="開發商品、費用與業績總覽">
      <div className="grid gap-4 md:grid-cols-4">
        <Card label="開發中商品" value={String(active)} />
        <Card label="延遲商品" value={String(delayed)} tone="coral" />
        <Card label="本月費用" value={formatCurrency(monthCost)} />
        <Card label="本月業績" value={formatCurrency(monthSales)} />
      </div>
      <StatusSummary rows={statusRows} />
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
      vendor_id: data.vendor_id || null,
      status: data.status || 'planning',
      target_launch_date: data.target_launch_date || null,
      spec_summary: data.spec_summary,
      specification_summary: data.spec_summary,
      attachment_url: data.attachment_url,
      notes: data.notes,
    });
    const { error } = editing?.id
      ? await supabase!.from('products').update(payload).eq('id', editing.id)
      : await supabase!.from('products').insert(payload);
    if (error) {
      setMessage(`商品儲存失敗：${error.message}`);
      return;
    }
    setOpen(false);
    setEditing(null);
    setMessage('');
    products.reload();
  }

  async function remove(row: Row) {
    if (confirm(`確定刪除「${row.name}」嗎？`)) {
      await supabase?.from('products').delete().eq('id', row.id);
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
  const product = products.rows.find((p) => p.id === id);
  const productProgress = mergeProgressRows(id, progress.rows, events.rows).sort((a, b) => String(a.started_at || a.created_at).localeCompare(String(b.started_at || b.created_at)));
  const productCosts = costs.rows.filter((c) => c.product_id === id);
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
    });
    const table = editing?._source === 'development_progress' ? 'development_progress' : 'development_events';
    const payload = table === 'development_progress' ? progressPayload : eventPayload;
    const { error } = editing?.id
      ? await supabase!.from(table).update(payload).eq('id', editing.id)
      : await supabase!.from('development_events').insert(eventPayload);
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
          <p className="text-sm text-slate-500">此商品費用小計</p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(productCosts.reduce((s, c) => s + costTotal(c), 0))}</p>
          <p className="mt-4 text-sm text-slate-500">費用筆數：{productCosts.length}</p>
        </section>
      </div>

      <section>
        <Toolbar onAdd={() => { setEditing(null); setOpen(true); }} label="新增進度" />
        {message && <Notice tone="error">{message}</Notice>}
        {(progress.error || events.error) && <Notice tone="error">進度資料讀取失敗：{progress.error || events.error}</Notice>}
        {open && <ProgressForm row={editing} onCancel={() => setOpen(false)} onSave={saveProgress} />}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <h3 className="mb-4 font-semibold">進度追蹤 Timeline</h3>
          <div className="space-y-4">
            {productProgress.length === 0 && <p className="text-sm text-slate-500">尚無進度紀錄</p>}
            {productProgress.map((row) => (
              <div key={row.id} className="grid gap-3 border-l-4 border-leaf bg-slate-50 p-4 md:grid-cols-[1fr_auto]">
                <div>
                  <p className="font-medium">{row.stage} {row.title ? ` / ${row.title}` : ''}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{row.content}</p>
                  <p className="mt-2 text-xs text-slate-500">日期：{row.started_at || '-'}　預計完成：{row.expected_completed_at || '-'}　完成日：{row.completed_at || '-'}</p>
                </div>
                <ActionButtons onEdit={() => { setEditing(row); setOpen(true); }} onDelete={() => removeProgress(row)} />
              </div>
            ))}
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
  const batches = useRows('purchase_batches');
  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const monthRows = costs.rows.filter((c) => String(c.paid_at ?? c.created_at).startsWith(month));
  const total = monthRows.reduce((s, c) => s + costTotal(c), 0);
  const paid = monthRows.reduce((s, c) => s + Number(c.paid_amount ?? 0) * Number(c.exchange_rate_to_twd || 1), 0);

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
        <Card label="本月未付款" value={formatCurrency(total - paid)} tone="coral" />
      </div>
      {open && <CostForm row={editing} products={products.rows} batches={batches.rows} onCancel={() => setOpen(false)} onSave={save} />}
      <Table columns={['付款日', '商品', '類型', '說明', '原幣金額', '匯率', '手續費', '台幣總額', '操作']}>
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
  return <DataForm title={row ? '重新編輯商品' : '新增商品'} row={row} onSave={onSave} onCancel={onCancel} fields={[
    ['sku', 'SKU'], ['name', '商品名稱', 'required'], ['category', '分類'], ['color', '顏色'], ['size', '尺寸'],
    ['vendor_id', '廠商', 'select', vendors.map((v) => [v.id, v.name])],
    ['status', '狀態', 'select', statusOptions.map(([v, l]) => [v, l])],
    ['target_launch_date', '預計上架日', 'date'],
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

function ProgressForm({ row, onSave, onCancel }: { row: Row | null; onSave: (data: Row) => void; onCancel: () => void }) {
  return <DataForm title={row ? '重新編輯進度' : '新增進度'} row={row} onSave={onSave} onCancel={onCancel} fields={[
    ['stage', '階段', 'select', stageOptions.map((s) => [s, s])],
    ['started_at', '日期', 'date'], ['title', '標題'], ['content', '內容', 'textarea'],
    ['expected_completed_at', '預計完成日', 'date'], ['completed_at', '完成日', 'date'],
  ]} />;
}

function CostForm({ row, products, batches, onSave, onCancel }: { row: Row | null; products: Row[]; batches: Row[]; onSave: (data: Row) => void; onCancel: () => void }) {
  return <DataForm title={row ? '重新編輯費用' : '新增費用'} row={row} onSave={onSave} onCancel={onCancel} fields={[
    ['product_id', '商品', 'select', products.map((p) => [p.id, `${p.sku || ''} ${p.name}`])],
    ['batch_id', '採購批次', 'select', batches.map((b) => [b.id, b.name || b.batch_no])],
    ['type', '費用類型', 'select', costTypes.map((t) => [t, t])],
    ['custom_type', '其他類型'], ['description', '說明'], ['currency', '幣別', 'select', [['TWD', '台幣'], ['USD', '美金'], ['CNY', '人民幣']]],
    ['amount', '原幣金額', 'number'], ['exchange_rate_to_twd', '匯率', 'number'], ['bank_fee_twd', '手續費台幣', 'number'],
    ['paid_amount', '已付款原幣金額', 'number'], ['paid_at', '付款日', 'date'], ['due_date', '到期日', 'date'], ['notes', '備註', 'textarea'],
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
  const sales = useRows('sales_records');
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
      <div className="mt-6"><Table columns={['日期', '商品', '通路', '數量', '業績金額']}>{records.map((r) => <tr key={r.id} className="border-t"><td className="p-3">{formatFullDate(r.sold_at)}</td><td className="p-3">{salesProductLabel(r)}</td><td className="p-3">{r.channel}</td><td className="p-3">{r.quantity}</td><td className="p-3">{formatCurrency(r.revenue)}</td></tr>)}</Table></div>
    </Page>
  );
}

function SalesImportPage() {
  const [message, setMessage] = useState('');
  const [previewRows, setPreviewRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState('');
  const totalRevenue = previewRows.reduce((sum, row) => sum + Number(row.revenue ?? 0), 0);
  const totalQuantity = previewRows.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);

  async function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('file');
    const month = String(form.get('month'));
    if (!(file instanceof File)) return;
    const XLSX = await import(/* @vite-ignore */ 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const rows = parseSales(workbook, XLSX.utils, month);
    setPreviewRows(rows);
    setFileName(file.name);
    setMessage(rows.length ? `已解析 ${rows.length} 筆，請確認預覽後再匯入。` : '沒有解析到可匯入資料，請確認欄位名稱。');
  }

  async function importPreview() {
    if (!supabase || previewRows.length === 0) return;
    const { error } = await supabase.from('sales_records').insert(previewRows);
    setMessage(error ? `匯入失敗：${error.message}` : `已匯入 ${previewRows.length} 筆。`);
    if (!error) setPreviewRows([]);
  }

  return (
    <Page title="業績匯入" subtitle="可匯入商品業績或年度橫式表，未建檔商品也會匯入。">
      <TopLinks links={[['/sales', '返回業績追蹤']]} />
      <form onSubmit={preview} className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">匯入月份<input name="month" type="month" defaultValue={new Date().toISOString().slice(0, 7)} className="mt-1 w-full rounded-md border px-3 py-2" /></label>
          <label className="text-sm md:col-span-2">Excel 檔案<input name="file" type="file" accept=".xlsx,.xls,.csv" className="mt-1 w-full rounded-md border px-3 py-2" required /></label>
        </div>
        <button className="mt-4 rounded-md bg-leaf px-4 py-2 text-white">預覽匯入資料</button>
        {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
      </form>
      {previewRows.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
            <div>
              <h3 className="font-semibold">匯入預覽</h3>
              <p className="mt-1 text-sm text-slate-500">{fileName} / {previewRows.length.toLocaleString('zh-TW')} 筆 / 數量 {totalQuantity.toLocaleString('zh-TW')} / 金額 {formatCurrency(totalRevenue)}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPreviewRows([])} className="rounded-md border border-slate-200 px-4 py-2 text-sm">取消</button>
              <button type="button" onClick={importPreview} className="rounded-md bg-leaf px-4 py-2 text-sm text-white">確認匯入</button>
            </div>
          </div>
          <Table columns={['日期', 'SKU', '商品', '通路', '數量', '業績金額']}>
            {previewRows.slice(0, 20).map((row, index) => (
              <tr key={`${row.external_sku}-${index}`} className="border-t">
                <td className="p-3">{formatFullDate(row.sold_at)}</td>
                <td className="p-3">{row.external_sku}</td>
                <td className="p-3">{row.external_product_name}</td>
                <td className="p-3">{row.channel}</td>
                <td className="p-3">{Number(row.quantity ?? 0).toLocaleString('zh-TW')}</td>
                <td className="p-3">{formatCurrency(row.revenue)}</td>
              </tr>
            ))}
          </Table>
          {previewRows.length > 20 && <p className="mt-3 text-sm text-slate-500">只顯示前 20 筆預覽。</p>}
        </section>
      )}
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

function Summary({ title, rows, valueLabel }: { title: string; rows: Array<{ label: string; quantity: number; revenue: number; rank?: number }>; valueLabel?: string }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft"><h3 className="mb-4 font-semibold">{title}</h3><div className="space-y-3">{rows.length === 0 && <p className="text-sm text-slate-500">尚無資料</p>}{rows.map((r) => <div key={r.label} className="grid grid-cols-[1fr_auto] gap-3 rounded-md border border-slate-100 p-3 text-sm"><div className="flex gap-3">{r.rank && <span className={`min-w-8 text-2xl font-bold ${r.rank <= 3 ? 'text-coral' : 'text-slate-400'}`}>{r.rank}</span>}<div><p className="font-medium">{r.label}</p><p className="mt-1 text-slate-500">{r.quantity.toLocaleString('zh-TW')} 件</p></div></div><p className="font-semibold text-leaf">{valueLabel ? `${r.revenue} ${valueLabel}` : formatCurrency(r.revenue)}</p></div>)}</div></section>;
}

function ChannelSummary({ rows }: { rows: Array<{ label: string; quantity: number; revenue: number }> }) {
  const colors = ['#4f8f72', '#ef6f61', '#3b82f6'];
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
