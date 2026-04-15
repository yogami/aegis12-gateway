import { AegisPEP } from '../infrastructure/AegisPEP';
import { AegisSigner } from '../infrastructure/AegisSigner';
import { PolicyEvaluationRequest } from '../types';
import { HealthtechPEP } from '../infrastructure/HealthtechPEP';
import { HealthtechRequest, HealthtechPolicy } from '../healthtech-types';

// The TEE generates a secure in-memory keypair upon instantiation that never leaves the hardware.
// In a full Phala Phat Contract, this can be derived deterministically from the enclave's root key.
const signer = new AegisSigner();

// --- PLAYWRIGHT E2E SYNC ---
// To bridge the EIP-712 Cross-Chain boundary in test environments without hitting a live KMS,
// we allow dynamic provisioning of a test wallet via a test-only injection function.
let trustStore: Record<string, string[]> = {};
try {
    let rawConfig = process.env.AUTHORIZED_TENANTS;
    if (rawConfig) {
        // Sanitize: strip outer quotes if they exist (common in some CI/CD environments)
        rawConfig = rawConfig.trim();
        if ((rawConfig.startsWith("'") && rawConfig.endsWith("'")) || 
            (rawConfig.startsWith('"') && rawConfig.endsWith('"'))) {
            rawConfig = rawConfig.substring(1, rawConfig.length - 1);
        }
        trustStore = JSON.parse(rawConfig);
    }
} catch (err) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error("[FATAL] Production Root-of-Trust initialization failed. Invalid JSON in AUTHORIZED_TENANTS.");
    }
    console.warn("Invalid AUTHORIZED_TENANTS fallback initialized.");
}

const pep = new AegisPEP(signer, trustStore);

/**
 * Main entrypoint for the Phala Network JS Enclave.
 * This function handles incoming execution requests from NoahAI agents.
 */
export default async function phalaEntrypoint(requestPayload: string): Promise<string> {
    try {
        const payload: PolicyEvaluationRequest = JSON.parse(requestPayload);

        // 1. Evaluate the action through the Hardware PEP
        const receipt = await pep.enforce(payload);

        // We use AbortSignal to handle the timeout cleanly in Node 20
        let attestation = "LOCAL_MOCK_ATTESTATION";
        try {
            // The Phala dstack CVM exposes a local API for the enclave to request its own hardware quote
            // This is only accessible from inside the TEE itself.
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1000);

            const attestationResponse = await fetch('http://127.0.0.1:8090/quote', { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!attestationResponse.ok) {
                throw new Error(`HTTP Error ${attestationResponse.status}`);
            }
            const data = await attestationResponse.json();
            attestation = data.quote;
        } catch (err) {
            if (process.env.NODE_ENV === 'production') {
                throw new Error("TERMINAL REFUSAL: SECURE ENCLAVE HARDWARE ATTESTATION FAILED. Phala Dstack unreachable.");
            }
            console.warn("[Aegis TEE] Fetching dstack attestation failed. Running in unprotected mock mode.");
        }

        // 2. Return cryptographically signed receipt + mock attestation
        return JSON.stringify({
            status: "approved",
            receipt,
            enclaveDid: signer.enclaveDid,
            // In a production Phala deployment, the host injects the real quote here:
            attestation,
            message: "Action approved by Aegis Hardware Enclave."
        });
    } catch (e: any) {
        // TERMINAL REFUSAL
        // The hardware enclave explicitly denied the action.
        return JSON.stringify({
            status: "denied",
            error: e.message,
            enclaveDid: signer.enclaveDid,
            message: "Aegis Hardware Enclave blocked this transaction due to policy violation."
        });
    }
}

/**
 * Entrypoint for the Healthtech (Path B) MVP.
 * Analyzes requests for HIPAA compliance and issues Evidence Packs.
 */
export async function handleHealthtechRequest(requestPayload: string): Promise<string> {
    try {
        const payload: HealthtechRequest = JSON.parse(requestPayload);

        // Define the hardcoded HIPAA policy for this TEE deployment
        const hospitalPolicy: HealthtechPolicy = {
            policyId: "HIPAA_STRICT_V1",
            version: "1.0.0",
            allowedActions: {
                "SCHEDULER": ["READ_SCHEDULE", "WRITE_APPOINTMENT"],
                "CLINICIAN": ["READ_SCHEDULE", "READ_ONCOLOGY_RECORD", "WRITE_APPOINTMENT"],
                "BILLING": ["READ_BILLING_RECORD"]
            },
            // Regex to block any payload containing a pattern resembling an SSN
            blockedDataPatterns: [/\b\d{3}-\d{2}-\d{4}\b/]
        };

        const healthtechPep = new HealthtechPEP(hospitalPolicy, signer);
        const result = await healthtechPep.evaluate(payload);

        let attestation = "LOCAL_MOCK_ATTESTATION";
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1000);
            const attestationResponse = await fetch('http://127.0.0.1:8090/quote', { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!attestationResponse.ok) {
                throw new Error(`HTTP Error ${attestationResponse.status}`);
            }
            const data = await attestationResponse.json();
            attestation = data.quote;
        } catch (err) {
            if (process.env.NODE_ENV === 'production') {
                throw new Error("TERMINAL REFUSAL: SECURE ENCLAVE HARDWARE ATTESTATION FAILED.");
            }
            console.warn("[Aegis Healthtech] Fetching dstack attestation failed. Running in mock mode.");
        }

        result.hardwareAttestation = attestation;
        return JSON.stringify(result);

    } catch (e: any) {
        return JSON.stringify({
            status: "denied",
            error: e.message,
            enclaveDid: signer.enclaveDid,
            message: "Healthtech API encountered a fatal parsing error."
        });
    }
}
