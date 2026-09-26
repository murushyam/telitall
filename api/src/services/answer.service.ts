import { sql } from '../config/database.js';
import { ReputationService } from './reputation.service.js';
import { NotificationService } from './notification.service.js';
import type { AnswerRow, QuestionRow } from '../types/db.js';

export class AnswerService {
  static async listForQuestion(questionId: number) {
    return await sql<AnswerRow[]>`
      SELECT * FROM answers
      WHERE question_id = ${questionId} AND is_hidden = false
      ORDER BY is_best DESC, helpful DESC, created_at ASC
    `;
  }

  static async create(params: {
    questionId: number;
    userId: string;
    authorName: string;
    authorRole?: string;
    authorSpecialty?: string;
    body: string;
  }) {
    const [question] = await sql<QuestionRow[]>`
      SELECT * FROM questions WHERE id = ${params.questionId} AND is_hidden = false
    `;
    if (!question) {
      throw new Error('Question not found');
    }

    const [answer] = await sql<AnswerRow[]>`
      INSERT INTO answers (
        question_id, user_id, author_name, author_role, author_specialty, body
      ) VALUES (
        ${params.questionId}, ${params.userId}, ${params.authorName},
        ${params.authorRole || 'user'}, ${params.authorSpecialty || ''}, ${params.body}
      )
      RETURNING *
    `;

    // Award +2 reputation points to answerer
    await ReputationService.adjust(params.userId, 2, 'posted_answer');

    // Notify question author if not answering own question
    if (question.user_id !== params.userId) {
      await NotificationService.send({
        userId: question.user_id,
        type: 'new_answer',
        title: 'New answer received',
        body: `${params.authorName} answered your question: "${question.title.slice(0, 50)}..."`,
        data: { questionId: question.id, answerId: answer.id },
      });
    }

    return answer;
  }

  static async markHelpful(answerId: number, userId: string) {
    const [answer] = await sql<AnswerRow[]>`
      SELECT * FROM answers WHERE id = ${answerId}
    `;
    if (!answer) {
      throw new Error('Answer not found');
    }

    if (answer.user_id === userId) {
      throw new Error('You cannot vote for your own answer');
    }

    // Check if user already voted
    const existing = await sql`
      SELECT 1 FROM helpful_votes WHERE user_id = ${userId} AND answer_id = ${answerId}
    `;
    if (existing.length > 0) {
      return { alreadyVoted: true, helpful: answer.helpful };
    }

    return await sql.begin(async (tx) => {
      await tx`
        INSERT INTO helpful_votes (user_id, answer_id)
        VALUES (${userId}, ${answerId})
      `;

      const [updated] = await tx<AnswerRow[]>`
        UPDATE answers
        SET helpful = helpful + 1
        WHERE id = ${answerId}
        RETURNING helpful
      `;

      // Award +1 reputation to answer author
      await ReputationService.adjust(answer.user_id, 1, 'answer_marked_helpful');

      await NotificationService.send({
        userId: answer.user_id,
        type: 'answer_helpful',
        title: 'Helpful answer',
        body: 'Someone found your answer helpful (+1 reputation)',
        data: { answerId },
      });

      return { alreadyVoted: false, helpful: updated.helpful };
    });
  }

  static async acceptBest(answerId: number, currentUserId: string) {
    const [answer] = await sql<AnswerRow[]>`
      SELECT * FROM answers WHERE id = ${answerId}
    `;
    if (!answer) {
      throw new Error('Answer not found');
    }

    const [question] = await sql<QuestionRow[]>`
      SELECT * FROM questions WHERE id = ${answer.question_id}
    `;
    if (!question) {
      throw new Error('Question not found');
    }

    if (question.user_id !== currentUserId) {
      throw new Error('Only the question author can accept an answer as best');
    }

    return await sql.begin(async (tx) => {
      // Find any previously accepted answer on this question
      const prevBest = await tx<AnswerRow[]>`
        SELECT * FROM answers
        WHERE question_id = ${question.id} AND is_best = true
      `;

      for (const prev of prevBest) {
        if (prev.id !== answerId) {
          await tx`UPDATE answers SET is_best = false WHERE id = ${prev.id}`;
          await ReputationService.adjust(prev.user_id, -5, 'best_answer_revoked');
        }
      }

      await tx`UPDATE answers SET is_best = true WHERE id = ${answerId}`;
      await ReputationService.adjust(answer.user_id, 5, 'best_answer_accepted');

      await NotificationService.send({
        userId: answer.user_id,
        type: 'answer_accepted',
        title: 'Best Answer Selected!',
        body: `Your answer on "${question.title.slice(0, 45)}..." was marked as the best answer (+5 reputation)`,
        data: { questionId: question.id, answerId },
      });

      return true;
    });
  }
}
