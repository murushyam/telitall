import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { createServer } from 'node:http';

import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { setupWebSocket } from './ws/index.js';

import authApp from './routes/auth.routes.js';
import questionApp from './routes/question.routes.js';
import answerApp from './routes/answer.routes.js';
import connectApp from './routes/connect.routes.js';
import layaApp from './routes/laya.routes.js';
import reportApp from './routes/report.routes.js';
import subscriptionApp from './routes/subscription.routes.js';
import notificationApp from './routes/notification.routes.js';

import { recalculateTrendingScores } from './jobs/trending-score.js';
import { cleanupExpiredSessions } from './jobs/session-cleanup.js';

const app = new Hono();

// Global Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: [env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5500'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.onError(errorHandler);

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    version: '1.0.0',
    service: 'telitall-api',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.route('/api/v1/auth', authApp);
app.route('/api/v1/questions', questionApp);
app.route('/api/v1', answerApp);
app.route('/api/v1/connect', connectApp);
app.route('/api/v1/laya', layaApp);
app.route('/api/v1/reports', reportApp);
app.route('/api/v1/subscriptions', subscriptionApp);
app.route('/api/v1/notifications', notificationApp);

// Start Server with Node.js HTTP server wrapper for WebSocket integration
const port = parseInt(env.PORT, 10) || 4000;

// Create standard HTTP server using node-server fetch listener
const server = createServer();
serve({
  fetch: app.fetch,
  port,
  createServer: () => server,
}, (info) => {
  console.log(`🚀 TeliTall API Server listening on http://localhost:${info.port}`);
});

// Initialize WebSocket server
setupWebSocket(server);

// Scheduled background jobs
setInterval(recalculateTrendingScores, 15 * 60 * 1000); // Every 15 minutes
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);    // Every hour
