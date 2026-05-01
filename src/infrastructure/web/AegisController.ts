import { FastifyRequest, FastifyReply } from 'fastify';
import phalaEntrypoint, { AegisEnclave } from '../../application/PhalaEntrypoint';
import { X402PayGate } from '../X402PayGate';
import { SquadsGovernance } from '../SquadsGovernance';
import { Transaction } from '@solana/web3.js';

export class AegisController {
    constructor(
        private payGate: X402PayGate,
        private governance: SquadsGovernance
    ) {}

    public async health(request: FastifyRequest, reply: FastifyReply) {
        const enclave = AegisEnclave.getInstance();
        await enclave.initialize();
        return {
            status: 'alive',
            enclaveDid: enclave.signer?.enclaveDid || "initializing",
            ledgerNetwork: enclave.anchor?.getNetworkName() || 'unknown',
            ledgerPayer: enclave.anchor?.getPayerPublicKey(),
            features: ['ledger-anchoring', 'transaction-firewall', 'squads-governance']
        };
    }

    public async getDocs(request: FastifyRequest, reply: FastifyReply) {
        const enclave = AegisEnclave.getInstance();
        return {
            name: 'Aegis-12 Compliance Gateway',
            version: '2.0.0',
            status: 'ONLINE',
            enclaveDid: enclave.signer?.enclaveDid || "initializing",
            endpoints: {
                'POST /enforce': 'Policy Enforcement',
                'POST /anchor-receipt': 'Universal Ledger Anchoring',
                'POST /solana/enforce-tx': 'Transaction Firewall',
                'POST /governance/evaluate': 'Squads V4 Risk Evaluation',
                'GET /attestation/status': 'Hardware PCR0 Status'
            },
            ledgerIntegration: {
                programs: ['Anchoring (SPL Memo/Mantle)', 'Squads V4 (human-in-the-loop governance)', 'x402 USDC (pay-per-inference)']
            },
            compliance: {
                euAiAct: ['Article 12 (Record Keeping)', 'Article 14 (Human Oversight)', 'Article 15 (Cybersecurity)'],
                cryptographicStandards: ['ML-DSA-65 (NIST FIPS 204)', 'SHA-512 (v4-pq resilient)', 'RISC Zero (STARK)']
            }
        };
    }

    public async enforce(request: FastifyRequest, reply: FastifyReply) {
        try {
            const ip = request.ip || '0.0.0.0';
            const paymentHeader = request.headers['x-payment'] as string | undefined;

            if (paymentHeader) {
                const verification = await this.payGate.verifyPayment(paymentHeader);
                if (!verification.valid) return reply.status(402).send({ error: verification.error });
            } else {
                const requirement = await this.payGate.checkPaymentRequired(ip);
                if (requirement) return reply.status(402).send(requirement);
            }

            const payloadStr = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
            console.log(`[Aegis-12] /enforce payload (${Buffer.byteLength(payloadStr)}B)`);
            const resultJson = await phalaEntrypoint(payloadStr);
            console.log(`[Aegis-12] /enforce completed.`);
            const result = JSON.parse(resultJson);
            
            return result.status === 'denied' ? reply.status(403).send(result) : reply.status(200).send(result);
        } catch (err: any) {
            console.error(`[Aegis-12] /enforce ERROR: ${err.message}`);
            const status = err.message.includes('[TERMINAL REFUSAL]') ? 403 : 500;
            return reply.status(status).send({ status: 'error', error: err.message });
        }
    }

    public async anchorReceipt(request: FastifyRequest, reply: FastifyReply) {
        try {
            // Validate inputs BEFORE expensive enclave init (fail-fast)
            const { receipt, decision } = request.body as any;
            if (!receipt || !decision) return reply.status(400).send({ error: 'Missing required fields: receipt, decision' });
            const VALID_DECISIONS = ['approved', 'denied', 'escalated'];
            if (!VALID_DECISIONS.includes(decision)) return reply.status(400).send({ error: `Invalid decision: must be one of ${VALID_DECISIONS.join(', ')}` });

            const enclave = AegisEnclave.getInstance();
            await enclave.initialize();

            const ledgerReceipt = await enclave.anchor!.anchorReceipt(receipt, decision, enclave.signer?.enclaveDid || "unknown");
            return reply.status(200).send({
                status: 'anchored',
                txSignature: ledgerReceipt.txSignature,
                explorerUrl: ledgerReceipt.explorerUrl
            });
        } catch (err: any) {
            return reply.status(500).send({ status: 'error', error: err.message });
        }
    }

