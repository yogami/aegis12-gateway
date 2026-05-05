use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct AegisIntentEnvelope {
    pub vault_pda: Pubkey,
    pub squads_multisig: Pubkey,
    pub instruction_digest: [u8; 32],
    pub valid_until_slot: u64,
}
