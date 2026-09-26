import { sql } from '../config/database.js';

export async function cleanupExpiredSessions() {
  try {
    const deleted = await sql`
      DELETE FROM sessions
      WHERE expires_at < now()
      RETURNING id
    `;
    if (deleted.length > 0) {
      console.log(`[Job] Cleaned up ${deleted.length} expired sessions`);
    }
  } catch (err: any) {
    console.error('[Job Error] Failed to purge expired sessions:', err.message);
  }
}
