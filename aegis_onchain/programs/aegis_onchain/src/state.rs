use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct AegisIntentEnvelope {
    pub vault_pda: Pubkey,
    pub squads_multisig: Pubkey,
    pub instruction_digest: [u8; 32],
    pub valid_until_slot: u64,
}

#[account]
pub struct RegistryEntry {
    pub receipt_id: String,
    pub log_hash: [u8; 32],
    pub article14_signature: Option<String>,
    pub tee_signature: Vec<u8>,
}

#[account]
pub struct NonceCheckpoint {
    pub last_nonce: u64,
}
