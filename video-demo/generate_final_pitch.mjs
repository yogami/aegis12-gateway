/**
 * Aegis-12 Final Post-Pivot Pitch Video
 * 
 * Pipeline: Fish Audio TTS → Pre-staged Screenshots (PNG/WEBP) → FFMPEG Stitch
 * Strategy: Segmented Synchronization Pattern
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { execSync } from 'child_process';

const FISH_API_KEY = 'cfcfa3c247e04d24a29f6eece228c261'; // Re-using legacy key
const VOICE_ID = '2fcfdf3229d94dc2bcb02b2c35405545'; // The Founder Voice ID
const OUT_DIR = '/Users/user1000/gitprojects/aegis12-gateway/video-demo/pitch_assets';

// The mathematically hardened 5-part script
const segments = [
  {
    id: 1,
    ext: '.png',
    text: `The AI Agent ecosystem on Solana relies on vulnerable Web2 API proxies to interpret intent. Competing projects attempt to use Hardware Enclaves natively, which fails against Solana's strict network constraints: the 1,232-byte UDP MTU limit makes verifying a 5 Kilobyte Certificate Chain directly on-chain architecturally unfeasible.`,
  },
  {
    id: 2,
    ext: '.png',
    text: `Our architecture is the result of three grueling iterative pivots. We hit the Cryptographic Paradox. We discovered that verifying the standard TLS certificate chain required over 85 million Compute Units on Solana. Native silicon verification was totally computationally impossible.`,
  },
  {
    id: 3,
    ext: '.png',
    text: `So we bypassed the direct verification constraint entirely. Instead of forcing Solana to parse 5 Kilobytes of raw attestation math, we offloaded the computation to a RISC Zero Coprocessor to grind the cryptography off-chain.`,
  },
  {
    id: 4,
    ext: '.png',
    text: `Aegis-12 resolves this via Zero-Knowledge compression. The AI Agent executes inside AWS Nitro. The 5 Kilobyte Attestation is routed to a Groth16 ZK-Coprocessor. The highly compressed 256-byte ZK-SNARK hits the Solana Smart Contract, bypassing MTU limits to validate hardware instantly.`,
  },
  {
    id: 5,
    ext: '.png',
    text: `Aegis-12 is built for Enterprise Treasury and Code Auditing AI agents. It provides secure capital deployment via cryptographically verifiable hardware execution, hardened against adversarial models and relay hijacking risks.`,
  }
];

// Fallback logic for FFMPEG path if not immediately available
function getFfmpegPath() {
  try {
    return execSync('which ffmpeg').toString().trim();
  } catch (e) {
    if (fs.existsSync('/opt/homebrew/bin/ffmpeg')) return '/opt/homebrew/bin/ffmpeg';
    console.warn("⚠️  ffmpeg not found in PATH. You may need to run 'brew install ffmpeg'.");
    return 'ffmpeg';
  }
}

function getFfprobePath() {
  try {
    return execSync('which ffprobe').toString().trim();
  } catch (e) {
    if (fs.existsSync('/opt/homebrew/bin/ffprobe')) return '/opt/homebrew/bin/ffprobe';
    return 'ffprobe';
  }
}

async function generateAudio(segId, text) {
  const outPath = path.join(OUT_DIR, `seg${segId}.mp3`);
  if (fs.existsSync(outPath)) {
    console.log(`  ♻️  seg${segId}.mp3 exists, skipping`);
    return;
  }
  console.log(`  🎙️  Generating seg${segId}.mp3 via Fish Audio TTS...`);
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
    fs.writeFileSync(outPath, ""); 
  }
}

function getAudioDuration(filePath, ffprobePath) {
  try {
    return parseFloat(execSync(`"${ffprobePath}" -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`).toString().trim());
  } catch (e) {
    return 10.0; // Fallback
  }
}

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  Aegis-12: Final Colosseum Pitch Generator (Segmented) ');
  console.log('════════════════════════════════════════════════════════\n');

  const ffmpegPath = getFfmpegPath();
  const ffprobePath = getFfprobePath();

  const chunksDir = path.join(OUT_DIR, 'chunks');
  if (!fs.existsSync(chunksDir)) fs.mkdirSync(chunksDir, { recursive: true });

  console.log('Step 1: TTS Audio generation (Your Voice Clone)');
  for (const seg of segments) {
    await generateAudio(seg.id, seg.text);
  }

  console.log('\nStep 2: Verifying Visual Anchors');
  for (const seg of segments) {
    const imgPath = path.join(OUT_DIR, `seg${seg.id}${seg.ext}`);
    if (!fs.existsSync(imgPath)) {
      console.error(`  ❌ Missing visual anchor: ${imgPath}`);
      process.exit(1);
    }
    console.log(`  ✅ ${path.basename(imgPath)} exists`);
  }

  console.log('\nStep 3: Encoding & Fusing Segments');
  for (const seg of segments) {
    const audioPath = path.join(OUT_DIR, `seg${seg.id}.mp3`);
    const imgPath = path.join(OUT_DIR, `seg${seg.id}${seg.ext}`);
    const chunkPath = path.join(chunksDir, `seg${seg.id}.mp4`);
    
    let dur = 10.0;
    if (fs.existsSync(audioPath) && fs.statSync(audioPath).size > 0) {
      dur = getAudioDuration(audioPath, ffprobePath);
    }
    
    console.log(`  🎬 Processing seg${seg.id} (${dur.toFixed(1)}s)...`);
    try {
      execSync(`"${ffmpegPath}" -y -framerate 1 -loop 1 -t ${dur} -i "${imgPath}" -i "${audioPath}" -vf "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,format=yuv420p" -c:v libx264 -tune stillimage -preset ultrafast -crf 30 -c:a aac -b:a 128k -t ${dur} "${chunkPath}" 2>/dev/null`);
      console.log(`  ✅ seg${seg.id}.mp4 generated`);
    } catch (e) {
      console.error(`  ❌ FFmpeg failed on seg${seg.id}`);
    }
  }

  console.log('\nStep 4: Final Stitching');
  const concatPath = path.join(chunksDir, 'concat.txt');
  const concatLines = segments.map(s => `file 'seg${s.id}.mp4'`).join('\n');
  fs.writeFileSync(concatPath, concatLines);
  
  const finalPath = path.join(OUT_DIR, 'Aegis-12-Final-Submission.mp4');
  try {
    execSync(`"${ffmpegPath}" -y -f concat -safe 0 -i "${concatPath}" -c copy "${finalPath}" 2>/dev/null`);
    
    if (fs.existsSync(finalPath)) {
      const totalDur = getAudioDuration(finalPath, ffprobePath);
      const sizeMB = (fs.statSync(finalPath).size / 1024 / 1024).toFixed(1);
      console.log(`\n════════════════════════════════════════════════════════`);
      console.log(`  ✅ COMPLETE: ${finalPath}`);
      console.log(`  Duration: ${totalDur.toFixed(1)}s | Size: ${sizeMB}MB`);
      console.log(`════════════════════════════════════════════════════════`);
    }
  } catch (e) {
    console.error(`\n  ❌ Failed to stitch. Check if all chunks were created successfully.`);
  }
}

main().catch(console.error);
