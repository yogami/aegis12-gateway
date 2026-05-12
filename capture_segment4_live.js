const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  // Create a browser context with video recording enabled
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: '/tmp/videos/',
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();

  console.log("Navigating to live dashboard...");
  await page.goto('http://localhost:3000');
  
  // Wait for initial render and animations to settle
  await page.waitForTimeout(2000); 

  console.log("Triggering the Live Fire Intent Stream...");
  // Click the "Trigger Intent Stream" button
  await page.getByRole('button', { name: '▶ Trigger Intent Stream' }).click();

  console.log("Waiting for ZK Sealing to resolve...");
  
  // Wait for the UI to resolve to VERIFIED. 
  // We use a timeout of 15 seconds to be safe on Devnet
  await page.waitForSelector('text=✅ VERIFIED', { timeout: 15000 });

  console.log("✅ Verified on-chain! Capturing the final state...");
  
  // Wait a few seconds for the viewer to read the final state
  await page.waitForTimeout(4000);

  // Close context to ensure video is saved
  await context.close();
  await browser.close();

  // Find the generated video file and rename it
  const files = fs.readdirSync('/tmp/videos/');
  const videoFile = files.find(f => f.endsWith('.webm'));
  
  if (videoFile) {
      const oldPath = path.join('/tmp/videos/', videoFile);
      const newPath = path.join(process.cwd(), 'seg4_live_fire.webm');
      fs.renameSync(oldPath, newPath);
      console.log(`Video saved to ${newPath}`);
  } else {
      console.error("Video file not found in /tmp/videos/");
  }
})();
