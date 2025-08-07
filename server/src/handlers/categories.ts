
import { db } from '../db';
import { categoriesTable } from '../db/schema';
import { type Category, type CreateCategoryInput } from '../schema';
import { eq } from 'drizzle-orm';

export async function getCategories(): Promise<Category[]> {
  try {
    const results = await db.select()
      .from(categoriesTable)
      .execute();
    
    return results;
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    throw error;
  }
}

export async function getCategoryById(id: number): Promise<Category | null> {
  try {
    const results = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, id))
      .execute();
    
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Failed to fetch category by ID:', error);
    throw error;
  }
}

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  try {
    // Validate parent_id if provided
    if (input.parent_id !== null && input.parent_id !== undefined) {
      const parentExists = await getCategoryById(input.parent_id);
      if (!parentExists) {
        throw new Error(`Parent category with ID ${input.parent_id} does not exist`);
      }
    }

    const result = await db.insert(categoriesTable)
      .values({
        name: input.name,
        description: input.description,
        parent_id: input.parent_id,
        is_prescription_required: input.is_prescription_required
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Category creation failed:', error);
    throw error;
  }
}
