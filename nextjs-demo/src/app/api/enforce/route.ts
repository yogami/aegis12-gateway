import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const payload = await request.json();
        const ENCLAVE_URL = process.env.ENCLAVE_URL || "https://c27b0861a2bf2891f43f3556d3aa9526d704f7bc-8000.dstack-pha-prod5.phala.network";
        const response = await fetch(`${ENCLAVE_URL}/enforce`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return NextResponse.json(err, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
