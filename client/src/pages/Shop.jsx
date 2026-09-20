import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';

export default function Shop({ products, categories, loading, addToCart }) {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('featured');
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const result = products.filter((p) => (category === 'all' || p.category_slug === category) && (!q || `${p.name} ${p.description} ${(p.tags || []).join(' ')}`.toLowerCase().includes(q)));
    return [...result].sort((a,b) => sort === 'low' ? a.price - b.price : sort === 'high' ? b.price - a.price : sort === 'rating' ? b.rating - a.rating : Number(b.featured) - Number(a.featured));
  }, [products, category, query, sort]);

  return <main className="shop-page">
    <section className="shop-intro"><span className="kicker">THE COLLECTION</span><h1>Find your next <em>essential.</em></h1><p>Purposeful technology for work, play, travel, and everything in between.</p></section>
    <section className="catalog-toolbar">
      <div className="category-tabs"><button className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>All</button>{categories.map((c) => <button key={c.id} className={category === c.slug ? 'active' : ''} onClick={() => setCategory(c.slug)}>{c.name}</button>)}</div>
      <label className="sort-control"><SlidersHorizontal size={16} /><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="featured">Featured</option><option value="rating">Best rated</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></label>
    </section>
    {query && <div className="search-result"><Search size={17} /><span>Results for “{query}”</span><button onClick={() => setParams({})}><X size={15} /> Clear</button></div>}
    <section className="section catalog-section">
      <div className="result-count">{filtered.length} products</div>
      {loading ? <div className="loading-grid">{[1,2,3,4].map((x) => <div key={x} />)}</div> : filtered.length ? <div className="product-grid">{filtered.map((p) => <ProductCard key={p.id} product={p} onAdd={addToCart} />)}</div> : <div className="empty-search"><h2>No matches yet.</h2><p>Try another phrase or browse all categories.</p></div>}
    </section>
  </main>;
}
