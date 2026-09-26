import type { Server, Socket } from 'socket.io';
import { ConnectService } from '../services/connect.service.js';
import { redis } from '../config/redis.js';

export function registerConnectHandlers(io: Server, socket: Socket) {
  const user = (socket as any).user;

  socket.on('join_room', async ({ roomId }: { roomId: string }) => {
    if (!roomId) return;
    const room = await ConnectService.getRoom(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found or expired' });
      return;
    }

    socket.join(roomId);
    socket.emit('room_joined', { room });

    // Inform peer
    socket.to(roomId).emit('peer_joined', {
      userId: user.id,
      role: user.profile.role,
    });
  });

  socket.on('send_message', async ({ roomId, text }: { roomId: string; text: string }) => {
    if (!roomId || !text || !text.trim()) return;

    const room = await ConnectService.getRoom(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room no longer exists' });
      return;
    }

    if (room.status === 'expired') {
      socket.emit('session_expired', {
        message: 'This 1-hour session has concluded. You can start a new chat or upgrade for extended sessions.',
      });
      return;
    }

    const messagePayload = {
      id: `msg_${Date.now()}`,
      senderId: user.id,
      senderRole: user.profile.role,
      text: text.trim().slice(0, 2000),
      timestamp: Date.now(),
    };

    // Store ephemeral message in Redis list
    try {
      await redis.rpush(`connect:messages:${roomId}`, JSON.stringify(messagePayload));
      await redis.expire(`connect:messages:${roomId}`, 3600 * 2);
    } catch {}

    // Relay to room participants
    io.to(roomId).emit('new_message', messagePayload);
  });

  socket.on('typing', ({ roomId, isTyping }: { roomId: string; isTyping: boolean }) => {
    socket.to(roomId).emit('peer_typing', { isTyping });
  });

  socket.on('leave_room', async ({ roomId }: { roomId: string }) => {
    socket.leave(roomId);
    socket.to(roomId).emit('peer_left', { userId: user.id });
  });
}
