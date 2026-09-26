import { sql } from '../config/database.js';
import { env } from '../config/env.js';

const CRISIS_KEYWORDS = [
  'kill myself', 'suicide', 'end my life', 'want to die',
  'hang myself', 'slit my wrist', 'overdose', 'cut myself', 'self harm'
];

const CRISIS_RESPONSE = `I hear how much pain you're experiencing right now, and I care deeply about your safety. You don't have to carry this alone. Please reach out to someone who can support you right now:

- India Tele-MANAS: 14416 or 1800-891-4416 (24/7, Toll-Free)
- Vandrevala Foundation: +91 9999 666 555
- AASRA: +91 98204 66726
- US/Canada Suicide & Crisis Lifeline: Call or text 988
- International: Find your local lifeline at findahelpline.com

I am an AI companion, and your life is valuable. Please contact one of these resources right away.`;

export class LayaService {
  static checkCrisis(text: string): boolean {
    const lower = text.toLowerCase();
    return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
  }

  static async getOrCreateThread(userId: string, threadId?: number) {
    if (threadId) {
      const [thread] = await sql`
        SELECT * FROM laya_threads WHERE id = ${threadId} AND user_id = ${userId}
      `;
      if (thread) return thread;
    }

    const [newThread] = await sql`
      INSERT INTO laya_threads (user_id, title)
      VALUES (${userId}, 'Conversation with Laya')
      RETURNING *
    `;
    return newThread;
  }

  static async sendMessage(userId: string, userText: string, threadId?: number) {
    const thread = await this.getOrCreateThread(userId, threadId);

    // Record user message
    await sql`
      INSERT INTO laya_messages (thread_id, role, content)
      VALUES (${thread.id}, 'user', ${userText})
    `;

    // 1. Safety check
    if (this.checkCrisis(userText)) {
      const [reply] = await sql`
        INSERT INTO laya_messages (thread_id, role, content)
        VALUES (${thread.id}, 'assistant', ${CRISIS_RESPONSE})
        RETURNING *
      `;
      return { threadId: thread.id, message: reply, isCrisis: true };
    }

    // 2. AI response via xAI or contextual empathy fallback
    let aiContent = '';
    if (env.XAI_API_KEY) {
      try {
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.XAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'grok-beta',
            messages: [
              {
                role: 'system',
                content: 'You are Laya, a warm, compassionate, non-judgmental emotional wellness companion on TeliTall. You listen deeply, validate feelings, and provide thoughtful, practical reflection. Keep replies under 150 words.',
              },
              { role: 'user', content: userText },
            ],
            temperature: 0.7,
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          aiContent = data.choices?.[0]?.message?.content || '';
        }
      } catch (err: any) {
        console.warn('[Laya AI] xAI call failed, using graceful empathy fallback:', err.message);
      }
    }

    if (!aiContent) {
      aiContent = `Thank you for sharing that with me. What you're feeling is valid, and acknowledging it takes courage. Take a gentle breath. Would you like to unpack what made this moment stand out for you?`;
    }

    const [assistantMsg] = await sql`
      INSERT INTO laya_messages (thread_id, role, content)
      VALUES (${thread.id}, 'assistant', ${aiContent})
      RETURNING *
    `;

    return {
      threadId: thread.id,
      message: assistantMsg,
      isCrisis: false,
    };
  }

  static async getMessages(threadId: number, userId: string) {
    // Verify ownership
    const [thread] = await sql`
      SELECT id FROM laya_threads WHERE id = ${threadId} AND user_id = ${userId}
    `;
    if (!thread) throw new Error('Thread not found');

    return await sql`
      SELECT * FROM laya_messages
      WHERE thread_id = ${threadId}
      ORDER BY created_at ASC
    `;
  }
}
