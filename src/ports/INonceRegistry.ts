export interface INonceRegistry {
    initialize?(): Promise<void>;
    reserve(nonce: string): Promise<boolean>;
    commit(nonce: string): Promise<void>;
    release(nonce: string): Promise<void>;
    isNonceUsed(nonce: string): Promise<boolean>;
    clear(): Promise<void>;
}
