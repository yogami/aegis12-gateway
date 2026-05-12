export class TerminalRefusalError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TerminalRefusalError';
    }
}