    public async verifySignature(request: FastifyRequest<{ Params: { txSignature: string } }>, reply: FastifyReply) {
        try {
            const enclave = AegisEnclave.getInstance();
            await enclave.initialize();
            const { txSignature } = request.params;
            console.log(`[Auditor] Public substance verification request for tx: ${txSignature}`);
            
            const localEvidence = await enclave.pep!.getEvidence(txSignature);
            const ledgerResult = await enclave.anchor!.verifyAnchoredReceipt(txSignature, localEvidence || undefined, enclave.signer!);
            
            if (ledgerResult.error && !localEvidence) {
                return reply.status(404).send({ status: 'error', error: ledgerResult.error });
            }
            
            return reply.status(200).send({
                txSignature,
                status: (ledgerResult.verified && localEvidence) ? "VERIFIED" : "PARTIAL_PROOF",
                onChain: {
                    verified: ledgerResult.verified,
                    memo: ledgerResult.onChainMemo,
                    slot: ledgerResult.timestamp || null,
                    blockTime: ledgerResult.timestamp || null
                },
                enclaveEvidence: {
                    found: !!localEvidence,
                    signatureValid: ledgerResult.verified,
                    receiptId: localEvidence?.receiptId,
                    complianceStandard: localEvidence?.complianceStandard || "ARS-01+"
                },
                note: (ledgerResult.verified && localEvidence) ? "Full cryptographic substance confirmed across Ledger and Enclave." : "Partial evidence found. Chain of trust may be incomplete."
            });
        } catch (err: any) {
            return reply.status(500).send({ status: 'error', error: err.message });
        }
    }

    public async getEvidenceStatus(request: FastifyRequest<{ Params: { receiptId: string } }>, reply: FastifyReply) {
        try {
            const enclave = AegisEnclave.getInstance();
            await enclave.initialize();
            const { receiptId } = request.params;
            console.log(`[Aegis-12] Retrieving evidence for receipt: ${receiptId}`);
            
            const evidence = await enclave.pep!.getEvidenceByReceiptId(receiptId);
            
            if (!evidence) {
                return reply.status(404).send({ error: `Receipt ${receiptId} not found in state store.` });
            }
            
            return reply.status(200).send({
                receiptId: evidence.receiptId,
                status: evidence.ars_anchor && evidence.ars_anchor !== "pending" ? "COMPLETED" : "PENDING_ASYNC_COMPUTATION",
                ars_anchor: evidence.ars_anchor || "pending",
                zk_vkey: evidence.zk_vkey || "pending",
                ledger_tx: evidence.ledger_tx || "pending",
                timestamp: evidence.timestamp
            });
        } catch (err: any) {
            return reply.status(500).send({ status: 'error', error: err.message });
        }
    }

    public async enforceSolanaTx(request: FastifyRequest, reply: FastifyReply) {
        try {
            const enclave = AegisEnclave.getInstance();
            await enclave.initialize();
            const { serializedTx } = request.body as any;
            if (!serializedTx) return reply.status(400).send({ error: 'Missing required fields: serializedTx' });

            try {
                const tx = Transaction.from(Buffer.from(serializedTx, 'base64'));
                const result = await enclave.pep!.enforce({
                    agent: { did: 'did:aegis:tx-firewall', purpose: 'transaction_protection', currentTier: 'T4' },
                    action: { toolId: 'solana_tx', actionType: 'execute', parameters: { instructions: tx.instructions.length } },
                    context: { currentAnomalyScore: 0.1 },
                    dynamicPolicy: { policyConfig: { tenantId: 'system', nonce: Date.now().toString(), expiresAt: Math.floor(Date.now()/1000)+3600, financialLimitsString: "{}" }, signature: "system-sig", ownerPublicKey: "0x0" }
                } as any);

                return reply.status(200).send({ decision: 'ALLOW', receipt: result });
            } catch (e: any) {
                return reply.status(403).send({ decision: 'BLOCK', flags: [{ rule: 'PARSE_FAILURE', detail: e.message }] });
            }
        } catch (err: any) {
            return reply.status(500).send({ status: 'error', error: err.message });
        }
    }

    public async getGovernanceConfig(request: FastifyRequest, reply: FastifyReply) {
        return {
            protocol: 'squads-v4',
            thresholds: { humanReview: 0.60, hardBlock: 0.80 },
            tierSpendingLimits: { T1: '0 SOL', T2: '1 SOL', T3: '10 SOL', T4: '100 SOL' },
            euAiActMapping: { 'Article 14': 'Squads multisig human-in-the-loop' }
        };
    }

    public async evaluateGovernance(request: FastifyRequest, reply: FastifyReply) {
        try {
            const { anomalyScore, agentTier, estimatedValue, agentDid, toolId, actionType } = request.body as any;
            const result = await this.governance.evaluateAction(anomalyScore, agentTier, estimatedValue, { agentDid, toolId, actionType, parameters: {} });
            
            return result.decision === 'REQUIRE_HUMAN' ? reply.status(202).send(result) : reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(500).send({ status: 'error', error: err.message });
        }
    }

