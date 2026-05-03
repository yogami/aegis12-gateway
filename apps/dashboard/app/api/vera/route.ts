import { NextResponse } from 'next/server';
import { MaturityService } from '@/lib/vera/maturity.service';
import { SegmentationService } from '@/lib/vera/segmentation.service';
import { IncidentResponseService } from '@/lib/vera/incident.service';
import { AgentMaturity } from '@/lib/vera/maturity.types';

/**
 * VERA API — Agent Trust Tier & Promotion Gates
 *
 * POST /api/vera/evaluate — Evaluate agent promotion readiness
 * POST /api/vera/promote  — Execute promotion (via query param ?action=promote)
 * POST /api/vera/access    — Evaluate segmentation access request (via query param ?action=access)
 * POST /api/vera/incident  — Record an incident (via query param ?action=incident)
 * GET  /api/vera            — VERA capability manifest
 */

const maturityService = new MaturityService();
const segmentationService = new SegmentationService();
const incidentService = new IncidentResponseService();

export async function GET() {
    return NextResponse.json({
        framework: 'VERA — Verifiable Enforcement for Runtime Agents',
        spec: 'https://github.com/berlinailabs/vera-reference-implementation',
        implementedBy: 'Berlin AI Labs — agent-trust-protocol',
        version: '2.0.0',
        pillars: {
            identity: { status: 'implemented', service: 'agent-trust-verifier' },
            proofOfExecution: { status: 'implemented', service: 'veracity-core (pdp-protocol)' },
            dataSovereignty: { status: 'implemented', service: 'convoguard-ai' },
            segmentation: { status: 'implemented', service: 'agent-trust-protocol/vera' },
            containment: { status: 'implemented', service: 'agent-pentest + agent-trust-protocol/vera' },
        },
        trustTiers: {
            levels: ['T1-intern', 'T2-junior', 'T3-senior', 'T4-principal'],
            promotionGates: ['performance', 'security', 'businessValue', 'incidentRecord', 'governanceSignoff'],
        },
    });
}

export async function POST(request: Request) {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') ?? 'evaluate';

    try {
        const body = await request.json();

        switch (action) {
            case 'evaluate': {
                const maturity: AgentMaturity = body.maturity;
                const gates = maturityService.evaluatePromotion(
                    maturity,
                    body.pentestGrade,
                    body.adversarialPassed,
                    body.roiCalculated,
                    body.securityApproval,
                    body.riskCommitteeApproval,
                    body.businessOwnerApproval,
                );
                return NextResponse.json({
                    agentId: maturity.agentId,
                    currentLevel: maturity.currentLevel,
                    nextLevel: maturityService.getNextLevel(maturity.currentLevel),
                    eligible: maturityService.isPromotionEligible(gates),
                    gates,
                });
            }

            case 'promote': {
                const maturity: AgentMaturity = body.maturity;
                const gates = maturityService.evaluatePromotion(
                    maturity,
                    body.pentestGrade,
                    body.adversarialPassed,
                    body.roiCalculated,
                    body.securityApproval,
                    body.riskCommitteeApproval,
                    body.businessOwnerApproval,
                );
                if (!maturityService.isPromotionEligible(gates)) {
                    return NextResponse.json({ error: 'Promotion gates not met', gates }, { status: 403 });
                }
                const promoted = maturityService.promote(maturity, gates, body.approvedBy ?? 'system');
                return NextResponse.json({ promoted, gates });
            }

            case 'access': {
                const decision = segmentationService.evaluateAccess(body);
                return NextResponse.json(decision, { status: decision.allowed ? 200 : 403 });
            }

            case 'incident': {
                incidentService.initBreaker(body.agentId, body.agentLevel ?? 'junior');
                const incident = incidentService.recordIncident(
                    body.agentId,
                    body.severity,
                    body.type,
                    body.description,
                );
                const canExecute = incidentService.canExecute(body.agentId);
                return NextResponse.json({ incident, canExecute });
            }

            default:
                return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
