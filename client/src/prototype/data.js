import { mockProducts } from '../mockData.js';

// Deliberately illustrative data; no trained model or warehouse is claimed here.
export const previewProducts = [...mockProducts,
  { ...mockProducts[0], id: 10, name: 'Nova Lite Smartphone', price: 499, rating: 4.7, featured: false, description: 'An everyday OLED smartphone with a lightweight body and dependable all-day battery.' },
  { ...mockProducts[1], id: 11, name: 'Pulse Air Headphones', price: 179, rating: 4.6, featured: false, description: 'Lightweight wireless headphones with balanced sound and a comfortable travel-ready design.' },
  { ...mockProducts[2], id: 12, name: 'Arc Mini 30W Charger', price: 35, rating: 4.6, featured: false, description: 'Compact USB-C charging for your phone, headphones and everyday essentials.' },
  { ...mockProducts[0], id: 13, name: 'Nova Plus 5G Smartphone', price: 699, rating: 4.8, accent: '#1D4ED8', featured: false, description: 'A bright OLED smartphone with 5G connectivity, a sharp dual camera and all-day battery.', tags: ['phone', 'android', 'oled', '5g', 'camera'] },
  { ...mockProducts[0], id: 14, name: 'Nova Pro Smartphone', price: 999, rating: 4.9, accent: '#475569', featured: false, description: 'A premium OLED smartphone with a fast processor, pro camera controls and wireless charging.', tags: ['phone', 'android', 'oled', '5g', 'wireless charging'] },
  { ...mockProducts[0], id: 15, name: 'Nova Mini Smartphone', price: 399, rating: 4.6, accent: '#0F766E', featured: false, description: 'A compact Android smartphone with a clear display, reliable battery and a comfortable one-hand fit.', tags: ['phone', 'android', 'compact', 'battery'] },
].map((p) => ({ ...p, category_id: { phones: 1, audio: 2, power: 3, accessories: 4, 'smart-home': 5 }[p.category_slug] }));

const pairs = { 1: [4, 3, 7, 9], 2: [7, 5, 3], 3: [7, 9, 5], 4: [3, 9, 7], 5: [7, 3], 6: [5, 7], 7: [3, 5], 8: [6, 9], 9: [3, 7], 10: [4, 3, 7], 11: [7, 5], 12: [7, 9], 13: [4, 3, 7], 14: [4, 9, 3], 15: [3, 7, 5] };
export function recommendationsFor(context, catalog = previewProducts) {
  if (!context.length) return { complementary: [], similar: [] };
  const ids = new Set(context.map((p) => p.id));
  const available = catalog.filter((p) => !ids.has(p.id) && p.stock > 0 && p.active !== false);
  const ranked = new Map();
  for (const anchor of context) {
    // Curated associations apply only to the preview catalogue, never to Olist IDs.
    const curated = previewProducts.some((p) => p.id === anchor.id && p.name === anchor.name) ? pairs[anchor.id] || [] : [];
    for (const [rank, id] of curated.entries()) {
      const p = available.find((item) => item.id === id && previewProducts.some((seed) => seed.id === id && seed.name === item.name));
      if (p && !ranked.has(id)) ranked.set(id, { ...p, source: 'association', reason: `Pairs with ${anchor.name}`, weight: 10 - rank });
      else if (p) ranked.get(id).weight += 5;
    }
  }
  const complementary = [...ranked.values()].sort((a, b) => b.weight - a.weight || a.id - b.id);
  if (!complementary.length) for (const p of available.filter((p) => !context.some((a) => a.category_slug === p.category_slug)).slice(0, 4)) complementary.push({ ...p, source: 'curated', reason: 'A curated addition to your setup' });
  const similar = available.filter((p) => context.some((a) => a.category_slug === p.category_slug))
    .map((p) => ({ ...p, source: 'semantic', reason: `Shares features and uses with ${context.find((a) => a.category_slug === p.category_slug).name}` }));
  return { complementary: complementary.slice(0, 4), similar: similar.slice(0, 4) };
}