    public async getAttestationStatus(request: FastifyRequest, reply: FastifyReply) {
        const enclave = AegisEnclave.getInstance();
        const { attestation, pcr0 } = await enclave.getHardwareMetadata();

        return {
            teeProvider: 'Phala dStack CVM (Intel SGX)',
            enclaveDid: enclave.signer?.enclaveDid || "unknown",
            enclavePublicKey: enclave.signer?.getPublicKeyHex(),
            signatureAlgorithm: 'Ed25519 (TweetNaCl)',
            pqAlgorithm: 'ML-DSA-65 (NIST FIPS 204)',
            pqPublicKey: enclave.signer?.getPQPublicKeyHex(),
            attestationStatus: attestation === "unknown" ? "SIMULATED" : "HARDWARE_ATTESTED",
            quote: attestation,
            pcr0,
            compliance: { 
                euAiActArticle12: 'Record Keeping via Phala log-seal', 
                euAiActArticle15: 'Cybersecurity via Hardware TEE',
                postQuantumResilience: 'FIPS 204 Compliant Signatures'
            }
        };
    }

    public async getMonetizationStatus(request: FastifyRequest, reply: FastifyReply) {
        return {
            protocol: 'x402-v2',
            currency: 'USDC',
            pricePerCall: 0.005,
            freeTierLimit: 10,
            howItWorks: [
                "1. Agent requests inference",
                "2. Gateway checks x-payment header",
                "3. If missing, returns 402 Payment Required",
                "4. Agent pays via x402-solana SDK",
                "5. Gateway verifies and executes"
            ]
        };
    }

    public async healthtechEnforce(request: FastifyRequest, reply: FastifyReply) {
        try {
            // Validate inputs BEFORE expensive enclave init (fail-fast)
            const payload = request.body as any;
            console.log(`[Aegis-12] /healthtech/enforce request from ${payload?.agentId || 'unknown'}`);
            const { agentId, agentRole, targetAction, payloadData } = payload;
            
            const CLINICIAN_ALLOWED_ACTIONS = ['READ_RECORD', 'WRITE_RECORD', 'READ_SCHEDULE'];
            const isAuthorized = (agentRole === "SCHEDULER" && (targetAction === "READ_SCHEDULE" || targetAction === "WRITE_SCHEDULE")) ||
                                 (agentRole === "CLINICIAN" && CLINICIAN_ALLOWED_ACTIONS.includes(targetAction));

            if (!isAuthorized) {
                console.warn(`[Aegis-12] RBAC_VIOLATION: ${agentId} (${agentRole}) attempted ${targetAction}`);
                return reply.status(403).send({
                    status: 'denied',
                    error: 'RBAC_VIOLATION',
                    evidencePack: { 
                        status: 'denied',
                        decisionReason: `Agent role ${agentRole} is not authorized for ${targetAction}`,
                        regulatoryMapping: 'HIPAA_MINIMUM_NECESSARY_STANDARD'
                    }
                });
            }

            const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/;
            if (payloadData?.query && ssnPattern.test(payloadData.query)) {
                console.warn(`[Aegis-12] HIPAA_VIOLATION: SSN detected in payload from ${agentId}`);
                return reply.status(403).send({
                    status: 'denied',
                    error: 'HIPAA Violation: SSN exfiltration detected.',
                    evidencePack: { 
                        status: 'denied',
                        decisionReason: 'Payload contains restricted PII/PHI matching pattern (SSN)',
                        regulatoryMapping: 'HIPAA_PRIVACY_RULE_164.502' 
                    }
                });
            }

            const enclave = AegisEnclave.getInstance();
            await enclave.initialize();
            const receiptId = `aegis-v1-ht-${Date.now()}`;
            const signature = enclave.signer!.sign(JSON.stringify({ agentId, targetAction, receiptId }));

            const { attestation, pcr0 } = await enclave.getHardwareMetadata();

            const result = {
                status: 'approved',
                agentRole,
                evidencePack: { 
                    status: 'approved',
                    decisionReason: 'Action complies with active RBAC and PHI filtering rules.',
                    regulatoryMapping: 'HIPAA_PRIVACY_RULE'
                },
                cryptographicReceipt: {
                    receiptId,
                    enclaveSignature: signature,
                    timestamp: new Date().toISOString()
                },
                hardwareAttestation: {
                    teeProvider: 'Phala dStack',
                    enclaveDid: enclave.signer!.enclaveDid,
                    pcr0: pcr0,
                    quote: attestation
                }
            };
            console.log(`[Aegis-12] /healthtech/enforce approved: ${receiptId}`);
            return reply.send(result);
        } catch (err: any) {
            console.error(`[Aegis-12] /healthtech/enforce ERROR: ${err.message}`);
            const status = err.message.includes('[TERMINAL REFUSAL]') ? 403 : 500;
            return reply.status(status).send({ status: 'error', error: err.message });
        }
    }

    public async provisionTestKey(request: FastifyRequest, reply: FastifyReply) {
        if (process.env.NODE_ENV !== 'test') return reply.status(403).send({ error: 'Only allowed in test mode' });
        const { tenantId, address } = request.body as any;
        
        const enclave = AegisEnclave.getInstance();
        enclave.pep!.provisionTenant(tenantId, address);
        
        console.log(`[E2E] Provisioning test tenant: ${tenantId} -> ${address}`);
        return reply.send({ status: 'provisioned' });
    }
}
