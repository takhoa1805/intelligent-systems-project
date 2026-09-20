import { query } from '../../config/database.js';

export async function getOverview() {
  const [summary, trend, categories, topProducts, recentOrders] = await Promise.all([
    query(`SELECT COALESCE(SUM(total), 0)::float AS revenue,
      COUNT(*)::int AS orders, COUNT(DISTINCT customer_email)::int AS customers,
      COALESCE(AVG(total), 0)::float AS average_order
      FROM orders WHERE status <> 'cancelled'`),
    query(`SELECT TO_CHAR(day, 'Mon DD') AS label, COALESCE(SUM(o.total), 0)::float AS revenue
      FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') day
      LEFT JOIN orders o ON o.created_at::date = day::date AND o.status <> 'cancelled'
      GROUP BY day ORDER BY day`),
    query(`SELECT c.name, COALESCE(SUM(oi.quantity * oi.unit_price), 0)::float AS revenue
      FROM categories c LEFT JOIN products p ON p.category_id = c.id
      LEFT JOIN order_items oi ON oi.product_id = p.id GROUP BY c.id ORDER BY revenue DESC`),
    query(`SELECT p.name, SUM(oi.quantity)::int AS units,
      SUM(oi.quantity * oi.unit_price)::float AS revenue
      FROM order_items oi JOIN products p ON p.id = oi.product_id
      GROUP BY p.id ORDER BY units DESC, revenue DESC LIMIT 5`),
    query(`SELECT order_number, customer_name, total::float, status, created_at
      FROM orders ORDER BY created_at DESC LIMIT 6`),
  ]);
  return {
    summary: summary.rows[0],
    trend: trend.rows,
    categories: categories.rows,
    topProducts: topProducts.rows,
    recentOrders: recentOrders.rows,
  };
}
