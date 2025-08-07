
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { consultationsTable, usersTable } from '../db/schema';
import { type CreateConsultationInput } from '../schema';
import { 
  createConsultation, 
  getUserConsultations, 
  getPendingConsultations, 
  assignConsultation, 
  respondToConsultation 
} from '../handlers/consultations';
import { eq } from 'drizzle-orm';

describe('consultations', () => {
  let testUserId: number;
  let testPharmacistId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'customer@test.com',
          password_hash: 'hashedpassword',
          first_name: 'John',
          last_name: 'Doe',
          role: 'customer',
          is_verified: true
        },
        {
          email: 'pharmacist@test.com',
          password_hash: 'hashedpassword',
          first_name: 'Jane',
          last_name: 'Smith',
          role: 'pharmacist',
          is_verified: true
        }
      ])
      .returning()
      .execute();

    testUserId = users[0].id;
    testPharmacistId = users[1].id;
  });

  afterEach(resetDB);

  describe('createConsultation', () => {
    const testInput: CreateConsultationInput = {
      subject: 'Medication Side Effects',
      message: 'I am experiencing some side effects from my medication. Can you help?'
    };

    it('should create a consultation', async () => {
      const result = await createConsultation(testUserId, testInput);

      expect(result.user_id).toEqual(testUserId);
      expect(result.subject).toEqual(testInput.subject);
      expect(result.message).toEqual(testInput.message);
      expect(result.pharmacist_id).toBeNull();
      expect(result.response).toBeNull();
      expect(result.status).toEqual('pending');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save consultation to database', async () => {
      const result = await createConsultation(testUserId, testInput);

      const consultations = await db.select()
        .from(consultationsTable)
        .where(eq(consultationsTable.id, result.id))
        .execute();

      expect(consultations).toHaveLength(1);
      expect(consultations[0].user_id).toEqual(testUserId);
      expect(consultations[0].subject).toEqual(testInput.subject);
      expect(consultations[0].message).toEqual(testInput.message);
      expect(consultations[0].status).toEqual('pending');
    });
  });

  describe('getUserConsultations', () => {
    it('should return user consultations', async () => {
      // Create test consultations
      await db.insert(consultationsTable)
        .values([
          {
            user_id: testUserId,
            subject: 'Question 1',
            message: 'Message 1',
            status: 'pending'
          },
          {
            user_id: testUserId,
            subject: 'Question 2',
            message: 'Message 2',
            status: 'completed'
          },
          {
            user_id: testPharmacistId,
            subject: 'Different User',
            message: 'Different message',
            status: 'pending'
          }
        ])
        .execute();

      const results = await getUserConsultations(testUserId);

      expect(results).toHaveLength(2);
      expect(results.every(c => c.user_id === testUserId)).toBe(true);
      expect(results.some(c => c.subject === 'Question 1')).toBe(true);
      expect(results.some(c => c.subject === 'Question 2')).toBe(true);
    });

    it('should return empty array for user with no consultations', async () => {
      const results = await getUserConsultations(testUserId);
      expect(results).toHaveLength(0);
    });
  });

  describe('getPendingConsultations', () => {
    it('should return only pending consultations', async () => {
      // Create test consultations with different statuses
      await db.insert(consultationsTable)
        .values([
          {
            user_id: testUserId,
            subject: 'Pending 1',
            message: 'Message 1',
            status: 'pending'
          },
          {
            user_id: testUserId,
            subject: 'In Progress',
            message: 'Message 2',
            status: 'in_progress'
          },
          {
            user_id: testUserId,
            subject: 'Pending 2',
            message: 'Message 3',
            status: 'pending'
          },
          {
            user_id: testUserId,
            subject: 'Completed',
            message: 'Message 4',
            status: 'completed'
          }
        ])
        .execute();

      const results = await getPendingConsultations();

      expect(results).toHaveLength(2);
      expect(results.every(c => c.status === 'pending')).toBe(true);
      expect(results.some(c => c.subject === 'Pending 1')).toBe(true);
      expect(results.some(c => c.subject === 'Pending 2')).toBe(true);
    });

    it('should return empty array when no pending consultations', async () => {
      // Create only non-pending consultations
      await db.insert(consultationsTable)
        .values([
          {
            user_id: testUserId,
            subject: 'Completed',
            message: 'Message',
            status: 'completed'
          }
        ])
        .execute();

      const results = await getPendingConsultations();
      expect(results).toHaveLength(0);
    });
  });

  describe('assignConsultation', () => {
    let consultationId: number;

    beforeEach(async () => {
      const result = await db.insert(consultationsTable)
        .values({
          user_id: testUserId,
          subject: 'Test Subject',
          message: 'Test message',
          status: 'pending'
        })
        .returning()
        .execute();

      consultationId = result[0].id;
    });

    it('should assign consultation to pharmacist', async () => {
      const result = await assignConsultation(consultationId, testPharmacistId);

      expect(result.id).toEqual(consultationId);
      expect(result.pharmacist_id).toEqual(testPharmacistId);
      expect(result.status).toEqual('in_progress');
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should update consultation in database', async () => {
      await assignConsultation(consultationId, testPharmacistId);

      const consultations = await db.select()
        .from(consultationsTable)
        .where(eq(consultationsTable.id, consultationId))
        .execute();

      expect(consultations).toHaveLength(1);
      expect(consultations[0].pharmacist_id).toEqual(testPharmacistId);
      expect(consultations[0].status).toEqual('in_progress');
    });

    it('should throw error for non-existent consultation', async () => {
      expect(assignConsultation(99999, testPharmacistId)).rejects.toThrow(/not found/i);
    });
  });

  describe('respondToConsultation', () => {
    let consultationId: number;

    beforeEach(async () => {
      const result = await db.insert(consultationsTable)
        .values({
          user_id: testUserId,
          pharmacist_id: testPharmacistId,
          subject: 'Test Subject',
          message: 'Test message',
          status: 'in_progress'
        })
        .returning()
        .execute();

      consultationId = result[0].id;
    });

    it('should add response and complete consultation', async () => {
      const response = 'Here is my professional advice...';
      const result = await respondToConsultation(consultationId, testPharmacistId, response);

      expect(result.id).toEqual(consultationId);
      expect(result.response).toEqual(response);
      expect(result.status).toEqual('completed');
      expect(result.pharmacist_id).toEqual(testPharmacistId);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should update consultation in database', async () => {
      const response = 'Professional advice';
      await respondToConsultation(consultationId, testPharmacistId, response);

      const consultations = await db.select()
        .from(consultationsTable)
        .where(eq(consultationsTable.id, consultationId))
        .execute();

      expect(consultations).toHaveLength(1);
      expect(consultations[0].response).toEqual(response);
      expect(consultations[0].status).toEqual('completed');
    });

    it('should throw error for non-existent consultation', async () => {
      expect(respondToConsultation(99999, testPharmacistId, 'response')).rejects.toThrow(/not found/i);
    });

    it('should throw error when pharmacist not assigned to consultation', async () => {
      // Create another pharmacist
      const otherPharmacist = await db.insert(usersTable)
        .values({
          email: 'other@test.com',
          password_hash: 'hash',
          first_name: 'Other',
          last_name: 'Pharmacist',
          role: 'pharmacist',
          is_verified: true
        })
        .returning()
        .execute();

      expect(respondToConsultation(consultationId, otherPharmacist[0].id, 'response'))
        .rejects.toThrow(/not found or not assigned/i);
    });
  });
});
