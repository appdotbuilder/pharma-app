
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

// Import schemas
import { 
  registerUserInputSchema, 
  loginUserInputSchema,
  createProductInputSchema,
  updateProductInputSchema,
  searchProductsInputSchema,
  addToCartInputSchema,
  createOrderInputSchema,
  uploadPrescriptionInputSchema,
  createConsultationInputSchema,
  createCategoryInputSchema,
  prescriptionStatusSchema,
  orderStatusSchema
} from './schema';

// Import handlers
import { registerUser, loginUser, getCurrentUser } from './handlers/auth';
import { getCategories, getCategoryById, createCategory } from './handlers/categories';
import { 
  getProducts, 
  getProductById, 
  searchProducts, 
  createProduct, 
  updateProduct,
  updateProductStock 
} from './handlers/products';
import { 
  uploadPrescription, 
  getUserPrescriptions, 
  getPendingPrescriptions,
  verifyPrescription 
} from './handlers/prescriptions';
import { 
  getCartItems, 
  addToCart, 
  updateCartItem, 
  removeFromCart, 
  clearCart 
} from './handlers/cart';
import { 
  createOrder, 
  getUserOrders, 
  getOrderById, 
  getOrderItems,
  updateOrderStatus,
  getAllOrders,
  getOrdersByStatus 
} from './handlers/orders';
import { 
  createConsultation, 
  getUserConsultations, 
  getPendingConsultations,
  assignConsultation,
  respondToConsultation 
} from './handlers/consultations';
import { 
  getSalesReport, 
  getInventoryReport, 
  getCustomerReport 
} from './handlers/reports';

import { z } from 'zod';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  auth: router({
    register: publicProcedure
      .input(registerUserInputSchema)
      .mutation(({ input }) => registerUser(input)),
    
    login: publicProcedure
      .input(loginUserInputSchema)
      .mutation(({ input }) => loginUser(input)),
    
    getCurrentUser: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => getCurrentUser(input.userId))
  }),

  // Category routes
  categories: router({
    getAll: publicProcedure
      .query(() => getCategories()),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getCategoryById(input.id)),
    
    create: publicProcedure
      .input(createCategoryInputSchema)
      .mutation(({ input }) => createCategory(input))
  }),

  // Product routes
  products: router({
    getAll: publicProcedure
      .query(() => getProducts()),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getProductById(input.id)),
    
    search: publicProcedure
      .input(searchProductsInputSchema)
      .query(({ input }) => searchProducts(input)),
    
    create: publicProcedure
      .input(createProductInputSchema)
      .mutation(({ input }) => createProduct(input)),
    
    update: publicProcedure
      .input(updateProductInputSchema)
      .mutation(({ input }) => updateProduct(input)),
    
    updateStock: publicProcedure
      .input(z.object({ productId: z.number(), newStock: z.number().int().nonnegative() }))
      .mutation(({ input }) => updateProductStock(input.productId, input.newStock))
  }),

  // Prescription routes
  prescriptions: router({
    upload: publicProcedure
      .input(z.object({ userId: z.number() }).merge(uploadPrescriptionInputSchema))
      .mutation(({ input }) => uploadPrescription(input.userId, input)),
    
    getUserPrescriptions: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => getUserPrescriptions(input.userId)),
    
    getPending: publicProcedure
      .query(() => getPendingPrescriptions()),
    
    verify: publicProcedure
      .input(z.object({ 
        prescriptionId: z.number(), 
        verifierId: z.number(), 
        status: prescriptionStatusSchema,
        notes: z.string().optional() 
      }))
      .mutation(({ input }) => verifyPrescription(input.prescriptionId, input.verifierId, input.status, input.notes))
  }),

  // Cart routes
  cart: router({
    getItems: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => getCartItems(input.userId)),
    
    addItem: publicProcedure
      .input(z.object({ userId: z.number() }).merge(addToCartInputSchema))
      .mutation(({ input }) => addToCart(input.userId, input)),
    
    updateItem: publicProcedure
      .input(z.object({ userId: z.number(), cartItemId: z.number(), quantity: z.number().int().positive() }))
      .mutation(({ input }) => updateCartItem(input.userId, input.cartItemId, input.quantity)),
    
    removeItem: publicProcedure
      .input(z.object({ userId: z.number(), cartItemId: z.number() }))
      .mutation(({ input }) => removeFromCart(input.userId, input.cartItemId)),
    
    clear: publicProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(({ input }) => clearCart(input.userId))
  }),

  // Order routes
  orders: router({
    create: publicProcedure
      .input(z.object({ userId: z.number() }).merge(createOrderInputSchema))
      .mutation(({ input }) => createOrder(input.userId, input)),
    
    getUserOrders: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => getUserOrders(input.userId)),
    
    getById: publicProcedure
      .input(z.object({ orderId: z.number(), userId: z.number().optional() }))
      .query(({ input }) => getOrderById(input.orderId, input.userId)),
    
    getItems: publicProcedure
      .input(z.object({ orderId: z.number() }))
      .query(({ input }) => getOrderItems(input.orderId)),
    
    updateStatus: publicProcedure
      .input(z.object({ orderId: z.number(), status: orderStatusSchema }))
      .mutation(({ input }) => updateOrderStatus(input.orderId, input.status)),
    
    getAll: publicProcedure
      .query(() => getAllOrders()),
    
    getByStatus: publicProcedure
      .input(z.object({ status: orderStatusSchema }))
      .query(({ input }) => getOrdersByStatus(input.status))
  }),

  // Consultation routes
  consultations: router({
    create: publicProcedure
      .input(z.object({ userId: z.number() }).merge(createConsultationInputSchema))
      .mutation(({ input }) => createConsultation(input.userId, input)),
    
    getUserConsultations: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => getUserConsultations(input.userId)),
    
    getPending: publicProcedure
      .query(() => getPendingConsultations()),
    
    assign: publicProcedure
      .input(z.object({ consultationId: z.number(), pharmacistId: z.number() }))
      .mutation(({ input }) => assignConsultation(input.consultationId, input.pharmacistId)),
    
    respond: publicProcedure
      .input(z.object({ consultationId: z.number(), pharmacistId: z.number(), response: z.string() }))
      .mutation(({ input }) => respondToConsultation(input.consultationId, input.pharmacistId, input.response))
  }),

  // Report routes (Admin only)
  reports: router({
    sales: publicProcedure
      .input(z.object({ startDate: z.coerce.date(), endDate: z.coerce.date() }))
      .query(({ input }) => getSalesReport(input.startDate, input.endDate)),
    
    inventory: publicProcedure
      .query(() => getInventoryReport()),
    
    customers: publicProcedure
      .query(() => getCustomerReport())
  })
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC Pharmacy API server listening at port: ${port}`);
}

start();
