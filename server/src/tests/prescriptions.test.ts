
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, prescriptionsTable } from '../db/schema';
import { type UploadPrescriptionInput } from '../schema';
import { uploadPrescription, getUserPrescriptions, getPendingPrescriptions, verifyPrescription } from '../handlers/prescriptions';
import { eq } from 'drizzle-orm';

// Test input data
const testPrescriptionInput: UploadPrescriptionInput = {
  doctor_name: 'Dr. John Smith',
  doctor_license: 'MD123456',
  prescription_date: new Date('2024-01-15'),
  image_url: 'https://example.com/prescription.jpg'
};

describe('Prescription Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let pharmacistId: number;

  beforeEach(async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'customer@test.com',
          password_hash: 'hashed_password',
          first_name: 'John',
          last_name: 'Customer',
          role: 'customer'
        },
        {
          email: 'pharmacist@test.com',
          password_hash: 'hashed_password',
          first_name: 'Jane',
          last_name: 'Pharmacist',
          role: 'pharmacist'
        }
      ])
      .returning()
      .execute();

    testUserId = users[0].id;
    pharmacistId = users[1].id;
  });

  describe('uploadPrescription', () => {
    it('should upload a prescription', async () => {
      const result = await uploadPrescription(testUserId, testPrescriptionInput);

      expect(result.user_id).toEqual(testUserId);
      expect(result.doctor_name).toEqual('Dr. John Smith');
      expect(result.doctor_license).toEqual('MD123456');
      expect(result.prescription_date).toEqual(new Date('2024-01-15'));
      expect(result.image_url).toEqual('https://example.com/prescription.jpg');
      expect(result.status).toEqual('pending');
      expect(result.verified_by).toBeNull();
      expect(result.verification_notes).toBeNull();
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save prescription to database', async () => {
      const result = await uploadPrescription(testUserId, testPrescriptionInput);

      const prescriptions = await db.select()
        .from(prescriptionsTable)
        .where(eq(prescriptionsTable.id, result.id))
        .execute();

      expect(prescriptions).toHaveLength(1);
      expect(prescriptions[0].doctor_name).toEqual('Dr. John Smith');
      expect(prescriptions[0].status).toEqual('pending');
    });
  });

  describe('getUserPrescriptions', () => {
    it('should return empty array when user has no prescriptions', async () => {
      const prescriptions = await getUserPrescriptions(testUserId);

      expect(prescriptions).toEqual([]);
    });

    it('should return user prescriptions', async () => {
      // Create test prescriptions
      await uploadPrescription(testUserId, testPrescriptionInput);
      await uploadPrescription(testUserId, {
        ...testPrescriptionInput,
        doctor_name: 'Dr. Jane Doe'
      });

      const prescriptions = await getUserPrescriptions(testUserId);

      expect(prescriptions).toHaveLength(2);
      expect(prescriptions[0].user_id).toEqual(testUserId);
      expect(prescriptions[1].user_id).toEqual(testUserId);
    });

    it('should only return prescriptions for specific user', async () => {
      // Create another user
      const anotherUser = await db.insert(usersTable)
        .values({
          email: 'another@test.com',
          password_hash: 'hashed_password',
          first_name: 'Another',
          last_name: 'User',
          role: 'customer'
        })
        .returning()
        .execute();

      // Upload prescriptions for both users
      await uploadPrescription(testUserId, testPrescriptionInput);
      await uploadPrescription(anotherUser[0].id, testPrescriptionInput);

      const userPrescriptions = await getUserPrescriptions(testUserId);

      expect(userPrescriptions).toHaveLength(1);
      expect(userPrescriptions[0].user_id).toEqual(testUserId);
    });
  });

  describe('getPendingPrescriptions', () => {
    it('should return empty array when no pending prescriptions', async () => {
      const prescriptions = await getPendingPrescriptions();

      expect(prescriptions).toEqual([]);
    });

    it('should return only pending prescriptions', async () => {
      // Upload test prescription
      const prescription = await uploadPrescription(testUserId, testPrescriptionInput);

      // Verify one prescription
      await verifyPrescription(prescription.id, pharmacistId, 'verified');

      // Upload another prescription (will be pending)
      await uploadPrescription(testUserId, {
        ...testPrescriptionInput,
        doctor_name: 'Dr. Jane Doe'
      });

      const pendingPrescriptions = await getPendingPrescriptions();

      expect(pendingPrescriptions).toHaveLength(1);
      expect(pendingPrescriptions[0].status).toEqual('pending');
      expect(pendingPrescriptions[0].doctor_name).toEqual('Dr. Jane Doe');
    });
  });

  describe('verifyPrescription', () => {
    it('should verify prescription with approved status', async () => {
      const prescription = await uploadPrescription(testUserId, testPrescriptionInput);

      const result = await verifyPrescription(prescription.id, pharmacistId, 'verified', 'Prescription looks valid');

      expect(result.id).toEqual(prescription.id);
      expect(result.status).toEqual('verified');
      expect(result.verified_by).toEqual(pharmacistId);
      expect(result.verification_notes).toEqual('Prescription looks valid');
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should reject prescription with notes', async () => {
      const prescription = await uploadPrescription(testUserId, testPrescriptionInput);

      const result = await verifyPrescription(prescription.id, pharmacistId, 'rejected', 'Invalid doctor license');

      expect(result.status).toEqual('rejected');
      expect(result.verified_by).toEqual(pharmacistId);
      expect(result.verification_notes).toEqual('Invalid doctor license');
    });

    it('should verify prescription without notes', async () => {
      const prescription = await uploadPrescription(testUserId, testPrescriptionInput);

      const result = await verifyPrescription(prescription.id, pharmacistId, 'verified');

      expect(result.status).toEqual('verified');
      expect(result.verified_by).toEqual(pharmacistId);
      expect(result.verification_notes).toBeNull();
    });

    it('should update prescription in database', async () => {
      const prescription = await uploadPrescription(testUserId, testPrescriptionInput);

      await verifyPrescription(prescription.id, pharmacistId, 'verified', 'Valid prescription');

      const updatedPrescriptions = await db.select()
        .from(prescriptionsTable)
        .where(eq(prescriptionsTable.id, prescription.id))
        .execute();

      expect(updatedPrescriptions[0].status).toEqual('verified');
      expect(updatedPrescriptions[0].verified_by).toEqual(pharmacistId);
      expect(updatedPrescriptions[0].verification_notes).toEqual('Valid prescription');
    });
  });
});
