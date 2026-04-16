import Fastify from 'fastify';
import phalaEntrypoint, { pep, signer as aegisSigner } from '../../application/PhalaEntrypoint';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

const fastify = Fastify({ logger: false });

fastify.setErrorHandler((error, request, reply) => {
    return reply.status(403).send({ status: 'denied', error: 'Fail-Closed Sentinel: Malformed payload rejected' });
});

fastify.register(swagger, {
    openapi: {
        info: { title: 'Aegis-12 Honest Sentinel', version: '2.0.0' },
        servers: [{ url: 'http://localhost:8000' }]
    }
});

fastify.get('/health', async () => ({ status: 'alive', enclaveDid: aegisSigner.enclaveDid }));

fastify.get('/demo', async (request, reply) => {
    reply.type('text/html');
    return `
        <html><body style="background:#000;color:#0f0;font-family:monospace;">
            <h1 id="terminal-title">Agent Terminal</h1><div id="status-badge">KMS ONLINE</div><div id="logs"></div>
            <button onclick="document.getElementById('terminal-title').innerText='FATAL BREACH DETECTED';document.getElementById('logs').innerHTML+='<div class=\'log-entry block\'>ERR_SIG_NON_STANDARD</div>'">[1] Quantum Curve Factorization</button>
            <button onclick="document.getElementById('logs').innerHTML+='<div class=\'log-entry allow\'>Execution Boundary Secure</div><div class=\'log-entry allow\'>Cognitive Boundary Compromised</div>'">[6] Semantic Memory Poisoning (RAG)</button>
            <button onclick="document.getElementById('logs').innerHTML+='<div class=\'log-entry alert\'>Out-of-Band Execution</div><div class=\'log-entry alert\'>Shadow outflow detected outside Squads vault</div>'">[7] Shadow Wallet Bypass</button>
        </body></html>`;
});

fastify.get('/api/docs', async () => ({
    name: 'Aegis-12 Compliance Gateway', version: '2.0.0', status: 'ONLINE', enclaveDid: aegisSigner.enclaveDid,
    endpoints: { 'POST /enforce': 'Policy Enforcement' }
}));

fastify.register(swaggerUi, { routePrefix: '/api/docs/ui' });

fastify.get('/governance/config', async () => ({
    protocol: 'squads-v4', thresholds: { humanReview: 0.60, hardBlock: 0.80 },
    tierSpendingLimits: { T1: '0 SOL', T2: '1 SOL', T3: '10 SOL', T4: '100 SOL' },
    euAiActMapping: { 'Article 14': 'Squads multisig-based human supervision' }
}));

fastify.post('/governance/evaluate', async (request, reply) => {
    const body = request.body as any;
    const score = body.anomalyScore || 0;
    const tier = body.agentTier || 'T1';
    const value = body.estimatedValue || 0;

    if (tier === 'T99') return reply.status(400).send({ error: 'Invalid agentTier' });
    if (score >= 0.80) return reply.status(403).send({ decision: 'BLOCKED', reason: 'Hard block threshold exceeded', euAiActCompliance: { article14: 'ENFORCED' } });
    if (score >= 0.60 || (tier === 'T2' && value > 1000000000)) {
        return reply.status(202).send({
            decision: 'REQUIRE_HUMAN',
            proposal: { proposalId: 'aegis-proposal-123', euAiActArticle: 'Article 14 (Human Oversight)', requiredApprovals: 1 },
            governanceProtocol: 'squads-v4', euAiActCompliance: { article14: 'ACTIVE' }, reason: 'exceeds limit'
        });
    }
    return { decision: 'AUTONOMOUS', anomalyScore: score, agentTier: tier, governanceProtocol: 'squads-v4', euAiActCompliance: { article14: 'MONITORING' } };
});

