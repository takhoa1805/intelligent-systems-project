import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Package, ReceiptText } from 'lucide-react';
import { api } from '../api';
import { previewOrders, money, displayDate } from '../prototype/data';

export default function OrderInspection({ offline }) {
  const { id } = useParams();
  const [result, setResult] = useState(null);
  useEffect(() => {
    window.scrollTo(0, 0);
    let canceled = false; setResult(null);
    const task = offline ? Promise.resolve(previewOrders.find((o) => o.id === id)) : api.adminOrder(id);
    task.then((order) => { if (!canceled) setResult(order ? { order } : { error: 'Order not found.' }); }).catch((error) => { if (!canceled) setResult({ error: error.message }); });
    return () => { canceled = true; };
  }, [id, offline]);
  const order = result?.order;
  return <main className="admin-page inspection-page"><Link className="back-link" to="/admin#orders"><ArrowLeft size={16} /> Back to administration</Link>
    {!result ? <p role="status">Loading order…</p> : result.error ? <section className="panel" role="alert"><h1>Unable to open order</h1><p>{result.error}</p></section> : <>
      <section className="admin-heading"><div><span className="kicker">ORDER INSPECTION</span><h1>{order.order_number}</h1><p>Purchased {displayDate(order.created_at)} · {offline ? 'Sample order' : 'Stored order'} · {order.currency}</p></div><span className={`state-badge ${order.status === 'canceled' ? 'muted' : ''}`}>{order.status}</span></section>
      <div className="inspection-grid"><section className="panel line-items"><div className="panel-head"><div><span>PURCHASED PRODUCTS</span><h3>Order items</h3></div><Package size={21} /></div><p className="quiet-note">Item names and prices are retained as recorded at purchase.</p><div className="table-scroll"><table className="data-table"><thead><tr><th>Product</th><th>Quantity</th><th>Unit price</th><th>Line total</th></tr></thead><tbody>{order.items.map((p, index) => <tr key={index}><td><strong>{p.product_name}</strong><small>Product #{p.product_id ?? 'withdrawn'}</small></td><td>{p.quantity}</td><td>{money(p.unit_price, order.currency)}</td><td>{money(p.quantity * p.unit_price, order.currency)}</td></tr>)}</tbody></table></div>{!order.items.length && <p>No line items are available for this historical order.</p>}<div className="order-totals"><div><span>Merchandise subtotal</span><b>{money(order.subtotal, order.currency)}</b></div><div><span>Shipping</span><b>{money(order.shipping_total, order.currency)}</b></div><div><strong>Order total</strong><strong>{money(order.total, order.currency)}</strong></div></div></section>
      <aside className="inspection-sidebar"><section className="panel"><div className="panel-head"><div><span>CUSTOMER</span><h3>Contact details</h3></div></div><p className="customer-name">{order.customer_name}</p><p className="quiet-note">{order.customer_email || 'No email in the source record'}</p><p className="quiet-note">Guest purchase · no account required</p></section><section className="panel"><div className="panel-head"><div><span>TRANSACTION RECORD</span><h3>Order history</h3></div><ReceiptText size={20} /></div><div className="timeline-entry"><CheckCircle2 size={18} /><div><strong>Purchase recorded</strong><p>{displayDate(order.created_at)}</p></div></div><div className="timeline-entry"><CheckCircle2 size={18} /><div><strong>Current status: {order.status}</strong><p>Purchase-time quantities and prices preserved.</p></div></div></section></aside></div>
    </>}
  </main>;
}
