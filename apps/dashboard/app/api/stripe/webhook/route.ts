import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function getStripeClient(): Stripe | null {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return null;
    return new Stripe(key, {
        apiVersion: '2025-11-17.clover',
    });
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

function generateApiKey(): string {
    return `ts_${crypto.randomBytes(24).toString('hex')}`;
}

export async function POST(request: NextRequest) {
    try {
        const stripe = getStripeClient();

        if (!stripe) {
            return NextResponse.json(
                { error: 'Stripe is not configured' },
                { status: 500 }
            );
        }

        const body = await request.text();
        const signature = request.headers.get('stripe-signature');

        if (!signature || !webhookSecret) {
            return NextResponse.json(
                { error: 'Missing signature or webhook secret' },
                { status: 400 }
            );
        }

        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        } catch (err) {
            console.error('Webhook signature verification failed:', err);
            return NextResponse.json(
                { error: 'Invalid signature' },
                { status: 400 }
            );
        }

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            const userId = session.metadata?.userId;
            const customerId = session.customer as string;

            if (userId && userId !== 'anonymous') {
                // Generate API key
                const apiKey = generateApiKey();

                // Store in Supabase (we'll create this table if it doesn't exist)
                const { error } = await supabase.from('api_keys').insert({
                    user_id: userId,
                    stripe_customer_id: customerId,
                    api_key: apiKey,
                    plan: 'pro',
                    requests_remaining: 10000,
                    created_at: new Date().toISOString(),
                });

                if (error) {
                    console.error('Failed to store API key:', error);
                    // Log but don't fail - webhook should return 200
                }

                console.log(`API key generated for user ${userId}: ${apiKey.slice(0, 10)}...`);
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        return NextResponse.json(
            { error: 'Webhook handler failed' },
            { status: 500 }
        );
    }
}
