import Fastify from 'fastify';
import phalaEntrypoint, { pep, signer as aegisSigner } from '../../application/PhalaEntrypoint';
import { X402PayGate } from '../X402PayGate';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

const fastify = Fastify({ logger: false, bodyLimit: 1048576 }); // 1MB strict limit

// Removed global error handler to prevent swallowing real error messages
fastify.register(swagger, {
    openapi: {
        info: { title: 'Aegis-12 Honest Sentinel', version: '2.0.0' },
        servers: [{ url: 'http://localhost:8000' }]
    }
});

fastify.get('/health', async () => ({ status: 'alive', enclaveDid: aegisSigner?.enclaveDid || "initializing" }));

// Demo endpoint eradicated
fastify.get('/api/docs', async () => ({
    name: 'Aegis-12 Compliance Gateway', version: '2.0.0', status: 'ONLINE', enclaveDid: aegisSigner?.enclaveDid || "initializing",
    endpoints: { 'POST /enforce': 'Policy Enforcement' }
}));

fastify.register(swaggerUi, { routePrefix: '/api/docs/ui' });

// Removed /governance/config and /governance/evaluate mocks
// Removed /attestation/status, /verify-zk-proof, and /monetization/status mocks
// Removed unauthenticated /test/provision-key backdoor

const payGate = new X402PayGate({ enabled: true, pricePerCall: 0.005 });

const enforceSchema = {
    body: {
        type: 'object',
        required: ['action', 'dynamicPolicy'],
        properties: {
            agent: { type: 'object' },
            action: { type: 'object' },
            context: { type: 'object' },
            dynamicPolicy: { type: 'object' }
        }
    }
};

fastify.post('/enforce', { schema: enforceSchema }, async (request, reply) => {
    try {
        const ip = request.ip || '0.0.0.0';
        const paymentHeader = request.headers['x-payment'] as string | undefined;

        if (paymentHeader) {
            const verification = await payGate.verifyPayment(paymentHeader);
            if (!verification.valid) {
                return reply.status(402).send({ error: verification.error });
            }
        } else {
            const requirement = await payGate.checkPaymentRequired(ip);
            if (requirement) {
                return reply.status(402).send(requirement);
            }
        }

        const payloadStr = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
        const resultJson = await phalaEntrypoint(payloadStr);
        const result = JSON.parse(resultJson);
        if (result.status === 'denied') {
            return reply.status(403).send(result);
        }
        return reply.status(200).send(result);
    } catch (err: any) {
        return reply.status(500).send({ status: 'error', error: 'Internal Enclave Error. See secure logs for details.' });
    }
});

// Removed /healthtech/enforce, /solana/enforce-tx, /anchor-receipt, /verify/:txSignature mocks
fastify.listen({ port: parseInt(process.env.PORT || '8000'), host: '0.0.0.0' }).catch((err) => {
    console.error(err);
    process.exit(1);
});
