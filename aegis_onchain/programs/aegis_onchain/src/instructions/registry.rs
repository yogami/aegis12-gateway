use anchor_lang::prelude::*;
use crate::state::{RegistryEntry, NonceCheckpoint};
use crate::errors::AegisError;

#[derive(Accounts)]
#[instruction(receipt_id: String)]
pub struct AnchorComplianceReceipt<'info> {
    #[account(
        init,
        payer = agent_signer,
        space = 8 + 64 + 32 + 100 + 100, // Approximate sizing
        seeds = [b"aegis_compliance_v1", agent_signer.key().as_ref(), receipt_id.as_bytes()],
        bump
    )]
    pub registry_entry: Account<'info, RegistryEntry>,
    
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
        space = 8 + 8,
        seeds = [b"aegis_nonce_checkpoint", tenant_id.as_bytes()],
        bump
    )]
    pub nonce_checkpoint: Account<'info, NonceCheckpoint>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn anchor_compliance_receipt(
    ctx: Context<AnchorComplianceReceipt>,
    receipt_id: String,
    log_hash: [u8; 32],
    article14_signature: Option<String>,
    tee_signature: Vec<u8>
) -> Result<()> {
    let registry_entry = &mut ctx.accounts.registry_entry;
    registry_entry.receipt_id = receipt_id;
    registry_entry.log_hash = log_hash;
    registry_entry.article14_signature = article14_signature;
    registry_entry.tee_signature = tee_signature;
    
    msg!("Aegis-12: Compliance Receipt Anchored 🛡️");
    Ok(())
}

pub fn checkpoint_nonce(
    ctx: Context<CheckpointNonce>,
    _tenant_id: String,
    new_nonce: u64
) -> Result<()> {
    let nonce_checkpoint = &mut ctx.accounts.nonce_checkpoint;
    
    // RED PHASE -> GREEN PHASE
    // Require strictly monotonic nonces
    require!(new_nonce > nonce_checkpoint.last_nonce, AegisError::StaleNonce);
    
    nonce_checkpoint.last_nonce = new_nonce;
    msg!("Aegis-12: Nonce Checkpointed to {}", new_nonce);
    Ok(())
}

// Logic isolated for TDD Unit Tests
pub fn checkpoint_nonce_logic(checkpoint: &mut NonceCheckpoint, new_nonce: u64) -> Result<()> {
    require!(new_nonce > checkpoint.last_nonce, AegisError::StaleNonce);
    checkpoint.last_nonce = new_nonce;
    Ok(())
}
