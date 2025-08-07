
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/utils/trpc';
import type { User, Product, Category, SearchProductsInput, AddToCartInput } from '../../../server/src/schema';

interface ProductCatalogProps {
  currentUser: User;
  onCartUpdate: () => void;
}

export function ProductCatalog({ currentUser, onCartUpdate }: ProductCatalogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [prescriptionFilter, setPrescriptionFilter] = useState<string>('all');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      const result = await trpc.categories.getAll.query();
      setCategories(result);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, []);

  // Load products with filters
  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const searchInput: SearchProductsInput = {
        query: searchQuery || undefined,
        category_id: selectedCategory !== 'all' ? parseInt(selectedCategory) : undefined,
        requires_prescription: prescriptionFilter !== 'all' ? prescriptionFilter === 'yes' : undefined,
        min_price: priceRange.min ? parseFloat(priceRange.min) : undefined,
        max_price: priceRange.max ? parseFloat(priceRange.max) : undefined,
        limit: 50,
        offset: 0
      };
      
      const result = await trpc.products.search.query(searchInput);
      setProducts(result.products);
    } catch (error) {
      console.error('Failed to load products:', error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedCategory, prescriptionFilter, priceRange]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const addToCart = async (product: Product) => {
    try {
      const cartInput: AddToCartInput = {
        product_id: product.id,
        quantity: 1,
        prescription_id: null // For now, prescription handling is simplified
      };
      
      await trpc.cart.addItem.mutate({ 
        userId: currentUser.id, 
        ...cartInput 
      });
      
      setAlert({ type: 'success', message: `${product.name} added to cart!` });
      onCartUpdate();
      
      // Clear alert after 3 seconds
      setTimeout(() => setAlert(null), 3000);
    } catch (error) {
      console.error('Failed to add to cart:', error);
      setAlert({ type: 'error', message: 'Failed to add item to cart' });
      setTimeout(() => setAlert(null), 3000);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setPrescriptionFilter('all');
    setPriceRange({ min: '', max: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">🛒 Product Catalog</h2>
        <Badge variant="outline" className="text-sm">
          {products.length} products found
        </Badge>
      </div>

      {alert && (
        <Alert variant={alert.type === 'success' ? 'default' : 'destructive'}>
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      )}

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              placeholder="Search medicines, brands..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            />
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category: Category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={prescriptionFilter} onValueChange={setPrescriptionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Prescription" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                <SelectItem value="no">No Prescription</SelectItem>
                <SelectItem value="yes">Prescription Required</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
          
          <div className="flex gap-4 items-center">
            <span className="text-sm font-medium">Price Range:</span>
            <Input
              type="number"
              placeholder="Min $"
              value={priceRange.min}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setPriceRange((prev) => ({ ...prev, min: e.target.value }))
              }
              className="w-24"
            />
            <span>-</span>
            <Input
              type="number"
              placeholder="Max $"
              value={priceRange.max}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setPriceRange((prev) => ({ ...prev, max: e.target.value }))
              }
              className="w-24"
            />
          </div>
        </CardContent>
      </Card>

      {/* Products Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading products...</p>
        </div>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-500 text-lg mb-4">No products found</p>
            <p className="text-gray-400">Try adjusting your search criteria</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product: Product) => (
            <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-square bg-gray-100 flex items-center justify-center">
                {product.image_url ? (
                  <img 
                    src={product.image_url} 
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-6xl">💊</span>
                )}
              </div>
              
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg leading-tight">{product.name}</CardTitle>
                  <Badge variant={product.requires_prescription ? 'destructive' : 'secondary'}>
                    {product.requires_prescription ? '📋 Rx' : '🛍️ OTC'}
                  </Badge>
                </div>
                {product.generic_name && (
                  <CardDescription>Generic: {product.generic_name}</CardDescription>
                )}
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">{product.manufacturer}</p>
                  {product.dosage && (
                    <p className="text-sm"><strong>Dosage:</strong> {product.dosage}</p>
                  )}
                  {product.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
                  )}
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-green-600">${product.price.toFixed(2)}</p>
                    <p className="text-sm text-gray-500">
                      {product.stock_quantity > 0 
                        ? `${product.stock_quantity} in stock` 
                        : 'Out of stock'}
                    </p>
                  </div>
                  
                  <Button
                    onClick={() => addToCart(product)}
                    disabled={product.stock_quantity === 0}
                    className="shrink-0"
                  >
                    {product.stock_quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
                  </Button>
                </div>
                
                {product.warnings && (
                  <Alert className="mt-2">
                    <AlertDescription className="text-xs">
                      ⚠️ {product.warnings}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
