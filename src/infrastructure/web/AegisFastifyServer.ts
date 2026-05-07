import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { X402PayGate } from '../X402PayGate';
import { SquadsGovernance } from '../SquadsGovernance';
import { AegisController } from './AegisController';

const fastify = Fastify({ logger: true, bodyLimit: 1048576 });

fastify.register(swagger, {
    openapi: {
        info: { title: 'Aegis-12 Honest Sentinel', version: '2.0.0' },
        servers: [{ url: 'http://localhost:8000' }]
    }
});
fastify.register(swaggerUi, { routePrefix: '/api/docs/ui' });

const payGate = new X402PayGate({ enabled: false, pricePerCall: 0.005 });
const governance = new SquadsGovernance();
const controller = new AegisController(payGate, governance);

// 1. HEALTH + API DOCS
fastify.get('/health', controller.health.bind(controller));
fastify.get('/api/docs', controller.getDocs.bind(controller));

// 2. CORE ENFORCEMENT & POLICY VAULT
fastify.post('/sign_and_execute', controller.enforce.bind(controller));
fastify.post('/vault/policy', controller.uploadVaultPolicy.bind(controller));

// 3. SOLANA RECEIPT ANCHORING
fastify.post('/anchor-receipt', controller.anchorReceipt.bind(controller));
fastify.get('/verify/:txSignature', controller.verifySignature.bind(controller));
fastify.get('/evidence/:receiptId', controller.getEvidenceStatus.bind(controller));

// 4. SOLANA TRANSACTION FIREWALL
fastify.post('/solana/enforce-tx', controller.enforceSolanaTx.bind(controller));

// 5. SQUADS V4 GOVERNANCE
fastify.get('/governance/config', controller.getGovernanceConfig.bind(controller));
fastify.post('/governance/evaluate', controller.evaluateGovernance.bind(controller));

// 6. TEE ATTESTATION STATUS
fastify.get('/attestation/status', controller.getAttestationStatus.bind(controller));

// 7. x402 MONETIZATION
fastify.get('/monetization/status', controller.getMonetizationStatus.bind(controller));

// 8. HEALTHTECH HIPAA ENFORCEMENT
fastify.post('/healthtech/enforce', controller.healthtechEnforce.bind(controller));

// 9. E2E TEST PROVISIONING
fastify.post('/test/provision-key', controller.provisionTestKey.bind(controller));

fastify.listen({ port: parseInt(process.env.PORT || '8000'), host: '0.0.0.0' }, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`[Aegis-12] Secure Enclave Production v2.0.0 online on port 8000`);
});
