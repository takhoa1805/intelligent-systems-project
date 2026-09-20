export interface AdminSummaryDto {
  revenue: number;
  orders: number;
  customers: number;
  average_order: number;
}

export interface RevenuePointDto { label: string; revenue: number }
export interface CategoryRevenueDto { name: string; revenue: number }
export interface ProductPerformanceDto { name: string; units: number; revenue: number }
export interface RecentOrderDto {
  order_number: string;
  customer_name: string;
  total: number;
  status: string;
  created_at: Date;
}

export interface AdminOverviewDto {
  summary: AdminSummaryDto;
  trend: RevenuePointDto[];
  categories: CategoryRevenueDto[];
  topProducts: ProductPerformanceDto[];
  recentOrders: RecentOrderDto[];
}
