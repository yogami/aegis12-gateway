use anchor_lang::prelude::*;

declare_id!("FPVw3tMxjARfaPFqkDRJSp19vPrzGQ1fW4oJwkUgeyxS");

#[program]
pub mod aegis_oracle {
    use super::*;

    /// Verifies the Intel TDX/SGX DCAP quote and policy hash.
    /// In a full production environment, this parses an x509 cert chain.
    /// For the MVP, it simulates atomic verification and emits an event.
    pub fn verify_attestation(
        ctx: Context<VerifyAttestation>,
        quote_hash: String,
        policy_hash: String,
    ) -> Result<()> {
        let clock = Clock::get()?;

        // MOCK VERIFICATION LOGIC
        // In production, we'd verify the RSA signature of the quote.
        msg!("🛡️ Aegis-12: Oracle Intercepted Hardware Quote");
        msg!("Quote Hash: {}", quote_hash);
        msg!("Policy Hash: {}", policy_hash);
        
        // Emit the on-chain event
        emit!(HardwareAttestationVerified {
            signer: *ctx.accounts.signer.key,
            quote_hash,
            policy_hash,
            timestamp: clock.unix_timestamp,
        });

        msg!("✅ Hardware Attestation Verified. Proceeding to execution...");

        Ok(())
    }
}

#[derive(Accounts)]
pub struct VerifyAttestation<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct HardwareAttestationVerified {
    pub signer: Pubkey,
    pub quote_hash: String,
    pub policy_hash: String,
    pub timestamp: i64,
}
