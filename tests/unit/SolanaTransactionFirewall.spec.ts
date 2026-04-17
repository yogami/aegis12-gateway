import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SolanaTransactionFirewall } from '../../src/infrastructure/SolanaTransactionFirewall';
import { Connection, Keypair, SystemProgram, Transaction, PublicKey } from '@solana/web3.js';
import { AegisSigner } from '../../src/infrastructure/AegisSigner';

describe('SolanaTransactionFirewall (Unit)', () => {
    let mockSigner: any;
    let mockConnections: any[];
    let firewall: SolanaTransactionFirewall;

    beforeEach(() => {
        mockSigner = {
            sign: vi.fn().mockReturnValue('mock-signature'),
            enclaveDid: 'did:aegis:enclave:mock'
        };

        const mockSimulate = vi.fn().mockResolvedValue({
            value: {
                err: null,
                logs: ['Program 11111111111111111111111111111111 invoke [1]']
            }
        });

        mockConnections = [
            { simulateTransaction: mockSimulate },
            { simulateTransaction: mockSimulate },
            { simulateTransaction: mockSimulate },
            { simulateTransaction: mockSimulate }
        ];

        firewall = new SolanaTransactionFirewall(mockSigner, mockConnections, { maxTransferLamports: 1000 });
    });

    it('should throw error if initialized with less than 4 connections', () => {
        expect(() => new SolanaTransactionFirewall(mockSigner, [])).toThrow(/True BFT Quorum requires a minimum of 4 RPC nodes/);
    });

    it('should allow a simple valid transaction', async () => {
        const kp = Keypair.generate();
        const tx = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: kp.publicKey,
                toPubkey: kp.publicKey,
                lamports: 100
            })
        );
        tx.recentBlockhash = '11111111111111111111111111111111';
        tx.feePayer = kp.publicKey;
        
        const serialized = tx.serialize({ requireAllSignatures: false }).toString('base64');
        
        const res = await firewall.inspectTransaction(serialized, kp.publicKey.toBase58());
        expect(res.decision).toBe('ALLOW');
        expect(res.flags).toHaveLength(0);
    });

    it('should block if parsing fails', async () => {
        const res = await firewall.inspectTransaction('invalid-base64', 'wallet');
        expect(res.decision).toBe('BLOCK');
        expect(res.flags[0].rule).toBe('PARSE_FAILURE');
    });

    it('should block high value transfers', async () => {
        const kp = Keypair.generate();
        const tx = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: kp.publicKey,
                toPubkey: kp.publicKey,
                lamports: 2000
            })
        );
        tx.recentBlockhash = '11111111111111111111111111111111';
        tx.feePayer = kp.publicKey;
        
        const res = await firewall.inspectTransaction(tx.serialize({ requireAllSignatures: false }).toString('base64'), kp.publicKey.toBase58());
        expect(res.decision).toBe('BLOCK');
        expect(res.flags.some(f => f.rule === 'HIGH_VALUE_TRANSFER')).toBe(true);
    });

    it('should flag unknown programs', async () => {
        const kp = Keypair.generate();
        const tx = new Transaction().add({
            keys: [],
            programId: Keypair.generate().publicKey,
            data: Buffer.alloc(0)
        });
        tx.recentBlockhash = '11111111111111111111111111111111';
        tx.feePayer = kp.publicKey;
        
        const res = await firewall.inspectTransaction(tx.serialize({ requireAllSignatures: false }).toString('base64'), kp.publicKey.toBase58());
        expect(res.decision).toBe('BLOCK');
        expect(res.flags.some(f => f.rule === 'UNKNOWN_PROGRAM')).toBe(true);
    });

    it('should flag T1 agent write restrictions', async () => {
        firewall = new SolanaTransactionFirewall(mockSigner, mockConnections, { agentTier: 'T1' });
        const kp = Keypair.generate();
        const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: kp.publicKey, lamports: 100 }));
        tx.recentBlockhash = '11111111111111111111111111111111';
        tx.feePayer = kp.publicKey;
        
        const res = await firewall.inspectTransaction(tx.serialize({ requireAllSignatures: false }).toString('base64'), kp.publicKey.toBase58());
        expect(res.flags.some(f => f.rule === 'TIER_RESTRICTION')).toBe(true);
    });

    it('should block if BFT quorum fails (split logs)', async () => {
        mockConnections[0].simulateTransaction = vi.fn().mockResolvedValue({ value: { err: null, logs: ['Program 1 invoke'] } });
        mockConnections[1].simulateTransaction = vi.fn().mockResolvedValue({ value: { err: null, logs: ['Program 1 invoke'] } });
        mockConnections[2].simulateTransaction = vi.fn().mockResolvedValue({ value: { err: null, logs: ['Program 2 invoke'] } });
        mockConnections[3].simulateTransaction = vi.fn().mockResolvedValue({ value: { err: null, logs: ['Program 3 invoke'] } });

        const kp = Keypair.generate();
        const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: kp.publicKey, lamports: 100 }));
        tx.recentBlockhash = '11111111111111111111111111111111';
        tx.feePayer = kp.publicKey;
        
        const res = await firewall.inspectTransaction(tx.serialize({ requireAllSignatures: false }).toString('base64'), kp.publicKey.toBase58());
        expect(res.decision).toBe('BLOCK');
        expect(res.flags.some(f => f.rule === 'RPC_QUORUM_FAILURE')).toBe(true);
    });

    it('should flag simulation errors', async () => {
        const errSimulate = vi.fn().mockResolvedValue({ value: { err: 'InstructionError' } });
        mockConnections = [
            { simulateTransaction: errSimulate },
            { simulateTransaction: errSimulate },
            { simulateTransaction: errSimulate },
            { simulateTransaction: errSimulate }
        ];
        firewall = new SolanaTransactionFirewall(mockSigner, mockConnections, {});

        const kp = Keypair.generate();
        const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: kp.publicKey, lamports: 100 }));
        tx.recentBlockhash = '11111111111111111111111111111111';
        tx.feePayer = kp.publicKey;
        
        const res = await firewall.inspectTransaction(tx.serialize({ requireAllSignatures: false }).toString('base64'), kp.publicKey.toBase58());
        expect(res.flags.some(f => f.rule === 'SIMULATION_ERROR')).toBe(true);
    });

    it('should flag hidden CPI to unknown programs', async () => {
        const mockSimulateHidden = vi.fn().mockResolvedValue({
            value: {
                err: null,
                logs: ['Program HiddenMalicious111 invoke [1]']
            }
        });
        mockConnections = [
            { simulateTransaction: mockSimulateHidden },
            { simulateTransaction: mockSimulateHidden },
            { simulateTransaction: mockSimulateHidden },
            { simulateTransaction: mockSimulateHidden }
        ];
        firewall = new SolanaTransactionFirewall(mockSigner, mockConnections, {});

        const kp = Keypair.generate();
        const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: kp.publicKey, lamports: 100 }));
        tx.recentBlockhash = '11111111111111111111111111111111';
        tx.feePayer = kp.publicKey;
        
        const res = await firewall.inspectTransaction(tx.serialize({ requireAllSignatures: false }).toString('base64'), kp.publicKey.toBase58());
        expect(res.decision).toBe('BLOCK');
        expect(res.flags.some(f => f.rule === 'HIDDEN_CPI_UNKNOWN_PROGRAM')).toBe(true);
    });

    it('should flag INSTRUCTION_OVERFLOW', async () => {
        const kp = Keypair.generate();
        const tx = new Transaction();
        for (let i = 0; i < 11; i++) {
            tx.add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: kp.publicKey, lamports: 1 }));
        }
        tx.recentBlockhash = '11111111111111111111111111111111';
        tx.feePayer = kp.publicKey;
        
        const res = await firewall.inspectTransaction(tx.serialize({ requireAllSignatures: false }).toString('base64'), kp.publicKey.toBase58());
        expect(res.flags.some(f => f.rule === 'INSTRUCTION_OVERFLOW')).toBe(true);
    });

    it('should flag SPL TOKEN_SET_AUTHORITY', async () => {
        const kp = Keypair.generate();
        const tx = new Transaction().add({
            keys: [],
            programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
            data: Buffer.from([6, 0])
        });
        tx.recentBlockhash = '11111111111111111111111111111111';
        tx.feePayer = kp.publicKey;
        
        const res = await firewall.inspectTransaction(tx.serialize({ requireAllSignatures: false }).toString('base64'), kp.publicKey.toBase58());
        expect(res.decision).toBe('BLOCK');
        expect(res.flags.some(f => f.rule === 'TOKEN_SET_AUTHORITY')).toBe(true);
    });

    it('should flag SPL TOKEN_APPROVE', async () => {
        const kp = Keypair.generate();
        const tx = new Transaction().add({
            keys: [],
            programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
            data: Buffer.from([4, 0])
        });
        tx.recentBlockhash = '11111111111111111111111111111111';
        tx.feePayer = kp.publicKey;
        
        const res = await firewall.inspectTransaction(tx.serialize({ requireAllSignatures: false }).toString('base64'), kp.publicKey.toBase58());
        expect(res.flags.some(f => f.rule === 'TOKEN_APPROVE')).toBe(true);
    });

    it('should flag SPL TOKEN_CLOSE_ACCOUNT', async () => {
        const kp = Keypair.generate();
        const tx = new Transaction().add({
            keys: [],
            programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
            data: Buffer.from([9, 0])
        });
        tx.recentBlockhash = '11111111111111111111111111111111';
        tx.feePayer = kp.publicKey;
        
        const res = await firewall.inspectTransaction(tx.serialize({ requireAllSignatures: false }).toString('base64'), kp.publicKey.toBase58());
        expect(res.flags.some(f => f.rule === 'TOKEN_CLOSE_ACCOUNT')).toBe(true);
    });

    it('should flag SPL HIGH_TOKEN_TRANSFER', async () => {
        const kp = Keypair.generate();
        const data = Buffer.alloc(9);
        data[0] = 3; 
        data.writeUInt32LE(2000000 % (2**32), 1);
        data.writeUInt32LE(Math.floor(2000000 / (2**32)), 5);

        const tx = new Transaction().add({
            keys: [],
            programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
            data
        });
        tx.recentBlockhash = '11111111111111111111111111111111';
        tx.feePayer = kp.publicKey;
        
        const res = await firewall.inspectTransaction(tx.serialize({ requireAllSignatures: false }).toString('base64'), kp.publicKey.toBase58());
        expect(res.flags.some(f => f.rule === 'HIGH_TOKEN_TRANSFER')).toBe(true);
    });

    it('should flag HIGH_COMPUTE_BUDGET', async () => {
        const kp = Keypair.generate();
        const data = Buffer.alloc(5);
        data[0] = 2;
        data.writeUInt32LE(500000, 1); 

        const tx = new Transaction().add({
            keys: [],
            programId: new PublicKey('ComputeBudget111111111111111111111111111111'),
            data
        });
        tx.recentBlockhash = '11111111111111111111111111111111';
        tx.feePayer = kp.publicKey;
        
        const res = await firewall.inspectTransaction(tx.serialize({ requireAllSignatures: false }).toString('base64'), kp.publicKey.toBase58());
        expect(res.flags.some(f => f.rule === 'HIGH_COMPUTE_BUDGET')).toBe(true);
    });
});