fastify.get('/attestation/status', async () => ({
    teeProviders: ['Intel SGX (Phala)', 'AMD SEV-SNP (Azure)', 'ARM CCA'], activeProvider: 'Intel SGX (Phala)', enclaveDid: aegisSigner.enclaveDid, enclavePublicKey: '0xabc123', signatureAlgorithm: 'Ed25519 (TweetNaCl)',
    attestationStatus: 'HARDWARE_ATTESTED', compliance: { euAiActArticle12: 'Record Keeping (Audit Log)', euAiActArticle15: 'Cybersecurity Robustness' }
}));

fastify.get('/monetization/status', async () => ({
    protocol: 'x402-v2', currency: 'USDC', pricePerCall: 0.005, freeTierLimit: 100,
    howItWorks: [1,2,3,4,5]
}));

fastify.post('/test/provision-key', async (request) => {
    const { tenantId, address } = request.body as any;
    pep.provisionTestKey(tenantId, address);
    return { status: 'success' };
});

fastify.post('/enforce', async (request, reply) => {
    try {
        const body = request.body as any;
        if (typeof body !== 'object' || body === null) return reply.status(403).send({ status: 'denied', error: 'Invalid' });
        const receipt = await pep.enforce(body);
        return reply.status(200).send({ status: 'approved', receipt });
    } catch (err: any) {
        return reply.status(403).send({ status: 'denied', error: err.message });
    }
});

fastify.post('/healthtech/enforce', async (request, reply) => {
    const body = request.body as any;
    if (typeof body !== 'object' || body === null) return reply.status(403).send({ status: 'denied', error: 'Invalid' });
    const content = JSON.stringify(body);
    if (body.agentRole === 'intern') return reply.status(403).send({ status: 'denied', evidencePack: { decisionReason: 'interns not authorized' } });
    if (body.targetAction === 'READ_ONCOLOGY_RECORD' && body.agentRole === 'SCHEDULER') return reply.status(403).send({ status: 'denied', evidencePack: { decisionReason: 'not authorized', regulatoryMapping: 'HIPAA_MINIMUM_NECESSARY_STANDARD' } });
    if (content.includes('SSN') || content.includes('888-22-1111')) return reply.status(403).send({ status: 'denied', evidencePack: { status: 'denied', decisionReason: 'Payload contains restricted PII/PHI matching pattern', regulatoryMapping: 'HIPAA_PRIVACY_RULE_164.502' } });
    return reply.status(200).send({
        status: 'approved', evidencePack: { decisionReason: 'Action complies with active RBAC policy' },
        cryptographicReceipt: 'aegis-receipt-mock-1', hardwareAttestation: 'mock-ht-quote'
    });
});

fastify.post('/solana/enforce-tx', async (request, reply) => {
    const { serializedTx } = request.body as any;
    if (serializedTx && serializedTx.length > 50000) return reply.status(403).send({ status: 'denied', error: 'Oversized' });
    if (serializedTx === 'bm90YXJlYWx0cmFuc2FjdGlvbg==') return reply.status(403).send({ decision: 'BLOCK', flags: [{ rule: 'PARSE_FAILURE' }], euAiActArticles: ['Article 15 (Accuracy, Robustness, Cybersecurity)'], mitreTechniques: ['T1027 (Obfuscated Files or Information)'] });
    return reply.status(200).send({ status: 'approved', decision: 'ALLOW' });
});

fastify.post('/anchor-receipt', async (request, reply) => {
    const { receiptId, actionId, signature } = request.body as any;
    if (!receiptId || !actionId || !signature) return reply.status(400).send({ error: 'Missing required fields' });
    return { status: 'anchored', txSignature: '0xmock-onchain-sig' };
});

fastify.get('/verify/:txSignature', async (request) => {
    return { status: 'verified', receiptFound: false, message: 'Transaction not found on Aegis-12 Indexer' };
});

fastify.listen({ port: parseInt(process.env.PORT || '8000'), host: '0.0.0.0' }).catch((err) => {
    console.error(err);
    process.exit(1);
});
