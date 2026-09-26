import { sql } from '../config/database.js';
import type { ReportRow } from '../types/db.js';

export class ReportService {
  static async submit(params: {
    reporterId: string;
    targetType: 'question' | 'answer' | 'user' | 'connect_room';
    targetId: string;
    reason: string;
    details?: string;
  }) {
    const [report] = await sql<ReportRow[]>`
      INSERT INTO reports (reporter_id, target_type, target_id, reason, details)
      VALUES (${params.reporterId}, ${params.targetType}, ${params.targetId}, ${params.reason}, ${params.details || null})
      RETURNING *
    `;

    // Auto-moderation check: if an item receives 3+ reports, automatically hide it for review
    const [{ count }] = await sql`
      SELECT COUNT(*)::int as count FROM reports
      WHERE target_type = ${params.targetType} AND target_id = ${params.targetId} AND status = 'pending'
    `;

    if (count >= 3) {
      if (params.targetType === 'question') {
        await sql`UPDATE questions SET is_hidden = true WHERE id = ${parseInt(params.targetId, 10)}`;
      } else if (params.targetType === 'answer') {
        await sql`UPDATE answers SET is_hidden = true WHERE id = ${parseInt(params.targetId, 10)}`;
      }
    }

    return report;
  }

  static async list(status?: string) {
    return await sql<ReportRow[]>`
      SELECT r.*, u.email as reporter_email
      FROM reports r
      JOIN users u ON u.id = r.reporter_id
      WHERE (${status ? sql`r.status = ${status}` : sql`true`})
      ORDER BY r.created_at DESC
    `;
  }

  static async resolve(reportId: number, status: 'resolved' | 'dismissed', actionTaken?: string) {
    const [report] = await sql<ReportRow[]>`
      UPDATE reports
      SET status = ${status},
          resolved_at = now()
      WHERE id = ${reportId}
      RETURNING *
    `;
    return report;
  }
}
