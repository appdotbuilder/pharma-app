
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterUserInput, type LoginUserInput, type User } from '../schema';
import { eq } from 'drizzle-orm';

// Simple password hashing function (in production, use bcrypt)
const hashPassword = async (password: string): Promise<string> => {
  // Using a simple hash for demo purposes - in production use bcrypt
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  const hashedInput = await hashPassword(password);
  return hashedInput === hash;
};

// Simple JWT-like token generation (in production use proper JWT library)
const generateToken = (userId: number): string => {
  return `token_${userId}_${Date.now()}`;
};

export async function registerUser(input: RegisterUserInput): Promise<User> {
  try {
    // Check if user already exists
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (existingUser.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const password_hash = await hashPassword(input.password);

    // Create user
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        password_hash,
        first_name: input.first_name,
        last_name: input.last_name,
        phone: input.phone,
        role: 'customer',
        is_verified: false
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User registration failed:', error);
    throw error;
  }
}

export async function loginUser(input: LoginUserInput): Promise<{ user: User; token: string }> {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = users[0];

    // Verify password
    const isValid = await verifyPassword(input.password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    // Generate token
    const token = generateToken(user.id);

    return {
      user,
      token
    };
  } catch (error) {
    console.error('User login failed:', error);
    throw error;
  }
}

export async function getCurrentUser(userId: number): Promise<User | null> {
  try {
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    return users.length > 0 ? users[0] : null;
  } catch (error) {
    console.error('Get current user failed:', error);
    throw error;
  }
}
