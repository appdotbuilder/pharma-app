
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/utils/trpc';
import type { User, Order, OrderItem, Product } from '../../../server/src/schema';

interface OrderItemWithProduct extends OrderItem {
  product: Product;
}

interface OrderWithItems extends Order {
  items?: OrderItemWithProduct[];
}

interface OrderHistoryProps {
  currentUser: User;
}

export function OrderHistory({ currentUser }: OrderHistoryProps) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await trpc.orders.getUserOrders.query({ userId: currentUser.id });
      setOrders(result);
    } catch (error) {
      console.error('Failed to load orders:', error);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const loadOrderItems = async (orderId: number) => {
    try {
      const items = await trpc.orders.getItems.query({ orderId });
      
      // Note: In a real implementation, we'd join with products table
      // This creates product data for demonstration purposes
      const itemsWithProducts: OrderItemWithProduct[] = items.map((item: OrderItem) => ({
        ...item,
        product: {
          id: item.product_id,
          name: `Medicine ${item.product_id}`,
          description: 'Healthcare product',
          generic_name: null,
          manufacturer: 'Pharma Corp',
          price: item.unit_price,
          stock_quantity: 100,
          category_id: 1,
          requires_prescription: item.prescription_id !== null,
          dosage: '500mg',
          active_ingredients: null,
          side_effects: null,
          warnings: null,
          image_url: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      }));
      
      setOrders((prev: OrderWithItems[]) => 
        prev.map((order: OrderWithItems) => 
          order.id === orderId 
            ? { ...order, items: itemsWithProducts }
            : order
        )
      );
    } catch (error) {
      console.error('Failed to load order items:', error);
    }
  };

  const toggleOrderExpansion = (orderId: number) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
    } else {
      setExpandedOrder(orderId);
      // Load items if not already loaded
      const order = orders.find((o: OrderWithItems) => o.id === orderId);
      if (order && !order.items) {
        loadOrderItems(orderId);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'processing': return 'bg-orange-100 text-orange-800';
      case 'shipped': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'confirmed': return '✅';
      case 'processing': return '📦';
      case 'shipped': return '🚛';
      case 'delivered': return '🎉';
      case 'cancelled': return '❌';
      default: return '📋';
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash_on_delivery': return '💵';
      case 'credit_card': return '💳';
      case 'debit_card': return '💳';
      case 'digital_wallet': return '📱';
      default: return '💰';
    }
  };

  const getDeliveryMethodIcon = (method: string) => {
    switch (method) {
      case 'standard': return '🚛';
      case 'express': return '⚡';
      case 'same_day': return '🏃';
      case 'pickup': return '🏪';
      default: return '📦';
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading your orders...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">📦 Order History</h2>
        <Badge variant="outline" className="text-sm">
          {orders.length} orders
        </Badge>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <span className="text-6xl mb-4 block">📦</span>
            <p className="text-gray-500 text-lg mb-4">No orders yet</p>
            <p className="text-gray-400">Your order history will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order: OrderWithItems) => (
            <Card key={order.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <span>Order #{order.id}</span>
                      <Badge className={getStatusColor(order.status)}>
                        {getStatusIcon(order.status)} {order.status.toUpperCase()}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Placed on {order.created_at.toLocaleDateString()} at {order.created_at.toLocaleTimeString()}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">${order.total_amount.toFixed(2)}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleOrderExpansion(order.id)}
                    >
                      {expandedOrder === order.id ? 'Hide Details' : 'View Details'}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-gray-700">Payment Method</p>
                    <p className="flex items-center space-x-1">
                      <span>{getPaymentMethodIcon(order.payment_method)}</span>
                      <span className="capitalize">{order.payment_method.replace('_', ' ')}</span>
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Delivery Method</p>
                    <p className="flex items-center space-x-1">
                      <span>{getDeliveryMethodIcon(order.delivery_method)}</span>
                      <span className="capitalize">{order.delivery_method.replace('_', ' ')}</span>
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Estimated Delivery</p>
                    <p>
                      {order.estimated_delivery 
                        ? order.estimated_delivery.toLocaleDateString()
                        : 'TBD'}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="font-medium text-gray-700 mb-1">Delivery Address</p>
                  <p className="text-sm text-gray-600">{order.delivery_address}</p>
                  <p className="text-sm text-gray-600">📞 {order.delivery_phone}</p>
                </div>

                {order.notes && (
                  <div>
                    <p className="font-medium text-gray-700 mb-1">Notes</p>
                    <p className="text-sm text-gray-600">{order.notes}</p>
                  </div>
                )}

                {expandedOrder === order.id && (
                  <>
                    <Separator />
                    <div>
                      <p className="font-medium text-gray-700 mb-3">Order Items</p>
                      {order.items ? (
                        <div className="space-y-3">
                          {order.items.map((item: OrderItemWithProduct) => (
                            <div key={item.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-md">
                              <div className="w-12 h-12 bg-gray-200 rounded-md flex items-center justify-center">
                                <span className="text-lg">💊</span>
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium">{item.product.name}</h4>
                                <p className="text-sm text-gray-600">
                                  Quantity: {item.quantity} × ${item.unit_price.toFixed(2)}
                                </p>
                                {item.prescription_id && (
                                  <Badge variant="destructive" className="text-xs mt-1">
                                    📋 Prescription Required
                                  </Badge>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-medium">${(item.quantity * item.unit_price).toFixed(2)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500">Loading items...</p>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
