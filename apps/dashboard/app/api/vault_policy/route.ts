import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const enforceUrl = process.env.PHALA_ENFORCE_URL || 'https://c2fa9527475ea371388de812f47be1676bc59712-8000.dstack-pha-prod9.phala.network/sign_and_execute';
        const targetUrl = enforceUrl.replace('/sign_and_execute', '/vault/policy');

        // Forward to actual Phala Backend
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        
        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
