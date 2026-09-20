import { db } from '../../config/database.js';
import type { AdminOverviewDto, ProductPerformanceDto } from './admin.dto.js';

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

  const [aggregate, customers, recentRevenueOrders, categories, orderItems, recentOrders] = await Promise.all([
    db.order.aggregate({
      where: { status: { not: 'cancelled' } },
      _sum: { total: true },
      _avg: { total: true },
      _count: { id: true },
    }),
    db.order.findMany({
      where: { status: { not: 'cancelled' } },
      distinct: ['customerEmail'],
      select: { customerEmail: true },
    }),
    db.order.findMany({
      where: { status: { not: 'cancelled' }, createdAt: { gte: firstDay } },
      select: { total: true, createdAt: true },
    }),
    db.category.findMany({ select: { id: true, name: true } }),
    db.orderItem.findMany({
      select: {
        quantity: true,
        unitPrice: true,
        product: { select: { id: true, name: true, categoryId: true } },
      },
    }),
    db.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { orderNumber: true, customerName: true, total: true, status: true, createdAt: true },
    }),
  ]);

  const dailyRevenue = new Map<string, number>();
  for (const order of recentRevenueOrders) {
    const key = dayKey(order.createdAt);
    dailyRevenue.set(key, (dailyRevenue.get(key) || 0) + Number(order.total));
  }
  const trend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(firstDay);
    date.setUTCDate(date.getUTCDate() + index);
    return { label: dayLabel(date), revenue: dailyRevenue.get(dayKey(date)) || 0 };
  });

  const categoryRevenue = new Map<number, number>(categories.map((category) => [category.id, 0]));
  const productPerformance = new Map<number, ProductPerformanceDto>();
  for (const item of orderItems) {
    if (!item.product) continue;
    const revenue = item.quantity * Number(item.unitPrice);
    categoryRevenue.set(item.product.categoryId, (categoryRevenue.get(item.product.categoryId) || 0) + revenue);
    const current = productPerformance.get(item.product.id) || { name: item.product.name, units: 0, revenue: 0 };
    current.units += item.quantity;
    current.revenue += revenue;
    productPerformance.set(item.product.id, current);
  }

  return {
    summary: {
      revenue: Number(aggregate._sum.total || 0),
      orders: aggregate._count.id,
      customers: customers.length,
      average_order: Number(aggregate._avg.total || 0),
    },
    trend,
    categories: categories
      .map((category) => ({ name: category.name, revenue: categoryRevenue.get(category.id) || 0 }))
      .sort((a, b) => b.revenue - a.revenue),
    topProducts: [...productPerformance.values()]
      .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
      .slice(0, 5),
    recentOrders: recentOrders.map((order) => ({
      order_number: order.orderNumber,
      customer_name: order.customerName,
      total: Number(order.total),
      status: order.status,
      created_at: order.createdAt,
    })),
  };
}
