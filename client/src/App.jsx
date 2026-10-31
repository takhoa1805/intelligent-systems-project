import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import CartDrawer from './components/CartDrawer';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import { api } from './api';
import { mockCategories } from './mockData';
import { previewProducts, initialLabState } from './prototype/data';
import OrderInspection from './pages/OrderInspection';
const DataScience = lazy(() => import('./pages/DataScience'));

const Admin = lazy(() => import('./pages/Admin'));

const previewParam = new URLSearchParams(window.location.search).get('preview');
if (previewParam !== null) localStorage.setItem('signal-report-preview', previewParam === '1' ? '1' : '0');
const reportPreview = localStorage.getItem('signal-report-preview') === '1';
const cartKey = reportPreview ? 'signal-preview-cart' : 'signal-cart';

export default function App() {
  const location = useLocation();
  useEffect(() => { if (!location.hash) window.scrollTo(0, 0); }, [location.pathname, location.hash]);
  const [lab, setLab] = useState(initialLabState);
  useEffect(() => { localStorage.setItem('signal-prototype-models', JSON.stringify(lab)); }, [lab]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem(cartKey) || '[]'));
  const [cartOpen, setCartOpen] = useState(false);
  const [recommendationAnchor, setRecommendationAnchor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const navigate = useNavigate();

  const loadProducts = async () => {
    if (reportPreview) { setProducts(previewProducts); setCategories(mockCategories); setOffline(true); setLoading(false); return; }
    try {
      const [items, cats] = await Promise.all([api.products(), api.categories()]);
      setProducts(items.items); setCategories(cats); setOffline(false);
    } catch {
      setProducts(previewProducts); setCategories(mockCategories); setOffline(true);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => { localStorage.setItem(cartKey, JSON.stringify(cart)); }, [cart]);

  const addToCart = (product, source = 'catalog') => {
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      return found
        ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { ...product, quantity: 1 }];
    });
    setRecommendationAnchor(product.id);
    setCartOpen(true);

  };

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const updateQuantity = (id, quantity) => setCart((items) => quantity <= 0 ? items.filter((i) => i.id !== id) : items.map((i) => i.id === id ? { ...i, quantity } : i));

  return <>
    <Header reportPreview={reportPreview} cartCount={cartCount} onCart={() => setCartOpen(true)} onSearch={(search) => navigate(`/shop?q=${encodeURIComponent(search)}`)} />
    {reportPreview ? <div className="demo-banner">Report preview · Sample catalogue and orders · Illustrative recommendation results</div> : offline && <div className="demo-banner">Offline preview · Sample catalogue and orders</div>}
    <Routes>
      <Route path="/" element={<Home modelVersion={lab.active} products={products} loading={loading} addToCart={addToCart} />} />
      <Route path="/shop" element={<Shop products={products} categories={categories} loading={loading} addToCart={addToCart} offline={offline} />} />
      <Route path="/products/:id" element={<ProductDetail modelVersion={lab.active} products={products} addToCart={addToCart} offline={offline} />} />
      <Route path="/admin" element={<Suspense fallback={<main className="admin-page" role="status">Loading dashboard…</main>}><Admin lab={lab} categories={categories} offline={offline} onProductsChanged={loadProducts} /></Suspense>} />
      <Route path="/admin/orders/:id" element={<OrderInspection offline={offline} />} />
      <Route path="/lab" element={<Suspense fallback={<main className="admin-page">Loading workspace…</main>}><DataScience lab={lab} setLab={setLab} /></Suspense>} />
    </Routes>
    <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} cart={cart} products={products} recommendationAnchor={recommendationAnchor} addToCart={addToCart} updateQuantity={updateQuantity} clearCart={() => setCart([])} offline={offline} />
  </>;
}
