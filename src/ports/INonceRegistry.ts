export interface INonceRegistry {
    reserve(nonce: string): Promise<boolean>;
    commit(nonce: string): Promise<void>;
    rollback(nonce: string): Promise<void>;
}
