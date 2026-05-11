import fs from 'fs';
import path from 'path';

const FISH_API_KEY = process.env.FISH_AUDIO_API_KEY || "cfcfa3c247e04d24a29f6eece228c261";
const FISH_VOICE_ID = "2fcfdf3229d94dc2bcb02b2c35405545";

const text = "The market alternative to logging is putting a ZK-coprocessor or heavy Oracle network in the hot-path, but that destroys the zero-latency execution agents require. We bypassed this entirely using Asynchronous Attestation. When an AI agent generates an unsigned x402 payment intent, our TEE evaluates the JSON policy locally at zero-latency. It mathematically signs the transaction, and the ZK-proof is then anchored to Solana, guaranteeing the strict, immutable logging required by EU AI Act Article 12.";

const outPath = path.join(__dirname, '..', 'public', 'segment2.mp3');

async function synthesize() {
    console.log(`[FishAudio] Synthesizing Segment 2...`);
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
