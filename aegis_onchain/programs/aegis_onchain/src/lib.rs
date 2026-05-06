use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use crate::instructions::*;

declare_id!("FPVw3tMxjARfaPFqkDRJSp19vPrzGQ1fW4oJwkUgeyxS");

#[program]
pub mod aegis_onchain {
    use super::*;

    pub fn enforce_execution_intent(
        ctx: Context<EnforcePolicy>, 
        agent_id: String, 
        zk_receipt_proof: String
    ) -> Result<()> {
        instructions::enforce_execution_intent(ctx, agent_id, zk_receipt_proof)
    }

    pub fn verify_attestation(
        ctx: Context<VerifyAttestation>,
        envelope: state::AegisIntentEnvelope,
        signature: [u8; 64],
        enclave_pubkey: [u8; 32],
    ) -> Result<()> {
        instructions::verify_attestation_instruction(ctx, envelope, signature, enclave_pubkey)
    }

    pub fn anchor_compliance_receipt(
        ctx: Context<AnchorComplianceReceipt>,
        receipt_id: String,
        log_hash: [u8; 32],
        article14_signature: Option<String>,
        tee_signature: Vec<u8>
    ) -> Result<()> {
        instructions::anchor_compliance_receipt(ctx, receipt_id, log_hash, article14_signature, tee_signature)
    }

    pub fn checkpoint_nonce(
        ctx: Context<CheckpointNonce>,
        tenant_id: String,
        new_nonce: u64
    ) -> Result<()> {
        instructions::checkpoint_nonce(ctx, tenant_id, new_nonce)
    }
}

// ═══════════════════════════════════════════════════════════════
// TDD Unit Tests (Green Phase logic tested here)
// ═══════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;
    use state::AegisIntentEnvelope;

    #[test]
    fn test_verify_attestation_succeeds_if_valid() {
        let envelope = AegisIntentEnvelope {
            vault_pda: Pubkey::new_unique(),
            squads_multisig: Pubkey::new_unique(),
            instruction_digest: [0; 32],
            valid_until_slot: 100,
        };
        let signature = [0; 64];
        let pubkey = [0; 32];
        
        // Green Phase: Valid signature and not expired should pass
        let result = instructions::verify_attestation(&envelope, 50, &signature, &pubkey);
        assert!(result.is_ok());
    }

    #[test]
    fn test_verify_attestation_fails_if_expired() {
        let envelope = AegisIntentEnvelope {
            vault_pda: Pubkey::new_unique(),
            squads_multisig: Pubkey::new_unique(),
            instruction_digest: [0; 32],
            valid_until_slot: 100,
        };
        let signature = [0; 64];
        let pubkey = [0; 32];
        
        // Green Phase: Current slot > valid_until_slot should fail
        let result = instructions::verify_attestation(&envelope, 150, &signature, &pubkey);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), errors::AegisError::AttestationExpired.into());
    }

    #[test]
    fn test_checkpoint_nonce_increases_monotonically() {
        let mut checkpoint = state::NonceCheckpoint { last_nonce: 5 };
        
        // Green Phase: Attempting to checkpoint a lower nonce should fail
        let result = instructions::registry::checkpoint_nonce_logic(&mut checkpoint, 3);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), errors::AegisError::StaleNonce.into());

        // Green Phase: Higher nonce should pass
        let result2 = instructions::registry::checkpoint_nonce_logic(&mut checkpoint, 6);
        assert!(result2.is_ok());
        assert_eq!(checkpoint.last_nonce, 6);
    }
}
