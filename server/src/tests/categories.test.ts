
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable } from '../db/schema';
import { type CreateCategoryInput } from '../schema';
import { getCategories, getCategoryById, createCategory } from '../handlers/categories';
import { eq } from 'drizzle-orm';

const testCategoryInput: CreateCategoryInput = {
  name: 'Pain Relief',
  description: 'Medications for pain management',
  parent_id: null,
  is_prescription_required: false
};

const testChildCategoryInput: CreateCategoryInput = {
  name: 'Strong Analgesics',
  description: 'Prescription-strength pain medications',
  parent_id: 1,
  is_prescription_required: true
};

describe('Categories Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createCategory', () => {
    it('should create a category', async () => {
      const result = await createCategory(testCategoryInput);

      expect(result.name).toEqual('Pain Relief');
      expect(result.description).toEqual('Medications for pain management');
      expect(result.parent_id).toBeNull();
      expect(result.is_prescription_required).toBe(false);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should save category to database', async () => {
      const result = await createCategory(testCategoryInput);

      const categories = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, result.id))
        .execute();

      expect(categories).toHaveLength(1);
      expect(categories[0].name).toEqual('Pain Relief');
      expect(categories[0].description).toEqual('Medications for pain management');
      expect(categories[0].parent_id).toBeNull();
      expect(categories[0].is_prescription_required).toBe(false);
    });

    it('should create a child category with valid parent_id', async () => {
      // Create parent category first
      const parent = await createCategory(testCategoryInput);

      // Create child category
      const childInput = {
        ...testChildCategoryInput,
        parent_id: parent.id
      };

      const result = await createCategory(childInput);

      expect(result.name).toEqual('Strong Analgesics');
      expect(result.parent_id).toEqual(parent.id);
      expect(result.is_prescription_required).toBe(true);
    });

    it('should throw error for invalid parent_id', async () => {
      const invalidParentInput = {
        ...testChildCategoryInput,
        parent_id: 999
      };

      await expect(createCategory(invalidParentInput))
        .rejects.toThrow(/Parent category with ID 999 does not exist/i);
    });
  });

  describe('getCategoryById', () => {
    it('should return category when found', async () => {
      const created = await createCategory(testCategoryInput);

      const result = await getCategoryById(created.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(created.id);
      expect(result!.name).toEqual('Pain Relief');
      expect(result!.description).toEqual('Medications for pain management');
    });

    it('should return null when category not found', async () => {
      const result = await getCategoryById(999);

      expect(result).toBeNull();
    });
  });

  describe('getCategories', () => {
    it('should return empty array when no categories exist', async () => {
      const result = await getCategories();

      expect(result).toEqual([]);
    });

    it('should return all categories', async () => {
      // Create multiple categories
      await createCategory(testCategoryInput);
      
      const parent = await createCategory({
        name: 'Vitamins',
        description: 'Nutritional supplements',
        parent_id: null,
        is_prescription_required: false
      });

      await createCategory({
        name: 'Vitamin B Complex',
        description: 'B-complex vitamins',
        parent_id: parent.id,
        is_prescription_required: false
      });

      const result = await getCategories();

      expect(result).toHaveLength(3);
      expect(result.map(c => c.name)).toContain('Pain Relief');
      expect(result.map(c => c.name)).toContain('Vitamins');
      expect(result.map(c => c.name)).toContain('Vitamin B Complex');
    });

    it('should return categories with correct hierarchical structure', async () => {
      // Create parent and child categories
      const parent = await createCategory({
        name: 'Antibiotics',
        description: 'Antimicrobial medications',
        parent_id: null,
        is_prescription_required: true
      });

      const child = await createCategory({
        name: 'Penicillins',
        description: 'Penicillin-based antibiotics',
        parent_id: parent.id,
        is_prescription_required: true
      });

      const result = await getCategories();

      const parentCategory = result.find(c => c.id === parent.id);
      const childCategory = result.find(c => c.id === child.id);

      expect(parentCategory!.parent_id).toBeNull();
      expect(childCategory!.parent_id).toEqual(parent.id);
    });
  });
});
