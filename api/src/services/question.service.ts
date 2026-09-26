import { sql } from '../config/database.js';
import { ReputationService } from './reputation.service.js';
import type { QuestionRow } from '../types/db.js';

export interface QuestionFilters {
  category?: string;
  kind?: 'experience' | 'knowledge';
  search?: string;
  sortBy?: 'newest' | 'trending';
  page?: number;
  limit?: number;
}

export class QuestionService {
  static async list(filters: QuestionFilters = {}) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(50, Math.max(1, filters.limit || 15));
    const offset = (page - 1) * limit;

    let rows: any[];

    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      rows = await sql`
        SELECT q.*,
               COUNT(a.id)::int AS answer_count,
               ts_rank(q.search_vector, plainto_tsquery('english', ${q})) AS rank
        FROM questions q
        LEFT JOIN answers a ON a.question_id = q.id AND a.is_hidden = false
        WHERE q.is_hidden = false
          AND (${filters.category ? sql`q.category = ${filters.category}` : sql`true`})
          AND (${filters.kind ? sql`q.kind = ${filters.kind}` : sql`true`})
          AND (q.search_vector @@ plainto_tsquery('english', ${q}) OR q.title ILIKE ${'%' + q + '%'})
        GROUP BY q.id
        ORDER BY rank DESC, q.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      const orderClause = filters.sortBy === 'trending'
        ? sql`ORDER BY q.trending_score DESC, q.created_at DESC`
        : sql`ORDER BY q.created_at DESC`;

      rows = await sql`
        SELECT q.*,
               COUNT(a.id)::int AS answer_count
        FROM questions q
        LEFT JOIN answers a ON a.question_id = q.id AND a.is_hidden = false
        WHERE q.is_hidden = false
          AND (${filters.category ? sql`q.category = ${filters.category}` : sql`true`})
          AND (${filters.kind ? sql`q.kind = ${filters.kind}` : sql`true`})
        GROUP BY q.id
        ${orderClause}
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const [countResult] = await sql`
      SELECT COUNT(*)::int AS total
      FROM questions
      WHERE is_hidden = false
        AND (${filters.category ? sql`category = ${filters.category}` : sql`true`})
        AND (${filters.kind ? sql`kind = ${filters.kind}` : sql`true`})
    `;

    const total = countResult ? countResult.total : 0;

    return {
      items: rows,
      total,
      page,
      limit,
      hasMore: offset + rows.length < total,
    };
  }

  static async getById(id: number) {
    const [question] = await sql<QuestionRow[]>`
      SELECT * FROM questions
      WHERE id = ${id} AND is_hidden = false
    `;
    return question || null;
  }

  static async create(params: {
    userId: string;
    authorName: string;
    authorRole?: string;
    authorSpecialty?: string;
    title: string;
    body: string;
    category: string;
    kind: 'experience' | 'knowledge';
  }) {
    const [question] = await sql<QuestionRow[]>`
      INSERT INTO questions (
        user_id, author_name, author_role, author_specialty,
        title, body, category, kind
      ) VALUES (
        ${params.userId}, ${params.authorName}, ${params.authorRole || 'user'},
        ${params.authorSpecialty || ''}, ${params.title}, ${params.body},
        ${params.category}, ${params.kind}
      )
      RETURNING *
    `;

    // Award +1 reputation point for posting a question
    await ReputationService.adjust(params.userId, 1, 'posted_question');

    return question;
  }

  static async update(id: number, userId: string, params: { title?: string; body?: string }) {
    const [updated] = await sql<QuestionRow[]>`
      UPDATE questions
      SET title = COALESCE(${params.title}, title),
          body = COALESCE(${params.body}, body),
          edited_at = now()
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `;
    return updated || null;
  }

  static async delete(id: number, userId: string) {
    const [deleted] = await sql`
      DELETE FROM questions
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING id
    `;
    return !!deleted;
  }
}
