
import { db } from '../db';
import { productsTable, categoriesTable } from '../db/schema';
import { type Product, type CreateProductInput, type UpdateProductInput, type SearchProductsInput } from '../schema';
import { eq, and, gte, lte, ilike, desc, SQL } from 'drizzle-orm';

export async function getProducts(): Promise<Product[]> {
  try {
    const results = await db.select()
      .from(productsTable)
      .where(eq(productsTable.is_active, true))
      .orderBy(desc(productsTable.created_at))
      .execute();

    return results.map(product => ({
      ...product,
      price: parseFloat(product.price)
    }));
  } catch (error) {
    console.error('Failed to fetch products:', error);
    throw error;
  }
}

export async function getProductById(id: number): Promise<Product | null> {
  try {
    const results = await db.select()
      .from(productsTable)
      .where(and(
        eq(productsTable.id, id),
        eq(productsTable.is_active, true)
      ))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const product = results[0];
    return {
      ...product,
      price: parseFloat(product.price)
    };
  } catch (error) {
    console.error('Failed to fetch product by ID:', error);
    throw error;
  }
}

export async function searchProducts(input: SearchProductsInput): Promise<{ products: Product[]; total: number }> {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [eq(productsTable.is_active, true)];

    if (input.query) {
      conditions.push(ilike(productsTable.name, `%${input.query}%`));
    }

    if (input.category_id !== undefined) {
      conditions.push(eq(productsTable.category_id, input.category_id));
    }

    if (input.requires_prescription !== undefined) {
      conditions.push(eq(productsTable.requires_prescription, input.requires_prescription));
    }

    if (input.min_price !== undefined) {
      conditions.push(gte(productsTable.price, input.min_price.toString()));
    }

    if (input.max_price !== undefined) {
      conditions.push(lte(productsTable.price, input.max_price.toString()));
    }

    if (input.manufacturer) {
      conditions.push(ilike(productsTable.manufacturer, `%${input.manufacturer}%`));
    }

    // Build where clause
    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    // Execute queries
    const [products, countResult] = await Promise.all([
      db.select()
        .from(productsTable)
        .where(whereClause)
        .orderBy(desc(productsTable.created_at))
        .limit(input.limit)
        .offset(input.offset)
        .execute(),
      db.select()
        .from(productsTable)
        .where(whereClause)
        .execute()
    ]);

    return {
      products: products.map(product => ({
        ...product,
        price: parseFloat(product.price)
      })),
      total: countResult.length
    };
  } catch (error) {
    console.error('Failed to search products:', error);
    throw error;
  }
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  try {
    // Verify category exists
    const categoryExists = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, input.category_id))
      .execute();

    if (categoryExists.length === 0) {
      throw new Error(`Category with id ${input.category_id} does not exist`);
    }

    const results = await db.insert(productsTable)
      .values({
        name: input.name,
        description: input.description,
        generic_name: input.generic_name,
        manufacturer: input.manufacturer,
        price: input.price.toString(),
        stock_quantity: input.stock_quantity,
        category_id: input.category_id,
        requires_prescription: input.requires_prescription,
        dosage: input.dosage,
        active_ingredients: input.active_ingredients,
        side_effects: input.side_effects,
        warnings: input.warnings,
        image_url: input.image_url
      })
      .returning()
      .execute();

    const product = results[0];
    return {
      ...product,
      price: parseFloat(product.price)
    };
  } catch (error) {
    console.error('Failed to create product:', error);
    throw error;
  }
}

export async function updateProduct(input: UpdateProductInput): Promise<Product> {
  try {
    // Verify product exists
    const existingProduct = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, input.id))
      .execute();

    if (existingProduct.length === 0) {
      throw new Error(`Product with id ${input.id} does not exist`);
    }

    // Verify category exists if category_id is being updated
    if (input.category_id !== undefined) {
      const categoryExists = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, input.category_id))
        .execute();

      if (categoryExists.length === 0) {
        throw new Error(`Category with id ${input.category_id} does not exist`);
      }
    }

    // Build update values
    const updateValues: any = {
      updated_at: new Date()
    };

    if (input.name !== undefined) updateValues.name = input.name;
    if (input.description !== undefined) updateValues.description = input.description;
    if (input.generic_name !== undefined) updateValues.generic_name = input.generic_name;
    if (input.manufacturer !== undefined) updateValues.manufacturer = input.manufacturer;
    if (input.price !== undefined) updateValues.price = input.price.toString();
    if (input.stock_quantity !== undefined) updateValues.stock_quantity = input.stock_quantity;
    if (input.category_id !== undefined) updateValues.category_id = input.category_id;
    if (input.requires_prescription !== undefined) updateValues.requires_prescription = input.requires_prescription;
    if (input.dosage !== undefined) updateValues.dosage = input.dosage;
    if (input.active_ingredients !== undefined) updateValues.active_ingredients = input.active_ingredients;
    if (input.side_effects !== undefined) updateValues.side_effects = input.side_effects;
    if (input.warnings !== undefined) updateValues.warnings = input.warnings;
    if (input.image_url !== undefined) updateValues.image_url = input.image_url;
    if (input.is_active !== undefined) updateValues.is_active = input.is_active;

    const results = await db.update(productsTable)
      .set(updateValues)
      .where(eq(productsTable.id, input.id))
      .returning()
      .execute();

    const product = results[0];
    return {
      ...product,
      price: parseFloat(product.price)
    };
  } catch (error) {
    console.error('Failed to update product:', error);
    throw error;
  }
}

export async function updateProductStock(productId: number, newStock: number): Promise<Product> {
  try {
    // Verify product exists
    const existingProduct = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .execute();

    if (existingProduct.length === 0) {
      throw new Error(`Product with id ${productId} does not exist`);
    }

    const results = await db.update(productsTable)
      .set({
        stock_quantity: newStock,
        updated_at: new Date()
      })
      .where(eq(productsTable.id, productId))
      .returning()
      .execute();

    const product = results[0];
    return {
      ...product,
      price: parseFloat(product.price)
    };
  } catch (error) {
    console.error('Failed to update product stock:', error);
    throw error;
  }
}
