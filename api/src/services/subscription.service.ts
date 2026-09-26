import { sql } from '../config/database.js';
import type { PlanRow, SubscriptionRow } from '../types/db.js';
import { env } from '../config/env.js';

export class SubscriptionService {
  static async listPlans() {
    return await sql<PlanRow[]>`
      SELECT * FROM plans ORDER BY price_inr ASC
    `;
  }

  static async getUserPlan(userId: string) {
    const subs = await sql<SubscriptionRow[]>`
      SELECT s.*, p.name as plan_name, p.features
      FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = ${userId}
        AND s.status = 'active'
        AND s.current_period_end > now()
      ORDER BY s.created_at DESC
      LIMIT 1
    `;

    if (subs.length > 0) {
      return subs[0];
    }

    // Default to free plan
    const [freePlan] = await sql<PlanRow[]>`
      SELECT * FROM plans WHERE id = 'free'
    `;

    return {
      plan_id: 'free',
      plan_name: 'Free',
      status: 'active',
      features: freePlan?.features || {
        connect_duration_min: 60,
        connect_daily: 3,
        laya_hourly: 20,
      },
    };
  }

  static async createCheckout(userId: string, planId: string) {
    const [plan] = await sql<PlanRow[]>`
      SELECT * FROM plans WHERE id = ${planId}
    `;
    if (!plan || plan.price_inr === 0) {
      throw new Error('Invalid plan selected');
    }

    // Simulated Razorpay Order or live Razorpay API
    const orderId = `order_${Date.now()}`;

    return {
      orderId,
      amount: plan.price_inr * 100, // in paise
      currency: 'INR',
      keyId: env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
      planName: plan.name,
    };
  }

  static async activateSubscription(userId: string, planId: string, paymentRef: string) {
    return await sql.begin(async (tx) => {
      const [plan] = await tx<PlanRow[]>`
        SELECT * FROM plans WHERE id = ${planId}
      `;

      // Cancel any active subscriptions
      await tx`
        UPDATE subscriptions
        SET status = 'cancelled'
        WHERE user_id = ${userId} AND status = 'active'
      `;

      // 30 days active period
      const [sub] = await tx<SubscriptionRow[]>`
        INSERT INTO subscriptions (
          user_id, plan_id, status, payment_provider, provider_sub_id,
          current_period_start, current_period_end
        ) VALUES (
          ${userId}, ${planId}, 'active', 'razorpay', ${paymentRef},
          now(), now() + interval '30 days'
        )
        RETURNING *
      `;

      await tx`
        INSERT INTO payments (user_id, subscription_id, amount_inr, provider, provider_payment_id, status)
        VALUES (${userId}, ${sub.id}, ${plan.price_inr}, 'razorpay', ${paymentRef}, 'completed')
      `;

      return sub;
    });
  }
}
