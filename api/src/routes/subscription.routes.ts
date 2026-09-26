import { Hono } from 'hono';
import { z } from 'zod';
import { SubscriptionService } from '../services/subscription.service.js';
import { authMiddleware } from '../middleware/auth.js';

const subscriptionApp = new Hono();

subscriptionApp.get('/plans', async (c) => {
  const plans = await SubscriptionService.listPlans();
  return c.json({ success: true, data: plans });
});

subscriptionApp.get('/current', authMiddleware(), async (c) => {
  const user = c.get('user');
  const plan = await SubscriptionService.getUserPlan(user.id);
  return c.json({ success: true, data: plan });
});

subscriptionApp.post('/checkout', authMiddleware(), async (c) => {
  const user = c.get('user');
  const { planId } = await c.req.json<{ planId: string }>();

  if (!planId) {
    return c.json({ success: false, error: { code: 'INVALID_INPUT', message: 'planId required' } }, 400);
  }

  const checkoutData = await SubscriptionService.createCheckout(user.id, planId);
  return c.json({ success: true, data: checkoutData });
});

// Simulation or verification of subscription payment completion
subscriptionApp.post('/activate', authMiddleware(), async (c) => {
  const user = c.get('user');
  const { planId, paymentRef } = await c.req.json<{ planId: string; paymentRef: string }>();

  const sub = await SubscriptionService.activateSubscription(user.id, planId, paymentRef || 'sim_pay_test');
  return c.json({ success: true, data: sub });
});

export default subscriptionApp;
