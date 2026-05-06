import { describe, it, expect } from 'vitest';
import * as nacl from 'tweetnacl';
import keccak256 from 'keccak256';
import { AegisGateStub } from '../../src/infrastructure/AegisGateStub';
import { AegisIntentEnvelope } from '../../src/types';
import { JsonUtils } from '../../src/infrastructure/JsonUtils';

const generateMockEnvelope = (validSlot: number): AegisIntentEnvelope => {
        return {
            domain_separator: "AEGIS12_ESCALATE_V1",
            vault_pda: "VaultA",
            squads_multisig: "SquadsA",
            instruction_digest: "0x1234567890abcdef",
            state_predicates: {
                max_input_amount: 50000,
                allowed_program_ids: ["TargetProgram"],
                valid_until_slot: validSlot
            },
            policy_hash: "pol_123"
        };
    };

    const signEnvelope = (envelope: AegisIntentEnvelope, keyPair: nacl.SignKeyPair): AegisIntentEnvelope => {
        const copy = { ...envelope };
        delete copy.tee_signature;
        const envelopeHash = keccak256(Buffer.from(JsonUtils.stableStringify(copy), 'utf8')).toString('hex');
        const messageBytes = new TextEncoder().encode(envelopeHash);
        const signatureBytes = nacl.sign.detached(messageBytes, keyPair.secretKey);
        copy.tee_signature = Buffer.from(signatureBytes).toString('hex');
        return copy;
    };

    it('should successfully verify a valid intent envelope', () => {
        const keyPair = nacl.sign.keyPair();
        const publicKeyHex = Buffer.from(keyPair.publicKey).toString('hex');
        const envelope = signEnvelope(generateMockEnvelope(1000000), keyPair);

        const result = AegisGateStub.verifyAndExecute(
            envelope,
            "0x1234567890abcdef", // proposedInstructionDigest matches
            900000, // currentSlot is before expiration
            publicKeyHex
        );

        expect(result).toBe(true);
    });

    it('should reject execution if expiration slot is passed (State Drift)', () => {
        const keyPair = nacl.sign.keyPair();
        const publicKeyHex = Buffer.from(keyPair.publicKey).toString('hex');
        const envelope = signEnvelope(generateMockEnvelope(1000000), keyPair);

        expect(() => {
            AegisGateStub.verifyAndExecute(
                envelope,
                "0x1234567890abcdef",
                1000001, // currentSlot is after expiration
                publicKeyHex
            );
        }).toThrow(/Execution Rejected: Intent Expired/);
    });

    it('should reject execution if proposed digest does not match (UI Spoofing)', () => {
        const keyPair = nacl.sign.keyPair();
        const publicKeyHex = Buffer.from(keyPair.publicKey).toString('hex');
        const envelope = signEnvelope(generateMockEnvelope(1000000), keyPair);

        expect(() => {
            AegisGateStub.verifyAndExecute(
                envelope,
                "0xHACKER_PAYLOAD", // Mismatch
                900000,
                publicKeyHex
            );
        }).toThrow(/Execution Rejected: Payload Mismatch/);
    });

    it('should reject execution if cryptographic signature is invalid or tampered', () => {
        const keyPair = nacl.sign.keyPair();
        const publicKeyHex = Buffer.from(keyPair.publicKey).toString('hex');
        const envelope = signEnvelope(generateMockEnvelope(1000000), keyPair);

        // Tamper with the state
        envelope.state_predicates.max_input_amount = 9999999;

        expect(() => {
            AegisGateStub.verifyAndExecute(
                envelope,
                "0x1234567890abcdef",
                900000,
                publicKeyHex
            );
        }).toThrow(/Execution Rejected: Invalid Cryptographic Signature/);
    });

    it('should reject execution if TEE signature is missing', () => {
        const keyPair = nacl.sign.keyPair();
        const publicKeyHex = Buffer.from(keyPair.publicKey).toString('hex');
        const envelope = generateMockEnvelope(1000000); // Unsigned

        expect(() => {
            AegisGateStub.verifyAndExecute(
                envelope,
                "0x1234567890abcdef",
                900000,
                publicKeyHex
            );
        }).toThrow(/Execution Rejected: Missing TEE Signature/);
    });
