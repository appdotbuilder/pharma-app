
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  categoriesTable, 
  productsTable, 
  ordersTable, 
  orderItemsTable 
} from '../db/schema';
import { getSalesReport, getInventoryReport, getCustomerReport } from '../handlers/reports';

describe('Reports', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getSalesReport', () => {
    it('should generate sales report with basic data', async () => {
      // Create test data
      const user = await db.insert(usersTable).values({
        email: 'customer@test.com',
        password_hash: 'hash123',
        first_name: 'John',
        last_name: 'Doe',
        role: 'customer'
      }).returning().execute();

      const category = await db.insert(categoriesTable).values({
        name: 'Pain Relief',
        is_prescription_required: false
      }).returning().execute();

      const product = await db.insert(productsTable).values({
        name: 'Aspirin',
        manufacturer: 'PharmaCorp',
        price: '10.99',
        stock_quantity: 100,
        category_id: category[0].id,
        requires_prescription: false
      }).returning().execute();

      const order = await db.insert(ordersTable).values({
        user_id: user[0].id,
        total_amount: '21.98',
        payment_method: 'credit_card',
        delivery_method: 'standard',
        delivery_address: '123 Main St',
        delivery_phone: '555-0123'
      }).returning().execute();

      await db.insert(orderItemsTable).values({
        order_id: order[0].id,
        product_id: product[0].id,
        quantity: 2,
        unit_price: '10.99'
      }).execute();

      // Test report generation
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);

      const report = await getSalesReport(startDate, endDate);

      expect(report.total_revenue).toBe(21.98);
      expect(report.total_orders).toBe(1);
      expect(report.total_products_sold).toBe(2);
      expect(report.period).toContain(startDate.toISOString());
      expect(report.top_products).toHaveLength(1);
      expect(report.top_products[0].product_name).toBe('Aspirin');
      expect(report.top_products[0].quantity_sold).toBe(2);
      expect(report.top_products[0].revenue).toBe(21.98);
      expect(typeof report.top_products[0].quantity_sold).toBe('number');
      expect(typeof report.top_products[0].revenue).toBe('number');
    });

    it('should return zero values for empty date range', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateEnd = new Date(futureDate);
      futureDateEnd.setDate(futureDateEnd.getDate() + 1);

      const report = await getSalesReport(futureDate, futureDateEnd);

      expect(report.total_revenue).toBe(0);
      expect(report.total_orders).toBe(0);
      expect(report.total_products_sold).toBe(0);
      expect(report.top_products).toHaveLength(0);
    });

    it('should rank top products by revenue correctly', async () => {
      // Create test data with multiple products
      const user = await db.insert(usersTable).values({
        email: 'customer@test.com',
        password_hash: 'hash123',
        first_name: 'John',
        last_name: 'Doe',
        role: 'customer'
      }).returning().execute();

      const category = await db.insert(categoriesTable).values({
        name: 'Medicine',
        is_prescription_required: false
      }).returning().execute();

      const products = await db.insert(productsTable).values([
        {
          name: 'Product A',
          manufacturer: 'PharmaCorp',
          price: '5.00',
          stock_quantity: 100,
          category_id: category[0].id,
          requires_prescription: false
        },
        {
          name: 'Product B',
          manufacturer: 'PharmaCorp',
          price: '15.00',
          stock_quantity: 100,
          category_id: category[0].id,
          requires_prescription: false
        }
      ]).returning().execute();

      const order = await db.insert(ordersTable).values({
        user_id: user[0].id,
        total_amount: '35.00',
        payment_method: 'credit_card',
        delivery_method: 'standard',
        delivery_address: '123 Main St',
        delivery_phone: '555-0123'
      }).returning().execute();

      // Product A: 2 units * $5 = $10
      // Product B: 1 unit * $15 = $15 (should rank higher)
      await db.insert(orderItemsTable).values([
        {
          order_id: order[0].id,
          product_id: products[0].id,
          quantity: 2,
          unit_price: '5.00'
        },
        {
          order_id: order[0].id,
          product_id: products[1].id,
          quantity: 1,
          unit_price: '15.00'
        }
      ]).execute();

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);

      const report = await getSalesReport(startDate, endDate);

      expect(report.top_products).toHaveLength(2);
      expect(report.top_products[0].product_name).toBe('Product B');
      expect(report.top_products[0].revenue).toBe(15);
      expect(report.top_products[1].product_name).toBe('Product A');
      expect(report.top_products[1].revenue).toBe(10);
    });
  });

  describe('getInventoryReport', () => {
    it('should generate inventory report with stock levels', async () => {
      // Create test data
      const category = await db.insert(categoriesTable).values({
        name: 'Medicine',
        is_prescription_required: false
      }).returning().execute();

      await db.insert(productsTable).values([
        {
          name: 'Low Stock Product',
          manufacturer: 'PharmaCorp',
          price: '10.99',
          stock_quantity: 5, // Low stock
          category_id: category[0].id,
          requires_prescription: false
        },
        {
          name: 'Out of Stock Product',
          manufacturer: 'PharmaCorp',
          price: '15.99',
          stock_quantity: 0, // Out of stock
          category_id: category[0].id,
          requires_prescription: false
        },
        {
          name: 'Normal Stock Product',
          manufacturer: 'PharmaCorp',
          price: '20.99',
          stock_quantity: 50, // Normal stock
          category_id: category[0].id,
          requires_prescription: false
        }
      ]).execute();

      const report = await getInventoryReport();

      expect(report.total_products).toBe(3);
      expect(report.low_stock_products).toHaveLength(1);
      expect(report.low_stock_products[0].product_name).toBe('Low Stock Product');
      expect(report.low_stock_products[0].current_stock).toBe(5);
      expect(report.out_of_stock_products).toHaveLength(1);
      expect(report.out_of_stock_products[0].product_name).toBe('Out of Stock Product');
    });

    it('should exclude inactive products from inventory report', async () => {
      const category = await db.insert(categoriesTable).values({
        name: 'Medicine',
        is_prescription_required: false
      }).returning().execute();

      await db.insert(productsTable).values([
        {
          name: 'Active Product',
          manufacturer: 'PharmaCorp',
          price: '10.99',
          stock_quantity: 5,
          category_id: category[0].id,
          requires_prescription: false,
          is_active: true
        },
        {
          name: 'Inactive Product',
          manufacturer: 'PharmaCorp',
          price: '15.99',
          stock_quantity: 0,
          category_id: category[0].id,
          requires_prescription: false,
          is_active: false
        }
      ]).execute();

      const report = await getInventoryReport();

      expect(report.total_products).toBe(1);
      expect(report.low_stock_products).toHaveLength(1);
      expect(report.low_stock_products[0].product_name).toBe('Active Product');
      expect(report.out_of_stock_products).toHaveLength(0);
    });
  });

  describe('getCustomerReport', () => {
    it('should generate customer analytics report', async () => {
      // Create test customers
      const currentDate = new Date();
      const oldDate = new Date();
      oldDate.setMonth(oldDate.getMonth() - 2);

      const users = await db.insert(usersTable).values([
        {
          email: 'old-customer@test.com',
          password_hash: 'hash123',
          first_name: 'Old',
          last_name: 'Customer',
          role: 'customer',
          created_at: oldDate
        },
        {
          email: 'new-customer@test.com',
          password_hash: 'hash123',
          first_name: 'New',
          last_name: 'Customer',
          role: 'customer',
          created_at: currentDate
        },
        {
          email: 'admin@test.com',
          password_hash: 'hash123',
          first_name: 'Admin',
          last_name: 'User',
          role: 'admin'
        }
      ]).returning().execute();

      // Create an order for old customer (making them active)
      await db.insert(ordersTable).values({
        user_id: users[0].id,
        total_amount: '25.00',
        payment_method: 'credit_card',
        delivery_method: 'standard',
        delivery_address: '123 Main St',
        delivery_phone: '555-0123',
        created_at: currentDate
      }).execute();

      const report = await getCustomerReport();

      expect(report.total_customers).toBe(2); // Excluding admin
      expect(report.new_customers_this_month).toBe(1);
      expect(report.active_customers).toBe(1);
      expect(report.customer_retention_rate).toBe(50); // 1/2 = 50%
    });

    it('should handle zero customers correctly', async () => {
      // Create only non-customer users
      await db.insert(usersTable).values({
        email: 'admin@test.com',
        password_hash: 'hash123',
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin'
      }).execute();

      const report = await getCustomerReport();

      expect(report.total_customers).toBe(0);
      expect(report.new_customers_this_month).toBe(0);
      expect(report.active_customers).toBe(0);
      expect(report.customer_retention_rate).toBe(0);
    });

    it('should calculate retention rate with proper rounding', async () => {
      // Create 3 customers, 1 active (33.33% retention)
      const users = await db.insert(usersTable).values([
        {
          email: 'customer1@test.com',
          password_hash: 'hash123',
          first_name: 'Customer',
          last_name: 'One',
          role: 'customer'
        },
        {
          email: 'customer2@test.com',
          password_hash: 'hash123',
          first_name: 'Customer',
          last_name: 'Two',
          role: 'customer'
        },
        {
          email: 'customer3@test.com',
          password_hash: 'hash123',
          first_name: 'Customer',
          last_name: 'Three',
          role: 'customer'
        }
      ]).returning().execute();

      // Make one customer active with recent order
      await db.insert(ordersTable).values({
        user_id: users[0].id,
        total_amount: '25.00',
        payment_method: 'credit_card',
        delivery_method: 'standard',
        delivery_address: '123 Main St',
        delivery_phone: '555-0123'
      }).execute();

      const report = await getCustomerReport();

      expect(report.total_customers).toBe(3);
      expect(report.active_customers).toBe(1);
      expect(report.customer_retention_rate).toBe(33.33);
    });
  });
});
