import { db } from '../../config/database.js';
import type { AdminOverviewDto } from './admin.dto.js';

type NumericSummary = { revenue: string; orders: string; customers: string; average_order: string };
type DailyRevenue = { day: string; revenue: string };
type CategoryRevenue = { name: string; revenue: string };
type ProductPerformance = { name: string; units: string; revenue: string };

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: '2-digit', timeZone: 'UTC',
  }).format(date);
}

export async function getOverview(): Promise<AdminOverviewDto> {
  const today = startOfUtcDay(new Date());
  const firstDay = new Date(today);
  firstDay.setUTCDate(firstDay.getUTCDate() - 6);
  const nextDay = new Date(today);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  // Aggregate inside PostgreSQL: no full order/customer/item arrays cross into Node.
  // Numeric SQL results are text so Decimal/BigInt never escape into the JSON API.
  const [summaries, daily, categories, topProducts, recentOrders] = await Promise.all([
    db.$queryRaw<NumericSummary[]>`
      SELECT COALESCE(SUM(total), 0)::text AS revenue,
             COUNT(*)::text AS orders,
             COUNT(DISTINCT COALESCE('id:' || customer_id, 'email:' || customer_email))::text AS customers,
             COALESCE(AVG(total), 0)::text AS average_order
      FROM orders WHERE status <> 'cancelled'
    `,
    db.$queryRaw<DailyRevenue[]>`
      SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
             COALESCE(SUM(total), 0)::text AS revenue
      FROM orders
      WHERE status <> 'cancelled' AND created_at >= ${firstDay} AND created_at < ${nextDay}
      GROUP BY 1
    `,
    db.$queryRaw<CategoryRevenue[]>`
      SELECT c.name, COALESCE(SUM(i.quantity * i.unit_price), 0)::text AS revenue
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      LEFT JOIN order_items i ON i.product_id = p.id
      GROUP BY c.id, c.name
      ORDER BY COALESCE(SUM(i.quantity * i.unit_price), 0) DESC, c.id
      LIMIT 5
    `,
    db.$queryRaw<ProductPerformance[]>`
      SELECT p.name, SUM(i.quantity)::text AS units,
             SUM(i.quantity * i.unit_price)::text AS revenue
      FROM order_items i JOIN products p ON p.id = i.product_id
      GROUP BY p.id, p.name
      ORDER BY SUM(i.quantity) DESC, SUM(i.quantity * i.unit_price) DESC, p.id
      LIMIT 5
    `,
    db.order.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 6,
      select: { orderNumber: true, customerName: true, total: true, status: true, createdAt: true },
    }),
  ]);

  const dailyRevenue = new Map(daily.map((row) => [row.day, Number(row.revenue)]));
  const trend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(firstDay);
    date.setUTCDate(date.getUTCDate() + index);
    return { label: dayLabel(date), revenue: dailyRevenue.get(dayKey(date)) || 0 };
  });
  const summary = summaries[0] || { revenue: '0', orders: '0', customers: '0', average_order: '0' };
  return {
    summary: {
      revenue: Number(summary.revenue), orders: Number(summary.orders),
      customers: Number(summary.customers), average_order: Number(summary.average_order),
    },
    trend,
    categories: categories.map((row) => ({ name: row.name, revenue: Number(row.revenue) })),
    topProducts: topProducts.map((row) => ({ name: row.name, units: Number(row.units), revenue: Number(row.revenue) })),
    recentOrders: recentOrders.map((order) => ({
      order_number: order.orderNumber, customer_name: order.customerName,
      total: Number(order.total), status: order.status, created_at: order.createdAt,
    })),
  };
}
