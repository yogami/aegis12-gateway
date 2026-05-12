import { TerminalRefusalError } from '../errors';

/**
 * OFAC Sanctions Validator
 * Implements a deterministic blocklist for target addresses.
 * If any target address matches the blocklist, the intent is instantly rejected
 * to prevent strict-liability federal sanctions violations for the DAO.
 */
export class OfacValidator {
    // A mock list of sanctioned OFAC addresses for the Colosseum Hackathon demo.
    // In production, this would be updated via an oracle or synced from Chainalysis/US Treasury.
    private static readonly SANCTIONED_ADDRESSES = new Set([
        "8vx4rywq...tornadocash",
        "lazarusgroup...hackerwallet",
        "sanctioned...wallet123",
        // Adding a specific test address to trigger the OFAC block in E2E tests
        "ofac_blocked_address_001"
    ]);

    /**
     * Checks an address against the OFAC blocklist.
     * @param address The target Solana/EVM address from the agent intent
     * @throws TerminalRefusalError if the address is sanctioned
     */
    public static verifyAddress(address: string): void {
        if (!address) return;

        // Perform strict exact match against the set, converting to lower case to prevent case-sensitivity bypass
        if (this.SANCTIONED_ADDRESSES.has(address.toLowerCase())) {
            throw new TerminalRefusalError(`OFAC_VIOLATION_DETECTED: Address ${address} is on the federal sanctions blocklist.`);
        }
    }

    /**
     * Deep inspects the parameters payload to find any target addresses.
     * @param parameters The execution parameters of the intent
     */
    public static inspectParameters(parameters: Record<string, unknown>): void {
        const potentialAddresses = [
            parameters.to as string,
            parameters.target as string,
            parameters.destination as string,
            parameters.recipient as string
        ];

        for (const addr of potentialAddresses) {
            if (addr) {
                this.verifyAddress(addr);
            }
        }
    }
}
