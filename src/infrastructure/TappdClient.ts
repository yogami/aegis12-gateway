import * as http from 'http';

/**
 * TappdClient — Production-Grade Phala TEE Hardware Connector
 * 
 * Automatically detects if running inside a Phala dStack CVM (v0.5+) 
 * and routes key derivation to the hardware Root of Trust.
 * 
 * Fallback: PhalaTappdMock (for local development/simulated runs).
 */
export class TappdClient {
    private readonly socketPath = '/var/run/dstack.sock';
    private readonly isTee: boolean;

    constructor() {
        // Detect TEE environment via Unix socket presence or environment signals
        this.isTee = process.env.TEE_ENV === 'phala' || require('fs').existsSync(this.socketPath);
        if (this.isTee) {
            console.log('[TappdClient] ✅ Phala Hardware dStack detected. Initializing Secure HAL.');
        } else {
            console.warn('[TappdClient] ⚠️ Hardware dStack not found. Falling back to Simulation Mode.');
        }
    }

    /**
     * Derives a 32-byte key from the hardware Root of Trust.
     */
    public async deriveKey(path: string, algorithm: 'secp256k1' | 'ed25519' = 'secp256k1'): Promise<string> {
        if (!this.isTee) {
            // Fallback to Mock implementation
            const { PhalaTappdMock } = require('./PhalaTappdMock');
            return new PhalaTappdMock().deriveKey(path);
        }

        return new Promise((resolve, reject) => {
            const body = JSON.stringify({
                path,
                purpose: 'aegis-12-enforcement',
                algorithm
            });

            const options = {
                socketPath: this.socketPath,
                path: '/GetKey',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                }
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`[TappdClient] Hardware Derivation Failed: ${data}`));
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed.key.startsWith('0x') ? parsed.key : '0x' + parsed.key);
                    } catch (e) {
                        reject(new Error(`[TappdClient] Malformed Hardware Response: ${e}`));
                    }
                });
            });

            req.on('error', (e) => reject(new Error(`[TappdClient] Socket Error: ${e.message}`)));
            req.write(body);
            req.end();
        });
    }

    /**
     * Gets a hardware attestation quote for the current enclave.
     */
    public async getQuote(data: string): Promise<string> {
        if (!this.isTee) return "not_available_in_simulation";

        return new Promise((resolve, reject) => {
            const body = JSON.stringify({ data });
            const options = {
                socketPath: this.socketPath,
                path: '/GetQuote',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                }
            };

            const req = http.request(options, (res) => {
                let responseData = '';
                res.on('data', chunk => responseData += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(responseData);
                        resolve(parsed.quote);
                    } catch (e) {
                        reject(new Error(`[TappdClient] Attestation Failure: ${e}`));
                    }
                });
            });

            req.on('error', e => reject(e));
            req.write(body);
            req.end();
        });
    }
}
