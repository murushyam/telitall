import { nanoid } from 'nanoid';
import { redis } from '../config/redis.js';
import { sql } from '../config/database.js';

export interface ConnectRoomData {
  id: string;
  topic: string;
  isExpertChat: boolean;
  user1Id: string;
  user1Role: string;
  user2Id: string | null;
  user2Role: string | null;
  status: 'waiting' | 'active' | 'expired';
  createdAt: number;
  startedAt: number | null; // Set when peer connects and responds
  expiresAt: number | null; // startedAt + session duration
  durationMinutes: number;
}

export class ConnectService {
  /**
   * Puts a user into the matchmaking queue for a topic
   */
  static async enqueue(params: {
    userId: string;
    topic: string;
    role: string;
    isExpertOnly?: boolean;
    durationMinutes?: number;
  }): Promise<{ queued: boolean; room?: ConnectRoomData }> {
    const queueKey = `connect:queue:${params.topic}`;
    const duration = params.durationMinutes || 60;

    // Check if there is already a waiting peer in the queue
    let peerJson: string | null = null;
    try {
      peerJson = await redis.rpop(queueKey);
    } catch {
      // In-memory or fallback
    }

    if (peerJson) {
      const peer = JSON.parse(peerJson);
      // Ensure user doesn't match with themselves
      if (peer.userId !== params.userId) {
        const roomId = `room_${nanoid(12)}`;
        const now = Date.now();
        const expiresAt = now + duration * 60 * 1000;

        const roomData: ConnectRoomData = {
          id: roomId,
          topic: params.topic,
          isExpertChat: !!params.isExpertOnly || peer.isExpertOnly,
          user1Id: peer.userId,
          user1Role: peer.role,
          user2Id: params.userId,
          user2Role: params.role,
          status: 'active',
          createdAt: peer.queuedAt,
          startedAt: now, // Timer starts when match is made
          expiresAt: expiresAt,
          durationMinutes: duration,
        };

        // Save active room in Redis with TTL (duration + 10 min grace period)
        const ttlSeconds = (duration + 10) * 60;
        await redis.setex(`connect:room:${roomId}`, ttlSeconds, JSON.stringify(roomData));

        // Track in connect_sessions table for analytics
        await sql`
          INSERT INTO connect_sessions (user_id, topic, session_type, status)
          VALUES (${params.userId}, ${params.topic}, 'ordinary', 'completed'),
                 (${peer.userId}, ${params.topic}, 'ordinary', 'completed')
        `.catch(() => {});

        return { queued: false, room: roomData };
      }
    }

    // No peer found, push to queue (queue TTL 10 minutes)
    const queueEntry = JSON.stringify({
      userId: params.userId,
      role: params.role,
      isExpertOnly: !!params.isExpertOnly,
      queuedAt: Date.now(),
    });

    await redis.lpush(queueKey, queueEntry);
    return { queued: true };
  }

  static async getRoom(roomId: string): Promise<ConnectRoomData | null> {
    const data = await redis.get(`connect:room:${roomId}`);
    if (!data) return null;
    return JSON.parse(data);
  }

  static async endRoom(roomId: string): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) return false;
    room.status = 'expired';
    await redis.setex(`connect:room:${roomId}`, 300, JSON.stringify(room)); // 5 min read-only grace period
    return true;
  }
}
