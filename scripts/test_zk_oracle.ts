import { RiscZeroAttestationOracle } from '../src/infrastructure/RiscZeroAttestationOracle';
import { AttestationQuote } from '../src/domain/AttestationQuote';
import { SessionKey } from '../src/domain/SessionKey';
import path from 'path';

async function main() {
    console.log("Starting ZK Oracle Substance Test...");
    const proverPath = path.join(__dirname, '../aegis-zk-prover/target/debug/host');
    const oracle = new RiscZeroAttestationOracle(proverPath);
    
    const sessionKey = SessionKey.generate();
    const quote = AttestationQuote.create(sessionKey, "policy-hash-123");
    
    console.log("Generating proof...");
    const startTime = Date.now();
    const success = await oracle.submitQuote(quote);
    const elapsed = Date.now() - startTime;
    
    if (success) {
        console.log(`✅ ZK Proof Generated and Verified in ${elapsed}ms!`);
    } else {
        console.error("❌ ZK Proof Generation Failed.");
        process.exit(1);
    }
}

main().catch(console.error);
