import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'node:http';
import { authenticateSocket } from './auth.ws.js';
import { registerConnectHandlers } from './connect.handler.js';
import { env } from '../config/env.js';

export function setupWebSocket(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: [env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5500'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Socket authentication middleware
  io.use(async (socket, next) => {
    const user = await authenticateSocket(socket);
    if (!user) {
      return next(new Error('Authentication failed'));
    }
    (socket as any).user = user;
    next();
  });

  io.on('connection', (socket) => {
    registerConnectHandlers(io, socket);
  });

  return io;
}
