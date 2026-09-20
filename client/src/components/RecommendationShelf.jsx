import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api } from '../api';
import { mockProducts } from '../mockData';
import ProductCard from './ProductCard';

export default function RecommendationShelf({ products, onAdd }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api.recommendations('', 4).then((r) => setItems(r.items)).catch(() => setItems((products.length ? products : mockProducts).slice(1, 5)));
  }, [products]);
  return <section className="section recommendations">
    <div className="section-heading">
      <div><span className="kicker"><Sparkles size={15} /> RECOMMENDATION PREVIEW</span><h2>Picked for your setup</h2></div>
      <div className="model-pill"><span /> Hybrid model placeholder</div>
    </div>
    <p className="section-note">This shelf is ready for your association-rule and word-embedding pipeline. It currently uses a deterministic category and popularity fallback.</p>
    <div className="product-grid compact">{items.map((p) => <ProductCard key={p.id} product={p} onAdd={onAdd} />)}</div>
  </section>;
}
