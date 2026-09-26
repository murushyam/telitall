import type { MiddlewareHandler } from 'hono';
import crypto from 'node:crypto';
import { sql } from '../config/database.js';
import type { AuthUser, ProfileRow } from '../types/db.js';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const authMiddleware = (requireVerified = false): MiddlewareHandler => {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' } }, 401);
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token is empty' } }, 401);
    }

    const tokenHash = hashToken(token);

    try {
      const sessions = await sql`
        SELECT s.id as session_id, s.expires_at, u.id, u.email, u.is_verified,
               p.display_name, p.role, p.specialty, p.reputation, p.avatar_url, p.bio
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        JOIN profiles p ON p.user_id = u.id
        WHERE s.token_hash = ${tokenHash}
          AND s.expires_at > now()
        LIMIT 1
      `;

      if (sessions.length === 0) {
        return c.json({ success: false, error: { code: 'INVALID_SESSION', message: 'Session expired or invalid' } }, 401);
      }

      const row = sessions[0];

      if (requireVerified && !row.is_verified) {
        return c.json({ success: false, error: { code: 'UNVERIFIED_EMAIL', message: 'Please verify your email address to perform this action' } }, 403);
      }

      // Update session sliding expiry (last_active) asynchronously
      sql`UPDATE sessions SET last_active = now() WHERE token_hash = ${tokenHash}`.catch(() => {});

      const authUser: AuthUser = {
        id: row.id,
        email: row.email,
        is_verified: row.is_verified,
        profile: {
          user_id: row.id,
          display_name: row.display_name,
          role: row.role,
          specialty: row.specialty,
          reputation: row.reputation,
          avatar_url: row.avatar_url,
          bio: row.bio,
          created_at: '',
          updated_at: '',
        },
      };

      c.set('user', authUser);
      await next();
    } catch (err: any) {
      console.error('[AuthMiddleware] Error validating session:', err.message);
      return c.json({ success: false, error: { code: 'AUTH_ERROR', message: 'Failed to verify session' } }, 500);
    }
  };
};
