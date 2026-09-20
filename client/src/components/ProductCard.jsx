import { ArrowUpRight, Plus, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProductVisual from './ProductVisual';

export default function ProductCard({ product, onAdd, featured = false }) {
  return <article className={`product-card ${featured ? 'featured-card' : ''}`}>
    <Link className="product-link visual-link" to={`/products/${product.id}`} aria-label={`View ${product.name}`}><ProductVisual product={product} large={featured} /></Link>
    <div className="product-copy">
      <div className="eyebrow-row"><span>{product.category}</span><span className="rating"><Star size={13} fill="currentColor" /> {product.rating}</span></div>
      <h3><Link className="product-link" to={`/products/${product.id}`}>{product.name}</Link></h3>
      <p>{product.description}</p>
      <div className="product-bottom"><strong>${Number(product.price).toFixed(0)}</strong><button onClick={() => onAdd(product)}>{featured ? <>Explore <ArrowUpRight size={16} /></> : <><Plus size={17} /> Add</>}</button></div>
    </div>
  </article>;
}
