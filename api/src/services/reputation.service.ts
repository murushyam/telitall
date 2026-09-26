import { sql } from '../config/database.js';

export class ReputationService {
  /**
   * Adjusts user reputation and logs it
   */
  static async adjust(userId: string, points: number, reason: string): Promise<number> {
    const [updated] = await sql`
      UPDATE profiles
      SET reputation = GREATEST(0, reputation + ${points}),
          updated_at = now()
      WHERE user_id = ${userId}
      RETURNING reputation
    `;
    return updated ? updated.reputation : 0;
  }
}
