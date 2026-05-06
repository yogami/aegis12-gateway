use anchor_lang::prelude::*;

#[error_code]
pub enum AegisError {
    #[msg("The provided ZK-Receipt is cryptographically invalid or manipulated. Execution denied.")]
    InvalidZkReceipt,
    
    #[msg("The Agent CPI invocation breached mathematical thresholds.")]
    ConstraintBreach,

    #[msg("Hardware attestation signature verification failed.")]
    InvalidAttestationSignature,

    #[msg("Attestation envelope expired.")]
    AttestationExpired,

    #[msg("The provided nonce is older than or equal to the current checkpoint. Replay attack detected.")]
    StaleNonce,
}
