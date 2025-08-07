
import { db } from '../db';
import { cartItemsTable, productsTable, usersTable, prescriptionsTable } from '../db/schema';
import { type CartItem, type AddToCartInput } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function getCartItems(userId: number): Promise<CartItem[]> {
  try {
    const results = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.user_id, userId))
      .execute();

    return results.map(item => ({
      ...item,
      created_at: item.created_at,
      updated_at: item.updated_at
    }));
  } catch (error) {
    console.error('Get cart items failed:', error);
    throw error;
  }
}

export async function addToCart(userId: number, input: AddToCartInput): Promise<CartItem> {
  try {
    // Verify user exists
    const userExists = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();
    
    if (userExists.length === 0) {
      throw new Error('User not found');
    }

    // Verify product exists and get its details
    const product = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, input.product_id))
      .execute();
    
    if (product.length === 0) {
      throw new Error('Product not found');
    }

    const productData = product[0];

    // Check if product requires prescription and prescription is provided
    if (productData.requires_prescription && !input.prescription_id) {
      throw new Error('Product requires prescription');
    }

    // If prescription is provided, verify it exists and belongs to the user
    if (input.prescription_id) {
      const prescription = await db.select()
        .from(prescriptionsTable)
        .where(and(
          eq(prescriptionsTable.id, input.prescription_id),
          eq(prescriptionsTable.user_id, userId)
        ))
        .execute();
      
      if (prescription.length === 0) {
        throw new Error('Invalid prescription');
      }
    }

    // Check if product is in stock
    if (productData.stock_quantity < input.quantity) {
      throw new Error('Insufficient stock');
    }

    // Check if item already exists in cart
    const existingCartItem = await db.select()
      .from(cartItemsTable)
      .where(and(
        eq(cartItemsTable.user_id, userId),
        eq(cartItemsTable.product_id, input.product_id)
      ))
      .execute();

    if (existingCartItem.length > 0) {
      // Update existing cart item quantity
      const newQuantity = existingCartItem[0].quantity + input.quantity;
      
      if (productData.stock_quantity < newQuantity) {
        throw new Error('Insufficient stock');
      }

      const result = await db.update(cartItemsTable)
        .set({
          quantity: newQuantity,
          updated_at: new Date()
        })
        .where(eq(cartItemsTable.id, existingCartItem[0].id))
        .returning()
        .execute();

      return result[0];
    } else {
      // Add new cart item
      const result = await db.insert(cartItemsTable)
        .values({
          user_id: userId,
          product_id: input.product_id,
          quantity: input.quantity,
          prescription_id: input.prescription_id
        })
        .returning()
        .execute();

      return result[0];
    }
  } catch (error) {
    console.error('Add to cart failed:', error);
    throw error;
  }
}

export async function updateCartItem(userId: number, cartItemId: number, quantity: number): Promise<CartItem> {
  try {
    // Verify cart item exists and belongs to user
    const cartItem = await db.select()
      .from(cartItemsTable)
      .where(and(
        eq(cartItemsTable.id, cartItemId),
        eq(cartItemsTable.user_id, userId)
      ))
      .execute();
    
    if (cartItem.length === 0) {
      throw new Error('Cart item not found');
    }

    // Verify product stock availability
    const product = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, cartItem[0].product_id))
      .execute();
    
    if (product.length === 0) {
      throw new Error('Product not found');
    }

    if (product[0].stock_quantity < quantity) {
      throw new Error('Insufficient stock');
    }

    // Update cart item
    const result = await db.update(cartItemsTable)
      .set({
        quantity: quantity,
        updated_at: new Date()
      })
      .where(eq(cartItemsTable.id, cartItemId))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Update cart item failed:', error);
    throw error;
  }
}

export async function removeFromCart(userId: number, cartItemId: number): Promise<void> {
  try {
    // Verify cart item exists and belongs to user before deleting
    const cartItem = await db.select()
      .from(cartItemsTable)
      .where(and(
        eq(cartItemsTable.id, cartItemId),
        eq(cartItemsTable.user_id, userId)
      ))
      .execute();
    
    if (cartItem.length === 0) {
      throw new Error('Cart item not found');
    }

    await db.delete(cartItemsTable)
      .where(eq(cartItemsTable.id, cartItemId))
      .execute();
  } catch (error) {
    console.error('Remove from cart failed:', error);
    throw error;
  }
}

export async function clearCart(userId: number): Promise<void> {
  try {
    await db.delete(cartItemsTable)
      .where(eq(cartItemsTable.user_id, userId))
      .execute();
  } catch (error) {
    console.error('Clear cart failed:', error);
    throw error;
  }
}
