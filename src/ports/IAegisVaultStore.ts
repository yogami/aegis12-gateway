export interface IAegisVaultStore {
    /**
     * Store encrypted proprietary policies or ML models securely.
     */
    savePolicy(tenantId: string, policyId: string, encryptedData: any): Promise<void>;

    /**
     * Retrieve a previously vaulted policy.
     */
    getPolicy(tenantId: string, policyId: string): Promise<any | null>;
}
