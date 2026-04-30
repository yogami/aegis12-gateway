import * as nacl from 'tweetnacl';
import keccak256 from 'keccak256';
import { AegisIntentEnvelope } from '../types';
import { JsonUtils } from './JsonUtils';

/**
 * AegisGateStub
 * 
 * [HACKATHON DEMO STUB]
 * This is a TypeScript simulation of the on-chain Solana Program (AegisGate).
 * In a real environment, this logic lives inside a Rust Solana Smart Contract.
 * 
 * Purpose:
 * It verifies the TEE's cryptographic signature on the AegisIntentEnvelope
 * before allowing Squads to execute the underlying Cross-Program Invocation (CPI).
 * This neutralizes State Drift and UI Spoofing attacks in the HOTL gap.
 */
export class AegisGateStub {

    /**
     * Simulates the Solana program instruction: `AegisGate::execute_intent`
     * 
     * @param envelope The payload signed by the TEE
     * @param proposedInstructionDigest The hash of the actual transaction Squads is trying to execute
     * @param currentSlot The current Solana block slot
     * @param attestedTeePublicKey The public key of the Phala TEE enclave
     * @returns boolean True if execution is permitted, throws Error otherwise.
     */
    public static verifyAndExecute(
        envelope: AegisIntentEnvelope,
        proposedInstructionDigest: string,
        currentSlot: number,
        attestedTeePublicKey: string // Hex representation
    ): boolean {
        
        console.log(`[AegisGate-OnChain] 🛡️ Validating Intent Execution...`);

        // 1. Check Signature Existence
        if (!envelope.tee_signature) {
            throw new Error("[AegisGate] ❌ Execution Rejected: Missing TEE Signature.");
        }

        // 2. Check Expiration Epoch (State Drift Defense)
        if (currentSlot > envelope.state_predicates.valid_until_slot) {
            throw new Error(`[AegisGate] ❌ Execution Rejected: Intent Expired. Current Slot: ${currentSlot}, Expires: ${envelope.state_predicates.valid_until_slot}`);
        }

        // 3. Check Payload Match (UI Spoofing Defense)
        if (envelope.instruction_digest !== proposedInstructionDigest) {
            throw new Error(`[AegisGate] ❌ Execution Rejected: Payload Mismatch. UI Spoofing Detected!`);
        }

        // 4. Cryptographic Signature Verification
        const envelopeHash = keccak256(Buffer.from(JsonUtils.stableStringify(this.stripSignature(envelope)), 'utf8')).toString('hex');

        const messageBytes = new TextEncoder().encode(envelopeHash);
        const signatureBytes = new Uint8Array(Buffer.from(envelope.tee_signature, 'hex'));
        const publicKeyBytes = new Uint8Array(Buffer.from(attestedTeePublicKey, 'hex'));

        const isVerified = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

        if (!isVerified) {
            throw new Error("[AegisGate] ❌ Execution Rejected: Invalid Cryptographic Signature.");
        }

        console.log(`[AegisGate-OnChain] ✅ Intent Cryptographically Verified. CPI Authorized.`);
        return true;
    }

    private static stripSignature(envelope: AegisIntentEnvelope): any {
        const copy = { ...envelope };
        delete copy.tee_signature;
        return copy;
    }
}
