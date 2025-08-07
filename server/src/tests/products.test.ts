
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable, categoriesTable } from '../db/schema';
import { type CreateProductInput, type UpdateProductInput, type SearchProductsInput } from '../schema';
import { getProducts, getProductById, searchProducts, createProduct, updateProduct, updateProductStock } from '../handlers/products';
import { eq } from 'drizzle-orm';

// Test data
const testCategory = {
  name: 'Test Category',
  description: 'A category for testing',
  parent_id: null,
  is_prescription_required: false
};

const testProductInput: CreateProductInput = {
  name: 'Test Product',
  description: 'A product for testing',
  generic_name: 'Test Generic',
  manufacturer: 'Test Manufacturer',
  price: 19.99,
  stock_quantity: 100,
  category_id: 1,
  requires_prescription: false,
  dosage: '10mg',
  active_ingredients: 'Test ingredient',
  side_effects: 'None',
  warnings: 'Test warning',
  image_url: 'http://example.com/image.jpg'
};

const createTestCategory = async () => {
  const results = await db.insert(categoriesTable)
    .values(testCategory)
    .returning()
    .execute();
  return results[0];
};

describe('Products Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createProduct', () => {
    it('should create a product successfully', async () => {
      // Create prerequisite category
      const category = await createTestCategory();
      const input = { ...testProductInput, category_id: category.id };

      const result = await createProduct(input);

      expect(result.name).toEqual('Test Product');
      expect(result.description).toEqual('A product for testing');
      expect(result.generic_name).toEqual('Test Generic');
      expect(result.manufacturer).toEqual('Test Manufacturer');
      expect(result.price).toEqual(19.99);
      expect(typeof result.price).toBe('number');
      expect(result.stock_quantity).toEqual(100);
      expect(result.category_id).toEqual(category.id);
      expect(result.requires_prescription).toEqual(false);
      expect(result.dosage).toEqual('10mg');
      expect(result.active_ingredients).toEqual('Test ingredient');
      expect(result.side_effects).toEqual('None');
      expect(result.warnings).toEqual('Test warning');
      expect(result.image_url).toEqual('http://example.com/image.jpg');
      expect(result.is_active).toEqual(true);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save product to database', async () => {
      const category = await createTestCategory();
      const input = { ...testProductInput, category_id: category.id };

      const result = await createProduct(input);

      const products = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, result.id))
        .execute();

      expect(products).toHaveLength(1);
      expect(products[0].name).toEqual('Test Product');
      expect(parseFloat(products[0].price)).toEqual(19.99);
      expect(products[0].stock_quantity).toEqual(100);
    });

    it('should throw error for non-existent category', async () => {
      const input = { ...testProductInput, category_id: 999 };

      await expect(createProduct(input)).rejects.toThrow(/category.*does not exist/i);
    });
  });

  describe('getProducts', () => {
    it('should return all active products', async () => {
      const category = await createTestCategory();
      
      // Create test products
      await createProduct({ ...testProductInput, category_id: category.id, name: 'Product 1' });
      await createProduct({ ...testProductInput, category_id: category.id, name: 'Product 2' });

      const results = await getProducts();

      expect(results).toHaveLength(2);
      expect(results[0].name).toEqual('Product 2'); // Should be ordered by created_at desc
      expect(results[1].name).toEqual('Product 1');
      expect(typeof results[0].price).toBe('number');
      expect(results[0].is_active).toEqual(true);
    });

    it('should not return inactive products', async () => {
      const category = await createTestCategory();
      
      // Create active product
      await createProduct({ ...testProductInput, category_id: category.id, name: 'Active Product' });
      
      // Create inactive product
      const inactiveProduct = await createProduct({ ...testProductInput, category_id: category.id, name: 'Inactive Product' });
      await db.update(productsTable)
        .set({ is_active: false })
        .where(eq(productsTable.id, inactiveProduct.id))
        .execute();

      const results = await getProducts();

      expect(results).toHaveLength(1);
      expect(results[0].name).toEqual('Active Product');
    });
  });

  describe('getProductById', () => {
    it('should return product by id', async () => {
      const category = await createTestCategory();
      const createdProduct = await createProduct({ ...testProductInput, category_id: category.id });

      const result = await getProductById(createdProduct.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(createdProduct.id);
      expect(result!.name).toEqual('Test Product');
      expect(typeof result!.price).toBe('number');
      expect(result!.price).toEqual(19.99);
    });

    it('should return null for non-existent product', async () => {
      const result = await getProductById(999);

      expect(result).toBeNull();
    });

    it('should return null for inactive product', async () => {
      const category = await createTestCategory();
      const createdProduct = await createProduct({ ...testProductInput, category_id: category.id });
      
      // Make product inactive
      await db.update(productsTable)
        .set({ is_active: false })
        .where(eq(productsTable.id, createdProduct.id))
        .execute();

      const result = await getProductById(createdProduct.id);

      expect(result).toBeNull();
    });
  });

  describe('searchProducts', () => {
    it('should search products by name', async () => {
      const category = await createTestCategory();
      
      await createProduct({ ...testProductInput, category_id: category.id, name: 'Aspirin' });
      await createProduct({ ...testProductInput, category_id: category.id, name: 'Ibuprofen' });

      const searchInput: SearchProductsInput = {
        query: 'aspirin',
        limit: 20,
        offset: 0
      };

      const result = await searchProducts(searchInput);

      expect(result.products).toHaveLength(1);
      expect(result.products[0].name).toEqual('Aspirin');
      expect(result.total).toEqual(1);
      expect(typeof result.products[0].price).toBe('number');
    });

    it('should filter by category', async () => {
      const category1 = await createTestCategory();
      const category2 = await db.insert(categoriesTable)
        .values({ ...testCategory, name: 'Category 2' })
        .returning()
        .execute();

      await createProduct({ ...testProductInput, category_id: category1.id, name: 'Product 1' });
      await createProduct({ ...testProductInput, category_id: category2[0].id, name: 'Product 2' });

      const searchInput: SearchProductsInput = {
        category_id: category1.id,
        limit: 20,
        offset: 0
      };

      const result = await searchProducts(searchInput);

      expect(result.products).toHaveLength(1);
      expect(result.products[0].name).toEqual('Product 1');
      expect(result.total).toEqual(1);
    });

    it('should filter by price range', async () => {
      const category = await createTestCategory();
      
      await createProduct({ ...testProductInput, category_id: category.id, name: 'Cheap Product', price: 5.99 });
      await createProduct({ ...testProductInput, category_id: category.id, name: 'Expensive Product', price: 50.99 });

      const searchInput: SearchProductsInput = {
        min_price: 10,
        max_price: 30,
        limit: 20,
        offset: 0
      };

      const result = await searchProducts(searchInput);

      expect(result.products).toHaveLength(0);
      expect(result.total).toEqual(0);
    });

    it('should filter by prescription requirement', async () => {
      const category = await createTestCategory();
      
      await createProduct({ ...testProductInput, category_id: category.id, name: 'OTC Product', requires_prescription: false });
      await createProduct({ ...testProductInput, category_id: category.id, name: 'Prescription Product', requires_prescription: true });

      const searchInput: SearchProductsInput = {
        requires_prescription: true,
        limit: 20,
        offset: 0
      };

      const result = await searchProducts(searchInput);

      expect(result.products).toHaveLength(1);
      expect(result.products[0].name).toEqual('Prescription Product');
      expect(result.products[0].requires_prescription).toEqual(true);
    });

    it('should handle pagination', async () => {
      const category = await createTestCategory();
      
      // Create 3 products
      await createProduct({ ...testProductInput, category_id: category.id, name: 'Product 1' });
      await createProduct({ ...testProductInput, category_id: category.id, name: 'Product 2' });
      await createProduct({ ...testProductInput, category_id: category.id, name: 'Product 3' });

      const searchInput: SearchProductsInput = {
        limit: 2,
        offset: 1
      };

      const result = await searchProducts(searchInput);

      expect(result.products).toHaveLength(2);
      expect(result.total).toEqual(3);
    });
  });

  describe('updateProduct', () => {
    it('should update product successfully', async () => {
      const category = await createTestCategory();
      const createdProduct = await createProduct({ ...testProductInput, category_id: category.id });

      const updateInput: UpdateProductInput = {
        id: createdProduct.id,
        name: 'Updated Product',
        price: 29.99,
        stock_quantity: 50
      };

      const result = await updateProduct(updateInput);

      expect(result.id).toEqual(createdProduct.id);
      expect(result.name).toEqual('Updated Product');
      expect(result.price).toEqual(29.99);
      expect(typeof result.price).toBe('number');
      expect(result.stock_quantity).toEqual(50);
      expect(result.manufacturer).toEqual(testProductInput.manufacturer); // Unchanged field
    });

    it('should throw error for non-existent product', async () => {
      const updateInput: UpdateProductInput = {
        id: 999,
        name: 'Updated Product'
      };

      await expect(updateProduct(updateInput)).rejects.toThrow(/product.*does not exist/i);
    });

    it('should throw error for non-existent category', async () => {
      const category = await createTestCategory();
      const createdProduct = await createProduct({ ...testProductInput, category_id: category.id });

      const updateInput: UpdateProductInput = {
        id: createdProduct.id,
        category_id: 999
      };

      await expect(updateProduct(updateInput)).rejects.toThrow(/category.*does not exist/i);
    });
  });

  describe('updateProductStock', () => {
    it('should update stock successfully', async () => {
      const category = await createTestCategory();
      const createdProduct = await createProduct({ ...testProductInput, category_id: category.id });

      const result = await updateProductStock(createdProduct.id, 75);

      expect(result.id).toEqual(createdProduct.id);
      expect(result.stock_quantity).toEqual(75);
      expect(result.name).toEqual(testProductInput.name); // Other fields unchanged
      expect(typeof result.price).toBe('number');
    });

    it('should throw error for non-existent product', async () => {
      await expect(updateProductStock(999, 50)).rejects.toThrow(/product.*does not exist/i);
    });
  });
});
