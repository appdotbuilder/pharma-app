
import { db } from '../db';
import { consultationsTable } from '../db/schema';
import { type Consultation, type CreateConsultationInput } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function createConsultation(userId: number, input: CreateConsultationInput): Promise<Consultation> {
  try {
    const result = await db.insert(consultationsTable)
      .values({
        user_id: userId,
        subject: input.subject,
        message: input.message,
        status: 'pending'
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Consultation creation failed:', error);
    throw error;
  }
}

export async function getUserConsultations(userId: number): Promise<Consultation[]> {
  try {
    const results = await db.select()
      .from(consultationsTable)
      .where(eq(consultationsTable.user_id, userId))
      .execute();

    return results;
  } catch (error) {
    console.error('Get user consultations failed:', error);
    throw error;
  }
}

export async function getPendingConsultations(): Promise<Consultation[]> {
  try {
    const results = await db.select()
      .from(consultationsTable)
      .where(eq(consultationsTable.status, 'pending'))
      .execute();

    return results;
  } catch (error) {
    console.error('Get pending consultations failed:', error);
    throw error;
  }
}

export async function assignConsultation(consultationId: number, pharmacistId: number): Promise<Consultation> {
  try {
    const result = await db.update(consultationsTable)
      .set({
        pharmacist_id: pharmacistId,
        status: 'in_progress',
        updated_at: new Date()
      })
      .where(eq(consultationsTable.id, consultationId))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Consultation not found');
    }

    return result[0];
  } catch (error) {
    console.error('Assign consultation failed:', error);
    throw error;
  }
}

export async function respondToConsultation(consultationId: number, pharmacistId: number, response: string): Promise<Consultation> {
  try {
    const result = await db.update(consultationsTable)
      .set({
        response: response,
        status: 'completed',
        updated_at: new Date()
      })
      .where(
        and(
          eq(consultationsTable.id, consultationId),
          eq(consultationsTable.pharmacist_id, pharmacistId)
        )
      )
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Consultation not found or not assigned to this pharmacist');
    }

    return result[0];
  } catch (error) {
    console.error('Respond to consultation failed:', error);
    throw error;
  }
}
