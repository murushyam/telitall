import { Hono } from 'hono';
import { NotificationService } from '../services/notification.service.js';
import { authMiddleware } from '../middleware/auth.js';

const notificationApp = new Hono();

notificationApp.get('/', authMiddleware(), async (c) => {
  const user = c.get('user');
  const limit = parseInt(c.req.query('limit') || '30', 10);

  const notifications = await NotificationService.list(user.id, limit);
  return c.json({ success: true, data: notifications });
});

notificationApp.post('/read-all', authMiddleware(), async (c) => {
  const user = c.get('user');
  await NotificationService.markAllAsRead(user.id);
  return c.json({ success: true });
});

export default notificationApp;
