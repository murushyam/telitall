import { Hono } from 'hono';
import { z } from 'zod';
import { ConnectService } from '../services/connect.service.js';
import { SubscriptionService } from '../services/subscription.service.js';
import { authMiddleware } from '../middleware/auth.js';

const connectApp = new Hono();

const enqueueSchema = z.object({
  topic: z.string().min(2).max(50),
  isExpertOnly: z.boolean().optional(),
});

connectApp.post('/queue', authMiddleware(), async (c) => {
  const user = c.get('user');
  const body = enqueueSchema.parse(await c.req.json());

  // Check user subscription plan for max duration and daily limits
  const userPlan = await SubscriptionService.getUserPlan(user.id);
  const maxDurationMin = userPlan.features?.connect_duration_min || 60;

  const result = await ConnectService.enqueue({
    userId: user.id,
    topic: body.topic,
    role: user.profile.role,
    isExpertOnly: body.isExpertOnly,
    durationMinutes: maxDurationMin,
  });

  return c.json({ success: true, data: result });
});

connectApp.get('/room/:id', authMiddleware(), async (c) => {
  const roomId = c.req.param('id');
  const room = await ConnectService.getRoom(roomId);
  if (!room) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Room not found or expired' } }, 404);
  }
  return c.json({ success: true, data: room });
});

connectApp.post('/room/:id/end', authMiddleware(), async (c) => {
  const roomId = c.req.param('id');
  const success = await ConnectService.endRoom(roomId);
  return c.json({ success });
});

export default connectApp;
