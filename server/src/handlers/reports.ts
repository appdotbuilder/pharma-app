
import { db } from '../db';
import { 
  ordersTable, 
  orderItemsTable, 
  productsTable, 
  categoriesTable, 
  usersTable 
} from '../db/schema';
import { 
  eq, 
  and, 
  gte, 
  lte, 
  sum, 
  count, 
  desc, 
  asc,
  sql,
  isNull 
} from 'drizzle-orm';

export interface SalesReport {
  total_revenue: number;
  total_orders: number;
  total_products_sold: number;
  period: string;
  top_products: Array<{
    product_id: number;
    product_name: string;
    quantity_sold: number;
    revenue: number;
  }>;
}

export interface InventoryReport {
  total_products: number;
  low_stock_products: Array<{
    product_id: number;
    product_name: string;
    current_stock: number;
    category: string;
  }>;
  out_of_stock_products: Array<{
    product_id: number;
    product_name: string;
    category: string;
  }>;
}

export async function getSalesReport(startDate: Date, endDate: Date): Promise<SalesReport> {
  try {
    // Get total revenue and order count for the period
    const salesSummary = await db.select({
      total_revenue: sum(ordersTable.total_amount),
      total_orders: count(ordersTable.id)
    })
    .from(ordersTable)
    .where(
      and(
        gte(ordersTable.created_at, startDate),
        lte(ordersTable.created_at, endDate)
      )
    )
    .execute();

    // Get total products sold in the period
    const productsSold = await db.select({
      total_products_sold: sum(orderItemsTable.quantity)
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.order_id, ordersTable.id))
    .where(
      and(
        gte(ordersTable.created_at, startDate),
        lte(ordersTable.created_at, endDate)
      )
    )
    .execute();

    // Get top products by revenue
    const topProducts = await db.select({
      product_id: orderItemsTable.product_id,
      product_name: productsTable.name,
      quantity_sold: sum(orderItemsTable.quantity),
      revenue: sum(sql<string>`${orderItemsTable.unit_price} * ${orderItemsTable.quantity}`)
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.order_id, ordersTable.id))
    .innerJoin(productsTable, eq(orderItemsTable.product_id, productsTable.id))
    .where(
      and(
        gte(ordersTable.created_at, startDate),
        lte(ordersTable.created_at, endDate)
      )
    )
    .groupBy(orderItemsTable.product_id, productsTable.name)
    .orderBy(desc(sum(sql<string>`${orderItemsTable.unit_price} * ${orderItemsTable.quantity}`)))
    .limit(10)
    .execute();

    return {
      total_revenue: parseFloat(salesSummary[0]?.total_revenue || '0'),
      total_orders: salesSummary[0]?.total_orders || 0,
      total_products_sold: Number(productsSold[0]?.total_products_sold || 0),
      period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
      top_products: topProducts.map(product => ({
        product_id: product.product_id,
        product_name: product.product_name,
        quantity_sold: Number(product.quantity_sold || 0),
        revenue: parseFloat(product.revenue || '0')
      }))
    };
  } catch (error) {
    console.error('Sales report generation failed:', error);
    throw error;
  }
}

export async function getInventoryReport(): Promise<InventoryReport> {
  try {
    // Get total product count
    const totalProducts = await db.select({
      count: count(productsTable.id)
    })
    .from(productsTable)
    .where(eq(productsTable.is_active, true))
    .execute();

    // Get low stock products (stock <= 10)
    const lowStockProducts = await db.select({
      product_id: productsTable.id,
      product_name: productsTable.name,
      current_stock: productsTable.stock_quantity,
      category: categoriesTable.name
    })
    .from(productsTable)
    .innerJoin(categoriesTable, eq(productsTable.category_id, categoriesTable.id))
    .where(
      and(
        eq(productsTable.is_active, true),
        lte(productsTable.stock_quantity, 10),
        gte(productsTable.stock_quantity, 1)
      )
    )
    .orderBy(asc(productsTable.stock_quantity))
    .execute();

    // Get out of stock products (stock = 0)
    const outOfStockProducts = await db.select({
      product_id: productsTable.id,
      product_name: productsTable.name,
      category: categoriesTable.name
    })
    .from(productsTable)
    .innerJoin(categoriesTable, eq(productsTable.category_id, categoriesTable.id))
    .where(
      and(
        eq(productsTable.is_active, true),
        eq(productsTable.stock_quantity, 0)
      )
    )
    .orderBy(asc(productsTable.name))
    .execute();

    return {
      total_products: totalProducts[0]?.count || 0,
      low_stock_products: lowStockProducts.map(product => ({
        product_id: product.product_id,
        product_name: product.product_name,
        current_stock: product.current_stock,
        category: product.category
      })),
      out_of_stock_products: outOfStockProducts.map(product => ({
        product_id: product.product_id,
        product_name: product.product_name,
        category: product.category
      }))
    };
  } catch (error) {
    console.error('Inventory report generation failed:', error);
    throw error;
  }
}

export async function getCustomerReport(): Promise<{
  total_customers: number;
  new_customers_this_month: number;
  active_customers: number;
  customer_retention_rate: number;
}> {
  try {
    // Get total customer count
    const totalCustomers = await db.select({
      count: count(usersTable.id)
    })
    .from(usersTable)
    .where(eq(usersTable.role, 'customer'))
    .execute();

    // Get new customers this month
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    const newCustomersThisMonth = await db.select({
      count: count(usersTable.id)
    })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.role, 'customer'),
        gte(usersTable.created_at, startOfMonth)
      )
    )
    .execute();

    // Get active customers (customers who have placed orders in the last 3 months)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const activeCustomers = await db.selectDistinct({
      user_id: ordersTable.user_id
    })
    .from(ordersTable)
    .where(gte(ordersTable.created_at, threeMonthsAgo))
    .execute();

    // Calculate retention rate (active customers / total customers)
    const totalCustomerCount = totalCustomers[0]?.count || 0;
    const activeCustomerCount = activeCustomers.length;
    const retentionRate = totalCustomerCount > 0 
      ? (activeCustomerCount / totalCustomerCount) * 100 
      : 0;

    return {
      total_customers: totalCustomerCount,
      new_customers_this_month: newCustomersThisMonth[0]?.count || 0,
      active_customers: activeCustomerCount,
      customer_retention_rate: Math.round(retentionRate * 100) / 100 // Round to 2 decimal places
    };
  } catch (error) {
    console.error('Customer report generation failed:', error);
    throw error;
  }
}
