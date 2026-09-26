export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfileRow {
  user_id: string;
  display_name: string;
  role: 'user' | 'expert' | 'moderator';
  specialty: string | null;
  reputation: number;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  last_active: string;
}

export interface QuestionRow {
  id: number;
  user_id: string;
  author_name: string;
  author_role: string;
  author_specialty: string;
  title: string;
  body: string;
  category: string;
  kind: 'experience' | 'knowledge';
  is_hidden: boolean;
  trending_score?: number;
  created_at: string;
  edited_at: string | null;
}

export interface AnswerRow {
  id: number;
  question_id: number;
  user_id: string;
  author_name: string;
  author_role: string;
  author_specialty: string;
  body: string;
  helpful: number;
  is_best: boolean;
  is_hidden: boolean;
  created_at: string;
  edited_at: string | null;
}

export interface PlanRow {
  id: string;
  name: string;
  price_inr: number;
  price_usd: number;
  interval: string | null;
  features: {
    connect_duration_min: number | null;
    connect_daily: number | null;
    laya_hourly: number;
  };
}

export interface SubscriptionRow {
  id: number;
  user_id: string;
  plan_id: string;
  status: 'active' | 'cancelled' | 'expired' | 'past_due';
  payment_provider: string;
  provider_sub_id: string | null;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
}

export interface NotificationRow {
  id: number;
  user_id: string;
  type: 'new_answer' | 'answer_accepted' | 'answer_helpful' | 'connect_match' | 'report_resolved' | 'system';
  title: string;
  body: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface ReportRow {
  id: number;
  reporter_id: string;
  target_type: 'question' | 'answer' | 'user' | 'connect_room';
  target_id: string;
  reason: string;
  details: string | null;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  created_at: string;
  resolved_at: string | null;
}
