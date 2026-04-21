import { describe, it, expect } from 'vitest';
import { AegisSigner } from '../../src/infrastructure/AegisSigner';

describe('AegisSigner', () => {
    it('should generate a new keypair if no private key is provided', () => {
        const signer = AegisSigner.createSync();
        expect(signer.getPublicKeyHex()).toBeDefined();
        expect(signer.getPublicKeyHex().length).toBeGreaterThan(0);
        expect(signer.enclaveDid).toMatch(/^did:aegis:enclave:/);
    });



    it('should consistently sign and verify a message', () => {
        const signer = AegisSigner.createSync();
        const message = 'validate_transaction_50000';

        const signature = signer.sign(message);
        const pubKey = signer.getPublicKeyHex();

        expect(signature).toBeDefined();

        // Verifying with the same message and correct key
        const isValid = signer.verify(message, signature, pubKey);
        expect(isValid).toBe(true);
    });

    it('should reject verification if message is altered', () => {
        const signer = AegisSigner.createSync();
        const signature = signer.sign('original_message');

        const isForgedValid = signer.verify('tampered_message', signature, signer.getPublicKeyHex());
        expect(isForgedValid).toBe(false);
    });

    it('should reject verification if signed by a different key', () => {
        const signer1 = AegisSigner.createSync();
        const signature1 = signer1.sign('message');

        // Generate a different random key pair
        const nacl = require('tweetnacl');
        const randomKeyPair = nacl.sign.keyPair();
        const randomPubKeyHex = Buffer.from(randomKeyPair.publicKey).toString('hex');

        // Attempting to verify signer1's signature using a random public key
        const isMisattributedValid = signer1.verify('message', signature1, randomPubKeyHex);
        expect(isMisattributedValid).toBe(false);
    });



    it('should sign EIP712 payloads', () => {
        const signer = AegisSigner.createSync();
        const domain = { name: 'Aegis', version: '1', chainId: 1, verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC' };
        const types = { Person: [{ name: 'name', type: 'string' }] };
        const value = { name: 'Alice' };

        const signature = signer.signEIP712(domain, types, value);
        expect(signature).toBeDefined();
    });

    it('should sign and verify ML-DSA-65 (Post-Quantum) signatures', () => {
        const signer = AegisSigner.createSync();
        const message = 'pq_policy_enforcement_v1';

        const signature = signer.signMLDSA(message);
        const pubKey = signer.getPQPublicKeyHex();

        expect(signature).toBeDefined();
        // ML-DSA-65 signatures are large (~3.3KB = 6600+ hex chars)
        expect(signature.length).toBeGreaterThan(6000);

        const isValid = signer.verifyMLDSA(message, signature, pubKey);
        expect(isValid).toBe(true);
    });

    it('should reject tampered ML-DSA-65 signatures', () => {
        const signer = AegisSigner.createSync();
        const message = 'original';
        const signature = signer.signMLDSA(message);

        const isValid = signer.verifyMLDSA('tampered', signature, signer.getPQPublicKeyHex());
        expect(isValid).toBe(false);
    });
});
