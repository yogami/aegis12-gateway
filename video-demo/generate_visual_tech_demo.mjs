/**
 * Aegis-12 Visual Technical Demo Generator
 * 
 * Pipeline: Fish Audio TTS (Segmented) → 4x Terminal/UI Assets → FFMPEG Stitch
 * Strategy: Multi-Frame Visual Hacker Sequence
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { execSync } from 'child_process';
import { v2 as cloudinary } from 'cloudinary';

const FISH_API_KEY = 'cfcfa3c247e04d24a29f6eece228c261'; // Authorized API key
const VOICE_ID = '2fcfdf3229d94dc2bcb02b2c35405545'; // Founder's Authentic Voice ID
const OUT_DIR = '/Users/user1000/gitprojects/aegis12-gateway/video-demo/pitch_assets/tech_assets';

// Broken down into 4 precisely synced visual segments
const segments = [
  {
    id: 1,
    text: `This is the technical demonstration for Aegis-12. You are looking at the live deployment of our ZK Coprocessor Gateway. Our core directive was securing autonomous agentic capital natively on layer-one. We aggressively attempted native silicon verifications using AWS Nitro enclaves, but validating a 5 kilobyte TLS certificate chain consumed over 85 million Compute Units on Solana.`,
  },
  {
    id: 2,
    text: `It was physiologically impossible to fit within the 1.4 million CU limit blocks. To bypass this edge-to-chain bottleneck, we built a mathematically verifiable off-chain relay. The agent executes inside the TEE, but we push the 5 kilobyte attestation off-chain to a Groth16 circuit. We natively integrated Solana Durable Nonces via SystemProgram.nonceAdvance inside our SDK,`,
  },
  {
    id: 3,
    text: `ensuring the agent transaction safely idles in the mempool without hitting the recent blockhash expiration window. To eliminate Layer-2 MEV relay hijacking, we cryptographically extract the Solana SPL Memo payload into an AWS Nitro user data slice, binding it directly to the Groth16 public input constraint.`,
  },
  {
    id: 4,
    text: `When the compressed 256-byte ZK-SNARK hits our smart contract, execution is instant. Zero trust tradeoffs, zero latency proxies, maximum verifiability.`,
  }
];

function getFfmpegPath() {
  try { return execSync('which ffmpeg').toString().trim(); } 
  catch (e) {
    if (fs.existsSync('/opt/homebrew/bin/ffmpeg')) return '/opt/homebrew/bin/ffmpeg';
    return 'ffmpeg';
  }
}

function getFfprobePath() {
  try { return execSync('which ffprobe').toString().trim(); } 
  catch (e) {
    if (fs.existsSync('/opt/homebrew/bin/ffprobe')) return '/opt/homebrew/bin/ffprobe';
    return 'ffprobe';
  }
}

async function generateAudio(segId, text) {
  const outPath = path.join(OUT_DIR, `seg${segId}.mp3`);
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
    console.log(`  ♻️  seg${segId}.mp3 exists, skipping`);
    return;
  }
  console.log(`  🎙️  Generating seg${segId}.mp3...`);
  try {
    const resp = await axios.post('https://api.fish.audio/v1/tts', {
      text,
      reference_id: VOICE_ID,
      format: 'mp3',
    }, {
      headers: { 'Authorization': `Bearer ${FISH_API_KEY}`, 'Content-Type': 'application/json' },
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    fs.writeFileSync(outPath, resp.data);
    console.log(`  ✅ seg${segId}.mp3 (${(resp.data.length / 1024).toFixed(0)}KB)`);
  } catch (error) {
    console.error(`  ❌ Failed to generate audio for seg${segId}:`, error.message);
    process.exit(1);
  }
}

function getAudioDuration(filePath, ffprobePath) {
  try {
    return parseFloat(execSync(`"${ffprobePath}" -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`).toString().trim());
  } catch (e) {
    return 10.0;
  }
}

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  Aegis-12: Visual Technical Demo Sequence Builder      ');
  console.log('════════════════════════════════════════════════════════\n');

  const ffmpegPath = getFfmpegPath();
  const ffprobePath = getFfprobePath();
  const chunksDir = path.join(OUT_DIR, 'chunks');
  if (!fs.existsSync(chunksDir)) fs.mkdirSync(chunksDir, { recursive: true });

  console.log('Step 1: Segmented TTS Synthesis');
  for (const seg of segments) { await generateAudio(seg.id, seg.text); }

  console.log('\nStep 2: Multiplexing Terminal Assets with Audio');
  for (const seg of segments) {
    const audioPath = path.join(OUT_DIR, `seg${seg.id}.mp3`);
    const imgPath = path.join(OUT_DIR, `seg${seg.id}.png`);
    const chunkPath = path.join(chunksDir, `seg${seg.id}.mp4`);
    
    const dur = getAudioDuration(audioPath, ffprobePath);
    console.log(`  🎬 Processing Visual Terminal Seg ${seg.id} (${dur.toFixed(1)}s)...`);
    
    try {
      execSync(`"${ffmpegPath}" -y -framerate 1 -loop 1 -t ${dur} -i "${imgPath}" -i "${audioPath}" -vf "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,format=yuv420p" -c:v libx264 -tune stillimage -preset ultrafast -crf 30 -c:a aac -b:a 128k -t ${dur} "${chunkPath}" 2>/dev/null`);
      console.log(`  ✅ seg${seg.id}.mp4 generated`);
    } catch (e) {
      console.error(`  ❌ FFmpeg multiplexing failed on seg${seg.id}`);
      process.exit(1);
    }
  }

  console.log('\nStep 3: Sticthing Terminal Flow Sequence');
  const concatPath = path.join(chunksDir, 'concat.txt');
  fs.writeFileSync(concatPath, segments.map(s => `file 'seg${s.id}.mp4'`).join('\n'));
  
  const finalPath = path.join(OUT_DIR, 'Aegis-12-Visual-Tech-Demo.mp4');
  try {
    execSync(`"${ffmpegPath}" -y -f concat -safe 0 -i "${concatPath}" -c copy "${finalPath}" 2>/dev/null`);
    console.log(`  ✅ Successfully fused into Aegis-12-Visual-Tech-Demo.mp4`);
  } catch (e) {
    console.error(`  ❌ Concatenation failed.`);
    process.exit(1);
  }

  console.log('\nStep 4: Propagating to Cloudinary CDN...');
  cloudinary.config({ cloud_name: 'djol0rpn5', api_key: '888753318981763', api_secret: 'HqTbA8IE_o6CHbenhKb_iiKXOwo' });
  
  cloudinary.uploader.upload(finalPath, 
    { resource_type: "video", public_id: "aegis12_visual_tech_demo", overwrite: true, invalidate: true },
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
