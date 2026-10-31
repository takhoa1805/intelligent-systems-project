import { useEffect, useState } from 'react';
import { ArrowLeft, Check, PackageCheck, ShieldCheck, ShoppingBag, Star, Truck } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import RecommendationShelf from '../components/RecommendationShelf';
import ProductVisual from '../components/ProductVisual';

export default function ProductDetail({ modelVersion, products, addToCart, offline }) {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const searchQuery = params.get('q') || '';
  const recommendationKind = params.get('recommendations') === 'similar' ? 'similar' : 'complementary';
  const selectRecommendations = (kind) => {
    const next = new URLSearchParams(params);
    next.set('recommendations', kind);
    setParams(next, { replace: true });
  };
  const [product, setProduct] = useState(() => products.find((item) => item.id === Number(id)));
  const [loading, setLoading] = useState(!product);

  useEffect(() => {
    window.scrollTo(0, 0);
    const localProduct = products.find((item) => item.id === Number(id));
    let canceled = false;
    setLoading(true);
    const loadProduct = offline ? Promise.resolve(localProduct) : api.product(id);
    loadProduct.then((item) => { if (!canceled) setProduct(item); })
      .catch(() => { if (!canceled) setProduct(null); })
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  }, [id, offline, products]);

  if (loading) return <main className="product-detail-page"><div className="detail-loading" /></main>;
  if (!product) return <main className="product-not-found"><h1>Product not found.</h1><Link to="/shop">Return to the collection</Link></main>;

  return <main className="product-detail-page">
    <nav className="product-breadcrumb" aria-label="Product location"><Link to={searchQuery ? `/shop?q=${encodeURIComponent(searchQuery)}` : '/shop'}><ArrowLeft size={14} /> {searchQuery ? `Search results for “${searchQuery}”` : 'Shop'}</Link><span>/</span><span>{product.name}</span></nav>
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
    <nav className="recommendation-tabs" aria-label="Product recommendations"><span>Recommendations for your product</span><div><button aria-pressed={recommendationKind === 'complementary'} onClick={() => selectRecommendations('complementary')}>Frequently bought together</button><button aria-pressed={recommendationKind === 'similar'} onClick={() => selectRecommendations('similar')}>Similar products</button></div></nav>
    <RecommendationShelf modelVersion={modelVersion} products={products} context={[product]} kind={recommendationKind} searchQuery={searchQuery} onAdd={addToCart} />
  </main>;
}
