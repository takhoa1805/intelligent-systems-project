import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/config/database.js';
import type { ProductDto, ProductPageDto } from '../src/modules/products/product.dto.js';
import type { AdminOverviewDto } from '../src/modules/admin/admin.dto.js';

const base = process.env.CATALOG_TEST_URL || 'http://localhost:4000';
async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${base}/api${path}`);
  assert.equal(response.status, 200, path);
  return response.json() as Promise<T>;
}
function sorted(items: ProductDto[], compare: (a: ProductDto, b: ProductDto) => number) {
  for (let i = 1; i < items.length; i++) assert.ok(compare(items[i - 1]!, items[i]!) <= 0);
}
after(() => db.$disconnect());

for (const endpoint of ['/products', '/admin/products']) {
  test(`${endpoint}: bounded pages, stable ordering and filter totals`, async () => {
    const total = await db.product.count({ where: { active: true } });
    assert.ok(total >= 5, 'Start a seeded local database before running these checks.');
    const initial = await get<ProductPageDto>(endpoint);
    assert.equal(initial.total, total);
    assert.equal(initial.items.length, Math.min(24, total));
    assert.equal(initial.page, 1);
    assert.equal(initial.pageSize, 24);
    assert.equal(initial.totalPages, Math.ceil(total / 24));
    for (const [sort, compare] of [
      ['low', (a: ProductDto, b: ProductDto) => a.price - b.price || a.id - b.id],
      ['high', (a: ProductDto, b: ProductDto) => b.price - a.price || b.id - a.id],
      ['rating', (a: ProductDto, b: ProductDto) => b.rating - a.rating || a.id - b.id],
    ] as const) {
      const first = await get<ProductPageDto>(`${endpoint}?pageSize=3&sort=${sort}`);
      const second = await get<ProductPageDto>(`${endpoint}?page=2&pageSize=3&sort=${sort}`);
      assert.equal(new Set([...first.items, ...second.items].map((p) => p.id)).size, first.items.length + second.items.length);
      sorted([...first.items, ...second.items], compare);
      assert.deepEqual((await get<ProductPageDto>(`${endpoint}?pageSize=3&sort=${sort}`)).items.map((p) => p.id), first.items.map((p) => p.id));
    }
    const category = initial.items[0]!.category_slug!;
    const filtered = await get<ProductPageDto>(`${endpoint}?category=${encodeURIComponent(category)}`);
    assert.equal(filtered.total, await db.product.count({ where: { active: true, category: { slug: category } } }));
    assert.ok(filtered.items.every((p) => p.category_slug === category));
    const featured = await get<ProductPageDto>(`${endpoint}?featured=true`);
    assert.equal(featured.total, await db.product.count({ where: { active: true, featured: true } }));
    assert.ok(featured.items.every((p) => p.featured));
    const search = initial.items[0]!.name;
    const matches = await get<ProductPageDto>(`${endpoint}?search=${encodeURIComponent(search)}`);
    assert.ok(matches.items.some((p) => p.id === initial.items[0]!.id));
    const empty = await get<ProductPageDto>(`${endpoint}?category=__nonexistent_category__`);
    assert.equal(empty.total, 0);
    assert.equal(empty.totalPages, 0);
    assert.deepEqual(empty.items, []);
    const outside = await get<ProductPageDto>(`${endpoint}?page=100000`);
    assert.equal(outside.total, total);
    assert.deepEqual(outside.items, []);
  });

  test(`${endpoint}: rejects unsafe page sizes and malformed filters`, async () => {
    for (const query of ['pageSize=61', 'pageSize=0', 'page=0', 'page=-1', 'page=1.5', 'page=100001', 'page=1&page=2', 'sort=invalid', 'featured=invalid', `search=${'x'.repeat(201)}`]) {
      const response = await fetch(`${base}/api${endpoint}?${query}`);
      assert.equal(response.status, 400, query);
    }
    assert.equal((await get<ProductPageDto>(`${endpoint}?pageSize=60`)).items.length, Math.min(60, await db.product.count({where:{active:true}})));
  });
}

test('recommendations preserve category priority, score order and bounded unique results', async () => {
  const anchor = (await get<ProductPageDto>('/products')).items[0]!;
  const categoryCount = await db.product.count({where:{active:true,categoryId:anchor.category_id,id:{not:anchor.id}}});
  const { items } = await get<{items:(ProductDto & {score:number})[]}>(`/recommendations?productId=${anchor.id}&limit=4`);
  assert.ok(items.length <= 4);
  assert.equal(new Set(items.map((p) => p.id)).size, items.length);
  assert.ok(items.every((p) => p.id !== anchor.id && p.active));
  assert.equal(items.filter((p) => p.category_id === anchor.category_id).length, Math.min(4,categoryCount));
  for (let i=1;i<items.length;i++) assert.ok(items[i-1]!.score >= items[i]!.score);
});

test('Admin aggregates reconcile with order records and historical line items', async () => {
  const overview = await get<AdminOverviewDto>('/admin/overview');
  const aggregate = await db.order.aggregate({where:{status:{not:'cancelled'}},_sum:{total:true},_avg:{total:true},_count:{id:true}});
  assert.equal(overview.summary.orders, aggregate._count.id);
  assert.equal(overview.summary.revenue, Number(aggregate._sum.total || 0));
  assert.equal(overview.summary.average_order, Number(aggregate._avg.total || 0));
  // An independent row-based oracle runs only in this test, never in the dashboard API.
  const orders = await db.order.findMany({where:{status:{not:'cancelled'}},select:{customerId:true,customerEmail:true}});
  const identities = new Set(orders.map((o)=>o.customerId ? `id:${o.customerId}` : o.customerEmail ? `email:${o.customerEmail}` : null).filter((key)=>key !== null));
  assert.equal(overview.summary.customers,identities.size);
  const categories = await db.category.findMany({select:{id:true,name:true}});
  const lines = await db.orderItem.findMany({select:{quantity:true,unitPrice:true,product:{select:{id:true,name:true,categoryId:true}}}});
  const categoryCents = new Map(categories.map((c)=>[c.id,0]));
  const performance = new Map<number,{id:number;name:string;units:number;cents:number}>();
  for(const line of lines) {
    if(!line.product) continue;
    const cents = line.quantity * Math.round(Number(line.unitPrice)*100);
    categoryCents.set(line.product.categoryId,categoryCents.get(line.product.categoryId)!+cents);
    const product = performance.get(line.product.id) || {id:line.product.id,name:line.product.name,units:0,cents:0};
    product.units += line.quantity; product.cents += cents;
    performance.set(product.id,product);
  }
  assert.deepEqual(overview.categories,categories.map((c)=>({...c,cents:categoryCents.get(c.id)!})).sort((a,b)=>b.cents-a.cents||a.id-b.id).slice(0,5).map((c)=>({name:c.name,revenue:c.cents/100})));
  assert.deepEqual(overview.topProducts,[...performance.values()].sort((a,b)=>b.units-a.units||b.cents-a.cents||a.id-b.id).slice(0,5).map((p)=>({name:p.name,units:p.units,revenue:p.cents/100})));
  assert.equal(overview.trend.length,7);
  const firstDay = new Date(); firstDay.setUTCHours(0,0,0,0); firstDay.setUTCDate(firstDay.getUTCDate()-6);
  const recent = await db.order.findMany({where:{status:{not:'cancelled'},createdAt:{gte:firstDay}},select:{createdAt:true,total:true}});
  const dayTotals = new Map<string,number>();
  for(const order of recent) { const day=order.createdAt.toISOString().slice(0,10); dayTotals.set(day,(dayTotals.get(day)||0)+Math.round(Number(order.total||0)*100)); }
  for(let i=0;i<7;i++) { const day=new Date(firstDay); day.setUTCDate(day.getUTCDate()+i); assert.equal(overview.trend[i]!.revenue,(dayTotals.get(day.toISOString().slice(0,10))||0)/100); }
  assert.ok(overview.recentOrders.length<=6);
  for(let i=1;i<overview.recentOrders.length;i++) assert.ok(new Date(overview.recentOrders[i-1]!.created_at) >= new Date(overview.recentOrders[i]!.created_at));
});
