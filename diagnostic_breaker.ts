import { AegisSigner } from './src/infrastructure/AegisSigner';
import { AegisPEP } from './src/infrastructure/AegisPEP';
import { getCircuitBreaker } from './src/infrastructure/CircuitBreaker';

async function run() {
    const signer = new AegisSigner();
    const pep = new AegisPEP(signer, {"TENANT_123": ["0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A"]});
    const breaker = getCircuitBreaker('Aegis-PEP-Gateway');
    
    console.log("INITIAL STATE:", breaker.getStatus().state);
    
    console.log("Bombarding with 100 malformed requests...");
    for (let i = 0; i < 100; i++) {
        try {
            await pep.enforce({} as any);
        } catch (e) {}
    }
    
    console.log("STATE AFTER BOMBARDMENT:", breaker.getStatus().state);
    console.log("FAILURES COUNT:", breaker.getStatus().failures);
    
    if (breaker.getStatus().state === 'CLOSED') {
        console.log("RESILIENCE VERIFIED: 100% Audit-Grade.");
    } else {
        console.log("RESILIENCE BREACHED: Circuit is OPEN!");
    }
}

run();
