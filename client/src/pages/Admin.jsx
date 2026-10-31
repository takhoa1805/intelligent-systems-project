import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowUpRight, Box, DollarSign, Pencil, Plus, ShoppingBag, Trash2, Users, X } from 'lucide-react';
import { api } from '../api';
import { useSearchParams } from 'react-router-dom';
import { previewProducts as mockProducts, salesPreview } from '../prototype/data';
import OrderTable from '../components/OrderTable';
import ModelStatus from '../components/ModelStatus';

const PAGE_SIZE = 24;

function Metric({ icon: Icon, label, value, offline }) {
  return <article className="metric"><div className="metric-head"><span>{label}</span><Icon size={19} /></div><strong>{value}</strong><small className="metric-caption">{offline ? 'Sample period · USD' : 'All recorded sales'}</small></article>;
}

const emptyProduct = { name:'', description:'', price:'', stock:'', categoryId:'', tags:'', accent:'#e9562a', featured:false };

export default function Admin({ lab, categories, offline, onProductsChanged }) {
  const [period, setPeriod] = useState(7);
  const [params, setParams] = useSearchParams();
  const search = params.get('q') || '';
  const category = params.get('category') || 'all';
  const requestedPage = Number(params.get('page') || 1);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= 100000 ? requestedPage : 1;
  const [searchDraft, setSearchDraft] = useState(search);
  const [overview, setOverview] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [revision, setRevision] = useState(0);
  const [overviewRetry, setOverviewRetry] = useState(0);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const requestKey = JSON.stringify([search, category, page, revision, catalogRetry]);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(emptyProduct);

  useEffect(() => { setSearchDraft(search); }, [search]);
  useEffect(() => {
    if (offline) return;
    const controller = new AbortController();
    setOverview(null);
    api.adminOverview({ signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setOverview({ data }); })
      .catch((error) => { if (!controller.signal.aborted) setOverview({ error: error.message }); });
    return () => controller.abort();
  }, [offline, revision, overviewRetry]);
  useEffect(() => {
    if (offline) return;
    const controller = new AbortController();
    api.adminProducts({ search, category, page, pageSize: PAGE_SIZE }, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setCatalog({ key: requestKey, data }); })
      .catch((error) => { if (!controller.signal.aborted) setCatalog({ key: requestKey, error: error.message }); });
    return () => controller.abort();
  }, [offline, search, category, page, requestKey]);

  const changeFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    next.delete('page');
    setParams(next);
  };
  const changePage = (nextPage) => {
    const next = new URLSearchParams(params);
    if (nextPage === 1) next.delete('page');
    else next.set('page', String(nextPage));
    setParams(next);
  };
  const refreshAfterSave = async () => {
    setRevision((value) => value + 1);
    await onProductsChanged();
  };
  const previewItems = offline ? mockProducts.filter((product) =>
    (category === 'all' || product.category_slug === category) &&
    (!search || `${product.name} ${product.description} ${(product.tags || []).join(' ')}`.toLowerCase().includes(search.toLowerCase()))) : [];
  const current = catalog?.key === requestKey ? catalog : null;
  const catalogLoading = !offline && !current;
  const catalogError = !offline && current?.error;
  const products = offline ? previewItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : current?.data?.items || [];
  const total = offline ? previewItems.length : current?.data?.total || 0;
  const totalPages = offline ? Math.ceil(total / PAGE_SIZE) : current?.data?.totalPages || 0;
  const data = offline ? salesPreview(period) : overview?.data;

  const openCreate = () => { setEditingId(null); setForm(emptyProduct); setMessage(''); setModal(true); };
  const openEdit = (product) => {
    setEditingId(product.id);
    setForm({
      name: product.name, description: product.description, price: product.price,
      stock: product.stock, categoryId: product.category_id,
      tags: (product.tags || []).join(', '), accent: product.accent,
      featured: product.featured,
    });
    setMessage(''); setModal(true);
  };
  const submit = async (e) => {
    e.preventDefault(); setMessage('');
    if (offline) { setMessage('Start the database and API to save products.'); return; }
    try {
      const payload = { ...form, tags: form.tags.split(',').map((x) => x.trim()).filter(Boolean) };
      if (editingId) await api.updateProduct(editingId, payload);
      else await api.addProduct(payload);
      setMessage(editingId ? 'Product updated successfully.' : 'Product published successfully.');
      await refreshAfterSave();
      setTimeout(() => { setModal(false); setMessage(''); }, 900);
    } catch (err) { setMessage(err.message); }
  };
  const remove = async (product) => {
    if (offline || !window.confirm(`Remove “${product.name}” from the storefront? Existing order history will be preserved.`)) return;
    try {
      await api.removeProduct(product.id);
      await refreshAfterSave();
    } catch (err) { window.alert(err.message); }
  };
  const maxCategory = Math.max(...(data?.categories || []).map((c) => Number(c.revenue)), 1);

  return <main className="admin-page">
    <section className="admin-heading"><div><span className="kicker">CONTROL ROOM</span><h1>Store overview.</h1><p>{offline ? "Sample sales through 30 October 2026 · USD · canceled orders excluded" : "Sales, orders and catalogue at a glance."}</p></div><button className="primary" onClick={openCreate}><Plus size={18} /> Add product</button></section>
    {!data && <section className="panel admin-loading" role={overview?.error ? 'alert' : 'status'}>
      <p>{overview?.error ? `Unable to load the dashboard: ${overview.error}` : 'Loading dashboard…'}</p>
      {overview?.error && <button className="primary" onClick={() => setOverviewRetry((value) => value + 1)}>Retry dashboard</button>}
    </section>}
    {data && <><section className="metric-grid">
      <Metric icon={DollarSign} label="Total revenue" value={`$${Number(data.summary.revenue).toLocaleString()}`} offline={offline} />
      <Metric icon={ShoppingBag} label="Orders" value={data.summary.orders} offline={offline} />
      <Metric icon={Users} label="Customers" value={data.summary.customers} offline={offline} />
      <Metric icon={Box} label="Average order" value={`$${Number(data.summary.average_order).toFixed(0)}`} offline={offline} />
    </section>
    <section className="dashboard-grid">
      <article className="panel revenue-panel"><div className="panel-head"><div><span>REVENUE</span><h3>Last {offline ? period : 7} days</h3></div>{offline ? <select aria-label="Sales reporting period" value={period} onChange={(e) => setPeriod(Number(e.target.value))}><option value="7">7 days</option><option value="30">30 days</option></select> : <span className="quiet-note">Current week</span>}</div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.trend}><defs><linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E9562A" stopOpacity=".35"/><stop offset="1" stopColor="#E9562A" stopOpacity="0"/></linearGradient></defs><CartesianGrid stroke="#e9e6de" vertical={false}/><XAxis dataKey="label" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} tickFormatter={(x) => `$${x}`}/><Tooltip formatter={(x) => [`$${x}`, 'Revenue']}/><Area type="monotone" dataKey="revenue" stroke="#E9562A" strokeWidth={2.5} fill="url(#revenue)"/></AreaChart></ResponsiveContainer></div></article>
      <article className="panel category-panel"><div className="panel-head"><div><span>SALES MIX</span><h3>By category</h3></div></div><div className="bar-list">{data.categories.slice(0,5).map((c) => <div key={c.name}><div><span>{c.name}</span><strong>${Number(c.revenue).toFixed(0)}</strong></div><i><b style={{width:`${Number(c.revenue)/maxCategory*100}%`}} /></i></div>)}</div></article>
      <article className="panel products-panel"><div className="panel-head"><div><span>PERFORMANCE</span><h3>Top products</h3></div></div><table><thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead><tbody>{data.topProducts.map((p) => <tr key={p.name}><td>{p.name}</td><td>{p.units}</td><td>${Number(p.revenue).toFixed(0)}</td></tr>)}</tbody></table></article>
      <article className="panel orders-panel"><div className="panel-head"><div><span>ACTIVITY</span><h3>Recent orders</h3></div></div><div className="order-list">{data.recentOrders.map((o) => <div key={o.order_number}><span className="order-dot"/><div><strong>{o.customer_name}</strong><small>{o.order_number} · {new Date(o.created_at).toLocaleDateString()}</small></div><span className="status">{o.status}</span><b>${Number(o.total).toFixed(0)}</b></div>)}</div></article>

    </section>

    </>}

    <ModelStatus lab={lab} />
    <OrderTable offline={offline} />
    <section className="panel catalog-panel" aria-busy={catalogLoading}>
      <div className="panel-head"><div><span>CATALOG</span><h3>Manage products</h3></div><small role="status">{catalogLoading ? 'Loading products…' : catalogError ? 'Products could not be loaded.' : `${total.toLocaleString()} active products${products.length ? ` · Showing ${((page - 1) * PAGE_SIZE + 1).toLocaleString()}–${((page - 1) * PAGE_SIZE + products.length).toLocaleString()}` : ''}`}</small></div>
      <form className="admin-catalog-filters" onSubmit={(event) => { event.preventDefault(); changeFilter('q', searchDraft.trim()); }}>
        <label>Search products<input value={searchDraft} maxLength={200} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Product name or description" /></label>
        <label>Category<select value={category} onChange={(event) => changeFilter('category', event.target.value)}><option value="all">All categories</option>{categories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label>
        <button className="primary" type="submit">Search</button>
        {search && <button type="button" className="secondary" onClick={() => changeFilter('q', '')}>Clear search</button>}
      </form>
      {catalogLoading ? <p role="status">Loading catalog…</p> : catalogError ? <div role="alert"><p>{catalogError}</p><button className="primary" onClick={() => setCatalogRetry((value) => value + 1)}>Retry catalog</button></div> : <div className="admin-product-list">
        {products.map((product) => <article key={product.id}>
          <i style={{ background: product.accent }} />
          <div><strong>{product.name}</strong><small>{product.category} · {product.stock} in stock</small></div>
          <b>${Number(product.price).toFixed(0)}</b>
          <span className={product.featured ? 'featured-tag' : 'standard-tag'}>{product.featured ? 'Featured' : 'Standard'}</span>
          <div className="row-actions"><button aria-label={`Edit ${product.name}`} onClick={() => openEdit(product)}><Pencil size={15} /></button><button className="danger" aria-label={`Remove ${product.name}`} onClick={() => remove(product)}><Trash2 size={15} /></button></div>
        </article>)}
        {!products.length && <p>{page > 1 ? 'No products on this page.' : 'No matching products.'} {page > 1 && <button className="secondary" onClick={() => changePage(1)}>Go to first page</button>}</p>}
      </div>}
      {!catalogLoading && !catalogError && totalPages > 1 && <nav className="catalog-pagination" aria-label="Admin product pagination">
        <button className="secondary" disabled={page <= 1} onClick={() => changePage(page - 1)}>Previous</button>
        <span>Page {page.toLocaleString()} of {totalPages.toLocaleString()}</span>
        <button className="primary" disabled={page >= totalPages} onClick={() => changePage(page + 1)}>Next</button>
      </nav>}
    </section>

    {modal && <div className="modal-shell"><button className="modal-backdrop" onClick={() => setModal(false)} /><form className="product-modal" onSubmit={submit}><div className="modal-head"><div><span className="kicker">CATALOG</span><h2>{editingId ? 'Edit product' : 'Add a new product'}</h2></div><button type="button" className="icon-button" onClick={() => setModal(false)}><X /></button></div><div className="form-grid"><label className="full">Product name<input required value={form.name} onChange={(e) => setForm({...form,name:e.target.value})} placeholder="e.g. Nova Buds Mini"/></label><label className="full">Description<textarea required value={form.description} onChange={(e) => setForm({...form,description:e.target.value})} placeholder="Short, useful product description"/></label><label>Price ($)<input required min="0.01" step="0.01" type="number" value={form.price} onChange={(e) => setForm({...form,price:e.target.value})}/></label><label>Stock<input required min="0" step="1" type="number" value={form.stock} onChange={(e) => setForm({...form,stock:e.target.value})}/></label><label>Category<select required value={form.categoryId} onChange={(e) => setForm({...form,categoryId:e.target.value})}><option value="">Choose one</option>{categories.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label>Accent color<input type="color" value={form.accent} onChange={(e) => setForm({...form,accent:e.target.value})}/></label><label className="full">Search tags<input value={form.tags} onChange={(e) => setForm({...form,tags:e.target.value})} placeholder="wireless, audio, travel"/></label><label className="checkbox full"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({...form,featured:e.target.checked})}/> Feature on the homepage</label></div>{message && <p className={message.includes('success') ? 'form-success' : 'form-error'}>{message}</p>}<button className="primary wide">{editingId ? 'Save changes' : 'Publish product'} <ArrowUpRight size={18}/></button></form></div>}
  </main>;
}
