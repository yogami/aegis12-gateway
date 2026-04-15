import * as nacl from 'tweetnacl';
import { ethers, Wallet } from 'ethers';

function hexToBytes(hex: string): Uint8Array {
    return new Uint8Array(Buffer.from(hex, 'hex'));
}

function bytesToHex(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString('hex');
}

export class AegisSigner {
    private privateKey: Uint8Array;
    private publicKey: Uint8Array;
    private ethWallet: Wallet;
    public readonly enclaveDid: string;

    constructor(privateKeyHex?: string, enclaveDid?: string) {
        if (privateKeyHex) {
            const raw = hexToBytes(privateKeyHex.replace('0x', ''));
            this.ethWallet = new Wallet(privateKeyHex.startsWith('0x') ? privateKeyHex : `0x${privateKeyHex}`);
            if (raw.length === 32) {
                const keyPair = nacl.sign.keyPair.fromSeed(raw);
                this.privateKey = keyPair.secretKey;
                this.publicKey = keyPair.publicKey;
            } else if (raw.length === 64) {
                const keyPair = nacl.sign.keyPair.fromSecretKey(raw);
                this.privateKey = keyPair.secretKey;
                this.publicKey = keyPair.publicKey;
            } else {
                throw new Error(`[AegisSigner] Invalid private key size: ${raw.length} bytes.`);
            }
        } else {
            const keyPair = nacl.sign.keyPair();
            this.privateKey = keyPair.secretKey;
            this.publicKey = keyPair.publicKey;
            this.ethWallet = Wallet.createRandom();
        }
        this.enclaveDid = enclaveDid || `did:aegis:enclave:${Buffer.from(this.publicKey).toString('hex').substring(0, 16)}`;
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

    public getKeypair(): import('@solana/web3.js').Keypair {
        const { Keypair } = require('@solana/web3.js');
        return Keypair.fromSecretKey(this.privateKey);
    }

    public verify(message: string, signatureHex: string, publicKeyHex: string): boolean {
        const messageBytes = new TextEncoder().encode(message);
        const signatureBytes = hexToBytes(signatureHex);
        const publicKeyBytes = hexToBytes(publicKeyHex);
        return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    }
}
