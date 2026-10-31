import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Search } from 'lucide-react';
import { api } from '../api';
import { previewOrders, money, displayDate } from '../prototype/data';

export default function OrderTable({ offline }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  const navigate = useNavigate();
  useEffect(() => {
    if (offline) return;
    const controller = new AbortController(); setResult(null);
    api.adminOrders({ search, status, page, pageSize: 8 }, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setResult({ data }); })
      .catch((error) => { if (!controller.signal.aborted) setResult({ error: error.message }); });
    return () => controller.abort();
  }, [offline, search, status, page, retry]);
  const filtered = previewOrders.filter((o) => (status === 'all' || o.status === status) && `${o.order_number} ${o.customer_name}`.toLowerCase().includes(search.toLowerCase()));
  const data = offline ? { items: filtered.slice((page - 1) * 8, page * 8), total: filtered.length, totalPages: Math.ceil(filtered.length / 8) } : result?.data;
  return <section className="panel order-table-panel" id="orders">
    <div className="panel-head"><div><span>ORDER MANAGEMENT</span><h3>Orders</h3></div><small>{data ? `${data.total.toLocaleString()} orders` : 'Loading…'} · {offline ? 'Sample records' : 'Operational records'}</small></div>
    <div className="order-filters"><label><span><Search size={14} /> Find an order</span><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Order number or customer" /></label><label>Status<select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="all">All statuses</option>{['paid', 'delivered', 'shipped', 'canceled'].map((s) => <option key={s} value={s}>{s}</option>)}</select></label></div>
    {result?.error && !offline ? <div role="alert"><p>{result.error}</p><button className="secondary" onClick={() => setRetry((r) => r + 1)}>Retry orders</button></div> : !data ? <p role="status">Loading orders…</p> : <><div className="table-scroll"><table className="data-table"><thead><tr><th>Order</th><th>Customer</th><th>Purchased</th><th>Status</th><th>Total</th><th><span className="sr-only">Inspect</span></th></tr></thead><tbody>{data.items.map((order) => <tr key={order.id} className="clickable-row" onClick={() => navigate(`/admin/orders/${order.id}`)}><td><Link to={`/admin/orders/${order.id}`}>{order.order_number}</Link></td><td>{order.customer_name}</td><td>{displayDate(order.created_at)}</td><td><span className={`state-badge ${order.status === 'canceled' ? 'muted' : ''}`}>{order.status}</span></td><td>{money(order.total, order.currency)}</td><td><ArrowUpRight size={16} /></td></tr>)}</tbody></table></div>{!data.items.length && <p className="quiet-note">No orders match these filters.</p>}<nav className="catalog-pagination" aria-label="Order pagination"><button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {Math.max(1, data.totalPages)}</span><button className="primary" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Next</button></nav></>}
  </section>;
}
