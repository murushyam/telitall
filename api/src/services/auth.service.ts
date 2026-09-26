import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { sql } from '../config/database.js';
import { hashToken } from '../middleware/auth.js';
import type { UserRow, ProfileRow } from '../types/db.js';

const BCRYPT_SALT_ROUNDS = 12;
const SESSION_EXPIRY_DAYS = 30;

export class AuthService {
  static async signup(params: {
    email: string;
    password: string;
    displayName: string;
    role?: 'user' | 'expert';
    specialty?: string;
  }) {
    const existing = await sql<UserRow[]>`
      SELECT id FROM users WHERE email = ${params.email.toLowerCase()}
    `;
    if (existing.length > 0) {
      throw new Error('Email already registered');
    }

    const passwordHash = await bcrypt.hash(params.password, BCRYPT_SALT_ROUNDS);

    return await sql.begin(async (tx) => {
      const [user] = await tx<UserRow[]>`
        INSERT INTO users (email, password_hash)
        VALUES (${params.email.toLowerCase()}, ${passwordHash})
        RETURNING id, email, is_verified, created_at, updated_at
      `;

      const [profile] = await tx<ProfileRow[]>`
        INSERT INTO profiles (user_id, display_name, role, specialty)
        VALUES (${user.id}, ${params.displayName}, ${params.role || 'user'}, ${params.specialty || ''})
        RETURNING *
      `;

      // Generate verification token (24 hour expiration)
      const verifyToken = crypto.randomBytes(32).toString('hex');
      const verifyHash = hashToken(verifyToken);
      await tx`
        INSERT INTO email_verifications (user_id, token_hash, expires_at)
        VALUES (${user.id}, ${verifyHash}, now() + interval '24 hours')
      `;

      // Create initial active session
      const rawSessionToken = crypto.randomBytes(32).toString('hex');
      const sessionHash = hashToken(rawSessionToken);
      await tx`
        INSERT INTO sessions (user_id, token_hash, expires_at)
        VALUES (${user.id}, ${sessionHash}, now() + interval '30 days')
      `;

      return {
        user: {
          id: user.id,
          email: user.email,
          is_verified: user.is_verified,
          profile,
        },
        token: rawSessionToken,
        verifyToken, // In production, sent via Resend email
      };
    });
  }

  static async signin(params: { email: string; password: string }) {
    const users = await sql<UserRow[]>`
      SELECT * FROM users WHERE email = ${params.email.toLowerCase()}
    `;
    if (users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = users[0];
    const match = await bcrypt.compare(params.password, user.password_hash);
    if (!match) {
      throw new Error('Invalid email or password');
    }

    const [profile] = await sql<ProfileRow[]>`
      SELECT * FROM profiles WHERE user_id = ${user.id}
    `;

    // Create new session
    const rawSessionToken = crypto.randomBytes(32).toString('hex');
    const sessionHash = hashToken(rawSessionToken);
    await sql`
      INSERT INTO sessions (user_id, token_hash, expires_at)
      VALUES (${user.id}, ${sessionHash}, now() + interval '30 days')
    `;

    return {
      user: {
        id: user.id,
        email: user.email,
        is_verified: user.is_verified,
        profile,
      },
      token: rawSessionToken,
    };
  }

  static async signout(token: string) {
    const sessionHash = hashToken(token);
    await sql`DELETE FROM sessions WHERE token_hash = ${sessionHash}`;
    return true;
  }

  static async verifyEmail(token: string) {
    const tokenHash = hashToken(token);
    const rows = await sql`
      SELECT user_id FROM email_verifications
      WHERE token_hash = ${tokenHash} AND expires_at > now()
    `;
    if (rows.length === 0) {
      throw new Error('Invalid or expired verification token');
    }

    const userId = rows[0].user_id;
    await sql.begin(async (tx) => {
      await tx`UPDATE users SET is_verified = true WHERE id = ${userId}`;
      await tx`DELETE FROM email_verifications WHERE user_id = ${userId}`;
    });
    return true;
  }
}