export const previewOrders = Array.from({ length: 48 }, (_, i) => {
  const choices = [[1, 4, 3], [2, 7], [3, 7, 5], [6, 5], [10, 12], [8, 9], [11, 7], [4, 9]];
  const items = choices[i % choices.length].map((id, n) => {
    const p = previewProducts.find((p) => p.id === id);
    const quantity = n === 1 && i % 5 === 0 ? 2 : 1;
    return { product_id: id, product_name: p.name, category: p.category, quantity, unit_price: p.price, accent: p.accent };
  });
  return {
    id: `sample-${i + 1}`, order_number: `SS-${String(1048 - i).padStart(6, '0')}`,
    customer_name: ['Alex Morgan', 'Mina Tran', 'Jamie Lee', 'Sam Taylor', 'Jordan Nguyen', 'Casey Chen'][i % 6],
    customer_email: `buyer${i + 1}@example.com`, status: i === 6 || i === 15 ? 'canceled' : i < 3 ? 'paid' : 'delivered',
    created_at: new Date(Date.UTC(2026, 9, 30 - i, 9 + i % 8, 15)).toISOString(), currency: 'USD',
    items, subtotal: items.reduce((s, p) => s + p.quantity * p.unit_price, 0), shipping_total: 0,
    total: items.reduce((s, p) => s + p.quantity * p.unit_price, 0),
  };
});

export function salesPreview(days = 7) {
  const end = Date.UTC(2026, 9, 31);
  const start = end - days * 86400000;
  const orders = previewOrders.filter((o) => Date.parse(o.created_at) >= start && Date.parse(o.created_at) < end && o.status !== 'canceled');
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const categoryTotals = new Map(), productTotals = new Map();
  for (const o of orders) for (const p of o.items) {
    categoryTotals.set(p.category, (categoryTotals.get(p.category) || 0) + p.quantity * p.unit_price);
    const before = productTotals.get(p.product_id) || { name: p.product_name, units: 0, revenue: 0 };
    before.units += p.quantity; before.revenue += p.quantity * p.unit_price; productTotals.set(p.product_id, before);
  }
  return {
    summary: { revenue, orders: orders.length, customers: new Set(orders.map((o) => o.customer_name)).size, average_order: orders.length ? revenue / orders.length : 0 },
    trend: Array.from({ length: days }, (_, i) => {
      const date = new Date(start + i * 86400000);
      return { label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }), revenue: orders.filter((o) => o.created_at.slice(0, 10) === date.toISOString().slice(0, 10)).reduce((s, o) => s + o.total, 0) };
    }),
    categories: [...categoryTotals].map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue),
    topProducts: [...productTotals.values()].sort((a, b) => b.units - a.units).slice(0, 5), recentOrders: orders.slice(0, 6),
  };
}

export const initialModels = [
  { version: 'hybrid-v0.3', status: 'evaluated', dataset: 'catalogue-snapshot-03', trained: '30 Oct 2026, 09:42', precision: 0.29, recall: 0.52, coverage: 0.75, relevance: 0.85 },
  { version: 'hybrid-v0.2', status: 'published', dataset: 'catalogue-snapshot-02', trained: '28 Oct 2026, 14:20', precision: 0.26, recall: 0.47, coverage: 0.67, relevance: 0.80 },
  { version: 'hybrid-v0.1', status: 'draft', dataset: 'catalogue-snapshot-01', trained: '25 Oct 2026, 11:05' },
];
export function initialLabState() {
  try { const value = JSON.parse(localStorage.getItem('signal-prototype-models')); if (value?.models?.length && value.models.some((m) => m.version === value.active && m.status === 'published')) return value; } catch { /* Restore the sample if local state is invalid. */ }
  return { models: initialModels, active: 'hybrid-v0.2' };
}
export const money = (value, currency = 'USD') => value == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
export const displayDate = (value) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
