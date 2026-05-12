import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const baseUrl = process.env.PHALA_BACKEND_URL || process.env.NEXT_PUBLIC_PHALA_BACKEND_URL || 'http://localhost:8000';
        const targetUrl = `${baseUrl}/vault/policy`;

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
