
import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  boolean,
  pgEnum
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['customer', 'admin', 'pharmacist']);
export const prescriptionStatusEnum = pgEnum('prescription_status', ['pending', 'verified', 'rejected']);
export const orderStatusEnum = pgEnum('order_status', ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']);
export const paymentMethodEnum = pgEnum('payment_method', ['cash_on_delivery', 'credit_card', 'debit_card', 'digital_wallet']);
export const deliveryMethodEnum = pgEnum('delivery_method', ['standard', 'express', 'same_day', 'pickup']);
export const consultationStatusEnum = pgEnum('consultation_status', ['pending', 'in_progress', 'completed']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  phone: text('phone'),
  role: userRoleEnum('role').notNull().default('customer'),
  is_verified: boolean('is_verified').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Categories table
export const categoriesTable = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  parent_id: integer('parent_id'),
  is_prescription_required: boolean('is_prescription_required').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Products table
export const productsTable = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  generic_name: text('generic_name'),
  manufacturer: text('manufacturer').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  stock_quantity: integer('stock_quantity').notNull(),
  category_id: integer('category_id').notNull(),
  requires_prescription: boolean('requires_prescription').notNull().default(false),
  dosage: text('dosage'),
  active_ingredients: text('active_ingredients'),
  side_effects: text('side_effects'),
  warnings: text('warnings'),
  image_url: text('image_url'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Prescriptions table
export const prescriptionsTable = pgTable('prescriptions', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  doctor_name: text('doctor_name').notNull(),
  doctor_license: text('doctor_license').notNull(),
  prescription_date: timestamp('prescription_date').notNull(),
  image_url: text('image_url').notNull(),
  status: prescriptionStatusEnum('status').notNull().default('pending'),
  verified_by: integer('verified_by'),
  verification_notes: text('verification_notes'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Cart items table
export const cartItemsTable = pgTable('cart_items', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  product_id: integer('product_id').notNull(),
  quantity: integer('quantity').notNull(),
  prescription_id: integer('prescription_id'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Orders table
export const ordersTable = pgTable('orders', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  total_amount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  status: orderStatusEnum('status').notNull().default('pending'),
  payment_method: paymentMethodEnum('payment_method').notNull(),
  delivery_method: deliveryMethodEnum('delivery_method').notNull(),
  delivery_address: text('delivery_address').notNull(),
  delivery_phone: text('delivery_phone').notNull(),
  notes: text('notes'),
  estimated_delivery: timestamp('estimated_delivery'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Order items table
export const orderItemsTable = pgTable('order_items', {
  id: serial('id').primaryKey(),
  order_id: integer('order_id').notNull(),
  product_id: integer('product_id').notNull(),
  quantity: integer('quantity').notNull(),
  unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  prescription_id: integer('prescription_id'),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Consultations table
export const consultationsTable = pgTable('consultations', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  pharmacist_id: integer('pharmacist_id'),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  response: text('response'),
  status: consultationStatusEnum('status').notNull().default('pending'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  prescriptions: many(prescriptionsTable),
  cartItems: many(cartItemsTable),
  orders: many(ordersTable),
  consultations: many(consultationsTable),
  verifiedPrescriptions: many(prescriptionsTable, { relationName: 'verifier' })
}));

export const categoriesRelations = relations(categoriesTable, ({ one, many }) => ({
  parent: one(categoriesTable, {
    fields: [categoriesTable.parent_id],
    references: [categoriesTable.id],
    relationName: 'parent'
  }),
  children: many(categoriesTable, { relationName: 'parent' }),
  products: many(productsTable)
}));

export const productsRelations = relations(productsTable, ({ one, many }) => ({
  category: one(categoriesTable, {
    fields: [productsTable.category_id],
    references: [categoriesTable.id]
  }),
  cartItems: many(cartItemsTable),
  orderItems: many(orderItemsTable)
}));

export const prescriptionsRelations = relations(prescriptionsTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [prescriptionsTable.user_id],
    references: [usersTable.id]
  }),
  verifiedBy: one(usersTable, {
    fields: [prescriptionsTable.verified_by],
    references: [usersTable.id],
    relationName: 'verifier'
  }),
  cartItems: many(cartItemsTable),
  orderItems: many(orderItemsTable)
}));

export const cartItemsRelations = relations(cartItemsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [cartItemsTable.user_id],
    references: [usersTable.id]
  }),
  product: one(productsTable, {
    fields: [cartItemsTable.product_id],
    references: [productsTable.id]
  }),
  prescription: one(prescriptionsTable, {
    fields: [cartItemsTable.prescription_id],
    references: [prescriptionsTable.id]
  })
}));

export const ordersRelations = relations(ordersTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [ordersTable.user_id],
    references: [usersTable.id]
  }),
  items: many(orderItemsTable)
}));

export const orderItemsRelations = relations(orderItemsTable, ({ one }) => ({
  order: one(ordersTable, {
    fields: [orderItemsTable.order_id],
    references: [ordersTable.id]
  }),
  product: one(productsTable, {
    fields: [orderItemsTable.product_id],
    references: [productsTable.id]
  }),
  prescription: one(prescriptionsTable, {
    fields: [orderItemsTable.prescription_id],
    references: [prescriptionsTable.id]
  })
}));

export const consultationsRelations = relations(consultationsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [consultationsTable.user_id],
    references: [usersTable.id]
  }),
  pharmacist: one(usersTable, {
    fields: [consultationsTable.pharmacist_id],
    references: [usersTable.id]
  })
}));

// Export all tables
export const tables = {
  users: usersTable,
  categories: categoriesTable,
  products: productsTable,
  prescriptions: prescriptionsTable,
  cartItems: cartItemsTable,
  orders: ordersTable,
  orderItems: orderItemsTable,
  consultations: consultationsTable
};
