const API = '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'Something went wrong');
  return body;
}

export const api = {
  products: (params = {}) => request(`/products?${new URLSearchParams(params)}`),
  product: (id) => request(`/products/${id}`),
  categories: () => request('/categories'),
  recommendations: (productId, limit = 4) => request(`/recommendations?${new URLSearchParams({ productId: productId || '', limit })}`),
  checkout: (payload) => request('/orders', { method: 'POST', body: JSON.stringify(payload) }),
  event: (payload) => request('/events', { method: 'POST', body: JSON.stringify(payload) }),
  adminOverview: () => request('/admin/overview'),
  adminProducts: () => request('/admin/products'),
  addProduct: (payload) => request('/admin/products', { method: 'POST', body: JSON.stringify(payload) }),
  updateProduct: (id, payload) => request(`/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  removeProduct: (id) => request(`/admin/products/${id}`, { method: 'DELETE' }),
};
