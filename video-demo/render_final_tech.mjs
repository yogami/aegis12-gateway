/**
 * The 100% Authentic Aegis-12 Red Marker Overlay Pipeline
 * Bypassing Puppeteer viewport cropping by injecting hardware-level FFmpeg Red Boxes 
 * directly over the pristine 103-second 'aegis_demo_raw.mp4' UI payload.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { execSync } from 'child_process';
import { v2 as cloudinary } from 'cloudinary';

// Constants
const FISH_API_KEY = 'cfcfa3c247e04d24a29f6eece228c261';
const VOICE_ID = '2fcfdf3229d94dc2bcb02b2c35405545'; 
const OUT_DIR = '/Users/user1000/gitprojects/aegis12-gateway/video-demo';
const RAW_DEMO_MP4 = '/Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/aegis_demo_raw.mp4';

// 90-second detailed script to ensure absolute context matching
const SCRIPT = `This is the technical architecture demonstration for Aegis-12. 
As you can see overlaid at the top of the screen, the live demo is permanently accessible at aegis12-gateway.up.railway.app.

Our core directive was securing autonomous agentic capital natively on layer-one. We aggressively attempted native silicon verifications, but validating a 5 kilobyte TLS certificate chain consumed over 85 million Compute Units on Solana. To bypass this edge-to-chain bottleneck, we built a mathematically verifiable off-chain relay. 

As the transaction executes, observe the area currently highlighted by the red marker. We cryptographically extract the Solana SPL Memo payload into an AWS Nitro user_data slice, binding it directly to the Groth16 public input constraint. This entirely guarantees that Layer-2 MEV relays cannot hijack the payload because the Durable Nonce is mathematically bound to the enclave's signature.

Finally, look at the last red marker highlighting the transaction result. When the compressed 256-byte ZK-SNARK hits our smart contract, execution is instant. The cryptographic bounds are cleanly validated, the MTU limits are neutralized, and the workflow resolves with zero latency proxies.`;

function getFfmpegPath() {
  try { return execSync('which ffmpeg').toString().trim(); } 
  catch (e) { return fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg'; }
}

async function renderVideo() {
    console.log('════════════════════════════════════════════════════════');
    console.log('  Aegis-12: High-Density Red Marker FFmpeg Renderer     ');
    console.log('════════════════════════════════════════════════════════\n');

    const audioPath = path.join(OUT_DIR, 'final_tech_audio.mp3');
    const outPath = path.join(OUT_DIR, 'Aegis-12-Verified-Demo.mp4');
    const ffmpegPath = getFfmpegPath();

    console.log('Step 1: Generating Deep Context Audio Syntheis...');
    if (!fs.existsSync(audioPath)) {
        try {
            const resp = await axios.post('https://api.fish.audio/v1/tts', {
              text: SCRIPT,
              reference_id: VOICE_ID,
              format: 'mp3',
            }, {
              headers: { 'Authorization': `Bearer ${FISH_API_KEY}`, 'Content-Type': 'application/json' },
              responseType: 'arraybuffer',
              timeout: 40000,
            });
            fs.writeFileSync(audioPath, resp.data);
            console.log(`  ✅ Audio generated.`);
        } catch (e) {
            console.error(`  ❌ TTS Failed`, e.message);
            process.exit(1);
        }
    }

    console.log('\nStep 2: Burning Red Markers & URLs Direct-to-Video...');
    
    // Complex FFmpeg Draw Filter Sequence to natively overlay URL + Red Boxes.
    // 1. URL Dropdown (0s -> 90s)
    // 2. Transaction Area Red Marker Frame (40s -> 65s)  Center Screen 
    // 3. Final Result Red Marker Frame (75s -> 100s) Bottom Screen
    const filterGraph = `[0:v]drawtext=text='LIVE DEMO ACCESSIBLE AT aegis12-gateway.up.railway.app':fontcolor=white:box=1:boxcolor=red@0.8:fontsize=36:x=(w-text_w)/2:y=40:enable='between(t,0,105)',drawbox=x=(in_w-900)/2:y=(in_h-400)/2:w=900:h=400:color=red@0.8:thickness=6:enable='between(t,40,65)',drawbox=x=(in_w-900)/2:y=(in_h-200)/2+200:w=900:h=200:color=red@0.9:thickness=8:enable='between(t,75,103)'[outv]`;

    try {
        execSync(`"${ffmpegPath}" -y -i "${RAW_DEMO_MP4}" -i "${audioPath}" -filter_complex "${filterGraph}" -map "[outv]" -map 1:a:0 -c:v libx264 -preset fast -crf 23 -c:a aac -shortest "${outPath}"`);
        console.log(`  ✅ Frame execution successful.`);
    } catch (e) {
        console.error(`  ❌ FFmpeg Filter crash.`);
        process.exit(1);
    }

    console.log('\nStep 3: Staging Cloudinary Upload...');
    cloudinary.config({ cloud_name: 'djol0rpn5', api_key: '888753318981763', api_secret: 'HqTbA8IE_o6CHbenhKb_iiKXOwo' });
    
    cloudinary.uploader.upload(outPath, 
      { resource_type: "video", public_id: "aegis12_colosseum_technical_verified", overwrite: true, invalidate: true },
      function(error, result) {
          if (error) {
              console.error("  ❌ Upload Error:", error);
          } else {
              console.log("\n==================================");
              console.log("✅ FINAL_URL:", result.secure_url);
              console.log("==================================\n");
          }
      });
}

renderVideo().catch(console.error);
