
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  categoriesTable, 
  productsTable, 
  cartItemsTable, 
  prescriptionsTable,
  ordersTable,
  orderItemsTable
} from '../db/schema';
import { type CreateOrderInput } from '../schema';
import { 
  createOrder, 
  getUserOrders, 
  getOrderById, 
  getOrderItems,
  updateOrderStatus,
  getAllOrders,
  getOrdersByStatus
} from '../handlers/orders';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'customer@test.com',
  password_hash: 'hashed_password',
  first_name: 'John',
  last_name: 'Doe',
  phone: '1234567890',
  role: 'customer' as const
};

const testPharmacist = {
  email: 'pharmacist@test.com',
  password_hash: 'hashed_password',
  first_name: 'Jane',
  last_name: 'Smith',
  phone: '9876543210',
  role: 'pharmacist' as const
};

const testCategory = {
  name: 'Pain Relief',
  description: 'Over-the-counter pain medications',
  parent_id: null,
  is_prescription_required: false
};

const testPrescriptionCategory = {
  name: 'Antibiotics',
  description: 'Prescription antibiotics',
  parent_id: null,
  is_prescription_required: true
};

const testProduct = {
  name: 'Ibuprofen',
  description: 'Pain reliever',
  generic_name: 'Ibuprofen',
  manufacturer: 'TestPharma',
  price: '15.99',
  stock_quantity: 100,
  category_id: 1,
  requires_prescription: false
};

const testPrescriptionProduct = {
  name: 'Amoxicillin',
  description: 'Antibiotic medication',
  generic_name: 'Amoxicillin',
  manufacturer: 'TestPharma',
  price: '25.50',
  stock_quantity: 50,
  category_id: 2,
  requires_prescription: true
};

const testOrderInput: CreateOrderInput = {
  payment_method: 'credit_card',
  delivery_method: 'standard',
  delivery_address: '123 Main St, City, State',
  delivery_phone: '1234567890',
  notes: 'Leave at door'
};

