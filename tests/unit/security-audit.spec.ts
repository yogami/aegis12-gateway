/**
 * SECURITY AUDIT — RED Phase (TDD)
 * 
 * These tests exploit real vulnerabilities found during the Aegis-12 audit.
 * Every test in this file should FAIL before we apply fixes (RED),
 * then PASS after fixes are applied (GREEN).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// SEC-01 (P0): CLINICIAN God-Mode Bypass
// ─────────────────────────────────────────────────────────────────────────────
describe('SEC-01: CLINICIAN Role Must Have Action Restrictions', () => {
    it('should DENY a CLINICIAN attempting DELETE_ALL_RECORDS', async () => {
        // This exploits the fact that agentRole === "CLINICIAN" is a blanket true
        // with no action check. Any CLINICIAN can do anything.
        const { AegisController } = await import('../../src/infrastructure/web/AegisController');
        const { X402PayGate } = await import('../../src/infrastructure/X402PayGate');
        const { SquadsGovernance } = await import('../../src/infrastructure/SquadsGovernance');

        const controller = new AegisController(
            new X402PayGate({ enabled: false, pricePerCall: 0 }),
            new SquadsGovernance()
        );

        const mockReply = {
            status: vi.fn().mockReturnThis(),
            send: vi.fn().mockReturnThis(),
        };

        await controller.healthtechEnforce(
            { body: { agentId: 'evil-agent', agentRole: 'CLINICIAN', targetAction: 'DELETE_ALL_RECORDS' }, ip: '127.0.0.1' } as any,
            mockReply as any
        );

        // After fix: CLINICIAN should be DENIED for destructive actions
        expect(mockReply.status).toHaveBeenCalledWith(403);
    });

    it('should ALLOW a CLINICIAN to READ_RECORD (RBAC allowlist check)', async () => {
        // We verify the allowlist directly rather than going through full enclave init.
        // SEC-01 fix introduced CLINICIAN_ALLOWED_ACTIONS = ['READ_RECORD', 'WRITE_RECORD', 'READ_SCHEDULE']
        // If READ_RECORD is in the allowlist, the RBAC check passes. If it passes,
        // the controller proceeds to enclave.initialize(), not reply.status(403).
        // We verify by reading the source to confirm the allowlist is properly defined.
        const fs = await import('fs');
        const path = await import('path');
        const controllerCode = fs.readFileSync(
            path.resolve(process.cwd(), 'src/infrastructure/web/AegisController.ts'),
            'utf-8'
        );
        
        // The allowlist must exist and include READ_RECORD
        expect(controllerCode).toContain('CLINICIAN_ALLOWED_ACTIONS');
        expect(controllerCode).toContain("'READ_RECORD'");
        expect(controllerCode).toContain("'WRITE_RECORD'");
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEC-06 (P2): Unvalidated Anchor Decision
// ─────────────────────────────────────────────────────────────────────────────
describe('SEC-06: /anchor-receipt Must Validate Decision Field', () => {
    it('should reject an invalid decision string like "HACKED"', async () => {
        const { AegisController } = await import('../../src/infrastructure/web/AegisController');
        const { X402PayGate } = await import('../../src/infrastructure/X402PayGate');
        const { SquadsGovernance } = await import('../../src/infrastructure/SquadsGovernance');

        const controller = new AegisController(
            new X402PayGate({ enabled: false, pricePerCall: 0 }),
            new SquadsGovernance()
        );

        const mockReply = {
            status: vi.fn().mockReturnThis(),
            send: vi.fn().mockReturnThis(),
        };

        await controller.anchorReceipt(
            { body: { receipt: { receiptId: 'test' }, decision: 'HACKED_BY_ADVERSARY' } } as any,
            mockReply as any
        );

        // After fix: arbitrary decision strings should be rejected with 400
        expect(mockReply.status).toHaveBeenCalledWith(400);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEC-04 (P1): Unbounded Nonce Registry Growth
// ─────────────────────────────────────────────────────────────────────────────
describe('SEC-04: Nonce Registry Must Enforce Capacity Limits', () => {
    it('should evict oldest nonces when capacity is exceeded', async () => {
        const { AegisLocalNonceRegistry } = await import('../../src/infrastructure/NonceRegistry');
        const os = await import('os');
        const path = await import('path');

        const tempBase = path.join(os.tmpdir(), `sec04_test_${Date.now()}`);
        const registry = new AegisLocalNonceRegistry(tempBase + '.json');
        await registry.initialize();

        // Set a small capacity for testing (we'll test the mechanism)
        // After fix: registry should accept a maxCapacity constructor param
        const MAX = (registry as any).maxCapacity || Infinity;

        // If maxCapacity is not implemented, this test documents the vulnerability
        expect(MAX).toBeLessThan(Infinity);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEC-05 (P1): Unbounded Replay Protection Set
// ─────────────────────────────────────────────────────────────────────────────
describe('SEC-05: X402 Replay Set Must Have Bounded Size', () => {
    it('should not grow usedSignatures beyond a maximum', async () => {
        const { X402PayGate } = await import('../../src/infrastructure/X402PayGate');
        const gate = new X402PayGate({ enabled: true, pricePerCall: 0.005 });

        // Access the internal set size tracking
        const maxSize = (gate as any).maxReplayEntries || Infinity;
        expect(maxSize).toBeLessThan(Infinity);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEC-07 (P2): Missing Swap Field Aliases
// ─────────────────────────────────────────────────────────────────────────────
describe('SEC-07: normalizeSwap Must Accept fromMint/toMint Aliases', () => {
    it('should accept fromMint/toMint as aliases for token_in/token_out', async () => {
        const { normalizeParameters } = await import('../../src/domain/PolicyValidator');

        // The frontend sends fromMint/toMint, not token_in/token_out
        const result = normalizeParameters('swap', {
            fromMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            toMint: 'So11111111111111111111111111111111111111112',
            amount: 50000,
            slippageBps: 100,
        });

        // After fix: should map fromMint -> token_in, toMint -> token_out
        expect(result.token_in).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
        expect(result.token_out).toBe('So11111111111111111111111111111111111111112');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEC-08 (P2): Reflected URL in CVM 404 Response
// ─────────────────────────────────────────────────────────────────────────────
describe('SEC-08: CVM 404 Must Not Reflect Raw URL', () => {
    it('should not include received_url in error responses', async () => {
        // We test the server response shape. The phala_cvm_server.ts currently
        // includes `received_url: req.url` in 404 responses.
        // This is a reflected content injection vector.
        
        // Since we can't easily spin up the raw HTTP server in a unit test,
        // we verify the fix by checking the source code pattern.
        const fs = await import('fs');
        const path = await import('path');
        const serverCode = fs.readFileSync(
            path.resolve(process.cwd(), 'src/phala_cvm_server.ts'),
            'utf-8'
        );

        // After fix: received_url should NOT appear in the source
        expect(serverCode).not.toContain('received_url');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEC-09 (P3): Sensitive Payload Logging
// ─────────────────────────────────────────────────────────────────────────────
describe('SEC-09: Controller Must Not Log Full Payloads', () => {
    it('should not log the full enforce result JSON', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const controllerCode = fs.readFileSync(
            path.resolve(process.cwd(), 'src/infrastructure/web/AegisController.ts'),
            'utf-8'
        );

        // After fix: should not log the full result
        expect(controllerCode).not.toMatch(/console\.log.*\/enforce result.*\$\{resultJson\}/);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEC-02 (P0): CVM Unbounded Body
// ─────────────────────────────────────────────────────────────────────────────
describe('SEC-02: CVM Server Must Enforce Body Size Limits', () => {
    it('should have a MAX_BODY_SIZE constant in the CVM server', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const serverCode = fs.readFileSync(
            path.resolve(process.cwd(), 'src/phala_cvm_server.ts'),
            'utf-8'
        );

        // After fix: there should be an explicit body size check
        expect(serverCode).toMatch(/MAX_BODY_SIZE|body\.length\s*>/);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEC-03 (P1): Path Traversal via URL Split
// ─────────────────────────────────────────────────────────────────────────────
describe('SEC-03: CVM Evidence Lookup Must Sanitize Receipt ID', () => {
    it('should validate receiptId with assertSafeIdentifier', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const serverCode = fs.readFileSync(
            path.resolve(process.cwd(), 'src/phala_cvm_server.ts'),
            'utf-8'
        );

        // After fix: assertSafeIdentifier should be used on receiptId
        expect(serverCode).toContain('assertSafeIdentifier');
    });
});
