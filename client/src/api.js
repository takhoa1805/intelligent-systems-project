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
  products: (params = {}, options = {}) => request(`/products?${new URLSearchParams(params)}`, options),
  product: (id) => request(`/products/${id}`),
  categories: () => request('/categories'),
  recommendations: (productId, limit = 4) => request(`/recommendations?${new URLSearchParams({ productId: productId || '', limit })}`),
  checkout: (payload) => request('/orders', { method: 'POST', body: JSON.stringify(payload) }),
  event: (payload) => request('/events', { method: 'POST', body: JSON.stringify(payload) }),
  adminOverview: (options = {}) => request('/admin/overview', options),
  adminProducts: (params = {}, options = {}) => request(`/admin/products?${new URLSearchParams(params)}`, options),
  addProduct: (payload) => request('/admin/products', { method: 'POST', body: JSON.stringify(payload) }),
  updateProduct: (id, payload) => request(`/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  removeProduct: (id) => request(`/admin/products/${id}`, { method: 'DELETE' }),
};
