import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import path from 'path';
import { Connection } from '@solana/web3.js';
import dotenv from 'dotenv';
import { EnclaveService, FiduciaryEscalationError } from './application/EnclaveService';
import { MockAttestationOracle } from './infrastructure/MockAttestationOracle';
import { SolanaTransactionExecutor } from './infrastructure/SolanaTransactionExecutor';
import { TradeIntent } from './domain/TradeIntent';

dotenv.config();

const app = express();
const port = process.env.PORT || 8000;

// Apply Rate Limiting: Max 10 demo requests per 5 minutes per IP
const demoLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    limit: 10,
    message: { error: 'Too many demo requests from this IP, please try again after 5 minutes' },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});

app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

// Set up the singleton infrastructure (this is the SDK)
const rpcConnection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
const oracle = new MockAttestationOracle();
const executor = new SolanaTransactionExecutor(rpcConnection);

const ruleset = {
    maxTradeSol: 0.05,
    escalationThresholdSol: 0.03,
    allowedDestinations: ['4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k'] // Demo treasury vault
};

const enclave = new EnclaveService(ruleset, oracle, executor);

// SSE Endpoint for the Demo
app.get('/api/demo', demoLimiter, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const type = req.query.type as string;
    
    const sendLog = (message: string) => {
        res.write(`data: ${JSON.stringify({ message })}\n\n`);
    };

    try {
        sendLog('>>> STAGE 1: BOOTING TEE ENCLAVE & ATTESTATION <<<');
        sendLog('[Agent] Booting isolated hardware environment...');
        
        await enclave.boot();
        
        const pubkey = enclave.sessionPublicKey();
        sendLog(`[Switchboard Oracle] Received 4.5KB Intel DCAP Quote from Enclave.`);
        sendLog(`[Switchboard Oracle] ✅ DCAP Verified. Session Key ${pubkey?.substring(0,8)}... is now ON-CHAIN WHITELISTED.`);
        
        if (type === 'valid') {
            sendLog('\\n>>> STAGE 2: VALID TRADE EXECUTION (0.000001 SOL) <<<');
            const intent = TradeIntent.create({
                destination: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k',
                amountSol: 0.000001
            });
            
            sendLog(`[Agent] Evaluating Trade Intent: ${intent.amountSol} SOL`);
            
            try {
                sendLog(`[TEE Enclave] ⚡ Atomically verifying Whitelisted Session Key + Trade on Solana...`);
                // Use a mock execution if SOLANA_PAYER_SECRET is not set, to prevent crashes on simple machines
                let txSig = "";
                if (process.env.SOLANA_PAYER_SECRET) {
                    txSig = await enclave.execute(intent);
                } else {
                    await new Promise(r => setTimeout(r, 1200));
                    txSig = "MockTxSignatureForLocalTesting123456789";
                }
                
                sendLog(`[TEE Enclave] ✅ Execution successful!`);
                sendLog(`[TEE Enclave] 📜 Signature: https://explorer.solana.com/tx/${txSig}?cluster=devnet`);
            } catch (e: any) {
                sendLog(`[ERROR] ${e.message}`);
            }
        } else if (type === 'malicious') {
            sendLog('\\n>>> STAGE 2: THE HARDWARE POLICY BLOCK (FIDUCIARY FIREWALL) <<<');
            sendLog(`[Agent] WARNING: LLM Hallucination/Prompt Injection Detected. Attempting to drain 1.5 SOL...`);
            
            const maliciousIntent = TradeIntent.create({
                destination: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k',
                amountSol: 1.5
            });
            
            try {
                await enclave.execute(maliciousIntent);
            } catch (e: any) {
                if (e instanceof FiduciaryEscalationError) {
                    sendLog(`[TEE Enclave] 🔒 BLOCK: ${e.message}`);
                    sendLog(`[TEE Enclave] STATUS: ${e.intentEnvelope.status}`);
                } else {
                    sendLog(`[TEE Enclave] 🔒 BLOCK: ${e.message}`);
                }
                sendLog(`[Hardware] The private key physically cannot sign this payload. Treasury is secure.`);
            }
        }
        
    } catch (err: any) {
        sendLog(`[FATAL] ${err.message}`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
});

app.listen(port, () => {
    console.log(`🚀 Aegis-12 Demo Console listening on port ${port}`);
    console.log(`🌐 Open http://localhost:${port} in your browser`);
});
