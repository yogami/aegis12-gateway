import fs from 'fs';
import path from 'path';

const FISH_API_KEY = process.env.FISH_AUDIO_API_KEY || "cfcfa3c247e04d24a29f6eece228c261";
const FISH_VOICE_ID = "2fcfdf3229d94dc2bcb02b2c35405545";

const text = "By combining Phala TEEs with Squads V4 and Solana's architecture, we've built the first unhackable corporate card for AI—satisfying EU AI Act Article 15's mandate for cyber-resilience against adversarial attacks. This unlocks massive institutional liquidity for the Solana ecosystem, making it safe for DAOs to let agents autonomously manage real capital. This is the fiduciary firewall the agentic economy demands.";

const outPath = path.join(__dirname, '..', 'public', 'segment4.mp3');

async function synthesize() {
    console.log(`[FishAudio] Synthesizing Segment 4...`);
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
