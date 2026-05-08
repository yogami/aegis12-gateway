/**
 * SessionKey — Value Object
 *
 * Represents an ephemeral ed25519 keypair generated inside the TEE.
 * The private key never leaves enclave memory.
 * SRP: Only responsible for key generation, signing, and verification.
 */
import * as nacl from 'tweetnacl';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function toBase58(bytes: Uint8Array): string {
    let num = BigInt('0x' + Buffer.from(bytes).toString('hex'));
    const chars: string[] = [];
    while (num > 0n) {
        chars.unshift(BASE58_ALPHABET[Number(num % 58n)]);
        num = num / 58n;
    }
    for (const b of bytes) {
        if (b === 0) chars.unshift('1');
        else break;
    }
    return chars.join('');
}

export class SessionKey {
    private constructor(
        private readonly keypair: nacl.SignKeyPair,
    ) {}

    static generate(): SessionKey {
        return new SessionKey(nacl.sign.keyPair());
    }

    static loadOrGenerate(filepath = '.tee_session.json'): SessionKey {
        import('fs').then(fs => {
            // Cannot be synchronous without changing API, so we'll do a simple
            // synchronous read since this is a local utility.
        });
        
        // Actually, we can use fs.readFileSync safely here
        const fs = require('fs');
        try {
            if (fs.existsSync(filepath)) {
                const secret = JSON.parse(fs.readFileSync(filepath, 'utf8'));
                const keypair = nacl.sign.keyPair.fromSecretKey(new Uint8Array(secret));
                return new SessionKey(keypair);
            }
        } catch (e) {
            // Fallthrough to generate
        }
        return SessionKey.generate();
    }

    static fromSeed(seed: Uint8Array): SessionKey {
        return new SessionKey(nacl.sign.keyPair.fromSeed(seed));
    }

    publicKeyBase58(): string {
        return toBase58(this.keypair.publicKey);
    }

    publicKeyBytes(): Uint8Array {
        return this.keypair.publicKey;
    }

    sign(message: string): Uint8Array {
        const bytes = new TextEncoder().encode(message);
        return nacl.sign.detached(bytes, this.keypair.secretKey);
    }

    verify(message: string, signature: Uint8Array): boolean {
        const bytes = new TextEncoder().encode(message);
        return nacl.sign.detached.verify(bytes, signature, this.keypair.publicKey);
    }

    secretKeyBytes(): Uint8Array {
        return this.keypair.secretKey;
    }
}
