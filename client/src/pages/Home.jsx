import { ArrowRight, Box, BrainCircuit, ShieldCheck, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import ProductVisual from '../components/ProductVisual';
import RecommendationShelf from '../components/RecommendationShelf';

export default function Home({ products, loading, addToCart }) {
  const hero = products[0];
  const featured = products.filter((p) => p.featured).slice(0, 3);
  return <main>
    <section className="hero">
      <div className="hero-copy">
        <span className="kicker">TECH THAT FITS YOUR LIFE</span>
        <h1>Less noise.<br /><em>Better gear.</em></h1>
        <p>A considered collection of everyday technology — useful, reliable, and selected to work beautifully together.</p>
        <div className="hero-actions"><Link className="primary" to="/shop">Shop the collection <ArrowRight size={18} /></Link><a href="#recommended" className="secondary">See what fits</a></div>
        <div className="trust-row"><span><Truck size={18} /> Free delivery over $100</span><span><ShieldCheck size={18} /> 2-year warranty</span></div>
      </div>
      <div className="hero-art">
        {hero && <><ProductVisual product={hero} large /><div className="hero-product"><span>THIS WEEK'S PICK</span><strong>{hero.name}</strong><small>From ${hero.price}</small></div></>}
        <div className="signal-lines"><i /><i /><i /><i /></div>
      </div>
    </section>

    <section className="section">
      <div className="section-heading"><div><span className="kicker">EDITOR'S CHOICE</span><h2>Built to earn its place</h2></div><Link to="/shop">View all products <ArrowRight size={17} /></Link></div>
      {loading ? <div className="loading-grid">{[1,2,3].map((x) => <div key={x} />)}</div> : <div className="featured-grid">{featured.map((p, i) => <ProductCard key={p.id} product={p} onAdd={addToCart} featured={i === 0} />)}</div>}
    </section>

    <section className="manifesto">
      <div><span className="kicker">WHY SIGNAL</span><h2>Technology should feel <em>clear.</em></h2></div>
      <div className="principles">
        <article><Box /><h3>Curated, not crowded</h3><p>Fewer, better choices. Every product has a reason to be here.</p></article>
        <article><BrainCircuit /><h3>Smarter discovery</h3><p>Recommendations designed to be relevant, explainable, and genuinely useful.</p></article>
        <article><ShieldCheck /><h3>Confident ownership</h3><p>Clear details, dependable support, and no confusing fine print.</p></article>
      </div>
    </section>

    <div id="recommended"><RecommendationShelf products={products} onAdd={addToCart} /></div>
    <footer><div className="brand">SIGNAL</div><p>Useful technology, thoughtfully connected.</p><span>© 2026 Signal Shop · Intelligent Systems Lab</span></footer>
  </main>;
}
