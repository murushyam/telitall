import { sql } from '../config/database.js';
import type { NotificationRow } from '../types/db.js';

export class NotificationService {
  static async send(params: {
    userId: string;
    type: 'new_answer' | 'answer_accepted' | 'answer_helpful' | 'connect_match' | 'report_resolved' | 'system';
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }) {
    const [row] = await sql<NotificationRow[]>`
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (${params.userId}, ${params.type}, ${params.title}, ${params.body}, ${params.data ? JSON.stringify(params.data) : '{}'})
      RETURNING *
    `;
    return row;
  }

  static async list(userId: string, limit = 20) {
    return await sql<NotificationRow[]>`
      SELECT * FROM notifications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  }

  static async markAllAsRead(userId: string) {
    await sql`
      UPDATE notifications
      SET is_read = true
      WHERE user_id = ${userId} AND is_read = false
    `;
    return true;
  }
}
