import { Plus, Sparkles } from 'lucide-react';
import ProductVisual from './ProductVisual';
import { recommendationsFor } from '../prototype/data';

export default function CartRecommendations({ cart, products, addToCart }) {
  if (!cart.length) return null;
  const { complementary, similar } = recommendationsFor(cart, products);
  const recommendations = (complementary.length ? complementary : similar).slice(0, 2);
  if (!recommendations.length) return null;
  return <section className="cart-recommendations"><div className="cart-rec-heading"><span><Sparkles size={14} /> COMPLETE YOUR BASKET</span><small>Illustrative suggestions</small></div><div className="cart-rec-list">{recommendations.map((product) => <article key={product.id}><ProductVisual product={product} /><div><strong>{product.name}</strong><small>{product.reason}</small><small>${Number(product.price).toFixed(0)}</small></div><button type="button" aria-label={`Add ${product.name}`} onClick={() => addToCart(product, 'cart_recommendation')}><Plus size={16} /></button></article>)}</div></section>;
}
