import { ArrowUpRight, Plus, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProductVisual from './ProductVisual';

export default function ProductCard({ product, onAdd, featured = false, searchQuery = '' }) {
  const productUrl = `/products/${product.id}${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`;
  return <article className={`product-card ${featured ? 'featured-card' : ''}`}>
    <Link className="product-link visual-link" to={productUrl} aria-label={`View ${product.name}`}><ProductVisual product={product} large={featured} /></Link>
    <div className="product-copy">
      <div className="eyebrow-row"><span>{product.category}</span><span className="rating"><Star size={13} fill="currentColor" /> {product.rating}</span></div>
      <h3><Link className="product-link" to={productUrl}>{product.name}</Link></h3>
      <p>{product.description}</p>
      {product.reason && <div className="recommendation-reason"><span>{product.source === "semantic" ? "SIMILAR PRODUCT" : "BOUGHT TOGETHER"}</span>{product.reason}</div>}
      <div className="product-bottom"><strong>${Number(product.price).toFixed(0)}</strong><button onClick={() => onAdd(product)}>{featured ? <>Explore <ArrowUpRight size={16} /></> : <><Plus size={17} /> Add</>}</button></div>
    </div>
  </article>;
}
