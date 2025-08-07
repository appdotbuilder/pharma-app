
import { db } from '../db';
import { 
  ordersTable, 
  orderItemsTable, 
  cartItemsTable, 
  productsTable, 
  prescriptionsTable,
  usersTable
} from '../db/schema';
import { type Order, type OrderItem, type CreateOrderInput, type OrderStatus } from '../schema';
import { eq, and, desc, SQL } from 'drizzle-orm';

export async function createOrder(userId: number, input: CreateOrderInput): Promise<Order> {
  try {
    // Get user's cart items with product details
    const cartItems = await db.select({
      cart_id: cartItemsTable.id,
      product_id: cartItemsTable.product_id,
      quantity: cartItemsTable.quantity,
      prescription_id: cartItemsTable.prescription_id,
      product_price: productsTable.price,
      product_name: productsTable.name,
      requires_prescription: productsTable.requires_prescription,
      stock_quantity: productsTable.stock_quantity
    })
    .from(cartItemsTable)
    .innerJoin(productsTable, eq(cartItemsTable.product_id, productsTable.id))
    .where(eq(cartItemsTable.user_id, userId))
    .execute();

    if (cartItems.length === 0) {
      throw new Error('Cart is empty');
    }

    // Aggregate quantities by product to handle multiple cart items for same product
    const productQuantities = new Map<number, number>();
    for (const item of cartItems) {
      const currentQty = productQuantities.get(item.product_id) || 0;
      productQuantities.set(item.product_id, currentQty + item.quantity);
    }

    // Validate prescriptions and stock
    for (const item of cartItems) {
      const totalQuantityForProduct = productQuantities.get(item.product_id)!;
      
      // Check stock availability (only check once per product)
      if (totalQuantityForProduct > item.stock_quantity) {
        throw new Error(`Insufficient stock for ${item.product_name}`);
      }

      // Validate prescription requirements
      if (item.requires_prescription && !item.prescription_id) {
        throw new Error(`Prescription required for ${item.product_name}`);
      }

      // If prescription provided, verify it's valid
      if (item.prescription_id) {
        const prescription = await db.select()
          .from(prescriptionsTable)
          .where(and(
            eq(prescriptionsTable.id, item.prescription_id),
            eq(prescriptionsTable.user_id, userId),
            eq(prescriptionsTable.status, 'verified')
          ))
          .execute();

        if (prescription.length === 0) {
          throw new Error(`Invalid or unverified prescription for ${item.product_name}`);
        }
      }
    }

    // Calculate total amount
    const totalAmount = cartItems.reduce((sum, item) => {
      return sum + (parseFloat(item.product_price) * item.quantity);
    }, 0);

    // Create order
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: userId,
        total_amount: totalAmount.toString(),
        payment_method: input.payment_method,
        delivery_method: input.delivery_method,
        delivery_address: input.delivery_address,
        delivery_phone: input.delivery_phone,
        notes: input.notes
      })
      .returning()
      .execute();

    const order = orderResult[0];

    // Create order items
    const orderItemsData = cartItems.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.product_price,
      prescription_id: item.prescription_id
    }));

    await db.insert(orderItemsTable)
      .values(orderItemsData)
      .execute();

    // Update product stock quantities (aggregate by product to avoid double updates)
    for (const [productId, totalQuantity] of productQuantities.entries()) {
      const productInfo = cartItems.find(item => item.product_id === productId)!;
      await db.update(productsTable)
        .set({ stock_quantity: productInfo.stock_quantity - totalQuantity })
        .where(eq(productsTable.id, productId))
        .execute();
    }

    // Clear user's cart
    await db.delete(cartItemsTable)
      .where(eq(cartItemsTable.user_id, userId))
      .execute();

    return {
      ...order,
      total_amount: parseFloat(order.total_amount)
    };
  } catch (error) {
    console.error('Order creation failed:', error);
    throw error;
  }
}

export async function getUserOrders(userId: number): Promise<Order[]> {
  try {
    const orders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.user_id, userId))
      .orderBy(desc(ordersTable.created_at))
      .execute();

    return orders.map(order => ({
      ...order,
      total_amount: parseFloat(order.total_amount)
    }));
  } catch (error) {
    console.error('Failed to fetch user orders:', error);
    throw error;
  }
}

export async function getOrderById(orderId: number, userId?: number): Promise<Order | null> {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [eq(ordersTable.id, orderId)];

    // Add user filter if provided
    if (userId !== undefined) {
      conditions.push(eq(ordersTable.user_id, userId));
    }

    const orders = await db.select()
      .from(ordersTable)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .execute();

    if (orders.length === 0) {
      return null;
    }

    const order = orders[0];
    return {
      ...order,
      total_amount: parseFloat(order.total_amount)
    };
  } catch (error) {
    console.error('Failed to fetch order by ID:', error);
    throw error;
  }
}

export async function getOrderItems(orderId: number): Promise<OrderItem[]> {
  try {
    const orderItems = await db.select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.order_id, orderId))
      .execute();

    return orderItems.map(item => ({
      ...item,
      unit_price: parseFloat(item.unit_price)
    }));
  } catch (error) {
    console.error('Failed to fetch order items:', error);
    throw error;
  }
}

export async function updateOrderStatus(orderId: number, status: OrderStatus): Promise<Order> {
  try {
    // Verify order exists
    const existingOrders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .execute();

    if (existingOrders.length === 0) {
      throw new Error('Order not found');
    }

    const result = await db.update(ordersTable)
      .set({ 
        status: status,
        updated_at: new Date()
      })
      .where(eq(ordersTable.id, orderId))
      .returning()
      .execute();

    const order = result[0];
    return {
      ...order,
      total_amount: parseFloat(order.total_amount)
    };
  } catch (error) {
    console.error('Failed to update order status:', error);
    throw error;
  }
}

export async function getAllOrders(): Promise<Order[]> {
  try {
    const orders = await db.select()
      .from(ordersTable)
      .orderBy(desc(ordersTable.created_at))
      .execute();

    return orders.map(order => ({
      ...order,
      total_amount: parseFloat(order.total_amount)
    }));
  } catch (error) {
    console.error('Failed to fetch all orders:', error);
    throw error;
  }
}

export async function getOrdersByStatus(status: OrderStatus): Promise<Order[]> {
  try {
    const orders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.status, status))
      .orderBy(desc(ordersTable.created_at))
      .execute();

    return orders.map(order => ({
      ...order,
      total_amount: parseFloat(order.total_amount)
    }));
  } catch (error) {
    console.error('Failed to fetch orders by status:', error);
    throw error;
  }
}
