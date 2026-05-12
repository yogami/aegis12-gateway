import { ILedgerAnchor } from '../ports/ILedgerAnchor';
import { SolanaAnchor } from './SolanaAnchor';
import { AegisSigner } from './AegisSigner';

/**
 * LedgerAnchorFactory
 * 
 * Strategy Pattern: Resolves the correct blockchain anchor implementation
 * based on the LEDGER_TYPE environment variable.
 * 
 * Supported chains:
 *   - solana (default): Anchors to Solana via Memo program
 *   - mantle: Anchors to Mantle L2 via EVM calldata
 * 
 * To add a new chain:
 *   1. Create a new class implementing ILedgerAnchor
 *   2. Add a case to the switch below
 *   3. Set LEDGER_TYPE=<your-chain> in the environment
 */
export class LedgerAnchorFactory {
    
    private static readonly SUPPORTED_CHAINS = ['solana', 'mantle'] as const;
    
    public static async create(signer: AegisSigner): Promise<ILedgerAnchor> {
        const ledgerType = (process.env.LEDGER_TYPE || 'solana').toLowerCase();
        
        switch (ledgerType) {
            case 'mantle': {
                const { MantleAnchor } = await import('./MantleAnchor');
                const rpc = process.env.MANTLE_RPC_URL || 'https://rpc.sepolia.mantle.xyz';
                const networkName = process.env.MANTLE_NETWORK_NAME || 'Mantle Sepolia';
                console.log(`[Aegis-12] Ledger: ${networkName} (${rpc})`);
                return new MantleAnchor(rpc, signer.getEvmWallet(), networkName);
            }
            case 'solana': {
                const cluster = process.env.SOLANA_CLUSTER || 'devnet';
                console.log(`[Aegis-12] Ledger: Solana (${cluster})`);
                return new SolanaAnchor(cluster);
            }
            default:
                throw new Error(`[TERMINAL REFUSAL] Unsupported LEDGER_TYPE: "${ledgerType}". Supported: ${LedgerAnchorFactory.SUPPORTED_CHAINS.join(', ')}`);
        }
    }

    public static getSupportedChains(): readonly string[] {
        return LedgerAnchorFactory.SUPPORTED_CHAINS;
    }
}
