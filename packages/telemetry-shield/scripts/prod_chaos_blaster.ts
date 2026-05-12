import { AegisShield, PhalaTeeAnchor } from "../src/index";

/**
 * LIVE PRODUCTION INFRASTRUCTURE ASSAULT MODULE (DDoS SIMULATION)
 * WARNING: Running this script will generate heavy asymmetric load against the target server.
 * Do not run this against un-metered endpoints you do not own.
 */

async function runDeployAssault() {
    console.log("\n=================================================");
    console.log(" AEGIS-12 PRODUCTION INFRASTRUCTURE CHAOS BLASTER ");
    console.log("=================================================\n");

    const targetUrl = process.env.PROD_URL;
    
    if (!targetUrl) {
        console.error("❌ FATAL: No Target Environment URL specified.");
        console.error("Please export PROD_URL before running this execution.");
        console.error("Example: export PROD_URL=https://nitro.aegis12.com/ingest");
        process.exit(1);
    }

    console.log(`[TARGET ACQUIRED] Locating infrastructure at: ${targetUrl}`);
    console.log(`[WARNING] Commencing heavy TCP/IP external assault...\n`);

    const prodAnchor = new PhalaTeeAnchor(targetUrl);
    const shield = new AegisShield({
        chaffEnabled: false, // Ensure local loop isn't bottlenecked by Solana
        teeAnchors: [prodAnchor]
    });

    try {
        console.log(">>> PHASE 1: TARGET DDOS CONCURRENCY SPIKE (5,000 Concurrent REST Connections)");
        
        const concurrencyT0 = performance.now();
        const ddosSpike = [];
        for (let i = 0; i < 5000; i++) {
            ddosSpike.push(shield.logIntent(`Agent-DDoS-${i}`, { 
                action: "stress_test", 
                volume: 5000 
            }).catch(() => {}));
        }

        await Promise.all(ddosSpike);
        
        const executionMs = (performance.now() - concurrencyT0).toFixed(2);
        console.log(`✅ Transmission queue flushed 5000 connections dynamically in ${executionMs}ms`);
        console.log("Check your Production Server logs. Does Traefik/AWS load-balancer survive that request volume?");
        

        console.log("\n>>> PHASE 2: PACKET CORRUPTION & MALFORMED RED-TEAM STRIKE");
        console.log("Transmitting raw invalid buffers and infinitely recursive objects to trigger unmarshaling crashes...");
        
        // Massive Payload Object > 1MB
        const giantString = "x".repeat(1024 * 1024);
        shield.logIntent(`Agent-Poison-Size`, { data: giantString }).catch(() => {});

        // Invalid Deep-JSON Object Depth Bomb
        let depthBomb: any = {};
        for(let i=0; i<100; i++) {
            const nested = { a: {} };
            depthBomb.a = nested;
            depthBomb = nested;
        }
        shield.logIntent(`Agent-Poison-Depth`, depthBomb).catch(() => {});

        console.log("✅ Malformed packet suite broadcast via HTTP.");
        console.log("Check your Production Server logs to verify they threw 400 Bad Requests instead of taking down the container.");

        console.log("\n=================================================");
        console.log(" 💥 FIRE MISSION COMPLETE.");
        console.log(" Validate your remote infrastructure dashboards.");
        console.log("=================================================\n");

        // Wait to allow final TCP packets to clear the wire.
        await new Promise(res => setTimeout(res, 5000));
        process.exit(0);

    } catch (e: any) {
        console.error("\n[BLASTER FAULT] Execution runner terminated prematurely:", e.message);
    }
}

runDeployAssault();
