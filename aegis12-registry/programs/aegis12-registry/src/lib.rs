use anchor_lang::prelude::*;

declare_id!("AEGiS12xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");

#[program]
pub mod aegis12_registry {
    use super::*;

    pub fn unmocked_attest_compliance(
        ctx: Context<AttestCompliance>,
        hardware_enclave_signature: String,
        sha256_intent_hash: String,
    ) -> Result<()> {
        let registry_entry = &mut ctx.accounts.registry_entry;
        
        // Ensure strictly validated data lengths
        require!(hardware_enclave_signature.len() == 64, AegisError::InvalidSignatureSize);
        require!(sha256_intent_hash.len() == 64, AegisError::InvalidHashSize);

        registry_entry.agent_pubkey = ctx.accounts.agent_signer.key();
        registry_entry.tee_attestation = hardware_enclave_signature;
        registry_entry.intent_hash = sha256_intent_hash;
        registry_entry.timestamp = Clock::get()?.unix_timestamp;

        msg!("AEGIS-12 TEE COMPLIANCE ANCHORED: {}", registry_entry.intent_hash);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct AttestCompliance<'info> {
    #[account(
        init,
        payer = agent_signer,
        space = 8 + 32 + 64 + 64 + 8, // Discriminator + Pubkey + Strings + Timestamp
        seeds = [b"aegis_compliance", agent_signer.key().as_ref()],
        bump
    )]
    pub registry_entry: Account<'info, ComplianceEntry>,
    
    #[account(mut)]
    pub agent_signer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[account]
pub struct ComplianceEntry {
    pub agent_pubkey: Pubkey,
    pub tee_attestation: String,
    pub intent_hash: String,
    pub timestamp: i64,
}

#[error_code]
pub enum AegisError {
    #[msg("The provided TEE hardware signature length is invalid.")]
    InvalidSignatureSize,
    #[msg("The provided SHA256 intent hash length is invalid.")]
    InvalidHashSize,
}
