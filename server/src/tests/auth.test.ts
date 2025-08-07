
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterUserInput, type LoginUserInput } from '../schema';
import { registerUser, loginUser, getCurrentUser } from '../handlers/auth';
import { eq } from 'drizzle-orm';

const testUserInput: RegisterUserInput = {
  email: 'test@example.com',
  password: 'password123',
  first_name: 'John',
  last_name: 'Doe',
  phone: '+1234567890'
};

const testUserInputMinimal: RegisterUserInput = {
  email: 'minimal@example.com',
  password: 'password123',
  first_name: 'Jane',
  last_name: 'Smith',
  phone: null
};

describe('registerUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should register a new user', async () => {
    const result = await registerUser(testUserInput);

    expect(result.email).toEqual('test@example.com');
    expect(result.first_name).toEqual('John');
    expect(result.last_name).toEqual('Doe');
    expect(result.phone).toEqual('+1234567890');
    expect(result.role).toEqual('customer');
    expect(result.is_verified).toEqual(false);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toEqual('password123'); // Should be hashed
  });

  it('should register user with minimal data', async () => {
    const result = await registerUser(testUserInputMinimal);

    expect(result.email).toEqual('minimal@example.com');
    expect(result.first_name).toEqual('Jane');
    expect(result.last_name).toEqual('Smith');
    expect(result.phone).toBeNull();
    expect(result.role).toEqual('customer');
    expect(result.is_verified).toEqual(false);
  });

  it('should save user to database', async () => {
    const result = await registerUser(testUserInput);

    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].first_name).toEqual('John');
    expect(users[0].password_hash).toBeDefined();
    expect(users[0].created_at).toBeInstanceOf(Date);
  });

  it('should reject duplicate email registration', async () => {
    await registerUser(testUserInput);

    await expect(registerUser(testUserInput)).rejects.toThrow(/already exists/i);
  });
});

describe('loginUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should login existing user with correct credentials', async () => {
    // Register user first
    const registeredUser = await registerUser(testUserInput);

    const loginInput: LoginUserInput = {
      email: 'test@example.com',
      password: 'password123'
    };

    const result = await loginUser(loginInput);

    expect(result.user).toBeDefined();
    expect(result.token).toBeDefined();
    expect(result.user.id).toEqual(registeredUser.id);
    expect(result.user.email).toEqual('test@example.com');
    expect(result.token).toMatch(/^token_\d+_\d+$/); // Simple token format
  });

  it('should reject login with invalid email', async () => {
    const loginInput: LoginUserInput = {
      email: 'nonexistent@example.com',
      password: 'password123'
    };

    await expect(loginUser(loginInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should reject login with incorrect password', async () => {
    await registerUser(testUserInput);

    const loginInput: LoginUserInput = {
      email: 'test@example.com',
      password: 'wrongpassword'
    };

    await expect(loginUser(loginInput)).rejects.toThrow(/invalid email or password/i);
  });
});

describe('getCurrentUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user for valid user ID', async () => {
    const registeredUser = await registerUser(testUserInput);

    const result = await getCurrentUser(registeredUser.id);

    expect(result).toBeDefined();
    expect(result?.id).toEqual(registeredUser.id);
    expect(result?.email).toEqual('test@example.com');
    expect(result?.first_name).toEqual('John');
    expect(result?.last_name).toEqual('Doe');
  });

  it('should return null for non-existent user ID', async () => {
    const result = await getCurrentUser(99999);

    expect(result).toBeNull();
  });

  it('should return null for invalid user ID', async () => {
    const result = await getCurrentUser(-1);

    expect(result).toBeNull();
  });
});
