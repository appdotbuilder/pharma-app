
import { db } from '../db';
import { prescriptionsTable } from '../db/schema';
import { type Prescription, type UploadPrescriptionInput, type PrescriptionStatus } from '../schema';
import { eq } from 'drizzle-orm';

export async function uploadPrescription(userId: number, input: UploadPrescriptionInput): Promise<Prescription> {
  try {
    const result = await db.insert(prescriptionsTable)
      .values({
        user_id: userId,
        doctor_name: input.doctor_name,
        doctor_license: input.doctor_license,
        prescription_date: input.prescription_date,
        image_url: input.image_url
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Prescription upload failed:', error);
    throw error;
  }
}

export async function getUserPrescriptions(userId: number): Promise<Prescription[]> {
  try {
    const results = await db.select()
      .from(prescriptionsTable)
      .where(eq(prescriptionsTable.user_id, userId))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch user prescriptions:', error);
    throw error;
  }
}

export async function getPendingPrescriptions(): Promise<Prescription[]> {
  try {
    const results = await db.select()
      .from(prescriptionsTable)
      .where(eq(prescriptionsTable.status, 'pending'))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch pending prescriptions:', error);
    throw error;
  }
}

export async function verifyPrescription(prescriptionId: number, verifierId: number, status: PrescriptionStatus, notes?: string): Promise<Prescription> {
  try {
    const result = await db.update(prescriptionsTable)
      .set({
        status: status,
        verified_by: verifierId,
        verification_notes: notes || null,
        updated_at: new Date()
      })
      .where(eq(prescriptionsTable.id, prescriptionId))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Prescription verification failed:', error);
    throw error;
  }
}
