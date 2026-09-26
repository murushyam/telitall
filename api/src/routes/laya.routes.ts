import { Hono } from 'hono';
import { z } from 'zod';
import { LayaService } from '../services/laya.service.js';
import { authMiddleware } from '../middleware/auth.js';

const layaApp = new Hono();

const messageSchema = z.object({
  message: z.string().min(1).max(2000),
  threadId: z.number().optional(),
});

layaApp.post('/message', authMiddleware(), async (c) => {
  const user = c.get('user');
  const body = messageSchema.parse(await c.req.json());

  const result = await LayaService.sendMessage(user.id, body.message, body.threadId);
  return c.json({ success: true, data: result });
});

layaApp.get('/thread/:id', authMiddleware(), async (c) => {
  const user = c.get('user');
  const threadId = parseInt(c.req.param('id'), 10);

  const messages = await LayaService.getMessages(threadId, user.id);
  return c.json({ success: true, data: messages });
});

export default layaApp;
