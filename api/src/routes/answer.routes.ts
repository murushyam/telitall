import { Hono } from 'hono';
import { z } from 'zod';
import { AnswerService } from '../services/answer.service.js';
import { authMiddleware } from '../middleware/auth.js';

const answerApp = new Hono();

const postAnswerSchema = z.object({
  body: z.string().min(10).max(4000),
});

answerApp.post('/questions/:id/answers', authMiddleware(true), async (c) => {
  const user = c.get('user');
  const questionId = parseInt(c.req.param('id'), 10);
  const data = postAnswerSchema.parse(await c.req.json());

  const answer = await AnswerService.create({
    questionId,
    userId: user.id,
    authorName: user.profile.display_name,
    authorRole: user.profile.role,
    authorSpecialty: user.profile.specialty || '',
    body: data.body,
  });

  return c.json({ success: true, data: answer }, 201);
});

answerApp.post('/answers/:id/helpful', authMiddleware(), async (c) => {
  const user = c.get('user');
  const answerId = parseInt(c.req.param('id'), 10);

  const result = await AnswerService.markHelpful(answerId, user.id);
  return c.json({ success: true, data: result });
});

answerApp.post('/answers/:id/accept', authMiddleware(), async (c) => {
  const user = c.get('user');
  const answerId = parseInt(c.req.param('id'), 10);

  await AnswerService.acceptBest(answerId, user.id);
  return c.json({ success: true, message: 'Answer marked as best' });
});

export default answerApp;
