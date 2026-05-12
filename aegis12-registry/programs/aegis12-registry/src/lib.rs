use anchor_lang::prelude::*;
use solana_program::sysvar::instructions::{load_instruction_at_checked, ID as IX_ID};
use solana_program::ed25519_program::ID as ED25519_ID;

declare_id!("5dPzR96rEawRNuB4ZViFu2we8JguC1eqMGi9HPbWDgiQ");

#[program]
pub mod aegis12_registry {
    use super::*;

    pub fn anchor_compliance_receipt(
        ctx: Context<AttestCompliance>,
        receipt_id: String,
        article_12_log_hash: [u8; 32],
        article_14_oversight_signature: String,
        tee_signature: [u8; 64],
    ) -> Result<()> {
        let registry_entry = &mut ctx.accounts.registry_entry;
        
        // Strict boundary validation for regulatory auditability
        require!(receipt_id.len() <= 64, AegisError::InvalidIdSize);
        require!(article_14_oversight_signature.len() >= 130, AegisError::InvalidSignatureSize); // ETH-style hex check

        registry_entry.agent_pubkey = ctx.accounts.agent_signer.key();
        registry_entry.receipt_id = receipt_id;
        registry_entry.article_12_log_hash = article_12_log_hash;
        registry_entry.article_14_oversight_signature = article_14_oversight_signature;
        registry_entry.tee_signature = tee_signature;
        registry_entry.timestamp = Clock::get()?.unix_timestamp;

        msg!("AEGIS-12 COMPLIANCE ANCHORED: {}", registry_entry.receipt_id);
        Ok(())
    }

    pub fn checkpoint_nonce(
        ctx: Context<CheckpointNonce>,
        tenant_id: String,
        last_nonce: u64,
    ) -> Result<()> {
        let checkpoint = &mut ctx.accounts.nonce_checkpoint;
        
        // Only allow monotonic increments to prevent replay resurrection
        if checkpoint.last_nonce > 0 {
            require!(last_nonce > checkpoint.last_nonce, AegisError::InvalidNonceSequence);
        }

        checkpoint.tenant_id = tenant_id;
        checkpoint.last_nonce = last_nonce;
        checkpoint.last_updated = Clock::get()?.unix_timestamp;

        msg!("AEGIS-12 NONCE CHECKPOINT SYNCED: {} -> {}", checkpoint.tenant_id, checkpoint.last_nonce);
        Ok(())
    }

    pub fn verify_intent(
        ctx: Context<VerifyIntent>,
        intent_hash: [u8; 32],
        _tee_signature: [u8; 64],
        enclave_pubkey: [u8; 32],
    ) -> Result<()> {
        // Enforce that the Ed25519 signature verification instruction was included in the transaction
        let ix = load_instruction_at_checked(0, &ctx.accounts.ix_sysvar)?;
        
        require_keys_eq!(ix.program_id, ED25519_ID, AegisError::MissingSignatureInstruction);

        let mut pubkey_found = false;
        let mut msg_found = false;
        
        // Scan the instruction data to ensure our specific enclave pubkey and intent hash were passed to it
        if ix.data.windows(32).any(|window| window == enclave_pubkey) {
            pubkey_found = true;
        }
        if ix.data.windows(32).any(|window| window == intent_hash) {
            msg_found = true;
        }
        
        require!(pubkey_found && msg_found, AegisError::InvalidTeeAttestation);
        
        msg!("🛡️ AEGIS-12 CPI VERIFIED: Agent Intent {:?} cryptographically vetted by TEE Enclave.", intent_hash);
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(receipt_id: String)]
pub struct AttestCompliance<'info> {
    #[account(
        init,
        payer = agent_signer,
        space = 8 + 32 + 64 + 32 + 132 + 64 + 8, // Discriminator + Agent + ID + Hash + Sig + TEE + TS
        seeds = [b"aegis_compliance_v1", agent_signer.key().as_ref(), receipt_id.as_bytes()],
        bump
    )]
    pub registry_entry: Account<'info, ComplianceEntry>,
    
    #[account(mut)]
    pub agent_signer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(tenant_id: String)]
pub struct CheckpointNonce<'info> {
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + 32 + 8 + 8, // Discriminator + TenantID + Nonce + TS
        seeds = [b"aegis_nonce_checkpoint", tenant_id.as_bytes()],
        bump
    )]
    pub nonce_checkpoint: Account<'info, NonceCheckpoint>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifyIntent<'info> {
    /// CHECK: Instructions sysvar checked via load_instruction_at_checked
    #[account(address = solana_program::sysvar::instructions::ID)]
    pub ix_sysvar: AccountInfo<'info>,
}

#[account]
pub struct ComplianceEntry {
    pub agent_pubkey: Pubkey,
    pub receipt_id: String,
    pub article_12_log_hash: [u8; 32],
    pub article_14_oversight_signature: String,
    pub tee_signature: [u8; 64],
    pub timestamp: i64,
}

#[account]
pub struct NonceCheckpoint {
    pub tenant_id: String,
    pub last_nonce: u64,
    pub last_updated: i64,
}

#[error_code]
pub enum AegisError {
    #[msg("The provided ID length is invalid.")]
    InvalidIdSize,
    #[msg("The provided signature length is invalid.")]
    InvalidSignatureSize,
    #[msg("The provided hash length is invalid.")]
    InvalidHashSize,
    #[msg("The provided nonce is not greater than the checkpoint. Replay detected.")]
    InvalidNonceSequence,
    #[msg("Missing Ed25519 verification instruction at index 0.")]
    MissingSignatureInstruction,
    #[msg("Invalid TEE attestation. The intent hash or enclave pubkey did not match the signature payload.")]
    InvalidTeeAttestation,
}
