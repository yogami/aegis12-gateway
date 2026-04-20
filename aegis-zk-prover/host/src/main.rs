use methods::{AEGIS_GUEST_ELF, AEGIS_GUEST_ID};
use risc0_zkvm::{default_prover, ExecutorEnv};
use serde::{Deserialize, Serialize};
use std::io::{self, Read};

#[derive(Debug, Serialize, Deserialize)]
pub struct BehavioralStats {
    pub total_spend: u64,
    pub tx_count: u32,
    pub last_activity: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentAction {
    pub tool_id: String,
    pub amount: u64,
    pub nonce: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PolicyConstraints {
    pub max_per_tx: u64,
    pub cumulative_limit: u64,
    pub last_checkpointed_nonce: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SolanaStateProof {
    pub slot: u64,
    pub state_root: [u8; 32],
    pub account_hash: [u8; 32],
    pub proof: Vec<Vec<u8>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ZKInput {
    pub action: AgentAction,
    pub constraints: PolicyConstraints,
    pub stats_before: BehavioralStats,
    pub state_proof: SolanaStateProof,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ZKComplianceJournal {
    pub article_12_log_hash_seal: [u8; 32],
    pub policy_hash_commitment: [u8; 32],
    pub new_total_spend: u64,
    pub nonce_burned: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ZKOutput {
    pub journal: ZKComplianceJournal,
    pub seal: Vec<u8>, // The actual proof bytes
}

fn main() {
    // Initialize tracing for better visibility in the Node.js logs
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    tracing::info!("[AEGIS-HOST] Starting compliance proving cycle...");

    // 1. Read ZKInput from STDIN as JSON
    let mut buffer = String::new();
    io::stdin().read_to_string(&mut buffer).expect("Failed to read from STDIN");
    let input: ZKInput = serde_json::from_str(&buffer).expect("Failed to parse ZKInput JSON");

    // 2. Build the Executor Environment
    let env = ExecutorEnv::builder()
        .write(&input).unwrap()
        .build()
        .unwrap();

    // 3. Obtain the prover and generate the proof (the 'Seal')
    let prover = default_prover();
    
    // First, execute the guest to get the cycle count and verify correctness
    let executor = risc0_zkvm::ExecutorImpl::from_elf(env.clone(), AEGIS_GUEST_ELF).unwrap();
    let session = executor.run().expect("Guest execution failed");
    tracing::info!("[AEGIS-HOST] Guest Execution Complete. Cycles: {}", session.user_cycles);

    // Now, generate the cryptographic proof
    let prove_info = prover.prove(env, AEGIS_GUEST_ELF).expect("ZK Proof Generation Failed");
    let receipt = prove_info.receipt;

    // 4. Extract and decode the Journal
    let journal: ZKComplianceJournal = receipt.journal.decode().unwrap();
    
    // 5. Serialize the output for the Node.js Gateway
    let output = ZKOutput {
        journal,
        seal: bincode::serialize(&receipt.inner).unwrap(),
    };

    println!("{}", serde_json::to_string(&output).unwrap());
    
    // 6. Final verification (Sanity Check)
    receipt.verify(AEGIS_GUEST_ID).expect("Internal Verification Failed");
}
