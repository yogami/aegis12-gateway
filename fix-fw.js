const fs = require('fs');

// Restore ToolExecutionReceipt in src/types.ts
let types = fs.readFileSync('src/types.ts', 'utf8');
types += `
export interface ToolExecutionReceipt {
    actionId: string;
    toolId: string;
    authorizationNonce: string;
    parameters: Record<string, unknown>;
    resultHash: string;
    timestamp: string;
    signature: string;
}
`;
fs.writeFileSync('src/types.ts', types);

// Revert SolanaAnchor.ts
let anchor = fs.readFileSync('src/infrastructure/SolanaAnchor.ts', 'utf8');
anchor = anchor.replace(/AegisComplianceReceipt/g, 'ToolExecutionReceipt');
fs.writeFileSync('src/infrastructure/SolanaAnchor.ts', anchor);

// Revert SolanaTransactionFirewall.ts
let fw = fs.readFileSync('src/infrastructure/SolanaTransactionFirewall.ts', 'utf8');
fw = fw.replace(/AegisComplianceReceipt/g, 'ToolExecutionReceipt');
fs.writeFileSync('src/infrastructure/SolanaTransactionFirewall.ts', fw);

// Revert SquadsGovernance.ts
let squads = fs.readFileSync('src/infrastructure/SquadsGovernance.ts', 'utf8');
squads = squads.replace(/AegisComplianceReceipt/g, 'ToolExecutionReceipt');
fs.writeFileSync('src/infrastructure/SquadsGovernance.ts', squads);
