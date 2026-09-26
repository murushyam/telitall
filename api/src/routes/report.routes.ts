import { Hono } from 'hono';
import { z } from 'zod';
import { ReportService } from '../services/report.service.js';
import { authMiddleware } from '../middleware/auth.js';

const reportApp = new Hono();

const submitReportSchema = z.object({
  targetType: z.enum(['question', 'answer', 'user', 'connect_room']),
  targetId: z.string(),
  reason: z.string().min(3).max(100),
  details: z.string().max(1000).optional(),
});

reportApp.post('/', authMiddleware(), async (c) => {
  const user = c.get('user');
  const body = submitReportSchema.parse(await c.req.json());

  const report = await ReportService.submit({
    reporterId: user.id,
    targetType: body.targetType,
    targetId: body.targetId,
    reason: body.reason,
    details: body.details,
  });

  return c.json({ success: true, data: report }, 201);
});

reportApp.get('/', authMiddleware(), async (c) => {
  const user = c.get('user');
  if (user.profile.role !== 'moderator') {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Moderator access required' } }, 403);
  }

  const status = c.req.query('status');
  const reports = await ReportService.list(status);
  return c.json({ success: true, data: reports });
});

reportApp.put('/:id', authMiddleware(), async (c) => {
  const user = c.get('user');
  if (user.profile.role !== 'moderator') {
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Moderator access required' } }, 403);
  }

  const reportId = parseInt(c.req.param('id'), 10);
  const { status, action } = await c.req.json<{ status: 'resolved' | 'dismissed'; action?: string }>();

  const report = await ReportService.resolve(reportId, status, action);
  return c.json({ success: true, data: report });
});

export default reportApp;
