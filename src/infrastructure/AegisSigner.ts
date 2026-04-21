import * as nacl from 'tweetnacl';
import { ethers, Wallet } from 'ethers';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { PhalaTappdMock } from './PhalaTappdMock';

function hexToBytes(hex: string): Uint8Array {
    return new Uint8Array(Buffer.from(hex, 'hex'));
}

function bytesToHex(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString('hex');
}

import { TappdClient } from './TappdClient';

export class AegisSigner {
    private privateKey!: Uint8Array;
    private publicKey!: Uint8Array;
    private pqSecretKey!: Uint8Array;
    private pqPublicKey!: Uint8Array;
    private ethWallet!: Wallet;
    /**
     * The hardware derivation path for Aegis-12 is rooted in the Phala dStack Root of Trust.
     * We use HKDF-based derivation to separate concerns across cryptographic domains:
     * - aegis-12/solana-ed25519: Primary anchoring and identity.
     * - aegis-12/ml-dsa-65: Post-Quantum policy signatures (NIST FIPS 204).
     * - aegis-12/eth-secp256k1: EIP-712 Governance and Multisig signatures.
     * This ensures that compromising one domain's keys does not compromise the hardware identity.
     */
    public enclaveDid!: string;

    private constructor() {}

    public static async create(enclaveDid?: string): Promise<AegisSigner> {
        const instance = new AegisSigner();
        const tappd = new TappdClient();
        
        // Derive Solana (Ed25519) key
        const solanaDerived = await tappd.deriveKey("aegis-12/solana-ed25519", 'ed25519');
        const rawSol = hexToBytes(solanaDerived.replace('0x', ''));
        const keyPair = nacl.sign.keyPair.fromSeed(rawSol.slice(0, 32));
        instance.privateKey = keyPair.secretKey;
        instance.publicKey = keyPair.publicKey;

        // [POST-QUANTUM] Derive ML-DSA-65 seed
        const pqDerived = await tappd.deriveKey("aegis-12/ml-dsa-65", 'ed25519');
        const rawPq = hexToBytes(pqDerived.replace('0x', ''));
        const pqKeys = ml_dsa65.keygen(rawPq.slice(0, 32));
        instance.pqSecretKey = pqKeys.secretKey;
        instance.pqPublicKey = pqKeys.publicKey;

        // Derive Ethereum (secp256k1) key
        const ethDerived = await tappd.deriveKey("aegis-12/eth-secp256k1", 'secp256k1');
        instance.ethWallet = new Wallet(ethDerived);

        // Wipe derivation buffers
        rawSol.fill(0);
        rawPq.fill(0);

        instance.enclaveDid = enclaveDid || `did:aegis:enclave:${Buffer.from(instance.publicKey).toString('hex').substring(0, 16)}`;
        return instance;
    }

    /**
     * @deprecated Use AegisSigner.create() for production. This method uses PhalaTappdMock
     * (simulated HKDF keys) and exists ONLY for synchronous unit test compatibility.
     * Calling this in production will produce keys that are NOT hardware-attested.
     */
    public static createSync(enclaveDid?: string): AegisSigner {
        if (process.env.NODE_ENV === 'production') {
            console.error('[AegisSigner] ⛔ CRITICAL: createSync() called in production. This uses simulated keys. Use AegisSigner.create() instead.');
        }
        const instance = new AegisSigner();
        const tappd = new PhalaTappdMock();
        
        // Simulated Ed25519
        const solanaDerived = tappd.deriveKey("aegis-12/solana-ed25519");
        const rawSol = hexToBytes(solanaDerived.replace('0x', ''));
        const keyPair = nacl.sign.keyPair.fromSeed(rawSol.slice(0, 32));
        instance.privateKey = keyPair.secretKey;
        instance.publicKey = keyPair.publicKey;

        // Simulated ML-DSA-65
        const pqDerived = tappd.deriveKey("aegis-12/ml-dsa-65");
        const rawPq = hexToBytes(pqDerived.replace('0x', ''));
        const pqKeys = ml_dsa65.keygen(rawPq.slice(0, 32));
        instance.pqSecretKey = pqKeys.secretKey;
        instance.pqPublicKey = pqKeys.publicKey;

        const ethDerived = tappd.deriveKey("aegis-12/eth-secp256k1");
        instance.ethWallet = new Wallet(ethDerived);
        instance.enclaveDid = enclaveDid || `did:aegis:enclave:${Buffer.from(instance.publicKey).toString('hex').substring(0, 16)}`;
        return instance;
    }

    public getAddress(): string {
        return this.ethWallet.address;
    }

    public getPublicKeyHex(): string {
        return bytesToHex(this.publicKey);
    }

    public sign(message: string): string {
        const messageBytes = new TextEncoder().encode(message);
        const signedBytes = nacl.sign.detached(messageBytes, this.privateKey);
        return bytesToHex(signedBytes);
    }

    public async signEIP712(domain: any, types: any, value: Record<string, any>): Promise<string> {
        // --- WORLD CLASS CRITICAL FIX: USE ACTUAL ECDSA FOR EIP-712 ---
        // ED25519 (tweetnacl) is incompatible with standard EIP-712 verification.
        // We use the internal ethers.Wallet to produce a legitimate Ethereum-compatible signature.
        // This is an ASYNC call.
        return await this.ethWallet._signTypedData(domain, types, value);
    }



    public verify(message: string, signatureHex: string, publicKeyHex: string): boolean {
        const messageBytes = new TextEncoder().encode(message);
        const signatureBytes = hexToBytes(signatureHex);
        const publicKeyBytes = hexToBytes(publicKeyHex);
        return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    }

    /**
     * [POST-QUANTUM] NIST ML-DSA-65 (Dilithium) Signing
     * Standard: FIPS 204
     */
    public signMLDSA(message: string): string {
        const messageBytes = new TextEncoder().encode(message);
        const signedBytes = ml_dsa65.sign(messageBytes, this.pqSecretKey);
        return bytesToHex(signedBytes);
    }

    public verifyMLDSA(message: string, signatureHex: string, publicKeyHex: string): boolean {
        const messageBytes = new TextEncoder().encode(message);
        const signatureBytes = hexToBytes(signatureHex);
        const publicKeyBytes = hexToBytes(publicKeyHex);
        return ml_dsa65.verify(signatureBytes, messageBytes, publicKeyBytes);
    }

    public getPQPublicKeyHex(): string {
        return bytesToHex(this.pqPublicKey);
    }
}
