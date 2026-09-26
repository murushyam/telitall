import type { ProfileRow, QuestionRow, AnswerRow, PlanRow } from './db.js';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface AuthUser {
  id: string;
  email: string;
  is_verified: boolean;
  profile: ProfileRow;
}

export interface QuestionWithAnswers extends QuestionRow {
  answers: AnswerRow[];
  user_has_voted_answer_ids?: number[];
}

export interface ConnectSessionState {
  roomId: string;
  user1Id: string;
  user2Id: string;
  topic: string;
  role1: string;
  role2: string;
  isExpertChat: boolean;
  startedAt: number; // epoch ms when second person connects
  expiresAt: number; // epoch ms when session ends
  isGracePeriod: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
