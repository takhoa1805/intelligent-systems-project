import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, Box, DollarSign, Pencil, Plus, ShoppingBag, Sparkles, Trash2, Users, X } from 'lucide-react';
import { api } from '../api';

const demo = {
  summary: { revenue: 1314, orders: 3, customers: 3, average_order: 438 },
  trend: [{label:'Sep 14',revenue:0},{label:'Sep 15',revenue:210},{label:'Sep 16',revenue:0},{label:'Sep 17',revenue:858},{label:'Sep 18',revenue:338},{label:'Sep 19',revenue:0},{label:'Sep 20',revenue:118}],
  categories: [{name:'Phones',revenue:799},{name:'Audio',revenue:338},{name:'Power',revenue:138},{name:'Accessories',revenue:39}],
  topProducts: [{name:'Nova X1 Smartphone',units:1,revenue:799},{name:'Pulse Pro Headphones',units:1,revenue:249},{name:'Echo Mini Speaker',units:1,revenue:89}],
  recentOrders: [{order_number:'SS-G7H8J9',customer_name:'Jamie Lee',total:118,status:'paid',created_at:new Date().toISOString()},{order_number:'SS-D4E5F6',customer_name:'Mina Tran',total:338,status:'paid',created_at:new Date(Date.now()-86400000).toISOString()}],
};

function Metric({ icon: Icon, label, value, delta, inverse }) {
  const positive = !inverse ? delta >= 0 : delta < 0;
  return <article className="metric"><div className="metric-head"><span>{label}</span><Icon size={19} /></div><strong>{value}</strong><small className={positive ? 'positive' : 'negative'}>{positive ? <ArrowUpRight /> : <ArrowDownRight />} {Math.abs(delta)}% <i>vs last week</i></small></article>;
}

const emptyProduct = { name:'', description:'', price:'', stock:'', categoryId:'', tags:'', accent:'#e9562a', featured:false };

