import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getAuthAdmin } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  try {
    const sig = req.headers.get('stripe-signature');
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !secret) return NextResponse.json({ ok: false, error: 'Not configured' }, { status: 501 });

    // Lazy import stripe to avoid bundling if not used
    const body = await req.text();
    const stripe = (await import('stripe')).default;
    const client = new stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });
    let event: any;
    try {
      event = (client as any).webhooks.constructEvent(body, sig, secret);
    } catch (err) {
      logger.error('Stripe webhook signature verification failed:', err);
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    if (event.type === 'checkout.session.completed' || event.type === 'customer.subscription.updated') {
      const session = event.data.object || {};
      const uid = session?.metadata?.uid || session?.client_reference_id;
      const tier = 'plus';
      if (uid) {
        const authAdmin = getAuthAdmin();
        if (!authAdmin) return NextResponse.json({ ok: false, error: 'Admin not configured' }, { status: 501 });
        await authAdmin.setCustomUserClaims(uid, { subscription: tier });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[api/stripe/webhook] Failed:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

