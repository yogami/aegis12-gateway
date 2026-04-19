import * as nacl from 'tweetnacl';
import { ethers, Wallet } from 'ethers';
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
    private ethWallet!: Wallet;
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

        // Derive Ethereum (secp256k1) key
        const ethDerived = await tappd.deriveKey("aegis-12/eth-secp256k1", 'secp256k1');
        instance.ethWallet = new Wallet(ethDerived);

        // Wipe derivation buffers
        rawSol.fill(0);

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
        const solanaDerived = tappd.deriveKey("aegis-12/solana-ed25519");
        const rawSol = hexToBytes(solanaDerived.replace('0x', ''));
        const keyPair = nacl.sign.keyPair.fromSeed(rawSol.slice(0, 32));
        instance.privateKey = keyPair.secretKey;
        instance.publicKey = keyPair.publicKey;
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
}
