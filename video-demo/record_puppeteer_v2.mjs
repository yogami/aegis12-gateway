import puppeteer from 'puppeteer';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { v2 as cloudinary } from 'cloudinary';

const OUT_DIR = '/Users/user1000/gitprojects/aegis12-gateway/video-demo';
const finalVideoPath = path.join(OUT_DIR, 'Aegis-12-Code-Execution.mp4');
const audioPath = path.join(OUT_DIR, 'final_tech_audio.mp3');

function getFfmpegPath() {
  try { return execSync('which ffmpeg').toString().trim(); } 
  catch (e) { return fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg'; }
}

async function recordNativeDOM() {
    console.log('════════════════════════════════════════════════════════');
    console.log('  Aegis-12: Full DOM-Anchored Technical Highlight Drone ');
    console.log('════════════════════════════════════════════════════════');

    const browser = await puppeteer.launch({ 
        headless: 'new',
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 }); // Full HD Frame
    
    // Natively intercept the browser clock and animations for absolute fidelity
    const recorderPath = path.join(OUT_DIR, 'native_ui_v2.mp4');
    const recorder = new PuppeteerScreenRecorder(page, { fps: 30 });
    
    console.log('  🎬 Starting Recording...');
    await recorder.start(recorderPath);
    await page.goto('http://localhost:3000/');
    
    // 0s-10s: Introduction & URL highlighting.
    
    console.log('  ⏳ Waiting for NextJS Hot Compile to finish (up to 60s)...');
    await page.waitForSelector('#executeAegisBtn', { timeout: 60000 });
    console.log('  ✅ Page Loaded. Starting visual timeline logic.');
    
    await new Promise(r => setTimeout(r, 2000));
    await page.evaluate(() => {
        const u = document.getElementById('demo-url');
        if(u) {
            u.style.border = '5px solid red';
            u.style.boxShadow = '0 0 20px red';
            u.style.backgroundColor = 'rgba(255,0,0,0.2)';
        }
    });

    // 10s: Execute Button
    await new Promise(r => setTimeout(r, 10000));
    await page.waitForSelector('#executeAegisBtn', { timeout: 5000 });
    await page.click('#executeAegisBtn');

    // 40s: Highlight Durable Nonce mapping
    // At exactly 40s into the video (2s intro + 10s click + 28s wait)
    await new Promise(r => setTimeout(r, 28000));
    await page.evaluate(() => {
        const tx = document.getElementById('demo-transaction-log');
        if(tx) {
            tx.style.border = '5px solid red';
            tx.style.boxShadow = '0 0 20px red';
            tx.style.backgroundColor = 'rgba(255,0,0,0.2)';
        }
    });

    // 73s: Highlight the Final Validator Result
    // (We waited 40s so far, wait another 33s)
    await new Promise(r => setTimeout(r, 34000));
    await page.evaluate(() => {
        const res = document.getElementById('demo-result-log');
        if(res) {
            res.style.border = '5px solid red';
            res.style.boxShadow = '0 0 20px red';
            res.style.backgroundColor = 'rgba(255,0,0,0.2)';
        }
    });

    // Keep recording through the end of the voiceover (91.5s total duration)
    // Currently at 2+10+28+34 = 74s. Wait 18 more seconds.
    await new Promise(r => setTimeout(r, 18000));
    
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
      { resource_type: "video", public_id: "aegis12_absolute_truth_demo", overwrite: true, invalidate: true },
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

Math.random(); // Bust cache
orchestrate().catch(console.error);
