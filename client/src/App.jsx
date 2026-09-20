import { useEffect, useMemo, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import CartDrawer from './components/CartDrawer';
import Home from './pages/Home';
import Shop from './pages/Shop';
import Admin from './pages/Admin';
import ProductDetail from './pages/ProductDetail';
import { api } from './api';
import { mockCategories, mockProducts } from './mockData';

const sessionId = localStorage.getItem('signal-session') || crypto.randomUUID();
localStorage.setItem('signal-session', sessionId);

export default function App() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem('signal-cart') || '[]'));
  const [cartOpen, setCartOpen] = useState(false);
  const [recommendationAnchor, setRecommendationAnchor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const navigate = useNavigate();

  const loadProducts = async () => {
    try {
      const [items, cats] = await Promise.all([api.products(), api.categories()]);
      setProducts(items); setCategories(cats); setOffline(false);
    } catch {
      setProducts(mockProducts); setCategories(mockCategories); setOffline(true);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => { localStorage.setItem('signal-cart', JSON.stringify(cart)); }, [cart]);

  const addToCart = (product, source = 'catalog') => {
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      return found
        ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { ...product, quantity: 1 }];
    });
    setRecommendationAnchor(product.id);
    setCartOpen(true);
    if (!offline) api.event({ sessionId, eventType: 'add_to_cart', productId: product.id, metadata: { source } }).catch(() => {});
  };

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const updateQuantity = (id, quantity) => setCart((items) => quantity <= 0 ? items.filter((i) => i.id !== id) : items.map((i) => i.id === id ? { ...i, quantity } : i));

  return <>
    <Header cartCount={cartCount} onCart={() => setCartOpen(true)} onSearch={(search) => navigate(`/shop?q=${encodeURIComponent(search)}`)} />
    {offline && <div className="demo-banner">Preview mode — start PostgreSQL and the API to enable saved orders and live analytics.</div>}
    <Routes>
      <Route path="/" element={<Home products={products} loading={loading} addToCart={addToCart} />} />
      <Route path="/shop" element={<Shop products={products} categories={categories} loading={loading} addToCart={addToCart} />} />
      <Route path="/products/:id" element={<ProductDetail products={products} addToCart={addToCart} offline={offline} />} />
      <Route path="/admin" element={<Admin categories={categories} offline={offline} onProductsChanged={loadProducts} />} />
    </Routes>
    <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} cart={cart} products={products} recommendationAnchor={recommendationAnchor} addToCart={addToCart} updateQuantity={updateQuantity} clearCart={() => setCart([])} offline={offline} />
  </>;
}
