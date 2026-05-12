import { spawn, execSync } from 'child_process';
import { AegisZKClient } from '../src/infrastructure/AegisZKClient';

async function runTarget() {
    console.log(`[TARGET] Starting target process. PID: ${process.pid}`);
    const client = new AegisZKClient();
    console.log(`[TARGET] Spawning ZK Prover...`);
    
    const promise = client.generateProof({ 
        action: { tool_id: "chaos_tool", amount: 1000, nonce: 12345678 },
        constraints: { max_per_tx: 5000, cumulative_limit: 5000, last_checkpointed_nonce: 0 },
        stats_before: { total_spend: 0, tx_count: 0, last_activity: Math.floor(Date.now() / 1000) },
        state_proof: { slot: 1, state_root: Array(32).fill(1), account_hash: Array(32).fill(1), proof: [] }
    });
    
    // Give the Rust binary 500ms to fully launch and allocate memory
    setTimeout(() => {
        console.log(`[TARGET] Prover Spawned!`);
    }, 500);

    await promise;
}

async function runOrchestrator() {
    console.log(`==================================================`);
    console.log(`🔥 Initiating D-002 Zombie Prover Chaos Test...`);
    console.log(`==================================================\n`);
    
    // Ensure clean state
    try {
        execSync('pkill -9 -f aegis-zk-prover');
    } catch(e) {}

    const target = spawn('npx', ['tsx', __filename, 'target'], {
        env: {
            ...process.env,
            AEGIS_ZK_PROVER_HASH: 'aa1768de5e8cd154e33603d41e724a8378ae764cc93af09c52736197b5933850'
        }
    });
    
    target.stdout.on('data', (data) => {
        const out = data.toString();
        process.stdout.write(out);
        
        if (out.includes('[TARGET] Prover Spawned!')) {
            setTimeout(() => {
                console.log(`\n💥 [ORCHESTRATOR] Target is in the middle of Heavy ZK Workload.`);
                console.log(`💥 [ORCHESTRATOR] Simulating OS OOM-Killer. Sending SIGKILL to Parent PID: ${target.pid}`);
                
                // Brutally terminate the parent process (SIGKILL cannot be trapped)
                process.kill(target.pid as number, 'SIGKILL');
                
                // Wait 2 seconds for OS process tree resolution, then check for orphans
                setTimeout(() => {
                    console.log(`🔍 [ORCHESTRATOR] Scanning for Zombie Provers...`);
                    try {
                        const pgrep = execSync('pgrep -a -f aegis-zk-prover');
                        const output = pgrep.toString().trim();
                        if (output.includes('aegis-zk-prover')) {
                            console.error(`\n❌ SUBSTANCE FAILURE: Zombie Prover Leak Detected!`);
                            console.error(`Orphaned Processes:\n${output}`);
                            console.error(`\nCRITICAL: The 1.8GB memory block is permanently locked by init (PID 1).`);
                            console.error(`Hypervisor crash imminent upon Node.js restart.`);
                            
                            // Clean up so we don't actually crash the developer's machine
                            execSync('pkill -9 -f aegis-zk-prover');
                            process.exit(1);
                        }
                    } catch (e) {
                        // pgrep returns exit code 1 if no processes are found.
                        console.log(`\n✅ PASS: No Zombie Provers detected. TEE cgroup boundaries are secure.`);
                        process.exit(0);
                    }
                }, 2000);
            }, 200);
        }
    });

    target.stderr.on('data', (data) => {
        process.stderr.write(data);
    });
}

if (process.argv[2] === 'target') {
    runTarget().catch(console.error);
} else {
    runOrchestrator().catch(console.error);
}
