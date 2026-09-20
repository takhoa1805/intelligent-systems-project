import { useState } from 'react';
import { Check, ChevronRight, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { api } from '../api';
import ProductVisual from './ProductVisual';
import CartRecommendations from './CartRecommendations';

export default function CartDrawer({ open, onClose, cart, products, recommendationAnchor, addToCart, updateQuantity, clearCart, offline }) {
  const [stage, setStage] = useState('cart');
  const [form, setForm] = useState({ name: '', email: '' });
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const checkout = async (e) => {
    e.preventDefault(); setError('');
    try {
      const result = offline ? { order_number: `DEMO-${Date.now().toString().slice(-5)}`, total } : await api.checkout({ customer: form, items: cart.map((i) => ({ productId: i.id, quantity: i.quantity })) });
      setOrder(result); clearCart(); setStage('done');
    } catch (err) { setError(err.message); }
  };
  const close = () => { onClose(); setTimeout(() => { setStage('cart'); setOrder(null); setError(''); }, 250); };

  return <div className={open ? 'drawer-shell open' : 'drawer-shell'} aria-hidden={!open}>
    <button className="drawer-backdrop" onClick={close} aria-label="Close cart" />
    <aside className="cart-drawer">
      <div className="drawer-head"><div><span className="kicker">YOUR BAG</span><h2>{stage === 'cart' ? `${cart.length} ${cart.length === 1 ? 'item' : 'items'}` : stage === 'checkout' ? 'Checkout' : 'Order placed'}</h2></div><button className="icon-button" onClick={close}><X /></button></div>
      {stage === 'cart' && <>
        <div className="cart-list">
          {!cart.length && <div className="empty-state"><ShoppingBag size={42} /><h3>Your bag is taking a break.</h3><p>Add something useful and it will show up here.</p></div>}
          {cart.map((item) => <div className="cart-item" key={item.id}><ProductVisual product={item} /><div><h4>{item.name}</h4><p>${Number(item.price).toFixed(0)}</p><div className="quantity"><button onClick={() => updateQuantity(item.id, item.quantity - 1)}><Minus size={13} /></button><span>{item.quantity}</span><button onClick={() => updateQuantity(item.id, item.quantity + 1)}><Plus size={13} /></button></div></div><strong>${(item.price * item.quantity).toFixed(0)}</strong></div>)}
          {!!cart.length && <CartRecommendations anchorProductId={recommendationAnchor} cart={cart} products={products} addToCart={addToCart} offline={offline} />}
        </div>
        {!!cart.length && <div className="drawer-foot"><div className="total-row"><span>Subtotal</span><strong>${total.toFixed(2)}</strong></div><p>Shipping and tax calculated at the next step.</p><button className="primary wide" onClick={() => setStage('checkout')}>Continue to checkout <ChevronRight size={18} /></button></div>}
      </>}
      {stage === 'checkout' && <form className="checkout-form" onSubmit={checkout}>
        <button type="button" className="text-button" onClick={() => setStage('cart')}>← Back to bag</button>
        <label>Full name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Alex Morgan" /></label>
        <label>Email address<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="alex@example.com" /></label>
        <CartRecommendations anchorProductId={recommendationAnchor} cart={cart} products={products} addToCart={addToCart} offline={offline} />
        <div className="checkout-note"><strong>Demo checkout</strong><span>No payment details are collected. Submitting creates a sample order for analytics.</span></div>
        {error && <p className="form-error">{error}</p>}
        <div className="total-row"><span>Total</span><strong>${total.toFixed(2)}</strong></div>
        <button className="primary wide">Place demo order <ChevronRight size={18} /></button>
      </form>}
      {stage === 'done' && <div className="success-state"><span><Check size={30} /></span><h2>Nice choice.</h2><p>Your demo order <strong>{order?.order_number}</strong> is confirmed. It now contributes to the admin analytics and future recommendation dataset.</p><button className="primary" onClick={close}>Keep exploring</button></div>}
    </aside>
  </div>;
}
