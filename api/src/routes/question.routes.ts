import { Hono } from 'hono';
import { z } from 'zod';
import { QuestionService } from '../services/question.service.js';
import { AnswerService } from '../services/answer.service.js';
import { authMiddleware } from '../middleware/auth.js';

const questionApp = new Hono();

const createQuestionSchema = z.object({
  title: z.string().min(8).max(140),
  body: z.string().min(20).max(4000),
  category: z.enum([
    'relationships', 'life', 'career', 'education', 'mathematics',
    'technology', 'business', 'health', 'home', 'other'
  ]),
  kind: z.enum(['experience', 'knowledge']),
});

questionApp.get('/', async (c) => {
  const category = c.req.query('category');
  const kind = c.req.query('kind') as 'experience' | 'knowledge' | undefined;
  const search = c.req.query('search');
  const sortBy = c.req.query('sortBy') as 'newest' | 'trending' | undefined;
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '15', 10);

  const result = await QuestionService.list({ category, kind, search, sortBy, page, limit });
  return c.json({ success: true, data: result });
});

questionApp.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const question = await QuestionService.getById(id);
  if (!question) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Question not found' } }, 404);
  }

  const answers = await AnswerService.listForQuestion(id);
  return c.json({ success: true, data: { ...question, answers } });
});

questionApp.post('/', authMiddleware(true), async (c) => {
  const user = c.get('user');
  const body = createQuestionSchema.parse(await c.req.json());

  const question = await QuestionService.create({
    userId: user.id,
    authorName: user.profile.display_name,
    authorRole: user.profile.role,
    authorSpecialty: user.profile.specialty || '',
    title: body.title,
    body: body.body,
    category: body.category,
    kind: body.kind,
  });

  return c.json({ success: true, data: question }, 201);
});

questionApp.put('/:id', authMiddleware(), async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'), 10);
  const body = await c.req.json<{ title?: string; body?: string }>();

  const updated = await QuestionService.update(id, user.id, body);
  if (!updated) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Question not found or unauthorized' } }, 403);
  }

  return c.json({ success: true, data: updated });
});

questionApp.delete('/:id', authMiddleware(), async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'), 10);

  const deleted = await QuestionService.delete(id, user.id);
  if (!deleted) {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Question not found or unauthorized' } }, 403);
  }

  return c.json({ success: true });
});

export default questionApp;
