
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, categoriesTable, productsTable, prescriptionsTable, cartItemsTable } from '../db/schema';
import { type AddToCartInput } from '../schema';
import { getCartItems, addToCart, updateCartItem, removeFromCart, clearCart } from '../handlers/cart';
import { eq } from 'drizzle-orm';

describe('Cart handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testCategoryId: number;
  let testProductId: number;
  let testPrescriptionProductId: number;
  let testPrescriptionId: number;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        first_name: 'John',
        last_name: 'Doe',
        phone: '1234567890',
        role: 'customer'
      })
      .returning()
      .execute();
    testUserId = userResult[0].id;

    // Create test category
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'Test category description',
        is_prescription_required: false
      })
      .returning()
      .execute();
    testCategoryId = categoryResult[0].id;

    // Create regular product
    const productResult = await db.insert(productsTable)
      .values({
        name: 'Test Product',
        description: 'Test product description',
        manufacturer: 'Test Manufacturer',
        price: '19.99',
        stock_quantity: 100,
        category_id: testCategoryId,
        requires_prescription: false
      })
      .returning()
      .execute();
    testProductId = productResult[0].id;

    // Create prescription-required product
    const prescriptionProductResult = await db.insert(productsTable)
      .values({
        name: 'Prescription Product',
        description: 'Product requiring prescription',
        manufacturer: 'Test Manufacturer',
        price: '49.99',
        stock_quantity: 50,
        category_id: testCategoryId,
        requires_prescription: true
      })
      .returning()
      .execute();
    testPrescriptionProductId = prescriptionProductResult[0].id;

    // Create test prescription
    const prescriptionResult = await db.insert(prescriptionsTable)
      .values({
        user_id: testUserId,
        doctor_name: 'Dr. Smith',
        doctor_license: 'LIC123456',
        prescription_date: new Date(),
        image_url: 'http://example.com/prescription.jpg',
        status: 'verified'
      })
      .returning()
      .execute();
    testPrescriptionId = prescriptionResult[0].id;
  });

  describe('getCartItems', () => {
    it('should return empty array for empty cart', async () => {
      const result = await getCartItems(testUserId);
      expect(result).toEqual([]);
    });

    it('should return cart items for user', async () => {
      // Add item to cart directly
      await db.insert(cartItemsTable)
        .values({
          user_id: testUserId,
          product_id: testProductId,
          quantity: 2
        })
        .execute();

      const result = await getCartItems(testUserId);
      expect(result).toHaveLength(1);
      expect(result[0].user_id).toBe(testUserId);
      expect(result[0].product_id).toBe(testProductId);
      expect(result[0].quantity).toBe(2);
      expect(result[0].created_at).toBeInstanceOf(Date);
      expect(result[0].updated_at).toBeInstanceOf(Date);
    });
  });

  describe('addToCart', () => {
    it('should add product to cart', async () => {
      const input: AddToCartInput = {
        product_id: testProductId,
        quantity: 3,
        prescription_id: null
      };

      const result = await addToCart(testUserId, input);

      expect(result.user_id).toBe(testUserId);
      expect(result.product_id).toBe(testProductId);
      expect(result.quantity).toBe(3);
      expect(result.prescription_id).toBeNull();
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);

      // Verify in database
      const cartItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.user_id, testUserId))
        .execute();
      expect(cartItems).toHaveLength(1);
    });

    it('should update quantity if product already in cart', async () => {
      const input: AddToCartInput = {
        product_id: testProductId,
        quantity: 2,
        prescription_id: null
      };

      // Add first time
      await addToCart(testUserId, input);

      // Add again
      const result = await addToCart(testUserId, input);

      expect(result.quantity).toBe(4); // 2 + 2

      // Verify only one cart item exists
      const cartItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.user_id, testUserId))
        .execute();
      expect(cartItems).toHaveLength(1);
      expect(cartItems[0].quantity).toBe(4);
    });

    it('should require prescription for prescription products', async () => {
      const input: AddToCartInput = {
        product_id: testPrescriptionProductId,
        quantity: 1,
        prescription_id: null
      };

      await expect(addToCart(testUserId, input)).rejects.toThrow(/prescription/i);
    });

    it('should accept prescription products with valid prescription', async () => {
      const input: AddToCartInput = {
        product_id: testPrescriptionProductId,
        quantity: 1,
        prescription_id: testPrescriptionId
      };

      const result = await addToCart(testUserId, input);

      expect(result.prescription_id).toBe(testPrescriptionId);
    });

    it('should throw error for insufficient stock', async () => {
      const input: AddToCartInput = {
        product_id: testProductId,
        quantity: 200, // More than available stock (100)
        prescription_id: null
      };

      await expect(addToCart(testUserId, input)).rejects.toThrow(/stock/i);
    });

    it('should throw error for non-existent user', async () => {
      const input: AddToCartInput = {
        product_id: testProductId,
        quantity: 1,
        prescription_id: null
      };

      await expect(addToCart(999, input)).rejects.toThrow(/user/i);
    });

    it('should throw error for non-existent product', async () => {
      const input: AddToCartInput = {
        product_id: 999,
        quantity: 1,
        prescription_id: null
      };

      await expect(addToCart(testUserId, input)).rejects.toThrow(/product/i);
    });
  });

  describe('updateCartItem', () => {
    let cartItemId: number;

    beforeEach(async () => {
      const cartItem = await db.insert(cartItemsTable)
        .values({
          user_id: testUserId,
          product_id: testProductId,
          quantity: 2
        })
        .returning()
        .execute();
      cartItemId = cartItem[0].id;
    });

    it('should update cart item quantity', async () => {
      const result = await updateCartItem(testUserId, cartItemId, 5);

      expect(result.quantity).toBe(5);
      expect(result.updated_at).toBeInstanceOf(Date);

      // Verify in database
      const cartItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.id, cartItemId))
        .execute();
      expect(cartItems[0].quantity).toBe(5);
    });

    it('should throw error for insufficient stock', async () => {
      await expect(updateCartItem(testUserId, cartItemId, 200)).rejects.toThrow(/stock/i);
    });

    it('should throw error for non-existent cart item', async () => {
      await expect(updateCartItem(testUserId, 999, 5)).rejects.toThrow(/not found/i);
    });

    it('should throw error when cart item belongs to different user', async () => {
      // Create another user
      const otherUser = await db.insert(usersTable)
        .values({
          email: 'other@example.com',
          password_hash: 'hashedpassword',
          first_name: 'Jane',
          last_name: 'Smith',
          role: 'customer'
        })
        .returning()
        .execute();

      await expect(updateCartItem(otherUser[0].id, cartItemId, 5)).rejects.toThrow(/not found/i);
    });
  });

  describe('removeFromCart', () => {
    let cartItemId: number;

    beforeEach(async () => {
      const cartItem = await db.insert(cartItemsTable)
        .values({
          user_id: testUserId,
          product_id: testProductId,
          quantity: 2
        })
        .returning()
        .execute();
      cartItemId = cartItem[0].id;
    });

    it('should remove cart item', async () => {
      await removeFromCart(testUserId, cartItemId);

      // Verify item is removed
      const cartItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.id, cartItemId))
        .execute();
      expect(cartItems).toHaveLength(0);
    });

    it('should throw error for non-existent cart item', async () => {
      await expect(removeFromCart(testUserId, 999)).rejects.toThrow(/not found/i);
    });

    it('should throw error when cart item belongs to different user', async () => {
      // Create another user
      const otherUser = await db.insert(usersTable)
        .values({
          email: 'other@example.com',
          password_hash: 'hashedpassword',
          first_name: 'Jane',
          last_name: 'Smith',
          role: 'customer'
        })
        .returning()
        .execute();

      await expect(removeFromCart(otherUser[0].id, cartItemId)).rejects.toThrow(/not found/i);
    });
  });

  describe('clearCart', () => {
    beforeEach(async () => {
      // Add multiple items to cart
      await db.insert(cartItemsTable)
        .values([
          {
            user_id: testUserId,
            product_id: testProductId,
            quantity: 2
          },
          {
            user_id: testUserId,
            product_id: testPrescriptionProductId,
            quantity: 1,
            prescription_id: testPrescriptionId
          }
        ])
        .execute();
    });

    it('should clear all cart items for user', async () => {
      // Verify items exist
      let cartItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.user_id, testUserId))
        .execute();
      expect(cartItems).toHaveLength(2);

      // Clear cart
      await clearCart(testUserId);

      // Verify items are removed
      cartItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.user_id, testUserId))
        .execute();
      expect(cartItems).toHaveLength(0);
    });

    it('should not affect other users cart items', async () => {
      // Create another user with cart items
      const otherUser = await db.insert(usersTable)
        .values({
          email: 'other@example.com',
          password_hash: 'hashedpassword',
          first_name: 'Jane',
          last_name: 'Smith',
          role: 'customer'
        })
        .returning()
        .execute();

      await db.insert(cartItemsTable)
        .values({
          user_id: otherUser[0].id,
          product_id: testProductId,
          quantity: 1
        })
        .execute();

      // Clear first user's cart
      await clearCart(testUserId);

      // Verify other user's cart is unchanged
      const otherCartItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.user_id, otherUser[0].id))
        .execute();
      expect(otherCartItems).toHaveLength(1);
    });
  });
});
