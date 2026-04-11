/**
 * Aegis-12 Technical Demo Generator
 * 
 * Pipeline: Fish Audio TTS (Monolithic Generation) → Multiplex with aegis_demo_raw.mp4 → Output
 * Strategy: Zero-Risk "Option A" Monolithic Overlay
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { execSync } from 'child_process';
import { v2 as cloudinary } from 'cloudinary';

const FISH_API_KEY = 'cfcfa3c247e04d24a29f6eece228c261'; 
const VOICE_ID = '2fcfdf3229d94dc2bcb02b2c35405545'; // The Founder Voice ID correctly loaded
const OUT_DIR = '/Users/user1000/gitprojects/aegis12-gateway/video-demo/pitch_assets';

// Highly technical voiceover synced for a 103s duration (~160 words)
const technicalScript = `This is the technical demonstration for Aegis-12. You are looking at the live deployment of our ZK Coprocessor Gateway. 

Our core directive was securing autonomous agentic capital natively on layer-one. We aggressively attempted native silicon verifications using AWS Nitro enclaves, but validating a 5 kilobyte TLS certificate chain consumed over 85 million Compute Units on Solana. It was physiologically impossible to fit within the 1.4 million CU limit blocks.

To bypass this edge-to-chain bottleneck, we built a mathematically verifiable off-chain relay. The agent executes inside the TEE, but we push the 5 kilobyte attestation off-chain to a Groth16 circuit. We natively integrated Solana Durable Nonces via SystemProgram.nonceAdvance inside our SDK, ensuring the agent transaction safely idles in the mempool without hitting the recent blockhash expiration window.

To eliminate Layer-2 MEV relay hijacking, we cryptographically extract the Solana SPL Memo payload into an AWS Nitro user_data slice, binding it directly to the Groth16 public input constraint.

When the compressed 256-byte ZK-SNARK hits our smart contract, execution is instant. Zero trust tradeoffs, zero latency proxies, maximum verifiability.`;

function getFfmpegPath() {
  try { return execSync('which ffmpeg').toString().trim(); } 
  catch (e) {
    if (fs.existsSync('/opt/homebrew/bin/ffmpeg')) return '/opt/homebrew/bin/ffmpeg';
    return 'ffmpeg';
  }
}

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  Aegis-12: Technical Demo Generator (Monolithic)       ');
  console.log('════════════════════════════════════════════════════════\n');

  const ffmpegPath = getFfmpegPath();
  const rawVideoPath = '/Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/aegis_demo_raw.mp4';
  const audioOutPath = path.join(OUT_DIR, 'tech_narration.mp3');
  const finalVideoPath = path.join(OUT_DIR, 'Aegis-12-Tech-Demo-Final.mp4');

  if (!fs.existsSync(rawVideoPath)) {
    console.error(`  ❌ Missing raw demonstration video!`);
    process.exit(1);
  }

  console.log('Step 1: Generating Clinical TTS Narration...');
  try {
    const resp = await axios.post('https://api.fish.audio/v1/tts', {
      text: technicalScript,
      reference_id: VOICE_ID,
      format: 'mp3',
    }, {
      headers: { 'Authorization': `Bearer ${FISH_API_KEY}`, 'Content-Type': 'application/json' },
      responseType: 'arraybuffer',
      timeout: 45000,
    });
    fs.writeFileSync(audioOutPath, resp.data);
    console.log(`  ✅ tech_narration.mp3 generated successfully!`);
  } catch (error) {
    console.error(`  ❌ Failed to generate audio:`, error.message);
    process.exit(1);
  }

  console.log('\nStep 2: Multiplexing Raw Video with ZK-TTS Audio...');
  try {
    // Pure fast copy: map video stream from input 0, map audio stream from input 1. Match shortest duration.
    execSync(`"${ffmpegPath}" -y -i "${rawVideoPath}" -i "${audioOutPath}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest "${finalVideoPath}" 2>/dev/null`);
    console.log(`  ✅ Fused successfully into Aegis-12-Tech-Demo-Final.mp4`);
  } catch (e) {
    console.error(`  ❌ FFMPEG multiplexing failed.`);
    process.exit(1);
  }

  console.log('\nStep 3: Initiating Cloudinary Upload...');
  cloudinary.config({ cloud_name: 'djol0rpn5', api_key: '888753318981763', api_secret: 'HqTbA8IE_o6CHbenhKb_iiKXOwo' });
  
  cloudinary.uploader.upload(finalVideoPath, 
    { resource_type: "video", public_id: "aegis12_colosseum_tech_demo", overwrite: true, invalidate: true },
    function(error, result) {
        if (error) {
            console.error("  ❌ Upload Error:", error);
        } else {
            console.log("\n==================================");
            console.log("✅ CLOUDINARY_URL:", result.secure_url);
            console.log("==================================\n");
        }
    });
}

main().catch(console.error);
