const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log("Starting Playwright capture...");
  // Use playwright to capture video
  const browser = await chromium.launch({ headless: true });
  
  const videoDir = path.join(__dirname, 'public');
  if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: videoDir,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();

  console.log("Navigating to live dashboard...");
  await page.goto('https://aegis12-dashboarduprailwayapp-production.up.railway.app');
  
  // Zoom out slightly to fit everything nicely for the video
  await page.evaluate(() => { document.body.style.zoom = "90%" });
  
  await page.waitForTimeout(2000); 

  console.log("Triggering Intent Stream...");
  await page.getByRole('button', { name: '▶ Trigger Intent Stream' }).click();

  // Let the stream run and capture the UI state for about 20 seconds.
  // This gives us plenty of B-roll footage to draw highlights over in Remotion.
  await page.waitForTimeout(20000);

  await context.close();
  await browser.close();

  // Find the generated video file and rename it to ui_base.webm
  const files = fs.readdirSync(videoDir);
  const videoFile = files.find(f => f.endsWith('.webm') && f !== 'ui_base.webm');
  
  if (videoFile) {
      const oldPath = path.join(videoDir, videoFile);
      const newPath = path.join(videoDir, 'ui_base.webm');
      if (fs.existsSync(newPath)) fs.unlinkSync(newPath); // Remove old one if exists
      fs.renameSync(oldPath, newPath);
      console.log(`✅ Base UI Video saved to ${newPath}`);
  } else {
      console.error("❌ Video file not found!");
  }
})();
