import fs from 'fs';
import path from 'path';

const FISH_API_KEY = process.env.FISH_AUDIO_API_KEY || "cfcfa3c247e04d24a29f6eece228c261"; // Fallback to the one found in InstagramReelPoster
const FISH_VOICE_ID = "2fcfdf3229d94dc2bcb02b2c35405545"; // From User

const text = "Our day-one submission proposed a passive logging sidecar for the EU AI Act, similar to the standard API monitoring and compliance logging tools currently on the market. We pivoted and expanded from our own idea mid-hackathon. Red-teaming proved that post-mortem logging—no matter how immutable—cannot stop a prompt-injected agent from draining a DAO treasury if it still holds the keys. We realized that competing tools offering observability without authority are just security theater. This is Aegis-12 v1.0: an Active Policy Engine running inside a Phala Hardware Enclave that enforces arbitrary DAO-defined logic—from protocol whitelists to complex transaction graphs—pre-trade.";

const outPath = path.join(__dirname, '..', 'public', 'segment1.mp3');

async function synthesize() {
    console.log(`[FishAudio] Synthesizing: "${text.substring(0, 30)}..."`);
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
    
    if (!resp.ok) {
        throw new Error(`Fish Audio API Failed: ${resp.status} - ${await resp.text()}`);
    }
    
    const buffer = await resp.arrayBuffer();
    fs.writeFileSync(outPath, Buffer.from(buffer));
    console.log(`✅ Saved ${outPath}`);
}

synthesize().catch(console.error);
