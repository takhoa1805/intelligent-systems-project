import { useEffect, useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { api } from '../api';
import ProductVisual from './ProductVisual';

export default function CartRecommendations({ anchorProductId, cart, products, addToCart, offline }) {
  const [recommendations, setRecommendations] = useState([]);
  const cartIds = cart.map((item) => item.id).join(',');

  useEffect(() => {
    if (!cart.length) return setRecommendations([]);
    const fallback = () => setRecommendations(
      products.filter((product) => !cart.some((item) => item.id === product.id)).slice(0, 2),
    );
    if (offline) return fallback();
    api.recommendations(anchorProductId || cart.at(-1)?.id, 6)
      .then(({ items }) => setRecommendations(items.filter((product) => !cart.some((item) => item.id === product.id)).slice(0, 2)))
      .catch(fallback);
  }, [anchorProductId, cartIds, offline, products]);

  if (!recommendations.length) return null;

  return <section className="cart-recommendations">
    <div className="cart-rec-heading"><span><Sparkles size={14} /> COMPLETE THE SETUP</span><small>Recommendation preview</small></div>
    <div className="cart-rec-list">
      {recommendations.map((product) => <article key={product.id}>
        <ProductVisual product={product} />
        <div><strong>{product.name}</strong><small>{product.category} · ${Number(product.price).toFixed(0)}</small></div>
        <button type="button" aria-label={`Add ${product.name}`} onClick={() => addToCart(product, 'cart_recommendation')}><Plus size={16} /></button>
      </article>)}
    </div>
  </section>;
}
