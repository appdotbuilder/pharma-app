
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import type { 
  User, 
  CartItem, 
  Product, 
  CreateOrderInput,
  PaymentMethod,
  DeliveryMethod 
} from '../../../server/src/schema';

interface CartItemWithProduct extends CartItem {
  product: Product;
}

interface ShoppingCartProps {
  currentUser: User;
  onCartUpdate: () => void;
  onOrderComplete: () => void;
}

export function ShoppingCart({ currentUser, onCartUpdate, onOrderComplete }: ShoppingCartProps) {
  const [cartItems, setCartItems] = useState<CartItemWithProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [orderForm, setOrderForm] = useState<CreateOrderInput>({
    payment_method: 'cash_on_delivery',
    delivery_method: 'standard',
    delivery_address: '',
    delivery_phone: '',
    notes: null
  });

  const loadCartItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await trpc.cart.getItems.query({ userId: currentUser.id });
      
      // Note: In a real implementation, we'd join with products table
      // This creates product data for demonstration purposes
      const itemsWithProducts: CartItemWithProduct[] = items.map((item: CartItem) => ({
        ...item,
        product: {
          id: item.product_id,
          name: `Medicine ${item.product_id}`,
          description: 'Effective medication for your health needs',
          generic_name: null,
          manufacturer: 'Pharma Corp',
          price: 15.99 + (item.product_id * 0.5),
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
      
      setCartItems(itemsWithProducts);
    } catch (error) {
      console.error('Failed to load cart items:', error);
      setCartItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    loadCartItems();
  }, [loadCartItems]);

  const updateQuantity = async (cartItemId: number, newQuantity: number) => {
    try {
      await trpc.cart.updateItem.mutate({
        userId: currentUser.id,
        cartItemId,
        quantity: newQuantity
      });
      
      loadCartItems();
      onCartUpdate();
      setAlert({ type: 'success', message: 'Cart updated successfully' });
      setTimeout(() => setAlert(null), 2000);
    } catch (error) {
      console.error('Failed to update cart item:', error);
      setAlert({ type: 'error', message: 'Failed to update cart' });
      setTimeout(() => setAlert(null), 3000);
    }
  };

  const removeItem = async (cartItemId: number) => {
    try {
      await trpc.cart.removeItem.mutate({
        userId: currentUser.id,
        cartItemId
      });
      
      loadCartItems();
      onCartUpdate();
      setAlert({ type: 'success', message: 'Item removed from cart' });
      setTimeout(() => setAlert(null), 2000);
    } catch (error) {
      console.error('Failed to remove cart item:', error);
      setAlert({ type: 'error', message: 'Failed to remove item' });
      setTimeout(() => setAlert(null), 3000);
    }
  };

  const clearCart = async () => {
    try {
      await trpc.cart.clear.mutate({ userId: currentUser.id });
      loadCartItems();
      onCartUpdate();
      setAlert({ type: 'success', message: 'Cart cleared successfully' });
      setTimeout(() => setAlert(null), 2000);
    } catch (error) {
      console.error('Failed to clear cart:', error);
      setAlert({ type: 'error', message: 'Failed to clear cart' });
      setTimeout(() => setAlert(null), 3000);
    }
  };

  const calculateTotal = () => {
    return cartItems.reduce((total, item) => total + (item.product.price * item.quantity), 0);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCheckingOut(true);
    
    try {
      await trpc.orders.create.mutate({
        userId: currentUser.id,
        ...orderForm
      });
      
      // Clear cart after successful order
      await trpc.cart.clear.mutate({ userId: currentUser.id });
      
      setAlert({ type: 'success', message: 'Order placed successfully! 🎉' });
      onCartUpdate();
      onOrderComplete();
      
      setTimeout(() => setAlert(null), 3000);
    } catch (error) {
      console.error('Failed to create order:', error);
      setAlert({ type: 'error', message: 'Failed to place order. Please try again.' });
      setTimeout(() => setAlert(null), 3000);
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading your cart...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">🛍️ Shopping Cart</h2>
        {cartItems.length > 0 && (
          <Button variant="outline" onClick={clearCart}>
            Clear Cart
          </Button>
        )}
      </div>

      {alert && (
        <Alert variant={alert.type === 'success' ? 'default' : 'destructive'}>
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      )}

      {cartItems.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <span className="text-6xl mb-4 block">🛒</span>
            <p className="text-gray-500 text-lg mb-4">Your cart is empty</p>
            <p className="text-gray-400">Add some products to get started!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item: CartItemWithProduct) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center">
                      <span className="text-2xl">💊</span>
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium">{item.product.name}</h3>
                          <p className="text-sm text-gray-500">{item.product.manufacturer}</p>
                          {item.product.requires_prescription && (
                            <Badge variant="destructive" className="text-xs mt-1">
                              📋 Prescription Required
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ✕
                        </Button>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                            disabled={item.quantity <= 1}
                          >
                            -
                          </Button>
                          <span className="w-12 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          >
                            +
                          </Button>
                        </div>
                        
                        <div className="text-right">
                          <p className="font-medium">${(item.product.price * item.quantity).toFixed(2)}</p>
                          <p className="text-sm text-gray-500">${item.product.price.toFixed(2)} each</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Checkout Section */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal ({cartItems.length} items)</span>
                    <span>${calculateTotal().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery Fee</span>
                    <span>$5.00</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span>${(calculateTotal() + 5).toFixed(2)}</span>
                  </div>
                </div>

                <form onSubmit={handleCheckout} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Payment Method</label>
                    <Select 
                      value={orderForm.payment_method} 
                      onValueChange={(value: PaymentMethod) => 
                        setOrderForm((prev: CreateOrderInput) => ({ ...prev, payment_method: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash_on_delivery">💵 Cash on Delivery</SelectItem>
                        <SelectItem value="credit_card">💳 Credit Card</SelectItem>
                        <SelectItem value="debit_card">💳 Debit Card</SelectItem>
                        <SelectItem value="digital_wallet">📱 Digital Wallet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Delivery Method</label>
                    <Select 
                      value={orderForm.delivery_method} 
                      onValueChange={(value: DeliveryMethod) => 
                        setOrderForm((prev: CreateOrderInput) => ({ ...prev, delivery_method: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">🚛 Standard (3-5 days)</SelectItem>
                        <SelectItem value="express">⚡ Express (1-2 days)</SelectItem>
                        <SelectItem value="same_day">🏃 Same Day</SelectItem>
                        <SelectItem value="pickup">🏪 Store Pickup</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Delivery Address</label>
                    <Textarea
                      value={orderForm.delivery_address}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setOrderForm((prev: CreateOrderInput) => ({ ...prev, delivery_address: e.target.value }))
                      }
                      placeholder="Enter your complete delivery address"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone Number</label>
                    <Input
                      value={orderForm.delivery_phone}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setOrderForm((prev: CreateOrderInput) => ({ ...prev, delivery_phone: e.target.value }))
                      }
                      placeholder="Phone number for delivery"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Order Notes (Optional)</label>
                    <Textarea
                      value={orderForm.notes || ''}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setOrderForm((prev: CreateOrderInput) => ({ 
                          ...prev, 
                          notes: e.target.value || null 
                        }))
                      }
                      placeholder="Special delivery instructions, prescription notes, etc."
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isCheckingOut}
                  >
                    {isCheckingOut ? 'Placing Order...' : '🎯 Place Order'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
