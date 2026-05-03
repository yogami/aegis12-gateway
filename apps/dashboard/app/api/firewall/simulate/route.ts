import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { agent_tier, tx_type, amount } = body;

        // Mock Firewall Logic based on SolanaTransactionFirewall
        const flags = [];
        let decision = 'approved';
        let riskScore = 0;

        if (tx_type === 'unknown_program') {
            flags.push({ severity: 'CRITICAL', rule: 'UNKNOWN_PROGRAM', detail: 'Instruction calls unknown program. Possible malicious contract interaction.' });
            riskScore += 0.5;
            decision = 'denied';
        }

        if (tx_type === 'set_authority') {
            flags.push({ severity: 'CRITICAL', rule: 'TOKEN_SET_AUTHORITY', detail: 'SPL Token SetAuthority detected. This changes token account ownership. CRITICAL theft vector.' });
            riskScore += 0.5;
            decision = 'denied';
        }

        if (tx_type === 'transfer' && amount > 5000) {
            flags.push({ severity: 'CRITICAL', rule: 'HIGH_VALUE_TRANSFER', detail: `SOL transfer of ${amount} exceeds limit.` });
            riskScore += 0.4;
            decision = 'denied';
        }

        if (agent_tier === 'T1' && tx_type !== 'read_only') {
            flags.push({ severity: 'HIGH', rule: 'TIER_RESTRICTION', detail: 'T1 agents are restricted to read-only operations. Transaction contains write instructions.' });
            riskScore += 0.4;
            if (decision !== 'denied') decision = 'escalated';
        }

        if (decision === 'approved') {
            return NextResponse.json({ decision: 'approved', flags: [], riskScore: 0.1 });
        }

        return NextResponse.json({
            decision,
            flags,
            riskScore: Math.min(riskScore, 1.0)
        });

    } catch (e) {
        return NextResponse.json({ error: 'Simulation failed' }, { status: 500 });
    }
}
