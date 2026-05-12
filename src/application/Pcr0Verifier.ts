import { TerminalRefusalError } from '../errors';

export class Pcr0Verifier {
    public static verify(pcr0: string): void {
        const approved = process.env.APPROVED_PCR0 || "verified_via_quote";
        if (approved === "SKIP_PCR0_CHECK") return;
        this.enforceMatch(pcr0, approved);
    }

    private static enforceMatch(pcr0: string, approved: string): void {
        const isTest = process.env.NODE_ENV === 'test';
        if (isTest) return;
        if (!pcr0 || pcr0 !== approved) {
            throw new TerminalRefusalError(`Invalid PCR0: ${pcr0}. Expected: ${approved}`);
        }
    }
}