describe('Orders', () => {
  let userId: number;
  let pharmacistId: number;
  let categoryId: number;
  let prescriptionCategoryId: number;
  let productId: number;
  let prescriptionProductId: number;

  beforeEach(async () => {
    await createDB();

    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create test pharmacist
    const pharmacistResult = await db.insert(usersTable)
      .values(testPharmacist)
      .returning()
      .execute();
    pharmacistId = pharmacistResult[0].id;

    // Create categories
    const categoryResult = await db.insert(categoriesTable)
      .values(testCategory)
      .returning()
      .execute();
    categoryId = categoryResult[0].id;

    const prescriptionCategoryResult = await db.insert(categoriesTable)
      .values(testPrescriptionCategory)
      .returning()
      .execute();
    prescriptionCategoryId = prescriptionCategoryResult[0].id;

    // Create products
    const productResult = await db.insert(productsTable)
      .values({ ...testProduct, category_id: categoryId })
      .returning()
      .execute();
    productId = productResult[0].id;

    const prescriptionProductResult = await db.insert(productsTable)
      .values({ ...testPrescriptionProduct, category_id: prescriptionCategoryId })
      .returning()
      .execute();
    prescriptionProductId = prescriptionProductResult[0].id;
  });

  afterEach(resetDB);

  describe('createOrder', () => {
    it('should create order from cart items', async () => {
      // Add items to cart
      await db.insert(cartItemsTable)
        .values([
          { user_id: userId, product_id: productId, quantity: 2, prescription_id: null },
          { user_id: userId, product_id: productId, quantity: 1, prescription_id: null }
        ])
        .execute();

      const result = await createOrder(userId, testOrderInput);

      expect(result.user_id).toEqual(userId);
      expect(result.total_amount).toEqual(47.97); // (15.99 * 2) + (15.99 * 1)
      expect(result.status).toEqual('pending');
      expect(result.payment_method).toEqual('credit_card');
      expect(result.delivery_method).toEqual('standard');
      expect(result.delivery_address).toEqual('123 Main St, City, State');
      expect(result.delivery_phone).toEqual('1234567890');
      expect(result.notes).toEqual('Leave at door');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);

      // Verify order items were created
      const orderItems = await db.select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.order_id, result.id))
        .execute();

      expect(orderItems).toHaveLength(2);

      // Verify cart was cleared
      const cartItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.user_id, userId))
        .execute();

      expect(cartItems).toHaveLength(0);

      // Verify stock was updated correctly (aggregated: 100 - (2+1) = 97)
      const updatedProduct = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, productId))
        .execute();

      expect(updatedProduct[0].stock_quantity).toEqual(97); // 100 - 3
    });

    it('should create order with prescription product', async () => {
      // Create verified prescription
      const prescriptionResult = await db.insert(prescriptionsTable)
        .values({
          user_id: userId,
          doctor_name: 'Dr. Smith',
          doctor_license: 'LIC123',
          prescription_date: new Date(),
          image_url: 'http://example.com/prescription.jpg',
          status: 'verified',
          verified_by: pharmacistId
        })
        .returning()
        .execute();

      const prescriptionId = prescriptionResult[0].id;

      // Add prescription product to cart
      await db.insert(cartItemsTable)
        .values({
          user_id: userId,
          product_id: prescriptionProductId,
          quantity: 1,
          prescription_id: prescriptionId
        })
        .execute();

      const result = await createOrder(userId, testOrderInput);

      expect(result.total_amount).toEqual(25.50);
      expect(result.id).toBeDefined();

      // Verify order item has prescription ID
      const orderItems = await db.select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.order_id, result.id))
        .execute();

      expect(orderItems[0].prescription_id).toEqual(prescriptionId);
    });

    it('should throw error for empty cart', async () => {
      await expect(createOrder(userId, testOrderInput))
        .rejects.toThrow(/cart is empty/i);
    });

    it('should throw error for insufficient stock', async () => {
      // Add more items than available stock
      await db.insert(cartItemsTable)
        .values({
          user_id: userId,
          product_id: productId,
          quantity: 150, // More than 100 in stock
          prescription_id: null
        })
        .execute();

      await expect(createOrder(userId, testOrderInput))
        .rejects.toThrow(/insufficient stock/i);
    });

    it('should throw error when prescription required but not provided', async () => {
      // Add prescription product without prescription
      await db.insert(cartItemsTable)
        .values({
          user_id: userId,
          product_id: prescriptionProductId,
          quantity: 1,
          prescription_id: null
        })
        .execute();

      await expect(createOrder(userId, testOrderInput))
        .rejects.toThrow(/prescription required/i);
    });

    it('should throw error for unverified prescription', async () => {
      // Create pending prescription
      const prescriptionResult = await db.insert(prescriptionsTable)
        .values({
          user_id: userId,
          doctor_name: 'Dr. Smith',
          doctor_license: 'LIC123',
          prescription_date: new Date(),
          image_url: 'http://example.com/prescription.jpg',
          status: 'pending'
        })
        .returning()
        .execute();

      const prescriptionId = prescriptionResult[0].id;

      // Add prescription product to cart with unverified prescription
      await db.insert(cartItemsTable)
        .values({
          user_id: userId,
          product_id: prescriptionProductId,
          quantity: 1,
          prescription_id: prescriptionId
        })
        .execute();

      await expect(createOrder(userId, testOrderInput))
        .rejects.toThrow(/invalid or unverified prescription/i);
    });
  });

  describe('getUserOrders', () => {
    it('should return user orders', async () => {
      // Create test order
      const orderResult = await db.insert(ordersTable)
        .values({
          user_id: userId,
          total_amount: '99.99',
          payment_method: 'credit_card',
          delivery_method: 'standard',
          delivery_address: '123 Test St',
          delivery_phone: '1234567890'
        })
        .returning()
        .execute();

      const orders = await getUserOrders(userId);

      expect(orders).toHaveLength(1);
      expect(orders[0].id).toEqual(orderResult[0].id);
      expect(orders[0].user_id).toEqual(userId);
      expect(orders[0].total_amount).toEqual(99.99);
      expect(typeof orders[0].total_amount).toEqual('number');
    });

    it('should return empty array for user with no orders', async () => {
      const orders = await getUserOrders(userId);
      expect(orders).toHaveLength(0);
    });
  });

  describe('getOrderById', () => {
    it('should return order by ID without user restriction', async () => {
      const orderResult = await db.insert(ordersTable)
        .values({
          user_id: userId,
          total_amount: '150.00',
          payment_method: 'credit_card',
          delivery_method: 'express',
          delivery_address: '456 Test Ave',
          delivery_phone: '9876543210'
        })
        .returning()
        .execute();

      const order = await getOrderById(orderResult[0].id);

      expect(order).not.toBeNull();
      expect(order!.id).toEqual(orderResult[0].id);
      expect(order!.total_amount).toEqual(150.00);
      expect(typeof order!.total_amount).toEqual('number');
    });

    it('should return order by ID with user restriction', async () => {
      const orderResult = await db.insert(ordersTable)
        .values({
          user_id: userId,
          total_amount: '75.25',
          payment_method: 'debit_card',
          delivery_method: 'same_day',
          delivery_address: '789 Test Rd',
          delivery_phone: '5555555555'
        })
        .returning()
        .execute();

      const order = await getOrderById(orderResult[0].id, userId);

      expect(order).not.toBeNull();
      expect(order!.user_id).toEqual(userId);
    });

    it('should return null for wrong user', async () => {
      const orderResult = await db.insert(ordersTable)
        .values({
          user_id: userId,
          total_amount: '50.00',
          payment_method: 'cash_on_delivery',
          delivery_method: 'pickup',
          delivery_address: '321 Test Blvd',
          delivery_phone: '1111111111'
        })
        .returning()
        .execute();

      const order = await getOrderById(orderResult[0].id, 999);
      expect(order).toBeNull();
    });

    it('should return null for non-existent order', async () => {
      const order = await getOrderById(999);
      expect(order).toBeNull();
    });
  });

  describe('getOrderItems', () => {
    it('should return order items', async () => {
      // Create order
      const orderResult = await db.insert(ordersTable)
        .values({
          user_id: userId,
          total_amount: '31.98',
          payment_method: 'credit_card',
          delivery_method: 'standard',
          delivery_address: '123 Test St',
          delivery_phone: '1234567890'
        })
        .returning()
        .execute();

      // Create order items
      await db.insert(orderItemsTable)
        .values([
          {
            order_id: orderResult[0].id,
            product_id: productId,
            quantity: 2,
            unit_price: '15.99',
            prescription_id: null
          }
        ])
        .execute();

      const items = await getOrderItems(orderResult[0].id);

      expect(items).toHaveLength(1);
      expect(items[0].order_id).toEqual(orderResult[0].id);
      expect(items[0].product_id).toEqual(productId);
      expect(items[0].quantity).toEqual(2);
      expect(items[0].unit_price).toEqual(15.99);
      expect(typeof items[0].unit_price).toEqual('number');
    });

    it('should return empty array for order with no items', async () => {
      const items = await getOrderItems(999);
      expect(items).toHaveLength(0);
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      const orderResult = await db.insert(ordersTable)
        .values({
          user_id: userId,
          total_amount: '45.00',
          payment_method: 'credit_card',
          delivery_method: 'standard',
          delivery_address: '123 Test St',
          delivery_phone: '1234567890'
        })
        .returning()
        .execute();

      const updatedOrder = await updateOrderStatus(orderResult[0].id, 'confirmed');

      expect(updatedOrder.status).toEqual('confirmed');
      expect(updatedOrder.id).toEqual(orderResult[0].id);
      expect(updatedOrder.total_amount).toEqual(45.00);
      expect(typeof updatedOrder.total_amount).toEqual('number');
    });

    it('should throw error for non-existent order', async () => {
      await expect(updateOrderStatus(999, 'confirmed'))
        .rejects.toThrow(/order not found/i);
    });
  });

  describe('getAllOrders', () => {
    it('should return all orders', async () => {
      // Create multiple orders
      await db.insert(ordersTable)
        .values([
          {
            user_id: userId,
            total_amount: '100.00',
            payment_method: 'credit_card',
            delivery_method: 'standard',
            delivery_address: '123 Test St',
            delivery_phone: '1234567890'
          },
          {
            user_id: pharmacistId,
            total_amount: '200.00',
            payment_method: 'debit_card',
            delivery_method: 'express',
            delivery_address: '456 Test Ave',
            delivery_phone: '9876543210'
          }
        ])
        .execute();

      const orders = await getAllOrders();

      expect(orders.length).toBeGreaterThanOrEqual(2);
      orders.forEach(order => {
        expect(typeof order.total_amount).toEqual('number');
      });
    });

    it('should return empty array when no orders exist', async () => {
      const orders = await getAllOrders();
      expect(orders).toHaveLength(0);
    });
  });

  describe('getOrdersByStatus', () => {
    it('should return orders filtered by status', async () => {
      // Create orders with different statuses
      await db.insert(ordersTable)
        .values([
          {
            user_id: userId,
            total_amount: '50.00',
            status: 'pending',
            payment_method: 'credit_card',
            delivery_method: 'standard',
            delivery_address: '123 Test St',
            delivery_phone: '1234567890'
          },
          {
            user_id: userId,
            total_amount: '75.00',
            status: 'confirmed',
            payment_method: 'debit_card',
            delivery_method: 'express',
            delivery_address: '456 Test Ave',
            delivery_phone: '9876543210'
          }
        ])
        .execute();

      const pendingOrders = await getOrdersByStatus('pending');
      const confirmedOrders = await getOrdersByStatus('confirmed');

      expect(pendingOrders).toHaveLength(1);
      expect(pendingOrders[0].status).toEqual('pending');
      expect(pendingOrders[0].total_amount).toEqual(50.00);

      expect(confirmedOrders).toHaveLength(1);
      expect(confirmedOrders[0].status).toEqual('confirmed');
      expect(confirmedOrders[0].total_amount).toEqual(75.00);
    });

    it('should return empty array for status with no orders', async () => {
      const orders = await getOrdersByStatus('shipped');
      expect(orders).toHaveLength(0);
    });
  });
});
