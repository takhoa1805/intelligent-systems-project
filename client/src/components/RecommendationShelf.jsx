import { Sparkles } from 'lucide-react';
import ProductCard from './ProductCard';
import { recommendationsFor } from '../prototype/data';

export default function RecommendationShelf({ products, onAdd, context, kind = 'complementary', modelVersion, searchQuery = '' }) {
  const anchors = context || products.filter((p) => p.category_slug === 'phones').slice(0, 1);
  const result = recommendationsFor(anchors.length ? anchors : products.slice(0, 1), products);
  const items = result[kind];
  const similar = kind === 'similar';
  if (!items.length) return null;
  return <section className={`section recommendations ${similar ? 'similar-recommendations' : ''}`}>
    <div className="section-heading"><div><span className="kicker"><Sparkles size={15} /> {similar ? 'FIND YOUR FIT' : 'BETTER TOGETHER'}</span><h2>{similar ? 'Similar products' : 'Frequently bought together'}</h2></div><div className="model-pill"><span /> {modelVersion || 'hybrid-v0.2'} · preview</div></div>
    <p className="section-note">{context?.[0] ? `${similar ? 'Alternatives to' : 'Complete your'} ${context[0].name}${similar ? ', with related features and uses.' : ' setup.'}` : 'A few useful additions to complete your setup.'} Illustrative suggestions for this prototype.</p>
    <div className="product-grid compact">{items.map((p) => <ProductCard key={p.id} product={p} onAdd={onAdd} searchQuery={searchQuery} />)}</div>
  </section>;
}
