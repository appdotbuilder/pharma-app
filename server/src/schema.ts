
import { z } from 'zod';

// User role enum
export const userRoleSchema = z.enum(['customer', 'admin', 'pharmacist']);
export type UserRole = z.infer<typeof userRoleSchema>;

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string().nullable(),
  role: userRoleSchema,
  is_verified: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Product category schema
export const categorySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  parent_id: z.number().nullable(),
  is_prescription_required: z.boolean(),
  created_at: z.coerce.date()
});

export type Category = z.infer<typeof categorySchema>;

// Product schema
export const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  generic_name: z.string().nullable(),
  manufacturer: z.string(),
  price: z.number(),
  stock_quantity: z.number().int(),
  category_id: z.number(),
  requires_prescription: z.boolean(),
  dosage: z.string().nullable(),
  active_ingredients: z.string().nullable(),
  side_effects: z.string().nullable(),
  warnings: z.string().nullable(),
  image_url: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Product = z.infer<typeof productSchema>;

// Prescription status enum
export const prescriptionStatusSchema = z.enum(['pending', 'verified', 'rejected']);
export type PrescriptionStatus = z.infer<typeof prescriptionStatusSchema>;

// Prescription schema
export const prescriptionSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  doctor_name: z.string(),
  doctor_license: z.string(),
  prescription_date: z.coerce.date(),
  image_url: z.string(),
  status: prescriptionStatusSchema,
  verified_by: z.number().nullable(),
  verification_notes: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Prescription = z.infer<typeof prescriptionSchema>;

// Cart schema
export const cartItemSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  product_id: z.number(),
  quantity: z.number().int(),
  prescription_id: z.number().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type CartItem = z.infer<typeof cartItemSchema>;

// Order status enum
export const orderStatusSchema = z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

// Payment method enum
export const paymentMethodSchema = z.enum(['cash_on_delivery', 'credit_card', 'debit_card', 'digital_wallet']);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

// Delivery method enum
export const deliveryMethodSchema = z.enum(['standard', 'express', 'same_day', 'pickup']);
export type DeliveryMethod = z.infer<typeof deliveryMethodSchema>;

// Order schema
export const orderSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  total_amount: z.number(),
  status: orderStatusSchema,
  payment_method: paymentMethodSchema,
  delivery_method: deliveryMethodSchema,
  delivery_address: z.string(),
  delivery_phone: z.string(),
  notes: z.string().nullable(),
  estimated_delivery: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Order = z.infer<typeof orderSchema>;

// Order item schema
export const orderItemSchema = z.object({
  id: z.number(),
  order_id: z.number(),
  product_id: z.number(),
  quantity: z.number().int(),
  unit_price: z.number(),
  prescription_id: z.number().nullable(),
  created_at: z.coerce.date()
});

export type OrderItem = z.infer<typeof orderItemSchema>;

// Consultation schema
export const consultationSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  pharmacist_id: z.number().nullable(),
  subject: z.string(),
  message: z.string(),
  response: z.string().nullable(),
  status: z.enum(['pending', 'in_progress', 'completed']),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Consultation = z.infer<typeof consultationSchema>;

// Input schemas for creating/updating

// User registration input
export const registerUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string().nullable()
});

export type RegisterUserInput = z.infer<typeof registerUserInputSchema>;

// User login input
export const loginUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginUserInput = z.infer<typeof loginUserInputSchema>;

// Product creation input
export const createProductInputSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  generic_name: z.string().nullable(),
  manufacturer: z.string(),
  price: z.number().positive(),
  stock_quantity: z.number().int().nonnegative(),
  category_id: z.number(),
  requires_prescription: z.boolean(),
  dosage: z.string().nullable(),
  active_ingredients: z.string().nullable(),
  side_effects: z.string().nullable(),
  warnings: z.string().nullable(),
  image_url: z.string().nullable()
});

export type CreateProductInput = z.infer<typeof createProductInputSchema>;

// Product update input
export const updateProductInputSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  generic_name: z.string().nullable().optional(),
  manufacturer: z.string().optional(),
  price: z.number().positive().optional(),
  stock_quantity: z.number().int().nonnegative().optional(),
  category_id: z.number().optional(),
  requires_prescription: z.boolean().optional(),
  dosage: z.string().nullable().optional(),
  active_ingredients: z.string().nullable().optional(),
  side_effects: z.string().nullable().optional(),
  warnings: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  is_active: z.boolean().optional()
});

export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;

// Product search/filter input
export const searchProductsInputSchema = z.object({
  query: z.string().optional(),
  category_id: z.number().optional(),
  requires_prescription: z.boolean().optional(),
  min_price: z.number().optional(),
  max_price: z.number().optional(),
  manufacturer: z.string().optional(),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0)
});

export type SearchProductsInput = z.infer<typeof searchProductsInputSchema>;

// Cart item input
export const addToCartInputSchema = z.object({
  product_id: z.number(),
  quantity: z.number().int().positive(),
  prescription_id: z.number().nullable()
});

export type AddToCartInput = z.infer<typeof addToCartInputSchema>;

// Order creation input
export const createOrderInputSchema = z.object({
  payment_method: paymentMethodSchema,
  delivery_method: deliveryMethodSchema,
  delivery_address: z.string(),
  delivery_phone: z.string(),
  notes: z.string().nullable()
});

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

// Prescription upload input
export const uploadPrescriptionInputSchema = z.object({
  doctor_name: z.string(),
  doctor_license: z.string(),
  prescription_date: z.coerce.date(),
  image_url: z.string()
});

export type UploadPrescriptionInput = z.infer<typeof uploadPrescriptionInputSchema>;

// Consultation creation input
export const createConsultationInputSchema = z.object({
  subject: z.string(),
  message: z.string()
});

export type CreateConsultationInput = z.infer<typeof createConsultationInputSchema>;

// Category creation input
export const createCategoryInputSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  parent_id: z.number().nullable(),
  is_prescription_required: z.boolean()
});

export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;
