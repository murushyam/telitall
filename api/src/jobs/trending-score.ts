import { sql } from '../config/database.js';

export async function recalculateTrendingScores() {
  try {
    await sql`
      WITH scores AS (
        SELECT q.id,
               (
                 (COUNT(DISTINCT a.id) * 3 + COALESCE(SUM(a.helpful), 0) * 2) /
                 POWER(GREATEST(0.1, EXTRACT(EPOCH FROM (now() - q.created_at)) / 3600) + 2, 1.5)
               ) AS calculated_score
        FROM questions q
        LEFT JOIN answers a ON a.question_id = q.id AND a.is_hidden = false
        WHERE q.is_hidden = false
          AND q.created_at > now() - interval '14 days'
        GROUP BY q.id
      )
      UPDATE questions q
      SET trending_score = s.calculated_score
      FROM scores s
      WHERE q.id = s.id
    `;
    console.log('[Job] Trending scores recalculated');
  } catch (err: any) {
    console.error('[Job Error] Failed to update trending scores:', err.message);
  }
}
