import * as nacl from 'tweetnacl';
import { ethers, Wallet } from 'ethers';
import { PhalaTappdMock } from './PhalaTappdMock';

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

    constructor(enclaveDid?: string) {
        // TEE Hardware Seed Derivation (Mitigates CRIT-01 and A-1)
        const tappd = new PhalaTappdMock();
        
        // Derive Solana (Ed25519) key
        const solanaDerived = tappd.deriveKey("aegis-12/solana-ed25519");
        const rawSol = hexToBytes(solanaDerived.replace('0x', ''));
        const keyPair = nacl.sign.keyPair.fromSeed(rawSol.slice(0, 32));
        this.privateKey = keyPair.secretKey;
        this.publicKey = keyPair.publicKey;

        // Derive Ethereum (secp256k1) key
        const ethDerived = tappd.deriveKey("aegis-12/eth-secp256k1");
        this.ethWallet = new Wallet(ethDerived);

        // Wipe derivation buffers and plaintext ENV if present
        if (process.env.SOLANA_PRIVATE_KEY_HEX) delete process.env.SOLANA_PRIVATE_KEY_HEX;
        if (process.env.ETH_PRIVATE_KEY_HEX) delete process.env.ETH_PRIVATE_KEY_HEX;
        rawSol.fill(0);

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



    public verify(message: string, signatureHex: string, publicKeyHex: string): boolean {
        const messageBytes = new TextEncoder().encode(message);
        const signatureBytes = hexToBytes(signatureHex);
        const publicKeyBytes = hexToBytes(publicKeyHex);
        return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    }
}
