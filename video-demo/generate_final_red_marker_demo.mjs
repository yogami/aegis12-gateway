/**
 * Native Red Marker Demo Orchestrator
 * Pipeline: Extract WebP Browser Capture -> Generate Native Voiceover -> Multiplex via x264 -> Cloudinary
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { execSync } from 'child_process';
import { v2 as cloudinary } from 'cloudinary';

const FISH_API_KEY = 'cfcfa3c247e04d24a29f6eece228c261'; // Authorized
const VOICE_ID = '2fcfdf3229d94dc2bcb02b2c35405545'; // founder's clone
const OUT_DIR = '/Users/user1000/gitprojects/aegis12-gateway/video-demo';
const CAPTURE_FILE = '/Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/aegis12_native_red_marker_1775903109140.webp';

const script = "To interact with the Aegis-12 architecture, hit our demo gateway endpoint. On connection, the system attempts to verify the 5-kilobyte TLS certificate. Notice the transaction payload intercept: we bind the Solana Durable Nonce into the Groth16 circuit. And here is the exact verification resolution bypassing the MTU limits natively on layer-one.";

function getFfmpegPath() {
  try { return execSync('which ffmpeg').toString().trim(); } 
  catch (e) { return fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg'; }
}

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  Aegis-12: Red Marker Native DOM Multiplexer           ');
  console.log('════════════════════════════════════════════════════════\n');

  if (!fs.existsSync(CAPTURE_FILE)) {
      console.error("❌ Missing Browser Recording:", CAPTURE_FILE);
      process.exit(1);
  }

  const audioPath = path.join(OUT_DIR, 'native_voiceover.mp3');
  const finalVideoPath = path.join(OUT_DIR, 'Aegis-12-Code-Execution.mp4');
  const ffmpegPath = getFfmpegPath();

  console.log('Step 1: Generating Native Target Audio...');
  if (!fs.existsSync(audioPath)) {
      try {
          const resp = await axios.post('https://api.fish.audio/v1/tts', {
            text: script,
            reference_id: VOICE_ID,
            format: 'mp3',
          }, {
            headers: { 'Authorization': `Bearer ${FISH_API_KEY}`, 'Content-Type': 'application/json' },
            responseType: 'arraybuffer',
            timeout: 30000,
          });
          fs.writeFileSync(audioPath, resp.data);
          console.log(`  ✅ Audio generated.`);
      } catch (e) {
          console.error(`  ❌ TTS Failed`);
          process.exit(1);
      }
  }

  console.log('\nStep 2: Multiplexing WebP Native Video with Audio...');
  try {
      execSync(`"${ffmpegPath}" -y -i "${CAPTURE_FILE}" -i "${audioPath}" -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 128k -filter:v "setpts=1.25*PTS" -shortest "${finalVideoPath}" 2>/dev/null`);
      console.log(`  ✅ Video successfully stitched.`);
  } catch (e) {
      console.error(`  ❌ FFmpeg transcoding failed.`);
      process.exit(1);
  }

  console.log('\nStep 3: Staging Cloudinary Upload...');
  cloudinary.config({ cloud_name: 'djol0rpn5', api_key: '888753318981763', api_secret: 'HqTbA8IE_o6CHbenhKb_iiKXOwo' });
  
  cloudinary.uploader.upload(finalVideoPath, 
    { resource_type: "video", public_id: "aegis12_native_execution", overwrite: true, invalidate: true },
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
