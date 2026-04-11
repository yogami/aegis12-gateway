import puppeteer from 'puppeteer';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { v2 as cloudinary } from 'cloudinary';

const OUT_DIR = '/Users/user1000/gitprojects/aegis12-gateway/video-demo';
const finalVideoPath = path.join(OUT_DIR, 'Aegis-12-Code-Execution.mp4');
const audioPath = path.join(OUT_DIR, 'native_voiceover.mp3');

function getFfmpegPath() {
  try { return execSync('which ffmpeg').toString().trim(); } 
  catch (e) { return fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg'; }
}

async function recordNativeDOM() {
    console.log('════════════════════════════════════════════════════════');
    console.log('  Aegis-12: Launching Puppeteer Native Recording Drone  ');
    console.log('  🎬 Starting Recording...');
    const browser = await puppeteer.launch({ 
        headless: 'new',
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    const recorderPath = path.join(OUT_DIR, 'native_ui.mp4');
    const recorder = new PuppeteerScreenRecorder(page, { fps: 30 });
    
    console.log('  🎬 Starting Recording...');
    await recorder.start(recorderPath);
    await page.goto('http://localhost:3000/native_demo.html');
    
    // Wait exactly 25.5 seconds for all DOM Red Marker CSS animations to clear
    console.log('  ⏳ Waiting 26s for automated CSS DOM tracking to clear...');
    await new Promise(r => setTimeout(r, 26000));
    
    await recorder.stop();
    await browser.close();
    console.log('  ✅ MP4 Natively Output Successfully!');
    return recorderPath;
}

async function orchestrate() {
    const rawMp4 = await recordNativeDOM();
    const ffmpegPath = getFfmpegPath();

    console.log('\nStep 2: Multiplexing pristine MP4 Native Video with Target Audio...');
    try {
        // Fast stitch mapping audio securely
        execSync(`"${ffmpegPath}" -y -i "${rawMp4}" -i "${audioPath}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest "${finalVideoPath}" 2>/dev/null`);
        console.log(`  ✅ Video successfully stitched into Aegis-12-Code-Execution.mp4.`);
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

orchestrate().catch(console.error);
