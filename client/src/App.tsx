
import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AuthForm } from '@/components/AuthForm';
import { ProductCatalog } from '@/components/ProductCatalog';
import { ShoppingCart } from '@/components/ShoppingCart';
import { OrderHistory } from '@/components/OrderHistory';
import { AdminPanel } from '@/components/AdminPanel';
import { PrescriptionUpload } from '@/components/PrescriptionUpload';
import { Consultation } from '@/components/Consultation';
import type { User } from '../../server/src/schema';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('catalog');
  const [cartItemCount, setCartItemCount] = useState(0);

  // Load user session on app start
  useEffect(() => {
    const savedUser = localStorage.getItem('pharmacy_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Failed to parse saved user:', error);
        localStorage.removeItem('pharmacy_user');
      }
    }
  }, []);

  // Load cart count when user changes
  const loadCartCount = useCallback(async () => {
    if (currentUser) {
      try {
        const cartItems = await trpc.cart.getItems.query({ userId: currentUser.id });
        setCartItemCount(cartItems.length);
      } catch (error) {
        console.error('Failed to load cart count:', error);
      }
    } else {
      setCartItemCount(0);
    }
  }, [currentUser]);

  useEffect(() => {
    loadCartCount();
  }, [loadCartCount]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('pharmacy_user', JSON.stringify(user));
    setActiveTab('catalog');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('pharmacy_user');
    setActiveTab('catalog');
  };

  const updateCartCount = () => {
    loadCartCount();
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-blue-800 mb-2">🏥 HealthCare Pharmacy</h1>
            <p className="text-gray-600">Your trusted online pharmacy for medicines and health products</p>
          </div>
          <div className="max-w-md mx-auto">
            <AuthForm onLogin={handleLogin} />
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'pharmacist';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-blue-800">🏥 HealthCare Pharmacy</h1>
              {currentUser.role === 'admin' && (
                <Badge variant="destructive">Admin</Badge>
              )}
              {currentUser.role === 'pharmacist' && (
                <Badge variant="secondary">Pharmacist</Badge>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="font-medium">
                  {currentUser.first_name} {currentUser.last_name}
                </p>
                <p className="text-sm text-gray-500">{currentUser.email}</p>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-6 lg:grid-cols-7 w-full">
            <TabsTrigger value="catalog">🛒 Catalog</TabsTrigger>
            <TabsTrigger value="cart" className="relative">
              🛍️ Cart
              {cartItemCount > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs">
                  {cartItemCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="orders">📦 Orders</TabsTrigger>
            <TabsTrigger value="prescriptions">💊 Prescriptions</TabsTrigger>
            <TabsTrigger value="consultation">👨‍⚕️ Consult</TabsTrigger>
            {isAdmin && <TabsTrigger value="admin">⚙️ Admin</TabsTrigger>}
          </TabsList>

          <TabsContent value="catalog">
            <ProductCatalog 
              currentUser={currentUser} 
              onCartUpdate={updateCartCount}
            />
          </TabsContent>

          <TabsContent value="cart">
            <ShoppingCart 
              currentUser={currentUser} 
              onCartUpdate={updateCartCount}
              onOrderComplete={() => setActiveTab('orders')}
            />
          </TabsContent>

          <TabsContent value="orders">
            <OrderHistory currentUser={currentUser} />
          </TabsContent>

          <TabsContent value="prescriptions">
            <PrescriptionUpload currentUser={currentUser} />
          </TabsContent>

          <TabsContent value="consultation">
            <Consultation currentUser={currentUser} />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="admin">
              <AdminPanel currentUser={currentUser} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

export default App;
