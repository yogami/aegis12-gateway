import { TerminalRefusalError } from '../errors';

/**
 * [ANTI-EVASION] TEE-Sandboxed Transaction Simulation Engine
 * 
 * Simulates transactions via RPC (e.g. Helius) before execution to catch
 * malicious state transitions that bypass static OFAC/Policy checks.
 * Specifically targets `SystemProgram.assign` stealth ownership transfers.
 */
export class SimulationEngine {
    private static readonly SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";

    /**
     * Simulates the intent and aggressively parses for sandbox evasion techniques.
     * @param parameters The sanitized parameters from the agent intent
     */
    public static async simulateAndParse(parameters: Record<string, unknown>): Promise<void> {
        // [Mock Helius RPC Call]
        // In production, this fires the intent to an RPC node to get the simulated execution trace.
        const simulationResult = await this.mockHeliusSimulation(parameters);

        if (simulationResult.err) {
            throw new TerminalRefusalError(`SIMULATION_FAILED: Transaction will fail on-chain: ${JSON.stringify(simulationResult.err)}`);
        }

        this.detectEvasionSignatures(simulationResult.innerInstructions);
    }

    /**
     * Deeply parses inner instructions to catch stealth operations.
     */
    private static detectEvasionSignatures(innerInstructions: any[]): void {
        if (!innerInstructions || innerInstructions.length === 0) return;

        for (const ix of innerInstructions) {
            // Exploit Vector: `SystemProgram.assign` can change account ownership stealthily,
            // bypassing standard SPL transfer limits or OFAC checks.
            if (ix.programId === this.SYSTEM_PROGRAM_ID) {
                // The 'assign' instruction in SystemProgram starts with index 1
                // (typically represented in base58 or hex data).
                // We're doing a simplified check for the Colosseum demo.
                if (ix.data && (ix.data.startsWith('01') || ix.data.includes('assign'))) {
                    throw new TerminalRefusalError(
                        `ANTI_EVASION_TRIGGERED: Stealth ownership transfer detected (SystemProgram.assign) in inner instructions.`
                    );
                }
            }

            // Recursively check nested inner instructions if they exist
            if (ix.innerInstructions) {
                this.detectEvasionSignatures(ix.innerInstructions);
            }
        }
    }

    /**
     * Mock simulation response for the Hackathon Demo.
     */
    private static async mockHeliusSimulation(parameters: Record<string, unknown>): Promise<any> {
        // Simulate a 200ms network delay
        await new Promise(resolve => setTimeout(resolve, 200));

        // If the parameters contain a specific exploit flag for testing
        if (parameters.test_evasion_flag === true) {
            return {
                err: null,
                innerInstructions: [
                    {
                        programId: this.SYSTEM_PROGRAM_ID,
                        data: "0100000000000000...assign_payload...", 
                        accounts: []
                    }
                ]
            };
        }

        return {
            err: null,
            innerInstructions: []
        };
    }
}
