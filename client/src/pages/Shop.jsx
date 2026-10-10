import { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { api } from '../api';

const PAGE_SIZE = 24;
const SORTS = new Set(['featured', 'rating', 'low', 'high']);

export default function Shop({ products, categories, loading: catalogLoading, addToCart, offline }) {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const category = params.get('category') || 'all';
  const sort = SORTS.has(params.get('sort')) ? params.get('sort') : 'featured';
  const requestedPage = Number(params.get('page') || 1);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= 100000 ? requestedPage : 1;
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState(null);
  const requestKey = JSON.stringify([query, category, sort, page, retry]);

  // Preview mode has only the small mock catalog; live filtering stays on the server.
  const preview = useMemo(() => {
    if (!offline) return null;
    const q = query.toLowerCase();
    const filtered = products.filter((p) => (category === 'all' || p.category_slug === category) && (!q || `${p.name} ${p.description} ${(p.tags || []).join(' ')}`.toLowerCase().includes(q)));
    filtered.sort((a,b) => sort === 'low' ? a.price - b.price || a.id - b.id : sort === 'high' ? b.price - a.price || b.id - a.id : sort === 'rating' ? b.rating - a.rating || a.id - b.id : Number(b.featured) - Number(a.featured) || b.id - a.id);
    return {
      items: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      total: filtered.length, totalPages: Math.ceil(filtered.length / PAGE_SIZE),
    };
  }, [offline, products, category, query, sort, page]);

  useEffect(() => {
    if (offline || catalogLoading) return;
    const controller = new AbortController();
    api.products({ search: query, category, sort, page, pageSize: PAGE_SIZE }, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, error: error.message });
      });
    return () => controller.abort();
  }, [offline, catalogLoading, query, category, sort, page, requestKey]);

  const current = result?.key === requestKey ? result : null;
  const loading = catalogLoading || (!offline && !current);
  const error = !offline && current?.error;
  const data = offline ? preview : current?.data;
  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 0;

  const changeFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'all' || (key === 'sort' && value === 'featured')) next.delete(key);
    else next.set(key, value);
    next.delete('page');
    setParams(next);
  };
  const changePage = (nextPage) => {
    const next = new URLSearchParams(params);
    if (nextPage === 1) next.delete('page');
    else next.set('page', String(nextPage));
    setParams(next);
    window.scrollTo(0, 0);
  };

  return <main className="shop-page">
    <section className="shop-intro"><span className="kicker">THE COLLECTION</span><h1>Find your next <em>essential.</em></h1><p>Purposeful technology for work, play, travel, and everything in between.</p></section>
    <section className="catalog-toolbar">
      <div className="category-tabs"><button className={category === 'all' ? 'active' : ''} onClick={() => changeFilter('category', 'all')}>All</button>{categories.map((c) => <button key={c.id} className={category === c.slug ? 'active' : ''} onClick={() => changeFilter('category', c.slug)}>{c.name}</button>)}</div>
      <label className="sort-control"><SlidersHorizontal size={16} /><select value={sort} onChange={(e) => changeFilter('sort', e.target.value)}><option value="featured">Featured</option><option value="rating">Best rated</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></label>
    </section>
    {query && <div className="search-result"><Search size={17} /><span>Results for “{query}”</span><button onClick={() => changeFilter('q', '')}><X size={15} /> Clear</button></div>}
    <section className="section catalog-section" aria-busy={loading}>
      <div className="result-count" role="status">{loading ? 'Loading products…' : error ? 'Products could not be loaded.' : `${total.toLocaleString()} products${items.length ? ` · Showing ${((page - 1) * PAGE_SIZE + 1).toLocaleString()}–${((page - 1) * PAGE_SIZE + items.length).toLocaleString()}` : ''}`}</div>
      {loading ? <div className="loading-grid">{[1,2,3,4].map((x) => <div key={x} />)}</div> : error ? <div className="empty-search" role="alert"><h2>Unable to load products.</h2><p>{error}</p><button className="primary" onClick={() => setRetry((value) => value + 1)}>Try again</button></div> : items.length ? <div className="product-grid">{items.map((p) => <ProductCard key={p.id} product={p} onAdd={addToCart} />)}</div> : <div className="empty-search"><h2>{page > 1 ? 'No products on this page.' : 'No matches yet.'}</h2>{page > 1 ? <button className="primary" onClick={() => changePage(1)}>Go to first page</button> : <p>Try another phrase or browse all categories.</p>}</div>}
      {!loading && !error && totalPages > 1 && <nav className="catalog-pagination" aria-label="Product pagination">
        <button className="secondary" disabled={page <= 1} onClick={() => changePage(page - 1)}>Previous</button>
        <span>Page {page.toLocaleString()} of {totalPages.toLocaleString()}</span>
        <button className="primary" disabled={page >= totalPages} onClick={() => changePage(page + 1)}>Next</button>
      </nav>}
    </section>
  </main>;
}
