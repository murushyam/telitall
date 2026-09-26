import { Hono } from 'hono';
import { z } from 'zod';
import { AuthService } from '../services/auth.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';

const authApp = new Hono();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(2).max(40),
  role: z.enum(['user', 'expert']).optional(),
  specialty: z.string().max(80).optional(),
});

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Rate limit: 5 signups per hour
authApp.post('/signup', rateLimit({ windowSeconds: 3600, maxRequests: 5, keyPrefix: 'rl:signup' }), async (c) => {
  const body = signupSchema.parse(await c.req.json());
  const result = await AuthService.signup(body);
  return c.json({ success: true, data: result }, 201);
});

// Rate limit: 10 signins per 15 minutes
authApp.post('/signin', rateLimit({ windowSeconds: 900, maxRequests: 10, keyPrefix: 'rl:signin' }), async (c) => {
  const body = signinSchema.parse(await c.req.json());
  const result = await AuthService.signin(body);
  return c.json({ success: true, data: result });
});

authApp.post('/signout', authMiddleware(), async (c) => {
  const authHeader = c.req.header('Authorization')!;
  const token = authHeader.substring(7).trim();
  await AuthService.signout(token);
  return c.json({ success: true });
});

authApp.get('/me', authMiddleware(), async (c) => {
  const user = c.get('user');
  return c.json({ success: true, data: user });
});

authApp.post('/verify-email', async (c) => {
  const { token } = await c.req.json<{ token: string }>();
  if (!token) return c.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Token required' } }, 400);
  await AuthService.verifyEmail(token);
  return c.json({ success: true, message: 'Email successfully verified' });
});

export default authApp;