export default function Admin({ categories, offline, onProductsChanged }) {
  const [data, setData] = useState(demo);
  const [products, setProducts] = useState([]);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(emptyProduct);

  const loadAdmin = async () => {
    if (offline) return;
    const [overview, catalog] = await Promise.all([api.adminOverview(), api.adminProducts()]);
    setData(overview); setProducts(catalog);
  };
  useEffect(() => { loadAdmin().catch(() => {}); }, [offline]);

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
      await Promise.all([loadAdmin(), onProductsChanged()]);
      setTimeout(() => { setModal(false); setMessage(''); }, 900);
    } catch (err) { setMessage(err.message); }
  };
  const remove = async (product) => {
    if (offline || !window.confirm(`Remove “${product.name}” from the storefront? Existing order history will be preserved.`)) return;
    try {
      await api.removeProduct(product.id);
      await Promise.all([loadAdmin(), onProductsChanged()]);
    } catch (err) { window.alert(err.message); }
  };
  const maxCategory = Math.max(...data.categories.map((c) => Number(c.revenue)), 1);

  return <main className="admin-page">
    <section className="admin-heading"><div><span className="kicker">CONTROL ROOM</span><h1>Good morning.</h1><p>Here’s what’s moving across Signal today.</p></div><button className="primary" onClick={openCreate}><Plus size={18} /> Add product</button></section>
    <section className="metric-grid">
      <Metric icon={DollarSign} label="Total revenue" value={`$${Number(data.summary.revenue).toLocaleString()}`} delta={18.2} />
      <Metric icon={ShoppingBag} label="Orders" value={data.summary.orders} delta={12.5} />
      <Metric icon={Users} label="Customers" value={data.summary.customers} delta={8.4} />
      <Metric icon={Box} label="Average order" value={`$${Number(data.summary.average_order).toFixed(0)}`} delta={3.1} inverse />
    </section>
    <section className="dashboard-grid">
      <article className="panel revenue-panel"><div className="panel-head"><div><span>REVENUE</span><h3>Last 7 days</h3></div><select><option>7 days</option><option>30 days</option></select></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.trend}><defs><linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E9562A" stopOpacity=".35"/><stop offset="1" stopColor="#E9562A" stopOpacity="0"/></linearGradient></defs><CartesianGrid stroke="#e9e6de" vertical={false}/><XAxis dataKey="label" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} tickFormatter={(x) => `$${x}`}/><Tooltip formatter={(x) => [`$${x}`, 'Revenue']}/><Area type="monotone" dataKey="revenue" stroke="#E9562A" strokeWidth={2.5} fill="url(#revenue)"/></AreaChart></ResponsiveContainer></div></article>
      <article className="panel category-panel"><div className="panel-head"><div><span>SALES MIX</span><h3>By category</h3></div></div><div className="bar-list">{data.categories.slice(0,5).map((c) => <div key={c.name}><div><span>{c.name}</span><strong>${Number(c.revenue).toFixed(0)}</strong></div><i><b style={{width:`${Number(c.revenue)/maxCategory*100}%`}} /></i></div>)}</div></article>
      <article className="panel products-panel"><div className="panel-head"><div><span>PERFORMANCE</span><h3>Top products</h3></div></div><table><thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead><tbody>{data.topProducts.map((p) => <tr key={p.name}><td>{p.name}</td><td>{p.units}</td><td>${Number(p.revenue).toFixed(0)}</td></tr>)}</tbody></table></article>
      <article className="panel orders-panel"><div className="panel-head"><div><span>ACTIVITY</span><h3>Recent orders</h3></div></div><div className="order-list">{data.recentOrders.map((o) => <div key={o.order_number}><span className="order-dot"/><div><strong>{o.customer_name}</strong><small>{o.order_number} · {new Date(o.created_at).toLocaleDateString()}</small></div><span className="status">{o.status}</span><b>${Number(o.total).toFixed(0)}</b></div>)}</div></article>
      <article className="panel recommender-panel"><div className="model-icon"><Sparkles /></div><div><span>RECOMMENDER LAB</span><h3>Integration-ready</h3><p>Events and purchases are being captured for future association rules and semantic embeddings.</p></div><div className="model-stats"><span><b>2</b> planned models</span><span><b>4</b> tracked event types</span></div></article>
    </section>

    <section className="panel catalog-panel">
      <div className="panel-head"><div><span>CATALOG</span><h3>Manage products</h3></div><small>{products.length} active products</small></div>
      <div className="admin-product-list">
        {products.map((product) => <article key={product.id}>
          <i style={{ background: product.accent }} />
          <div><strong>{product.name}</strong><small>{product.category} · {product.stock} in stock</small></div>
          <b>${Number(product.price).toFixed(0)}</b>
          <span className={product.featured ? 'featured-tag' : 'standard-tag'}>{product.featured ? 'Featured' : 'Standard'}</span>
          <div className="row-actions"><button aria-label={`Edit ${product.name}`} onClick={() => openEdit(product)}><Pencil size={15} /></button><button className="danger" aria-label={`Remove ${product.name}`} onClick={() => remove(product)}><Trash2 size={15} /></button></div>
        </article>)}
      </div>
    </section>

    {modal && <div className="modal-shell"><button className="modal-backdrop" onClick={() => setModal(false)} /><form className="product-modal" onSubmit={submit}><div className="modal-head"><div><span className="kicker">CATALOG</span><h2>{editingId ? 'Edit product' : 'Add a new product'}</h2></div><button type="button" className="icon-button" onClick={() => setModal(false)}><X /></button></div><div className="form-grid"><label className="full">Product name<input required value={form.name} onChange={(e) => setForm({...form,name:e.target.value})} placeholder="e.g. Nova Buds Mini"/></label><label className="full">Description<textarea required value={form.description} onChange={(e) => setForm({...form,description:e.target.value})} placeholder="Short, useful product description"/></label><label>Price ($)<input required min="0.01" step="0.01" type="number" value={form.price} onChange={(e) => setForm({...form,price:e.target.value})}/></label><label>Stock<input required min="0" step="1" type="number" value={form.stock} onChange={(e) => setForm({...form,stock:e.target.value})}/></label><label>Category<select required value={form.categoryId} onChange={(e) => setForm({...form,categoryId:e.target.value})}><option value="">Choose one</option>{categories.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label>Accent color<input type="color" value={form.accent} onChange={(e) => setForm({...form,accent:e.target.value})}/></label><label className="full">Search tags<input value={form.tags} onChange={(e) => setForm({...form,tags:e.target.value})} placeholder="wireless, audio, travel"/></label><label className="checkbox full"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({...form,featured:e.target.checked})}/> Feature on the homepage</label></div>{message && <p className={message.includes('success') ? 'form-success' : 'form-error'}>{message}</p>}<button className="primary wide">{editingId ? 'Save changes' : 'Publish product'} <ArrowUpRight size={18}/></button></form></div>}
  </main>;
}
