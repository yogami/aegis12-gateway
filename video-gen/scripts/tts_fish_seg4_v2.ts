import fs from 'fs';
import path from 'path';

const FISH_API_KEY = process.env.FISH_AUDIO_API_KEY || "cfcfa3c247e04d24a29f6eece228c261";
const FISH_VOICE_ID = "2fcfdf3229d94dc2bcb02b2c35405545";

const text = "Welcome to the Fiduciary Control Plane. This dashboard acts as the observability surface for our SDK. On the left, you'll see the Policy Configuration—this is where the DAO defines the hardware-enforced rules, like maximum trade size and permitted addresses. When we trigger an intent stream, you can watch the live telemetry feed on the right. Notice how the AI agent generates unsigned intents, which are immediately intercepted and evaluated by the Phala Enclave. The evaluation happens locally in sub-milliseconds. Once verified, the hardware signs it, and the ZK-proof is batched to Solana. If an agent hallucinates and violates the policy, you can force a Circuit Breaker lockdown here at the bottom left, instantly escalating the threat to a Squads V4 multisig.";

const outPath = path.join(__dirname, '..', 'public', 'segment4_v2.mp3');

async function synthesize() {
    console.log(`[FishAudio] Synthesizing Segment 4 Walkthrough...`);
    const resp = await fetch('https://api.fish.audio/v1/tts', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${FISH_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text: text,
            reference_id: FISH_VOICE_ID,
            format: "mp3"
        })
    });
    
    if (!resp.ok) throw new Error(`Fish Audio API Failed: ${resp.status} - ${await resp.text()}`);
    
    const buffer = await resp.arrayBuffer();
    fs.writeFileSync(outPath, Buffer.from(buffer));
    console.log(`✅ Saved ${outPath}`);
}

synthesize().catch(console.error);
