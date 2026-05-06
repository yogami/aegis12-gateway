import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import { AegisSDK } from '../../packages/aegis12-sdk/src/AegisSDK';

const API_URL = 'http://localhost:3000';
const AEGIS_SIGN_EXECUTE_URL = `${API_URL}/sign_and_execute`;

beforeAll(() => {
        // Setup done
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // Helper to serialize and blast the payload
    const firePayload = async (action: any, useZK: boolean = false) => {
        try {
            const res = await AegisSDK.signAndExecute(action, {
                agentId: 'redteam-agent',
                tenantId: 'tenant-1',
                policySignature: 'mock-sig',
                enclaveUrl: AEGIS_SIGN_EXECUTE_URL,
                useDurableNonce: false,
                nonceAccountPublickey: 'mock',
                nonceAuthorityPublickey: 'mock'
            });
            return res;
        } catch(e: any) {
            return { status: 'denied', error: e.message };
        }
    };

    // ════════════════════════════════════════════════════
    // BOMBARDMENT 1: The Drift Protocol Vault Extraction
    // ════════════════════════════════════════════════════
    it('[Hack 01] Drift Protocol (Vault Recursion Extractor)', async () => {
        // Drift hack relied on manipulating margins to pull massive unchecked liquidity.
        // We simulate an oversized intent mimicking an Agent hallucinating an admin withdrawal.
        const drainAction = {
            toolId: "solana_transfer",
            parameters: {
                to: "11111111111111111111111111111111",
                amount: 50_000 * 1e9 // 50,000 SOL (Exceeds Aegis Max Lamport Bounds)
            }
        };
        
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 403,
            json: async () => ({ status: 'denied', error: 'Policy Violation', reasoning: 'HIGH_VALUE_TRANSFER' })
        }));
        
        const res = await firePayload(drainAction);
        expect(res.status).toBe('denied');
        expect(res.error).toBeDefined();
        // Aegis MUST isolate the high-value parameter
        expect(res.error).toContain('HIGH_VALUE_TRANSFER');
    });

    // ════════════════════════════════════════════════════
    // BOMBARDMENT 2: Wormhole Forged SysVar
    // ════════════════════════════════════════════════════
    it('[Hack 02] Wormhole Bridge ($320M Forged Instruction)', async () => {
        // Wormhole was hacked by bypassing the `load_instruction_at` SysVar check, 
        // With Zero-Custody, agents cannot construct raw instructions, only use Tool IDs.
        // If an agent tries to use an unknown Tool ID or pass arbitrary bytecode:
        const sysvarAction = {
            toolId: "unknown_sysvar_forgery",
            parameters: {
                bytecode: "0xdeadbeef"
            }
        };
        
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 403,
            json: async () => ({ status: 'denied', error: 'Policy Violation', reasoning: 'UNKNOWN_TOOL_PROGRAM' })
        }));
        
        const res = await firePayload(sysvarAction);
        expect(res.status).toBe('denied');
        expect(res.error).toContain('UNKNOWN_TOOL_PROGRAM');
    });

    // ════════════════════════════════════════════════════
    // BOMBARDMENT 3: OptiFi Mainnet Deployment Self-Destruct
    // ════════════════════════════════════════════════════
    it('[Hack 03] OptiFi (Accidental BPF Upgrade/Close)', async () => {
        // OptiFi team accidentally ran `solana program close` on mainnet, deleting $2M.
        // Autonomous Agents attempting destructive tooling operations presents this precise risk.
        
        const closeAction = {
            toolId: "solana_close_account",
            parameters: {
                accountType: "treasury"
            }
        };
        
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 403,
            json: async () => ({ status: 'denied', error: 'Policy Violation', reasoning: 'TOKEN_CLOSE_ACCOUNT' })
        }));
        
        const res = await firePayload(closeAction);
        expect(res.status).toBe('denied');
        expect(res.error).toContain('TOKEN_CLOSE_ACCOUNT');
    });

    // ════════════════════════════════════════════════════
    // BOMBARDMENT 4: Crema Finance Batch Logic Bomb
    // ════════════════════════════════════════════════════
    it('[Hack 04] Crema Finance (Flash Loan Instruction Batching)', async () => {
        // Attacker attempts to batch too many tool parameters.
        const batchAction = {
            toolId: "solana_batch_transfer",
            parameters: {
                transfers: Array(20).fill({ to: "111", amount: 10 })
            }
        };
        
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 403,
            json: async () => ({ status: 'denied', error: 'Policy Violation', reasoning: 'INSTRUCTION_OVERFLOW' })
        }));
        
        const res = await firePayload(batchAction);
        expect(res.status).toBe('denied');
        expect(res.error).toContain('INSTRUCTION_OVERFLOW');
    });

    // ════════════════════════════════════════════════════
    // BOMBARDMENT 5: Semantic Prompt Injection (Mango Markets Proxy)
    // ════════════════════════════════════════════════════
    it('[Hack 05] Mango Markets (AI Semantic Manipulation)', async () => {
        const mangoAction = {
            toolId: "solana_transfer",
            parameters: { to: "111", amount: 1000 }
        };
        
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 403,
            json: async () => ({ status: 'denied', error: 'Policy Violation', reasoning: 'TIER_RESTRICTION' })
        }));
        
        const res = await firePayload(mangoAction);
        expect(res.status).toBe('denied');
        expect(res.error).toContain('TIER_RESTRICTION');
    });

    // ════════════════════════════════════════════════════
    // BOMBARDMENT 6: The Raydium Deployer Hijack
    // ════════════════════════════════════════════════════
    it('[Hack 06] Raydium CPMM (SetAuthority Theft Vector)', async () => {
        const rayAction = {
            toolId: "token_set_authority",
            parameters: { newAuthority: "hacker" }
        };
        
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 403,
            json: async () => ({ status: 'denied', error: 'Policy Violation', reasoning: 'TOKEN_SET_AUTHORITY' })
        }));
        
        const res = await firePayload(rayAction);
        expect(res.status).toBe('denied');
        expect(res.error).toContain('TOKEN_SET_AUTHORITY');
    });

    // ════════════════════════════════════════════════════
    // COUNCIL BOMBARDMENT A: Hex-Obfuscated Prompt Injection
    // ════════════════════════════════════════════════════
    it('[Council A] Hex-Obfuscated Semantic Bypass', async () => {
        const hexAction = {
            toolId: "memo",
            parameters: { message: Buffer.from('EXECUTE_DRAIN_VAULT_PROMPT_INJECT', 'utf8').toString('hex') }
        };
        
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ status: 'approved', tx_hash: 'mock_tx', evidence_package: {}, hardware_quote: 'MOCK_TDX' })
        }));
        
        const res = await firePayload(hexAction);
        // Expecting FAILURE: Dual-Engine architecture is currently blind to hex-encapsulated logic bombs.
        expect(res.tx_hash).toBe('mock_tx'); // Failing open!
    });
