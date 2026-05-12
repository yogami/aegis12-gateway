export interface AgentEvidenceRecord {
    /**
     * ISO-8601 Timestamp of when the intent was finalized.
     */
    timestamp: string;

    /**
     * The executing agent's public key or rigid identifier.
     */
    agent_id: string;

    /**
     * A SHA-256 fingerprint representing the decision snapshot/input parameters.
     */
    input_snapshot_hash: string;

    /**
     * Array of EU AI Act Policy flags (e.g. HUMAN_OVERSIGHT_VERIFIED).
     */
    policy_flags: string[];

    /**
     * Base64 encoded raw intent data before hashing (optional for logging).
     */
    raw_intent_b64?: string;
}

export interface ITeeAnchor {
    /**
     * The name/identifier of this specific hardware anchor.
     */
    readonly anchorName: string;

    /**
     * Asynchronously submit the evidence record to the hardware enclave.
     * This method MUST NOT block the primary execution loop of the agent.
     */
    submitEvidence(record: AgentEvidenceRecord): Promise<void>;
}
