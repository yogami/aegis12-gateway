import fs from 'fs';
import path from 'path';

const FISH_API_KEY = process.env.FISH_AUDIO_API_KEY || "cfcfa3c247e04d24a29f6eece228c261";
const FISH_VOICE_ID = "2fcfdf3229d94dc2bcb02b2c35405545";

const text = "By combining Phala TEEs with Squads V4, we've built the first unhackable corporate card for AI. But a powerful architecture is useless without distribution. To go to market, we are releasing the Aegis-12 SDK as a drop-in hardware guardrail. Developers simply import AegisEnclave into their existing agent frameworks—whether they are using Eliza, LangChain, or custom code. This allows any DAO to instantly enforce enterprise-grade, Article 15 cyber-resilience without forcing developers to rebuild their agents from scratch. This is the fiduciary firewall the agentic economy demands.";

const outPath = path.join(__dirname, '..', 'public', 'segment5.mp3');

async function synthesize() {
    console.log(`[FishAudio] Synthesizing Segment 5 (Conclusion)...`);
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
