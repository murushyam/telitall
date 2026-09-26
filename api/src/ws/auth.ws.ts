import type { Socket } from 'socket.io';
import { sql } from '../config/database.js';
import { hashToken } from '../middleware/auth.js';
import type { AuthUser } from '../types/db.js';

export async function authenticateSocket(socket: Socket): Promise<AuthUser | null> {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
  if (!token) return null;

  try {
    const tokenHash = hashToken(token);
    const sessions = await sql`
      SELECT u.id, u.email, u.is_verified,
             p.display_name, p.role, p.specialty, p.reputation, p.avatar_url, p.bio
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      JOIN profiles p ON p.user_id = u.id
      WHERE s.token_hash = ${tokenHash}
        AND s.expires_at > now()
      LIMIT 1
    `;

    if (sessions.length === 0) return null;

    const row = sessions[0];
    return {
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
  } catch {
    return null;
  }
}
