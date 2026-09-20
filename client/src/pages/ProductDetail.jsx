import { useEffect, useState } from 'react';
import { ArrowLeft, Check, PackageCheck, ShieldCheck, ShoppingBag, Sparkles, Star, Truck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import ProductCard from '../components/ProductCard';
import ProductVisual from '../components/ProductVisual';

export default function ProductDetail({ products, addToCart, offline }) {
  const { id } = useParams();
  const [product, setProduct] = useState(() => products.find((item) => item.id === Number(id)));
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(!product);

  useEffect(() => {
    window.scrollTo(0, 0);
    const localProduct = products.find((item) => item.id === Number(id));
    const loadProduct = offline ? Promise.resolve(localProduct) : api.product(id);
    loadProduct.then((item) => setProduct(item)).finally(() => setLoading(false));

    const fallback = () => setRecommendations(products.filter((item) => item.id !== Number(id)).slice(0, 4));
    if (offline) fallback();
    else api.recommendations(id, 4).then(({ items }) => setRecommendations(items)).catch(fallback);

    if (!offline) {
      const sessionId = localStorage.getItem('signal-session');
      api.event({ sessionId, eventType: 'product_view', productId: Number(id) }).catch(() => {});
    }
  }, [id, offline, products]);

  if (loading) return <main className="product-detail-page"><div className="detail-loading" /></main>;
  if (!product) return <main className="product-not-found"><h1>Product not found.</h1><Link to="/shop">Return to the collection</Link></main>;

  return <main className="product-detail-page">
    <Link className="back-link" to="/shop"><ArrowLeft size={16} /> Back to shop</Link>
    <section className="product-detail-hero">
      <ProductVisual product={product} large />
      <div className="detail-copy">
        <span className="kicker">{product.category}</span>
        <h1>{product.name}</h1>
        <div className="detail-rating"><Star size={16} fill="currentColor" /> <strong>{product.rating}</strong><span>Thoughtfully selected by Signal</span></div>
        <p>{product.description}</p>
        <div className="detail-tags">{(product.tags || []).map((tag) => <span key={tag}>{tag}</span>)}</div>
        <div className="detail-purchase"><strong>${Number(product.price).toFixed(2)}</strong><span><Check size={14} /> {product.stock > 0 ? `${product.stock} ready to ship` : 'Out of stock'}</span></div>
        <button className="primary detail-add" disabled={product.stock < 1} onClick={() => addToCart(product, 'product_detail')}><ShoppingBag size={18} /> Add to bag</button>
        <div className="detail-benefits"><span><Truck /> Free delivery over $100</span><span><ShieldCheck /> Two-year warranty</span><span><PackageCheck /> 30-day returns</span></div>
      </div>
    </section>
    <section className="detail-story">
      <span className="kicker">DESIGNED FOR THE EVERYDAY</span>
      <h2>One useful thing.<br />No unnecessary noise.</h2>
      <p>{product.description} Selected to fit naturally into a connected setup, with dependable performance and a straightforward ownership experience.</p>
    </section>
    <section className="section detail-recommendations">
      <div className="section-heading"><div><span className="kicker"><Sparkles size={15} /> COMPLETE YOUR SETUP</span><h2>Works well with</h2></div><span className="model-pill"><span /> Hybrid model placeholder</span></div>
      <p className="section-note">Contextual suggestions for this product. Later, this ranking will combine association-rule lift with semantic similarity.</p>
      <div className="product-grid compact">{recommendations.map((item) => <ProductCard key={item.id} product={item} onAdd={(chosen) => addToCart(chosen, 'product_detail_recommendation')} />)}</div>
    </section>
  </main>;
}
