import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

function getStripeClient(): Stripe | null {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return null;
    return new Stripe(key, {
        apiVersion: '2025-11-17.clover',
    });
}

export async function POST(request: NextRequest) {
    try {
        const stripe = getStripeClient();

        if (!stripe) {
            return NextResponse.json(
                { error: 'Stripe is not configured. Please add STRIPE_SECRET_KEY to environment.' },
                { status: 500 }
            );
        }

        const body = await request.json();
        const { userId } = body;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'TrustScore Pro API',
                            description: 'Monthly API access with 10,000 requests',
                        },
                        unit_amount: 900, // $9.00
                        recurring: {
                            interval: 'month',
                        },
                    },
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${request.headers.get('origin')}/dashboard?subscription=success`,
            cancel_url: `${request.headers.get('origin')}/billing?cancelled=true`,
            metadata: {
                userId: userId || 'anonymous',
            },
        });

        return NextResponse.json({ url: session.url });
    } catch (error) {
        console.error('Stripe checkout error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to create checkout session' },
            { status: 500 }
        );
    }
}

