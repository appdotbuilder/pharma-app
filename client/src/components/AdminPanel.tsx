
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { trpc } from '@/utils/trpc';
import type { 
  User, 
  Product, 
  Category, 
  Order, 
  Prescription,
  CreateProductInput,
  CreateCategoryInput,
  PrescriptionStatus,
  OrderStatus
} from '../../../server/src/schema';

interface AdminPanelProps {
  currentUser: User;
}

export function AdminPanel({ currentUser }: AdminPanelProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Product form
  const [productForm, setProductForm] = useState<CreateProductInput>({
    name: '',
    description: null,
    generic_name: null,
    manufacturer: '',
    price: 0,
    stock_quantity: 0,
    category_id: 1,
    requires_prescription: false,
    dosage: null,
    active_ingredients: null,
    side_effects: null,
    warnings: null,
    image_url: null
  });

  // Category form
  const [categoryForm, setCategoryForm] = useState<CreateCategoryInput>({
    name: '',
    description: null,
    parent_id: null,
    is_prescription_required: false
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [productsResult, categoriesResult, ordersResult, prescriptionsResult] = await Promise.all([
        trpc.products.getAll.query(),
        trpc.categories.getAll.query(),
        trpc.orders.getAll.query(),
        trpc.prescriptions.getPending.query()
      ]);
      
      setProducts(productsResult);
      setCategories(categoriesResult);
      setOrders(ordersResult);
      setPrescriptions(prescriptionsResult);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await trpc.products.create.mutate(productForm);
      setAlert({ type: 'success', message: 'Product created successfully!' });
      
      // Reset form
      setProductForm({
        name: '',
        description: null,
        generic_name: null,
        manufacturer: '',
        price: 0,
        stock_quantity: 0,
        category_id: 1,
        requires_prescription: false,
        dosage: null,
        active_ingredients: null,
        side_effects: null,
        warnings: null,
        image_url: null
      });
      
      loadData();
      setTimeout(() => setAlert(null), 3000);
    } catch (error) {
      console.error('Failed to create product:', error);
      setAlert({ type: 'error', message: 'Failed to create product' });
      setTimeout(() => setAlert(null), 3000);
    }
  };

  const createCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await trpc.categories.create.mutate(categoryForm);
      setAlert({ type: 'success', message: 'Category created successfully!' });
      
      // Reset form
      setCategoryForm({
        name: '',
        description: null,
        parent_id: null,
        is_prescription_required: false
      });
      
      loadData();
      setTimeout(() => setAlert(null), 3000);
    } catch (error) {
      console.error('Failed to create category:', error);
      setAlert({ type: 'error', message: 'Failed to create category' });
      setTimeout(() => setAlert(null), 3000);
    }
  };

  const updateStock = async (productId: number, newStock: number) => {
    try {
      await trpc.products.updateStock.mutate({ productId, newStock });
      setAlert({ type: 'success', message: 'Stock updated successfully!' });
      loadData();
      setTimeout(() => setAlert(null), 2000);
    } catch (error) {
      console.error('Failed to update stock:', error);
      setAlert({ type: 'error', message: 'Failed to update stock' });
      setTimeout(() => setAlert(null), 3000);
    }
  };

  const updateOrderStatus = async (orderId: number, status: OrderStatus) => {
    try {
      await trpc.orders.updateStatus.mutate({ orderId, status });
      setAlert({ type: 'success', message: 'Order status updated!' });
      loadData();
      setTimeout(() => setAlert(null), 2000);
    } catch (error) {
      console.error('Failed to update order status:', error);
      setAlert({ type: 'error', message: 'Failed to update order status' });
      setTimeout(() => setAlert(null), 3000);
    }
  };

  const verifyPrescription = async (prescriptionId: number, status: PrescriptionStatus, notes?: string) => {
    try {
      await trpc.prescriptions.verify.mutate({
        prescriptionId,
        verifierId: currentUser.id,
        status,
        notes
      });
      setAlert({ type: 'success', message: 'Prescription verified!' });
      loadData();
      setTimeout(() => setAlert(null), 2000);
    } catch (error) {
      console.error('Failed to verify prescription:', error);
      setAlert({ type: 'error', message: 'Failed to verify prescription' });
      setTimeout(() => setAlert(null), 3000);
    }
  };

  if (!['admin', 'pharmacist'].includes(currentUser.role)) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <span className="text-6xl mb-4 block">🚫</span>
          <p className="text-gray-500 text-lg">Access Denied</p>
          <p className="text-gray-400">You don't have permission to access the admin panel</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">⚙️ Admin Panel</h2>
        <Badge variant="secondary">
          {currentUser.role === 'admin' ? 'Administrator' : 'Pharmacist'}
        </Badge>
      </div>

      {alert && (
        <Alert variant={alert.type === 'success' ? 'default' : 'destructive'}>
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading admin data...</p>
        </div>
      ) : (
        <Tabs defaultValue="products" className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="products">🏪 Products</TabsTrigger>
            <TabsTrigger value="inventory">📦 Inventory</TabsTrigger>
            <TabsTrigger value="orders">📋 Orders</TabsTrigger>
            <TabsTrigger value="prescriptions">💊 Prescriptions</TabsTrigger>
            <TabsTrigger value="categories">📂 Categories</TabsTrigger>
          </TabsList>

          {/* Product Management */}
          <TabsContent value="products" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>➕ Add New Product</CardTitle>
                <CardDescription>Add a new medicine or health product to the catalog</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={createProduct} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Product Name</Label>
                      <Input
                        value={productForm.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setProductForm((prev: CreateProductInput) => ({ ...prev, name: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Generic Name</Label>
                      <Input
                        value={productForm.generic_name || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setProductForm((prev: CreateProductInput) => ({ ...prev, generic_name: e.target.value || null }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Manufacturer</Label>
                      <Input
                        value={productForm.manufacturer}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setProductForm((prev: CreateProductInput) => ({ ...prev, manufacturer: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Price ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={productForm.price}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setProductForm((prev: CreateProductInput) => ({ ...prev, price: parseFloat(e.target.value) || 0 }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Stock Quantity</Label>
                      <Input
                        type="number"
                        min="0"
                        value={productForm.stock_quantity}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setProductForm((prev: CreateProductInput) => ({ ...prev, stock_quantity: parseInt(e.target.value) || 0 }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select 
                        value={productForm.category_id.toString()} 
                        onValueChange={(value: string) =>
                          setProductForm((prev: CreateProductInput) => ({ ...prev, category_id: parseInt(value) }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category: Category) => (
                            <SelectItem key={category.id} value={category.id.toString()}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={productForm.description || ''}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setProductForm((prev: CreateProductInput) => ({ ...prev, description: e.target.value || null }))
                      }
                      rows={3}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Dosage</Label>
                      <Input
                        value={productForm.dosage || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setProductForm((prev: CreateProductInput) => ({ ...prev, dosage: e.target.value || null }))
                        }
                        placeholder="e.g., 500mg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Active Ingredients</Label>
                      <Input
                        value={productForm.active_ingredients || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setProductForm((prev: CreateProductInput) => ({ ...prev, active_ingredients: e.target.value || null }))
                        }
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="requires-prescription"
                      checked={productForm.requires_prescription}
                      onCheckedChange={(checked: boolean) =>
                        setProductForm((prev: CreateProductInput) => ({ ...prev, requires_prescription: checked }))
                      }
                    />
                    <Label htmlFor="requires-prescription">Requires Prescription</Label>
                  </div>
                  
                  <Button type="submit" className="w-full">
                    ➕ Add Product
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inventory Management */}
          <TabsContent value="inventory" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>📦 Inventory Management</CardTitle>
                <CardDescription>Update stock levels for existing products</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {products.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No products found</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Current Stock</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((product: Product) => (
                          <TableRow key={product.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{product.name}</p>
                                <p className="text-sm text-gray-500">{product.manufacturer}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={product.stock_quantity < 10 ? 'destructive' : 'secondary'}>
                                {product.stock_quantity} units
                              </Badge>
                            </TableCell>
                            <TableCell>${product.price.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant={product.is_active ? 'default' : 'secondary'}>
                                {product.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Input
                                  type="number"
                                  min="0"
                                  className="w-20"
                                  placeholder="Stock"
                                  onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                    if (e.key === 'Enter') {
                                      const target = e.target as HTMLInputElement;
                                      const newStock = parseInt(target.value);
                                      if (!isNaN(newStock)) {
                                        updateStock(product.id, newStock);
                                        target.value = '';
                                      }
                                    }
                                  }}
                                />
                                <Button size="sm" variant="outline">
                                  Update
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Order Management */}
          <TabsContent value="orders" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>📋 Order Management</CardTitle>
                <CardDescription>View and update order statuses</CardDescription>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No orders found</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order: Order) => (
                        <TableRow key={order.id}>
                          <TableCell>#{order.id}</TableCell>
                          <TableCell>User #{order.user_id}</TableCell>
                          <TableCell>${order.total_amount.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge className={
                              order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                              order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                              order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }>
                              {order.status.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>{order.created_at.toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Select
                              value={order.status}
                              onValueChange={(value: OrderStatus) => updateOrderStatus(order.id, value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="confirmed">Confirmed</SelectItem>
                                <SelectItem value="processing">Processing</SelectItem>
                                <SelectItem value="shipped">Shipped</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Prescription Verification */}
          <TabsContent value="prescriptions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>💊 Prescription Verification</CardTitle>
                <CardDescription>Review and verify uploaded prescriptions</CardDescription>
              </CardHeader>
              <CardContent>
                {prescriptions.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No pending prescriptions</p>
                ) : (
                  <div className="space-y-4">
                    {prescriptions.map((prescription: Prescription) => (
                      <Card key={prescription.id} className="border-l-4 border-l-yellow-400">
                        <CardContent className="p-4">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-medium">Prescription #{prescription.id}</h3>
                                <p className="text-sm text-gray-600">
                                  Patient: User #{prescription.user_id}
                                </p>
                              </div>
                              <Badge className="bg-yellow-100 text-yellow-800">
                                PENDING REVIEW
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p><strong>Doctor:</strong> {prescription.doctor_name}</p>
                                <p><strong>License:</strong> {prescription.doctor_license}</p>
                              </div>
                              <div>
                                <p><strong>Prescription Date:</strong> {prescription.prescription_date.toLocaleDateString()}</p>
                                <p><strong>Uploaded:</strong> {prescription.created_at.toLocaleDateString()}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                onClick={() => verifyPrescription(prescription.id, 'verified', 'Prescription verified successfully')}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                ✅ Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => verifyPrescription(prescription.id, 'rejected', 'Prescription does not meet verification requirements')}
                              >
                                ❌ Reject
                              </Button>
                              <Button size="sm" variant="outline">
                                👁️ View Image
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Category Management */}
          <TabsContent value="categories" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>📂 Category Management</CardTitle>
                <CardDescription>Manage product categories and their hierarchy</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-medium mb-4">Add New Category</h3>
                    <form onSubmit={createCategory} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Category Name</Label>
                        <Input
                          value={categoryForm.name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setCategoryForm((prev: CreateCategoryInput) => ({ ...prev, name: e.target.value }))
                          }
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          value={categoryForm.description || ''}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            setCategoryForm((prev: CreateCategoryInput) => ({ ...prev, description: e.target.value || null }))
                          }
                          rows={3}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Parent Category (Optional)</Label>
                        <Select 
                          value={categoryForm.parent_id?.toString() || 'none'} 
                          onValueChange={(value: string) =>
                            setCategoryForm((prev: CreateCategoryInput) => ({ 
                              ...prev, 
                              
                              parent_id: value === 'none' ? null : parseInt(value) 
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Parent</SelectItem>
                            {categories.map((category: Category) => (
                              <SelectItem key={category.id} value={category.id.toString()}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="prescription-required"
                          checked={categoryForm.is_prescription_required}
                          onCheckedChange={(checked: boolean) =>
                            setCategoryForm((prev: CreateCategoryInput) => ({ ...prev, is_prescription_required: checked }))
                          }
                        />
                        <Label htmlFor="prescription-required">Prescription Required by Default</Label>
                      </div>
                      
                      <Button type="submit" className="w-full">
                        ➕ Add Category
                      </Button>
                    </form>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-4">Existing Categories</h3>
                    {categories.length === 0 ? (
                      <p className="text-gray-500">No categories created yet</p>
                    ) : (
                      <div className="space-y-2">
                        {categories.map((category: Category) => (
                          <Card key={category.id} className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{category.name}</p>
                                {category.description && (
                                  <p className="text-sm text-gray-600">{category.description}</p>
                                )}
                              </div>
                              {category.is_prescription_required && (
                                <Badge variant="destructive" className="text-xs">
                                  Rx Required
                                </Badge>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
